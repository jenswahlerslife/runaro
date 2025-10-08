#!/usr/bin/env node

/**
 * Script to assign admin role to a user
 * Usage: node scripts/assign-admin-role.cjs [email]
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://ojjpslrhyutizwpvvngu.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9qanBzbHJoeXV0aXp3cHZ2bmd1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjIzMDI0NSwiZXhwIjoyMDcxODA2MjQ1fQ.Wm6AbiLNjIVM-T4a7TUhBMphb5EW9fMMLJC9-wSJNS4';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function listUsers() {
  console.log('📋 Fetching all users...\n');

  const { data: { users }, error } = await supabase.auth.admin.listUsers();

  if (error) {
    console.error('❌ Error fetching users:', error);
    return null;
  }

  if (!users || users.length === 0) {
    console.log('⚠️  No users found');
    return null;
  }

  console.log('Found users:');
  users.forEach((user, index) => {
    console.log(`${index + 1}. ${user.email} (ID: ${user.id})`);
  });

  return users;
}

async function checkUserRoles(userId) {
  const { data, error } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId);

  if (error) {
    console.error('Error checking roles:', error);
    return [];
  }

  return data || [];
}

async function assignAdminRole(userId, email) {
  console.log(`\n🔧 Assigning admin role to ${email}...`);

  // Check if already admin
  const existingRoles = await checkUserRoles(userId);
  const isAlreadyAdmin = existingRoles.some(r => r.role === 'admin');

  if (isAlreadyAdmin) {
    console.log('✅ User is already an admin!');
    return true;
  }

  // Insert admin role
  const { error } = await supabase
    .from('user_roles')
    .insert({
      user_id: userId,
      role: 'admin'
    });

  if (error) {
    console.error('❌ Error assigning admin role:', error);
    return false;
  }

  console.log('✅ Admin role assigned successfully!');
  return true;
}

async function main() {
  const emailArg = process.argv[2];

  console.log('🚀 Admin Role Assignment Tool\n');
  console.log('============================\n');

  // List all users
  const users = await listUsers();
  if (!users || users.length === 0) {
    process.exit(1);
  }

  // If email provided, find and assign
  if (emailArg) {
    const user = users.find(u => u.email === emailArg);
    if (!user) {
      console.error(`\n❌ User with email "${emailArg}" not found`);
      process.exit(1);
    }

    await assignAdminRole(user.id, user.email);
  } else {
    // No email provided - assign to most recent user
    console.log(`\n💡 No email provided. Assigning admin to most recent user...`);
    const latestUser = users[0];
    await assignAdminRole(latestUser.id, latestUser.email);
  }

  console.log('\n✨ Done!\n');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
