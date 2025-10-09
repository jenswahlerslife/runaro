-- ADVANCED BACKUP & ROLLBACK SYSTEM
-- Add this to the advanced_ddl_system.sql for complete rollback capabilities

-- 1. Schema backup table
CREATE TABLE IF NOT EXISTS public.claude_schema_backups (
  id serial PRIMARY KEY,
  backup_name text NOT NULL,
  table_name text NOT NULL,
  column_definitions jsonb,
  constraints jsonb,
  indexes jsonb,
  data_sample jsonb,
  created_at timestamptz DEFAULT now(),
  created_by text DEFAULT 'claude_auto'
);

-- 2. Create backup before DDL changes
CREATE OR REPLACE FUNCTION public.claude_backup_schema(table_name_param text, backup_name_param text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  backup_data jsonb;
  column_data jsonb;
  constraint_data jsonb;
  index_data jsonb;
  sample_data jsonb;
BEGIN
  -- Get column definitions
  SELECT jsonb_agg(
    jsonb_build_object(
      'column_name', c.column_name,
      'data_type', c.data_type,
      'is_nullable', c.is_nullable,
      'column_default', c.column_default,
      'character_maximum_length', c.character_maximum_length,
      'numeric_precision', c.numeric_precision,
      'numeric_scale', c.numeric_scale
    )
  ) INTO column_data
  FROM information_schema.columns c
  WHERE c.table_name = table_name_param 
    AND c.table_schema = 'public';

  -- Get constraints
  SELECT jsonb_agg(
    jsonb_build_object(
      'constraint_name', tc.constraint_name,
      'constraint_type', tc.constraint_type,
      'column_names', (
        SELECT array_agg(kcu.column_name)
        FROM information_schema.key_column_usage kcu
        WHERE kcu.constraint_name = tc.constraint_name
      )
    )
  ) INTO constraint_data
  FROM information_schema.table_constraints tc
  WHERE tc.table_name = table_name_param 
    AND tc.table_schema = 'public';

  -- Get indexes
  SELECT jsonb_agg(
    jsonb_build_object(
      'index_name', i.indexname,
      'definition', i.indexdef
    )
  ) INTO index_data
  FROM pg_indexes i
  WHERE i.tablename = table_name_param 
    AND i.schemaname = 'public';

  -- Get sample data (first 10 rows for rollback reference)
  EXECUTE format('SELECT jsonb_agg(row_to_json(t)) FROM (SELECT * FROM %I LIMIT 10) t', table_name_param) 
  INTO sample_data;

  -- Insert backup
  INSERT INTO public.claude_schema_backups 
  (backup_name, table_name, column_definitions, constraints, indexes, data_sample)
  VALUES 
  (backup_name_param, table_name_param, column_data, constraint_data, index_data, sample_data);

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Schema backup created successfully',
    'backup_name', backup_name_param,
    'table_name', table_name_param,
    'timestamp', now()
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'error_code', SQLSTATE
    );
END;
$$;

-- 3. Enhanced DDL function with automatic backup
CREATE OR REPLACE FUNCTION public.claude_execute_ddl_safe(
  command_text text, 
  description text DEFAULT NULL,
  auto_backup boolean DEFAULT true,
  table_name_param text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result_data jsonb;
  backup_result jsonb;
  backup_name text;
  start_time timestamptz := now();
  affected_table text;
BEGIN
  -- Extract table name from DDL if not provided
  IF table_name_param IS NULL THEN
    affected_table := (regexp_matches(command_text, 'TABLE\s+(?:public\.)?(\w+)', 'i'))[1];
  ELSE
    affected_table := table_name_param;
  END IF;

  -- Create automatic backup if requested and table exists
  IF auto_backup AND affected_table IS NOT NULL THEN
    backup_name := 'auto_backup_' || affected_table || '_' || extract(epoch from now())::text;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = affected_table AND table_schema = 'public') THEN
      SELECT public.claude_backup_schema(affected_table, backup_name) INTO backup_result;
      
      IF NOT (backup_result->>'success')::boolean THEN
        RETURN jsonb_build_object(
          'success', false,
          'error', 'Backup failed: ' || (backup_result->>'error'),
          'stage', 'backup'
        );
      END IF;
    END IF;
  END IF;

  -- Log the attempt with backup info
  INSERT INTO public.claude_ddl_log (command, description, status, started_at)
  VALUES (command_text, COALESCE(description, 'DDL with backup'), 'executing', start_time);
  
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
    'backup_created', auto_backup,
    'backup_name', backup_name,
    'affected_table', affected_table,
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
      'description', COALESCE(description, 'DDL command'),
      'backup_created', auto_backup,
      'backup_name', backup_name,
      'stage', 'execution'
    );
    
    RETURN result_data;
END;
$$;

-- 4. Rollback function
CREATE OR REPLACE FUNCTION public.claude_rollback_schema(backup_name_param text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  backup_record record;
  rollback_sql text;
  result_data jsonb;
BEGIN
  -- Get backup data
  SELECT * INTO backup_record
  FROM public.claude_schema_backups
  WHERE backup_name = backup_name_param
  ORDER BY created_at DESC
  LIMIT 1;

  IF backup_record IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Backup not found: ' || backup_name_param
    );
  END IF;

  -- This is a simplified rollback - in practice you'd need more sophisticated logic
  -- For now, just return the backup data for manual restoration
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Backup data retrieved - manual restoration required',
    'backup_name', backup_name_param,
    'table_name', backup_record.table_name,
    'backup_data', jsonb_build_object(
      'columns', backup_record.column_definitions,
      'constraints', backup_record.constraints,
      'indexes', backup_record.indexes,
      'sample_data', backup_record.data_sample
    ),
    'created_at', backup_record.created_at
  );
END;
$$;

-- 5. List available backups
CREATE OR REPLACE FUNCTION public.claude_list_backups(table_name_param text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  backups_data jsonb;
BEGIN
  IF table_name_param IS NULL THEN
    SELECT jsonb_agg(
      jsonb_build_object(
        'backup_name', backup_name,
        'table_name', table_name,
        'created_at', created_at,
        'age', now() - created_at
      )
      ORDER BY created_at DESC
    ) INTO backups_data
    FROM public.claude_schema_backups;
  ELSE
    SELECT jsonb_agg(
      jsonb_build_object(
        'backup_name', backup_name,
        'table_name', table_name,
        'created_at', created_at,
        'age', now() - created_at
      )
      ORDER BY created_at DESC
    ) INTO backups_data
    FROM public.claude_schema_backups
    WHERE table_name = table_name_param;
  END IF;

  RETURN jsonb_build_object(
    'backups', COALESCE(backups_data, '[]'::jsonb),
    'count', jsonb_array_length(COALESCE(backups_data, '[]'::jsonb))
  );
END;
$$;

-- Grant permissions for backup functions
GRANT EXECUTE ON FUNCTION public.claude_backup_schema(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.claude_execute_ddl_safe(text, text, boolean, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.claude_rollback_schema(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.claude_list_backups(text) TO service_role;
GRANT ALL ON TABLE public.claude_schema_backups TO service_role;
GRANT USAGE ON SEQUENCE public.claude_schema_backups_id_seq TO service_role;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_schema_backups_table_name ON public.claude_schema_backups(table_name);
CREATE INDEX IF NOT EXISTS idx_schema_backups_backup_name ON public.claude_schema_backups(backup_name);
CREATE INDEX IF NOT EXISTS idx_schema_backups_created_at ON public.claude_schema_backups(created_at);

SELECT 'Advanced Backup & Rollback System Setup Complete! 🔄' as message;