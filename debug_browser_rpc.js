// Test the exact RPC call that browser makes (without explicit user_id)
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

// Use anon key like browser does, not service role key
const supabase = createClient(
  'https://ojjpslrhyutizwpvvngu.supabase.co',
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9qanBzbHJoeXV0aXp3cHZ2bmd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYyMzAyNDUsImV4cCI6MjA3MTgwNjI0NX0.qsKY1YPBaphie0BwV71-kHcg73ZfKNuBUHR9yHO78zA'
);

async function debugBrowserRPC() {
  console.log('🌐 Testing RPC call exactly like browser does');
  console.log('===========================================');

  const gameId = 'c0e85b37-1407-4118-9a01-68ee1114ba09';

  try {
    // Test without any auth (like browser initially)
    console.log('\n📋 Testing without authentication...');
    const { data, error } = await supabase
      .rpc('get_game_overview', {
        p_game_id: gameId
      });

    if (error) {
      console.error('❌ RPC call failed:', error);
      console.error('Error details:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      });

      if (error.message && error.message.includes('Not authenticated')) {
        console.log('💡 This explains the issue: Browser user is not authenticated!');
      }
    } else {
      console.log('✅ RPC call succeeded');
      console.log('Response data:', JSON.stringify(data, null, 2));
    }

    // Check current session
    console.log('\n🔐 Checking current session...');
    const { data: session } = await supabase.auth.getSession();
    if (session?.session) {
      console.log('✅ User is authenticated:', session.session.user.id);
    } else {
      console.log('❌ No active session - user is not authenticated');
      console.log('💡 This is why get_game_overview fails in browser!');
    }

  } catch (err) {
    console.error('❌ Unexpected error:', err);
  }
}

debugBrowserRPC().catch(console.error);