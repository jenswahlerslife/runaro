#!/usr/bin/env node
/**
 * Schema Assertions: Verify Auth Mapping in Database Functions
 *
 * This script ensures no function uses the broken pattern:
 * - lm.user_id = v_uid (BROKEN)
 * - lm.user_id = auth.uid() (BROKEN)
 *
 * All functions MUST use:
 * - Map: auth.uid() → profiles.id
 * - Check: lm.user_id = v_profile_id
 *
 * Exit codes:
 * - 0: All assertions passed
 * - 1: Assertions failed (broken patterns detected)
 * - 2: Connection or query error
 */

const { Client } = require('pg');
require('dotenv').config({ path: '.env.production' });

const FUNCTIONS_TO_CHECK = [
  'get_active_game_for_league(uuid)',
  'get_game_overview(uuid)',
  'set_player_base(uuid, uuid)'
];

const BROKEN_PATTERNS = [
  { pattern: /lm\.user_id\s*=\s*v_uid/g, description: 'lm.user_id = v_uid' },
  { pattern: /lm\.user_id\s*=\s*auth\.uid\(\)/g, description: 'lm.user_id = auth.uid()' }
];

const REQUIRED_PATTERNS = [
  { pattern: /v_profile_id\s+uuid/g, description: 'v_profile_id uuid variable' },
  { pattern: /SELECT\s+id\s+INTO\s+v_profile_id\s+FROM\s+public\.profiles/gi, description: 'auth.uid() → profiles.id mapping' },
  { pattern: /lm\.user_id\s*=\s*v_profile_id/g, description: 'lm.user_id = v_profile_id check' }
];

async function verifyFunctions() {
  const client = new Client({
    connectionString: `postgresql://postgres.ojjpslrhyutizwpvvngu:${process.env.SUPABASE_DB_PASSWORD}@aws-0-eu-central-1.pooler.supabase.com:6543/postgres`,
    ssl: { rejectUnauthorized: false }
  });

  let exitCode = 0;

  try {
    await client.connect();
    console.log('='.repeat(80));
    console.log('SCHEMA ASSERTIONS: Verifying Function Auth Mapping');
    console.log('='.repeat(80));
    console.log();

    for (const func of FUNCTIONS_TO_CHECK) {
      console.log(`Checking: public.${func}`);
      console.log('-'.repeat(80));

      let result;
      try {
        result = await client.query(
          `SELECT pg_get_functiondef($1::regprocedure) as definition`,
          [`public.${func}`]
        );
      } catch (err) {
        console.error(`❌ ERROR: Function not found or inaccessible`);
        console.error(`   ${err.message}`);
        exitCode = 2;
        continue;
      }

      const def = result.rows[0]?.definition;
      if (!def) {
        console.error(`❌ ERROR: Could not retrieve function definition`);
        exitCode = 2;
        continue;
      }

      let funcFailed = false;

      // Check for BROKEN patterns
      for (const { pattern, description } of BROKEN_PATTERNS) {
        const matches = def.match(pattern);
        if (matches) {
          console.error(`  ❌ BROKEN PATTERN DETECTED: ${description}`);
          console.error(`     Found ${matches.length} occurrence(s)`);
          funcFailed = true;
          exitCode = 1;
        } else {
          console.log(`  ✅ No broken pattern: ${description}`);
        }
      }

      // Check for REQUIRED patterns
      for (const { pattern, description } of REQUIRED_PATTERNS) {
        const matches = def.match(pattern);
        if (!matches) {
          console.error(`  ❌ MISSING REQUIRED PATTERN: ${description}`);
          funcFailed = true;
          exitCode = 1;
        } else {
          console.log(`  ✅ Required pattern found: ${description}`);
        }
      }

      console.log(`  Status: ${funcFailed ? '❌ FAILED' : '✅ PASSED'}`);
      console.log();
    }

    console.log('='.repeat(80));
    if (exitCode === 0) {
      console.log('✅ ALL ASSERTIONS PASSED');
      console.log('All functions use correct auth.uid() → profiles.id mapping');
    } else if (exitCode === 1) {
      console.log('❌ ASSERTION FAILURES DETECTED');
      console.log('One or more functions have broken auth patterns');
      console.log('');
      console.log('To fix: Run migrations in supabase/migrations/ with timestamps');
      console.log('after 20260101000006 (the rollup migration)');
    } else {
      console.log('⚠️  ERRORS OCCURRED');
      console.log('Could not complete verification');
    }
    console.log('='.repeat(80));

  } catch (error) {
    console.error('FATAL ERROR:', error.message);
    exitCode = 2;
  } finally {
    await client.end();
  }

  process.exit(exitCode);
}

verifyFunctions();
