# Claude Code - Complete Supabase Access Guide

This document provides Claude Code with comprehensive access to analyze, debug, and improve the Runaro Supabase database.

## Quick Start

For immediate database analysis:
```bash
node scripts/claude-supabase-toolkit.js analyze
```

## Full Credentials & Access

### Database Configuration
- **Project**: Runaro Territory Game
- **URL**: https://ojjpslrhyutizwpvvngu.supabase.co
- **Project Reference**: ojjpslrhyutizwpvvngu
- **Database**: PostgreSQL with PostGIS extensions

### Authentication Keys
All keys are stored in `.env.production` file:

- **Anon Key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9qanBzbHJoeXV0aXp3cHZ2bmd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYyMzAyNDUsImV4cCI6MjA3MTgwNjI0NX0.qsKY1YPBaphie0BwV71-kHcg73ZfKNuBUHR9yHO78zA`
- **Service Role Key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9qanBzbHJoeXV0aXp3cHZ2bmd1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjIzMDI0NSwiZXhwIjoyMDcxODA2MjQ1fQ.Wm6AbiLNjIVM-T4a7TUhBMphb5EW9fMMLJC9-wSJNS4`
- **CLI Access Token**: `sbp_4d1e6b1e1b73bdf1b092c04bfa1336a005576207`
- **Database Password**: `Jzu37nnq!123456`

## Available Tools

### 1. Primary Toolkit
```bash
# Comprehensive analysis
node scripts/claude-supabase-toolkit.js analyze

# Function testing
node scripts/claude-supabase-toolkit.js test

# Performance optimization
node scripts/claude-supabase-toolkit.js optimize

# Security audit
node scripts/claude-supabase-toolkit.js security

# Migration management
node scripts/claude-supabase-toolkit.js migrate
```

### 2. Direct Database Access Script
```bash
node scripts/supabase-direct-access.js
```

### 3. CLI Setup
```bash
# Run setup script
scripts/setup-full-access.bat

# Or manual setup
npx supabase login --token sbp_4d1e6b1e1b73bdf1b092c04bfa1336a005576207
npx supabase link --project-ref ojjpslrhyutizwpvvngu -p Jzu37nnq!123456
```

## Database Schema Overview

### Core Tables
- **profiles** (7 rows) - User profiles with username, display_name, age (age secured)
- **activities** (0 rows) - Running activities with GPX data
- **leagues** (17 rows) - Multiplayer league system
- **league_memberships** (6 rows) - User-league relationships
- **league_join_requests** (7 rows) - Pending membership approvals
- **games** (41 rows) - Game instances and territory tracking
- **player_bases** (0 rows) - Player starting positions
- **territory_ownership** (0 rows) - Territory capture records
- **subscriptions** (0 rows) - User subscription management
- **error_reports** (12 rows) - System error logging

### Key Database Functions
- `get_user_leagues()` - Retrieve user's league memberships
- `create_league_with_owner()` - Create new league with admin
- `join_league()` - Join league with invite code
- `manage_league_membership()` - Approve/reject membership requests
- `create_game()` - Initialize new territory game
- `get_active_game_for_league()` - Get current league game
- `set_player_base()` - Set player starting position
- `finish_due_games()` - Complete expired games

## Claude's Capabilities

### ✅ Full Access Abilities
1. **Database Analysis**: Complete table structure, relationships, and data analysis
2. **Function Testing**: Test and debug all database functions and stored procedures
3. **Performance Monitoring**: Query performance analysis and optimization recommendations
4. **Security Auditing**: RLS policy verification and security vulnerability assessment
5. **Data Integrity**: Check for orphaned records, missing relationships, and data consistency
6. **Migration Management**: View, create, and manage database schema changes
7. **Real-time Debugging**: Live query testing and error diagnosis
8. **Report Generation**: Comprehensive analysis reports with actionable recommendations

### 🔍 Analysis Examples
- Identify slow queries and missing indexes
- Verify RLS policies are properly protecting sensitive data
- Check for data integrity issues (orphaned records, etc.)
- Analyze function performance and security
- Monitor table growth and usage patterns
- Validate business logic implementation

## Security Considerations

### 🛡️ Security Features
- **RLS Policies**: Active on all sensitive tables
- **Age Field Protection**: User age is stored but never exposed to UI
- **Function Security**: All functions use SECURITY DEFINER with locked search_path
- **Access Controls**: Service role limited to development and debugging

### 🚨 Important Notes
- Service role access is for development/debugging only
- Never expose service role key in client-side code
- All credentials are stored in secure environment files
- Production access is logged and monitored

## Quick Reference Commands

```bash
# Database status
npx supabase status

# Run migrations
npx supabase db push

# View migrations
npx supabase migration list

# Create new migration
npx supabase migration new "description"

# Reset database (LOCAL ONLY)
npx supabase db reset
```

## Troubleshooting

### Common Issues
1. **"Unauthorized" errors**: Check CLI login status
2. **"Permission denied"**: Verify service role key is correct
3. **Connection timeouts**: Check network and database status
4. **RLS policy failures**: Review policy definitions and user context

### Debug Commands
```bash
# Test connection
node -e "const { createClient } = require('@supabase/supabase-js'); const client = createClient('https://ojjpslrhyutizwpvvngu.supabase.co', 'SERVICE_KEY'); client.from('profiles').select('id').limit(1).then(console.log);"

# Check CLI auth
npx supabase projects list
```

---

**Last Updated**: 2025-09-16
**Claude Access Level**: FULL (Service Role + CLI + Database Admin)
**Status**: ✅ Active and Ready