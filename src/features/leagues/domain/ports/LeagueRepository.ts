import { League, Member, JoinRequest, SearchUser } from '../../types';

export interface LeagueRepository {
  // League operations
  getLeague(leagueId: string): Promise<League>;

  // Member operations
  getLeagueMembers(leagueId: string): Promise<Member[]>;
  getUserRole(leagueId: string, userId: string): Promise<{ role: string } | null>;
  addMember(leagueId: string, userId: string, role?: string): Promise<void>;
  removeMember(memberId: string): Promise<void>;
  updateMemberRole(memberId: string, role: 'admin' | 'member'): Promise<void>;

  // Join request operations
  getJoinRequests(leagueId: string): Promise<JoinRequest[]>;
  approveJoinRequest(requestId: string): Promise<void>;
  rejectJoinRequest(requestId: string): Promise<void>;

  // User search operations
  searchUsers(term: string, limit?: number): Promise<SearchUser[]>;
}

export interface UserRepository {
  getProfiles(userIds: string[]): Promise<Array<{
    user_id: string;
    display_name: string;
    username?: string;
  }>>;
}