// Delete wahlers3@hotmail.com user and all associated data
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://ojjpslrhyutizwpvvngu.supabase.co";
const SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9qanBzbHJoeXV0aXp3cHZ2bmd1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjIzMDI0NSwiZXhwIjoyMDcxODA2MjQ1fQ.Wm6AbiLNjIVM-T4a7TUhBMphb5EW9fMMLJC9-wSJNS4";

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const targetEmail = 'wahlers3@hotmail.com';

console.log(`🗑️ Sletter bruger: ${targetEmail}\n`);

async function deleteUser() {
  try {
    console.log('1. 🔍 Finding user...');
    
    const { data: users, error: listError } = await supabase.auth.admin.listUsers();
    
    if (listError) {
      console.log('   ❌ Cannot list users:', listError.message);
      return false;
    }
    
    const user = users.users.find(u => u.email === targetEmail);
    
    if (!user) {
      console.log('   ℹ️ User not found - already deleted or never existed');
      return true;
    }
    
    console.log(`   ✅ User found: ${user.id}`);
    console.log(`   📅 Created: ${user.created_at}`);
    console.log(`   ✉️ Confirmed: ${user.email_confirmed_at ? 'Yes' : 'No'}`);
    
    console.log('\n2. 🧹 Deleting associated data...');
    
    // Delete from profiles table
    const { error: profileError } = await supabase
      .from('profiles')
      .delete()
      .eq('user_id', user.id);
    
    if (profileError) {
      console.log(`   ⚠️ Profile deletion warning: ${profileError.message}`);
    } else {
      console.log('   ✅ Profile data deleted');
    }
    
    // Delete from activities table
    const { error: activitiesError } = await supabase
      .from('activities')
      .delete()
      .eq('user_id', user.id);
    
    if (activitiesError) {
      console.log(`   ⚠️ Activities deletion warning: ${activitiesError.message}`);
    } else {
      console.log('   ✅ Activities data deleted');
    }
    
    // Delete from league memberships
    const { error: membershipError } = await supabase
      .from('league_memberships')
      .delete()
      .eq('user_id', user.id);
    
    if (membershipError) {
      console.log(`   ⚠️ Membership deletion warning: ${membershipError.message}`);
    } else {
      console.log('   ✅ League memberships deleted');
    }
    
    console.log('\n3. 🗑️ Deleting auth user...');
    
    const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id);
    
    if (deleteError) {
      console.log(`   ❌ Failed to delete user: ${deleteError.message}`);
      return false;
    }
    
    console.log(`   ✅ User ${targetEmail} successfully deleted!`);
    return true;
    
  } catch (error) {
    console.log('   ❌ Deletion error:', error.message);
    return false;
  }
}

async function verifyDeletion() {
  console.log('\n4. ✅ Verifying deletion...');
  
  try {
    const { data: users, error } = await supabase.auth.admin.listUsers();
    
    if (error) {
      console.log('   ❌ Cannot verify:', error.message);
      return;
    }
    
    console.log(`   📊 Total users remaining: ${users.users.length}`);
    
    const targetStillExists = users.users.find(u => u.email === targetEmail);
    
    if (!targetStillExists) {
      console.log(`   🎉 ${targetEmail} successfully deleted!`);
      console.log('   ✅ User can now be recreated');
    } else {
      console.log(`   ❌ ${targetEmail} still exists`);
    }
    
    if (users.users.length > 0) {
      console.log('\n   👥 Remaining users:');
      users.users.forEach((user, index) => {
        console.log(`   ${index + 1}. ${user.email} - ${user.email_confirmed_at ? 'Confirmed' : 'Unconfirmed'}`);
      });
    }
    
  } catch (error) {
    console.log('   ❌ Verification error:', error.message);
  }
}

// Main execution
async function main() {
  const deleted = await deleteUser();
  await verifyDeletion();
  
  console.log('\n🏁 RESULTAT:');
  console.log('=============');
  
  if (deleted) {
    console.log(`✅ ${targetEmail} er slettet!`);
    console.log('\n🚀 Du kan nu:');
    console.log('1. Gå til https://runaro.dk/auth');
    console.log('2. Klik "Sign Up"');
    console.log('3. Brug wahlers3@hotmail.com');
    console.log('4. Udfyld username, navn, og alder');
    console.log('5. Tjek email for bekræftelseslink');
    console.log('6. Verificér at linket peger til https://runaro.dk/auth');
    console.log('7. Klik linket og log ind');
    
  } else {
    console.log('❌ Sletning mislykkedes');
    console.log('Tjek fejlbeskeder ovenfor');
  }
}

main().catch(console.error);