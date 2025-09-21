import { LeagueMemberService } from '../domain/LeagueMemberService';
import { supabaseLeagueRepository } from '../infrastructure/SupabaseLeagueRepository';
import { Member, JoinRequest, SearchUser } from '../types';

// Re-export the domain service result type
export type { LeagueDataResult } from '../domain/LeagueMemberService';

export class MemberService {
  private domainService: LeagueMemberService;

  constructor() {
    this.domainService = new LeagueMemberService(
      supabaseLeagueRepository,
      supabaseLeagueRepository
    );
  }

  async loadLeagueData(leagueId: string, userId: string) {
    return this.domainService.loadLeagueData(leagueId, userId);
  }

  async searchUsers(term: string, members: Member[], requests: JoinRequest[], currentUserId: string): Promise<SearchUser[]> {
    return this.domainService.searchUsers(term, members, requests, currentUserId);
  }

  async approveJoinRequest(requestId: string): Promise<void> {
    return this.domainService.approveJoinRequest(requestId);
  }

  async rejectJoinRequest(requestId: string): Promise<void> {
    return this.domainService.rejectJoinRequest(requestId);
  }

  async addUserToLeague(leagueId: string, userId: string): Promise<void> {
    return this.domainService.addUserToLeague(leagueId, userId);
  }

  async removeMember(memberId: string): Promise<void> {
    return this.domainService.removeMember(memberId);
  }

  async changeRole(memberId: string, newRole: 'admin' | 'member'): Promise<void> {
    return this.domainService.changeRole(memberId, newRole);
  }
}

export const memberService = new MemberService();