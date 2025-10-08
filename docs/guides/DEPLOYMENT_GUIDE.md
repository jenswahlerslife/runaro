# SQL Migration Deployment Guide for Supabase Production

## Overview
This guide provides multiple methods to deploy the `deploy-create-game-migration.sql` file to your Supabase production database without using the Supabase CLI.

**Project Details:**
- Project Ref: `ojjpslrhyutizwpvvngu`
- Database URL: `https://ojjpslrhyutizwpvvngu.supabase.co`
- Migration File: `deploy-create-game-migration.sql`

## Migration Summary
The migration enhances the `create_game` function with:
- ✅ Duration days parameter support (14-30 days for Pro plans, fixed 14 days for Free plans)
- ✅ Subscription plan validation
- ✅ Backward compatibility with existing function calls
- ✅ Proper security with SECURITY DEFINER and locked search_path
- ✅ Comprehensive error handling and validation

## Deployment Methods (Ranked by Recommendation)

### 🥇 Method 1: Supabase Dashboard SQL Editor (RECOMMENDED)
**Best for: Quick deployment, no setup required**

**Advantages:**
- ✅ No local software installation needed
- ✅ Direct web-based access
- ✅ Built-in syntax highlighting
- ✅ Immediate error feedback
- ✅ Most user-friendly

**Steps:**
1. Go to https://supabase.com/dashboard/project/ojjpslrhyutizwpvvngu
2. Click "SQL Editor" in sidebar
3. Click "New query"
4. Copy contents from `deploy-create-game-migration.sql`
5. Paste and click "Run"

**Files:** See detailed instructions in `dashboard-deployment-instructions.md`

### 🥈 Method 2: psql Command Line
**Best for: Developers familiar with PostgreSQL tools**

**Prerequisites:**
- PostgreSQL client (psql) installed
- Database password from Supabase Dashboard

**Steps:**
1. Get database password from Supabase Dashboard → Connect → Direct connection
2. Run the batch file: `deploy-migration-psql.bat`
3. Enter password when prompted

**Files:**
- `deploy-migration-psql.bat` - Windows batch script
- Works on Windows, Mac, Linux with psql installed

### 🥉 Method 3: Node.js Script
**Best for: Automated deployment or integration into build processes**

**Prerequisites:**
- Node.js installed
- Install pg package: `npm install pg`
- Database password from Supabase Dashboard

**Steps:**
1. Install dependencies: `npm install pg`
2. Set DB_PASSWORD environment variable or edit script
3. Run: `node deploy-migration-node.js`

**Files:**
- `deploy-migration-node.js` - Complete Node.js deployment script
- Includes connection verification and error handling

## Getting Your Database Password

For Methods 2 & 3, you need your database password:

1. Go to https://supabase.com/dashboard/project/ojjpslrhyutizwpvvngu
2. Click "Connect" button at the top
3. Select "Direct connection" tab
4. Copy the password from the connection string:
   `postgresql://postgres:[YOUR_PASSWORD]@db.ojjpslrhyutizwpvvngu.supabase.co:5432/postgres`

## Verification Steps

After deployment, verify the migration succeeded:

### 1. Check Function Exists
```sql
SELECT
  routine_name,
  specific_name,
  routine_type
FROM information_schema.routines
WHERE routine_name = 'create_game'
AND routine_schema = 'public'
ORDER BY specific_name;
```

Expected result: 2 functions
- `create_game(uuid, text)` - backward compatibility
- `create_game(uuid, text, integer)` - enhanced with duration_days

### 2. Test Function Call (Optional)
```sql
-- This should return an error about league not found (expected)
SELECT public.create_game(
  '00000000-0000-0000-0000-000000000000'::uuid,
  'Test Game',
  21
);
```

## Security Notes

- ⚠️ **Service Role Key**: The provided JWT has admin privileges. Keep it secure.
- ⚠️ **Database Password**: Never commit database passwords to version control.
- ✅ **Migration Safety**: The SQL uses proper security practices with SECURITY DEFINER.

## Troubleshooting

### Common Issues:

**"Function already exists" error:**
- ✅ Normal - the migration drops existing functions first

**"Permission denied" error:**
- ❌ Check your database password is correct
- ❌ Verify you're using the correct project reference

**"Connection timeout" error:**
- ❌ Check your internet connection
- ❌ Try using session pooler connection string instead

**"SQL syntax error":**
- ❌ Ensure you copied the entire SQL file contents
- ❌ Check for any clipboard encoding issues

### Support

If you encounter issues:
1. Check the Supabase Dashboard logs
2. Verify your project is active and not paused
3. Ensure your plan supports the required database operations

## Cleanup

After successful deployment, you can safely delete these deployment files:
- `deploy-migration-psql.bat`
- `deploy-migration-node.js`
- `dashboard-deployment-instructions.md`
- This guide (`DEPLOYMENT_GUIDE.md`)

Keep the original migration file (`deploy-create-game-migration.sql`) for reference.