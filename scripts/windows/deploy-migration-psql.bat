@echo off
echo Deploying SQL migration to Supabase production database...
echo.

REM Direct connection string for Supabase PostgreSQL
REM Format: postgresql://postgres:[YOUR_DB_PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres

echo You need to get your database password from Supabase Dashboard:
echo 1. Go to https://supabase.com/dashboard/project/ojjpslrhyutizwpvvngu
echo 2. Click "Connect" button at the top
echo 3. Copy the password from the Direct connection string
echo.

set /p DB_PASSWORD="Enter your database password: "

echo.
echo Executing SQL migration...
psql "postgresql://postgres:%DB_PASSWORD%@db.ojjpslrhyutizwpvvngu.supabase.co:5432/postgres" -f deploy-create-game-migration.sql

echo.
echo Migration deployment completed!
pause