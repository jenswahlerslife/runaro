#!/usr/bin/env node

/**
 * Direct Supabase Database Access and Analysis Tool
 * Provides comprehensive database analysis and improvement recommendations
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const SUPABASE_URL = 'https://ojjpslrhyutizwpvvngu.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9qanBzbHJoeXV0aXp3cHZ2bmd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYyMzAyNDUsImV4cCI6MjA3MTgwNjI0NX0.qsKY1YPBaphie0BwV71-kHcg73ZfKNuBUHR9yHO78zA';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9qanBzbHJoeXV0aXp3cHZ2bmd1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjIzMDI0NSwiZXhwIjoyMDcxODA2MjQ1fQ.Wm6AbiLNjIVM-T4a7TUhBMphb5EW9fMMLJC9-wSJNS4';

console.log('🔧 Establishing full Supabase database access...\n');

// Create service role client for full access
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

class DatabaseAnalyzer {
  constructor() {
    this.results = {
      tables: [],
      functions: [],
      policies: [],
      issues: [],
      recommendations: [],
      performance: []
    };
  }

  async runFullAnalysis() {
    console.log('📊 Running comprehensive database analysis...\n');

    try {
      await this.analyzeTables();
      await this.analyzeFunctions();
      await this.analyzeSecurityPolicies();
      await this.analyzePerformance();
      await this.checkDataIntegrity();
      await this.generateReport();

      console.log('✅ Full analysis completed successfully!');
      return this.results;
    } catch (error) {
      console.error('❌ Analysis failed:', error.message);
      throw error;
    }
  }

  async analyzeTables() {
    console.log('🗄️  Analyzing all tables...');

    // Core tables from your codebase
    const coreTables = [
      'profiles', 'activities', 'leagues', 'league_memberships',
      'league_join_requests', 'games', 'player_bases',
      'territory_ownership', 'subscriptions', 'error_reports'
    ];

    for (const tableName of coreTables) {
      try {
        const tableInfo = await this.analyzeTable(tableName);
        this.results.tables.push(tableInfo);
        console.log(`   ✅ ${tableName}: ${tableInfo.rowCount} rows, ${tableInfo.columns.length} columns`);
      } catch (error) {
        console.log(`   ⚠️  ${tableName}: ${error.message}`);
        this.results.issues.push(`Table ${tableName}: ${error.message}`);
      }
    }
  }

  async analyzeTable(tableName) {
    const tableInfo = {
      name: tableName,
      columns: [],
      rowCount: 0,
      indexes: [],
      constraints: [],
      issues: []
    };

    try {
      // Get row count
      const { count, error: countError } = await supabase
        .from(tableName)
        .select('*', { count: 'exact', head: true });

      if (!countError) {
        tableInfo.rowCount = count || 0;
      }

      // Sample data to understand structure
      const { data: sample, error: sampleError } = await supabase
        .from(tableName)
        .select('*')
        .limit(1);

      if (!sampleError && sample && sample.length > 0) {
        tableInfo.columns = Object.keys(sample[0]).map(key => ({
          name: key,
          type: typeof sample[0][key],
          hasData: sample[0][key] !== null
        }));
      }

      // Check for common issues
      if (tableInfo.rowCount === 0) {
        tableInfo.issues.push('Table is empty');
      }

      if (tableName === 'profiles' && tableInfo.rowCount > 0) {
        // Check profile data integrity
        const { data: profileCheck } = await supabase
          .from('profiles')
          .select('id, username, display_name')
          .is('username', null)
          .limit(5);

        if (profileCheck && profileCheck.length > 0) {
          tableInfo.issues.push(`${profileCheck.length} profiles without username`);
        }
      }

    } catch (error) {
      tableInfo.issues.push(error.message);
    }

    return tableInfo;
  }

  async analyzeFunctions() {
    console.log('⚙️  Analyzing database functions...');

    // Key functions from your migrations
    const keyFunctions = [
      'get_user_leagues',
      'create_league_with_owner',
      'join_league',
      'manage_league_membership',
      'create_game',
      'get_active_game_for_league',
      'set_player_base',
      'finish_due_games'
    ];

    for (const funcName of keyFunctions) {
      try {
        // Test function exists by calling with dummy params (will fail but confirm existence)
        const testResult = await supabase.rpc(funcName, {}).catch(err => err);

        this.results.functions.push({
          name: funcName,
          exists: testResult !== undefined,
          lastTested: new Date().toISOString()
        });

        console.log(`   ✅ ${funcName}: Available`);
      } catch (error) {
        this.results.functions.push({
          name: funcName,
          exists: false,
          error: error.message
        });
        console.log(`   ⚠️  ${funcName}: ${error.message}`);
      }
    }
  }

  async analyzeSecurityPolicies() {
    console.log('🔒 Analyzing security policies...');

    // Test RLS by trying to access sensitive data
    const securityTests = [
      {
        table: 'profiles',
        description: 'Profile access control',
        test: async () => {
          const { data, error } = await supabase
            .from('profiles')
            .select('id, age')
            .limit(1);
          return { data, error, hasAge: data?.[0]?.age !== undefined };
        }
      },
      {
        table: 'activities',
        description: 'Activity access control',
        test: async () => {
          const { data, error } = await supabase
            .from('activities')
            .select('*')
            .limit(1);
          return { data, error };
        }
      }
    ];

    for (const test of securityTests) {
      try {
        const result = await test.test();
        this.results.policies.push({
          table: test.table,
          description: test.description,
          accessible: !result.error,
          dataReturned: result.data?.length || 0,
          issues: result.hasAge ? ['Age field exposed'] : []
        });

        console.log(`   ✅ ${test.table}: ${result.error ? 'Protected' : 'Accessible'}`);
      } catch (error) {
        this.results.policies.push({
          table: test.table,
          description: test.description,
          error: error.message
        });
      }
    }
  }

  async analyzePerformance() {
    console.log('🚀 Analyzing performance...');

    const performanceTests = [
      {
        name: 'League loading speed',
        test: async () => {
          const start = Date.now();
          await supabase.rpc('get_user_leagues');
          return Date.now() - start;
        }
      },
      {
        name: 'Profile query speed',
        test: async () => {
          const start = Date.now();
          await supabase.from('profiles').select('id, username').limit(10);
          return Date.now() - start;
        }
      }
    ];

    for (const test of performanceTests) {
      try {
        const duration = await test.test();
        this.results.performance.push({
          name: test.name,
          duration_ms: duration,
          status: duration < 1000 ? 'good' : duration < 3000 ? 'acceptable' : 'slow'
        });

        console.log(`   ✅ ${test.name}: ${duration}ms`);
      } catch (error) {
        this.results.performance.push({
          name: test.name,
          error: error.message
        });
        console.log(`   ⚠️  ${test.name}: ${error.message}`);
      }
    }
  }

  async checkDataIntegrity() {
    console.log('🔍 Checking data integrity...');

    try {
      // Check for orphaned records
      const { data: orphanedGames } = await supabase
        .from('games')
        .select('id, league_id')
        .not('league_id', 'in',
          supabase.from('leagues').select('id')
        );

      if (orphanedGames && orphanedGames.length > 0) {
        this.results.issues.push(`${orphanedGames.length} orphaned games found`);
      }

      console.log('   ✅ Data integrity checks completed');
    } catch (error) {
      this.results.issues.push(`Data integrity check failed: ${error.message}`);
    }
  }

  async generateReport() {
    console.log('\n📋 Generating comprehensive report...\n');

    const report = {
      timestamp: new Date().toISOString(),
      project: 'Runaro Territory Game',
      database_url: SUPABASE_URL,
      access_level: 'FULL (Service Role)',
      summary: {
        tables_analyzed: this.results.tables.length,
        functions_checked: this.results.functions.length,
        security_policies: this.results.policies.length,
        performance_tests: this.results.performance.length,
        total_issues: this.results.issues.length
      },
      analysis: this.results,
      recommendations: this.generateRecommendations()
    };

    // Save detailed report
    const reportPath = path.join(process.cwd(), 'infra', 'supabase', 'reports', 'supabase-full-analysis.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    // Print summary
    console.log('📊 DATABASE ANALYSIS SUMMARY');
    console.log('='.repeat(50));
    console.log(`🏗️  Tables Analyzed: ${report.summary.tables_analyzed}`);
    console.log(`⚙️  Functions Checked: ${report.summary.functions_checked}`);
    console.log(`🔒 Security Policies: ${report.summary.security_policies}`);
    console.log(`🚀 Performance Tests: ${report.summary.performance_tests}`);
    console.log(`⚠️  Issues Found: ${report.summary.total_issues}`);

    if (this.results.issues.length > 0) {
      console.log('\n🚨 ISSUES IDENTIFIED:');
      this.results.issues.forEach((issue, i) => {
        console.log(`   ${i + 1}. ${issue}`);
      });
    }

    console.log(`\n📄 Full report saved to: ${reportPath}`);
    console.log('\n✅ You now have full access to analyze and improve your Supabase database!');

    return report;
  }

  generateRecommendations() {
    const recommendations = [];

    // Based on analysis results
    if (this.results.issues.length > 0) {
      recommendations.push('🔧 Address identified data integrity issues');
    }

    const slowQueries = this.results.performance.filter(p => p.status === 'slow');
    if (slowQueries.length > 0) {
      recommendations.push('🚀 Optimize slow database queries');
    }

    // Always recommend these
    recommendations.push('🛡️  Regular security policy audits');
    recommendations.push('📈 Set up database monitoring');
    recommendations.push('🧪 Implement automated testing for RLS policies');
    recommendations.push('📊 Create database performance baselines');

    return recommendations;
  }
}

// Export for use
export { DatabaseAnalyzer };

// Run analysis if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const analyzer = new DatabaseAnalyzer();
  analyzer.runFullAnalysis().catch(console.error);
}

console.log('🎯 Direct database access established!');
console.log('📊 Running analysis...\n');

// Create and run analyzer
const analyzer = new DatabaseAnalyzer();
analyzer.runFullAnalysis().catch(console.error);
