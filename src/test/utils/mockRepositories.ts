import { vi } from 'vitest';
import { LeagueRepository, UserRepository } from '@/features/leagues/domain/ports/LeagueRepository';
import { League, Member, JoinRequest, SearchUser } from '@/features/leagues/types';

/**
 * Creates a mock implementation of LeagueRepository for testing
 */
export function createMockLeagueRepository(): LeagueRepository {
  return {
    getLeague: vi.fn(),
    getLeagueMembers: vi.fn(),
    getUserRole: vi.fn(),
    addMember: vi.fn(),
    removeMember: vi.fn(),
    updateMemberRole: vi.fn(),
    getJoinRequests: vi.fn(),
    approveJoinRequest: vi.fn(),
    rejectJoinRequest: vi.fn(),
    searchUsers: vi.fn(),
  };
}

/**
 * Creates a mock implementation of UserRepository for testing
 */
export function createMockUserRepository(): UserRepository {
  return {
    getProfiles: vi.fn(),
  };
}

/**
 * Mock data factories for consistent test data
 */
export const mockDataFactories = {
  league: (overrides: Partial<League> = {}): League => ({
    id: 'league-1',
    name: 'Test League',
    max_members: 10,
    admin_user_id: 'user-1',
    ...overrides,
  }),

  member: (overrides: Partial<Member> = {}): Member => ({
    id: 'member-1',
    user_id: 'user-1',
    display_name: 'Test User',
    role: 'member',
    joined_at: '2024-01-01T00:00:00Z',
    ...overrides,
  }),

  joinRequest: (overrides: Partial<JoinRequest> = {}): JoinRequest => ({
    id: 'request-1',
    user_id: 'user-2',
    display_name: 'Requesting User',
    created_at: '2024-01-01T00:00:00Z',
    ...overrides,
  }),

  searchUser: (overrides: Partial<SearchUser> = {}): SearchUser => ({
    user_id: 'user-3',
    display_name: 'Search User',
    username: 'searchuser',
    status: 'can_add',
    ...overrides,
  }),
};

/**
 * Pre-configured mock repository with common responses
 */
export function createPreConfiguredMockRepository() {
  const mockRepo = createMockLeagueRepository();
  const mockUserRepo = createMockUserRepository();

  // Configure default responses
  vi.mocked(mockRepo.getLeague).mockResolvedValue(mockDataFactories.league());
  vi.mocked(mockRepo.getLeagueMembers).mockResolvedValue([
    mockDataFactories.member(),
    mockDataFactories.member({ id: 'member-2', user_id: 'user-2', role: 'admin' }),
  ]);
  vi.mocked(mockRepo.getUserRole).mockResolvedValue({ role: 'member' });
  vi.mocked(mockRepo.getJoinRequests).mockResolvedValue([mockDataFactories.joinRequest()]);
  vi.mocked(mockRepo.searchUsers).mockResolvedValue([mockDataFactories.searchUser()]);
  vi.mocked(mockUserRepo.getProfiles).mockResolvedValue([
    { user_id: 'user-2', display_name: 'Requesting User' },
  ]);

  return { mockRepo, mockUserRepo };
}