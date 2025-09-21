#!/usr/bin/env node

/**
 * Game Setup Bottleneck Analysis
 * Investigate why 39 games are stuck in setup status
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ojjpslrhyutizwpvvngu.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9qanBzbHJoeXV0aXp3cHZ2bmd1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjIzMDI0NSwiZXhwIjoyMDcxODA2MjQ1fQ.Wm6AbiLNjIVM-T4a7TUhBMphb5EW9fMMLJC9-wSJNS4';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function analyzeGameSetupFlow() {
  console.log('🎮 GAME SETUP FLOW ANALYSIS');
  console.log('='.repeat(50));

  try {
    // Get all games with their status distribution
    const { data: gameStats } = await supabase
      .from('games')
      .select('status, created_at, start_date, duration_days, league_id')
      .order('created_at', { ascending: false });

    if (gameStats) {
      const statusCounts = gameStats.reduce((acc, game) => {
        acc[game.status] = (acc[game.status] || 0) + 1;
        return acc;
      }, {});

      console.log('\n📊 GAME STATUS DISTRIBUTION:');
      Object.entries(statusCounts).forEach(([status, count]) => {
        console.log(`   ${status}: ${count} games`);
      });

      // Analyze setup games specifically
      const setupGames = gameStats.filter(g => g.status === 'setup');
      console.log(`\n🔍 ANALYZING ${setupGames.length} SETUP GAMES:`);

      if (setupGames.length > 0) {
        // Age analysis
        const now = new Date();
        const ageGroups = {
          'Less than 1 hour': 0,
          '1-24 hours': 0,
          '1-7 days': 0,
          'More than 7 days': 0
        };

        setupGames.forEach(game => {
          const created = new Date(game.created_at);
          const ageHours = (now - created) / (1000 * 60 * 60);

          if (ageHours < 1) ageGroups['Less than 1 hour']++;
          else if (ageHours < 24) ageGroups['1-24 hours']++;
          else if (ageHours < 168) ageGroups['1-7 days']++;
          else ageGroups['More than 7 days']++;
        });

        console.log('\n⏰ SETUP GAME AGE DISTRIBUTION:');
        Object.entries(ageGroups).forEach(([age, count]) => {
          console.log(`   ${age}: ${count} games`);
        });

        // Show oldest setup games
        const oldestSetup = setupGames
          .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
          .slice(0, 5);

        console.log('\n📅 OLDEST SETUP GAMES:');
        oldestSetup.forEach((game, i) => {
          const age = Math.floor((now - new Date(game.created_at)) / (1000 * 60 * 60 * 24));
          console.log(`   ${i + 1}. Game ${game.league_id} - ${age} days old`);
        });

        // Check if games have required data
        console.log('\n🔍 SETUP GAME COMPLETENESS:');
        const incomplete = setupGames.filter(g => !g.start_date || !g.duration_days);
        console.log(`   Games missing start_date or duration: ${incomplete.length}`);

        if (incomplete.length > 0) {
          console.log('   🚨 These games cannot progress without start_date and duration_days');
        }
      }

      // Check player_bases for setup games
      const { data: playerBases } = await supabase
        .from('player_bases')
        .select('game_id')
        .in('game_id', setupGames.map(g => g.id));

      console.log(`\n🏠 PLAYER BASES ANALYSIS:`);
      console.log(`   Setup games with bases: ${new Set(playerBases?.map(pb => pb.game_id) || []).size}`);
      console.log(`   Setup games without bases: ${setupGames.length - new Set(playerBases?.map(pb => pb.game_id) || []).size}`);

      // Check league relationships
      const leagueGameCounts = setupGames.reduce((acc, game) => {
        acc[game.league_id] = (acc[game.league_id] || 0) + 1;
        return acc;
      }, {});

      console.log(`\n🏆 LEAGUES WITH SETUP GAMES:`);
      Object.entries(leagueGameCounts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .forEach(([leagueId, count]) => {
          console.log(`   League ${leagueId}: ${count} setup games`);
        });

    }

    console.log('\n🎯 POTENTIAL ISSUES:');
    console.log('1. Games stuck in setup may be missing start_date or duration_days');
    console.log('2. Users may not understand how to progress from setup to active');
    console.log('3. Player base selection may be failing or confusing');
    console.log('4. Automatic game activation may not be working');

  } catch (error) {
    console.error('❌ Analysis failed:', error.message);
  }
}

async function checkGameSetupProcess() {
  console.log('\n🔍 CHECKING GAME SETUP PROCESS...');

  try {
    // Check if create_game function exists and works
    console.log('   🧪 Testing create_game function...');

    // This will fail if function doesn't exist or has issues
    const { error: createGameError } = await supabase
      .rpc('create_game', {
        p_league_id: '00000000-0000-0000-0000-000000000000', // Dummy UUID
        p_name: 'Test Game',
        p_duration_days: 7
      });

    if (createGameError) {
      console.log(`   ❌ create_game function issue: ${createGameError.message}`);
    } else {
      console.log('   ✅ create_game function exists (test with dummy data)');
    }

    // Check if set_player_base function exists
    console.log('   🧪 Testing set_player_base function...');
    const { error: setBaseError } = await supabase
      .rpc('set_player_base', {
        p_game_id: '00000000-0000-0000-0000-000000000000',
        p_activity_id: '00000000-0000-0000-0000-000000000000'
      });

    if (setBaseError) {
      console.log(`   ❌ set_player_base function issue: ${setBaseError.message}`);
    } else {
      console.log('   ✅ set_player_base function exists (test with dummy data)');
    }

    // Check recent error reports related to game setup
    const { data: setupErrors } = await supabase
      .from('error_reports')
      .select('error_message, error_type, created_at')
      .or('error_message.ilike.%setup%,error_message.ilike.%game%,error_message.ilike.%base%')
      .order('created_at', { ascending: false })
      .limit(10);

    if (setupErrors && setupErrors.length > 0) {
      console.log('\n🚨 RECENT SETUP-RELATED ERRORS:');
      setupErrors.forEach(error => {
        console.log(`   - ${error.error_type}: ${error.error_message.substring(0, 100)}...`);
      });
    } else {
      console.log('\n📝 No recent setup-related errors found');
    }

  } catch (error) {
    console.error('❌ Process check failed:', error.message);
  }
}

// Run analysis
analyzeGameSetupFlow()
  .then(() => checkGameSetupProcess())
  .then(() => {
    console.log('\n✅ Game setup analysis complete!');
  })
  .catch(console.error);