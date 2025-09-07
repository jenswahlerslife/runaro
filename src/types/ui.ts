/**
 * UI-specific types that ensure sensitive data like age is not exposed to the frontend
 * 
 * IMPORTANT: These types should be used in all UI components to prevent accidental 
 * exposure of sensitive profile data like age.
 */

import { Tables } from '@/integrations/supabase/types';

// Profile type for UI that excludes sensitive fields like age
export type UIProfile = Omit<Tables<'profiles'>, 'age' | 'strava_access_token' | 'strava_refresh_token'> & {
  // Only allow these specific fields to be accessed in UI
  username: string | null;
  display_name: string | null;
  id: string;
  user_id: string | null;
  created_at: string | null;
  updated_at: string | null;
  role: string | null;
  strava_athlete_id: number | null;
};

// Specific type for profile queries that should be used in UI
export type UIProfileSelect = Pick<UIProfile, 'username' | 'display_name'>;

/**
 * Example usage in components:
 * 
 * // ✅ Correct - only selects safe fields
 * const { data } = await supabase
 *   .from('profiles')
 *   .select('username, display_name')
 *   .eq('user_id', user.id)
 *   .single();
 * 
 * // ❌ Incorrect - might accidentally select sensitive data
 * const { data } = await supabase
 *   .from('profiles')
 *   .select('*')
 *   .eq('user_id', user.id)
 *   .single();
 */