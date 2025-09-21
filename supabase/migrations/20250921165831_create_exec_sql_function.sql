-- Create exec_sql RPC function for Edge Functions
-- This function allows Edge Functions to execute dynamic SQL safely

CREATE OR REPLACE FUNCTION public.exec_sql(sql_text TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  result JSON;
  exec_result RECORD;
BEGIN
  -- Basic validation to prevent dangerous operations
  IF sql_text IS NULL OR length(trim(sql_text)) = 0 THEN
    RAISE EXCEPTION 'SQL text cannot be empty';
  END IF;

  -- Prevent dangerous operations (basic safety check)
  -- Allow CREATE TABLE IF NOT EXISTS but block other dangerous operations
  IF sql_text ILIKE '%DROP %' OR
     (sql_text ILIKE '%DELETE %' AND sql_text NOT ILIKE '%DELETE FROM %WHERE%') OR
     sql_text ILIKE '%TRUNCATE %' OR
     (sql_text ILIKE '%ALTER %' AND sql_text NOT ILIKE '%ALTER TABLE % ADD COLUMN IF NOT EXISTS%') THEN
    RAISE EXCEPTION 'Dangerous SQL operations not allowed';
  END IF;

  -- Additional safety: only allow specific CREATE operations
  IF sql_text ILIKE '%CREATE %' AND
     sql_text NOT ILIKE '%CREATE TABLE IF NOT EXISTS%' AND
     sql_text NOT ILIKE '%CREATE EXTENSION IF NOT EXISTS%' AND
     sql_text NOT ILIKE '%CREATE INDEX IF NOT EXISTS%' AND
     sql_text NOT ILIKE '%CREATE POLICY IF NOT EXISTS%' THEN
    RAISE EXCEPTION 'Only conditional CREATE operations are allowed';
  END IF;

  -- Execute the SQL and return as JSON
  BEGIN
    EXECUTE sql_text;
    result := json_build_object('success', true, 'message', 'SQL executed successfully');
  EXCEPTION WHEN others THEN
    result := json_build_object(
      'success', false,
      'error', SQLERRM,
      'code', SQLSTATE
    );
  END;

  RETURN result;
END;
$$;

-- Grant execution to authenticated users only
REVOKE ALL ON FUNCTION public.exec_sql(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.exec_sql(TEXT) TO authenticated, service_role;

-- Add helpful comment
COMMENT ON FUNCTION public.exec_sql(TEXT)
IS 'Executes dynamic SQL safely for Edge Functions. Restricted to prevent dangerous operations.';