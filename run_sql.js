// Direct Supabase SQL executor
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = 'https://ojjpslrhyutizwpvvngu.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9qanBzbHJoeXV0aXp3cHZ2bmd1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjIzMDI0NSwiZXhwIjoyMDcxODA2MjQ1fQ.Wm6AbiLNjIVM-T4a7TUhBMphb5EW9fMMLJC9-wSJNS4';

const supabase = createClient(supabaseUrl, supabaseKey);

async function runSQL(sqlFile) {
  try {
    const sql = fs.readFileSync(sqlFile, 'utf8');
    console.log('🔄 Running SQL:', sqlFile);
    console.log('📝 SQL Content:', sql.substring(0, 200) + '...');
    
    const { data, error } = await supabase.rpc('exec_sql', { query: sql });
    
    if (error) {
      console.error('❌ SQL Error:', error);
      return false;
    }
    
    console.log('✅ SQL executed successfully');
    console.log('📊 Result:', data);
    return true;
  } catch (err) {
    console.error('❌ Error:', err);
    return false;
  }
}

// Run SQL file if provided as argument
const sqlFile = process.argv[2];
if (sqlFile) {
  runSQL(sqlFile);
} else {
  console.log('Usage: node run_sql.js <sql-file>');
}

export { runSQL };