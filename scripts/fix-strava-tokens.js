#!/usr/bin/env node

/**
 * Fix Expired Strava Tokens
 * Manually refresh expired Strava tokens for users
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ojjpslrhyutizwpvvngu.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9qanBzbHJoeXV0aXp3cHZ2bmd1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjIzMDI0NSwiZXhwIjoyMDcxODA2MjQ1fQ.Wm6AbiLNjIVM-T4a7TUhBMphb5EW9fMMLJC9-wSJNS4';

// Note: These would normally be in environment variables
const STRAVA_CLIENT_ID = process.env.STRAVA_CLIENT_ID || 'NOT_SET';
const STRAVA_CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET || 'NOT_SET';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function refreshStravaToken(refreshToken, clientId, clientSecret) {
  console.log('   🔄 Refreshing Strava token...');

  const form = new URLSearchParams();
  form.set('client_id', clientId);
  form.set('client_secret', clientSecret);
  form.set('refresh_token', refreshToken);
  form.set('grant_type', 'refresh_token');

  const response = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Token refresh failed: ${response.status} - ${errorText}`);
  }

  return await response.json();
}

async function fixStravaTokens() {
  console.log('🔧 FIXING EXPIRED STRAVA TOKENS');
  console.log('='.repeat(40));

  if (STRAVA_CLIENT_ID === 'NOT_SET' || STRAVA_CLIENT_SECRET === 'NOT_SET') {
    console.log('❌ Strava credentials not set in environment');
    console.log('📋 Manual steps needed:');
    console.log('1. Get Strava Client ID and Secret from Strava Developer Portal');
    console.log('2. Set STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET environment variables');
    console.log('3. Or manually refresh tokens through Strava API');
    return;
  }

  try {
    // Get users with expired tokens
    const { data: expiredUsers, error } = await supabase
      .from('profiles')
      .select('id, user_id, username, strava_access_token, strava_refresh_token, strava_expires_at')
      .not('strava_access_token', 'is', null)
      .lt('strava_expires_at', new Date().toISOString());

    if (error) {
      console.error('❌ Error fetching expired users:', error.message);
      return;
    }

    if (!expiredUsers || expiredUsers.length === 0) {
      console.log('✅ No expired tokens found');
      return;
    }

    console.log(`🔄 Found ${expiredUsers.length} users with expired tokens:`);

    for (const user of expiredUsers) {
      console.log(`\n👤 Processing ${user.username}...`);

      if (!user.strava_refresh_token) {
        console.log('   ❌ No refresh token available - user needs to reconnect Strava');
        continue;
      }

      try {
        const refreshedToken = await refreshStravaToken(
          user.strava_refresh_token,
          STRAVA_CLIENT_ID,
          STRAVA_CLIENT_SECRET
        );

        // Update tokens in database
        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            strava_access_token: refreshedToken.access_token,
            strava_refresh_token: refreshedToken.refresh_token,
            strava_expires_at: new Date(refreshedToken.expires_at * 1000).toISOString(),
          })
          .eq('user_id', user.user_id);

        if (updateError) {
          console.log(`   ❌ Database update failed: ${updateError.message}`);
        } else {
          const newExpiry = new Date(refreshedToken.expires_at * 1000);
          console.log(`   ✅ Token refreshed successfully - expires ${newExpiry.toISOString()}`);
        }

      } catch (refreshError) {
        console.log(`   ❌ Token refresh failed: ${refreshError.message}`);
        console.log('   📋 User may need to reconnect Strava manually');
      }
    }

    console.log('\n✅ Token refresh process completed');

  } catch (error) {
    console.error('❌ Process failed:', error.message);
  }
}

async function createTokenRefreshSolution() {
  console.log('\n🛠️  CREATING TOKEN REFRESH SOLUTION');
  console.log('='.repeat(40));

  console.log('Since automatic token refresh requires Strava credentials,');
  console.log('here are the solutions for the Strava import issue:\n');

  console.log('🎯 IMMEDIATE SOLUTIONS:');
  console.log('1. Users should visit /strava-connect page to reconnect Strava');
  console.log('2. Set up proper Strava credentials in Edge Function environment');
  console.log('3. Test the /debug/strava page to verify OAuth flow');

  console.log('\n🔧 TECHNICAL FIXES NEEDED:');
  console.log('1. Ensure Strava Edge Functions have proper environment variables:');
  console.log('   - STRAVA_CLIENT_ID');
  console.log('   - STRAVA_CLIENT_SECRET');
  console.log('2. Test token refresh flow when users try to import activities');
  console.log('3. Add user notification when tokens expire');

  console.log('\n📋 PREVENTION MEASURES:');
  console.log('1. Add token expiry warnings in UI');
  console.log('2. Implement background token refresh job');
  console.log('3. Better error handling when tokens are invalid');
}

// Run the analysis and create solutions
fixStravaTokens()
  .then(() => createTokenRefreshSolution())
  .catch(console.error);