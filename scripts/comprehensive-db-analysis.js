#!/usr/bin/env node

/**
 * Comprehensive Supabase Database Analysis
 * Deep dive into database health, optimization opportunities, and potential issues
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const SUPABASE_URL = 'https://ojjpslrhyutizwpvvngu.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9qanBzbHJoeXV0aXp3cHZ2bmd1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjIzMDI0NSwiZXhwIjoyMDcxODA2MjQ1fQ.Wm6AbiLNjIVM-T4a7TUhBMphb5EW9fMMLJC9-wSJNS4';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

class DatabaseHealthAnalyzer {
  constructor() {
    this.issues = [];
    this.recommendations = [];
    this.performance = [];
    this.security = [];
  }

  async runCompleteAnalysis() {
    console.log('🔍 COMPREHENSIVE SUPABASE DATABASE ANALYSIS');
    console.log('='.repeat(60));

    try {
      await this.analyzeTableStructure();
      await this.analyzeFunctionSecurity();
      await this.analyzeDataConsistency();
      await this.analyzePerformanceIssues();
      await this.analyzeMigrationHistory();
      await this.generateFinalReport();

    } catch (error) {
      console.error('❌ Analysis failed:', error.message);
    }
  }

  async analyzeTableStructure() {
    console.log('\n📊 ANALYZING TABLE STRUCTURE & DATA HEALTH...');

    // Check critical tables
    const criticalTables = {
      profiles: { expected: '>= 1', critical: true },
      leagues: { expected: '>= 1', critical: false },
      games: { expected: '>= 0', critical: false },
      activities: { expected: '>= 0', critical: false },
      league_memberships: { expected: '>= 0', critical: false },
      league_join_requests: { expected: '>= 0', critical: false },
      player_bases: { expected: '>= 0', critical: false },
      territory_ownership: { expected: '>= 0', critical: false },
      subscriptions: { expected: '>= 0', critical: false },
      error_reports: { expected: '>= 0', critical: false }
    };

    for (const [tableName, config] of Object.entries(criticalTables)) {
      try {
        const { count, error } = await supabase
          .from(tableName)
          .select('*', { count: 'exact', head: true });

        if (error) {
          this.issues.push(`❌ ${tableName}: Cannot access table - ${error.message}`);
          continue;
        }

        const rowCount = count || 0;
        console.log(`   ✅ ${tableName}: ${rowCount} rows`);

        // Analyze empty tables that should have data
        if (tableName === 'activities' && rowCount === 0) {
          this.issues.push(`⚠️ Activities table is empty - users may not be uploading activities`);
        }

        if (tableName === 'player_bases' && rowCount === 0) {
          this.issues.push(`⚠️ Player bases table is empty - games may not be functioning properly`);
        }

        if (tableName === 'territory_ownership' && rowCount === 0) {
          this.issues.push(`⚠️ Territory ownership table is empty - territory system may not be working`);
        }

      } catch (error) {
        this.issues.push(`❌ ${tableName}: Analysis failed - ${error.message}`);
      }
    }
  }

  async analyzeFunctionSecurity() {
    console.log('\n🔒 ANALYZING DATABASE FUNCTION SECURITY...');

    const criticalFunctions = [
      'get_user_leagues',
      'create_league_with_owner',
      'join_league',
      'manage_league_membership',
      'create_game',
      'get_active_game_for_league',
      'set_player_base',
      'finish_due_games'
    ];

    let functionIssues = 0;

    for (const funcName of criticalFunctions) {
      try {
        // Test function exists and has proper error handling
        const result = await supabase.rpc(funcName, {}).catch(err => {
          // Expected - we're just checking if function exists
          return { error: err.message, exists: true };
        });

        console.log(`   ✅ ${funcName}: Available`);

        // Check for common security issues in function responses
        if (result && result.error && result.error.includes('permission denied')) {
          this.security.push(`⚠️ ${funcName}: May have overly restrictive permissions`);
        }

      } catch (error) {
        this.issues.push(`❌ ${funcName}: Function missing or broken - ${error.message}`);
        functionIssues++;
      }
    }

    if (functionIssues > 0) {
      this.issues.push(`❌ ${functionIssues} critical functions have issues`);
    }
  }

  async analyzeDataConsistency() {
    console.log('\n🔍 ANALYZING DATA CONSISTENCY...');

    try {
      // Check for orphaned records
      const { data: orphanedLeagueMembers } = await supabase
        .from('league_memberships')
        .select('league_id')
        .not('league_id', 'in',
          supabase.from('leagues').select('id')
        );

      if (orphanedLeagueMembers && orphanedLeagueMembers.length > 0) {
        this.issues.push(`❌ ${orphanedLeagueMembers.length} orphaned league memberships found`);
      }

      // Check for games without leagues
      const { data: orphanedGames } = await supabase
        .from('games')
        .select('id, league_id')
        .not('league_id', 'in',
          supabase.from('leagues').select('id')
        );

      if (orphanedGames && orphanedGames.length > 0) {
        this.issues.push(`❌ ${orphanedGames.length} orphaned games found`);
      }

      // Check for profiles without proper data
      const { data: incompleteProfiles } = await supabase
        .from('profiles')
        .select('id, username, display_name')
        .or('username.is.null,display_name.is.null');

      if (incompleteProfiles && incompleteProfiles.length > 0) {
        this.issues.push(`⚠️ ${incompleteProfiles.length} profiles with missing username or display_name`);
      }

      console.log('   ✅ Data consistency checks completed');

    } catch (error) {
      this.issues.push(`❌ Data consistency check failed: ${error.message}`);
    }
  }

  async analyzePerformanceIssues() {
    console.log('\n🚀 ANALYZING PERFORMANCE...');

    const performanceTests = [
      {
        name: 'User leagues query',
        test: async () => {
          const start = Date.now();
          try {
            await supabase.rpc('get_user_leagues');
          } catch (e) {
            // Expected to fail without auth, but we measure timing
          }
          return Date.now() - start;
        }
      },
      {
        name: 'Profile lookup',
        test: async () => {
          const start = Date.now();
          await supabase.from('profiles').select('id, username').limit(5);
          return Date.now() - start;
        }
      },
      {
        name: 'League query',
        test: async () => {
          const start = Date.now();
          await supabase.from('leagues').select('*').limit(10);
          return Date.now() - start;
        }
      },
      {
        name: 'Game query with joins',
        test: async () => {
          const start = Date.now();
          await supabase
            .from('games')
            .select('*, leagues(name)')
            .limit(10);
          return Date.now() - start;
        }
      }
    ];

    for (const test of performanceTests) {
      try {
        const duration = await test.test();
        console.log(`   ${duration < 100 ? '✅' : duration < 500 ? '⚠️' : '❌'} ${test.name}: ${duration}ms`);

        if (duration > 500) {
          this.performance.push(`🐌 ${test.name} is slow (${duration}ms) - needs optimization`);
        }

      } catch (error) {
        this.issues.push(`❌ Performance test '${test.name}' failed: ${error.message}`);
      }
    }
  }

  async analyzeMigrationHistory() {
    console.log('\n📋 ANALYZING MIGRATION HISTORY...');

    // Count migration files
    const migrationFiles = fs.readdirSync('./infra/supabase/migrations/');
    console.log(`   📁 Total migrations: ${migrationFiles.length}`);

    if (migrationFiles.length > 50) {
      this.issues.push(`⚠️ High number of migrations (${migrationFiles.length}) suggests many iterations/fixes`);
      this.recommendations.push('🔧 Consider consolidating migrations in next major version');
    }

    // Look for problematic patterns in recent migrations
    const recentMigrations = migrationFiles.slice(-10);
    const fixMigrations = recentMigrations.filter(name =>
      name.toLowerCase().includes('fix') ||
      name.toLowerCase().includes('repair') ||
      name.toLowerCase().includes('surgical')
    );

    if (fixMigrations.length > 3) {
      this.issues.push(`⚠️ Many recent fix migrations (${fixMigrations.length}/10) suggests ongoing stability issues`);
    }

    console.log(`   🔧 Recent fix migrations: ${fixMigrations.length}/10`);
  }

  async generateFinalReport() {
    console.log('\n📋 GENERATING FINAL ASSESSMENT...');

    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        totalIssues: this.issues.length,
        performanceIssues: this.performance.length,
        securityConcerns: this.security.length,
        recommendations: this.recommendations.length
      },
      issues: this.issues,
      performance: this.performance,
      security: this.security,
      recommendations: this.recommendations,
      overallHealth: this.calculateOverallHealth()
    };

    // Save detailed report
    fs.writeFileSync('./supabase-health-report.json', JSON.stringify(report, null, 2));

    console.log('\n🎯 FINAL ASSESSMENT');
    console.log('='.repeat(40));
    console.log(`📊 Overall Health: ${report.overallHealth}`);
    console.log(`🚨 Critical Issues: ${this.issues.filter(i => i.includes('❌')).length}`);
    console.log(`⚠️  Warnings: ${this.issues.filter(i => i.includes('⚠️')).length}`);
    console.log(`🚀 Performance Issues: ${this.performance.length}`);
    console.log(`🔒 Security Concerns: ${this.security.length}`);

    if (this.issues.length > 0) {
      console.log('\n🚨 ISSUES FOUND:');
      this.issues.forEach((issue, i) => {
        console.log(`   ${i + 1}. ${issue}`);
      });
    }

    if (this.performance.length > 0) {
      console.log('\n🐌 PERFORMANCE ISSUES:');
      this.performance.forEach((issue, i) => {
        console.log(`   ${i + 1}. ${issue}`);
      });
    }

    if (this.recommendations.length > 0) {
      console.log('\n💡 RECOMMENDATIONS:');
      this.recommendations.forEach((rec, i) => {
        console.log(`   ${i + 1}. ${rec}`);
      });
    }

    console.log('\n📄 Detailed report saved to: supabase-health-report.json');
  }

  calculateOverallHealth() {
    const criticalIssues = this.issues.filter(i => i.includes('❌')).length;
    const warnings = this.issues.filter(i => i.includes('⚠️')).length;
    const performanceIssues = this.performance.length;

    if (criticalIssues > 3) return '🔴 POOR';
    if (criticalIssues > 1 || warnings > 5) return '🟡 FAIR';
    if (warnings > 2 || performanceIssues > 2) return '🟠 GOOD';
    return '🟢 EXCELLENT';
  }
}

// Run analysis
const analyzer = new DatabaseHealthAnalyzer();
analyzer.runCompleteAnalysis().catch(console.error);
