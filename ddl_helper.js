// DDL Helper - Secure way to execute database migrations
import pkg from 'pg';
const { Client } = pkg;
import fs from 'fs';
import path from 'path';

class DDLHelper {
  constructor() {
    this.client = null;
    this.projectRef = 'ojjpslrhyutizwpvvngu';
  }

  async connect(password) {
    const connectionString = `postgresql://postgres:${password}@db.${this.projectRef}.supabase.co:5432/postgres`;
    
    this.client = new Client({
      connectionString,
      ssl: { rejectUnauthorized: false }
    });

    try {
      await this.client.connect();
      console.log('✅ Connected to Supabase database');
      return true;
    } catch (error) {
      console.error('❌ Connection failed:', error.message);
      return false;
    }
  }

  async executeSQL(sql, description = 'SQL command') {
    if (!this.client) {
      throw new Error('Not connected. Call connect() first.');
    }

    try {
      console.log(`🔄 Executing: ${description}`);
      console.log('📝 SQL:', sql.substring(0, 100) + (sql.length > 100 ? '...' : ''));
      
      const result = await this.client.query(sql);
      console.log(`✅ ${description} completed successfully`);
      
      return result;
    } catch (error) {
      console.error(`❌ ${description} failed:`, error.message);
      throw error;
    }
  }

  async executeMigration(migrationFile) {
    const sql = fs.readFileSync(migrationFile, 'utf8');
    const filename = path.basename(migrationFile);
    
    return await this.executeSQL(sql, `Migration: ${filename}`);
  }

  async addIncludedInGameColumn() {
    const sql = `
      -- Add included_in_game column to user_activities table
      ALTER TABLE public.user_activities
        ADD COLUMN IF NOT EXISTS included_in_game boolean NOT NULL DEFAULT true;

      -- Update existing rows to be included in game by default  
      UPDATE public.user_activities 
      SET included_in_game = true 
      WHERE included_in_game IS NULL;
    `;

    return await this.executeSQL(sql, 'Add included_in_game column');
  }

  async verifyColumn() {
    const sql = `
      SELECT column_name, data_type, column_default, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'user_activities' 
      AND column_name = 'included_in_game'
    `;

    const result = await this.executeSQL(sql, 'Verify column exists');
    return result.rows;
  }

  async testActivitiesQuery() {
    const sql = `
      SELECT id, name, distance, moving_time, included_in_game
      FROM public.user_activities
      LIMIT 3
    `;

    const result = await this.executeSQL(sql, 'Test activities query');
    return result.rows;
  }

  async disconnect() {
    if (this.client) {
      await this.client.end();
      console.log('🔌 Database connection closed');
    }
  }
}

// Usage example
async function runDDLOperation(password) {
  const ddl = new DDLHelper();
  
  try {
    // Connect
    const connected = await ddl.connect(password);
    if (!connected) return false;

    // Execute the column addition
    await ddl.addIncludedInGameColumn();

    // Verify it worked
    const columns = await ddl.verifyColumn();
    if (columns.length > 0) {
      console.log('✅ Column verified:', columns[0]);
    } else {
      console.log('❌ Column verification failed');
      return false;
    }

    // Test the new column works
    const testData = await ddl.testActivitiesQuery();
    console.log('📊 Sample data with new column:', testData);

    console.log('🎉 DDL operation completed successfully!');
    return true;

  } catch (error) {
    console.error('❌ DDL operation failed:', error.message);
    return false;
  } finally {
    await ddl.disconnect();
  }
}

// Export for Claude Code integration
export { DDLHelper, runDDLOperation };

// Command line usage
const password = process.argv[2];
if (password) {
  runDDLOperation(password)
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('Unexpected error:', error);
      process.exit(1);
    });
} else {
  console.log('Usage: node ddl_helper.js <database-password>');
  console.log('');
  console.log('Get your database password from:');
  console.log('Supabase Dashboard > Project Settings > Database > Database password');
}