// Test if Site URL is properly configured for confirmation emails
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://ojjpslrhyutizwpvvngu.supabase.co";
const SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9qanBzbHJoeXV0aXp3cHZ2bmd1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjIzMDI0NSwiZXhwIjoyMDcxODA2MjQ1fQ.Wm6AbiLNjIVM-T4a7TUhBMphb5EW9fMMLJC9-wSJNS4";

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

console.log('🧪 Tester Site URL konfiguration...\n');

async function testRealSignup() {
  console.log('1. 📧 Opret test bruger for at verificere Site URL...');
  
  try {
    // Use a real Gmail address for more realistic testing
    const testEmail = `jens.test.${Date.now()}@gmail.com`;
    console.log(`   Test email: ${testEmail}`);
    
    const { data, error } = await supabase.auth.signUp({
      email: testEmail,
      password: 'TestPassword123!',
      options: {
        data: {
          username: 'jenstest',
          display_name: 'Jens Test',
          age: 30
        },
        emailRedirectTo: 'https://runaro.dk/auth'
      }
    });
    
    if (error) {
      console.log('   ❌ Signup failed:', error.message);
      return false;
    }
    
    console.log('   ✅ Test signup successful!');
    console.log(`   User ID: ${data.user?.id}`);
    console.log(`   Needs confirmation: ${!data.session && !!data.user}`);
    
    if (!data.session && data.user) {
      console.log('   🎯 EMAIL SENDT!');
      console.log('   📨 Bekræftelsesmail er sendt til:', testEmail);
      console.log('   📧 Tjek din email (inkl. spam folder)');
      console.log('   🔗 Bekræftelseslinket burde pege på: https://runaro.dk/auth');
      console.log('   ⚠️  IKKE localhost:3000!');
      
      console.log('\n   🔍 MANUEL VERIFICATION PÅKRÆVET:');
      console.log('   1. Tjek emailen som blev sendt');
      console.log('   2. Ser bekræftelseslinket rigtigt ud?');
      console.log('   3. Peger det på https://runaro.dk/auth?');
      console.log('   4. Hvis JA - så er problemet løst! 🎉');
      console.log('   5. Hvis NEJ - så skal vi til Supabase Dashboard');
      
      console.log('\n   🧹 Vil du slette denne test bruger? (Y/n)');
      console.log(`   Bruger ID til sletning: ${data.user.id}`);
      console.log(`   Email til sletning: ${testEmail}`);
      
      return { success: true, userId: data.user.id, email: testEmail };
    } else {
      console.log('   ⚠️ Unexpected: User was auto-confirmed');
      return false;
    }
    
  } catch (error) {
    console.log('   ❌ Test error:', error.message);
    return false;
  }
}

async function checkCurrentUsers() {
  console.log('\n2. 👥 Current users in system...');
  
  try {
    const { data: users, error } = await supabase.auth.admin.listUsers();
    
    if (error) {
      console.log('   ❌ Cannot list users:', error.message);
      return;
    }
    
    console.log(`   📊 Total users: ${users.users.length}`);
    
    users.users.forEach((user, index) => {
      console.log(`   ${index + 1}. ${user.email} - Confirmed: ${!!user.email_confirmed_at} - Created: ${user.created_at}`);
    });
    
  } catch (error) {
    console.log('   ❌ Error:', error.message);
  }
}

