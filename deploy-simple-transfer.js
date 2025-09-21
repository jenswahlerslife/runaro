// Deploy simple transfer-activity based on working strava-activities pattern
const simpleTransferFunction = `
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

function cors(origin) {
  const allowed = origin ?? '*';
  return {
    'Access-Control-Allow-Origin': allowed,
    'Vary': 'Origin',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };
}

function calculatePoints(distance, movingTime, elevationGain = 0) {
  const distanceKm = distance / 1000;
  if (!movingTime || !isFinite(movingTime) || movingTime <= 0) {
    return Math.max(Math.floor(distanceKm * 10) + Math.floor((elevationGain || 0) / 10), 1);
  }
  const speedKmh = distanceKm / (movingTime / 3600);

  let points = Math.floor(distanceKm * 10); // 10 points per km

  // Speed bonus
  if (speedKmh > 12) points += Math.floor(distanceKm * 5);
  else if (speedKmh > 10) points += Math.floor(distanceKm * 3);
  else if (speedKmh > 8) points += Math.floor(distanceKm * 2);

  // Elevation bonus
  points += Math.floor(elevationGain / 10);

  return Math.max(points, 1);
}

Deno.serve(async (req) => {
  const headers = cors(req.headers.get('Origin'));
  if (req.method === 'OPTIONS') return new Response(null, { headers });

  try {
    // Use environment variables (same as working strava-activities)
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');
    const STRAVA_CLIENT_ID = Deno.env.get('STRAVA_CLIENT_ID');
    const STRAVA_CLIENT_SECRET = Deno.env.get('STRAVA_CLIENT_SECRET');

    // Validate environment variables
    const missing = [];
    if (!SUPABASE_URL) missing.push('SUPABASE_URL');
    if (!SERVICE_ROLE) missing.push('SUPABASE_SERVICE_ROLE_KEY');
    if (!ANON_KEY) missing.push('SUPABASE_ANON_KEY');
    if (!STRAVA_CLIENT_ID) missing.push('STRAVA_CLIENT_ID');
    if (!STRAVA_CLIENT_SECRET) missing.push('STRAVA_CLIENT_SECRET');

    if (missing.length > 0) {
      console.error('Missing environment variables:', missing);
      return new Response(
        JSON.stringify({ error: 'Function configuration error', missing }),
        { status: 500, headers }
      );
    }

    // Get user from JWT (same pattern as strava-activities)
    const jwt = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!jwt) {
      return new Response(JSON.stringify({ error: 'Authorization required' }), { status: 401, headers });
    }

    const supabaseAnon = createClient(SUPABASE_URL, ANON_KEY);
    const { data: userRes, error: jwtError } = await supabaseAnon.auth.getUser(jwt);

    if (jwtError || !userRes?.user?.id) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 401, headers });
    }

    const authUserId = userRes.user.id;

    // Get request body
    const body = await req.json();
    const { activityId } = body;

    if (!activityId) {
      return new Response(JSON.stringify({ error: 'Activity ID required' }), { status: 400, headers });
    }

    console.log('Transferring activity:', activityId, 'for user:', authUserId);

    // Get profile with Strava tokens (same as strava-activities)
    const supabaseSrv = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: profile, error: profileError } = await supabaseSrv
      .from('profiles')
      .select('id, strava_access_token, strava_refresh_token, strava_expires_at')
      .eq('user_id', authUserId)
      .single();

    if (profileError || !profile?.strava_access_token) {
      return new Response(JSON.stringify({ error: 'Strava not connected' }), { status: 400, headers });
    }

    const profileId = profile.id;
    let accessToken = profile.strava_access_token;

    // Check if token needs refresh (same logic as strava-activities)
    const expiresAt = profile.strava_expires_at ? new Date(profile.strava_expires_at) : null;
    const now = new Date();

    if (expiresAt && now >= expiresAt && profile.strava_refresh_token) {
      try {
        const form = new URLSearchParams();
        form.set('client_id', STRAVA_CLIENT_ID);
        form.set('client_secret', STRAVA_CLIENT_SECRET);
        form.set('refresh_token', profile.strava_refresh_token);
        form.set('grant_type', 'refresh_token');

        const response = await fetch('https://www.strava.com/oauth/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: form.toString(),
        });

        if (response.ok) {
          const refreshedToken = await response.json();

          await supabaseSrv
            .from('profiles')
            .update({
              strava_access_token: refreshedToken.access_token,
              strava_refresh_token: refreshedToken.refresh_token,
              strava_expires_at: new Date(refreshedToken.expires_at * 1000).toISOString(),
            })
            .eq('user_id', authUserId);

          accessToken = refreshedToken.access_token;
        }
      } catch (error) {
        console.error('Token refresh failed:', error);
      }
    }

    // Fetch activity from Strava
    const activityResponse = await fetch(\`https://www.strava.com/api/v3/activities/\${activityId}\`, {
      headers: { 'Authorization': \`Bearer \${accessToken}\` },
    });

    if (!activityResponse.ok) {
      return new Response(
        JSON.stringify({ error: \`Could not fetch activity: \${activityResponse.status}\` }),
        { status: activityResponse.status, headers }
      );
    }

    const activity = await activityResponse.json();

    // Check if it's a running activity
    if (activity.type !== 'Run' && activity.type !== 'TrailRun') {
      return new Response(
        JSON.stringify({ error: 'Only running activities can be transferred' }),
        { status: 400, headers }
      );
    }

    // Check if already transferred
    const { data: existingActivity } = await supabaseSrv
      .from('user_activities')
      .select('id')
      .eq('user_id', profileId)
      .eq('strava_activity_id', activityId)
      .single();

    if (existingActivity) {
      return new Response(
        JSON.stringify({ error: 'Activity already transferred' }),
        { status: 400, headers }
      );
    }

    // Calculate points
    const points = calculatePoints(
      activity.distance || 0,
      activity.moving_time || 0,
      activity.total_elevation_gain || 0
    );

    // Insert into user_activities (using profileId for FK)
    const { error: insertError } = await supabaseSrv
      .from('user_activities')
      .insert({
        user_id: profileId,
        strava_activity_id: activityId,
        name: activity.name,
        distance: activity.distance || 0,
        moving_time: activity.moving_time || 0,
        activity_type: activity.type || 'Run',
        start_date: activity.start_date,
        average_speed: activity.average_speed || 0,
        max_speed: activity.max_speed || 0,
        total_elevation_gain: activity.total_elevation_gain || 0,
        points_earned: points,
        polyline: activity.map?.polyline || activity.map?.summary_polyline,
        is_base: false,
        included_in_game: true,
      });

    if (insertError) {
      console.error('Database insert failed:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to save activity', details: insertError.message }),
        { status: 500, headers }
      );
    }

    console.log('Activity transferred successfully:', {
      activityId,
      name: activity.name,
      points,
      distance: activity.distance
    });

    return new Response(JSON.stringify({
      success: true,
      activity: {
        id: activityId,
        name: activity.name,
        distance: activity.distance,
        points_earned: points
      }
    }), { headers });

  } catch (error) {
    console.error('Transfer activity error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Unknown error' }),
      { status: 500, headers }
    );
  }
});
`;

const projectRef = 'ojjpslrhyutizwpvvngu';
const accessToken = 'sbp_38d564351d1f0f43a23413c6e527faf2d255e858';

async function deploySimpleTransfer() {
  console.log('🚀 Deploying simple transfer based on working strava-activities...');

  try {
    const response = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/functions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'transfer-activity',
        slug: 'transfer-activity',
        source: simpleTransferFunction,
        verify_jwt: true,
        import_map: '{}'
      })
    });

    if (response.ok) {
      const result = await response.json();
      console.log('✅ Simple transfer deployed:', result.version);
      console.log('🎉 Try the "Overfør til spillet" button now!');
      return true;
    } else {
      const error = await response.text();
      console.error('❌ Deploy failed:', response.status, error);
      return false;
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    return false;
  }
}

await deploySimpleTransfer();