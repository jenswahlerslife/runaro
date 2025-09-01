// Fix Activities database issue
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ojjpslrhyutizwpvvngu.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9qanBzbHJoeXV0aXp3cHZ2bmd1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjIzMDI0NSwiZXhwIjoyMDcxODA2MjQ1fQ.Wm6AbiLNjIVM-T4a7TUhBMphb5EW9fMMLJC9-wSJNS4';

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function addIncludedInGameColumn() {
  try {
    console.log('🔄 Adding included_in_game column...');
    
    // This needs to be done via SQL Editor in Supabase Dashboard
    // Cannot execute DDL directly via client
    console.log('❗ Please run this SQL in your Supabase SQL Editor:');
    console.log('');
    console.log('ALTER TABLE public.user_activities');
    console.log('  ADD COLUMN IF NOT EXISTS included_in_game boolean NOT NULL DEFAULT true;');
    console.log('');
    console.log('UPDATE public.user_activities SET included_in_game = true WHERE included_in_game IS NULL;');
    console.log('');
    
    return true;
    
  } catch (error) {
    console.error('❌ Failed to add column:', error.message);
    return false;
  }
}

addIncludedInGameColumn();