-- Fix league_memberships view conflict and database errors
-- This handles the specific issues in the error logs

-- 1) Drop league_memberships table if it exists and create as view
DROP TABLE IF EXISTS public.league_memberships CASCADE;

-- Create league_memberships view to maintain compatibility with frontend code
CREATE OR REPLACE VIEW public.league_memberships AS
SELECT 
    league_id,
    user_id,
    role,
    joined_at
FROM public.league_members;

-- Grant permissions on the view
GRANT SELECT ON public.league_memberships TO authenticated;

-- 2) Ensure profiles table has correct structure for upsert operations
-- Check if profiles table exists and has the right constraints
DO $$ 
BEGIN
    -- Ensure profiles table exists with proper primary key
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'profiles') THEN
        CREATE TABLE public.profiles (
            id uuid PRIMARY KEY,
            user_id uuid UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
            username text,
            display_name text,
            age integer,
            created_at timestamptz DEFAULT now()
        );
    END IF;

    -- Ensure id is primary key and user_id is unique
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE table_name = 'profiles' AND constraint_type = 'PRIMARY KEY') THEN
        ALTER TABLE public.profiles ADD PRIMARY KEY (id);
    END IF;

    -- Enable RLS on profiles
    ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
    
    -- Drop and recreate profiles policies for clarity
    DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
    DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
    DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
    
    -- Allow users to manage their own profiles
    CREATE POLICY "Users can view own profile" ON public.profiles 
    FOR SELECT USING (auth.uid() = user_id);
    
    CREATE POLICY "Users can update own profile" ON public.profiles 
    FOR UPDATE USING (auth.uid() = user_id);
    
    CREATE POLICY "Users can insert own profile" ON public.profiles 
    FOR INSERT WITH CHECK (auth.uid() = user_id);
END $$;

-- 3) Ensure league_members has proper RLS policies
ALTER TABLE public.league_members ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "members_can_read_members_in_same_league" ON public.league_members;
DROP POLICY IF EXISTS "admins_can_insert_members_in_their_league" ON public.league_members;

-- Create policy: Members can see other members in same league
CREATE POLICY "members_can_read_members_in_same_league"
ON public.league_members
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.league_members lm2
    WHERE lm2.league_id = league_members.league_id
      AND lm2.user_id = auth.uid()
  )
);

-- Create policy: Admins/owners can insert new members
CREATE POLICY "admins_can_insert_members_in_their_league"
ON public.league_members
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.league_members lm
    WHERE lm.league_id = league_members.league_id
      AND lm.user_id = auth.uid()
      AND lm.role IN ('owner', 'admin')
  ) OR
  -- Allow initial owner creation during league creation
  NOT EXISTS (SELECT 1 FROM public.league_members WHERE league_id = league_members.league_id)
);

-- 4) Ensure league_join_requests has proper RLS policies
ALTER TABLE public.league_join_requests ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "users_can_read_own_requests" ON public.league_join_requests;
DROP POLICY IF EXISTS "admins_can_read_requests_in_their_league" ON public.league_join_requests;
DROP POLICY IF EXISTS "admins_can_update_requests_in_their_league" ON public.league_join_requests;
DROP POLICY IF EXISTS "user_can_create_own_join_request" ON public.league_join_requests;

-- Users can see their own requests
CREATE POLICY "users_can_read_own_requests"
ON public.league_join_requests
FOR SELECT
USING (user_id = auth.uid());

-- Admins/owners can see requests in their league
CREATE POLICY "admins_can_read_requests_in_their_league"
ON public.league_join_requests  
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.league_members lm
    WHERE lm.league_id = league_join_requests.league_id
      AND lm.user_id = auth.uid()
      AND lm.role IN ('owner', 'admin')
  )
);

-- Admins/owners can update join requests (approve/reject)
CREATE POLICY "admins_can_update_requests_in_their_league"
ON public.league_join_requests
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.league_members lm
    WHERE lm.league_id = league_join_requests.league_id
      AND lm.user_id = auth.uid()
      AND lm.role IN ('owner', 'admin')
  )
);

-- Users can create their own join request
CREATE POLICY "user_can_create_own_join_request"
ON public.league_join_requests
FOR INSERT
WITH CHECK (auth.uid() = user_id);

SELECT 'League system database fixes applied successfully' as status;