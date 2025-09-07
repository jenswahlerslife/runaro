
// Quick auth configuration test
import { testEmailFlow } from './claude_config_tester.js';

testEmailFlow().then(result => {
  if (result.error) {
    console.log('❌ Test failed:', result.error);
  } else if (result.needsConfirmation) {
    console.log('🎯 Email confirmation working! Check email for link pointing to https://runaro.dk/auth');
  } else {
    console.log('⚠️ Users auto-confirmed - no email confirmation');
  }
});
    