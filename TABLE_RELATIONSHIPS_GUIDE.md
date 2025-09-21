# Database Table Relationships Guide

**Generated**: 2025-09-16
**Purpose**: Clarify table relationships and resolve naming confusion

## 📊 Core Table Structure

### League System Tables

#### 1. `leagues` (Main League Definition)
- **Purpose**: Core league information
- **Key Columns**: `id`, `name`, `admin_user_id`, `created_at`
- **Relationships**:
  - Has many `league_members`
  - Has many `league_memberships`
  - Has many `games`

#### 2. `league_members` ⭐ (WITH STATUS COLUMN)
- **Purpose**: League membership with approval workflow
- **Key Columns**: `id`, `league_id`, `user_id`, `status`, `role`, `joined_at`, `approved_at`, `approved_by`
- **Status Values**: `pending`, `approved`, `rejected`
- **Role Values**: `member`, `admin`, `owner`
- **Critical Note**: This table has the `status` column for approval workflow

#### 3. `league_memberships` (WITHOUT STATUS COLUMN)
- **Purpose**: Simple league membership tracking
- **Key Columns**: `league_id`, `user_id`, `role`, `joined_at`
- **Usage**: Basic membership without approval workflow
- **Critical Note**: This table does NOT have a `status` column

### ⚠️ **IMPORTANT: Which Table to Use When**

| Use Case | Correct Table | Reason |
|----------|---------------|---------|
| **Game creation authorization** | `league_members` | Needs `status='approved'` check |
| **User league access control** | `league_members` | Needs `status='approved'` check |
| **Admin permission checks** | `league_members` | Needs `role` and `status` checks |
| **Simple membership listing** | `league_memberships` | No status required |
| **User profile relationships** | Either | Depends on if approval status matters |

### Game System Tables

#### 4. `games`
- **Purpose**: Individual game instances
- **Key Columns**: `id`, `league_id`, `name`, `status`, `start_date`, `duration_days`, `created_by`
- **Status Values**: `setup`, `active`, `finished`, `cancelled`
- **Relationships**:
  - Belongs to `leagues`
  - Has many `player_bases`
  - Has many `territory_ownership` records

#### 5. `player_bases`
- **Purpose**: Player starting positions in games
- **Key Columns**: `id`, `game_id`, `user_id`, `activity_id`, `base_territory`, `base_point`
- **Relationships**:
  - Belongs to `games`
  - Belongs to `profiles` (via `user_id`)
  - References `user_activities` (via `activity_id`)

### Activity System Tables

#### 6. `activities`
- **Purpose**: GPS/route activities (from Strava)
- **Key Columns**: `id`, `user_id`, `name`, `territory_geom`, `start_point`, `created_at`
- **Relationships**:
  - Belongs to `profiles` (via `user_id`)
  - Has many `user_activities` (junction table)

#### 7. `user_activities`
- **Purpose**: Junction table linking users to activities
- **Key Columns**: `id`, `user_id`, `activity_id`, `strava_activity_id`
- **Relationships**:
  - Belongs to `profiles` (via `user_id`)
  - Belongs to `activities` (via `activity_id`)

### User System Tables

#### 8. `profiles`
- **Purpose**: User profile information
- **Key Columns**: `id`, `user_id`, `username`, `display_name`, `strava_access_token`, `strava_refresh_token`, `strava_expires_at`
- **Security Note**: `age` column exists but is never exposed to UI
- **Relationships**:
  - Has many `league_members`
  - Has many `league_memberships`
  - Has many `activities`
  - Has many `player_bases`

## 🔧 Function Usage Patterns

### ✅ Correct Function Implementations

```sql
-- ✅ CORRECT: Use league_members for authorization
CREATE FUNCTION create_game(...) AS $$
BEGIN
  -- Check authorization with status
  IF EXISTS (
    SELECT 1 FROM league_members
    WHERE league_id = p_league_id
    AND user_id = current_user_id
    AND status = 'approved'
  ) THEN ...
```

```sql
-- ✅ CORRECT: Use league_members for access control
CREATE FUNCTION get_active_game_for_league(...) AS $$
BEGIN
  -- Verify membership with status
  IF NOT EXISTS (
    SELECT 1 FROM league_members
    WHERE league_id = p_league_id
    AND user_id = current_user_id
    AND status = 'approved'
  ) THEN ...
```

### ❌ Common Mistakes

