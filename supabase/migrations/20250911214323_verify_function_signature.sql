-- Verify the function and its parameter names
SELECT
  n.nspname      AS schema,
  p.oid::regprocedure AS signature,  -- includes argument types
  p.proname      AS fn,
  p.proargnames  AS arg_names,       -- must match what your client sends
  p.prorettype::regtype AS returns
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE p.proname = 'create_league_with_owner';

SELECT 'Function signature verification completed' as status;