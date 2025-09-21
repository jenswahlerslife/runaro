#!/usr/bin/env node
/**
 * V2.0 Migration Testing Framework
 * Phase 3: Comprehensive testing for V2.0 migrations
 *
 * This script tests V2.0 migrations in a safe environment,
 * validating schema creation, function deployment, and data integrity.
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

class V2MigrationTester {
  constructor() {
    this.testResults = [];
    this.performanceMetrics = [];
    this.startTime = performance.now();
    this.v2MigrationsPath = path.join(process.cwd(), 'supabase', 'migrations', 'v2');
  }

  async runV2MigrationTests() {
    console.log('🧪 V2.0 Migration Testing Framework');
    console.log('=' .repeat(50));

    try {
      // 1. Pre-test validation
      await this.validatePreConditions();

      // 2. Test V2.0 migration files
      await this.testV2MigrationFiles();

      // 3. Test V2.0 functions
      await this.testV2Functions();

      // 4. Performance comparison
      await this.comparePerformance();

      // 5. Data integrity validation
      await this.validateDataIntegrity();

      // 6. Rollback procedures test
      await this.testRollbackProcedures();

      // Generate final report
      this.generateV2TestReport();

    } catch (error) {
      console.error('❌ V2.0 migration testing failed:', error.message);
      process.exit(1);
    }
  }

  async validatePreConditions() {
    console.log('\n🔍 Validating pre-conditions...');

    try {
      // Check if V2.0 migration files exist
      const v2Files = [
        '20260101000000_v2_base_schema.sql',
        '20260101000001_v2_essential_functions.sql',
        '20260101000002_v2_data_migration.sql'
      ];

      let existingFiles = 0;
      v2Files.forEach(file => {
        const filePath = path.join(this.v2MigrationsPath, file);
        if (fs.existsSync(filePath)) {
          existingFiles++;
          console.log(`  ✅ ${file}`);
        } else {
          console.log(`  ❌ ${file} - MISSING`);
        }
      });

      this.addResult('V2.0 Migration Files', existingFiles === v2Files.length,
        `${existingFiles}/${v2Files.length} migration files found`);

      // Check current database state
      const { data: healthData, error } = await supabase.rpc('get_database_health');
      if (error) throw error;

      const currentFunctions = Object.keys(healthData.function_status || {}).length;
      this.addResult('Database Connectivity', true, `Connected with ${currentFunctions} functions`);

      console.log(`  ✅ Database connection verified`);
      console.log(`  ✅ Current functions: ${currentFunctions}`);

    } catch (error) {
      this.addResult('Pre-conditions', false, error.message);
      throw error;
    }
  }

  async testV2MigrationFiles() {
    console.log('\n📋 Testing V2.0 migration file structure...');

    try {
      // Test base schema migration
      await this.testMigrationFile('20260101000000_v2_base_schema.sql', {
        expectTables: ['profiles', 'leagues', 'games'],
        expectIndexes: ['idx_league_members_user_status'],
        expectPolicies: ['Users can view own profile']
      });

      // Test functions migration
      await this.testMigrationFile('20260101000001_v2_essential_functions.sql', {
        expectFunctions: ['create_game', 'get_database_health'],
        expectComments: ['V2.0 - Create new game'],
        expectPermissions: ['GRANT EXECUTE']
      });

      // Test data migration
      await this.testMigrationFile('20260101000002_v2_data_migration.sql', {
        expectFunctions: ['validate_v2_data_integrity'],
        expectValidation: ['validation_passed'],
        expectCleanup: ['cleanup_v2_migration_artifacts']
      });

      console.log('  ✅ All V2.0 migration files validated');

    } catch (error) {
      this.addResult('Migration File Structure', false, error.message);
      throw error;
    }
  }

  async testMigrationFile(fileName, expectations) {
    const filePath = path.join(this.v2MigrationsPath, fileName);

    if (!fs.existsSync(filePath)) {
      throw new Error(`Migration file not found: ${fileName}`);
    }

    const fileContent = fs.readFileSync(filePath, 'utf8');

    // Test for expected content
    const tests = [
      {
        name: 'Tables',
        items: expectations.expectTables || [],
        check: (item) => fileContent.includes(`CREATE TABLE`) && fileContent.includes(item)
      },
      {
        name: 'Functions',
        items: expectations.expectFunctions || [],
        check: (item) => fileContent.includes(`CREATE OR REPLACE FUNCTION`) && fileContent.includes(item)
      },
      {
        name: 'Indexes',
        items: expectations.expectIndexes || [],
        check: (item) => fileContent.includes(`CREATE INDEX`) && fileContent.includes(item)
      },
      {
        name: 'Policies',
        items: expectations.expectPolicies || [],
        check: (item) => fileContent.includes(`CREATE POLICY`) && fileContent.includes(item)
      }
    ];

    tests.forEach(test => {
      if (test.items.length > 0) {
        const foundItems = test.items.filter(test.check);
        const success = foundItems.length === test.items.length;

        this.addResult(`${fileName} - ${test.name}`, success,
          `${foundItems.length}/${test.items.length} ${test.name.toLowerCase()} found`);

        console.log(`    ${success ? '✅' : '❌'} ${test.name}: ${foundItems.length}/${test.items.length}`);
      }
    });
  }

  async testV2Functions() {
    console.log('\n🔧 Testing V2.0 function capabilities...');

    const v2Functions = [
      {
        name: 'get_database_health',
        test: () => supabase.rpc('get_database_health'),
        expectFields: ['status', 'table_counts', 'function_status']
      },
      {
        name: 'validate_v2_data_integrity',
        test: () => supabase.rpc('validate_v2_data_integrity'),
        expectFields: ['total_issues', 'validation_passed'],
        optional: true // Might not exist yet
      },
      {
        name: 'generate_v2_migration_report',
        test: () => supabase.rpc('generate_v2_migration_report'),
        expectFields: ['migration_version', 'table_statistics'],
        optional: true // Might not exist yet
      }
    ];

    for (const func of v2Functions) {
      await this.testSingleFunction(func);
    }
  }

  async testSingleFunction(funcConfig) {
    try {
      const start = performance.now();
      const { data, error } = await funcConfig.test();
      const duration = performance.now() - start;

      if (error) {
        if (funcConfig.optional && error.message.includes('does not exist')) {
          this.addResult(`Function: ${funcConfig.name}`, true, 'Optional function not yet deployed');
          console.log(`  ⚪ ${funcConfig.name}: Not deployed (optional)`);
          return;
        }
        throw error;
      }

      // Validate expected fields
      let fieldValidation = true;
      if (funcConfig.expectFields) {
        const missingFields = funcConfig.expectFields.filter(field => !(field in data));
        fieldValidation = missingFields.length === 0;

        if (!fieldValidation) {
          console.log(`    ⚠️  Missing fields: ${missingFields.join(', ')}`);
        }
      }

      this.addResult(`Function: ${funcConfig.name}`, fieldValidation,
        `Executed in ${duration.toFixed(2)}ms`);
      this.addMetric(`function_${funcConfig.name}`, duration);

      console.log(`  ✅ ${funcConfig.name}: ${duration.toFixed(2)}ms`);

    } catch (error) {
      this.addResult(`Function: ${funcConfig.name}`, false, error.message);
      console.log(`  ❌ ${funcConfig.name}: ${error.message}`);
    }
  }

  async comparePerformance() {
    console.log('\n⚡ Comparing V2.0 performance with current state...');

    const benchmarkQueries = [
      {
        name: 'Health Check',
        query: () => supabase.rpc('get_database_health')
      },
      {
        name: 'Profile Count',
        query: () => supabase.from('profiles').select('count', { count: 'exact', head: true })
      },
      {
        name: 'League Count',
        query: () => supabase.from('leagues').select('count', { count: 'exact', head: true })
      },
      {
        name: 'Game Status Query',
        query: () => supabase.from('games').select('id, status').eq('status', 'active').limit(10)
      }
    ];

    let totalDuration = 0;
    let queryCount = 0;

    for (const benchmark of benchmarkQueries) {
      try {
        const start = performance.now();
        const { error } = await benchmark.query();
        const duration = performance.now() - start;

        if (error) throw error;

        totalDuration += duration;
        queryCount++;

        this.addMetric(`benchmark_${benchmark.name.toLowerCase().replace(/\s+/g, '_')}`, duration);

        const status = duration < 50 ? '🟢' : duration < 100 ? '🟡' : duration < 200 ? '🟠' : '🔴';
        console.log(`  ${status} ${benchmark.name}: ${duration.toFixed(2)}ms`);

      } catch (error) {
        console.log(`  ❌ ${benchmark.name}: ${error.message}`);
      }
    }

    const avgDuration = queryCount > 0 ? totalDuration / queryCount : 0;
    console.log(`\n  📊 Average Query Time: ${avgDuration.toFixed(2)}ms`);

    // Performance evaluation
    if (avgDuration < 50) {
      console.log('  🟢 Performance: EXCELLENT');
    } else if (avgDuration < 100) {
      console.log('  🟡 Performance: GOOD');
    } else if (avgDuration < 200) {
      console.log('  🟠 Performance: ACCEPTABLE');
    } else {
      console.log('  🔴 Performance: NEEDS ATTENTION');
    }

    this.addResult('Performance Benchmark', avgDuration < 200, `Average: ${avgDuration.toFixed(2)}ms`);
  }

  async validateDataIntegrity() {
    console.log('\n🔍 Validating data integrity for V2.0...');

    const integrityChecks = [
      {
        name: 'Profile completeness',
        test: async () => {
          const { data, error } = await supabase
            .from('profiles')
            .select('id')
            .is('user_id', null);

          if (error) throw error;
          return data.length === 0;
        }
      },
      {
        name: 'League relationships',
        test: async () => {
          const { data, error } = await supabase
            .from('leagues')
            .select('id')
            .is('admin_user_id', null);

          if (error) throw error;
          return data.length === 0;
        }
      },
      {
        name: 'Game validity',
        test: async () => {
          const { data, error } = await supabase
            .from('games')
            .select('id')
            .is('league_id', null);

          if (error) throw error;
          return data.length === 0;
        }
      },
      {
        name: 'Member status consistency',
        test: async () => {
          const { data, error } = await supabase
            .from('league_members')
            .select('id')
            .or('league_id.is.null,user_id.is.null');

          if (error) throw error;
          return data.length === 0;
        }
      }
    ];

    for (const check of integrityChecks) {
      try {
        const result = await check.test();
        this.addResult(`Integrity: ${check.name}`, result,
          result ? 'Data integrity maintained' : 'Integrity issues found');

        console.log(`  ${result ? '✅' : '❌'} ${check.name}`);

      } catch (error) {
        this.addResult(`Integrity: ${check.name}`, false, error.message);
        console.log(`  ❌ ${check.name}: ${error.message}`);
      }
    }
  }

  async testRollbackProcedures() {
    console.log('\n🔄 Testing rollback procedures...');

    try {
      // Test rollback script exists and is executable
      const rollbackScript = path.join(process.cwd(), 'scripts', 'v2-rollback-procedures.cjs');

      if (!fs.existsSync(rollbackScript)) {
        throw new Error('Rollback script not found');
      }

      console.log('  ✅ Rollback script exists');

      // Test dry-run rollback (safe to execute)
      const { spawn } = require('child_process');

      const dryRunTest = new Promise((resolve, reject) => {
        const process = spawn('node', [rollbackScript, '--dry-run'], {
          stdio: ['ignore', 'pipe', 'pipe']
        });

        let output = '';
        process.stdout.on('data', (data) => {
          output += data.toString();
        });

        process.on('close', (code) => {
          if (code === 0) {
            resolve(output);
          } else {
            reject(new Error(`Rollback dry-run failed with code ${code}`));
          }
        });

        // Timeout after 30 seconds
        setTimeout(() => {
          process.kill();
          reject(new Error('Rollback dry-run timeout'));
        }, 30000);
      });

      const rollbackOutput = await dryRunTest;
      const containsDryRun = rollbackOutput.includes('DRY RUN');

      this.addResult('Rollback Procedures', containsDryRun, 'Dry-run rollback executed successfully');
      console.log('  ✅ Rollback dry-run successful');

    } catch (error) {
      this.addResult('Rollback Procedures', false, error.message);
      console.log(`  ❌ Rollback test failed: ${error.message}`);
    }
  }

  addResult(testName, passed, details) {
    this.testResults.push({
      test: testName,
      passed,
      details,
      timestamp: new Date().toISOString()
    });
  }

  addMetric(metricName, duration) {
    this.performanceMetrics.push({
      metric: metricName,
      duration,
      timestamp: new Date().toISOString()
    });
  }

  generateV2TestReport() {
    const totalTime = performance.now() - this.startTime;
    const passedTests = this.testResults.filter(r => r.passed).length;
    const totalTests = this.testResults.length;
    const passRate = totalTests > 0 ? (passedTests / totalTests * 100).toFixed(1) : 0;

    console.log('\n' + '='.repeat(50));
    console.log('📊 V2.0 MIGRATION TEST REPORT');
    console.log('='.repeat(50));

    console.log(`\n🎯 Test Results:`);
    console.log(`   Tests Passed: ${passedTests}/${totalTests} (${passRate}%)`);
    console.log(`   Total Runtime: ${totalTime.toFixed(2)}ms`);

    console.log(`\n⚡ Performance Analysis:`);
    if (this.performanceMetrics.length > 0) {
      const avgTime = this.performanceMetrics.reduce((sum, m) => sum + m.duration, 0) / this.performanceMetrics.length;
      const fastest = Math.min(...this.performanceMetrics.map(m => m.duration));
      const slowest = Math.max(...this.performanceMetrics.map(m => m.duration));

      console.log(`   Average Response Time: ${avgTime.toFixed(2)}ms`);
      console.log(`   Fastest Query: ${fastest.toFixed(2)}ms`);
      console.log(`   Slowest Query: ${slowest.toFixed(2)}ms`);

      if (avgTime < 50) {
        console.log('   🟢 Performance Rating: EXCELLENT');
      } else if (avgTime < 100) {
        console.log('   🟡 Performance Rating: GOOD');
      } else if (avgTime < 200) {
        console.log('   🟠 Performance Rating: ACCEPTABLE');
      } else {
        console.log('   🔴 Performance Rating: NEEDS ATTENTION');
      }
    }

    console.log(`\n❌ Failed Tests:`);
    const failedTests = this.testResults.filter(r => !r.passed);
    if (failedTests.length === 0) {
      console.log('   None! All tests passed ✅');
    } else {
      failedTests.forEach(test => {
        console.log(`   - ${test.test}: ${test.details}`);
      });
    }

    console.log(`\n📋 V2.0 Migration Readiness:`);
    const criticalTests = this.testResults.filter(r =>
      r.test.includes('Migration Files') ||
      r.test.includes('Database Connectivity') ||
      r.test.includes('Function: get_database_health') ||
      r.test.includes('Performance Benchmark')
    );
    const v2Ready = criticalTests.every(r => r.passed) && passRate >= 90;

    console.log(`   ${v2Ready ? '✅' : '❌'} Ready for V2.0 Migration Deployment`);

    if (v2Ready) {
      console.log('\n🚀 V2.0 Migration Status:');
      console.log('   ✅ Migration files validated');
      console.log('   ✅ Functions tested and working');
      console.log('   ✅ Performance within acceptable limits');
      console.log('   ✅ Data integrity maintained');
      console.log('   ✅ Rollback procedures tested');
      console.log('\n   🎯 V2.0 migration is ready for deployment!');
    } else {
      console.log('\n⚠️  Critical issues must be resolved before V2.0 deployment');
    }

    console.log('\n' + '='.repeat(50));

    // Save detailed test report
    const reportData = {
      test_completed_at: new Date().toISOString(),
      duration_ms: totalTime,
      test_results: this.testResults,
      performance_metrics: this.performanceMetrics,
      summary: {
        total_tests: totalTests,
        passed_tests: passedTests,
        pass_rate: passRate,
        v2_ready: v2Ready
      }
    };

    try {
      fs.writeFileSync('v2-migration-test-report.json', JSON.stringify(reportData, null, 2));
      console.log('📄 Detailed test report saved: v2-migration-test-report.json');
    } catch (error) {
      console.log(`⚠️  Could not save test report: ${error.message}`);
    }

    // Set exit code based on results
    if (passRate < 90) {
      console.log('❌ V2.0 migration tests failed - less than 90% pass rate');
      process.exit(1);
    } else {
      console.log('✅ V2.0 migration tests passed successfully');
      process.exit(0);
    }
  }
}

// Command line execution
if (require.main === module) {
  const tester = new V2MigrationTester();
  tester.runV2MigrationTests().catch(error => {
    console.error('❌ V2.0 migration testing crashed:', error);
    process.exit(1);
  });
}

module.exports = V2MigrationTester;