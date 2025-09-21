Scripts overview
================

Official operational scripts you can use:

- Deploy an Edge Function (transfer-activity)
  - `node scripts/deploy-transfer-activity.js`

- Apply a SQL migration file immediately (via Supabase Management API)
  - `node scripts/apply-migration-now.js <path-to-sql>`
  - Example:
    - `node scripts/apply-migration-now.js supabase/migrations/20250921213000_insert_user_activity_with_route.sql`

Notes
-----
- These scripts expect a Supabase Management API token in `SUPABASE_ACCESS_TOKEN` env var. When missing, a default from your local setup is used.
- Prefer migrations for schema changes; avoid runtime DDL in Edge Functions.

