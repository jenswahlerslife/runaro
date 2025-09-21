Datamodel Decision (2025-09-21)
================================

Decision: Proceed with the current "legacy" model for production stability
----------------------------------------------------------------------------

Context
-------
- The codebase uses a practical `user_activities` table that carries Strava fields.
- The V2 schema (in `supabase/migrations/v2`) proposes `activities` + junction `user_activities` and broader normalization.

Rationale
---------
- Time-to-value: The production flow was stabilized quickly without introducing a breaking data model change.
- Operational simplicity: Less moving parts in Edge Functions and UI while we verify end-user flows.
- Future flexibility: V2 remains available and can be migrated to after production confidence improves.

Implementation Notes (done in this pass)
----------------------------------------
- Removed runtime DDL in Edge Functions.
- Added a small RPC `insert_user_activity_with_route` for PostGIS insert, keeping runtime "pure".
- Ensured defaults/flags (`included_in_game=false`) are consistent with migrations and inserts.

Next Steps (when revisiting V2)
-------------------------------
1) Author a migration to populate `activities` from existing `user_activities` and create junction rows.
2) Update Edge Functions to insert first into `activities` and then `user_activities`.
3) Update UI reads to target V2 views/RPCs.

