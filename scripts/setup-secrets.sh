#!/bin/bash

# RUNARO SECRETS SETUP SCRIPT
# Denne script hjælper med at sætte miljøvariabler op korrekt

set -e

echo "🔐 Runaro Secrets Setup"
echo "======================="

# Tjek om supabase CLI er installeret
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI ikke fundet. Installer med: npm i supabase -g"
    exit 1
fi

# Tjek om wrangler er installeret
if ! command -v wrangler &> /dev/null; then
    echo "❌ Wrangler CLI ikke fundet. Installer med: npm i wrangler -g"
    exit 1
fi

echo "📋 Sætter Supabase Edge Function secrets..."

# Prompt for secrets
read -p "Strava Client ID: " STRAVA_CLIENT_ID
read -s -p "Strava Client Secret: " STRAVA_CLIENT_SECRET
echo
read -s -p "Supabase Service Role Key: " SERVICE_ROLE_KEY
echo
read -s -p "Supabase Anon Key: " ANON_KEY
echo
read -p "Supabase URL: " SUPABASE_URL

# Set secrets for strava-auth function
echo "Setting secrets for strava-auth..."
echo "$STRAVA_CLIENT_ID" | supabase secrets set STRAVA_CLIENT_ID --project-ref ojjpslrhyutizwpvvngu
echo "$STRAVA_CLIENT_SECRET" | supabase secrets set STRAVA_CLIENT_SECRET --project-ref ojjpslrhyutizwpvvngu
echo "$SERVICE_ROLE_KEY" | supabase secrets set SUPABASE_SERVICE_ROLE_KEY --project-ref ojjpslrhyutizwpvvngu
echo "$ANON_KEY" | supabase secrets set SUPABASE_ANON_KEY --project-ref ojjpslrhyutizwpvvngu
echo "$SUPABASE_URL" | supabase secrets set SUPABASE_URL --project-ref ojjpslrhyutizwpvvngu

echo "✅ Secrets sat succesfuldt!"
echo ""
echo "🚀 Næste skridt:"
echo "1. Deploy edge functions: npm run db:push"
echo "2. Test functions i Supabase dashboard"
echo "3. Verificer at hardkodede secrets er fjernet fra kode"

# Tjek for hardkodede secrets
echo ""
echo "🔍 Tjekker for hardkodede secrets i koden..."
if grep -r "eyJhbGciOiJIUzI1NiJ9" infra/supabase/functions/ 2>/dev/null; then
    echo "❌ ADVARSEL: Fandt hardkodede JWT tokens!"
fi

if grep -r "1b87ab9bffbda09608bda2bdc9e5d2036f0ddfd6" infra/supabase/functions/ 2>/dev/null; then
    echo "❌ ADVARSEL: Fandt hardkodede Strava secrets!"
fi

echo "✅ Secret setup komplet!"
