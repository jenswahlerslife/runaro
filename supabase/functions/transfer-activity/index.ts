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

async function refreshStravaToken(refreshToken: string, clientId: string, clientSecret: string) {
  console.log('Refreshing Strava token...');
  const response = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
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

Deno.serve(async (req) => {
  const headers = cors(req.headers.get('Origin'));
  if (req.method === 'OPTIONS') return new Response(null, { headers });

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || 'https://ojjpslrhyutizwpvvngu.supabase.co';
    const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9qanBzbHJoeXV0aXp3cHZ2bmd1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjIzMDI0NSwiZXhwIjoyMDcxODA2MjQ1fQ.Wm6AbiLNjIVM-T4a7TUhBMphb5EW9fMMLJC9-wSJNS4';
    const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9qanBzbHJoeXV0aXp3cHZ2bmd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYyMzAyNDUsImV4cCI6MjA3MTgwNjI0NX0.qsKY1YPBaphie0BwV71-kHcg73ZfKNuBUHR9yHO78zA';
    const STRAVA_CLIENT_ID = Deno.env.get('STRAVA_CLIENT_ID') || '174654';
    const STRAVA_CLIENT_SECRET = Deno.env.get('STRAVA_CLIENT_SECRET') || '1b87ab9bfbda09608bda2bdc9e5d2036f0ddfd6';

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

    // Get request body
    const body = await req.json();
    const { activityId } = body;

    if (!activityId) {
      return new Response(JSON.stringify({ error: 'Activity ID required' }), { status: 400, headers });
    }

    console.log('Transferring activity:', activityId, 'for user:', userId);

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
      .eq('user_id', userId)
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

    // Check if user_activities table exists, create if not
    const { error: tableCheckError } = await supabaseSrv
      .from('user_activities')
      .select('id')
      .limit(1);

    if (tableCheckError && tableCheckError.message.includes('does not exist')) {
      console.log('Creating user_activities table...');
      
      const createTableSQL = `
        CREATE TABLE IF NOT EXISTS public.user_activities (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id uuid NOT NULL,
          strava_activity_id bigint NOT NULL,
          name text NOT NULL,
          distance real DEFAULT 0,
          moving_time integer DEFAULT 0,
          activity_type text NOT NULL DEFAULT 'Run',
          start_date timestamptz NOT NULL DEFAULT now(),
          average_speed real DEFAULT 0,
          max_speed real DEFAULT 0,
          total_elevation_gain real DEFAULT 0,
          points_earned integer NOT NULL DEFAULT 0,
          polyline text,
          created_at timestamptz NOT NULL DEFAULT now(),
          UNIQUE(user_id, strava_activity_id)
        );
        
        ALTER TABLE public.user_activities ENABLE ROW LEVEL SECURITY;
        
        CREATE POLICY IF NOT EXISTS "Users can view their own activities"
        ON public.user_activities
        FOR SELECT
        USING (user_id::text = (SELECT id::text FROM public.profiles WHERE user_id = auth.uid()));

        CREATE POLICY IF NOT EXISTS "Users can insert their own activities"  
        ON public.user_activities
        FOR INSERT
        WITH CHECK (user_id::text = (SELECT id::text FROM public.profiles WHERE user_id = auth.uid()));
      `;

      try {
        const { error: createError } = await supabaseSrv.rpc('exec_sql', { sql: createTableSQL });
        if (createError) {
          console.warn('Table creation warning:', createError);
        } else {
          console.log('Table created successfully');
        }
      } catch (e) {
        console.warn('Table creation attempt failed:', e);
      }
    }

    // Insert activity into database
    const activityData = {
      user_id: userId,
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
      polyline: activity.map?.polyline || activity.map?.summary_polyline || null,
    };

    const { error: insertError } = await supabaseSrv
      .from('user_activities')
      .insert(activityData);

    if (insertError) {
      console.error('Database insert failed:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to save activity to database' }),
        { status: 500, headers }
      );
    }

    // Update user's total points - try direct update first
    try {
      const { error: pointsError } = await supabaseSrv
        .from('profiles')
        .update({ 
          total_points: `COALESCE(total_points, 0) + ${points}` 
        })
        .eq('user_id', userId);

      if (pointsError) {
        console.warn('Direct points update failed, trying RPC:', pointsError);
        
        // Try RPC function as fallback
        const { error: rpcError } = await supabaseSrv
          .rpc('increment_user_points', { 
            user_uuid: userId, 
            points_to_add: points 
          });
        
        if (rpcError) {
          console.warn('RPC points update also failed:', rpcError);
          // Still don't fail the entire request
        }
      } else {
        console.log(`Added ${points} points to user ${userId}`);
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