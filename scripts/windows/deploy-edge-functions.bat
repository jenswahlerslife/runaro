@echo off
# Robust Supabase Edge Function Deployment Script

set -e

# Environment variables
export SUPABASE_ACCESS_TOKEN="sbp_4d1e6b1e1b73bdf1b092c04bfa1336a005576207"
export SUPABASE_PROJECT_REF="ojjpslrhyutizwpvvngu"
export SUPABASE_DB_PASSWORD="Jzu37nnq!123456"

echo "🚀 Starting Edge Function deployment..."

# Method 1: Try Supabase CLI
echo "📝 Method 1: Supabase CLI"
npx supabase login --token $SUPABASE_ACCESS_TOKEN || echo "Login failed"
npx supabase --config infra/supabase/config.toml functions deploy transfer-activity --project-ref $SUPABASE_PROJECT_REF || echo "CLI deployment failed"

# Method 2: Try curl with different endpoints
echo "📝 Method 2: Direct API calls"
FUNCTION_CODE=$(cat infra/supabase/functions/transfer-activity/index.ts | jq -Rs .)

curl -X PATCH "https://api.supabase.com/v1/projects/$SUPABASE_PROJECT_REF/functions/transfer-activity" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"name\": \"transfer-activity\", \"source\": $FUNCTION_CODE}" || echo "PATCH failed"

curl -X POST "https://api.supabase.com/v1/projects/$SUPABASE_PROJECT_REF/functions" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"name\": \"transfer-activity\", \"slug\": \"transfer-activity\", \"source\": $FUNCTION_CODE}" || echo "POST failed"

echo "✅ Deployment script completed - check results above"
