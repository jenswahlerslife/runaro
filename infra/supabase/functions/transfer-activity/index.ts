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

interface TransferActivityRequest {
  activityId: number;
}

Deno.serve(async (req) => {
  const headers = cors(req.headers.get('Origin'));
  if (req.method === 'OPTIONS') return new Response('ok', { headers });

  try {
    // Get JWT from authorization header to identify current user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid authorization header' }),
        { status: 401, headers }
      );
    }

    // Parse request body
    const { activityId }: TransferActivityRequest = await req.json();
    if (!activityId) {
      return new Response(
        JSON.stringify({ error: 'Missing activityId parameter' }),
        { status: 400, headers }
      );
    }

    // Create anon client to verify user from JWT
    const anonClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    // Get user from JWT
    const { data: { user }, error: authError } = await anonClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication token' }),
        { status: 401, headers }
      );
    }

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
    let accessToken = profile.strava_access_token;
    const now = Math.floor(Date.now() / 1000);

    if (profile.strava_expires_at && profile.strava_expires_at < now) {
      // Token expired, refresh it
      if (!profile.strava_refresh_token) {
        return new Response(
          JSON.stringify({ error: 'Strava token expired and no refresh token available' }),
          { status: 400, headers }
        );
      }

      const refreshResponse = await fetch('https://www.strava.com/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: Deno.env.get('STRAVA_CLIENT_ID'),
          client_secret: Deno.env.get('STRAVA_CLIENT_SECRET'),
          refresh_token: profile.strava_refresh_token,
          grant_type: 'refresh_token',
        }),
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
          strava_expires_at: tokenData.expires_at,
        })
        .eq('user_id', user.id);
    }

    // Fetch activity from Strava API
    const activityResponse = await fetch(
      `https://www.strava.com/api/v3/activities/${activityId}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );

    if (!activityResponse.ok) {
      if (activityResponse.status === 404) {
        return new Response(
          JSON.stringify({ error: 'Activity not found on Strava' }),
          { status: 404, headers }
        );
      }
      return new Response(
        JSON.stringify({ error: 'Failed to fetch activity from Strava' }),
        { status: 400, headers }
      );
    }

    const activity = await activityResponse.json();

    // Only process running activities
    if (!['Run', 'TrailRun'].includes(activity.type)) {
      return new Response(
        JSON.stringify({ error: 'Only running activities can be transferred' }),
        { status: 400, headers }
      );
    }

    // Check if activity already exists
    const { data: existingActivity } = await serviceClient
      .from('user_activities')
      .select('id')
      .eq('user_id', profile.id)
      .eq('strava_activity_id', activityId)
      .single();

    if (existingActivity) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Activity already exists',
          user_activity_id: existingActivity.id
        }),
        { headers }
      );
    }

    // Insert/upsert activity into user_activities
    const { data: userActivity, error: insertError } = await serviceClient
      .from('user_activities')
      .insert({
        user_id: profile.id,
        strava_activity_id: activityId,
        name: activity.name,
        distance: activity.distance, // Strava gives meters
        moving_time: activity.moving_time, // seconds
        activity_type: activity.type,
        start_date: activity.start_date,
        polyline: activity.map?.summary_polyline || null,
        is_base: false,
        included_in_game: true,
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('Database insert error:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to save activity to database' }),
        { status: 500, headers }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        user_activity_id: userActivity.id,
        activity_name: activity.name,
        distance_km: (activity.distance / 1000).toFixed(2),
      }),
      { headers }
    );

  } catch (error: any) {
    console.error('Transfer activity error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Unknown error' }),
      { status: 500, headers }
    );
  }
});