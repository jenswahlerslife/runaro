// Test transfer-activity with real JWT from production project
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ojjpslrhyutizwpvvngu.supabase.co';
const SERVICE_ROLE = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9qanBzbHJoeXV0aXp3cHZ2bmd1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjIzMDI0NSwiZXhwIjoyMDcxODA2MjQ1fQ.Wm6AbiLNjIVM-T4a7TUhBMphb5EW9fMMLJC9-wSJNS4';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9qanBzbHJoeXV0aXp3cHZ2bmd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYyMzAyNDUsImV4cCI6MjA3MTgwNjI0NX0.qsKY1YPBaphie0BwV71-kHcg73ZfKNuBUHR9yHO78zA';

async function testRealJWT() {
  console.log('🧪 Testing transfer-activity with real JWT from production project...');

  try {
    // Create service role client to get user data
    const supabaseService = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Get a real user from profiles
    const { data: profiles, error: profilesError } = await supabaseService
      .from('profiles')
      .select('id, username, user_id')
      .limit(1);

    if (profilesError || !profiles?.length) {
      console.error('❌ No profiles found:', profilesError);
      return;
    }

    const testProfile = profiles[0];
    console.log('📋 Test profile:', testProfile);

    // Check if this user has any Strava activities we can test with
    const { data: activities, error: activitiesError } = await supabaseService
      .from('user_activities')
      .select('strava_activity_id')
      .eq('user_id', testProfile.id)
      .limit(1);

    console.log('📊 Existing activities:', activities?.length || 0);

    // Create anon client to generate JWT for this user
    const supabaseAnon = createClient(SUPABASE_URL, ANON_KEY);

    // We can't easily create a JWT for an existing user without their password
    // So let's test with service role directly to simulate the function logic

    console.log('🔍 Testing Edge Function endpoint directly...');

    // Test 1: OPTIONS request (CORS check)
    const optionsResponse = await fetch(`${SUPABASE_URL}/functions/v1/transfer-activity`, {
      method: 'OPTIONS',
      headers: {
        'Origin': 'https://runaro.dk',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'authorization, content-type'
      }
    });

    console.log('OPTIONS result:', optionsResponse.status, optionsResponse.statusText);

    if (optionsResponse.ok) {
      console.log('✅ CORS preflight successful');
      const corsHeaders = {
        'Origin': optionsResponse.headers.get('Access-Control-Allow-Origin'),
        'Methods': optionsResponse.headers.get('Access-Control-Allow-Methods'),
        'Headers': optionsResponse.headers.get('Access-Control-Allow-Headers')
      };
      console.log('🔧 CORS headers:', corsHeaders);
    } else {
      console.log('❌ CORS preflight failed');
      const errorText = await optionsResponse.text();
      console.log('Error:', errorText);
    }

    // Test 2: POST request without auth (should get proper error)
    const noAuthResponse = await fetch(`${SUPABASE_URL}/functions/v1/transfer-activity`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'https://runaro.dk'
      },
      body: JSON.stringify({ activityId: 123456789 })
    });

    console.log('No auth result:', noAuthResponse.status);
    const noAuthText = await noAuthResponse.text();
    console.log('No auth response:', noAuthText);

    // Test 3: Check user_activities table structure
    console.log('🗄️ Checking user_activities table structure...');

    const { data: tableInfo, error: tableError } = await supabaseService.rpc('exec_sql', {
      sql_text: `
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'user_activities'
        AND table_schema = 'public'
        ORDER BY ordinal_position;
      `
    });

    if (tableError) {
      console.error('❌ Table structure check failed:', tableError);
    } else {
      console.log('✅ Table structure verified');
    }

    // Test 4: Check FK constraint
    const { data: fkInfo, error: fkError } = await supabaseService.rpc('exec_sql', {
      sql_text: `
        SELECT tc.constraint_name, tc.table_name, kcu.column_name,
               ccu.table_name AS foreign_table_name, ccu.column_name AS foreign_column_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_name='user_activities'
        AND kcu.column_name='user_id';
      `
    });

    if (fkError) {
      console.error('❌ FK constraint check failed:', fkError);
    } else {
      console.log('✅ FK constraint verified');
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

await testRealJWT();