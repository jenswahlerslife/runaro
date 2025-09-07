// Script to delete existing users so they can be recreated
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://ojjpslrhyutizwpvvngu.supabase.co";
const SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9qanBzbHJoeXV0aXp3cHZ2bmd1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjIzMDI0NSwiZXhwIjoyMDcxODA2MjQ1fQ.Wm6AbiLNjIVM-T4a7TUhBMphb5EW9fMMLJC9-wSJNS4";

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const usersToDelete = [
  'jenswahlers@gmail.com',
  'wahlers3@hotmail.com'
];

console.log('🗑️ Deleting existing users for fresh signup testing...\n');

async function deleteExistingUsers() {
  try {
    console.log('1. 📋 Listing current users...');
    
    const { data: users, error: listError } = await supabase.auth.admin.listUsers();
    
    if (listError) {
      console.log('   ❌ Could not list users:', listError.message);
      return false;
    }
    
    console.log(`   📊 Found ${users.users.length} total users`);
    
    for (const targetEmail of usersToDelete) {
      const user = users.users.find(u => u.email === targetEmail);
      
      if (user) {
        console.log(`\n2. 🗑️ Deleting user: ${targetEmail}`);
        console.log(`   User ID: ${user.id}`);
        console.log(`   Created: ${user.created_at}`);
        console.log(`   Confirmed: ${user.email_confirmed_at ? 'Yes' : 'No'}`);
        
        // Delete from profiles table first (if exists)
        const { error: profileError } = await supabase
          .from('profiles')
          .delete()
          .eq('user_id', user.id);
        
        if (profileError) {
          console.log(`   ⚠️ Profile deletion warning: ${profileError.message}`);
        } else {
          console.log('   ✅ Profile data deleted');
        }
        
        // Delete from activities table (if exists)
        const { error: activitiesError } = await supabase
          .from('activities')
          .delete()
          .eq('user_id', user.id);
        
        if (activitiesError) {
          console.log(`   ⚠️ Activities deletion warning: ${activitiesError.message}`);
        } else {
          console.log('   ✅ Activities data deleted');
        }
        
        // Delete from league memberships (if exists)
        const { error: membershipError } = await supabase
          .from('league_memberships')
          .delete()
          .eq('user_id', user.id);
        
        if (membershipError) {
          console.log(`   ⚠️ Membership deletion warning: ${membershipError.message}`);
        } else {
          console.log('   ✅ League memberships deleted');
        }
        
        // Finally delete the auth user
        const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id);
        
        if (deleteError) {
          console.log(`   ❌ Failed to delete user: ${deleteError.message}`);
        } else {
          console.log(`   ✅ User ${targetEmail} successfully deleted!`);
        }
        
      } else {
        console.log(`\n2. ℹ️ User ${targetEmail} not found (already deleted or never existed)`);
      }
    }
    
    return true;
    
  } catch (error) {
    console.log('   ❌ Deletion error:', error.message);
    return false;
  }
}

async function verifyDeletion() {
  console.log('\n3. ✅ Verifying deletion...');
  
  try {
    const { data: users, error } = await supabase.auth.admin.listUsers();
    
    if (error) {
      console.log('   ❌ Could not verify:', error.message);
      return;
    }
    
    console.log(`   📊 Remaining users: ${users.users.length}`);
    
    const remainingTargetUsers = users.users.filter(u => 
      usersToDelete.includes(u.email)
    );
    
    if (remainingTargetUsers.length === 0) {
      console.log('   🎉 All target users successfully deleted!');
      console.log('\n   📧 Users that can now be recreated:');
      usersToDelete.forEach(email => {
        console.log(`   - ${email} ✅`);
      });
    } else {
      console.log('   ⚠️ Some users still remain:');
      remainingTargetUsers.forEach(user => {
        console.log(`   - ${user.email} (ID: ${user.id})`);
      });
    }
    
    if (users.users.length > 0) {
      console.log('\n   👥 Other users in system:');
      users.users
        .filter(u => !usersToDelete.includes(u.email))
        .forEach(user => {
          console.log(`   - ${user.email}`);
        });
    }
    
  } catch (error) {
    console.log('   ❌ Verification error:', error.message);
  }
}

// Main execution
async function main() {
  const deleted = await deleteExistingUsers();
  await verifyDeletion();
  
  console.log('\n🏁 RESULTAT:');
  console.log('=============');
  
  if (deleted) {
    console.log('✅ Brugersletning gennemført!');
    console.log('\n🚀 Du kan nu oprette disse brugere igen:');
    usersToDelete.forEach(email => {
      console.log(`   - ${email}`);
    });
    
    console.log('\n📝 Næste skridt:');
    console.log('1. Gå til https://runaro.dk/auth');
    console.log('2. Klik "Sign Up"');
    console.log('3. Brug en af de slettede email-adresser');
    console.log('4. Udfyld username, navn, og alder');
    console.log('5. Tjek email for bekræftelseslink');
    console.log('6. Klik linket og log ind');
    
  } else {
    console.log('❌ Der opstod problemer under sletning');
    console.log('Tjek fejlbeskeder ovenfor');
  }
}

main().catch(console.error);