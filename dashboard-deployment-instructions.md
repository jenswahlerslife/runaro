# Manual Dashboard SQL Editor Deployment Instructions

## Step-by-Step Guide

### 1. Access Supabase Dashboard
1. Go to https://supabase.com/dashboard/project/ojjpslrhyutizwpvvngu
2. Sign in to your account
3. Select your project (ojjpslrhyutizwpvvngu)

### 2. Open SQL Editor
1. In the left sidebar, click on "SQL Editor"
2. Click "New query" to create a new SQL query tab

### 3. Copy and Execute Migration
1. Open the file `deploy-create-game-migration.sql` in a text editor
2. Copy the entire contents of the file
3. Paste it into the SQL Editor in the dashboard
4. Click "Run" button (or press Ctrl+Enter) to execute

### 4. Verify Deployment
After execution, you should see:
- Success message indicating the SQL ran without errors
- The final SELECT statement should return: "Enhanced create_game function deployed successfully"

### 5. Test the Function (Optional)
To verify the function works, you can run this test query:

```sql
SELECT
  routine_name,
  specific_name,
  routine_type,
  data_type
FROM information_schema.routines
WHERE routine_name = 'create_game'
AND routine_schema = 'public'
ORDER BY specific_name;
```

This should return 2 rows showing both function overloads:
1. `create_game(uuid, text)` - backward compatibility version
2. `create_game(uuid, text, integer)` - enhanced version with duration_days

## Advantages of Dashboard Method
- ✅ No local software installation required
- ✅ Direct access to your production database
- ✅ Built-in syntax highlighting and error reporting
- ✅ Immediate feedback on query execution
- ✅ No need for database credentials or connection strings

## Important Notes
- The dashboard SQL Editor runs with administrative privileges
- Changes are immediately applied to your production database
- Make sure to backup your database before running migrations
- Test in a development environment first if possible