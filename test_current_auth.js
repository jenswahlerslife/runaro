// Test current auth configuration and try to enable email confirmation
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://ojjpslrhyutizwpvvngu.supabase.co";
const SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9qanBzbHJoeXV0aXp3cHZ2bmd1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjIzMDI0NSwiZXhwIjoyMDcxODA2MjQ1fQ.Wm6AbiLNjIVM-T4a7TUhBMphb5EW9fMMLJC9-wSJNS4";

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

console.log('🧪 Testing current Supabase Auth configuration...\n');

async function testAuthWithRealEmail() {
  console.log('1. 📧 Testing signup with real email domain...');
  
  try {
    // Use a real email domain for testing
    const testEmail = `test-${Date.now()}@gmail.com`;
    console.log(`   Testing email: ${testEmail}`);
    
    const { data, error } = await supabase.auth.signUp({
      email: testEmail,
      password: 'TestPassword123!',
      options: {
        data: {
          username: 'testuser',
          display_name: 'Test User',
          name: 'Test User',
          age: 25
        },
        emailRedirectTo: 'https://runaro.dk/auth'
      }
    });
    
    if (error) {
      console.log('   ❌ Signup failed:', error.message);
      
      // Check if it's a known user
      if (error.message.includes('User already registered')) {
        console.log('   ℹ️ User exists - trying different email');
        return await testAuthWithRealEmail(); // Retry with new timestamp
      }
      
      return { success: false, error: error.message };
    }
    
    console.log('   ✅ Signup successful!');
    console.log(`   User created: ${!!data.user}`);
    console.log(`   Session created: ${!!data.session}`);
    
    if (data.user && !data.session) {
      console.log('   🎯 EMAIL CONFIRMATION IS ACTIVE!');
      console.log('   📨 User needs to confirm email before logging in');
      
      // Clean up test user
      await supabase.auth.admin.deleteUser(data.user.id);
      console.log('   🧹 Test user cleaned up');
      
      return { 
        success: true, 
        needsConfirmation: true,
        message: 'Email confirmation is working - confirmation emails should be sent'
      };
    } else if (data.session) {
      console.log('   ⚠️ User auto-confirmed (no email confirmation needed)');
      
      // Clean up test user
      await supabase.auth.admin.deleteUser(data.user.id);
      console.log('   🧹 Test user cleaned up');
      
      return { 
        success: true, 
        needsConfirmation: false,
        message: 'Users are auto-confirmed - email confirmation is disabled'
      };
    }
    
    return { success: false, error: 'Unexpected signup result' };
    
  } catch (error) {
    console.log('   ❌ Test error:', error.message);
    return { success: false, error: error.message };
  }
}

async function checkExistingUsers() {
  console.log('\n2. 👥 Checking existing users...');
  
  try {
    const { data: users, error } = await supabase.auth.admin.listUsers();
    
    if (error) {
      console.log('   ❌ Could not list users:', error.message);
      return;
    }
    
    console.log(`   📊 Found ${users.users.length} existing users`);
    
    users.users.forEach((user, index) => {
      console.log(`   ${index + 1}. ${user.email} - Confirmed: ${!!user.email_confirmed_at}`);
    });
    
  } catch (error) {
    console.log('   ❌ Error:', error.message);
  }
}

async function main() {
  await checkExistingUsers();
  const testResult = await testAuthWithRealEmail();
  
  console.log('\n🏁 RESULTAT:');
  console.log('=============');
  
  if (testResult.success) {
    if (testResult.needsConfirmation) {
      console.log('🎉 PERFEKT! Email confirmation virker allerede!');
      console.log('\n✅ KONFIGURATION FÆRDIG:');
      console.log('   - Supabase Auth er korrekt konfigureret');
      console.log('   - Email confirmation er aktiveret');
      console.log('   - Bekræftelsesmails sendes automatisk');
      
      console.log('\n🚀 READY TO USE:');
      console.log('1. Gå til https://runaro.dk/auth');
      console.log('2. Opret bruger med din rigtige email');
      console.log('3. Tjek email for bekræftelseslink');
      console.log('4. Klik linket og log ind');
      console.log('5. Se "Velkommen [navn]!" på forsiden');
      
    } else {
      console.log('⚠️ Email confirmation er ikke aktiveret');
      console.log('Brugere bliver auto-confirmed uden email-bekræftelse');
      console.log('\nFor at aktivere email confirmation:');
      console.log('Gå til Supabase Dashboard og slå "Confirm email" til');
    }
  } else {
    console.log('❌ Der er problemer med Auth konfigurationen');
    console.log('Fejl:', testResult.error);
    console.log('\nKontroller Supabase Dashboard indstillinger');
  }
  
  console.log('\n🌐 Dashboard: https://supabase.com/dashboard/project/ojjpslrhyutizwpvngu');
}

main().catch(console.error);