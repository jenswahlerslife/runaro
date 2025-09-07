
// Claude's Configuration Testing System
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://ojjpslrhyutizwpvvngu.supabase.co";
const SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9qanBzbHJoeXV0aXp3cHZ2bmd1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjIzMDI0NSwiZXhwIjoyMDcxODA2MjQ1fQ.Wm6AbiLNjIVM-T4a7TUhBMphb5EW9fMMLJC9-wSJNS4";

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

export class ConfigurationTester {
  async testEmailConfirmationFlow() {
    console.log('🧪 Testing email confirmation flow...');
    
    const testEmail = `config-test-${Date.now()}@gmail.com`;
    
    try {
      const { data, error } = await supabase.auth.signUp({
        email: testEmail,
        password: 'TestPassword123!',
        options: {
          data: { username: 'configtest', display_name: 'Config Test', age: 25 },
          emailRedirectTo: 'https://runaro.dk/auth'
        }
      });
      
      if (error) throw error;
      
      const result = {
        testEmail,
        userCreated: !!data.user,
        sessionCreated: !!data.session,
        needsConfirmation: !data.session && !!data.user,
        userId: data.user?.id
      };
      
      // Clean up test user
      if (data.user) {
        await supabase.auth.admin.deleteUser(data.user.id);
      }
      
      console.log('📊 Test results:', result);
      
      if (result.needsConfirmation) {
        console.log('✅ Email confirmation is working!');
        console.log('📧 Confirmation emails should point to: https://runaro.dk/auth');
      } else {
        console.log('⚠️ Users are auto-confirmed (no email confirmation)');
      }
      
      return result;
    } catch (error) {
      console.log('❌ Test failed:', error.message);
      return { error: error.message };
    }
  }
  
  async verifyAuthConfiguration() {
    console.log('🔍 Verifying auth configuration...');
    
    // Test multiple scenarios
    const tests = [];
    
    for (let i = 0; i < 3; i++) {
      const result = await this.testEmailConfirmationFlow();
      tests.push(result);
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait between tests
    }
    
    const successful = tests.filter(t => !t.error).length;
    const needConfirmation = tests.filter(t => t.needsConfirmation).length;
    
    console.log(`📊 Test summary: ${successful}/3 successful, ${needConfirmation}/3 need confirmation`);
    
    return {
      testsSuccessful: successful,
      testsNeedingConfirmation: needConfirmation,
      emailConfirmationWorking: needConfirmation > 0,
      allTests: tests
    };
  }
}

export const testEmailFlow = () => new ConfigurationTester().testEmailConfirmationFlow();
export const verifyConfig = () => new ConfigurationTester().verifyAuthConfiguration();

console.log('🧪 Configuration Tester loaded!');
  