import { League, Member, JoinRequest, SearchUser } from '../types';
import { LeagueRepository, UserRepository } from './ports/LeagueRepository';

export interface LeagueDataResult {
  league: League;
  isAdmin: boolean;
  isOwner: boolean;
  members: Member[];
  requests: JoinRequest[];
}

export class LeagueMemberService {
  constructor(
    private leagueRepo: LeagueRepository,
    private userRepo: UserRepository
  ) {}

  async loadLeagueData(leagueId: string, userId: string): Promise<LeagueDataResult> {
    // 1) Get league details and user role
    const [league, roleRow] = await Promise.all([
      this.leagueRepo.getLeague(leagueId),
      this.leagueRepo.getUserRole(leagueId, userId)
    ]);

    if (!roleRow) {
      throw new Error('User is not a member of this league');
    }

    // Set admin status based on role
    const userIsAdmin = roleRow && ['owner', 'admin'].includes(roleRow.role);
    const userIsOwner = roleRow?.role === 'owner';

    // 2) Get members
    const members = await this.leagueRepo.getLeagueMembers(leagueId);

    // 3) Get join requests ONLY if admin/owner
    let requests: JoinRequest[] = [];
    if (userIsAdmin) {
      requests = await this.leagueRepo.getJoinRequests(leagueId);
    }

    return {
      league,
      isAdmin: userIsAdmin || false,
      isOwner: userIsOwner || false,
      members,
      requests
    };
  }

  async searchUsers(term: string, members: Member[], requests: JoinRequest[], currentUserId: string): Promise<SearchUser[]> {
    if (!term.trim()) {
      return [];
    }

    const users = await this.leagueRepo.searchUsers(term);

    // Get current member user_ids and pending request user_ids
    const memberUserIds = new Set(members.map(m => m.user_id));
    const pendingUserIds = new Set(requests.map(r => r.user_id));

    // Filter and categorize results
    return users
      .filter(user => user.user_id !== currentUserId) // Don't show current user
      .map(user => ({
        ...user,
        status: memberUserIds.has(user.user_id)
          ? 'member'
          : pendingUserIds.has(user.user_id)
          ? 'pending'
          : 'can_add'
      }));
  }

  async approveJoinRequest(requestId: string): Promise<void> {
    return this.leagueRepo.approveJoinRequest(requestId);
  }

  async rejectJoinRequest(requestId: string): Promise<void> {
    return this.leagueRepo.rejectJoinRequest(requestId);
  }

  async addUserToLeague(leagueId: string, userId: string): Promise<void> {
    return this.leagueRepo.addMember(leagueId, userId);
  }

  async removeMember(memberId: string): Promise<void> {
    return this.leagueRepo.removeMember(memberId);
  }

  async changeRole(memberId: string, newRole: 'admin' | 'member'): Promise<void> {
    return this.leagueRepo.updateMemberRole(memberId, newRole);
  }
}