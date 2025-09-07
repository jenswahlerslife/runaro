import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://ojjpslrhyutizwpvvngu.supabase.co";
const serviceRoleKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9qanBzbHJoeXV0aXp3cHZ2bmd1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjIzMDI0NSwiZXhwIjoyMDcxODA2MjQ1fQ.Wm6AbiLNjIVM-T4a7TUhBMphb5EW9fMMLJC9-wSJNS4";

const supabase = createClient(supabaseUrl, serviceRoleKey);

console.log("🔍 Testing database and fixing league functions...");

async function fixLeagueIssue() {
  try {
    // Test create_league function
    const { error } = await supabase.rpc("create_league", { p_name: "Test League" });
    
    if (error && error.message.includes("Could not find the function")) {
      console.log("❌ League functions MISSING - Creating them now...");
      
      const createLeagueSQL = `CREATE OR REPLACE FUNCTION public.create_league(p_name text, p_description text DEFAULT NULL, p_is_public boolean DEFAULT false, p_max_members integer DEFAULT 10) RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$ DECLARE league_record record; user_profile_id uuid; BEGIN SELECT id INTO user_profile_id FROM public.profiles WHERE user_id = auth.uid(); IF user_profile_id IS NULL THEN RETURN json_build_object('success', false, 'error', 'User profile not found'); END IF; INSERT INTO public.leagues (name, description, admin_user_id, is_public, max_members) VALUES (p_name, p_description, user_profile_id, p_is_public, p_max_members) RETURNING * INTO league_record; INSERT INTO public.league_members (league_id, user_id, status, approved_at, approved_by) VALUES (league_record.id, user_profile_id, 'approved', now(), user_profile_id); RETURN json_build_object('success', true, 'league_id', league_record.id, 'invite_code', league_record.invite_code); END; $$; GRANT EXECUTE ON FUNCTION public.create_league(text, text, boolean, integer) TO authenticated;`;
      
      const joinLeagueSQL = `CREATE OR REPLACE FUNCTION public.join_league(p_invite_code text) RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$ DECLARE league_record record; user_profile_id uuid; member_count integer; BEGIN SELECT id INTO user_profile_id FROM public.profiles WHERE user_id = auth.uid(); IF user_profile_id IS NULL THEN RETURN json_build_object('success', false, 'error', 'User profile not found'); END IF; SELECT * INTO league_record FROM public.leagues WHERE invite_code = p_invite_code; IF league_record IS NULL THEN RETURN json_build_object('success', false, 'error', 'League not found'); END IF; IF EXISTS (SELECT 1 FROM public.league_members WHERE league_id = league_record.id AND user_id = user_profile_id) THEN RETURN json_build_object('success', false, 'error', 'Already a member of this league'); END IF; SELECT COUNT(*) INTO member_count FROM public.league_members WHERE league_id = league_record.id AND status = 'approved'; IF member_count >= league_record.max_members THEN RETURN json_build_object('success', false, 'error', 'League is full'); END IF; INSERT INTO public.league_members (league_id, user_id, status) VALUES (league_record.id, user_profile_id, CASE WHEN league_record.is_public THEN 'approved' ELSE 'pending' END); RETURN json_build_object('success', true, 'league_id', league_record.id, 'league_name', league_record.name, 'status', CASE WHEN league_record.is_public THEN 'approved' ELSE 'pending' END); END; $$; GRANT EXECUTE ON FUNCTION public.join_league(text) TO authenticated;`;
      
      // Try direct creation
      for (const sql of [createLeagueSQL, joinLeagueSQL]) {
        try {
          const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${serviceRoleKey}`,
              "apikey": serviceRoleKey
            },
            body: JSON.stringify({ sql })
          });
          
          if (response.ok) {
            console.log("✅ Function created");
          } else {
            console.log("❌ Function creation failed");
          }
        } catch (err) {
          console.log("❌ Error:", err.message);
        }
      }
      
      // Test again
      const { error: testError } = await supabase.rpc("create_league", { p_name: "test" });
      if (testError && testError.message.includes("User profile not found")) {
        console.log("✅ SUCCESS\! Functions created - League page will now work\!");
      } else {
        console.log("❌ Still have issues:", testError?.message);
      }
    } else if (error && error.message.includes("User profile not found")) {
      console.log("✅ League functions already exist and working\!");
    } else {
      console.log("❌ Other error:", error?.message || "Unknown");
    }
  } catch (err) {
    console.log("❌ Test failed:", err.message);
  }
}

fixLeagueIssue().catch(console.error);
