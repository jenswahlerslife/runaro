import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const SUPABASE_URL = 'https://ojjpslrhyutizwpvvngu.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9qanBzbHJoeXV0aXp3cHZ2bmd1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjIzMDI0NSwiZXhwIjoyMDcxODA2MjQ1fQ.Wm6AbiLNjIVM-T4a7TUhBMphb5EW9fMMLJC9-wSJNS4';

console.log('Using Supabase URL:', SUPABASE_URL);

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function runMigration() {
  try {
    console.log('Reading migration file...');
    const migrationSQL = fs.readFileSync('./supabase/migrations/20250904120000_add_display_name_and_age_to_profiles.sql', 'utf8');
    
    console.log('Executing migration SQL...');
    
    // Try to execute the entire migration as one block first
    try {
      const { data, error } = await supabase.rpc('execute_sql', {
        query: migrationSQL
      });
      
      if (error) {
        console.error('Migration failed with execute_sql:', error);
        
        // If that fails, try executing line by line
        console.log('Trying to execute statements individually...');
        const statements = migrationSQL
          .split(';')
          .filter(stmt => stmt.trim().length > 0 && !stmt.trim().startsWith('--'))
          .map(stmt => stmt.trim());
        
        for (let i = 0; i < statements.length; i++) {
          const statement = statements[i];
          if (!statement) continue;
          
          console.log(`Executing statement ${i + 1}/${statements.length}...`);
          
          try {
            // Use the direct SQL execution through the REST API
            const { data: stmtData, error: stmtError } = await supabase.rpc('execute_sql', {
              query: statement
            });
            
            if (stmtError) {
              console.error(`Statement ${i + 1} failed:`, stmtError);
              console.log('Statement:', statement);
            } else {
              console.log(`Statement ${i + 1} executed successfully`);
            }
          } catch (err) {
            console.error(`Statement ${i + 1} exception:`, err.message);
          }
        }
      } else {
        console.log('Migration executed successfully!');
      }
    } catch (err) {
      console.error('Migration execution error:', err.message);
    }

    console.log('Migration execution completed!');

    // Test the new structure by checking a profile
    console.log('\nTesting profile structure...');
    const { data: profiles, error: selectError } = await supabase
      .from('profiles')
      .select('id, username, display_name, age')
      .limit(1);

    if (selectError) {
      console.error('Error testing profile structure:', selectError);
    } else {
      console.log('Profile structure test successful:', profiles);
    }

  } catch (error) {
    console.error('Error running migration:', error);
  }
}

runMigration();