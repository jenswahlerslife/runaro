# V2.0 Migration Strategy
**Phase 3: Full Consolidation Implementation**

## 🎯 Objective
Create a clean V2.0 migration base that consolidates 95+ migrations into a comprehensive, maintainable schema foundation.

## 📊 Current State Analysis
- **Current Migrations**: 95+ individual migration files
- **Database Health**: EXCELLENT (100% function tests passing)
- **Performance**: GOOD (59ms average query time)
- **Function Status**: All consolidated and working correctly
- **Ready for Consolidation**: ✅ Yes

## 🛠️ V2.0 Strategy Overview

### Approach: Progressive Migration Consolidation
Instead of a disruptive full rebuild, we'll create a V2.0 migration path that:
1. **Preserves all existing data**
2. **Maintains backward compatibility during transition**
3. **Provides rollback capability**
4. **Enables staged deployment**

### V2.0 Migration Structure
```
supabase/migrations/v2/
├── 20260101000000_v2_base_schema.sql        # Complete table definitions
├── 20260101000001_v2_essential_functions.sql  # All working functions
├── 20260101000002_v2_performance_indexes.sql  # All performance optimizations
├── 20260101000003_v2_security_policies.sql    # Consolidated RLS policies
├── 20260101000004_v2_data_migration.sql       # Data preservation/cleanup
└── 20260101000005_v2_cleanup_legacy.sql       # Remove deprecated elements
```

## 🔄 Migration Phases

### Phase 3a: Schema Analysis & Export (Week 1)
**Goal**: Generate clean schema foundation
**Tasks**:
- Export current working schema without migration history
- Analyze table dependencies and relationships
- Identify deprecated/unused elements for cleanup
- Create schema comparison tools

### Phase 3b: V2.0 Base Creation (Week 2)
**Goal**: Create consolidated migration files
**Tasks**:
- Generate `v2_base_schema.sql` with all current tables
- Consolidate all working functions into `v2_essential_functions.sql`
- Merge performance indexes into `v2_performance_indexes.sql`
- Unify RLS policies in `v2_security_policies.sql`

### Phase 3c: Migration Testing (Week 3)
**Goal**: Validate V2.0 migrations work correctly
**Tasks**:
- Test V2.0 migrations on fresh database
- Validate data migration procedures
- Test rollback scenarios
- Performance benchmark comparison

### Phase 3d: Deployment Strategy (Week 4)
**Goal**: Plan production deployment approach
**Tasks**:
- Create staging deployment procedures
- Develop rollback procedures
- Plan maintenance window requirements
- Document deployment checklist

## 📋 Detailed Implementation Plan

### 1. Schema Export & Analysis

#### Current Schema Export
```bash
# Export complete schema (structure only)
pg_dump --schema-only --no-owner --no-privileges \
  --exclude-schema=extensions \
  --exclude-schema=auth \
  --exclude-schema=storage \
  $DATABASE_URL > v2_base_schema_raw.sql

# Export with data for critical reference tables
pg_dump --data-only --table=public.* \
  --exclude-table-data=activities \
  --exclude-table-data=error_reports \
  --exclude-table-data=territory_ownership \
  $DATABASE_URL > v2_reference_data.sql
```

#### Schema Analysis Tools
Create automated tools to:
- Compare current schema with V1 migrations
- Identify unused columns/tables
- Validate referential integrity
- Check for performance optimization opportunities

### 2. V2.0 Migration File Generation

#### Base Schema Migration
```sql
-- 20260101000000_v2_base_schema.sql
-- V2.0 Base Schema - Consolidated from 95+ migrations
-- Contains: All tables, constraints, indexes, types

BEGIN;

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- Core tables in dependency order
-- 1. profiles (foundation)
-- 2. leagues (core business logic)
-- 3. league_members (authorization)
-- 4. games (game instances)
-- 5. activities (Strava integration)
-- 6. player_bases, territory_ownership (gameplay)
-- 7. error_reports, subscriptions (operations)

COMMIT;
```

