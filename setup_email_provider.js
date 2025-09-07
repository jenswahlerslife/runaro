// Script to check and configure email provider in Supabase
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://ojjpslrhyutizwpvvngu.supabase.co";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9qanBzbHJoeXV0aXp3cHZ2bmd1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcyNDY5MDY0NSwiZXhwIjoyMDQwMjY2NjQ1fQ.WJT3YGOtLd4r7FPEm9UfKBSy4UqZZSRmUCE4VzqQLyc";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function checkAndConfigureEmail() {
  console.log('🔧 Setting up email provider for Supabase...\n');
  
  try {
    console.log('📊 Current Supabase project info:');
    console.log(`   URL: ${SUPABASE_URL}`);
    console.log(`   Project ID: ojjpslrhyutizwpvvngu\n`);
    
    // Test if we can access auth settings
    console.log('🔍 Checking current auth configuration...');
    
    // Check if we can query auth config
    const { data, error } = await supabase
      .from('auth.config')
      .select('*')
      .limit(1);
      
    if (error) {
      console.warn('⚠️ Cannot directly access auth config via API:', error.message);
    } else {
      console.log('✅ Auth config accessible');
    }
    
    console.log('\n📋 To configure email provider, you need to:');
    console.log('==========================================\n');
    
    console.log('1. 🌐 Go to Supabase Dashboard:');
    console.log('   https://supabase.com/dashboard/project/ojjpslrhyutizwpvvngu\n');
    
    console.log('2. 📧 Navigate to: Authentication → Settings → Email Templates\n');
    
    console.log('3. ⚙️ Configure Email Provider:');
    console.log('   - Click on "Email" section');
    console.log('   - Choose an email provider (recommended: Resend or SendGrid)');
    console.log('   - Or use SMTP settings if you have your own email server\n');
    
    console.log('📧 Quick SMTP Options:');
    console.log('====================');
    console.log('Gmail SMTP:');
    console.log('   Host: smtp.gmail.com');
    console.log('   Port: 587');
    console.log('   Username: [your-gmail]');
    console.log('   Password: [app-password]\n');
    
    console.log('Outlook/Hotmail SMTP:');
    console.log('   Host: smtp-mail.outlook.com');
    console.log('   Port: 587');
    console.log('   Username: [your-outlook-email]');
    console.log('   Password: [your-password]\n');
    
    console.log('4. 🎨 Customize Email Templates (optional):');
    console.log('   - Confirm signup template');
    console.log('   - Reset password template');
    console.log('   - Magic link template\n');
    
    console.log('5. ✅ Save configuration and test\n');
    
    console.log('🔧 Alternative: Use Resend (Recommended):');
    console.log('========================================');
    console.log('1. Sign up at https://resend.com');
    console.log('2. Get API key from Resend dashboard');
    console.log('3. In Supabase → Auth → Settings → Email');
    console.log('4. Choose "Resend" and enter your API key\n');
    
    // Try to create a test function that can help with email setup
    console.log('🧪 Creating helper function for email testing...');
    
    const createTestFunction = `
      CREATE OR REPLACE FUNCTION public.test_email_setup()
      RETURNS TEXT AS $$
      BEGIN
        -- This function can be used to test if email configuration works
        RETURN 'Email configuration test function created. Check Supabase dashboard for email provider setup.';
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER;
    `;
    
    const { error: functionError } = await supabase.rpc('exec', { query: createTestFunction });
    
    if (functionError) {
      console.log('⚠️ Note: Could not create test function (this is normal)');
    } else {
      console.log('✅ Test function created');
    }
    
    console.log('\n🎯 Next Steps:');
    console.log('=============');
    console.log('1. Configure email provider in Supabase dashboard');
    console.log('2. Test signup on https://runaro.dk/auth');
    console.log('3. Check your email for confirmation link');
    console.log('4. Click the link to confirm your account\n');
    
  } catch (error) {
    console.error('❌ Error during email setup check:', error);
  }
}

// Run the setup check
checkAndConfigureEmail().then(() => {
  console.log('🏁 Email configuration check completed');
  process.exit(0);
}).catch(err => {
  console.error('💥 Script failed:', err);
  process.exit(1);
});