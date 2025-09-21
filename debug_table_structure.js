// Debug table structure to understand foreign key constraints
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  'https://ojjpslrhyutizwpvvngu.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function debugTableStructure() {
  console.log('🔍 Debugging Table Structure');
  console.log('============================');

  try {
    // 1. Check league_members table structure
    console.log('\n1. Checking league_members foreign key constraints...');

    // Check what table league_members.user_id references
    const { data: constraints, error: constraintsError } = await supabase
      .rpc('sql', {
        query: `
          SELECT
            tc.constraint_name,
            tc.table_name,
            kcu.column_name,
            ccu.table_name AS foreign_table_name,
            ccu.column_name AS foreign_column_name
          FROM information_schema.table_constraints AS tc
          JOIN information_schema.key_column_usage AS kcu
            ON tc.constraint_name = kcu.constraint_name
          JOIN information_schema.constraint_column_usage AS ccu
            ON ccu.constraint_name = tc.constraint_name
          WHERE tc.constraint_type = 'FOREIGN KEY'
            AND tc.table_name = 'league_members'
            AND kcu.column_name = 'user_id';
        `
      });

    if (constraintsError) {
      console.log('Using direct query approach...');

      // Alternative approach - check existing data
      console.log('\n2. Checking existing leagues and their admin_user_ids...');
      const { data: leagues, error: leaguesError } = await supabase
        .from('leagues')
        .select('id, name, admin_user_id');

      if (leaguesError) throw leaguesError;

      console.log('Leagues with admin_user_ids:');
      leagues?.forEach(league => {
        console.log(`  - ${league.name}: ${league.admin_user_id}`);
      });

      // Check which of these admin_user_ids exist in profiles
      console.log('\n3. Checking which admin_user_ids exist in profiles...');
      for (const league of leagues || []) {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('id, username, user_id')
          .eq('id', league.admin_user_id)
          .maybeSingle();

        if (profileError) {
          console.log(`  ❌ ${league.name}: Profile error - ${profileError.message}`);
        } else if (profile) {
          console.log(`  ✅ ${league.name}: Profile found - ${profile.username} (auth_user: ${profile.user_id})`);
        } else {
          console.log(`  ❌ ${league.name}: No profile found for ID ${league.admin_user_id}`);
        }
      }

      // Check existing league_members to see the expected pattern
      console.log('\n4. Checking existing league_members table...');
      const { data: existingMembers, error: membersError } = await supabase
        .from('league_members')
        .select('*')
        .limit(5);

      if (membersError) throw membersError;

      console.log('Sample league_members records:');
      existingMembers?.forEach(member => {
        console.log(`  - League: ${member.league_id}, User: ${member.user_id}, Role: ${member.role}, Status: ${member.status}`);
      });

      // Check if any of these user_ids exist in profiles
      console.log('\n5. Verifying league_members.user_id references...');
      for (const member of existingMembers || []) {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('id, username')
          .eq('id', member.user_id)
          .maybeSingle();

        if (profileError) {
          console.log(`  ❌ Member ${member.user_id}: Profile error - ${profileError.message}`);
        } else if (profile) {
          console.log(`  ✅ Member ${member.user_id}: Profile found - ${profile.username}`);
        } else {
          console.log(`  ❌ Member ${member.user_id}: No profile found`);
        }
      }

    } else {
      console.log('Foreign key constraints:', constraints);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Run the debug
debugTableStructure().then(() => {
  console.log('\n🏁 Table structure debug completed');
  process.exit(0);
}).catch(error => {
  console.error('💥 Debug failed:', error);
  process.exit(1);
});