import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabaseUrl = 'https://ojjpslrhyutizwpvvngu.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9qanBzbHJoeXV0aXp3cHZ2bmd1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjIzMDI0NSwiZXhwIjoyMDcxODA2MjQ1fQ.Wm6AbiLNjIVM-T4a7TUhBMphb5EW9fMMLJC9-wSJNS4';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function createFunctions() {
  const functionsFile = path.join(__dirname, 'supabase', 'migrations', '20250901170001_create_league_functions.sql');
  
  if (!fs.existsSync(functionsFile)) {
    console.log('❌ Functions migration file not found');
    return;
  }
  
  const sql = fs.readFileSync(functionsFile, 'utf8');
  console.log('🔄 Creating league functions...');
  
  // Split the SQL by function boundaries and execute each separately
  const functionBlocks = sql.split(/(?=CREATE OR REPLACE FUNCTION|GRANT EXECUTE)/);
  
  for (let i = 0; i < functionBlocks.length; i++) {
    const block = functionBlocks[i].trim();
    if (!block) continue;
    
    console.log(`🔄 Executing block ${i + 1}/${functionBlocks.length}`);
    
    try {
      // Use a direct SQL query instead of RPC
      const { error } = await supabase
        .from('_postgrest_client')
        .select('1')
        .limit(0); // This won't work for raw SQL
      
      // Instead, let's try using the REST API directly
      const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'apikey': supabaseServiceKey
        },
        body: JSON.stringify({ sql: block })
      });
      
      if (response.ok) {
        console.log(`✅ Block ${i + 1} executed successfully`);
      } else {
        const errorText = await response.text();
        console.log(`❌ Block ${i + 1} failed:`, errorText);
        
        // If exec doesn't work, let's try a different approach
        console.log('🔄 Trying alternative method...');
        
        // Try using the pg_stat_statements or direct query
        const { error: directError } = await supabase.rpc('exec', { query: block });
        
        if (directError) {
          console.log(`❌ Alternative method also failed:`, directError.message);
        } else {
          console.log(`✅ Alternative method succeeded for block ${i + 1}`);
        }
      }
    } catch (err) {
      console.error(`❌ Exception in block ${i + 1}:`, err.message);
    }
  }
}

createFunctions().catch(console.error);