// Script to clear user sessions and provide manual deletion steps
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://ojjpslrhyutizwpvvngu.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9qanBzbHJoeXV0aXp3cHZ2bmd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYyMzAyNDUsImV4cCI6MjA3MTgwNjI0NX0.qsKY1YPBaphie0BwV71-kHcg73ZfKNuBUHR9yHO78zA";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

console.log('🧹 Clearing user sessions...');

// Sign out any current sessions
await supabase.auth.signOut();

console.log('✅ Sessions cleared');
console.log('\n📋 Manual Steps to Delete User Account:');
console.log('==========================================');
console.log('\n1. 🌐 Go to: https://supabase.com/dashboard/project/ojjpslrhyutizwpvvngu');
console.log('2. 🔐 Log in to your Supabase dashboard');
console.log('3. 📊 Navigate to "Authentication" > "Users"');
console.log('4. 🔍 Find the user: wahlers3@hotmail.com');
console.log('5. ❌ Click the delete button (trash icon) next to the user');
console.log('6. ✅ Confirm deletion');
console.log('\nAlternatively:');
console.log('A. 🌐 Try signing up again at https://runaro.dk/auth');
console.log('B. 📧 Use the same email: wahlers3@hotmail.com');  
console.log('C. 📝 Fill in the new fields (username, display name, age)');
console.log('D. ✨ If signup works, the account was already deleted!');
console.log('\n🎯 The new signup should now include:');
console.log('   - Username field');
console.log('   - Display Name field (2-50 characters)');
console.log('   - Age field (5-120)');
console.log('\n💡 After signup, you should see "Velkommen [your name]!" on the homepage');

console.log('\n🏁 Script completed');
process.exit(0);