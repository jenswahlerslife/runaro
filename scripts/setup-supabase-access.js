#!/usr/bin/env node

/**
 * Supabase Full Access Setup Script
 * This script establishes comprehensive access to analyze, edit, and improve the Supabase project
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import fs from 'fs';
import path from 'path';

// Load environment variables
config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const SUPABASE_PROJECT_REF = process.env.SUPABASE_PROJECT_REF || 'ojjpslrhyutizwpvvngu';

console.log('🔧 Setting up comprehensive Supabase access...\n');

// Create clients
const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const serviceClient = SUPABASE_SERVICE_ROLE_KEY ?
  createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) : null;

class SupabaseAnalyzer {
  constructor() {
    this.client = serviceClient || anonClient;
    this.hasServiceRole = !!serviceClient;
    this.results = {
      tables: [],
      functions: [],
      policies: [],
      triggers: [],
      indexes: [],
      issues: [],
      recommendations: []
    };
  }

  async analyzeDatabase() {
    console.log(`📊 Analyzing database with ${this.hasServiceRole ? 'SERVICE ROLE' : 'ANON'} privileges...\n`);

    try {
      await this.analyzeTables();
      await this.analyzeFunctions();
      await this.analyzePolicies();
      await this.analyzePerformance();
      await this.generateReport();
    } catch (error) {
      console.error('❌ Analysis failed:', error.message);

      if (!this.hasServiceRole) {
        console.log('\n⚠️  Limited access detected. To get full access, add your service role key:');
        console.log('1. Go to Supabase Dashboard > Settings > API');
        console.log('2. Copy the "service_role" secret key');
        console.log('3. Add to .env: SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here');
        console.log('4. Run this script again');
      }
    }
  }

  async analyzeTables() {
    console.log('🗄️  Analyzing tables...');

    try {
      // Get all tables in public schema
      const { data: tables, error } = await this.client
        .from('information_schema.tables')
        .select('table_name, table_type')
        .eq('table_schema', 'public')
        .eq('table_type', 'BASE TABLE');

      if (error) throw error;

      for (const table of tables || []) {
        const tableInfo = await this.analyzeTable(table.table_name);
        this.results.tables.push(tableInfo);
      }

      console.log(`   ✅ Found ${tables?.length || 0} tables`);
    } catch (error) {
      console.log(`   ⚠️  Table analysis limited: ${error.message}`);
    }
  }

  async analyzeTable(tableName) {
    const tableInfo = {
      name: tableName,
      columns: [],
      rowCount: 0,
      indexes: [],
      issues: []
    };

    try {
      // Get columns
      const { data: columns } = await this.client
        .from('information_schema.columns')
        .select('column_name, data_type, is_nullable, column_default')
        .eq('table_schema', 'public')
        .eq('table_name', tableName);

      tableInfo.columns = columns || [];

      // Try to get row count (may fail with anon key)
      if (this.hasServiceRole) {
        const { count } = await this.client
          .from(tableName)
          .select('*', { count: 'exact', head: true });
        tableInfo.rowCount = count || 0;
      }

    } catch (error) {
      tableInfo.issues.push(`Failed to analyze: ${error.message}`);
    }

    return tableInfo;
  }

  async analyzeFunctions() {
    console.log('⚙️  Analyzing functions...');

    try {
      const { data: functions, error } = await this.client
        .from('information_schema.routines')
        .select('routine_name, routine_type, security_type')
        .eq('routine_schema', 'public');

      if (error) throw error;

      this.results.functions = functions || [];
      console.log(`   ✅ Found ${functions?.length || 0} functions`);

      // Check for security issues
      const unsecureFunctions = functions?.filter(f => f.security_type !== 'DEFINER') || [];
      if (unsecureFunctions.length > 0) {
        this.results.issues.push(`${unsecureFunctions.length} functions without SECURITY DEFINER`);
      }

    } catch (error) {
      console.log(`   ⚠️  Function analysis limited: ${error.message}`);
    }
  }

  async analyzePolicies() {
    console.log('🔒 Analyzing RLS policies...');

    try {
      // This requires elevated permissions
      if (!this.hasServiceRole) {
        console.log('   ⚠️  Policy analysis requires service role key');
        return;
      }

      const { data: policies, error } = await this.client
        .rpc('get_rls_policies'); // Custom function to get policies

      if (error) {
        console.log(`   ⚠️  Policy analysis limited: ${error.message}`);
        return;
      }

      this.results.policies = policies || [];
      console.log(`   ✅ Found ${policies?.length || 0} policies`);

    } catch (error) {
      console.log(`   ⚠️  Policy analysis failed: ${error.message}`);
    }
  }

  async analyzePerformance() {
    console.log('🚀 Analyzing performance...');

    if (!this.hasServiceRole) {
      console.log('   ⚠️  Performance analysis requires service role key');
      return;
    }

    try {
      // Check for missing indexes
      // This is a simplified check - in production you'd want more sophisticated analysis
      const criticalTables = ['profiles', 'activities', 'games', 'leagues'];

      for (const table of criticalTables) {
        const { data: indexes, error } = await this.client
          .from('pg_indexes')
          .select('indexname, indexdef')
          .eq('tablename', table);

        if (!error && indexes) {
          this.results.indexes.push({
            table,
            indexes: indexes.length,
            hasIdIndex: indexes.some(idx => idx.indexname.includes('pkey')),
            hasForeignKeyIndexes: indexes.some(idx => idx.indexdef.includes('_id'))
          });
        }
      }

    } catch (error) {
      console.log(`   ⚠️  Performance analysis failed: ${error.message}`);
    }
  }

  async generateReport() {
    console.log('\n📋 Generating comprehensive report...\n');

    const report = {
      timestamp: new Date().toISOString(),
      project: SUPABASE_PROJECT_REF,
      accessLevel: this.hasServiceRole ? 'FULL (Service Role)' : 'LIMITED (Anon)',
      summary: {
        tables: this.results.tables.length,
        functions: this.results.functions.length,
        policies: this.results.policies.length,
        issues: this.results.issues.length
      },
      analysis: this.results
    };

    // Save report
    const reportPath = path.join(process.cwd(), 'supabase-analysis-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    console.log('📊 DATABASE ANALYSIS SUMMARY');
    console.log('=' .repeat(50));
    console.log(`🏗️  Tables: ${report.summary.tables}`);
    console.log(`⚙️  Functions: ${report.summary.functions}`);
    console.log(`🔒 Policies: ${report.summary.policies}`);
    console.log(`⚠️  Issues: ${report.summary.issues}`);
    console.log(`🔑 Access Level: ${report.accessLevel}`);

    if (this.results.issues.length > 0) {
      console.log('\n🚨 ISSUES FOUND:');
      this.results.issues.forEach((issue, i) => {
        console.log(`   ${i + 1}. ${issue}`);
      });
    }

    console.log(`\n📄 Full report saved to: ${reportPath}`);

    // Generate recommendations
    this.generateRecommendations();
  }

  generateRecommendations() {
    console.log('\n💡 RECOMMENDATIONS:');
    console.log('=' .repeat(50));

    if (!this.hasServiceRole) {
      console.log('🔑 HIGH PRIORITY: Get service role access for complete analysis');
      console.log('   • Add SUPABASE_SERVICE_ROLE_KEY to .env');
      console.log('   • This enables security auditing and performance optimization');
    }

    if (this.results.functions.length > 0) {
      console.log('🛡️  SECURITY: Review all database functions');
      console.log('   • Ensure SECURITY DEFINER is used');
      console.log('   • Lock search_path to prevent injection');
    }

    console.log('📈 PERFORMANCE: Consider adding indexes for frequently queried columns');
    console.log('🔍 MONITORING: Set up regular database health checks');
    console.log('🧪 TESTING: Implement automated RLS policy testing');

    console.log('\n✅ Setup complete! You now have tools to analyze and improve your Supabase setup.');
  }
}

// CLI Interface
async function main() {
  const analyzer = new SupabaseAnalyzer();
  await analyzer.analyzeDatabase();
}

// Export for programmatic use
export { SupabaseAnalyzer };

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}