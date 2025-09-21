#!/usr/bin/env node

/**
 * Core Function Test Suite
 * Test all critical database functions to ensure they work properly
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ojjpslrhyutizwpvvngu.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9qanBzbHJoeXV0aXp3cHZ2bmd1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjIzMDI0NSwiZXhwIjoyMDcxODA2MjQ1fQ.Wm6AbiLNjIVM-T4a7TUhBMphb5EW9fMMLJC9-wSJNS4';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

class FunctionTestSuite {
  constructor() {
    this.testResults = [];
    this.testLeagueId = null;
    this.testUserId = null;
  }

  log(test, status, message, details = null) {
    const result = { test, status, message, details, timestamp: new Date().toISOString() };
    this.testResults.push(result);

    const statusIcon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
    console.log(`   ${statusIcon} ${test}: ${message}`);
    if (details) console.log(`      Details: ${JSON.stringify(details, null, 2)}`);
  }

  async setupTestData() {
    console.log('\n🔧 SETTING UP TEST DATA...');

    try {
      // Get an existing user and league for testing
      const { data: users } = await supabase
        .from('profiles')
        .select('id, user_id')
        .limit(1);

      if (users && users.length > 0) {
        this.testUserId = users[0].user_id;
        this.log('setup', 'PASS', `Found test user: ${this.testUserId}`);
      } else {
        this.log('setup', 'FAIL', 'No users found for testing');
        return false;
      }

      // Get an existing league
      const { data: leagues } = await supabase
        .from('leagues')
        .select('id')
        .limit(1);

      if (leagues && leagues.length > 0) {
        this.testLeagueId = leagues[0].id;
        this.log('setup', 'PASS', `Found test league: ${this.testLeagueId}`);
      } else {
        this.log('setup', 'FAIL', 'No leagues found for testing');
        return false;
      }

      return true;
    } catch (error) {
      this.log('setup', 'FAIL', `Setup failed: ${error.message}`);
      return false;
    }
  }

  async testFunction(name, params, expectedFields = []) {
    try {
      const startTime = Date.now();
      const { data, error } = await supabase.rpc(name, params);
      const duration = Date.now() - startTime;

      if (error) {
        this.log(name, 'FAIL', `Function error: ${error.message}`, { params, error });
        return false;
      }

      // Check if function returns expected structure
      let structureValid = true;
      let missingFields = [];

      if (expectedFields.length > 0 && data) {
        for (const field of expectedFields) {
          if (typeof data === 'object' && !(field in data)) {
            structureValid = false;
            missingFields.push(field);
          }
        }
      }

      if (!structureValid) {
        this.log(name, 'WARN', `Function works but missing expected fields: ${missingFields.join(', ')}`, { data, params });
      } else {
        this.log(name, 'PASS', `Function works correctly (${duration}ms)`, { params, response: data });
      }

      return true;
    } catch (error) {
      this.log(name, 'FAIL', `Function test failed: ${error.message}`, { params });
      return false;
    }
  }

  async testCoreGameFunctions() {
    console.log('\n🎮 TESTING CORE GAME FUNCTIONS...');

    // Test get_active_game_for_league
    await this.testFunction(
      'get_active_game_for_league',
      { p_league_id: this.testLeagueId },
      ['game']
    );

    // Test create_game (3-parameter version)
    const testGameName = `Test Game ${Date.now()}`;
    const createResult = await this.testFunction(
      'create_game',
      {
        p_league_id: this.testLeagueId,
        p_name: testGameName,
        p_duration_days: 14
      },
      ['success', 'id', 'game_name', 'duration_days']
    );

    // Test create_game (2-parameter version for backward compatibility)
    await this.testFunction(
      'create_game',
      {
        p_league_id: this.testLeagueId,
        p_name: `Test Game 2-param ${Date.now()}`
      },
      ['success', 'id', 'game_name']
    );

    return createResult;
  }

  async testPlayerBaseFunctions() {
    console.log('\n🏠 TESTING PLAYER BASE FUNCTIONS...');

    // Get a test game
    const { data: games } = await supabase
      .from('games')
      .select('id')
      .eq('league_id', this.testLeagueId)
      .limit(1);

    if (!games || games.length === 0) {
      this.log('set_player_base', 'SKIP', 'No games found for testing');
      return;
    }

    const testGameId = games[0].id;

    // Test set_player_base with dummy data (will fail but we can test function exists)
    await this.testFunction(
      'set_player_base',
      {
        p_game_id: testGameId,
        p_activity_id: '00000000-0000-0000-0000-000000000000' // Dummy UUID
      }
    );
  }

  async testDatabaseHealth() {
    console.log('\n🏥 TESTING DATABASE HEALTH FUNCTIONS...');

    // Test get_database_health if it exists
    await this.testFunction('get_database_health', {});
  }

  async testTableAccess() {
    console.log('\n📊 TESTING TABLE ACCESS...');

    const tables = [
      'profiles',
      'leagues',
      'league_members',
      'league_memberships',
      'games',
      'activities',
      'player_bases',
      'error_reports'
    ];

    for (const table of tables) {
      try {
        const startTime = Date.now();
        const { data, error } = await supabase
          .from(table)
          .select('*')
          .limit(1);
        const duration = Date.now() - startTime;

        if (error) {
          this.log(`table_${table}`, 'FAIL', `Table access failed: ${error.message}`);
        } else {
          const rowCount = data ? data.length : 0;
          this.log(`table_${table}`, 'PASS', `Table accessible (${duration}ms), ${rowCount} sample rows`);
        }
      } catch (error) {
        this.log(`table_${table}`, 'FAIL', `Table test failed: ${error.message}`);
      }
    }
  }

  async testPerformanceIndexes() {
    console.log('\n🚀 TESTING PERFORMANCE INDEXES...');

    const indexQueries = [
      {
        name: 'league_members_user_status',
        query: () => supabase
          .from('league_members')
          .select('*')
          .eq('user_id', this.testUserId)
          .eq('status', 'approved')
      },
      {
        name: 'games_league_status',
        query: () => supabase
          .from('games')
          .select('*')
          .eq('league_id', this.testLeagueId)
          .in('status', ['active', 'setup'])
      },
      {
        name: 'activities_user_created',
        query: () => supabase
          .from('activities')
          .select('*')
          .eq('user_id', this.testUserId)
          .order('created_at', { ascending: false })
          .limit(10)
      }
    ];

    for (const { name, query } of indexQueries) {
      try {
        const startTime = Date.now();
        const { data, error } = await query();
        const duration = Date.now() - startTime;

        if (error) {
          this.log(`index_${name}`, 'FAIL', `Index query failed: ${error.message}`);
        } else {
          const performanceStatus = duration < 100 ? 'EXCELLENT' : duration < 500 ? 'GOOD' : 'SLOW';
          this.log(`index_${name}`, 'PASS', `Query completed in ${duration}ms (${performanceStatus})`);
        }
      } catch (error) {
        this.log(`index_${name}`, 'FAIL', `Index test failed: ${error.message}`);
      }
    }
  }

  async generateReport() {
    console.log('\n📋 FUNCTION TEST REPORT');
    console.log('='.repeat(50));

    const summary = this.testResults.reduce((acc, result) => {
      acc[result.status] = (acc[result.status] || 0) + 1;
      return acc;
    }, {});

    console.log(`\n📊 SUMMARY:`);
    console.log(`   ✅ PASS: ${summary.PASS || 0}`);
    console.log(`   ⚠️  WARN: ${summary.WARN || 0}`);
    console.log(`   ❌ FAIL: ${summary.FAIL || 0}`);
    console.log(`   ⏭️  SKIP: ${summary.SKIP || 0}`);

    const totalTests = this.testResults.length;
    const successRate = ((summary.PASS || 0) / totalTests * 100).toFixed(1);
    console.log(`\n🎯 SUCCESS RATE: ${successRate}%`);

    // Show failed tests
    const failedTests = this.testResults.filter(r => r.status === 'FAIL');
    if (failedTests.length > 0) {
      console.log(`\n❌ FAILED TESTS:`);
      failedTests.forEach(test => {
        console.log(`   - ${test.test}: ${test.message}`);
      });
    }

    // Show warnings
    const warningTests = this.testResults.filter(r => r.status === 'WARN');
    if (warningTests.length > 0) {
      console.log(`\n⚠️  WARNINGS:`);
      warningTests.forEach(test => {
        console.log(`   - ${test.test}: ${test.message}`);
      });
    }

    // Save detailed results
    const detailedReport = {
      summary,
      successRate: parseFloat(successRate),
      totalTests,
      testResults: this.testResults,
      timestamp: new Date().toISOString()
    };

    return detailedReport;
  }

  async runAllTests() {
    console.log('🧪 CORE FUNCTION TEST SUITE');
    console.log('='.repeat(50));

    const setupSuccess = await this.setupTestData();
    if (!setupSuccess) {
      console.log('❌ Setup failed, cannot run tests');
      return;
    }

    await this.testTableAccess();
    await this.testCoreGameFunctions();
    await this.testPlayerBaseFunctions();
    await this.testDatabaseHealth();
    await this.testPerformanceIndexes();

    const report = await this.generateReport();

    console.log('\n✅ Function testing complete!');
    return report;
  }
}

// Run the test suite
const testSuite = new FunctionTestSuite();
testSuite.runAllTests().catch(console.error);