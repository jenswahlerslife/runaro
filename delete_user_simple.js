// Simple script to delete user data from profiles table
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://ojjpslrhyutizwpvvngu.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9qanBzbHJoeXV0aXp3cHZ2bmd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYyMzAyNDUsImV4cCI6MjA3MTgwNjI0NX0.qsKY1YPBaphie0BwV71-kHcg73ZfKNuBUHR9yHO78zA";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const userEmail = "wahlers3@hotmail.com";

async function searchAndDeleteUserData() {
  try {
    console.log(`🔍 Searching for user data with email: ${userEmail}`);
    
    // Try to find profiles by looking for user metadata or username patterns
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('*');
    
    if (profilesError) {
      console.error('❌ Error fetching profiles:', profilesError);
      return;
    }
    
    console.log(`📊 Found ${profiles.length} profiles total`);
    
    if (profiles.length > 0) {
      console.log('👥 Profiles found:');
      profiles.forEach((profile, index) => {
        console.log(`  ${index + 1}. ID: ${profile.id}, User ID: ${profile.user_id}, Username: ${profile.username}, Display Name: ${profile.display_name}`);
      });
    }
    
    // Since we can't easily match by email without service key, 
    // let's try a different approach using SQL function
    console.log('\n💡 To completely delete the user account, you need to:');
    console.log('1. Sign out from the current session on the website');
    console.log('2. Try to sign up with the same email again');
    console.log('3. If it says "User already exists", the auth user still exists');
    console.log('4. You may need to use the Supabase dashboard to delete the user manually');
    console.log('\nOr we can try a direct database approach...');
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

// Run the search
searchAndDeleteUserData().then(() => {
  console.log('\n🏁 Search completed');
  process.exit(0);
}).catch(err => {
  console.error('💥 Script failed:', err);
  process.exit(1);
});