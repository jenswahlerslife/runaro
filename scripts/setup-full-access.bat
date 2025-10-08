@echo off
echo 🔧 Setting up full Supabase access for Claude Code...
echo.

REM Set environment variables for this session
set SUPABASE_ACCESS_TOKEN=sbp_4d1e6b1e1b73bdf1b092c04bfa1336a005576207
set SUPABASE_PROJECT_REF=ojjpslrhyutizwpvvngu
set SUPABASE_DB_PASSWORD=Jzu37nnq!123456

echo ✅ Environment variables set
echo 📡 Project: %SUPABASE_PROJECT_REF%
echo.

echo 🔐 Logging in to Supabase CLI...
npx supabase --config infra/supabase/config.toml login --token %SUPABASE_ACCESS_TOKEN%

echo.
echo 🔗 Linking to project...
npx supabase --config infra/supabase/config.toml link --project-ref %SUPABASE_PROJECT_REF% -p %SUPABASE_DB_PASSWORD%

echo.
echo 📊 Getting project status...
npx supabase --config infra/supabase/config.toml status

echo.
echo 📋 Listing migrations...
npx supabase --config infra/supabase/config.toml migration list

echo.
echo ✅ Full access setup complete!
echo 🚀 Claude now has comprehensive access to analyze and improve your Supabase setup
pause
