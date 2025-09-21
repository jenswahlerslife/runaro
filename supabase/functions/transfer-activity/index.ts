import { createClient } from 'npm:@supabase/supabase-js@2.39.3';

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

function calculatePoints(distance: number, movingTime: number, elevationGain: number = 0): number {
  // Basic point calculation formula
  // 1 point per km + bonus for speed + bonus for elevation
  const distanceKm = distance / 1000;
  if (!movingTime || !isFinite(movingTime) || movingTime <= 0) {
    // No speed bonus possible
    return Math.max(Math.floor(distanceKm * 10) + Math.floor((elevationGain || 0) / 10), 1);
  }
  const speedKmh = distanceKm / (movingTime / 3600);

  let points = Math.floor(distanceKm * 10); // 10 points per km

  // Speed bonus (more points for faster runs)
  if (speedKmh > 12) points += Math.floor(distanceKm * 5); // Very fast
  else if (speedKmh > 10) points += Math.floor(distanceKm * 3); // Fast
  else if (speedKmh > 8) points += Math.floor(distanceKm * 2); // Good pace

  // Elevation bonus
  points += Math.floor(elevationGain / 10); // 1 point per 10m elevation

  return Math.max(points, 1); // Minimum 1 point
}

// Minimal polyline decoder (Google Encoded Polyline Algorithm Format)
function decodePolyline(str: string, precision = 5): number[][] {
  const coordinates: number[][] = [];
  let index = 0, lat = 0, lng = 0;
  const factor = Math.pow(10, precision);

  while (index < str.length) {
    let b: number, shift = 0, result = 0;
    do {
      b = str.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = (result & 1) ? ~(result >> 1) : (result >> 1);
    lat += dlat;

    shift = 0; result = 0;
    do {
      b = str.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = (result & 1) ? ~(result >> 1) : (result >> 1);
    lng += dlng;

    coordinates.push([lat / factor, lng / factor]);
  }
  return coordinates;
}

function polylineToPostGISGeometry(polylineString: string): string | null {
  if (!polylineString) return null;
  try {
    const coordinates = decodePolyline(polylineString);
    if (coordinates.length < 2) return null;
    const points = coordinates.map(([lat, lng]) => `${lng} ${lat}`).join(', ');
    return `LINESTRING(${points})`;
  } catch (error) {
    console.error('Error converting polyline to geometry:', error);
    return null;
  }
}

Deno.serve(async (req) => {
  const headers = cors(req.headers.get('Origin'));
  if (req.method === 'OPTIONS') return new Response(null, { headers });

  try {
    // Get environment variables - fail if not set properly
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');
    const STRAVA_CLIENT_ID = Deno.env.get('STRAVA_CLIENT_ID');
    const STRAVA_CLIENT_SECRET = Deno.env.get('STRAVA_CLIENT_SECRET');

    // Validate required environment variables
    if (!SUPABASE_URL || !SERVICE_ROLE || !ANON_KEY || !STRAVA_CLIENT_ID || !STRAVA_CLIENT_SECRET) {
      console.error('Missing required environment variables:', {
        SUPABASE_URL: !!SUPABASE_URL,
        SERVICE_ROLE: !!SERVICE_ROLE,
        ANON_KEY: !!ANON_KEY,
        STRAVA_CLIENT_ID: !!STRAVA_CLIENT_ID,
        STRAVA_CLIENT_SECRET: !!STRAVA_CLIENT_SECRET
      });
      return new Response(JSON.stringify({ error: 'Function configuration error' }), { status: 500, headers });
    }

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

    // Get the profile ID (user_activities FK references profiles.id, not auth.users.id)
    const { data: profile, error: profileLookupError } = await supabaseSrv
      .from('profiles')
      .select('id')
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

    console.log('Transferring activity:', activityId, 'for auth user:', authUserId, 'profile:', profileId);

    // Get user's Strava tokens from profile
    const { data: stravaProfile, error: profileError } = await supabaseSrv
      .from('profiles')
      .select('strava_access_token, strava_refresh_token, strava_expires_at')
      .eq('user_id', authUserId)
      .single();

    if (profileError || !stravaProfile?.strava_access_token) {
      return new Response(JSON.stringify({ error: 'Strava not connected' }), { status: 400, headers });
    }

    let accessToken = stravaProfile.strava_access_token;

    // Check if token needs refresh
    const expiresAt = stravaProfile.strava_expires_at ? new Date(stravaProfile.strava_expires_at) : null;
    const now = new Date();
    
    if (expiresAt && now >= expiresAt && stravaProfile.strava_refresh_token) {
      try {
        const refreshedToken = await refreshStravaToken(
          stravaProfile.strava_refresh_token,
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
    const activityResponse = await fetch(`https://www.strava.com/api/v3/activities/${activityId}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!activityResponse.ok) {
      const errorText = await activityResponse.text();
      console.error('Strava API error:', activityResponse.status, errorText);
      return new Response(
        JSON.stringify({ error: `Could not fetch activity details: ${activityResponse.status}` }),
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

    // Assume schema is provisioned by migrations. Avoid performing DDL from runtime functions.

    // Convert polyline to PostGIS geometry
    const polylineString = activity.map?.polyline || activity.map?.summary_polyline || null;
    const routeGeometry = polylineString ? polylineToPostGISGeometry(polylineString) : null;

    // Insert activity into database
    const activityData = {
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
      is_base: false, // New activities are not bases by default
      included_in_game: false, // Align with DB default to avoid drift
    };

    // Insert activity via RPC to avoid raw SQL in runtime
    const { error: insertError } = await supabaseSrv.rpc('insert_user_activity_with_route', {
      p_user_id: profileId,
      p_strava_activity_id: activityId,
      p_name: activity.name,
      p_distance: activity.distance || 0,
      p_moving_time: activity.moving_time || 0,
      p_activity_type: activity.type || 'Run',
      p_start_date: activity.start_date,
      p_average_speed: activity.average_speed || 0,
      p_max_speed: activity.max_speed || 0,
      p_total_elevation_gain: activity.total_elevation_gain || 0,
      p_points_earned: points,
      p_polyline: polylineString,
      p_is_base: false,
      p_included_in_game: false,
      p_wkt_route: routeGeometry
    });

    if (insertError) {
      console.error('Database insert failed:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to save activity to database' }),
        { status: 500, headers }
      );
    }

    // Update user's total points - try RPC function
    try {
      const { error: pointsError } = await supabaseSrv
        .rpc('increment_user_points', {
          user_uuid: authUserId,
          points_to_add: points
        });

      if (pointsError) {
        console.warn('Points update failed:', pointsError);
        // Still don't fail the entire request since activity was saved
      } else {
        console.log(`Added ${points} points to auth user ${authUserId} via profile ${profileId}`);
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

  } catch (error: any) {
    console.error('Transfer activity error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Unknown error' }),
      { status: 500, headers }
    );
  }
});
