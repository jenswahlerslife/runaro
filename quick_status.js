
// Quick system status
import { getSystemStatus } from './claude_user_manager.js';

getSystemStatus().then(status => {
  console.log('📊 System Status:');
  console.log(`Users: ${status.totalUsers} (${status.confirmedUsers} confirmed, ${status.unconfirmedUsers} unconfirmed)`);
  console.log(`Email confirmation working: ${status.authConfigWorking ? '✅' : '❌'}`);
  
  if (status.users.length > 0) {
    console.log('\n👥 Users:');
    status.users.forEach(user => {
      console.log(`- ${user.email} (${user.confirmed ? 'Confirmed' : 'Unconfirmed'})`);
    });
  }
});
    