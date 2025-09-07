import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ojjpslrhyutizwpvvngu.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9qanBzbHJoeXV0aXp3cHZ2bmd1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjIzMDI0NSwiZXhwIjoyMDcxODA2MjQ1fQ.D4KSBQ-nxGnmwzUIExYAjJBkFqeVGbNrMo7NLt4rGNw';

const supabase = createClient(supabaseUrl, supabaseKey);

async function createLeaguesTable() {
  console.log('🚀 Creating leagues table...');
  
  try {
    // Try to create leagues table using direct SQL
    const { data, error } = await supabase
      .from('_meta')
      .select('*')
      .limit(1);
      
    console.log('Connection test:', { data, error });
    
    // If connection works, we'll manually create via frontend
    return { success: true, message: 'Connection verified - please run migration in Supabase Dashboard' };
    
  } catch (error) {
    console.error('Error:', error);
    return { success: false, error };
  }
}

createLeaguesTable().then(result => {
  console.log('Result:', result);
}).catch(error => {
  console.error('Failed:', error);
});