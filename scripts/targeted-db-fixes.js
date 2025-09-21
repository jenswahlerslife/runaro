#!/usr/bin/env node

/**
 * Targeted Database Analysis & Fixes
 * Focus on the real issues identified in the comprehensive analysis
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ojjpslrhyutizwpvvngu.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9qanBzbHJoeXV0aXp3cHZ2bmd1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjIzMDI0NSwiZXhwIjoyMDcxODA2MjQ1fQ.Wm6AbiLNjIVM-T4a7TUhBMphb5EW9fMMLJC9-wSJNS4';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

class DatabaseFixer {
  constructor() {
    this.fixes = [];
    this.criticalIssues = [];
  }

  async analyzeAndFix() {
    console.log('🔧 TARGETED DATABASE ANALYSIS & FIXES');
    console.log('='.repeat(50));

    await this.analyzeEmptyTables();
    await this.checkGameFlowFunctionality();
    await this.analyzeMigrationComplexity();
    await this.generateActionPlan();
  }

  async analyzeEmptyTables() {
    console.log('\n📊 ANALYZING EMPTY CRITICAL TABLES...');

    // Check why activities table is empty
    try {
      const { data: stravaUsers } = await supabase
        .from('profiles')
        .select('id, strava_access_token')
        .not('strava_access_token', 'is', null);

      console.log(`   👥 Users with Strava connected: ${stravaUsers?.length || 0}`);

      if (!stravaUsers || stravaUsers.length === 0) {
        this.criticalIssues.push({
          issue: 'No users have connected Strava accounts',
          impact: 'HIGH - Users cannot upload activities',
          fix: 'Check Strava OAuth integration, ensure callback URLs work'
        });
      }

      // Check if activities table structure is correct
      const { data: activitiesSample } = await supabase
        .from('activities')
        .select('*')
        .limit(1);

      console.log(`   📊 Activities table accessible: ${activitiesSample !== null}`);

    } catch (error) {
      this.criticalIssues.push({
        issue: 'Activities table may have structural issues',
        impact: 'HIGH - Core functionality broken',
        fix: `Database error: ${error.message}`
      });
    }

    // Check game flow
    try {
      const { data: activeGames } = await supabase
        .from('games')
        .select('id, status')
        .eq('status', 'active');

      const { data: setupGames } = await supabase
        .from('games')
        .select('id, status')
        .eq('status', 'setup');

      console.log(`   🎮 Active games: ${activeGames?.length || 0}`);
      console.log(`   ⚙️ Setup games: ${setupGames?.length || 0}`);

      if (activeGames?.length === 0 && setupGames?.length === 0) {
        this.criticalIssues.push({
          issue: 'No active or setup games exist',
          impact: 'MEDIUM - Game functionality may be broken',
          fix: 'Check game creation flow, ensure create_game function works'
        });
      }

    } catch (error) {
      this.criticalIssues.push({
        issue: 'Cannot analyze game status',
        impact: 'MEDIUM',
        fix: `Games table issue: ${error.message}`
      });
    }
  }

  async checkGameFlowFunctionality() {
    console.log('\n🎮 CHECKING GAME FLOW FUNCTIONALITY...');

    // Test critical functions with proper parameters
    const functionTests = [
      {
        name: 'get_user_leagues',
        test: async () => {
          // This function requires authentication, so we expect auth error
          const { error } = await supabase.rpc('get_user_leagues');
          return error?.message?.includes('JWT') || error?.message?.includes('auth');
        }
      },
      {
        name: 'get_active_game_for_league',
        test: async () => {
          // Test with a real league ID
          const { data: firstLeague } = await supabase
            .from('leagues')
            .select('id')
            .limit(1);

          if (firstLeague?.length > 0) {
            const { error } = await supabase.rpc('get_active_game_for_league', {
              league_id: firstLeague[0].id
            });
            return !error || error.message?.includes('JWT') || error.message?.includes('auth');
          }
          return false;
        }
      }
    ];

    for (const test of functionTests) {
      try {
        const works = await test.test();
        console.log(`   ${works ? '✅' : '❌'} ${test.name}: ${works ? 'Available' : 'Broken'}`);

        if (!works) {
          this.criticalIssues.push({
            issue: `Function ${test.name} is not working properly`,
            impact: 'HIGH - Core functionality broken',
            fix: 'Check function definition and security policies'
          });
        }

      } catch (error) {
        console.log(`   ❌ ${test.name}: Error - ${error.message}`);
        this.criticalIssues.push({
          issue: `Function ${test.name} threw error`,
          impact: 'HIGH',
          fix: error.message
        });
      }
    }
  }

  async analyzeMigrationComplexity() {
    console.log('\n📋 ANALYZING MIGRATION COMPLEXITY...');

    // Check for recent problematic migrations
    const migrationDir = './supabase/migrations/';
    const fs = await import('fs');
    const files = fs.readdirSync(migrationDir);

    const recentFixes = files.filter(f =>
      f.includes('fix') || f.includes('repair') || f.includes('surgical')
    ).slice(-5);

    console.log(`   🔧 Recent fix migrations: ${recentFixes.length}`);
    console.log(`   📁 Total migrations: ${files.length}`);

    if (files.length > 100) {
      this.criticalIssues.push({
        issue: 'Database has excessive migrations (101+)',
        impact: 'MEDIUM - Deployment complexity, hard to debug',
        fix: 'Consider consolidating into a clean base migration'
      });
    }

    // Check for duplicate or conflicting migrations
    const functionMigrations = files.filter(f =>
      f.toLowerCase().includes('function') ||
      f.toLowerCase().includes('rpc') ||
      f.toLowerCase().includes('create_game')
    );

    console.log(`   ⚙️ Function-related migrations: ${functionMigrations.length}`);

    if (functionMigrations.length > 10) {
      this.criticalIssues.push({
        issue: 'Many function-related migrations suggest instability',
        impact: 'MEDIUM - Function definitions may be inconsistent',
        fix: 'Review and consolidate function definitions'
      });
    }
  }

  async generateActionPlan() {
    console.log('\n📋 GENERATING ACTION PLAN...');

    console.log('\n🚨 CRITICAL ISSUES IDENTIFIED:');
    this.criticalIssues.forEach((issue, i) => {
      console.log(`\n${i + 1}. ${issue.issue}`);
      console.log(`   Impact: ${issue.impact}`);
      console.log(`   Fix: ${issue.fix}`);
    });

    // Generate prioritized action plan
    const highImpactIssues = this.criticalIssues.filter(i => i.impact === 'HIGH');
    const mediumImpactIssues = this.criticalIssues.filter(i => i.impact === 'MEDIUM');

    console.log('\n🎯 IMMEDIATE ACTION PLAN:');
    console.log('1. 🔴 HIGH PRIORITY:');
    highImpactIssues.forEach(issue => {
      console.log(`   • ${issue.issue}`);
    });

    console.log('2. 🟡 MEDIUM PRIORITY:');
    mediumImpactIssues.forEach(issue => {
      console.log(`   • ${issue.issue}`);
    });

    console.log('\n💡 OPTIMIZATION RECOMMENDATIONS:');
    console.log('1. Set up monitoring for empty critical tables');
    console.log('2. Create health check endpoint for functions');
    console.log('3. Implement automated testing for database functions');
    console.log('4. Consider migration consolidation in next major version');
    console.log('5. Add indexes for frequently queried columns');

    console.log('\n✅ Database analysis complete!');
  }
}

const fixer = new DatabaseFixer();
fixer.analyzeAndFix().catch(console.error);