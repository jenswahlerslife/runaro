-- DDL Executor Function for Claude Code
-- Run this ONCE in Supabase SQL Editor to enable automatic DDL execution

CREATE OR REPLACE FUNCTION public.claude_execute_ddl(sql_text text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  EXECUTE sql_text;
  RETURN 'SUCCESS';
EXCEPTION
  WHEN OTHERS THEN
    RETURN 'ERROR: ' || SQLERRM;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.claude_execute_ddl(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.claude_execute_ddl(text) TO authenticated;
