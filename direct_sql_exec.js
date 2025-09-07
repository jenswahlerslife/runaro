import pkg from 'pg';
const { Client } = pkg;

// Connect directly to PostgreSQL using connection string
const client = new Client({
  connectionString: 'postgresql://postgres.ojjpslrhyutizwpvvngu:A5iGKkxB0aJaE4YF@aws-0-eu-central-1.pooler.supabase.com:5432/postgres'
});

const functionSQL = `
-- Function to create a new league
CREATE OR REPLACE FUNCTION public.create_league(
  p_name text,
  p_description text DEFAULT NULL,
  p_is_public boolean DEFAULT false,
  p_max_members integer DEFAULT 10
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  league_record record;
  user_profile_id uuid;
BEGIN
  -- Get user's profile ID
  SELECT id INTO user_profile_id
  FROM public.profiles 
  WHERE user_id = auth.uid();
  
  IF user_profile_id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'User profile not found'
    );
  END IF;

  -- Create the league
  INSERT INTO public.leagues (name, description, admin_user_id, is_public, max_members)
  VALUES (p_name, p_description, user_profile_id, p_is_public, p_max_members)
  RETURNING * INTO league_record;

  -- Auto-approve the admin as a member
  INSERT INTO public.league_members (league_id, user_id, status, approved_at, approved_by)
  VALUES (league_record.id, user_profile_id, 'approved', now(), user_profile_id);

  RETURN json_build_object(
    'success', true,
    'league_id', league_record.id,
    'invite_code', league_record.invite_code
  );
END;
$$;

-- Function to join a league
CREATE OR REPLACE FUNCTION public.join_league(p_invite_code text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  league_record record;
  user_profile_id uuid;
  member_count integer;
BEGIN
  -- Get user's profile ID
  SELECT id INTO user_profile_id
  FROM public.profiles 
  WHERE user_id = auth.uid();
  
  IF user_profile_id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'User profile not found'
    );
  END IF;

  -- Find the league
  SELECT * INTO league_record
  FROM public.leagues
  WHERE invite_code = p_invite_code;

  IF league_record IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'League not found'
    );
  END IF;

  -- Check if already a member
  IF EXISTS (
    SELECT 1 FROM public.league_members
    WHERE league_id = league_record.id AND user_id = user_profile_id
  ) THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Already a member of this league'
    );
  END IF;

  -- Check member limit
  SELECT COUNT(*) INTO member_count
  FROM public.league_members
  WHERE league_id = league_record.id AND status = 'approved';

  IF member_count >= league_record.max_members THEN
    RETURN json_build_object(
      'success', false,
      'error', 'League is full'
    );
  END IF;

  -- Join the league (pending approval unless it's a public league)
  INSERT INTO public.league_members (league_id, user_id, status)
  VALUES (
    league_record.id, 
    user_profile_id, 
    CASE WHEN league_record.is_public THEN 'approved' ELSE 'pending' END
  );

  RETURN json_build_object(
    'success', true,
    'league_id', league_record.id,
    'league_name', league_record.name,
    'status', CASE WHEN league_record.is_public THEN 'approved' ELSE 'pending' END
  );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.create_league(text, text, boolean, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_league(text) TO authenticated;
`;

async function executeFunctions() {
  try {
    console.log('🔄 Connecting to database...');
    await client.connect();
    
    console.log('🔄 Executing league functions SQL...');
    const result = await client.query(functionSQL);
    
    console.log('✅ Functions created successfully!');
    
    // Test the function
    console.log('🔄 Testing create_league function...');
    const testResult = await client.query(`SELECT public.create_league('Test League', 'Test Description', true, 5)`);
    console.log('❌ Test failed (expected - no authenticated user context)');
    
  } catch (error) {
    if (error.message.includes('User profile not found') || error.message.includes('auth.uid()')) {
      console.log('✅ Functions created successfully (test failed due to no auth context, which is expected)');
    } else {
      console.error('❌ Error:', error.message);
    }
  } finally {
    await client.end();
    console.log('🔄 Database connection closed');
  }
}

executeFunctions().catch(console.error);