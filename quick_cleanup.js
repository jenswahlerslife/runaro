
// Quick cleanup of all test users
import { cleanupTestUsers } from './claude_user_manager.js';

cleanupTestUsers().then(result => {
  console.log(result.success ? `✅ Cleaned up ${result.deletedCount} test users` : '❌ Cleanup failed:', result.message);
});
    