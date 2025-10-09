import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabaseUrl = 'https://ojjpslrhyutizwpvvngu.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9qanBzbHJoeXV0aXp3cHZ2bmd1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjIzMDI0NSwiZXhwIjoyMDcxODA2MjQ1fQ.Wm6AbiLNjIVM-T4a7TUhBMphb5EW9fMMLJC9-wSJNS4';

// Create admin client
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function executeSQL(sql) {
  try {
    // Use the Supabase Edge Functions to execute SQL
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'apikey': supabaseServiceKey
      },
      body: JSON.stringify({ sql })
    });

    if (response.ok) {
      return { success: true, data: await response.json() };
    } else {
      const error = await response.text();
      return { success: false, error };
    }
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function createDDLExecutor() {
  const ddlFunction = `
CREATE OR REPLACE FUNCTION public.exec_sql(sql_text text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  EXECUTE sql_text;
  RETURN 'OK';
EXCEPTION
  WHEN OTHERS THEN
    RETURN 'ERROR: ' || SQLERRM;
END;
$$;
`;

  console.log('🔄 Creating DDL executor function...');
  
  // Try to use a different approach - direct HTTP to PostgREST
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'apikey': supabaseServiceKey,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({ query: ddlFunction })
    });

    const responseText = await response.text();
    console.log('Response:', response.status, responseText);

    if (response.ok || response.status === 204) {
      console.log('✅ DDL executor created');
      return true;
    } else {
      console.log('❌ Failed to create DDL executor:', responseText);
      return false;
    }
  } catch (err) {
    console.log('❌ Error creating DDL executor:', err.message);
    return false;
  }
}

async function createLeagueFunctions() {
  // Read the functions migration file
  const functionsFile = path.join(__dirname, 'infra', 'supabase', 'migrations', '20250901170001_create_league_functions.sql');
  
  if (!fs.existsSync(functionsFile)) {
    console.log('❌ Functions migration file not found');
    return;
  }
  
  const sql = fs.readFileSync(functionsFile, 'utf8');
  
  console.log('🔄 Executing league functions migration...');
  
  // Split into individual statements and execute
  const statements = sql.split(';').filter(stmt => stmt.trim() && !stmt.trim().startsWith('--'));
  
  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i].trim() + ';';
    if (!statement || statement === ';') continue;
    
    console.log(`🔄 Executing statement ${i + 1}/${statements.length}`);
    
    try {
      const { data, error } = await supabase.rpc('exec_sql', { sql_text: statement });
      
      if (error) {
        console.log(`❌ Statement ${i + 1} failed:`, error.message);
        if (error.message.includes('already exists')) {
          console.log(`ℹ️  Statement ${i + 1} skipped (already exists)`);
        }
      } else if (data === 'OK') {
        console.log(`✅ Statement ${i + 1} executed successfully`);
      } else {
        console.log(`⚠️  Statement ${i + 1} result:`, data);
      }
    } catch (err) {
      console.log(`❌ Statement ${i + 1} exception:`, err.message);
    }
  }
}

async function main() {
  // First try to create DDL executor
  const ddlCreated = await createDDLExecutor();
  
  if (ddlCreated) {
    await createLeagueFunctions();
  } else {
    console.log('❌ Could not create DDL executor, trying direct approach...');
    
    // Try direct RPC calls to create just the essential functions
    const essentialFunctions = [
      {
        name: 'create_league',
        sql: `CREATE OR REPLACE FUNCTION public.create_league(p_name text, p_description text DEFAULT NULL, p_is_public boolean DEFAULT false, p_max_members integer DEFAULT 10) RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$ DECLARE league_record record; user_profile_id uuid; BEGIN SELECT id INTO user_profile_id FROM public.profiles WHERE user_id = auth.uid(); IF user_profile_id IS NULL THEN RETURN json_build_object('success', false, 'error', 'User profile not found'); END IF; INSERT INTO public.leagues (name, description, admin_user_id, is_public, max_members) VALUES (p_name, p_description, user_profile_id, p_is_public, p_max_members) RETURNING * INTO league_record; INSERT INTO public.league_members (league_id, user_id, status, approved_at, approved_by) VALUES (league_record.id, user_profile_id, 'approved', now(), user_profile_id); RETURN json_build_object('success', true, 'league_id', league_record.id, 'invite_code', league_record.invite_code); END; $$;`
      },
      {
        name: 'join_league', 
        sql: `CREATE OR REPLACE FUNCTION public.join_league(p_invite_code text) RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$ DECLARE league_record record; user_profile_id uuid; member_count integer; BEGIN SELECT id INTO user_profile_id FROM public.profiles WHERE user_id = auth.uid(); IF user_profile_id IS NULL THEN RETURN json_build_object('success', false, 'error', 'User profile not found'); END IF; SELECT * INTO league_record FROM public.leagues WHERE invite_code = p_invite_code; IF league_record IS NULL THEN RETURN json_build_object('success', false, 'error', 'League not found'); END IF; IF EXISTS (SELECT 1 FROM public.league_members WHERE league_id = league_record.id AND user_id = user_profile_id) THEN RETURN json_build_object('success', false, 'error', 'Already a member of this league'); END IF; SELECT COUNT(*) INTO member_count FROM public.league_members WHERE league_id = league_record.id AND status = 'approved'; IF member_count >= league_record.max_members THEN RETURN json_build_object('success', false, 'error', 'League is full'); END IF; INSERT INTO public.league_members (league_id, user_id, status) VALUES (league_record.id, user_profile_id, CASE WHEN league_record.is_public THEN 'approved' ELSE 'pending' END); RETURN json_build_object('success', true, 'league_id', league_record.id, 'league_name', league_record.name, 'status', CASE WHEN league_record.is_public THEN 'approved' ELSE 'pending' END); END; $$;`
      }
    ];
    
    for (const func of essentialFunctions) {
      console.log(`🔄 Creating function: ${func.name}`);
      
      // Try PostgREST direct SQL execution
      try {
        const response = await fetch(`${supabaseUrl}/rest/v1/rpc/query`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'apikey': supabaseServiceKey
          },
          body: JSON.stringify({ query: func.sql })
        });
        
        if (response.ok || response.status === 204) {
          console.log(`✅ Function ${func.name} created`);
        } else {
          const error = await response.text();
          console.log(`❌ Function ${func.name} failed:`, error);
        }
      } catch (err) {
        console.log(`❌ Function ${func.name} error:`, err.message);
      }
    }
  }
  
  // Finally, test if functions work
  console.log('🔄 Testing function availability...');
  await new Promise(resolve => setTimeout(resolve, 2000)); // Wait a bit
  
  try {
    const { data, error } = await supabase.rpc('create_league', { p_name: 'test' });
    if (error && !error.message.includes('User profile not found')) {
      console.log('❌ Function test failed:', error.message);
    } else {
      console.log('✅ Functions are available (test failed due to no auth, which is expected)');
    }
  } catch (err) {
    console.log('❌ Function test error:', err.message);
  }
}

main().catch(console.error);