```sql
-- ❌ WRONG: Using league_memberships for authorization
SELECT COUNT(*) FROM league_memberships
WHERE league_id = p_league_id AND status = 'approved';
-- ERROR: column "status" does not exist
```

```sql
-- ❌ WRONG: Using league_members without status check
SELECT * FROM league_members
WHERE league_id = p_league_id AND user_id = current_user;
-- ISSUE: Includes pending/rejected members
```

## 📈 Performance Optimization

### Indexes by Use Case

```sql
-- For authorization queries (league_members)
CREATE INDEX idx_league_members_user_status
ON league_members (user_id, status)
WHERE status = 'approved';

-- For league admin queries
CREATE INDEX idx_league_members_league_role
ON league_members (league_id, role, status)
WHERE status = 'approved';

-- For game queries
CREATE INDEX idx_games_league_status
ON games (league_id, status)
WHERE status IN ('active', 'setup');
```

### Query Patterns

```sql
-- ✅ OPTIMIZED: Get user's approved leagues
SELECT l.* FROM leagues l
JOIN league_members lm ON l.id = lm.league_id
WHERE lm.user_id = $1 AND lm.status = 'approved';

-- ✅ OPTIMIZED: Check game access
SELECT 1 FROM games g
JOIN league_members lm ON g.league_id = lm.league_id
WHERE g.id = $1 AND lm.user_id = $2 AND lm.status = 'approved';
```

## 🛡️ Security Considerations

### RLS Policy Patterns

```sql
-- ✅ SECURE: Games table RLS
CREATE POLICY "Users can view games in their approved leagues" ON games
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM league_members lm
    WHERE lm.league_id = games.league_id
    AND lm.user_id = auth.uid()
    AND lm.status = 'approved'
  )
);
```

### Data Privacy

1. **Never expose `age` column** in UI queries
2. **Always check `status = 'approved'`** for league access
3. **Use SECURITY DEFINER** with locked `search_path` for functions
4. **Validate league membership** before any game operations

## 🚀 Migration Strategy

### For New Functions
1. Always use `league_members` for membership with approval workflow
2. Always check `status = 'approved'` for access control
3. Include proper error handling for unauthorized access
4. Use performance indexes for common query patterns

### For Existing Code
1. Audit all functions using `league_memberships`
2. Replace with `league_members` where status checking is needed
3. Add missing status checks to prevent unauthorized access
4. Test authorization edge cases (pending, rejected members)

## 📋 Naming Convention Guidelines

### Table Naming
- **Plural nouns**: `games`, `activities`, `profiles`
- **Junction tables**: `user_activities`, `league_members`
- **Avoid confusion**: Clear distinction between `league_members` (with status) and `league_memberships` (without status)

### Column Naming
- **Foreign keys**: `user_id`, `league_id`, `game_id`
- **Status fields**: `status` (enum values)
- **Timestamps**: `created_at`, `updated_at`, `joined_at`, `approved_at`
- **Boolean flags**: `is_active`, `is_approved` (avoid in favor of status enums)

## 🎯 Best Practices Summary

1. **Authorization**: Always use `league_members` with `status = 'approved'`
2. **Performance**: Add indexes for common authorization queries
3. **Security**: Include membership validation in all game-related functions
4. **Consistency**: Use the same table throughout a function
5. **Testing**: Test with pending/rejected memberships to ensure proper access control

---

**Last Updated**: 2025-09-17 (Phase 2 Complete)
**Phase Status**: ✅ Phase 2 Schema Stabilization Complete
**Next Review**: 2025-10-01
**Responsible**: Database Architecture Team

## 🎉 Phase 2 Completion Status

**✅ Completed Tasks:**
1. Function consolidation migration (Phase 1) ✅
2. Migration testing framework implementation ✅
3. Performance monitoring system ✅
4. Database function validation ✅
5. Table relationship documentation ✅

**📊 Current Performance Baseline:**
- Average Query Time: ~189ms (ACCEPTABLE)
- Function Tests: 19/19 passing (100%)
- Database Health: EXCELLENT
- All core functions working correctly

**🛠️ Available Tools:**
- `npm run migration:test` - Comprehensive database testing
- `npm run performance:monitor` - Performance tracking
- `npm run migration:health` - Quick health check

**🚀 Ready for Phase 3:**
The database is now in excellent condition with consolidated functions,
comprehensive testing, and performance monitoring. Phase 3 (Full V2.0
Consolidation) can be planned for future major version.