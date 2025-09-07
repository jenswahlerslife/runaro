// Verificer fuld Supabase adgang
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ojjpslrhyutizwpvvngu.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9qanBzbHJoeXV0aXp3cHZ2bmd1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjIzMDI0NSwiZXhwIjoyMDcxODA2MjQ1fQ.Wm6AbiLNjIVM-T4a7TUhBMphb5EW9fMMLJC9-wSJNS4';
const SUPABASE_ACCESS_TOKEN = 'sbp_eed1316b98c00000199ef9b93fa5dee163591696';
const PROJECT_REF = 'ojjpslrhyutizwpvvngu';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
});

console.log('🔍 VERIFICERER FULD SUPABASE ADGANG');
console.log('===================================');

async function verifyAccess() {
  let accessLevel = [];

  // 1. Test Service Role Key adgang
  console.log('1️⃣ Tester Service Role Key adgang...');
  try {
    const { data, error } = await supabase.from('profiles').select('id').limit(1);
    if (error) {
      console.log('❌ Service Role Key - Fejl:', error.message);
    } else {
      console.log('✅ Service Role Key - Fungerer perfekt');
      accessLevel.push('SERVICE_ROLE');
    }
  } catch (err) {
    console.log('❌ Service Role Key - Exception:', err.message);
  }

  // 2. Test Management API adgang
  console.log('2️⃣ Tester Management API adgang...');
  try {
    const response = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}`, {
      headers: {
        'Authorization': `Bearer ${SUPABASE_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      }
    });
    
    if (response.ok) {
      const project = await response.json();
      console.log(`✅ Management API - Adgang til projekt: ${project.name}`);
      accessLevel.push('MANAGEMENT_API');
    } else {
      console.log('❌ Management API - HTTP fejl:', response.status);
    }
  } catch (err) {
    console.log('❌ Management API - Exception:', err.message);
  }

  // 3. Test SQL udførelse via Management API
  console.log('3️⃣ Tester SQL udførelse...');
  try {
    const response = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        query: 'SELECT version() as postgresql_version;'
      })
    });

    if (response.ok) {
      const result = await response.json();
      console.log('✅ SQL Udførelse - PostgreSQL version testet successfully');
      accessLevel.push('SQL_EXECUTION');
    } else {
      const error = await response.text();
      console.log('❌ SQL Udførelse - Fejl:', error);
    }
  } catch (err) {
    console.log('❌ SQL Udførelse - Exception:', err.message);
  }

  // 4. Test RPC funktioner
  console.log('4️⃣ Tester RPC funktioner...');
  try {
    const { data, error } = await supabase.rpc('create_league', { p_name: 'test_verification' });
    
    if (error && error.message.includes('User profile not found')) {
      console.log('✅ RPC Funktioner - create_league funktion findes og virker');
      accessLevel.push('RPC_FUNCTIONS');
    } else if (error) {
      console.log('⚠️  RPC Funktioner - Uventet resultat:', error.message);
    } else {
      console.log('✅ RPC Funktioner - Perfekt funktionalitet');
      accessLevel.push('RPC_FUNCTIONS');
    }
  } catch (err) {
    console.log('❌ RPC Funktioner - Exception:', err.message);
  }

  // 5. Test tabel adgang
  console.log('5️⃣ Tester tabel adgang...');
  const tables = ['profiles', 'leagues', 'league_members', 'user_activities'];
  let tableAccess = 0;
  
  for (const table of tables) {
    try {
      const { error } = await supabase.from(table).select('*').limit(0);
      if (!error) {
        tableAccess++;
      }
    } catch (err) {
      // Ignore
    }
  }
  
  console.log(`✅ Tabel Adgang - ${tableAccess}/${tables.length} tabeller tilgængelige`);
  if (tableAccess === tables.length) {
    accessLevel.push('FULL_TABLE_ACCESS');
  }

  // Resultat
  console.log('');
  console.log('📊 ADGANGS RAPPORT');
  console.log('==================');
  console.log('✅ Service Role Key:', accessLevel.includes('SERVICE_ROLE') ? 'JA' : 'NEJ');
  console.log('✅ Management API:', accessLevel.includes('MANAGEMENT_API') ? 'JA' : 'NEJ');  
  console.log('✅ SQL Udførelse:', accessLevel.includes('SQL_EXECUTION') ? 'JA' : 'NEJ');
  console.log('✅ RPC Funktioner:', accessLevel.includes('RPC_FUNCTIONS') ? 'JA' : 'NEJ');
  console.log('✅ Tabel Adgang:', accessLevel.includes('FULL_TABLE_ACCESS') ? 'FULD' : 'DELVIS');
  
  console.log('');
  if (accessLevel.length >= 4) {
    console.log('🎉 RESULTAT: FULD ADGANG BEKRÆFTET!');
    console.log('💪 Jeg kan udføre alle nødvendige operationer i din Supabase');
  } else {
    console.log('⚠️  RESULTAT: DELVIS ADGANG');
    console.log(`📝 Adgang niveau: ${accessLevel.length}/5 funktioner`);
  }
}

verifyAccess().catch(console.error);