// @ts-nocheck
import { supabase } from '@/integrations/supabase/client';

export interface TerritoryCalculationResult {
  success: boolean;
  territory_count: number;
  total_activities: number;
  territory_area_km2: number;
  base_date: string;
  error?: string;
}

export interface TakeoverResult {
  success: boolean;
  takeovers_created: number;
  activity_name: string;
  error?: string;
}

export interface LeaderboardEntry {
  user_id: string;
  user_email: string;
  territory_size_km2: number;
  activity_count: number;
  base_activity_name: string;
  last_activity_date: string;
  rank: number;
}

export interface GameFinishResult {
  success: boolean;
  winner_user_id: string;
  winner_email: string;
  winner_territory_km2: number;
  winner_base_name: string;
  error?: string;
}

/**
 * Calculates territory for a specific player in a game
 */
export async function calculatePlayerTerritory(
  gameId: string,
  userId: string,
  tolerance: number = 50
): Promise<TerritoryCalculationResult> {
  try {
    const { data, error } = await supabase.rpc('calculate_player_territory' as any, {
      p_game_id: gameId,
      p_user_id: userId,
      p_tolerance_m: tolerance
    });

    if (error) throw error;
    return data as TerritoryCalculationResult;
  } catch (error) {
    console.error('Error calculating player territory:', error);
    return {
      success: false,
      territory_count: 0,
      total_activities: 0,
      territory_area_km2: 0,
      base_date: '',
      error: String(error)
    };
  }
}

/**
 * Checks for territory takeovers when a new activity is added
 */
export async function checkTerritoryTakeover(
  gameId: string,
  activityId: string,
  tolerance: number = 50
): Promise<TakeoverResult> {
  try {
    const { data, error } = await supabase.rpc('check_territory_takeover', {
      p_game_id: gameId,
      p_new_activity_id: activityId,
      p_tolerance_m: tolerance
    });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error checking territory takeover:', error);
    return {
      success: false,
      takeovers_created: 0,
      activity_name: '',
      error: String(error)
    };
  }
}

/**
 * Recalculates territories for all players in a game
 */
export async function recalculateGameTerritories(
  gameId: string,
  tolerance: number = 50
): Promise<{
  success: boolean;
  players_updated: number;
  total_territory_km2: number;
  tolerance_meters: number;
  error?: string;
}> {
  try {
    const { data, error } = await supabase.rpc('recalculate_game_territories', {
      p_game_id: gameId,
      p_tolerance_m: tolerance
    });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error recalculating game territories:', error);
    return {
      success: false,
      players_updated: 0,
      total_territory_km2: 0,
      tolerance_meters: tolerance,
      error: String(error)
    };
  }
}

/**
 * Gets the leaderboard for a game
 */
export async function getGameLeaderboard(gameId: string): Promise<LeaderboardEntry[]> {
  try {
    const { data, error } = await supabase.rpc('get_game_leaderboard' as any, {
      p_game_id: gameId
    });

    if (error) throw error;
    return (data || []) as LeaderboardEntry[];
  } catch (error) {
    console.error('Error fetching game leaderboard:', error);
    throw error;
  }
}

/**
 * Finishes a game and determines the winner
 */
export async function finishGame(gameId: string): Promise<GameFinishResult> {
  try {
    const { data, error } = await supabase.rpc('finish_game', {
      p_game_id: gameId
    });

    if (error) throw error;
    return data as GameFinishResult;
  } catch (error) {
    console.error('Error finishing game:', error);
    return {
      success: false,
      winner_user_id: '',
      winner_email: '',
      winner_territory_km2: 0,
      winner_base_name: '',
      error: String(error)
    };
  }
}

/**
 * Gets territory takeovers for a game
 */
export async function getGameTakeovers(gameId: string): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from('territory_takeovers')
      .select(`
        *,
        taken_from:profiles!territory_takeovers_taken_from_user_id_fkey(email),
        taken_by:profiles!territory_takeovers_taken_by_user_id_fkey(email),
        activity:user_activities!territory_takeovers_activity_id_fkey(name, start_date)
      `)
      .eq('game_id', gameId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching game takeovers:', error);
    throw error;
  }
}

/**
 * Gets current user's activities that are valid for a game (after base date)
 */
export async function getUserGameActivities(gameId: string): Promise<any[]> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!profile) throw new Error('Profile not found');

    // Get user's base date for this game
    const { data: playerBase } = await supabase
      .from('player_bases')
      .select('base_date')
      .eq('game_id', gameId)
      .eq('user_id', profile.id)
      .single();

    if (!playerBase) throw new Error('No base set for this game');

    // Get activities after base date
    const { data: activities, error } = await supabase
      .from('user_activities')
      .select('*')
      .eq('user_id', profile.id)
      .gte('start_date', playerBase.base_date)
      .order('start_date', { ascending: false });

    if (error) throw error;
    return activities || [];
  } catch (error) {
    console.error('Error fetching user game activities:', error);
    throw error;
  }
}

/**
 * Gets all activities for players in a game (for map visualization)
 */
export async function getGameActivities(gameId: string): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from('user_activities')
      .select(`
        *,
        profiles!user_activities_user_id_fkey(email)
      `)
      .eq('included_in_game', true)
      .in('user_id', 
        supabase
          .from('player_bases')
          .select('user_id')
          .eq('game_id', gameId)
      )
      .order('start_date', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching game activities:', error);
    throw error;
  }
}

/**
 * Processes a new activity import and checks for takeovers
 */
export async function processNewActivityForGame(
  gameId: string,
  activityId: string,
  tolerance: number = 50
): Promise<{
  territoryResult: TerritoryCalculationResult;
  takeoverResult: TakeoverResult;
}> {
  try {
    // Get current user's profile ID
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!profile) throw new Error('Profile not found');

    // Check for takeovers first
    const takeoverResult = await checkTerritoryTakeover(gameId, activityId, tolerance);
    
    // Then recalculate territory
    const territoryResult = await calculatePlayerTerritory(gameId, profile.id, tolerance);

    return {
      territoryResult,
      takeoverResult
    };
  } catch (error) {
    console.error('Error processing new activity for game:', error);
    throw error;
  }
}

/**
 * Gets game statistics and current status
 */
export async function getGameStats(gameId: string): Promise<{
  total_players: number;
  total_territory_km2: number;
  total_activities: number;
  total_takeovers: number;
  leader: LeaderboardEntry | null;
  days_remaining?: number;
}> {
  try {
    // Get game info
    const { data: game, error: gameError } = await supabase
      .from('games')
      .select('start_date, end_date, status')
      .eq('id', gameId)
      .single();

    if (gameError) throw gameError;

    // Get leaderboard
    const leaderboard = await getGameLeaderboard(gameId);
    
    // Get takeovers count
    const { count: takeoverCount } = await supabase
      .from('territory_takeovers')
      .select('*', { count: 'exact', head: true })
      .eq('game_id', gameId);

    // Calculate days remaining
    let daysRemaining: number | undefined;
    if (game.status === 'active' && game.end_date) {
      const endDate = new Date(game.end_date);
      const now = new Date();
      daysRemaining = Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
    }

    const totalTerritory = leaderboard.reduce((sum, player) => sum + player.territory_size_km2, 0);
    const totalActivities = leaderboard.reduce((sum, player) => sum + player.activity_count, 0);

    return {
      total_players: leaderboard.length,
      total_territory_km2: totalTerritory,
      total_activities: totalActivities,
      total_takeovers: takeoverCount || 0,
      leader: leaderboard.length > 0 ? leaderboard[0] : null,
      days_remaining: daysRemaining
    };
  } catch (error) {
    console.error('Error fetching game stats:', error);
    throw error;
  }
}