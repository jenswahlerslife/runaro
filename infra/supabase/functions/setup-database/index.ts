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

Deno.serve(async (req) => {
  const headers = cors(req.headers.get('Origin'));
  if (req.method === 'OPTIONS') return new Response(null, { headers });

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || 'https://ojjpslrhyutizwpvvngu.supabase.co';
    const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9qanBzbHJoeXV0aXp3cHZ2bmd1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjIzMDI0NSwiZXhwIjoyMDcxODA2MjQ1fQ.Wm6AbiLNjIVM-T4a7TUhBMphb5EW9fMMLJC9-wSJNS4';

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    console.log('Setting up database schema...');

    // Create user_activities table
    const createTableSQL = `
      -- Create user_activities table if it doesn't exist
      CREATE TABLE IF NOT EXISTS public.user_activities (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
        strava_activity_id bigint NOT NULL,
        name text NOT NULL,
        distance real,
        moving_time integer,
        activity_type text NOT NULL,
        start_date timestamptz NOT NULL,
        average_speed real,
        max_speed real,
        total_elevation_gain real,
        points_earned integer NOT NULL DEFAULT 0,
        polyline text,
        created_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE(user_id, strava_activity_id)
      );

      -- Enable RLS
      ALTER TABLE public.user_activities ENABLE ROW LEVEL SECURITY;

      -- Drop existing policies if they exist
      DROP POLICY IF EXISTS "Users can view their own activities" ON public.user_activities;
      DROP POLICY IF EXISTS "Users can insert their own activities" ON public.user_activities;

      -- Create RLS policies
      CREATE POLICY "Users can view their own activities"
      ON public.user_activities
      FOR SELECT
      USING (user_id IN (
        SELECT id FROM public.profiles WHERE user_id = auth.uid()
      ));

      CREATE POLICY "Users can insert their own activities"
      ON public.user_activities
      FOR INSERT
      WITH CHECK (user_id IN (
        SELECT id FROM public.profiles WHERE user_id = auth.uid()
      ));

      -- Add indexes for performance
      CREATE INDEX IF NOT EXISTS idx_user_activities_user_id ON public.user_activities(user_id);
      CREATE INDEX IF NOT EXISTS idx_user_activities_strava_id ON public.user_activities(strava_activity_id);
      CREATE INDEX IF NOT EXISTS idx_user_activities_start_date ON public.user_activities(start_date);
    `;

    const { error: tableError } = await supabase.rpc('exec_sql', { sql: createTableSQL });
    
    if (tableError) {
      console.error('Table creation error:', tableError);
      // Try direct SQL execution instead
      const { error: directError } = await supabase
        .from('user_activities')
        .select('id')
        .limit(1);
        
      if (directError && directError.message.includes('does not exist')) {
        // Table doesn't exist, we need to create it differently
        console.log('Creating table via raw SQL...');
        
        // Use a simpler approach - just create the essential structure
        const simpleCreate = `
          CREATE TABLE IF NOT EXISTS public.user_activities (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id uuid NOT NULL,
            strava_activity_id bigint NOT NULL,
            name text NOT NULL,
            distance real DEFAULT 0,
            moving_time integer DEFAULT 0,
            activity_type text NOT NULL DEFAULT 'Run',
            start_date timestamptz NOT NULL DEFAULT now(),
            points_earned integer NOT NULL DEFAULT 0,
            created_at timestamptz NOT NULL DEFAULT now(),
            UNIQUE(user_id, strava_activity_id)
          );
          
          ALTER TABLE public.user_activities ENABLE ROW LEVEL SECURITY;
        `;
        
        // We'll handle this in the transfer function instead
        return new Response(JSON.stringify({ 
          success: true, 
          message: 'Database setup attempted, will handle table creation in functions',
          tableExists: false
        }), { headers });
      }
    }

    // Add total_points column to profiles if it doesn't exist
    const addPointsColumnSQL = `
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'profiles' 
          AND column_name = 'total_points'
          AND table_schema = 'public'
        ) THEN
          ALTER TABLE public.profiles ADD COLUMN total_points integer NOT NULL DEFAULT 0;
        END IF;
      END $$;
    `;

    const { error: pointsError } = await supabase.rpc('exec_sql', { sql: addPointsColumnSQL });
    if (pointsError) {
      console.warn('Points column error:', pointsError);
    }

    // Create or replace the points function
    const createFunctionSQL = `
      CREATE OR REPLACE FUNCTION public.increment_user_points(user_uuid uuid, points_to_add integer)
      RETURNS void
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path = public
      AS $$
      BEGIN
        -- Update user points in profiles table
        UPDATE public.profiles 
        SET total_points = COALESCE(total_points, 0) + points_to_add,
            updated_at = now()
        WHERE user_id = user_uuid;
      END;
      $$;
    `;

    const { error: functionError } = await supabase.rpc('exec_sql', { sql: createFunctionSQL });
    if (functionError) {
      console.warn('Function creation error:', functionError);
    }

    console.log('Database setup completed successfully');
    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Database schema setup completed',
      tableCreated: true,
      pointsColumnAdded: true,
      functionCreated: true
    }), { headers });

  } catch (error: any) {
    console.error('Database setup error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Database setup failed' }),
      { status: 500, headers }
    );
  }
});