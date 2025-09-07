
// Quick delete any user by email
import { deleteUser } from './claude_user_manager.js';

const email = process.argv[2];
if (!email) {
  console.log('Usage: node quick_delete_user.js email@example.com');
  process.exit(1);
}

deleteUser(email).then(result => {
  console.log(result.success ? '✅ User deleted!' : '❌ Delete failed:', result.message);
});
    