// @ts-nocheck
import { supabase } from '@/integrations/supabase/client';
import { League, Member, JoinRequest, SearchUser } from '../types';
import { LeagueRepository, UserRepository } from '../domain/ports/LeagueRepository';

export class SupabaseLeagueRepository implements LeagueRepository, UserRepository {
  async getLeague(leagueId: string): Promise<League> {
    const { data: leagueData, error: leagueError } = await supabase
      .from('leagues')
      .select('id, name, max_members, admin_user_id')
      .eq('id', leagueId)
      .single();

    if (leagueError || !leagueData) {
      throw new Error('League not found');
    }

    return leagueData;
  }

  async getLeagueMembers(leagueId: string): Promise<Member[]> {
    const { data: membersData, error: membersError } = await supabase
      .from('league_members_view')
      .select('id, user_id, display_name, role, joined_at')
      .eq('league_id', leagueId)
      .order('role', { ascending: false }); // owner/admin first

    if (membersError) {
      console.error('Error loading members:', membersError);
      throw membersError;
    }

    return membersData || [];
  }

  async getUserRole(leagueId: string, userId: string): Promise<{ role: string } | null> {
    const { data: roleRow, error: roleError } = await supabase
      .from('league_members')
      .select('role')
      .eq('league_id', leagueId)
      .eq('user_id', userId)
      .maybeSingle();

    if (roleError) {
      console.error('Error checking user role:', roleError);
      throw roleError;
    }

    return roleRow;
  }

  async addMember(leagueId: string, userId: string, role: string = 'member'): Promise<void> {
    const { error } = await supabase
      .from('league_members')
      .insert({
        league_id: leagueId,
        user_id: userId,
        role,
      });

    if (error) throw error;
  }

  async removeMember(memberId: string): Promise<void> {
    const { error } = await supabase
      .from('league_members')
      .delete()
      .eq('id', memberId);

    if (error) throw error;
  }

  async updateMemberRole(memberId: string, role: 'admin' | 'member'): Promise<void> {
    const { error } = await supabase
      .from('league_members')
      .update({ role })
      .eq('id', memberId);

    if (error) throw error;
  }

  async getJoinRequests(leagueId: string): Promise<JoinRequest[]> {
    // Step 1: Get raw join requests (without JOIN to profiles)
    const { data: rawRequests, error: requestsError } = await supabase
      .from('league_join_requests')
      .select('id, user_id, created_at')
      .eq('league_id', leagueId)
      .eq('status', 'pending')
      .order('created_at', { ascending: true });

    if (requestsError) {
      console.error('Error loading requests:', requestsError);
      throw requestsError;
    }

    if (!rawRequests || rawRequests.length === 0) {
      return [];
    }

    // Step 2: Get profiles for these user_ids (best-effort)
    const userIds = Array.from(new Set(rawRequests.map(r => r.user_id)));
    const profiles = await this.getProfiles(userIds);

    // Step 3: Map profiles to requests
    const profilesById = Object.fromEntries(
      profiles.map(p => [p.user_id, p])
    );

    return rawRequests.map(r => ({
      id: r.id,
      user_id: r.user_id,
      created_at: r.created_at,
      display_name: profilesById[r.user_id]?.display_name ||
                   profilesById[r.user_id]?.username ||
                   'Ukendt bruger'
    }));
  }

  async approveJoinRequest(requestId: string): Promise<void> {
    const { error } = await supabase.rpc('approve_join_request', {
      request_id: requestId
    });

    if (error) {
      console.error('RPC approve_join_request failed:', {
        message: error.message,
        details: (error as any).details,
        hint: (error as any).hint,
        code: error.code,
        fullError: error
      });
      throw error;
    }
  }

  async rejectJoinRequest(requestId: string): Promise<void> {
    const { error } = await supabase.rpc('decline_join_request', {
      request_id: requestId
    });

    if (error) {
      console.error('RPC decline_join_request failed:', {
        message: error.message,
        details: (error as any).details,
        hint: (error as any).hint,
        code: error.code,
        fullError: error
      });
      throw error;
    }
  }

  async searchUsers(term: string, limit: number = 10): Promise<SearchUser[]> {
    const { data: users, error } = await supabase
      .from('profiles')
      .select('user_id, display_name, username')
      .or(`display_name.ilike.%${term}%,username.ilike.%${term}%`)
      .limit(limit);

    if (error) throw error;

    return (users || []).map(user => ({
      user_id: user.user_id,
      display_name: user.display_name || user.username || 'Bruger',
      username: user.username,
      status: 'can_add' as const // Will be set later by caller based on context
    }));
  }

  async getProfiles(userIds: string[]): Promise<Array<{
    user_id: string;
    display_name: string;
    username?: string;
  }>> {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, display_name, username')
      .in('user_id', userIds);

    return profiles || [];
  }
}

// Export singleton instance
export const supabaseLeagueRepository = new SupabaseLeagueRepository();