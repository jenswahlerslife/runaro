import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

function cors(origin: string | null) {
  const allowed = origin ?? '*';
  return {
    'Access-Control-Allow-Origin': allowed,
    'Vary': 'Origin',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };
}

interface ImportRequest {
  limit?: number;
}

Deno.serve(async (req) => {
  const headers = cors(req.headers.get('Origin'));
  if (req.method === 'OPTIONS') return new Response('ok', { headers });

  try {
    // Debug: Log all request headers
    const authHeaderRaw = req.headers.get('Authorization') || req.headers.get('authorization');
    console.log('=== AUTH DEBUG ===');
    console.log('Auth header raw:', authHeaderRaw?.substring(0, 50) + '...');
    console.log('Starts with Bearer:', authHeaderRaw?.startsWith('Bearer '));

    // Get JWT from authorization header to identify current user
    // Extract the raw JWT token (remove 'Bearer ' prefix if present)
    let jwt = authHeaderRaw;
    if (jwt?.startsWith('Bearer ')) {
      jwt = jwt.substring(7); // Remove 'Bearer ' prefix
    }

    console.log('JWT extracted:', !!jwt, jwt?.substring(0, 30) + '...');

    if (!jwt) {
      console.error('No JWT token found in request');
      return new Response(
        JSON.stringify({
          error: 'Authorization required',
          details: 'No JWT token in Authorization header',
          debug: {
            hasAuthHeader: !!authHeaderRaw,
            authHeaderPreview: authHeaderRaw?.substring(0, 20)
          }
        }),
        { status: 401, headers }
      );
    }

    // Parse request body
    const { limit = 20 }: ImportRequest = await req.json().catch(() => ({}));

    // Debug: Log environment
    console.log('SUPABASE_URL:', Deno.env.get('SUPABASE_URL'));
    console.log('SUPABASE_ANON_KEY present:', !!Deno.env.get('SUPABASE_ANON_KEY'));

    // Create anon client to verify user from JWT
    const anonClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    // Get user from JWT token (pass raw JWT, not the full Authorization header)
    console.log('Calling auth.getUser with JWT...');
    const { data: userRes, error: authError } = await anonClient.auth.getUser(jwt);

    console.log('Auth result:', {
      userId: userRes?.user?.id,
      userEmail: userRes?.user?.email,
      errorMessage: authError?.message,
      errorCode: authError?.code
    });

    if (authError || !userRes?.user?.id) {
      console.error('Auth validation failed:', authError);
      return new Response(
        JSON.stringify({
          error: 'Invalid authentication token',
          details: authError?.message || 'Unable to verify user',
          debug: {
            errorCode: authError?.code,
            errorStatus: authError?.status,
            hasUser: !!userRes?.user
          }
        }),
        { status: 401, headers }
      );
    }

    const user = userRes.user;
    console.log('✅ User authenticated:', user.id);

    // Create service role client for database operations
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get user's profile and Strava tokens
    const { data: profile, error: profileError } = await serviceClient
      .from('profiles')
      .select('id, strava_access_token, strava_refresh_token, strava_expires_at')
      .eq('user_id', user.id)
      .single();

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ error: 'User profile not found' }),
        { status: 404, headers }
      );
    }

    if (!profile.strava_access_token) {
      return new Response(
        JSON.stringify({ error: 'Strava not connected for this user' }),
        { status: 400, headers }
      );
    }

    // Check if token needs refresh
    // Handle both ISO timestamp (from strava-auth) and epoch seconds
    let accessToken = profile.strava_access_token;
    const nowSec = Math.floor(Date.now() / 1000);

    // Parse strava_expires_at: could be ISO string or epoch seconds
    let expiresAtSec: number | undefined;
    if (profile.strava_expires_at) {
      if (typeof profile.strava_expires_at === 'string') {
        // ISO timestamp from database
        expiresAtSec = Math.floor(new Date(profile.strava_expires_at).getTime() / 1000);
      } else {
        // Already epoch seconds
        expiresAtSec = profile.strava_expires_at;
      }
    }

    if (expiresAtSec && expiresAtSec < nowSec) {
      // Token expired, refresh it
      console.log(`Token expired at ${expiresAtSec}, refreshing...`);
      if (!profile.strava_refresh_token) {
        return new Response(
          JSON.stringify({ error: 'Strava token expired and no refresh token available' }),
          { status: 400, headers }
        );
      }

      const form = new URLSearchParams();
      form.set('client_id', Deno.env.get('STRAVA_CLIENT_ID') ?? '');
      form.set('client_secret', Deno.env.get('STRAVA_CLIENT_SECRET') ?? '');
      form.set('refresh_token', profile.strava_refresh_token);
      form.set('grant_type', 'refresh_token');

      const refreshResponse = await fetch('https://www.strava.com/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: form.toString(),
      });

      if (!refreshResponse.ok) {
        return new Response(
          JSON.stringify({ error: 'Failed to refresh Strava token' }),
          { status: 400, headers }
        );
      }

      const tokenData = await refreshResponse.json();
      accessToken = tokenData.access_token;

      // Update profile with new tokens
      await serviceClient
        .from('profiles')
        .update({
          strava_access_token: tokenData.access_token,
          strava_refresh_token: tokenData.refresh_token,
          // store as ISO string for consistency with other functions
          strava_expires_at: tokenData.expires_at ? new Date(tokenData.expires_at * 1000).toISOString() : null,
        })
        .eq('user_id', user.id);
    }

    // Fetch recent activities from Strava API
    const activitiesResponse = await fetch(
      `https://www.strava.com/api/v3/athlete/activities?per_page=${Math.min(limit, 50)}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );

    if (!activitiesResponse.ok) {
      return new Response(
        JSON.stringify({ error: 'Failed to fetch activities from Strava' }),
        { status: 400, headers }
      );
    }

    const activities = await activitiesResponse.json();

    // Filter to only running activities
    const runningActivities = activities.filter((activity: any) =>
      ['Run', 'TrailRun'].includes(activity.type)
    );

    // Get existing activity IDs to avoid duplicates
    const existingIds = new Set();
    if (runningActivities.length > 0) {
      const stravaIds = runningActivities.map((a: any) => a.id);
      const { data: existing } = await serviceClient
        .from('user_activities')
        .select('strava_activity_id')
        .eq('user_id', profile.id)
        .in('strava_activity_id', stravaIds);

      existing?.forEach(row => existingIds.add(row.strava_activity_id));
    }

    // Prepare activities for insertion
    const activitiesToInsert = runningActivities
      .filter((activity: any) => !existingIds.has(activity.id))
      .map((activity: any) => ({
        user_id: profile.id,
        strava_activity_id: activity.id,
        name: activity.name,
        distance: activity.distance, // meters
        moving_time: activity.moving_time, // seconds
        activity_type: activity.type,
        start_date: activity.start_date,
        polyline: activity.map?.summary_polyline || null,
        is_base: false,
        included_in_game: true,
      }));

    let insertedCount = 0;

    if (activitiesToInsert.length > 0) {
      const { data: insertedActivities, error: insertError } = await serviceClient
        .from('user_activities')
        .insert(activitiesToInsert)
        .select('id');

      if (insertError) {
        console.error('Database insert error:', insertError);
        return new Response(
          JSON.stringify({ error: 'Failed to save activities to database' }),
          { status: 500, headers }
        );
      }

      insertedCount = insertedActivities?.length || 0;
    }

    return new Response(
      JSON.stringify({
        success: true,
        inserted_count: insertedCount,
        already_present: existingIds.size,
        total_running_activities: runningActivities.length,
      }),
      { headers }
    );

  } catch (error: any) {
    console.error('Import recent activities error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Unknown error' }),
      { status: 500, headers }
    );
  }
});
