// Execute DDL via raw SQL using pg library
import pkg from 'pg';
const { Client } = pkg;
import fs from 'fs';

// You'll need to get the DATABASE_URL from your Supabase project settings
// Go to: Project Settings > Database > Connection string (URI)
// It looks like: postgresql://postgres:[YOUR-PASSWORD]@db.ojjpslrhyutizwpvvngu.supabase.co:5432/postgres

async function executeDDL() {
  // You need to fill in your database password here
  const DATABASE_URL = 'postgresql://postgres:[YOUR-DB-PASSWORD]@db.ojjpslrhyutizwpvvngu.supabase.co:5432/postgres';
  
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    console.log('🔄 Connecting to database...');
    await client.connect();
    console.log('✅ Connected successfully');

    // Read the migration file
    const migrationPath = './infra/supabase/migrations/20250901151504_add_included_in_game_column.sql';
    const sql = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('🔄 Executing migration...');
    console.log('📝 SQL:', sql);
    
    await client.query(sql);
    
    console.log('✅ Migration executed successfully!');
    
    // Verify the column was added
    console.log('🔍 Verifying column was added...');
    const result = await client.query(`
      SELECT column_name, data_type, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'user_activities' 
      AND column_name = 'included_in_game'
    `);
    
    if (result.rows.length > 0) {
      console.log('✅ Column verified:', result.rows[0]);
    } else {
      console.log('❌ Column not found');
    }
    
  } catch (error) {
    console.error('❌ Error executing DDL:', error.message);
    
    if (error.message.includes('password authentication failed')) {
      console.log('\n🔑 You need to provide your database password.');
      console.log('Get it from: Supabase Dashboard > Project Settings > Database > Database password');
      console.log('Then update the DATABASE_URL in this script.');
    }
    
  } finally {
    await client.end();
    console.log('🔌 Connection closed');
  }
}

console.log('🚀 Starting DDL execution...');
executeDDL();

// Alternative: If you provide the password as environment variable
// export SUPABASE_DB_PASSWORD=your-password
// node execute_ddl.js
