import { supabase } from '@/integrations/supabase/client';

export interface TerritoryResult {
  success: boolean;
  territory_count: number;
  total_count: number;
  base_count: number;
  tolerance_meters?: number;
  error?: string;
}

/**
 * Sets an activity as the user's base and recalculates territory
 * @param activityId - The activity ID to set as base
 * @param tolerance - Distance tolerance in meters (default 50)
 * @returns Promise with territory calculation result
 */
export async function setActivityAsBase(
  activityId: string,
  tolerance: number = 50
): Promise<TerritoryResult> {
  try {
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return { success: false, territory_count: 0, total_count: 0, base_count: 0, error: 'Not authenticated' };
    }

    // Get user's profile ID (needed for RLS)
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (profileError || !profile) {
      return { success: false, territory_count: 0, total_count: 0, base_count: 0, error: 'Profile not found' };
    }

    // Start transaction-like operations
    // First, unset any existing base for this user
    const { error: unsetError } = await supabase
      .from('user_activities')
      .update({ is_base: false })
      .eq('user_id', profile.id)
      .eq('is_base', true);

    if (unsetError) {
      console.error('Error unsetting previous base:', unsetError);
      return { success: false, territory_count: 0, total_count: 0, base_count: 0, error: unsetError.message };
    }

    // Set the new base
    const { error: setBaseError } = await supabase
      .from('user_activities')
      .update({ is_base: true })
      .eq('id', activityId)
      .eq('user_id', profile.id);

    if (setBaseError) {
      console.error('Error setting new base:', setBaseError);
      return { success: false, territory_count: 0, total_count: 0, base_count: 0, error: setBaseError.message };
    }

    // Call the territory refresh function
    const { data: result, error: territoryError } = await supabase.rpc(
      'refresh_user_territory',
      { 
        p_user: profile.id, 
        p_tolerance_m: tolerance 
      }
    );

    if (territoryError) {
      console.error('Error refreshing territory:', territoryError);
      return { success: false, territory_count: 0, total_count: 0, base_count: 0, error: territoryError.message };
    }

    return result as TerritoryResult;

  } catch (error) {
    console.error('Error in setActivityAsBase:', error);
    return { success: false, territory_count: 0, total_count: 0, base_count: 0, error: String(error) };
  }
}

/**
 * Recalculates the user's territory without changing the base
 * @param tolerance - Distance tolerance in meters (default 50)
 * @returns Promise with territory calculation result
 */
export async function recalculateTerritory(tolerance: number = 50): Promise<TerritoryResult> {
  try {
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return { success: false, territory_count: 0, total_count: 0, base_count: 0, error: 'Not authenticated' };
    }

    // Get user's profile ID (needed for RLS)
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (profileError || !profile) {
      return { success: false, territory_count: 0, total_count: 0, base_count: 0, error: 'Profile not found' };
    }

    // Call the territory refresh function
    const { data: result, error: territoryError } = await supabase.rpc(
      'refresh_user_territory',
      { 
        p_user: profile.id, 
        p_tolerance_m: tolerance 
      }
    );

    if (territoryError) {
      console.error('Error refreshing territory:', territoryError);
      return { success: false, territory_count: 0, total_count: 0, base_count: 0, error: territoryError.message };
    }

    return result as TerritoryResult;

  } catch (error) {
    console.error('Error in recalculateTerritory:', error);
    return { success: false, territory_count: 0, total_count: 0, base_count: 0, error: String(error) };
  }
}

/**
 * Gets the current user's activities with territory information
 * @returns Promise with activities including base and game inclusion status
 */
export async function getUserActivitiesWithTerritory() {
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      throw new Error('Not authenticated');
    }

    // Get user's profile ID
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (profileError || !profile) {
      throw new Error('Profile not found');
    }

    // Fetch activities with territory info (include both route and polyline)
    const { data: activities, error: activitiesError } = await supabase
      .from('user_activities')
      .select(`
        id,
        name,
        distance,
        moving_time,
        activity_type,
        start_date,
        strava_activity_id,
        is_base,
        included_in_game,
        route,
        polyline
      `)
      .eq('user_id', profile.id)
      .order('start_date', { ascending: false });

    if (activitiesError) {
      throw new Error(activitiesError.message);
    }

    return activities || [];

  } catch (error) {
    console.error('Error fetching activities with territory info:', error);
    throw error;
  }
}