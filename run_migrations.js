import fetch from 'node-fetch';

const supabaseUrl = 'https://ojjpslrhyutizwpvvngu.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9qanBzbHJoeXV0aXp3cHZ2bmd1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjIzMDI0NSwiZXhwIjoyMDcxODA2MjQ1fQ.Wm6AbiLNjIVM-T4a7TUhBMphb5EW9fMMLJC9-wSJNS4';

// Use Supabase's SQL runner endpoint
async function executeSQL(sql) {
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'apikey': supabaseServiceKey
      },
      body: JSON.stringify({ query: sql })
    });

    const result = await response.text();
    
    if (response.ok) {
      console.log('✅ SQL executed successfully');
      return { success: true, result };
    } else {
      console.log('❌ SQL execution failed:', result);
      return { success: false, error: result };
    }
  } catch (err) {
    console.log('❌ Error executing SQL:', err.message);
    return { success: false, error: err.message };
  }
}

async function createFunctions() {
  // Essential league functions
  const functions = [
    {
      name: 'create_league',
      sql: `
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

GRANT EXECUTE ON FUNCTION public.create_league(text, text, boolean, integer) TO authenticated;
      `
    },
    {
      name: 'join_league',
      sql: `
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

GRANT EXECUTE ON FUNCTION public.join_league(text) TO authenticated;
      `
    }
  ];

  for (const func of functions) {
    console.log(`🔄 Creating function: ${func.name}`);
    const result = await executeSQL(func.sql);
    
    if (result.success) {
      console.log(`✅ Function ${func.name} created successfully`);
    } else {
      console.log(`❌ Failed to create function ${func.name}:`, result.error);
    }
    
    // Wait a bit between function creations
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

createFunctions().catch(console.error);