// Deploy stable working transfer-activity that handles OPTIONS correctly
const stableFunction = `
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import * as polyline from 'https://esm.sh/polyline@0.2.0';

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

async function refreshStravaToken(refreshToken, clientId, clientSecret) {
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
    throw new Error(\`Token refresh failed: \${response.status}\`);
  }

  return await response.json();
}

function calculatePoints(distance, movingTime, elevationGain = 0) {
  const distanceKm = distance / 1000;
  if (!movingTime || !isFinite(movingTime) || movingTime <= 0) {
    return Math.max(Math.floor(distanceKm * 10) + Math.floor((elevationGain || 0) / 10), 1);
  }
  const speedKmh = distanceKm / (movingTime / 3600);

  let points = Math.floor(distanceKm * 10);

  if (speedKmh > 12) points += Math.floor(distanceKm * 5);
  else if (speedKmh > 10) points += Math.floor(distanceKm * 3);
  else if (speedKmh > 8) points += Math.floor(distanceKm * 2);

  points += Math.floor(elevationGain / 10);

  return Math.max(points, 1);
}

function polylineToPostGISGeometry(polylineString) {
  if (!polylineString) return null;

  try {
    const coordinates = polyline.decode(polylineString);
    if (coordinates.length < 2) return null;

    const points = coordinates.map(([lat, lng]) => \`\${lng} \${lat}\`).join(', ');
    return \`LINESTRING(\${points})\`;
  } catch (error) {
    console.error('Error converting polyline to geometry:', error);
    return null;
  }
}

Deno.serve(async (req) => {
  const headers = cors(req.headers.get('Origin'));

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    console.log('OPTIONS request received - returning CORS headers');
    return new Response(null, { headers });
  }

  try {
    // Use production values directly
    const SUPABASE_URL = 'https://ojjpslrhyutizwpvvngu.supabase.co';
    const SERVICE_ROLE = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9qanBzbHJoeXV0aXp3cHZ2bmd1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjIzMDI0NSwiZXhwIjoyMDcxODA2MjQ1fQ.Wm6AbiLNjIVM-T4a7TUhBMphb5EW9fMMLJC9-wSJNS4';
    const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9qanBzbHJoeXV0aXp3cHZ2bmd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYyMzAyNDUsImV4cCI6MjA3MTgwNjI0NX0.qsKY1YPBaphie0BwV71-kHcg73ZfKNuBUHR9yHO78zA';
    const STRAVA_CLIENT_ID = '174654';
    const STRAVA_CLIENT_SECRET = '1b87ab9bffbda09608bda2bdc9e5d2036f0ddfd6';

    // Get user from JWT
    const jwt = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!jwt) {
      return new Response(JSON.stringify({ error: 'Authorization required' }), { status: 401, headers });
    }

    // Create clients
    const supabaseSrv = createClient(SUPABASE_URL, SERVICE_ROLE);
    const supabaseAnon = createClient(SUPABASE_URL, ANON_KEY);
    const { data: userRes, error: jwtError } = await supabaseAnon.auth.getUser(jwt);

    if (jwtError || !userRes?.user?.id) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 401, headers });
    }

    const authUserId = userRes.user.id;

    // Get the profile ID (FIXED: user_activities FK references profiles.id)
    const { data: profile, error: profileLookupError } = await supabaseSrv
      .from('profiles')
      .select('id, strava_access_token, strava_refresh_token, strava_expires_at')
      .eq('user_id', authUserId)
      .single();

    if (profileLookupError || !profile?.id) {
      console.error('Profile lookup failed:', profileLookupError);
      return new Response(JSON.stringify({ error: 'User profile not found' }), { status: 400, headers });
    }

    const profileId = profile.id;

    // Get request body
    const body = await req.json();
    const { activityId } = body;

    if (!activityId) {
      return new Response(JSON.stringify({ error: 'Activity ID required' }), { status: 400, headers });
    }

    console.log('Transferring activity:', activityId, 'for profile:', profileId);

    if (!profile.strava_access_token) {
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
          .eq('user_id', authUserId);

        accessToken = refreshedToken.access_token;
      } catch (error) {
        console.error('Token refresh failed:', error);
        return new Response(JSON.stringify({ error: 'Token refresh failed' }), { status: 401, headers });
      }
    }

    // Fetch detailed activity from Strava
    console.log('Fetching activity details from Strava...');
    const activityResponse = await fetch(\`https://www.strava.com/api/v3/activities/\${activityId}\`, {
      headers: {
        'Authorization': \`Bearer \${accessToken}\`,
      },
    });

    if (!activityResponse.ok) {
      const errorText = await activityResponse.text();
      console.error('Strava API error:', activityResponse.status, errorText);
      return new Response(
        JSON.stringify({ error: \`Could not fetch activity details: \${activityResponse.status}\` }),
        { status: activityResponse.status, headers }
      );
    }

    const activity = await activityResponse.json();

    // Check if this is a running activity
    if (activity.type !== 'Run' && activity.type !== 'TrailRun') {
      return new Response(
        JSON.stringify({ error: 'Only running activities can be transferred' }),
        { status: 400, headers }
      );
    }

    // Check if activity already exists
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

    // Calculate points for the activity
    const points = calculatePoints(
      activity.distance || 0,
      activity.moving_time || 0,
      activity.total_elevation_gain || 0
    );

    // Convert polyline to PostGIS geometry
    const polylineString = activity.map?.polyline || activity.map?.summary_polyline || null;

    // Insert activity into database (simplified)
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
        polyline: polylineString,
        is_base: false,
        included_in_game: true,
      });

    if (insertError) {
      console.error('Database insert failed:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to save activity to database', details: insertError.message }),
        { status: 500, headers }
      );
    }

    // Update user's total points
    try {
      const { error: pointsError } = await supabaseSrv
        .rpc('increment_user_points', {
          user_uuid: authUserId,
          points_to_add: points
        });

      if (pointsError) {
        console.warn('Points update failed:', pointsError);
      } else {
        console.log(\`Added \${points} points to user \${authUserId}\`);
      }
    } catch (e) {
      console.warn('Points update error:', e);
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

async function deployStableFunction() {
  console.log('🚀 Deploying stable transfer-activity with proper OPTIONS handling...');

  try {
    const response = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/functions/transfer-activity`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        source: stableFunction,
        verify_jwt: true,
        import_map: '{}'
      })
    });

    if (response.ok) {
      const result = await response.json();
      console.log('✅ Stable function deployed:', result.version);

      // Wait for deployment to stabilize
      console.log('⏳ Waiting for deployment to stabilize...');
      await new Promise(resolve => setTimeout(resolve, 10000));

      // Test OPTIONS and POST
      console.log('🧪 Testing OPTIONS request...');
      const optionsResponse = await fetch(`https://ojjpslrhyutizwpvvngu.supabase.co/functions/v1/transfer-activity`, {
        method: 'OPTIONS',
        headers: {
          'Origin': 'https://runaro.dk',
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'authorization, content-type'
        }
      });

      console.log('OPTIONS result:', optionsResponse.status, optionsResponse.statusText);

      if (optionsResponse.ok) {
        console.log('✅ CORS preflight working!');
        console.log('CORS headers:', {
          'Access-Control-Allow-Origin': optionsResponse.headers.get('Access-Control-Allow-Origin'),
          'Access-Control-Allow-Methods': optionsResponse.headers.get('Access-Control-Allow-Methods'),
          'Access-Control-Allow-Headers': optionsResponse.headers.get('Access-Control-Allow-Headers')
        });
      } else {
        console.log('❌ CORS still failing');
        const errorText = await optionsResponse.text();
        console.log('Error:', errorText);
      }

      // Test POST
      console.log('🧪 Testing POST request...');
      const postResponse = await fetch(`https://ojjpslrhyutizwpvvngu.supabase.co/functions/v1/transfer-activity`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'https://runaro.dk'
        },
        body: JSON.stringify({ activityId: 123456 })
      });

      console.log('POST result:', postResponse.status);
      const postText = await postResponse.text();
      console.log('POST response:', postText);

      return optionsResponse.ok && postResponse.status === 401; // 401 = auth working

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

await deployStableFunction();