#### Essential Functions Migration
```sql
-- 20260101000001_v2_essential_functions.sql
-- V2.0 Essential Functions - All working functions consolidated

-- Security-first function definitions with:
-- - SECURITY DEFINER with locked search_path
-- - Proper privilege grants
-- - Comprehensive error handling
-- - Performance optimizations
```

### 3. Data Migration Strategy

#### Preservation Approach
- **Zero Data Loss**: All existing data preserved
- **Incremental Migration**: Move data in stages to minimize downtime
- **Validation Checks**: Verify data integrity after each stage

#### Migration Validation
```sql
-- Data integrity validation queries
SELECT
  'profiles' as table_name,
  COUNT(*) as record_count,
  COUNT(DISTINCT user_id) as unique_users
FROM profiles
UNION ALL
SELECT
  'leagues',
  COUNT(*),
  COUNT(DISTINCT admin_user_id)
FROM leagues;
```

### 4. Rollback Procedures

#### Automated Rollback Strategy
- **Schema Snapshots**: Before V2.0 deployment
- **Data Backups**: Point-in-time recovery capability
- **Function Rollback**: Restore previous function versions
- **Index Rollback**: Remove V2.0 indexes if needed

#### Rollback Testing
- Test rollback procedures on staging
- Validate data integrity after rollback
- Measure rollback time requirements
- Document rollback decision criteria

## 🎯 Success Metrics

### Technical Metrics
- **Migration Count**: Target <10 V2.0 migrations (vs 95+ current)
- **Deployment Time**: <15 minutes for complete V2.0 apply
- **Performance**: Maintain or improve current 59ms average
- **Function Coverage**: 100% of critical functions working
- **Data Integrity**: 0% data loss during migration

### Process Metrics
- **Test Coverage**: 100% of V2.0 migrations tested
- **Rollback Capability**: <30 minutes to rollback if needed
- **Documentation**: Complete V2.0 deployment guide
- **Staging Validation**: All tests pass on staging before production

## 🛡️ Risk Management

### High Risk Areas
1. **Data Migration Complexity**: Large dataset migration
2. **Function Dependencies**: Ensuring all function calls work
3. **Performance Impact**: Temporary performance degradation
4. **Rollback Complexity**: Complexity of undoing V2.0 changes

### Risk Mitigation
1. **Staged Deployment**: Deploy V2.0 in phases
2. **Comprehensive Testing**: Test all scenarios on staging
3. **Performance Monitoring**: Real-time performance tracking
4. **Automated Rollback**: One-command rollback capability

## 📅 Timeline

### Week 1: Analysis & Planning
- Day 1-2: Schema export and analysis
- Day 3-4: V2.0 structure design
- Day 5-7: Migration file generation

### Week 2: Implementation
- Day 1-3: Create V2.0 base migrations
- Day 4-5: Function consolidation
- Day 6-7: Performance and security migrations

### Week 3: Testing & Validation
- Day 1-3: Staging environment testing
- Day 4-5: Performance validation
- Day 6-7: Rollback procedure testing

### Week 4: Deployment Preparation
- Day 1-3: Production deployment planning
- Day 4-5: Final validation and approval
- Day 6-7: Documentation and training

## 🚀 Deployment Strategy

### Production Deployment Approach
1. **Maintenance Window**: Planned 2-hour window
2. **Blue/Green Deployment**: Maintain service availability
3. **Incremental Rollout**: Apply migrations in stages
4. **Real-time Monitoring**: Performance and error tracking
5. **Immediate Rollback**: If any critical issues detected

### Post-Deployment Validation
- Run complete migration test suite
- Validate all critical user flows
- Monitor performance for 24 hours
- Document lessons learned

---

**Document Version**: 1.0
**Created**: 2025-09-17
**Phase**: 3 - Full Consolidation (V2.0)
**Status**: Implementation Started
**Next Review**: 2025-09-24