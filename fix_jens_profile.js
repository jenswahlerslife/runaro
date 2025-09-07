// Fix Jens profile - create missing profile row
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://ojjpslrhyutizwpvvngu.supabase.co";
const SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9qanBzbHJoeXV0aXp3cHZ2bmd1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjIzMDI0NSwiZXhwIjoyMDcxODA2MjQ1fQ.Wm6AbiLNjIVM-T4a7TUhBMphb5EW9fMMLJC9-wSJNS4";

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function fixJensProfile() {
  console.log('🔧 Fixing Jens profile...\n');
  
  try {
    // Get Jens auth user
    const { data: users, error: authError } = await supabase.auth.admin.listUsers();
    
    if (authError) {
      console.log('❌ Cannot get users:', authError.message);
      return;
    }
    
    const jensUser = users.users.find(u => u.email === 'jenswahlers@gmail.com');
    
    if (!jensUser) {
      console.log('❌ jenswahlers@gmail.com not found');
      return;
    }
    
    console.log('✅ Found Jens user:', jensUser.id);
    console.log('📋 Auth metadata:', JSON.stringify(jensUser.user_metadata, null, 2));
    
    // Create profile with correct data
    const profileData = {
      user_id: jensUser.id,
      username: jensUser.user_metadata?.username || 'jenner', // Use from metadata, fallback to jenner
      display_name: jensUser.user_metadata?.display_name || jensUser.user_metadata?.name || 'Jens wahlers',
      age: jensUser.user_metadata?.age || 26
    };
    
    console.log('\n📝 Creating profile with data:', JSON.stringify(profileData, null, 2));
    
    // Insert profile (use upsert to handle if it exists)
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .upsert(profileData, { 
        onConflict: 'user_id',
        ignoreDuplicates: false 
      })
      .select()
      .single();
    
    if (profileError) {
      console.log('❌ Profile creation error:', profileError.message);
      return;
    }
    
    console.log('✅ Profile created/updated successfully!');
    console.log('📋 Profile data:', JSON.stringify(profile, null, 2));
    
    // Test welcome message logic
    console.log('\n🎯 WELCOME MESSAGE TEST:');
    const welcomeMessage = profile?.username || jensUser?.user_metadata?.username || jensUser?.email?.split('@')[0] || 'gæst';
    console.log(`   Welcome message will now show: "${welcomeMessage}"`);
    
    if (welcomeMessage.toLowerCase() === 'jenner') {
      console.log('✅ SUCCESS! Welcome message will show your username!');
    } else {
      console.log('⚠️ Still not showing "jenner" - may need manual adjustment');
    }
    
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
}

fixJensProfile();