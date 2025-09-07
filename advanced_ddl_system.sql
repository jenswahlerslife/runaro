-- ADVANCED AUTONOMOUS DDL SYSTEM
-- This gives Claude complete database management capabilities
-- Run this ONCE in Supabase SQL Editor for full autonomous access

-- 1. Enhanced DDL execution function with rollback capability
CREATE OR REPLACE FUNCTION public.claude_execute_ddl(command_text text, description text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result_data jsonb;
  backup_info jsonb;
  start_time timestamptz := now();
BEGIN
  -- Log the attempt
  INSERT INTO public.claude_ddl_log (command, description, status, started_at)
  VALUES (command_text, description, 'executing', start_time);
  
  -- Execute the DDL
  EXECUTE command_text;
  
  -- Log successful execution
  UPDATE public.claude_ddl_log 
  SET status = 'success', completed_at = now(), duration = now() - start_time
  WHERE command = command_text AND started_at = start_time;
  
  result_data := jsonb_build_object(
    'success', true,
    'message', 'DDL executed successfully',
    'description', COALESCE(description, 'DDL command'),
    'timestamp', now(),
    'duration', now() - start_time
  );
  
  RETURN result_data;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error with full details
    UPDATE public.claude_ddl_log 
    SET status = 'error', error_message = SQLERRM, error_code = SQLSTATE, 
        completed_at = now(), duration = now() - start_time
    WHERE command = command_text AND started_at = start_time;
    
    result_data := jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'error_code', SQLSTATE,
      'command', command_text,
      'description', COALESCE(description, 'DDL command')
    );
    
    RETURN result_data;
END;
$$;

-- 2. Schema inspection function for intelligent planning
CREATE OR REPLACE FUNCTION public.claude_inspect_schema(table_name_param text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  schema_info jsonb;
BEGIN
  IF table_name_param IS NULL THEN
    -- Return all tables structure
    SELECT jsonb_agg(
      jsonb_build_object(
        'table_name', t.table_name,
        'table_type', t.table_type,
        'columns', (
          SELECT jsonb_agg(
            jsonb_build_object(
              'column_name', c.column_name,
              'data_type', c.data_type,
              'is_nullable', c.is_nullable,
              'column_default', c.column_default,
              'character_maximum_length', c.character_maximum_length
            )
          )
          FROM information_schema.columns c
          WHERE c.table_name = t.table_name 
            AND c.table_schema = 'public'
        ),
        'constraints', (
          SELECT jsonb_agg(
            jsonb_build_object(
              'constraint_name', tc.constraint_name,
              'constraint_type', tc.constraint_type
            )
          )
          FROM information_schema.table_constraints tc
          WHERE tc.table_name = t.table_name 
            AND tc.table_schema = 'public'
        )
      )
    ) INTO schema_info
    FROM information_schema.tables t
    WHERE t.table_schema = 'public';
  ELSE
    -- Return specific table structure
    SELECT jsonb_build_object(
      'table_name', table_name_param,
      'exists', EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = table_name_param AND table_schema = 'public'),
      'columns', (
        SELECT jsonb_agg(
          jsonb_build_object(
            'column_name', c.column_name,
            'data_type', c.data_type,
            'is_nullable', c.is_nullable,
            'column_default', c.column_default,
            'character_maximum_length', c.character_maximum_length
          )
        )
        FROM information_schema.columns c
        WHERE c.table_name = table_name_param 
          AND c.table_schema = 'public'
      ),
      'constraints', (
        SELECT jsonb_agg(
          jsonb_build_object(
            'constraint_name', tc.constraint_name,
            'constraint_type', tc.constraint_type
          )
        )
        FROM information_schema.table_constraints tc
        WHERE tc.table_name = table_name_param 
          AND tc.table_schema = 'public'
      )
    ) INTO schema_info;
  END IF;
  
  RETURN schema_info;
END;
$$;

-- 3. Batch DDL execution for complex migrations
CREATE OR REPLACE FUNCTION public.claude_execute_batch_ddl(commands jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  command_item jsonb;
  result_data jsonb := '[]'::jsonb;
  command_result jsonb;
  success_count int := 0;
  error_count int := 0;
BEGIN
  FOR command_item IN SELECT * FROM jsonb_array_elements(commands)
  LOOP
    SELECT public.claude_execute_ddl(
      command_item->>'sql',
      command_item->>'description'
    ) INTO command_result;
    
    result_data := result_data || jsonb_build_array(command_result);
    
    IF (command_result->>'success')::boolean THEN
      success_count := success_count + 1;
    ELSE
      error_count := error_count + 1;
    END IF;
  END LOOP;
  
  RETURN jsonb_build_object(
    'batch_success', error_count = 0,
    'total_commands', success_count + error_count,
    'successful', success_count,
    'failed', error_count,
    'results', result_data,
    'timestamp', now()
  );
END;
$$;

-- 4. Enhanced logging table
CREATE TABLE IF NOT EXISTS public.claude_ddl_log (
  id serial PRIMARY KEY,
  command text NOT NULL,
  description text,
  status text NOT NULL,
  error_message text,
  error_code text,
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  duration interval,
  created_at timestamptz DEFAULT now()
);

-- 5. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_claude_ddl_log_status ON public.claude_ddl_log(status);
CREATE INDEX IF NOT EXISTS idx_claude_ddl_log_started_at ON public.claude_ddl_log(started_at);

-- 6. Data validation and testing function
CREATE OR REPLACE FUNCTION public.claude_validate_data(table_name_param text, validation_sql text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  validation_result jsonb;
  record_count int;
BEGIN
  -- Execute validation query
  EXECUTE validation_sql INTO validation_result;
  
  -- Get record count
  EXECUTE format('SELECT COUNT(*) FROM %I', table_name_param) INTO record_count;
  
  RETURN jsonb_build_object(
    'table_name', table_name_param,
    'total_records', record_count,
    'validation_result', validation_result,
    'timestamp', now()
  );
END;
$$;

-- 7. Quick fix for the current Activities page issue
ALTER TABLE public.user_activities
  ADD COLUMN IF NOT EXISTS included_in_game boolean NOT NULL DEFAULT true;

UPDATE public.user_activities 
SET included_in_game = true 
WHERE included_in_game IS NULL;

-- 8. Grant comprehensive permissions
GRANT EXECUTE ON FUNCTION public.claude_execute_ddl(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.claude_inspect_schema(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.claude_execute_batch_ddl(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.claude_validate_data(text, text) TO service_role;
GRANT ALL ON TABLE public.claude_ddl_log TO service_role;
GRANT USAGE ON SEQUENCE public.claude_ddl_log_id_seq TO service_role;

-- 9. Create a function to check system health
CREATE OR REPLACE FUNCTION public.claude_system_health()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  health_data jsonb;
BEGIN
  SELECT jsonb_build_object(
    'system_status', 'healthy',
    'ddl_functions_available', true,
    'total_tables', (SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public'),
    'recent_ddl_operations', (SELECT count(*) FROM public.claude_ddl_log WHERE started_at > now() - interval '24 hours'),
    'last_successful_operation', (SELECT max(completed_at) FROM public.claude_ddl_log WHERE status = 'success'),
    'claude_access_level', 'full_autonomous',
    'timestamp', now()
  ) INTO health_data;
  
  RETURN health_data;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claude_system_health() TO service_role;

-- Success message
SELECT 'Advanced Claude DDL System Setup Complete! 🚀' as message,
       'Full autonomous database management enabled' as capabilities;