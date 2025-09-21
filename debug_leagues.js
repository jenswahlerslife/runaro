// Debug script for investigating league membership issues
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  'https://ojjpslrhyutizwpvvngu.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function debugLeagues() {
  console.log('🏆 Debugging League Membership Issues');
  console.log('====================================');

  try {
    // 1. Check all tables related to leagues
    console.log('\n1. Checking leagues table...');
    const { data: leagues, error: leaguesError } = await supabase
      .from('leagues')
      .select('*')
      .limit(5);

    if (leaguesError) throw leaguesError;
    console.log('Leagues found:', leagues?.length || 0);

    if (leagues && leagues.length > 0) {
      leagues.forEach(league => {
        console.log(`  - ${league.name} (ID: ${league.id})`);
        console.log(`    Admin: ${league.admin_user_id}`);
        console.log(`    Created: ${league.created_at}`);
      });
    }

    // 2. Check league_members table
    console.log('\n2. Checking league_members table...');
    const { data: members, error: membersError } = await supabase
      .from('league_members')
      .select('*')
      .limit(10);

    if (membersError) throw membersError;
    console.log('League members found:', members?.length || 0);

    if (members && members.length > 0) {
      members.forEach(member => {
        console.log(`  - User: ${member.user_id}, League: ${member.league_id}, Status: ${member.status}, Role: ${member.role}`);
      });
    }

    // 3. Check league_join_requests table
    console.log('\n3. Checking league_join_requests table...');
    const { data: requests, error: requestsError } = await supabase
      .from('league_join_requests')
      .select('*')
      .limit(10);

    if (requestsError) throw requestsError;
    console.log('Join requests found:', requests?.length || 0);

    if (requests && requests.length > 0) {
      requests.forEach(request => {
        console.log(`  - User: ${request.user_id}, League: ${request.league_id}, Status: ${request.status}`);
      });
    }

    // 4. Check profiles table for users
    console.log('\n4. Checking profiles table...');
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, user_id, username, display_name')
      .limit(10);

    if (profilesError) throw profilesError;
    console.log('Profiles found:', profiles?.length || 0);

    if (profiles && profiles.length > 0) {
      profiles.forEach(profile => {
        console.log(`  - ${profile.username || profile.display_name || 'No name'} (Profile ID: ${profile.id}, User ID: ${profile.user_id})`);
      });
    }

    // 5. Check if we have a pattern issue - maybe there's a league_memberships view?
    console.log('\n5. Checking for league_memberships view...');
    const { data: memberships, error: membershipsError } = await supabase
      .from('league_memberships')
      .select('*')
      .limit(10);

    if (membershipsError) {
      console.log('No league_memberships view found:', membershipsError.message);
    } else {
      console.log('League memberships found:', memberships?.length || 0);
      if (memberships && memberships.length > 0) {
        memberships.forEach(membership => {
          console.log(`  - User: ${membership.user_id}, League: ${membership.league_id}, Status: ${membership.status}`);
        });
      }
    }

    // 6. Try to find the jennertester user specifically
    console.log('\n6. Looking for jennertester user...');
    const { data: jenner, error: jennerError } = await supabase
      .from('profiles')
      .select('*')
      .or('username.ilike.%jenner%, display_name.ilike.%jenner%');

    if (jennerError) throw jennerError;
    console.log('Jennertester profiles found:', jenner?.length || 0);

    if (jenner && jenner.length > 0) {
      jenner.forEach(profile => {
        console.log(`  - ${profile.username || profile.display_name} (Profile ID: ${profile.id}, User ID: ${profile.user_id})`);
      });

      // Check if jennertester has any league associations
      const jennerProfileId = jenner[0].id;
      console.log(`\n7. Checking jennertester's league associations (Profile ID: ${jennerProfileId})...`);

      // Check league_members
      const { data: jennerMembers } = await supabase
        .from('league_members')
        .select('*')
        .eq('user_id', jennerProfileId);

      console.log('Jennertester league_members records:', jennerMembers?.length || 0);

      // Check league_join_requests
      const { data: jennerRequests } = await supabase
        .from('league_join_requests')
        .select('*')
        .eq('user_id', jennerProfileId);

      console.log('Jennertester join requests:', jennerRequests?.length || 0);

      // Check if jennertester is admin of any league
      const { data: adminLeagues } = await supabase
        .from('leagues')
        .select('*')
        .eq('admin_user_id', jennerProfileId);

      console.log('Leagues where jennertester is admin:', adminLeagues?.length || 0);
      if (adminLeagues && adminLeagues.length > 0) {
        adminLeagues.forEach(league => {
          console.log(`  - ${league.name} (ID: ${league.id})`);
        });
      }
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

// Run the debug
debugLeagues().then(() => {
  console.log('\n🏁 League debug completed');
  process.exit(0);
}).catch(error => {
  console.error('💥 Debug failed:', error);
  process.exit(1);
});