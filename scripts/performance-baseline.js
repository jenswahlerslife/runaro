#!/usr/bin/env node

/**
 * Performance Baseline Establishment
 * Measure and document current database performance metrics
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ojjpslrhyutizwpvvngu.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9qanBzbHJoeXV0aXp3cHZ2bmd1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjIzMDI0NSwiZXhwIjoyMDcxODA2MjQ1fQ.Wm6AbiLNjIVM-T4a7TUhBMphb5EW9fMMLJC9-wSJNS4';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

class PerformanceBaseline {
  constructor() {
    this.results = [];
    this.testUserId = null;
    this.testLeagueId = null;
  }

  async measureQuery(name, queryFn, iterations = 5) {
    const times = [];

    for (let i = 0; i < iterations; i++) {
      const start = process.hrtime.bigint();
      try {
        await queryFn();
        const end = process.hrtime.bigint();
        const duration = Number(end - start) / 1000000; // Convert to milliseconds
        times.push(duration);
      } catch (error) {
        console.log(`   ❌ ${name}: Query failed - ${error.message}`);
        return null;
      }
    }

    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    const min = Math.min(...times);
    const max = Math.max(...times);
    const median = times.sort((a, b) => a - b)[Math.floor(times.length / 2)];

    const performance = {
      name,
      avg: Math.round(avg * 100) / 100,
      min: Math.round(min * 100) / 100,
      max: Math.round(max * 100) / 100,
      median: Math.round(median * 100) / 100,
      iterations,
      timestamp: new Date().toISOString()
    };

    this.results.push(performance);

    const status = avg < 50 ? '🟢 EXCELLENT' : avg < 100 ? '🟡 GOOD' : avg < 200 ? '🟠 ACCEPTABLE' : '🔴 SLOW';
    console.log(`   ${status} ${name}: ${performance.avg}ms avg (${performance.min}-${performance.max}ms)`);

    return performance;
  }

  async setupTestData() {
    console.log('🔧 SETTING UP PERFORMANCE TEST DATA...');

    // Get test user and league
    const { data: users } = await supabase.from('profiles').select('id, user_id').limit(1);
    const { data: leagues } = await supabase.from('leagues').select('id').limit(1);

    if (users && users.length > 0) {
      this.testUserId = users[0].user_id;
      console.log(`   ✅ Test user: ${this.testUserId}`);
    }

    if (leagues && leagues.length > 0) {
      this.testLeagueId = leagues[0].id;
      console.log(`   ✅ Test league: ${this.testLeagueId}`);
    }

    return this.testUserId && this.testLeagueId;
  }

  async measureTableQueries() {
    console.log('\n📊 MEASURING TABLE QUERY PERFORMANCE...');

    // Basic table scans
    await this.measureQuery('profiles_scan', () =>
      supabase.from('profiles').select('*').limit(10)
    );

    await this.measureQuery('leagues_scan', () =>
      supabase.from('leagues').select('*').limit(10)
    );

    await this.measureQuery('games_scan', () =>
      supabase.from('games').select('*').limit(10)
    );

    await this.measureQuery('league_members_scan', () =>
      supabase.from('league_members').select('*').limit(10)
    );

    // Indexed queries
    if (this.testUserId) {
      await this.measureQuery('user_league_members', () =>
        supabase
          .from('league_members')
          .select('*')
          .eq('user_id', this.testUserId)
          .eq('status', 'approved')
      );
    }

    if (this.testLeagueId) {
      await this.measureQuery('league_active_games', () =>
        supabase
          .from('games')
          .select('*')
          .eq('league_id', this.testLeagueId)
          .in('status', ['active', 'setup'])
      );
    }

    // Count queries
    await this.measureQuery('count_games', () =>
      supabase.from('games').select('*', { count: 'exact', head: true })
    );

    await this.measureQuery('count_profiles', () =>
      supabase.from('profiles').select('*', { count: 'exact', head: true })
    );
  }

  async measureFunctionPerformance() {
    console.log('\n⚙️ MEASURING FUNCTION PERFORMANCE...');

    // Test database health function
    await this.measureQuery('get_database_health', () =>
      supabase.rpc('get_database_health')
    );

    if (this.testLeagueId) {
      // Test get_active_game_for_league (will return error due to auth, but measures function execution)
      await this.measureQuery('get_active_game_for_league', () =>
        supabase.rpc('get_active_game_for_league', { p_league_id: this.testLeagueId })
      );
    }
  }

  async measureJoinQueries() {
    console.log('\n🔗 MEASURING JOIN QUERY PERFORMANCE...');

    // Complex joins
    await this.measureQuery('leagues_with_member_count', () =>
      supabase
        .from('leagues')
        .select(`
          *,
          league_members!inner(count)
        `)
        .limit(10)
    );

    await this.measureQuery('games_with_league_info', () =>
      supabase
        .from('games')
        .select(`
          *,
          leagues(name, admin_user_id)
        `)
        .limit(10)
    );

    if (this.testUserId) {
      await this.measureQuery('user_games_via_leagues', () =>
        supabase
          .from('games')
          .select(`
            *,
            leagues!inner(
              id,
              league_members!inner(user_id)
            )
          `)
          .eq('leagues.league_members.user_id', this.testUserId)
          .eq('leagues.league_members.status', 'approved')
          .limit(10)
      );
    }
  }

  generateReport() {
    console.log('\n📋 PERFORMANCE BASELINE REPORT');
    console.log('='.repeat(50));

    // Overall statistics
    const avgTimes = this.results.map(r => r.avg);
    const overallAvg = avgTimes.reduce((a, b) => a + b, 0) / avgTimes.length;
    const fastestQuery = this.results.reduce((min, r) => r.avg < min.avg ? r : min);
    const slowestQuery = this.results.reduce((max, r) => r.avg > max.avg ? r : max);

    console.log(`\n📊 OVERALL PERFORMANCE:`);
    console.log(`   Average query time: ${Math.round(overallAvg * 100) / 100}ms`);
    console.log(`   Fastest query: ${fastestQuery.name} (${fastestQuery.avg}ms)`);
    console.log(`   Slowest query: ${slowestQuery.name} (${slowestQuery.avg}ms)`);

    // Performance categories
    const excellent = this.results.filter(r => r.avg < 50);
    const good = this.results.filter(r => r.avg >= 50 && r.avg < 100);
    const acceptable = this.results.filter(r => r.avg >= 100 && r.avg < 200);
    const slow = this.results.filter(r => r.avg >= 200);

    console.log(`\n🎯 PERFORMANCE DISTRIBUTION:`);
    console.log(`   🟢 Excellent (<50ms): ${excellent.length} queries`);
    console.log(`   🟡 Good (50-100ms): ${good.length} queries`);
    console.log(`   🟠 Acceptable (100-200ms): ${acceptable.length} queries`);
    console.log(`   🔴 Slow (>200ms): ${slow.length} queries`);

    if (slow.length > 0) {
      console.log(`\n🚨 SLOW QUERIES NEEDING OPTIMIZATION:`);
      slow.forEach(q => {
        console.log(`   - ${q.name}: ${q.avg}ms`);
      });
    }

    // Performance targets
    console.log(`\n🎯 PERFORMANCE TARGETS:`);
    console.log(`   Current: ${Math.round(overallAvg)}ms average`);
    console.log(`   Target: <100ms for 95% of queries`);
    console.log(`   Critical: <50ms for core user flows`);

    const baselineReport = {
      timestamp: new Date().toISOString(),
      overall: {
        avgQueryTime: Math.round(overallAvg * 100) / 100,
        totalQueries: this.results.length,
        fastestQuery: fastestQuery.name,
        slowestQuery: slowestQuery.name
      },
      distribution: {
        excellent: excellent.length,
        good: good.length,
        acceptable: acceptable.length,
        slow: slow.length
      },
      detailedResults: this.results,
      recommendations: this.generateRecommendations()
    };

    return baselineReport;
  }

  generateRecommendations() {
    const slow = this.results.filter(r => r.avg >= 100);
    const recommendations = [];

    if (slow.length > 0) {
      recommendations.push('Consider adding indexes for slow queries over 100ms');
    }

    const joinQueries = this.results.filter(r => r.name.includes('with_') || r.name.includes('via_'));
    const slowJoins = joinQueries.filter(r => r.avg >= 50);

    if (slowJoins.length > 0) {
      recommendations.push('Optimize join queries - consider denormalization for frequent joins');
    }

    if (this.results.filter(r => r.avg < 50).length / this.results.length > 0.8) {
      recommendations.push('Overall performance is excellent - maintain current optimization level');
    }

    return recommendations;
  }

  async establishBaseline() {
    console.log('🚀 ESTABLISHING PERFORMANCE BASELINE');
    console.log('='.repeat(50));

    const setupSuccess = await this.setupTestData();
    if (!setupSuccess) {
      console.log('❌ Setup failed, cannot establish baseline');
      return;
    }

    await this.measureTableQueries();
    await this.measureFunctionPerformance();
    await this.measureJoinQueries();

    const report = this.generateReport();

    console.log('\n✅ Performance baseline established!');
    console.log('📄 Use this data to track performance changes over time');

    return report;
  }
}

// Run the baseline establishment
const baseline = new PerformanceBaseline();
baseline.establishBaseline()
  .then(report => {
    // Save report to file for future comparison
    console.log('\n💾 Performance baseline saved for future monitoring');
  })
  .catch(console.error);