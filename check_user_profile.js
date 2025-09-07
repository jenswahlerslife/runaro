// Check specific user profile data
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://ojjpslrhyutizwpvvngu.supabase.co";
const SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9qanBzbHJoeXV0aXp3cHZ2bmd1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjIzMDI0NSwiZXhwIjoyMDcxODA2MjQ1fQ.Wm6AbiLNjIVM-T4a7TUhBMphb5EW9fMMLJC9-wSJNS4";

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function checkJensProfile() {
  console.log('🔍 Checking jenswahlers@gmail.com profile data...\n');
  
  try {
    // Get auth user
    const { data: users, error: authError } = await supabase.auth.admin.listUsers();
    
    if (authError) {
      console.log('❌ Cannot get users:', authError.message);
      return;
    }
    
    const jensUser = users.users.find(u => u.email === 'jenswahlers@gmail.com');
    
    if (!jensUser) {
      console.log('❌ jenswahlers@gmail.com not found in auth users');
      return;
    }
    
    console.log('✅ Auth User Data:');
    console.log(`   Email: ${jensUser.email}`);
    console.log(`   User ID: ${jensUser.id}`);
    console.log(`   Confirmed: ${!!jensUser.email_confirmed_at}`);
    console.log(`   Created: ${jensUser.created_at}`);
    console.log(`   User Metadata:`, JSON.stringify(jensUser.user_metadata, null, 2));
    
    // Get profile data
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', jensUser.id)
      .single();
    
    if (profileError) {
      console.log(`\n❌ Profile error: ${profileError.message}`);
    } else {
      console.log('\n✅ Profile Data:');
      console.log(`   Username: "${profile.username}"`);
      console.log(`   Display Name: "${profile.display_name}"`);
      console.log(`   Age: ${profile.age}`);
      console.log(`   Created: ${profile.created_at}`);
      console.log(`   Updated: ${profile.updated_at}`);
    }
    
    // Show what the welcome message currently shows
    console.log('\n🎯 WELCOME MESSAGE ANALYSIS:');
    const currentLogic = profile?.username || jensUser?.user_metadata?.username || jensUser?.email?.split('@')[0] || 'gæst';
    console.log(`   Current logic would show: "${currentLogic}"`);
    console.log(`   Should show: "jenner"`);
    
    if (currentLogic !== 'jenner') {
      console.log('\n🔧 PROBLEM IDENTIFIED:');
      if (!profile?.username) {
        console.log(`   Profile username is: ${profile?.username}`);
        console.log(`   Auth metadata username is: ${jensUser?.user_metadata?.username}`);
        console.log(`   Falling back to email prefix: ${jensUser?.email?.split('@')[0]}`);
      }
    } else {
      console.log('\n✅ Should work correctly!');
    }
    
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
}

checkJensProfile();