
-- PERMANENT DDL SYSTEM SETUP
-- Run this ONCE in your Supabase SQL Editor, then Claude can handle all future DDL automatically

-- Create DDL execution function
CREATE OR REPLACE FUNCTION public.claude_execute_ddl(command_text text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result_data jsonb;
BEGIN
  -- Execute the DDL
  EXECUTE command_text;
  
  -- Log successful execution
  INSERT INTO public.ddl_log (command, status, executed_at)
  VALUES (command_text, 'success', now())
  ON CONFLICT DO NOTHING;
  
  result_data := jsonb_build_object(
    'success', true,
    'message', 'DDL executed successfully',
    'timestamp', now()
  );
  
  RETURN result_data;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error
    INSERT INTO public.ddl_log (command, status, error_message, executed_at)
    VALUES (command_text, 'error', SQLERRM, now())
    ON CONFLICT DO NOTHING;
    
    result_data := jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'error_code', SQLSTATE
    );
    
    RETURN result_data;
END;
$$;

-- Create DDL log table
CREATE TABLE IF NOT EXISTS public.ddl_log (
  id serial PRIMARY KEY,
  command text NOT NULL,
  status text NOT NULL,
  error_message text,
  executed_at timestamptz DEFAULT now()
);

-- Add the included_in_game column immediately
ALTER TABLE public.user_activities
  ADD COLUMN IF NOT EXISTS included_in_game boolean NOT NULL DEFAULT true;

UPDATE public.user_activities 
SET included_in_game = true 
WHERE included_in_game IS NULL;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.claude_execute_ddl(text) TO service_role;
GRANT ALL ON TABLE public.ddl_log TO service_role;

-- Success message
SELECT 'Claude DDL System Setup Complete! 🎉' as message;
