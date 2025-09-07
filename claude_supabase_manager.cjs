/**
 * Claude Supabase Manager - Permanent Database Control System
 * This script provides persistent access to Supabase using direct database connection
 * Independent of API token expiration
 */

const { Client } = require('pg');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs').promises;
const path = require('path');

class ClaudeSupabaseManager {
  constructor() {
    // Direct database connection - more reliable than API tokens  
    // Use pooler connection for better reliability
    this.dbConfig = {
      connectionString: 'postgresql://postgres.ojjpslrhyutizwpvvngu:ii3Tc2FH7iACT1ua@aws-0-eu-central-1.pooler.supabase.com:6543/postgres',
      ssl: { rejectUnauthorized: false }
    };

    // Supabase client as backup
    this.supabaseUrl = 'https://ojjpslrhyutizwpvvngu.supabase.co';
    this.serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9qanBzbHJoeXV0aXp3cHZ2bmd1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjIzMDI0NSwiZXhwIjoyMDcxODA2MjQ1fQ.Wm6AbiLNjIVM-T4a7TUhBMphb5EW9fMMLJC9-wSJNS4';
  }

  async getDbClient() {
    const client = new Client(this.dbConfig);
    await client.connect();
    return client;
  }

  async getSupabaseClient() {
    return createClient(this.supabaseUrl, this.serviceKey);
  }

  // Execute SQL directly on database - most reliable method
  async executeSql(sqlQuery) {
    console.log('🔄 Executing SQL via direct database connection...');
    let client;
    
    try {
      client = await this.getDbClient();
      const result = await client.query(sqlQuery);
      
      console.log('✅ SQL executed successfully');
      console.log(`📊 Affected rows: ${result.rowCount || 0}`);
      
      return {
        success: true,
        result: result.rows,
        rowCount: result.rowCount
      };
    } catch (error) {
      console.error('❌ SQL execution failed:', error.message);
      return {
        success: false,
        error: error.message
      };
    } finally {
      if (client) await client.end();
    }
  }

  // Execute migration file
  async executeMigrationFile(filePath) {
    console.log(`🚀 Executing migration file: ${filePath}`);
    
    try {
      const sqlContent = await fs.readFile(filePath, 'utf8');
      return await this.executeSql(sqlContent);
    } catch (error) {
      console.error('❌ Failed to read migration file:', error.message);
      return { success: false, error: error.message };
    }
  }

  // Test all connection methods
  async testConnections() {
    console.log('🔍 Testing all connection methods...\n');

    // Test 1: Direct database connection
    console.log('1️⃣ Testing direct database connection...');
    try {
      const dbResult = await this.executeSql('SELECT 1 as test');
      if (dbResult.success) {
        console.log('✅ Database connection: WORKING');
        console.log(`   Test query result: ${dbResult.result[0]?.test}`);
      } else {
        console.log('❌ Database connection: FAILED -', dbResult.error);
      }
    } catch (error) {
      console.log('❌ Database connection: FAILED -', error.message);
    }

    // Test 2: Supabase client
    console.log('\n2️⃣ Testing Supabase client...');
    try {
      const supabase = await this.getSupabaseClient();
      const { data, error } = await supabase.from('leagues').select('count').limit(1);
      if (error) throw error;
      console.log('✅ Supabase client: WORKING');
    } catch (error) {
      console.log('❌ Supabase client: FAILED -', error.message);
    }

    // Test 3: RPC functions
    console.log('\n3️⃣ Testing RPC functions...');
    try {
      const supabase = await this.getSupabaseClient();
      const { data, error } = await supabase.rpc('get_admin_pending_requests_count');
      if (error) throw error;
      console.log('✅ RPC functions: WORKING');
      console.log(`   Pending requests: ${data}`);
    } catch (error) {
      console.log('❌ RPC functions: FAILED -', error.message);
    }

    console.log('\n🎯 Connection test completed!');
  }

  // Get system status
  async getStatus() {
    console.log('📊 Getting system status...\n');

    try {
      // Database info
      const dbInfo = await this.executeSql(`
        SELECT 
          current_database() as database,
          current_user as user,
          version() as version,
          now() as timestamp
      `);

      // League system status
      const leagueStatus = await this.executeSql(`
        SELECT 
          (SELECT COUNT(*) FROM public.leagues) as total_leagues,
          (SELECT COUNT(*) FROM public.league_memberships) as total_memberships,
          (SELECT COUNT(*) FROM public.league_join_requests) as total_requests,
          (SELECT COUNT(*) FROM public.league_join_requests WHERE status = 'pending') as pending_requests;
      `);

      console.log('🗄️  Database Info:');
      if (dbInfo.success && dbInfo.result[0]) {
        const info = dbInfo.result[0];
        console.log(`   Database: ${info.database}`);
        console.log(`   User: ${info.user}`);
        console.log(`   Time: ${info.timestamp}`);
      }

      console.log('\n📈 League System Status:');
      if (leagueStatus.success && leagueStatus.result[0]) {
        const status = leagueStatus.result[0];
        console.log(`   Total Leagues: ${status.total_leagues}`);
        console.log(`   Total Memberships: ${status.total_memberships}`);
        console.log(`   Total Requests: ${status.total_requests}`);
        console.log(`   Pending Requests: ${status.pending_requests}`);
      }

    } catch (error) {
      console.error('❌ Error getting status:', error.message);
    }
  }
}

// CLI Interface
async function main() {
  const manager = new ClaudeSupabaseManager();
  const command = process.argv[2];
  const param = process.argv[3];

  switch (command) {
    case 'test':
      await manager.testConnections();
      break;
    
    case 'status':
      await manager.getStatus();
      break;
    
    case 'sql':
      if (!param) {
        console.log('Usage: node claude_supabase_manager.cjs sql "SELECT * FROM leagues;"');
        return;
      }
      const result = await manager.executeSql(param);
      console.log(JSON.stringify(result, null, 2));
      break;
    
    case 'migrate':
      if (!param) {
        console.log('Usage: node claude_supabase_manager.cjs migrate ./migration.sql');
        return;
      }
      await manager.executeMigrationFile(param);
      break;
    
    default:
      console.log(`
🚀 Claude Supabase Manager - Permanent Database Control

Commands:
  test     - Test all connection methods
  status   - Get system and database status
  sql      - Execute SQL query directly
  migrate  - Execute migration file

Examples:
  node claude_supabase_manager.cjs test
  node claude_supabase_manager.cjs status
  node claude_supabase_manager.cjs sql "SELECT COUNT(*) FROM leagues;"
  node claude_supabase_manager.cjs migrate ./new_migration.sql

This system uses direct database connection and will work regardless of API token expiration.
      `);
  }
}

// Export for programmatic use
module.exports = ClaudeSupabaseManager;

// Run CLI if called directly
if (require.main === module) {
  main().catch(console.error);
}