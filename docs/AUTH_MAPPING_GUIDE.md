# Auth Mapping Guide: auth.uid() → profiles.id

## The Canonical Rule

**ALWAYS map `auth.uid()` to `profiles.id` before checking league membership.**

```sql
-- BROKEN ❌
WHERE lm.user_id = auth.uid()

-- BROKEN ❌
WHERE lm.user_id = v_uid

-- CORRECT ✅
DECLARE v_profile_id uuid;
SELECT id INTO v_profile_id FROM public.profiles WHERE user_id = auth.uid();
WHERE lm.user_id = v_profile_id
```

## Why This Matters

- **`profiles.user_id`** stores the Supabase auth UUID (`auth.uid()`)
- **`profiles.id`** is the internal profile primary key
- **`league_members.user_id`** stores `profiles.id` (NOT `auth.uid()`)
- **All foreign keys** in the system use `profiles.id`

**If you compare `league_members.user_id` with `auth.uid()`, it will NEVER match.**

## Canonical Function Signatures

### 1. get_active_game_for_league(p_league_id uuid)

**Purpose:** Get active or setup game for a league
**Returns:** `jsonb` with game info or error
**Auth Check:** Maps `auth.uid()` → `profiles.id`, checks `league_members.user_id = v_profile_id`

**Reference Implementation:**
`supabase/migrations/20260101000006_post_v2_rollup_auth_mapping.sql:17-81`

**Key Pattern:**
```sql
v_uid := auth.uid();
SELECT id INTO v_profile_id FROM public.profiles WHERE user_id = v_uid;
...
WHERE lm.user_id = v_profile_id AND lm.status = 'approved'
```

### 2. set_player_base(p_game_id uuid, p_activity_id uuid)

**Purpose:** Set player starting position/base for a game
**Returns:** `json` with success status and activation info
**Auth Check:** Maps `auth.uid()` → `profiles.id` for:
- Activity ownership (`user_activities.user_id = v_profile_id`)
- League membership (`league_members.user_id = v_profile_id`)

**Reference Implementation:**
`supabase/migrations/20260101000006_post_v2_rollup_auth_mapping.sql:87-191`

**Key Pattern:**
```sql
v_uid := auth.uid();
SELECT id INTO v_profile_id FROM public.profiles WHERE user_id = v_uid;
...
WHERE ua.id = p_activity_id AND ua.user_id = v_profile_id;
...
WHERE lm.user_id = v_profile_id AND lm.status = 'approved'
```

### 3. get_game_overview(p_game_id uuid)

**Purpose:** Get game metadata, leaderboard, and member counts
**Returns:** `jsonb` with game meta and leaderboard array
**Auth Check:** Maps `auth.uid()` → `profiles.id`, checks membership
**CRITICAL:** Leaderboard join uses `pb.user_id = p.id` (NOT `p.user_id`)

**Reference Implementation:**
`supabase/migrations/20260101000006_post_v2_rollup_auth_mapping.sql:197-296`

**Key Patterns:**
```sql
-- Auth mapping
v_uid := auth.uid();
IF v_uid IS NOT NULL THEN
  SELECT id INTO v_profile_id FROM public.profiles WHERE user_id = v_uid;
END IF;
...
WHERE lm.user_id = v_profile_id AND lm.status = 'approved'

-- Leaderboard join (CRITICAL!)
LEFT JOIN public.profiles p ON pb.user_id = p.id  -- NOT p.user_id!
```

## RLS Policy Pattern

For Row Level Security policies on tables like `games`:

```sql
CREATE POLICY "league_members_can_view_games"
ON public.games FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.league_members lm
    JOIN public.profiles p ON lm.user_id = p.id
    WHERE lm.league_id = games.league_id
      AND p.user_id = auth.uid()
      AND lm.status = 'approved'
  )
);
```

**Reference Implementation:**
`supabase/migrations/20260101000007_fix_games_rls_policies.sql`

## Regression Guardrails

### Automated Verification

Run the schema assertions script to verify no broken patterns exist:

```bash
node scripts/schema-assertions/verify_functions.cjs
```

**This script checks:**
- ❌ No `lm.user_id = v_uid` patterns
- ❌ No `lm.user_id = auth.uid()` patterns
- ✅ All functions have `v_profile_id uuid` variable
- ✅ All functions map `auth.uid()` → `profiles.id`
- ✅ All functions check `lm.user_id = v_profile_id`

**Exit codes:**
- `0` - All assertions passed
- `1` - Broken patterns detected
- `2` - Connection or query error

### CI Integration

Add to your CI pipeline:

```yaml
# .github/workflows/db-verify.yml
- name: Verify Database Functions
  run: node scripts/schema-assertions/verify_functions.cjs
```

## Common Mistakes

### ❌ Mistake 1: Direct auth.uid() comparison
```sql
WHERE lm.user_id = auth.uid()  -- NEVER matches!
```

### ❌ Mistake 2: Wrong leaderboard join
```sql
LEFT JOIN profiles p ON pb.user_id = p.user_id  -- WRONG!
```

### ❌ Mistake 3: Missing profile mapping
```sql
v_uid := auth.uid();
WHERE lm.user_id = v_uid  -- BROKEN!
```

### ✅ Correct Pattern
```sql
v_uid := auth.uid();
SELECT id INTO v_profile_id FROM profiles WHERE user_id = v_uid;
WHERE lm.user_id = v_profile_id  -- CORRECT!
```

## Migration Best Practices

1. **Always use timestamps AFTER v2 migrations**
   V2 migrations have timestamps `20260101000001+`, so use `20260101000006+`

2. **Drop and recreate functions**
   Use `DROP FUNCTION IF EXISTS` before `CREATE FUNCTION` to avoid conflicts

3. **Test with the assertion script**
   Run `node scripts/schema-assertions/verify_functions.cjs` after deployment

4. **Document the fix**
   Add comments explaining the auth mapping in your migration

## Troubleshooting

### "Access denied" errors for approved members

**Symptom:** User is approved league member but gets "Access denied"

**Cause:** Function compares `league_members.user_id` with `auth.uid()` instead of mapping through profiles

**Solution:** Apply migration `20260101000006` or later

### "Activity not found" errors

**Symptom:** User's activity exists but function returns "not found"

**Cause:** Function checks `user_activities.user_id = auth.uid()` instead of `profiles.id`

**Solution:** Map `auth.uid()` → `profiles.id` before activity lookup

### Empty leaderboard

**Symptom:** Leaderboard shows no players even though bases are set

**Cause:** Leaderboard join uses `pb.user_id = p.user_id` instead of `pb.user_id = p.id`

**Solution:** Fix join to `LEFT JOIN profiles p ON pb.user_id = p.id`

## Further Reading

- **Database Schema:** `src/integrations/supabase/types.ts`
- **Post-V2 Rollup Migration:** `supabase/migrations/20260101000006_post_v2_rollup_auth_mapping.sql`
- **RLS Fixes:** `supabase/migrations/20260101000007_fix_games_rls_policies.sql`
- **Assertion Script:** `scripts/schema-assertions/verify_functions.cjs`
