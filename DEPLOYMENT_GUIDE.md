# 🚀 Supabase Deployment Guide

## ⚠️ CRITICAL FIRST STEP: Cloudflare _redirects

**MUST DO FIRST:** Create `_redirects` file in project root:
```
/auth/strava/callback  https://ojjpslrhyutizwpvvngu.supabase.co/functions/v1/strava-auth  302
/*                     /index.html  200
```

Then redeploy your Cloudflare Pages site. This ensures Strava callbacks hit edge function directly instead of React router.

## Prerequisites
- Supabase CLI installed: `npm install -g @supabase/supabase-js`
- Access to Supabase dashboard: https://supabase.com/dashboard
- Project ID: `ojjpslrhyutizwpvvngu`

## 1. Link Project to Supabase
```bash
# Link your local project to the remote Supabase project
npx supabase link --project-ref ojjpslrhyutizwpvvngu

# You'll be prompted for your Supabase access token
# Get it from: https://supabase.com/dashboard/account/tokens
```

## 2. Deploy Database Migrations
```bash
# Deploy all pending migrations to production
npx supabase db push

# Alternative: Deploy specific migration
npx supabase db push --include-schemas public
```

## 3. Deploy Edge Functions
```bash
# Deploy all functions at once
npx supabase functions deploy

# Or deploy individual functions:
npx supabase functions deploy strava-auth
npx supabase functions deploy strava-activities  
npx supabase functions deploy transfer-activity
```

## 4. Set Environment Variables
In Supabase Dashboard → Project Settings → Edge Functions:

```
STRAVA_CLIENT_ID=174654
STRAVA_CLIENT_SECRET=1b87ab9bfbda09608bda2bdc9e5d2036f0ddfd6
SUPABASE_URL=https://ojjpslrhyutizwpvvngu.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9qanBzbHJoeXV0aXp3cHZ2bmd1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjIzMDI0NSwiZXhwIjoyMDcxODA2MjQ1fQ.Wm6AbiLNjIVM-T4a7TUhBMphb5EW9fMMLJC9-wSJNS4
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9qanBzbHJoeXV0aXp3cHZ2bmd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYyMzAyNDUsImV4cCI6MjA3MTgwNjI0NX0.qsKY1YPBaphie0BwV71-kHcg73ZfKNuBUHR9yHO78zA
```

## 5. Verify Deployment
```bash
# Check function status
npx supabase functions list

# Test functions via curl
curl -X POST https://ojjpslrhyutizwpvvngu.supabase.co/functions/v1/strava-auth \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{"test": true}'
```

## 6. Test OAuth Flow

### Step 1: Generate Test OAuth URL
```
https://www.strava.com/oauth/authorize?
  client_id=174654&
  redirect_uri=https://runaro.dk/auth/strava/callback&
  response_type=code&
  scope=read,activity:read_all&
  state=YOUR_BASE64_STATE&
  approval_prompt=force
```

### Step 2: Complete Flow
1. Visit OAuth URL in browser
2. Authorize with Strava
3. Check redirect to runaro.dk/auth/strava/callback
4. Verify automatic redirect to edge function
5. Confirm final redirect to success page

## 7. Debug Commands
```bash
# View function logs
npx supabase functions logs strava-auth --level=debug

# Reset database (CAUTION!)
npx supabase db reset

# Generate new migration
npx supabase db diff --file new_migration

# Pull remote schema
npx supabase db pull
```

## 8. Production URLs
- **Strava OAuth Callback**: `https://runaro.dk/auth/strava/callback`
- **Success Page**: `https://runaro.dk/strava/success`
- **Debug Page**: `https://runaro.dk/debug/strava`
- **Edge Functions**: `https://ojjpslrhyutizwpvvngu.supabase.co/functions/v1/`

## 9. Quick Deploy Script
Save as `deploy.sh`:
```bash
#!/bin/bash
echo "🚀 Deploying Runaro Strava Integration..."

# Deploy migrations
echo "📊 Deploying database migrations..."
npx supabase db push

# Deploy functions
echo "⚡ Deploying edge functions..."
npx supabase functions deploy strava-auth
npx supabase functions deploy strava-activities
npx supabase functions deploy transfer-activity

echo "✅ Deployment complete!"
echo "🔗 Test at: https://runaro.dk/debug/strava"
```

## 10. Troubleshooting
- **401 Unauthorized**: Check JWT token in Authorization header
- **502 Bad Gateway**: Edge function deployment or environment variables
- **CORS errors**: Verify Origin headers in edge function CORS setup
- **Database errors**: Check RLS policies and user permissions

---
**Ready for production! 🎯**