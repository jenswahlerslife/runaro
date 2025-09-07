import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ojjpslrhyutizwpvvngu.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9qanBzbHJoeXV0aXp3cHZ2bmd1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjIzMDI0NSwiZXhwIjoyMDcxODA2MjQ1fQ.Wm6AbiLNjIVM-T4a7TUhBMphb5EW9fMMLJC9-wSJNS4';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// First, let's create a simple DDL execution function
const createDDLFunction = `
CREATE OR REPLACE FUNCTION public.execute_ddl(sql_text text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  EXECUTE sql_text;
  RETURN 'SUCCESS';
EXCEPTION
  WHEN OTHERS THEN
    RETURN 'ERROR: ' || SQLERRM;
END;
$$;

GRANT EXECUTE ON FUNCTION public.execute_ddl(text) TO service_role;
`;

// The create_league function
const createLeagueFunction = `
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
`;

async function createFunctions() {
  console.log('🔄 Creating DDL execution function...');
  
  try {
    // Use the PostgREST admin API to execute raw SQL
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'apikey': supabaseServiceKey,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        query: createDDLFunction
      })
    });

    if (!response.ok) {
      // Try alternative approach - let's just copy the SQL and run it manually
      console.log('❌ Direct SQL execution failed. Here is the SQL to run manually:');
      console.log('\n=== RUN THIS SQL IN SUPABASE SQL EDITOR ===');
      console.log(createLeagueFunction);
      console.log('=== END SQL ===\n');
      
      console.log('Please:');
      console.log('1. Go to https://supabase.com/dashboard/project/ojjpslrhyutizwpvvngu/sql/new');
      console.log('2. Copy and paste the SQL above');
      console.log('3. Click "RUN" to execute it');
      
      return;
    }

    console.log('✅ DDL function created, now creating league functions...');
    
    const { data, error } = await supabase.rpc('execute_ddl', { 
      sql_text: createLeagueFunction 
    });
    
    if (error) {
      console.log('❌ Error creating league function:', error);
    } else {
      console.log('✅ League function created successfully:', data);
    }

  } catch (err) {
    console.error('❌ Exception:', err);
    
    console.log('\n=== MANUAL SQL TO RUN ===');
    console.log(createDDLFunction);
    console.log('\n--- THEN RUN ---\n');
    console.log(createLeagueFunction);
    console.log('=== END MANUAL SQL ===');
  }
}

createFunctions().catch(console.error);