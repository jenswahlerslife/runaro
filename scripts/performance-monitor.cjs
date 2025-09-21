#!/usr/bin/env node
/**
 * Performance Monitoring for Schema Changes
 * Phase 2: Continuous Performance Tracking
 *
 * This script monitors database performance over time and tracks
 * the impact of schema changes on query performance.
 */

const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const { performance } = require('perf_hooks');
const fs = require('fs');
const path = require('path');

// Load environment variables
dotenv.config({ path: '.env.production' });

const supabaseUrl = process.env.SUPABASE_URL || 'https://ojjpslrhyutizwpvvngu.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables');
  console.error('Required: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

class PerformanceMonitor {
  constructor() {
    this.metricsFile = path.join(process.cwd(), 'performance-metrics.json');
    this.currentSession = {
      timestamp: new Date().toISOString(),
      metrics: [],
      summary: {}
    };
  }

  async runPerformanceMonitoring() {
    console.log('📊 Starting Performance Monitoring');
    console.log('=' .repeat(50));

    try {
      // Load historical metrics
      await this.loadHistoricalMetrics();

      // Run performance benchmarks
      await this.runCoreBenchmarks();

      // Analyze trends
      await this.analyzeTrends();

      // Save results
      await this.saveMetrics();

      // Generate report
      this.generatePerformanceReport();

    } catch (error) {
      console.error('❌ Performance monitoring failed:', error.message);
      process.exit(1);
    }
  }

  async loadHistoricalMetrics() {
    try {
      if (fs.existsSync(this.metricsFile)) {
        const data = fs.readFileSync(this.metricsFile, 'utf8');
        this.historicalMetrics = JSON.parse(data);
        console.log(`📈 Loaded ${this.historicalMetrics.length} historical sessions`);
      } else {
        this.historicalMetrics = [];
        console.log('📈 No historical metrics found - starting fresh');
      }
    } catch (error) {
      console.warn('⚠️  Could not load historical metrics:', error.message);
      this.historicalMetrics = [];
    }
  }

  async runCoreBenchmarks() {
    console.log('\n⚡ Running Core Performance Benchmarks...');

    const benchmarks = [
      {
        name: 'Database Health Check',
        test: () => supabase.rpc('get_database_health')
      },
      {
        name: 'Profile Count Query',
        test: () => supabase.from('profiles').select('count', { count: 'exact', head: true })
      },
      {
        name: 'Active Leagues Query',
        test: () => supabase.from('leagues').select('id, name, admin_user_id').limit(10)
      },
      {
        name: 'League Members Query',
        test: () => supabase.from('league_members').select('user_id, league_id, status').eq('status', 'approved').limit(10)
      },
      {
        name: 'Active Games Query',
        test: () => supabase.from('games').select('id, name, status, league_id').eq('status', 'active').limit(10)
      },
      {
        name: 'Setup Games Query',
        test: () => supabase.from('games').select('id, name, status, league_id').eq('status', 'setup').limit(10)
      },
      {
        name: 'Error Reports Count',
        test: () => supabase.from('error_reports').select('count', { count: 'exact', head: true })
      },
      {
        name: 'Activity Count Query',
        test: () => supabase.from('activities').select('count', { count: 'exact', head: true })
      },
      {
        name: 'Player Bases Query',
        test: () => supabase.from('player_bases').select('game_id, user_id').limit(10)
      },
      {
        name: 'Complex Join Query',
        test: () => supabase
          .from('games')
          .select(`
            id, name, status,
            leagues:league_id (
              id, name, admin_user_id
            )
          `)
          .limit(5)
      }
    ];

    for (const benchmark of benchmarks) {
      await this.runSingleBenchmark(benchmark);

      // Small delay between benchmarks to avoid overwhelming the database
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  async runSingleBenchmark(benchmark) {
    const runs = 3; // Run each benchmark 3 times for accuracy
    const durations = [];

    for (let i = 0; i < runs; i++) {
      try {
        const start = performance.now();
        const { error } = await benchmark.test();
        const duration = performance.now() - start;

        if (error) {
          console.error(`  ❌ ${benchmark.name} (run ${i + 1}): ${error.message}`);
          continue;
        }

        durations.push(duration);

        // Small delay between runs
        if (i < runs - 1) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }

      } catch (error) {
        console.error(`  ❌ ${benchmark.name} (run ${i + 1}): ${error.message}`);
      }
    }

    if (durations.length > 0) {
      const avgDuration = durations.reduce((sum, d) => sum + d, 0) / durations.length;
      const minDuration = Math.min(...durations);
      const maxDuration = Math.max(...durations);

      this.currentSession.metrics.push({
        name: benchmark.name,
        avgDuration,
        minDuration,
        maxDuration,
        runs: durations.length,
        durations
      });

      const status = avgDuration < 50 ? '🟢' : avgDuration < 100 ? '🟡' : avgDuration < 200 ? '🟠' : '🔴';
      console.log(`  ${status} ${benchmark.name}: ${avgDuration.toFixed(2)}ms (min: ${minDuration.toFixed(2)}ms, max: ${maxDuration.toFixed(2)}ms)`);

    } else {
      console.error(`  ❌ ${benchmark.name}: All runs failed`);
    }
  }

  async analyzeTrends() {
    console.log('\n📊 Analyzing Performance Trends...');

    if (this.historicalMetrics.length === 0) {
      console.log('  ℹ️  No historical data for trend analysis');
      return;
    }

    // Calculate average performance metrics
    const avgMetrics = this.calculateAverageMetrics();
    this.currentSession.summary = avgMetrics;

    // Compare with historical data
    const recentSessions = this.historicalMetrics.slice(-5); // Last 5 sessions
    if (recentSessions.length > 0) {
      const historicalAvg = this.calculateHistoricalAverage(recentSessions);
      this.compareWithHistorical(avgMetrics, historicalAvg);
    }
  }

  calculateAverageMetrics() {
    const totalMetrics = this.currentSession.metrics.length;
    if (totalMetrics === 0) return {};

    const totalAvgDuration = this.currentSession.metrics.reduce((sum, m) => sum + m.avgDuration, 0) / totalMetrics;
    const fastest = Math.min(...this.currentSession.metrics.map(m => m.minDuration));
    const slowest = Math.max(...this.currentSession.metrics.map(m => m.maxDuration));

    return {
      totalAvgDuration,
      fastest,
      slowest,
      totalQueries: totalMetrics
    };
  }

  calculateHistoricalAverage(sessions) {
    const allAvgDurations = sessions.map(s => s.summary?.totalAvgDuration).filter(Boolean);
    if (allAvgDurations.length === 0) return null;

    return {
      avgDuration: allAvgDurations.reduce((sum, d) => sum + d, 0) / allAvgDurations.length
    };
  }

  compareWithHistorical(current, historical) {
    if (!historical || !historical.avgDuration) {
      console.log('  ℹ️  Insufficient historical data for comparison');
      return;
    }

    const currentAvg = current.totalAvgDuration;
    const historicalAvg = historical.avgDuration;
    const change = ((currentAvg - historicalAvg) / historicalAvg) * 100;

    console.log(`\n  📈 Performance Comparison:`);
    console.log(`     Current Session:  ${currentAvg.toFixed(2)}ms`);
    console.log(`     Historical Avg:   ${historicalAvg.toFixed(2)}ms`);

    if (change > 10) {
      console.log(`     🔴 Performance Degradation: +${change.toFixed(1)}% slower`);
    } else if (change > 5) {
      console.log(`     🟠 Performance Warning: +${change.toFixed(1)}% slower`);
    } else if (change < -5) {
      console.log(`     🟢 Performance Improvement: ${Math.abs(change).toFixed(1)}% faster`);
    } else {
      console.log(`     🟡 Performance Stable: ${change.toFixed(1)}% change`);
    }

    this.currentSession.summary.historicalComparison = {
      change,
      status: change > 10 ? 'degraded' : change > 5 ? 'warning' : change < -5 ? 'improved' : 'stable'
    };
  }

  async saveMetrics() {
    try {
      this.historicalMetrics.push(this.currentSession);

      // Keep only the last 50 sessions to prevent file from growing too large
      if (this.historicalMetrics.length > 50) {
        this.historicalMetrics = this.historicalMetrics.slice(-50);
      }

      fs.writeFileSync(this.metricsFile, JSON.stringify(this.historicalMetrics, null, 2));
      console.log(`\n💾 Saved performance metrics to ${this.metricsFile}`);

    } catch (error) {
      console.error('❌ Failed to save metrics:', error.message);
    }
  }

  generatePerformanceReport() {
    console.log('\n' + '='.repeat(50));
    console.log('📊 PERFORMANCE MONITORING REPORT');
    console.log('='.repeat(50));

    const summary = this.currentSession.summary;

    console.log(`\n🎯 Current Session Summary:`);
    console.log(`   Average Query Time: ${summary.totalAvgDuration?.toFixed(2) || 'N/A'}ms`);
    console.log(`   Fastest Query: ${summary.fastest?.toFixed(2) || 'N/A'}ms`);
    console.log(`   Slowest Query: ${summary.slowest?.toFixed(2) || 'N/A'}ms`);
    console.log(`   Total Queries Tested: ${summary.totalQueries || 0}`);

    // Performance rating
    const avgTime = summary.totalAvgDuration || 0;
    if (avgTime < 50) {
      console.log('   🟢 Performance Rating: EXCELLENT');
    } else if (avgTime < 100) {
      console.log('   🟡 Performance Rating: GOOD');
    } else if (avgTime < 200) {
      console.log('   🟠 Performance Rating: ACCEPTABLE');
    } else {
      console.log('   🔴 Performance Rating: NEEDS ATTENTION');
    }

    // Historical comparison
    if (summary.historicalComparison) {
      const comp = summary.historicalComparison;
      console.log(`\n📈 Historical Comparison:`);
      console.log(`   Trend: ${comp.status.toUpperCase()}`);
      console.log(`   Change: ${comp.change.toFixed(1)}%`);
    }

    // Top performing queries
    console.log(`\n🏆 Top Performing Queries:`);
    const sortedMetrics = [...this.currentSession.metrics].sort((a, b) => a.avgDuration - b.avgDuration);
    sortedMetrics.slice(0, 3).forEach((metric, index) => {
      console.log(`   ${index + 1}. ${metric.name}: ${metric.avgDuration.toFixed(2)}ms`);
    });

    // Slowest queries
    console.log(`\n🐌 Slowest Queries:`);
    sortedMetrics.slice(-3).reverse().forEach((metric, index) => {
      console.log(`   ${index + 1}. ${metric.name}: ${metric.avgDuration.toFixed(2)}ms`);
    });

    console.log(`\n📅 Monitoring Session: ${this.currentSession.timestamp}`);
    console.log(`📊 Historical Sessions: ${this.historicalMetrics.length}`);

    console.log('\n' + '='.repeat(50));
    console.log('✅ Performance monitoring completed successfully');
  }
}

// Command line execution
if (require.main === module) {
  const monitor = new PerformanceMonitor();
  monitor.runPerformanceMonitoring().catch(error => {
    console.error('❌ Performance monitoring crashed:', error);
    process.exit(1);
  });
}

module.exports = PerformanceMonitor;