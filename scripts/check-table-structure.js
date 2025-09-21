#!/usr/bin/env node

/**
 * Check Table Structure
 * Verify the actual structure of league_memberships table
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ojjpslrhyutizwpvvngu.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9qanBzbHJoeXV0aXp3cHZ2bmd1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjIzMDI0NSwiZXhwIjoyMDcxODA2MjQ1fQ.Wm6AbiLNjIVM-T4a7TUhBMphb5EW9fMMLJC9-wSJNS4';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function checkTableStructure() {
  console.log('🔍 CHECKING TABLE STRUCTURES...');

  try {
    // Check league_memberships table structure
    const { data: sample, error } = await supabase
      .from('league_memberships')
      .select('*')
      .limit(1);

    if (error) {
      console.log('❌ league_memberships error:', error.message);
    } else {
      console.log('\n📊 league_memberships table exists');
      if (sample && sample.length > 0) {
        console.log('   Sample columns:', Object.keys(sample[0]));
      } else {
        console.log('   Table is empty');
      }
    }

    // Check if there's a different table name
    const tables = ['league_members', 'league_membership', 'memberships'];

    for (const tableName of tables) {
      try {
        const { data: testData, error: testError } = await supabase
          .from(tableName)
          .select('*')
          .limit(1);

        if (!testError) {
          console.log(`\n✅ Found table: ${tableName}`);
          if (testData && testData.length > 0) {
            console.log('   Columns:', Object.keys(testData[0]));
          }
        }
      } catch (e) {
        // Table doesn't exist, that's fine
      }
    }

    // Check games table structure
    const { data: gamesSample, error: gamesError } = await supabase
      .from('games')
      .select('*')
      .limit(1);

    if (!gamesError && gamesSample && gamesSample.length > 0) {
      console.log('\n📊 games table columns:', Object.keys(gamesSample[0]));
    }

    // Get actual data from league_memberships
    const { data: memberships } = await supabase
      .from('league_memberships')
      .select('*');

    if (memberships) {
      console.log(`\n📈 league_memberships has ${memberships.length} rows`);
      if (memberships.length > 0) {
        console.log('   Sample data:', memberships[0]);
      }
    }

  } catch (error) {
    console.error('❌ Check failed:', error.message);
  }
}

checkTableStructure().catch(console.error);