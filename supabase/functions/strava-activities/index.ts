import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

function cors(origin: string | null) {
  const allowed = origin ?? '*';
  return {
    'Access-Control-Allow-Origin': allowed,
    'Vary': 'Origin',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Content-Type': 'application/json',
  };
}

async function refreshStravaToken(refreshToken: string, clientId: string, clientSecret: string) {
  console.log('Refreshing Strava token...');
  
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
    throw new Error(`Token refresh failed: ${response.status}`);
  }

  return await response.json();
}

Deno.serve(async (req) => {
  const headers = cors(req.headers.get('Origin'));
  if (req.method === 'OPTIONS') return new Response(null, { headers });

  try {
    // SIKKERHED: Kræv miljøvariabler - aldrig hardkodede secrets
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');
    const STRAVA_CLIENT_ID = Deno.env.get('STRAVA_CLIENT_ID');
    const STRAVA_CLIENT_SECRET = Deno.env.get('STRAVA_CLIENT_SECRET');

    // Valider at alle nødvendige miljøvariabler er sat
    const missing = [];
    if (!SUPABASE_URL) missing.push('SUPABASE_URL');
    if (!SERVICE_ROLE) missing.push('SUPABASE_SERVICE_ROLE_KEY');
    if (!ANON_KEY) missing.push('SUPABASE_ANON_KEY');
    if (!STRAVA_CLIENT_ID) missing.push('STRAVA_CLIENT_ID');
    if (!STRAVA_CLIENT_SECRET) missing.push('STRAVA_CLIENT_SECRET');

    if (missing.length > 0) {
      console.error('Missing required environment variables:', missing);
      return new Response(
        JSON.stringify({ error: 'Server configuration error - missing environment variables' }),
        { status: 500, headers }
      );
    }

    // Get user from JWT
    const jwt = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!jwt) {
      return new Response(JSON.stringify({ error: 'Authorization required' }), { status: 401, headers });
    }

    const supabaseAnon = createClient(SUPABASE_URL, ANON_KEY);
    const { data: userRes, error: jwtError } = await supabaseAnon.auth.getUser(jwt);
    
    if (jwtError || !userRes?.user?.id) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 401, headers });
    }

    const userId = userRes.user.id;
    console.log('Fetching activities for user:', userId);

    // Get user's Strava tokens from profile
    const supabaseSrv = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: profile, error: profileError } = await supabaseSrv
      .from('profiles')
      .select('strava_access_token, strava_refresh_token, strava_expires_at')
      .eq('user_id', userId)
      .single();

    if (profileError || !profile?.strava_access_token) {
      return new Response(JSON.stringify({ error: 'Strava not connected' }), { status: 400, headers });
    }

    let accessToken = profile.strava_access_token;

    // Check if token needs refresh
    const expiresAt = profile.strava_expires_at ? new Date(profile.strava_expires_at) : null;
    const now = new Date();
    
    if (expiresAt && now >= expiresAt && profile.strava_refresh_token) {
      try {
        const refreshedToken = await refreshStravaToken(
          profile.strava_refresh_token,
          STRAVA_CLIENT_ID,
          STRAVA_CLIENT_SECRET
        );

        // Update tokens in database
        await supabaseSrv
          .from('profiles')
          .update({
            strava_access_token: refreshedToken.access_token,
            strava_refresh_token: refreshedToken.refresh_token,
            strava_expires_at: new Date(refreshedToken.expires_at * 1000).toISOString(),
          })
          .eq('user_id', userId);

        accessToken = refreshedToken.access_token;
        console.log('Token refreshed successfully');
      } catch (error) {
        console.error('Token refresh failed:', error);
        return new Response(JSON.stringify({ error: 'Token refresh failed' }), { status: 401, headers });
      }
    }

    // Get request parameters
    const body = await req.json().catch(() => ({}));
    const limit = body.limit || 10;

    // Fetch activities from Strava
    console.log('Fetching activities from Strava API...');
    const activitiesResponse = await fetch(`https://www.strava.com/api/v3/athlete/activities?per_page=${limit}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!activitiesResponse.ok) {
      const errorText = await activitiesResponse.text();
      console.error('Strava API error:', activitiesResponse.status, errorText);
      return new Response(
        JSON.stringify({ error: `Strava API error: ${activitiesResponse.status}` }),
        { status: activitiesResponse.status, headers }
      );
    }

    const activities = await activitiesResponse.json();
    console.log(`Fetched ${activities.length} activities from Strava`);

    // Filter for running activities and format the data
    const runningActivities = activities.filter((activity: any) => 
      activity.type === 'Run' || activity.type === 'TrailRun'
    );

    // Check if user has any transferred activities to filter out
    let transferredActivityIds = [];
    try {
      const { data: transferred, error: transferError } = await supabaseSrv
        .from('user_activities')
        .select('strava_activity_id')
        .eq('user_id', userId);
        
      if (!transferError && transferred) {
        transferredActivityIds = transferred.map(a => a.strava_activity_id);
      }
    } catch (e) {
      // Table might not exist yet, that's ok
      console.log('user_activities table not found, showing all activities');
    }

    // Filter out already transferred activities
    const availableActivities = runningActivities.filter((activity: any) =>
      !transferredActivityIds.includes(activity.id)
    );

    return new Response(JSON.stringify({ 
      success: true, 
      activities: availableActivities,
      count: availableActivities.length,
      totalActivities: runningActivities.length,
      transferred: transferredActivityIds.length
    }), { headers });

  } catch (error: any) {
    console.error('Activities fetch error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Unknown error' }),
      { status: 500, headers }
    );
  }
});