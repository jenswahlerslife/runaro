-- Create comprehensive error reporting system
-- This system will capture and report all frontend and backend errors in real-time

-- 1. Create error_reports table to store all errors
CREATE TABLE public.error_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  error_type text NOT NULL, -- 'javascript', 'network', 'database', 'auth', etc.
  error_message text NOT NULL,
  error_stack text,
  url text NOT NULL,
  user_agent text,
  timestamp timestamptz DEFAULT now(),
  severity text DEFAULT 'error', -- 'error', 'warning', 'info'
  source text, -- 'frontend', 'backend', 'supabase'
  context jsonb, -- Additional context data
  resolved boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Add indexes for performance
CREATE INDEX idx_error_reports_timestamp ON public.error_reports(timestamp DESC);
CREATE INDEX idx_error_reports_user_id ON public.error_reports(user_id);
CREATE INDEX idx_error_reports_error_type ON public.error_reports(error_type);
CREATE INDEX idx_error_reports_resolved ON public.error_reports(resolved);

-- Enable RLS
ALTER TABLE public.error_reports ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to insert their own error reports
CREATE POLICY "Users can insert own error reports"
ON public.error_reports
FOR INSERT
WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Allow admin users to view all error reports
CREATE POLICY "Admin can view all error reports"
ON public.error_reports
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.user_id = auth.uid() 
    AND profiles.username = 'admin'
  )
  OR auth.uid() = user_id
);

-- 2. Function to log errors
CREATE OR REPLACE FUNCTION public.log_error(
  p_error_type text,
  p_error_message text,
  p_error_stack text DEFAULT NULL,
  p_url text DEFAULT NULL,
  p_user_agent text DEFAULT NULL,
  p_severity text DEFAULT 'error',
  p_source text DEFAULT 'frontend',
  p_context jsonb DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  error_id uuid;
  user_id_val uuid;
BEGIN
  -- Get current user (can be null for anonymous errors)
  user_id_val := auth.uid();
  
  -- Insert error report
  INSERT INTO public.error_reports (
    user_id, error_type, error_message, error_stack, 
    url, user_agent, severity, source, context
  )
  VALUES (
    user_id_val, p_error_type, p_error_message, p_error_stack,
    p_url, p_user_agent, p_severity, p_source, p_context
  )
  RETURNING id INTO error_id;

  -- Return success with error ID
  RETURN json_build_object(
    'success', true,
    'error_id', error_id,
    'logged_at', now()
  );
EXCEPTION
  WHEN OTHERS THEN
    -- Even error logging can fail, so return minimal info
    RETURN json_build_object(
      'success', false,
      'error', 'Failed to log error: ' || SQLERRM
    );
END;
$$;

-- Set proper privileges
ALTER FUNCTION public.log_error(text, text, text, text, text, text, text, jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.log_error(text, text, text, text, text, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_error(text, text, text, text, text, text, text, jsonb) TO anon, authenticated;

-- 3. Function to get recent errors (admin only)
CREATE OR REPLACE FUNCTION public.get_recent_errors(
  p_limit integer DEFAULT 50,
  p_hours integer DEFAULT 24
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  result json;
BEGIN
  -- Check if user is admin
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.user_id = auth.uid() 
    AND profiles.username = 'admin'
  ) THEN
    RETURN json_build_object('error', 'Access denied');
  END IF;

  -- Get recent errors with user details
  SELECT json_agg(
    json_build_object(
      'id', er.id,
      'error_type', er.error_type,
      'error_message', er.error_message,
      'error_stack', er.error_stack,
      'url', er.url,
      'timestamp', er.timestamp,
      'severity', er.severity,
      'source', er.source,
      'context', er.context,
      'username', COALESCE(p.username, p.display_name, 'anonymous'),
      'user_id', er.user_id,
      'resolved', er.resolved
    )
    ORDER BY er.timestamp DESC
  )
  INTO result
  FROM public.error_reports er
  LEFT JOIN public.profiles p ON er.user_id = p.user_id
  WHERE er.timestamp > (now() - (p_hours || ' hours')::interval)
  LIMIT p_limit;

  RETURN COALESCE(result, '[]'::json);
END;
$$;

-- Set proper privileges
ALTER FUNCTION public.get_recent_errors(integer, integer) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.get_recent_errors(integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_recent_errors(integer, integer) TO authenticated;

-- 4. Function to mark error as resolved
CREATE OR REPLACE FUNCTION public.resolve_error(p_error_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Check if user is admin
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.user_id = auth.uid() 
    AND profiles.username = 'admin'
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Access denied');
  END IF;

  -- Mark error as resolved
  UPDATE public.error_reports 
  SET resolved = true 
  WHERE id = p_error_id;

  RETURN json_build_object('success', true, 'resolved_at', now());
END;
$$;

-- Set proper privileges
ALTER FUNCTION public.resolve_error(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.resolve_error(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_error(uuid) TO authenticated;

-- 5. Create a realtime subscription trigger
CREATE OR REPLACE FUNCTION public.notify_error_inserted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Only notify for severe errors to avoid spam
  IF NEW.severity IN ('error', 'critical') THEN
    PERFORM pg_notify('error_report', json_build_object(
      'id', NEW.id,
      'error_type', NEW.error_type,
      'error_message', NEW.error_message,
      'url', NEW.url,
      'severity', NEW.severity,
      'timestamp', NEW.timestamp,
      'user_id', NEW.user_id
    )::text);
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for real-time notifications
CREATE TRIGGER error_report_notify
  AFTER INSERT ON public.error_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_error_inserted();

SELECT 'Error reporting system created successfully' as status;