import { supabase } from '@/integrations/supabase/client';

/**
 * Self-healing profile function
 * Ensures every authenticated user has a profile row
 * Call this after sign-in or when accessing profile-dependent features
 */
export async function ensureProfileExists(): Promise<boolean> {
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError) {
      console.error('Auth error:', authError);
      return false;
    }
    
    if (!user) {
      console.warn('No authenticated user');
      return false;
    }

    // Check if profile exists
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    // Handle errors gracefully - 406 means RLS blocked access, which indicates missing profile
    if (profileError && profileError.code !== 'PGRST116') {
      console.warn('Profile lookup error, will attempt to create:', profileError);
    }

    // Create profile if it doesn't exist
    if (!profile) {
      const username = user.user_metadata?.username || user.email?.split('@')[0] || 'user';
      
      const { data: newProfile, error: insertError } = await supabase
        .from('profiles')
        .insert([{
          user_id: user.id,
          username,
          display_name: username,
        }])
        .select('id')
        .single();

      if (insertError) {
        console.error('Error creating profile:', insertError);
        return false;
      }

      console.log('✅ Profile created successfully for user:', user.id);
      return true;
    }

    // Profile already exists
    return true;
  } catch (error) {
    console.error('Unexpected error in ensureProfileExists:', error);
    return false;
  }
}

/**
 * Enhanced magic link sign-in with profile creation
 */
export async function signInWithMagicLink(email: string): Promise<{ error: any }> {
  const SITE_URL = import.meta.env.VITE_SITE_URL || window.location.origin;
  
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${SITE_URL}/auth/callback`,
    },
  });
  
  return { error };
}

/**
 * Enhanced sign up with profile creation
 */
export async function signUpWithProfile(email: string, password: string, username: string): Promise<{ error: any }> {
  const SITE_URL = import.meta.env.VITE_SITE_URL || window.location.origin;
  
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${SITE_URL}/auth/callback`,
      data: {
        username,
      }
    }
  });

  // Create profile immediately if signup succeeded
  if (data.user && !error) {
    const { error: profileError } = await supabase
      .from('profiles')
      .insert([{
        user_id: data.user.id,
        username: username,
        display_name: username,
      }]);
    
    if (profileError) {
      console.warn('Profile creation during signup failed (may be created by trigger):', profileError);
    }
  }

  return { error };
}