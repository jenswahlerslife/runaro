// Claude Autonomous Database Management System
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ojjpslrhyutizwpvvngu.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9qanBzbHJoeXV0aXp3cHZ2bmd1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjIzMDI0NSwiZXhwIjoyMDcxODA2MjQ1fQ.Wm6AbiLNjIVM-T4a7TUhBMphb5EW9fMMLJC9-wSJNS4';

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

export class ClaudeDBManager {
  constructor() {
    this.supabase = supabase;
  }

  // Execute single DDL command
  async executeDDL(sql, description = null) {
    try {
      const { data, error } = await this.supabase.rpc('claude_execute_ddl', {
        command_text: sql,
        description: description
      });

      if (error) {
        console.error(`❌ DDL execution failed:`, error.message);
        return { success: false, error: error.message };
      }

      if (data.success) {
        console.log(`✅ ${data.description || 'DDL command'} completed successfully`);
      } else {
        console.error(`❌ ${data.description || 'DDL command'} failed:`, data.error);
      }

      return data;
    } catch (error) {
      console.error('❌ Unexpected error:', error.message);
      return { success: false, error: error.message };
    }
  }

  // Execute batch of DDL commands
  async executeBatchDDL(commands) {
    try {
      const { data, error } = await this.supabase.rpc('claude_execute_batch_ddl', {
        commands: commands
      });

      if (error) {
        console.error(`❌ Batch DDL execution failed:`, error.message);
        return { success: false, error: error.message };
      }

      console.log(`📊 Batch Results: ${data.successful} successful, ${data.failed} failed`);
      return data;
    } catch (error) {
      console.error('❌ Unexpected error:', error.message);
      return { success: false, error: error.message };
    }
  }

  // Inspect database schema
  async inspectSchema(tableName = null) {
    try {
      const { data, error } = await this.supabase.rpc('claude_inspect_schema', {
        table_name_param: tableName
      });

      if (error) {
        console.error(`❌ Schema inspection failed:`, error.message);
        return null;
      }

      return data;
    } catch (error) {
      console.error('❌ Unexpected error:', error.message);
      return null;
    }
  }

  // Validate data after changes
  async validateData(tableName, validationSQL) {
    try {
      const { data, error } = await this.supabase.rpc('claude_validate_data', {
        table_name_param: tableName,
        validation_sql: validationSQL
      });

      if (error) {
        console.error(`❌ Data validation failed:`, error.message);
        return null;
      }

      return data;
    } catch (error) {
      console.error('❌ Unexpected error:', error.message);
      return null;
    }
  }

  // Check system health
  async checkSystemHealth() {
    try {
      const { data, error } = await this.supabase.rpc('claude_system_health');

      if (error) {
        console.error(`❌ Health check failed:`, error.message);
        return null;
      }

      console.log('🎯 System Health:', data);
      return data;
    } catch (error) {
      console.error('❌ Unexpected error:', error.message);
      return null;
    }
  }

  // Smart column addition with validation
  async addColumnSmart(tableName, columnName, columnType, defaultValue = null) {
    console.log(`🔄 Adding column ${columnName} to ${tableName}...`);
    
    // First inspect the table
    const schema = await this.inspectSchema(tableName);
    if (!schema || !schema.exists) {
      console.error(`❌ Table ${tableName} does not exist`);
      return { success: false, error: 'Table does not exist' };
    }

    // Check if column already exists
    const existingColumn = schema.columns?.find(col => col.column_name === columnName);
    if (existingColumn) {
      console.log(`✅ Column ${columnName} already exists`);
      return { success: true, message: 'Column already exists' };
    }

    // Build DDL command
    let sql = `ALTER TABLE public.${tableName} ADD COLUMN ${columnName} ${columnType}`;
    if (defaultValue !== null) {
      sql += ` DEFAULT ${defaultValue}`;
    }

    // Execute DDL
    const result = await this.executeDDL(sql, `Add ${columnName} column to ${tableName}`);
    
    // Validate the change
    if (result.success) {
      const updatedSchema = await this.inspectSchema(tableName);
      const newColumn = updatedSchema.columns?.find(col => col.column_name === columnName);
      if (newColumn) {
        console.log(`✅ Column ${columnName} added successfully`);
      } else {
        console.error(`❌ Column validation failed`);
      }
    }

    return result;
  }

  // Intelligent migration runner
  async runMigration(migrationName, migrationSteps) {
    console.log(`🚀 Running migration: ${migrationName}`);
    
    const commands = migrationSteps.map((step, index) => ({
      sql: step.sql,
      description: step.description || `${migrationName} step ${index + 1}`
    }));

    const result = await this.executeBatchDDL(commands);
    
    if (result.batch_success) {
      console.log(`✅ Migration ${migrationName} completed successfully`);
    } else {
      console.error(`❌ Migration ${migrationName} failed`);
    }

    return result;
  }
}

// Convenience functions for common operations
export async function quickColumnAdd(tableName, columnName, columnType, defaultValue = null) {
  const manager = new ClaudeDBManager();
  return await manager.addColumnSmart(tableName, columnName, columnType, defaultValue);
}

export async function quickSchemaCheck(tableName = null) {
  const manager = new ClaudeDBManager();
  return await manager.inspectSchema(tableName);
}

export async function quickHealthCheck() {
  const manager = new ClaudeDBManager();
  return await manager.checkSystemHealth();
}

// Auto-execute health check when imported
console.log('🔗 Claude Autonomous DB System loaded');