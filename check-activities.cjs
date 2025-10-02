const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.production' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkActivities() {
  console.log('Checking user_activities table...\n');

  // Get total count
  const { count: totalCount, error: countError } = await supabase
    .from('user_activities')
    .select('*', { count: 'exact', head: true });

  if (countError) {
    console.error('Error counting activities:', countError.message);
    return;
  }

  console.log(`Total activities in database: ${totalCount}\n`);

  // Get activities per user
  const { data: activities, error } = await supabase
    .from('user_activities')
    .select('user_id, id, name, distance, start_date, strava_activity_id')
    .order('start_date', { ascending: false })
    .limit(10);

  if (error) {
    console.error('Error fetching activities:', error.message);
    return;
  }

  console.log('Most recent 10 activities:');
  activities.forEach((act, i) => {
    console.log(`${i + 1}. User: ${act.user_id.substring(0, 8)}... | ${act.name} | ${(act.distance / 1000).toFixed(2)} km | Strava: ${act.strava_activity_id}`);
  });

  // Group by user
  const { data: userCounts, error: groupError } = await supabase.rpc('get_activity_counts_by_user');

  if (!groupError && userCounts) {
    console.log('\nActivities per user:');
    userCounts.forEach(row => {
      console.log(`  User ${row.user_id.substring(0, 8)}...: ${row.count} activities`);
    });
  }
}

checkActivities().catch(console.error);
