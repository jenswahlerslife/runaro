const { Client } = require('pg');
require('dotenv').config({ path: '.env.production' });

async function verifyLiveFunctions() {
  const client = new Client({
    connectionString: `postgresql://postgres.ojjpslrhyutizwpvvngu:${process.env.SUPABASE_DB_PASSWORD}@aws-0-eu-central-1.pooler.supabase.com:6543/postgres`,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('='.repeat(80));
    console.log('PHASE 1: VERIFY LIVE FUNCTION STATE');
    console.log('='.repeat(80));
    console.log();

    const functions = [
      'get_active_game_for_league(uuid)',
      'get_game_overview(uuid)',
      'set_player_base(uuid, uuid)'
    ];

    for (const func of functions) {
      console.log(`Checking: ${func}`);
      console.log('-'.repeat(80));

      const result = await client.query(
        `SELECT pg_get_functiondef($1::regprocedure) as definition`,
        [`public.${func}`]
      );

      const def = result.rows[0]?.definition || 'NOT FOUND';

      // Check for broken patterns
      const hasVuid = def.includes('lm.user_id = v_uid');
      const hasAuthUid = def.includes('lm.user_id = auth.uid()');
      const hasProfileId = def.includes('v_profile_id uuid');
      const hasMapping = def.includes('SELECT id INTO v_profile_id');
      const hasCorrectCheck = def.includes('lm.user_id = v_profile_id');

      console.log(`  v_profile_id variable: ${hasProfileId ? '✅' : '❌'}`);
      console.log(`  Maps auth.uid() to profile: ${hasMapping ? '✅' : '❌'}`);
      console.log(`  Correct check (v_profile_id): ${hasCorrectCheck ? '✅' : '❌'}`);
      console.log(`  BROKEN: lm.user_id = v_uid: ${hasVuid ? '❌ YES' : '✅ NO'}`);
      console.log(`  BROKEN: lm.user_id = auth.uid(): ${hasAuthUid ? '❌ YES' : '✅ NO'}`);

      const status = (hasProfileId && hasMapping && hasCorrectCheck && !hasVuid && !hasAuthUid) ? '✅ CORRECT' : '❌ BROKEN';
      console.log(`  Overall: ${status}`);
      console.log();
    }

    console.log('='.repeat(80));
    console.log('SUMMARY');
    console.log('='.repeat(80));
    console.log('If any function shows BROKEN patterns, Phase 2 migration is needed.');

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.end();
  }
}

verifyLiveFunctions();