async function provideFinalInstructions(testResult) {
  console.log('\n3. 📋 Finale instruktioner...');
  
  if (testResult && testResult.success) {
    console.log('   🎯 TEST EMAIL SENDT!');
    console.log('');
    console.log('   📧 TJEK DIN EMAIL NU:');
    console.log(`   - Email adresse: ${testResult.email}`);
    console.log('   - Tjek både inbox og spam folder');
    console.log('   - Kig efter email fra Supabase/Runaro');
    console.log('');
    console.log('   🔗 I EMAILEN:');
    console.log('   - Find "Confirm your signup" eller lignende link');
    console.log('   - VIGTIG: Tjek hvor linket peger hen');
    console.log('   - Burde starte med: https://runaro.dk/auth');
    console.log('   - Må IKKE starte med: http://localhost:3000');
    console.log('');
    console.log('   ✅ HVIS LINKET PEGER TIL runaro.dk:');
    console.log('   - Problemet er løst! 🎉');
    console.log('   - Klik på linket og bekræft');
    console.log('   - Log ind på https://runaro.dk');
    console.log('   - Se "Velkommen [navn]!" på forsiden');
    console.log('');
    console.log('   ❌ HVIS LINKET STADIG PEGER TIL localhost:');
    console.log('   - Manuel Supabase Dashboard opsætning krævet');
    console.log('   - Gå til: https://supabase.com/dashboard/project/ojjpslrhyutizwpvvngu');
    console.log('   - Authentication → Settings → URL Configuration');
    console.log('   - Sæt Site URL til: https://runaro.dk');
    console.log('');
    console.log(`   🗑️ SLET TEST BRUGER BAGEFTER:`);
    console.log(`   node delete_test_user.js ${testResult.userId}`);
    
  } else {
    console.log('   ❌ Test signup failed');
    console.log('   Prøv manuel oprettelse på https://runaro.dk/auth');
  }
}

// Create cleanup script
async function createCleanupScript(testResult) {
  if (!testResult || !testResult.success) return;
  
  const cleanupScript = `
// Quick cleanup script for test user
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "${SUPABASE_URL}";
const SERVICE_KEY = "${SERVICE_KEY}";

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const userId = process.argv[2] || "${testResult.userId}";

console.log('🧹 Sletter test bruger:', userId);

async function deleteTestUser() {
  try {
    // Delete related data
    await supabase.from('profiles').delete().eq('user_id', userId);
    await supabase.from('activities').delete().eq('user_id', userId);
    await supabase.from('league_memberships').delete().eq('user_id', userId);
    
    // Delete auth user
    const { error } = await supabase.auth.admin.deleteUser(userId);
    
    if (error) {
      console.log('❌ Delete failed:', error.message);
    } else {
      console.log('✅ Test bruger slettet successfully!');
    }
  } catch (error) {
    console.log('❌ Delete error:', error.message);
  }
}

deleteTestUser();
  `;
  
  require('fs').writeFileSync('delete_test_user.js', cleanupScript);
  console.log('   📝 Cleanup script created: delete_test_user.js');
}

// Main execution
async function main() {
  console.log('🧪 SITE URL VERIFICATION TEST');
  console.log('==============================');
  console.log('Dette test vil sende en RIGTIG bekræftelsesmail!');
  console.log('Formålet er at verificere om Site URL er korrekt konfigureret.\n');
  
  await checkCurrentUsers();
  const testResult = await testRealSignup();
  await createCleanupScript(testResult);
  await provideFinalInstructions(testResult);
  
  console.log('\n🏁 TEST COMPLETERET!');
  console.log('====================');
  
  if (testResult && testResult.success) {
    console.log('✅ Test email sendt successfully!');
    console.log('📧 Tjek nu din email for at verificere Site URL konfiguration');
    console.log('🔗 Bekræftelseslinket vil afsløre om problemet er løst');
    
    console.log('\n🎯 NÆSTE SKRIDT:');
    console.log('1. Tjek emailen som blev sendt');
    console.log('2. Verifiér at bekræftelseslinket peger til https://runaro.dk/auth');
    console.log('3. Hvis rigtigt - klik og bekræft!');
    console.log('4. Hvis forkert - manuel Dashboard opsætning påkrævet');
    console.log(`5. Slet bagefter test brugeren: node delete_test_user.js`);
    
  } else {
    console.log('❌ Test email kunne ikke sendes');
    console.log('Prøv manuel signup på https://runaro.dk/auth');
  }
}

main().catch(console.error);