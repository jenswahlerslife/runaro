// Fix Jens profile - simple version without age
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://ojjpslrhyutizwpvvngu.supabase.co";
const SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9qanBzbHJoeXV0aXp3cHZ2bmd1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjIzMDI0NSwiZXhwIjoyMDcxODA2MjQ1fQ.Wm6AbiLNjIVM-T4a7TUhBMphb5EW9fMMLJC9-wSJNS4";

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function fixJensProfile() {
  console.log('🔧 Creating Jens profile (simple)...\n');
  
  try {
    // Get Jens auth user
    const { data: users, error: authError } = await supabase.auth.admin.listUsers();
    const jensUser = users.users.find(u => u.email === 'jenswahlers@gmail.com');
    
    if (!jensUser) {
      console.log('❌ jenswahlers@gmail.com not found');
      return;
    }
    
    console.log('✅ Found user with metadata:', jensUser.user_metadata);
    
    // Create profile with just the essential fields
    const profileData = {
      user_id: jensUser.id,
      username: 'jenner',  // Lowercase as requested
      display_name: jensUser.user_metadata?.display_name || 'Jens wahlers'
    };
    
    console.log('📝 Creating profile:', profileData);
    
    // Insert profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .upsert(profileData, { 
        onConflict: 'user_id',
        ignoreDuplicates: false 
      })
      .select()
      .single();
    
    if (profileError) {
      console.log('❌ Profile error:', profileError.message);
      return;
    }
    
    console.log('✅ Profile created:', profile);
    
    // Test the welcome message logic
    const welcomeMessage = profile?.username || jensUser?.user_metadata?.username || jensUser?.email?.split('@')[0] || 'gæst';
    console.log(`\n🎯 Welcome message will show: "${welcomeMessage}"`);
    
    if (welcomeMessage === 'jenner') {
      console.log('🎉 PERFECT! Welcome message will now show "jenner"!');
    }
    
  } catch (error) {
    console.log('❌ Error:', error.message);
  }
}

fixJensProfile();