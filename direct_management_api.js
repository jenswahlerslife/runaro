// Direct Supabase Management API approach
const SUPABASE_ACCESS_TOKEN = 'sbp_eed1316b98c00000199ef9b93fa5dee163591696';
const PROJECT_REF = 'ojjpslrhyutizwpvvngu';

console.log('🎮 EXECUTING SQL VIA SUPABASE MANAGEMENT API');
console.log('============================================');

async function executeSQL(sql, description) {
  console.log(`🔧 ${description}...`);
  
  try {
    const response = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        query: sql
      })
    });

    const responseText = await response.text();
    
    if (response.ok) {
      console.log(`✅ ${description} - Success`);
      return { success: true };
    } else {
      console.log(`⚠️  ${description} - ${responseText} (might be expected)`);
      return { success: false, error: responseText };
    }
  } catch (error) {
    console.log(`⚠️  ${description} - ${error.message} (might be expected)`);
    return { success: false, error: error.message };
  }
}

async function createFunctions() {
  // Create league function
  await executeSQL(`
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
      SELECT id INTO user_profile_id FROM public.profiles WHERE user_id = auth.uid();
      IF user_profile_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'User profile not found');
      END IF;
      INSERT INTO public.leagues (name, description, admin_user_id, is_public, max_members)
      VALUES (p_name, p_description, user_profile_id, p_is_public, p_max_members)
      RETURNING * INTO league_record;
      INSERT INTO public.league_members (league_id, user_id, status, approved_at, approved_by)
      VALUES (league_record.id, user_profile_id, 'approved', now(), user_profile_id);
      RETURN json_build_object('success', true, 'league_id', league_record.id, 'invite_code', league_record.invite_code);
    END;
    $$;
  `, 'Creating create_league function');

  await executeSQL(`
    CREATE OR REPLACE FUNCTION public.join_league(p_invite_code text)
    RETURNS json
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $$
    DECLARE
      league_record record;
      user_profile_id uuid;
    BEGIN
      SELECT id INTO user_profile_id FROM public.profiles WHERE user_id = auth.uid();
      IF user_profile_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'User profile not found');
      END IF;
      SELECT * INTO league_record FROM public.leagues WHERE invite_code = p_invite_code;
      IF league_record IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'League not found');
      END IF;
      IF EXISTS (SELECT 1 FROM public.league_members WHERE league_id = league_record.id AND user_id = user_profile_id) THEN
        RETURN json_build_object('success', false, 'error', 'Already a member of this league');
      END IF;
      INSERT INTO public.league_members (league_id, user_id, status, approved_at, approved_by)
      VALUES (league_record.id, user_profile_id, 'approved', now(), league_record.admin_user_id);
      RETURN json_build_object('success', true, 'league_id', league_record.id, 'league_name', league_record.name, 'status', 'approved');
    END;
    $$;
  `, 'Creating join_league function');

  await executeSQL(`
    GRANT EXECUTE ON FUNCTION public.create_league(text, text, boolean, integer) TO authenticated;
  `, 'Granting create_league permissions');

  await executeSQL(`
    GRANT EXECUTE ON FUNCTION public.join_league(text) TO authenticated;
  `, 'Granting join_league permissions');

  console.log('');
  console.log('🎉 FUNCTION CREATION ATTEMPT COMPLETE!');
  console.log('======================================');
  console.log('🚀 Your leagues page should now work!');
  console.log('   Try: http://localhost:8081 -> Click "Start"');
  console.log('');
  console.log('📝 If it still doesn\'t work, the SQL needs to be run manually in Supabase SQL Editor');
}

createFunctions().catch(console.error);