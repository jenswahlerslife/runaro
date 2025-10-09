import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabaseUrl = 'https://ojjpslrhyutizwpvvngu.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9qanBzbHJoeXV0aXp3cHZ2bmd1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjIzMDI0NSwiZXhwIjoyMDcxODA2MjQ1fQ.Wm6AbiLNjIVM-T4a7TUhBMphb5EW9fMMLJC9-wSJNS4';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const migrationFiles = [
  '20250901170000_create_multiplayer_league_system.sql',
  '20250901170001_create_league_functions.sql'
];

async function applyMigrations() {
  for (const file of migrationFiles) {
    const filePath = path.join(__dirname, 'infra', 'supabase', 'migrations', file);
    
    if (!fs.existsSync(filePath)) {
      console.log(`⚠️  Migration file ${file} not found, skipping...`);
      continue;
    }
    
    const sql = fs.readFileSync(filePath, 'utf8');
    console.log(`🔄 Applying migration: ${file}`);
    
    try {
      const { error } = await supabase.rpc('exec_sql', { sql });
      
      if (error) {
        console.error(`❌ Error applying ${file}:`, error);
      } else {
        console.log(`✅ Successfully applied ${file}`);
      }
    } catch (err) {
      console.error(`❌ Exception applying ${file}:`, err);
    }
  }
}

applyMigrations().catch(console.error);
