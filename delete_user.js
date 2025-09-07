// Script to delete user account
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://ojjpslrhyutizwpvvngu.supabase.co";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9qanBzbHJoeXV0aXp3cHZ2bmd1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcyNDY5MDY0NSwiZXhwIjoyMDQwMjY2NjQ1fQ.WJT3YGOtLd4r7FPEm9UfKBSy4UqZZSRmUCE4VzqQLyc";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const userEmail = "wahlers3@hotmail.com";

async function deleteUser() {
  try {
    console.log(`🔍 Looking for user: ${userEmail}`);
    
    // First, find the user in auth.users
    const { data: users, error: listError } = await supabase.auth.admin.listUsers();
    
    if (listError) {
      console.error('❌ Error listing users:', listError);
      return;
    }
    
    const user = users.users.find(u => u.email === userEmail);
    
    if (!user) {
      console.log('❌ User not found in auth system');
      return;
    }
    
    console.log('✅ Found user:', user.id, user.email);
    
    // Delete from profiles table first
    console.log('🗑️ Deleting from profiles table...');
    const { error: profileError } = await supabase
      .from('profiles')
      .delete()
      .eq('user_id', user.id);
    
    if (profileError) {
      console.warn('⚠️ Error deleting profile (might not exist):', profileError.message);
    } else {
      console.log('✅ Profile deleted');
    }
    
    // Delete from activities table
    console.log('🗑️ Deleting user activities...');
    const { error: activitiesError } = await supabase
      .from('activities')
      .delete()
      .eq('user_id', user.id);
    
    if (activitiesError) {
      console.warn('⚠️ Error deleting activities (might not exist):', activitiesError.message);
    } else {
      console.log('✅ Activities deleted');
    }
    
    // Delete from league memberships
    console.log('🗑️ Deleting league memberships...');
    const { error: membershipError } = await supabase
      .from('league_memberships')
      .delete()
      .eq('user_id', user.id);
    
    if (membershipError) {
      console.warn('⚠️ Error deleting memberships (might not exist):', membershipError.message);
    } else {
      console.log('✅ League memberships deleted');
    }
    
    // Finally, delete the user from auth
    console.log('🗑️ Deleting user from auth system...');
    const { error: authError } = await supabase.auth.admin.deleteUser(user.id);
    
    if (authError) {
      console.error('❌ Error deleting user from auth:', authError);
      return;
    }
    
    console.log('🎉 User completely deleted!');
    console.log(`✅ Account ${userEmail} has been removed from the system`);
    console.log('💡 You can now sign up again with the new setup');
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

// Run the deletion
deleteUser().then(() => {
  console.log('🏁 Script completed');
  process.exit(0);
}).catch(err => {
  console.error('💥 Script failed:', err);
  process.exit(1);
});