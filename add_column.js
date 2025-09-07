// Add included_in_game column to user_activities table
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
    console.log('🔄 Adding included_in_game column to user_activities...');
    
    // First, let's try to add the column using a stored procedure approach
    // We'll create a function that can execute DDL
    
    const createFunctionSQL = `
      CREATE OR REPLACE FUNCTION add_included_in_game_column()
      RETURNS void
      LANGUAGE plpgsql
      SECURITY DEFINER
      AS $$
      BEGIN
        -- Add column if it doesn't exist
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'user_activities' 
          AND column_name = 'included_in_game'
        ) THEN
          ALTER TABLE public.user_activities
            ADD COLUMN included_in_game boolean NOT NULL DEFAULT true;
          RAISE NOTICE 'Column included_in_game added successfully';
        ELSE
          RAISE NOTICE 'Column included_in_game already exists';
        END IF;
        
        -- Update any NULL values (shouldn't be any with NOT NULL DEFAULT, but just in case)
        UPDATE public.user_activities 
        SET included_in_game = true 
        WHERE included_in_game IS NULL;
        
        RAISE NOTICE 'Column update completed';
      END;
      $$;
    `;
    
    console.log('📝 Creating helper function...');
    const { error: functionError } = await supabase.rpc('exec', { 
      sql: createFunctionSQL 
    });
    
    if (functionError) {
      console.error('❌ Function creation failed:', functionError.message);
      // Try alternative approach
      return await alternativeApproach();
    }
    
    console.log('⚡ Executing column addition...');
    const { data, error } = await supabase.rpc('add_included_in_game_column');
    
    if (error) {
      console.error('❌ Column addition failed:', error.message);
      return false;
    }
    
    console.log('✅ Column added successfully!');
    
    // Verify the column was added
    const { data: verifyData, error: verifyError } = await supabase
      .from('user_activities')
      .select('included_in_game')
      .limit(1);
    
    if (verifyError) {
      console.error('❌ Verification failed:', verifyError.message);
      return false;
    }
    
    console.log('✅ Column verified successfully!');
    return true;
    
  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
    return false;
  }
}

async function alternativeApproach() {
  console.log('🔄 Trying alternative approach...');
  
  // Check if column already exists by trying to select it
  const { data, error } = await supabase
    .from('user_activities')
    .select('included_in_game')
    .limit(1);
  
  if (error && error.message.includes('column "included_in_game" does not exist')) {
    console.log('❗ Column does not exist. You need to run this SQL manually in Supabase SQL Editor:');
    console.log('');
    console.log('ALTER TABLE public.user_activities');
    console.log('  ADD COLUMN IF NOT EXISTS included_in_game boolean NOT NULL DEFAULT true;');
    console.log('');
    return false;
  } else if (!error) {
    console.log('✅ Column already exists!');
    return true;
  } else {
    console.error('❌ Unexpected error:', error.message);
    return false;
  }
}

addIncludedInGameColumn()
  .then((success) => {
    console.log(success ? '\n🎉 Column addition completed!' : '\n❌ Manual intervention required!');
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });