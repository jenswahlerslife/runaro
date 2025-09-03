import { supabase } from '@/integrations/supabase/client';

export interface League {
  id: string;
  name: string;
  description: string | null;
  admin_user_id: string;
  invite_code: string;
  is_public: boolean;
  max_members: number;
  created_at: string;
  updated_at: string;
  member_count?: number;
  is_admin?: boolean;
  membership_status?: string;
}

export interface LeagueMember {
  id: string;
  league_id: string;
  user_id: string;
  status: 'pending' | 'approved' | 'rejected' | 'left';
  joined_at: string;
  approved_at: string | null;
  approved_by: string | null;
  // Populated from profiles join
  email?: string;
  full_name?: string;
}

export interface Game {
  id: string;
  league_id: string;
  name: string;
  status: 'setup' | 'active' | 'finished' | 'cancelled';
  start_date: string | null;
  end_date: string | null;
  winner_user_id: string | null;
  created_at: string;
  created_by: string;
  player_count?: number;
  bases_set?: number;
}

export interface PlayerBase {
  id: string;
  game_id: string;
  user_id: string;
  activity_id: string;
  base_date: string;
  territory_size_km2: number;
  last_calculated_at: string | null;
  created_at: string;
  // Populated from joins
  activity_name?: string;
  user_email?: string;
}

/**
 * Creates a new league
 */
export async function createLeague(
  name: string,
  description?: string,
  isPublic: boolean = false,
  maxMembers: number = 10
): Promise<{ success: boolean; league_id?: string; invite_code?: string; error?: string }> {
  try {
    const { data, error } = await supabase.rpc('create_league', {
      p_name: name,
      p_description: description,
      p_is_public: isPublic,
      p_max_members: maxMembers
    });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error creating league:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Joins a league using invite code
 */
export async function joinLeague(inviteCode: string): Promise<{
  success: boolean;
  league_id?: string;
  league_name?: string;
  status?: string;
  error?: string;
}> {
  try {
    const { data, error } = await supabase.rpc('join_league', {
      p_invite_code: inviteCode
    });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error joining league:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Manages league membership (approve/reject)
 */
export async function manageLeagueMembership(
  leagueId: string,
  userId: string,
  action: 'approve' | 'reject'
): Promise<{ success: boolean; action?: string; new_status?: string; error?: string }> {
  try {
    const { data, error } = await supabase.rpc('manage_league_membership', {
      p_league_id: leagueId,
      p_user_id: userId,
      p_action: action
    });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error managing league membership:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Gets leagues the current user is involved in
 */
export async function getUserLeagues(): Promise<League[]> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!profile) throw new Error('Profile not found');

    // Get leagues where user is admin
    const { data: adminLeagues, error: adminError } = await supabase
      .from('leagues')
      .select('*')
      .eq('admin_user_id', profile.id);

    if (adminError) throw adminError;

    // Get league IDs where user is an approved member
    const { data: membershipData, error: membershipError } = await supabase
      .from('league_members')
      .select('league_id')
      .eq('user_id', profile.id)
      .eq('status', 'approved');

    if (membershipError) throw membershipError;

    // Get league details for member leagues
    let memberLeagues = [];
    if (membershipData && membershipData.length > 0) {
      const leagueIds = membershipData.map(m => m.league_id);
      const { data, error } = await supabase
        .from('leagues')
        .select('*')
        .in('id', leagueIds);
      
      if (error) throw error;
      memberLeagues = data || [];
    }

    // Combine and deduplicate leagues
    const allLeagues = [...(adminLeagues || []), ...memberLeagues];
    const uniqueLeagues = allLeagues.filter((league, index, self) => 
      index === self.findIndex(l => l.id === league.id)
    );

    // Enhance with additional info
    const enhancedLeagues: League[] = [];
    for (const league of uniqueLeagues) {
      // Count members
      const { count: memberCount } = await supabase
        .from('league_members')
        .select('*', { count: 'exact', head: true })
        .eq('league_id', league.id)
        .eq('status', 'approved');

      enhancedLeagues.push({
        ...league,
        member_count: memberCount || 0,
        is_admin: league.admin_user_id === profile.id,
        membership_status: 'approved'
      });
    }

    return enhancedLeagues;
  } catch (error) {
    console.error('Error fetching user leagues:', error);
    throw error;
  }
}

/**
 * Gets league members with their details
 */
export async function getLeagueMembers(leagueId: string): Promise<LeagueMember[]> {
  try {
    const { data, error } = await supabase
      .from('league_members')
      .select(`
        *,
        profiles!league_members_user_id_fkey(
          email,
          full_name
        )
      `)
      .eq('league_id', leagueId)
      .order('joined_at');

    if (error) throw error;

    return (data || []).map(member => ({
      ...member,
      email: member.profiles?.email,
      full_name: member.profiles?.full_name
    }));
  } catch (error) {
    console.error('Error fetching league members:', error);
    throw error;
  }
}

/**
 * Creates a new game in a league
 */
export async function createGame(
  leagueId: string,
  name: string
): Promise<{ success: boolean; game_id?: string; game_name?: string; member_count?: number; error?: string }> {
  try {
    const { data, error } = await supabase.rpc('create_game', {
      p_league_id: leagueId,
      p_name: name
    });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error creating game:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Gets games for a league
 */
export async function getLeagueGames(leagueId: string): Promise<Game[]> {
  try {
    const { data, error } = await supabase
      .from('games')
      .select('*')
      .eq('league_id', leagueId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Enhance with player counts
    const enhancedGames: Game[] = [];
    for (const game of data || []) {
      const { count: playerCount } = await supabase
        .from('player_bases')
        .select('*', { count: 'exact', head: true })
        .eq('game_id', game.id);

      enhancedGames.push({
        ...game,
        player_count: playerCount || 0,
        bases_set: playerCount || 0
      });
    }

    return enhancedGames;
  } catch (error) {
    console.error('Error fetching league games:', error);
    throw error;
  }
}

/**
 * Sets a player's base for a game
 */
export async function setPlayerBase(
  gameId: string,
  activityId: string
): Promise<{ success: boolean; activity_name?: string; base_date?: string; error?: string }> {
  try {
    const { data, error } = await supabase.rpc('set_player_base', {
      p_game_id: gameId,
      p_activity_id: activityId
    });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error setting player base:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Starts a game
 */
export async function startGame(gameId: string): Promise<{
  success: boolean;
  start_date?: string;
  end_date?: string;
  member_count?: number;
  base_count?: number;
  error?: string;
}> {
  try {
    const { data, error } = await supabase.rpc('start_game', {
      p_game_id: gameId
    });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error starting game:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Gets player bases for a game
 */
export async function getGamePlayerBases(gameId: string): Promise<PlayerBase[]> {
  try {
    const { data, error } = await supabase
      .from('player_bases')
      .select(`
        *,
        user_activities!player_bases_activity_id_fkey(name),
        profiles!player_bases_user_id_fkey(email)
      `)
      .eq('game_id', gameId)
      .order('created_at');

    if (error) throw error;

    return (data || []).map(base => ({
      ...base,
      activity_name: base.user_activities?.name,
      user_email: base.profiles?.email
    }));
  } catch (error) {
    console.error('Error fetching game player bases:', error);
    throw error;
  }
}

/**
 * Gets current user's activities for base selection (after a certain date)
 */
export async function getUserActivitiesForBase(afterDate?: string): Promise<any[]> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!profile) throw new Error('Profile not found');

    let query = supabase
      .from('user_activities')
      .select('*')
      .eq('user_id', profile.id)
      .order('start_date', { ascending: false });

    if (afterDate) {
      query = query.gte('start_date', afterDate);
    }

    const { data, error } = await query;
    if (error) throw error;

    return data || [];
  } catch (error) {
    console.error('Error fetching user activities for base:', error);
    throw error;
  }
}