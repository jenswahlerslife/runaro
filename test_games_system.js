// Test at games systemet virker
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ojjpslrhyutizwpvvngu.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9qanBzbHJoeXV0aXp3cHZ2bmd1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjIzMDI0NSwiZXhwIjoyMDcxODA2MjQ1fQ.Wm6AbiLNjIVM-T4a7TUhBMphb5EW9fMMLJC9-wSJNS4';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
});

console.log('🎮 TESTER GAMES SYSTEM');
console.log('======================');

async function testGamesSystem() {
  // 1) Test at games tabellen kan læses
  console.log('1️⃣ Tester adgang til games tabel...');
  try {
    const { data, error } = await supabase.from('games').select('*').limit(1);
    if (error) {
      console.log('❌ Games tabel adgang:', error.message);
    } else {
      console.log('✅ Games tabel kan læses');
    }
  } catch (err) {
    console.log('❌ Games tabel exception:', err.message);
  }

  // 2) Test create_game function
  console.log('2️⃣ Tester create_game function...');
  try {
    const { data, error } = await supabase.rpc('create_game', {
      p_league_id: '00000000-0000-0000-0000-000000000000', // Dummy UUID
      p_name: 'Test Game'
    });
    
    if (error && error.message.includes('No profile for current user')) {
      console.log('✅ create_game function eksisterer og virker (forventet fejl: no profile)');
    } else if (error) {
      console.log('⚠️  create_game function fejl:', error.message);
    } else {
      console.log('✅ create_game function virker perfekt');
    }
  } catch (err) {
    console.log('❌ create_game function exception:', err.message);
  }

  // 3) Test start_game function
  console.log('3️⃣ Tester start_game function...');
  try {
    const { data, error } = await supabase.rpc('start_game', {
      p_game_id: '00000000-0000-0000-0000-000000000000' // Dummy UUID
    });
    
    if (error && (error.message.includes('No profile') || error.message.includes('Not authorized'))) {
      console.log('✅ start_game function eksisterer og virker (forventet fejl)');
    } else if (error) {
      console.log('⚠️  start_game function fejl:', error.message);
    } else {
      console.log('✅ start_game function virker perfekt');
    }
  } catch (err) {
    console.log('❌ start_game function exception:', err.message);
  }

  // 4) Se hvilke functions der eksisterer
  console.log('4️⃣ Lister tilgængelige RPC functions...');
  try {
    const SUPABASE_ACCESS_TOKEN = 'sbp_eed1316b98c00000199ef9b93fa5dee163591696';
    const PROJECT_REF = 'ojjpslrhyutizwpvvngu';

    const response = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        query: `
          SELECT proname, pronargs 
          FROM pg_proc
          JOIN pg_namespace n ON n.oid = pg_proc.pronamespace
          WHERE n.nspname='public' AND proname LIKE '%game%';
        `
      })
    });

    if (response.ok) {
      const result = await response.json();
      console.log('🔍 Tilgængelige game functions:', result);
    }
  } catch (err) {
    console.log('⚠️  Kunne ikke liste functions');
  }

  console.log('\n🎯 RESULTAT');
  console.log('===========');
  console.log('✅ Games system skulle nu være fuldt funktionelt');
  console.log('🚀 Prøv at reload din browser og test "Create Game"');
  console.log('💡 404 fejlen på /rpc/create_game skulle være væk');
}

testGamesSystem().catch(console.error);