import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LeagueMemberService } from './LeagueMemberService';
import {
  createMockLeagueRepository,
  createMockUserRepository,
  mockDataFactories
} from '@/test/utils/mockRepositories';

describe('LeagueMemberService', () => {
  let service: LeagueMemberService;
  let mockLeagueRepo: ReturnType<typeof createMockLeagueRepository>;
  let mockUserRepo: ReturnType<typeof createMockUserRepository>;

  beforeEach(() => {
    mockLeagueRepo = createMockLeagueRepository();
    mockUserRepo = createMockUserRepository();
    service = new LeagueMemberService(mockLeagueRepo, mockUserRepo);
  });

  describe('loadLeagueData', () => {
    it('should load league data successfully for a member', async () => {
      // Arrange
      const leagueId = 'league-1';
      const userId = 'user-1';
      const mockLeague = mockDataFactories.league();
      const mockMembers = [mockDataFactories.member()];
      const mockRequests = [mockDataFactories.joinRequest()];

      vi.mocked(mockLeagueRepo.getLeague).mockResolvedValue(mockLeague);
      vi.mocked(mockLeagueRepo.getUserRole).mockResolvedValue({ role: 'admin' });
      vi.mocked(mockLeagueRepo.getLeagueMembers).mockResolvedValue(mockMembers);
      vi.mocked(mockLeagueRepo.getJoinRequests).mockResolvedValue(mockRequests);

      // Act
      const result = await service.loadLeagueData(leagueId, userId);

      // Assert
      expect(result).toEqual({
        league: mockLeague,
        isAdmin: true,
        isOwner: false,
        members: mockMembers,
        requests: mockRequests,
      });

      expect(mockLeagueRepo.getLeague).toHaveBeenCalledWith(leagueId);
      expect(mockLeagueRepo.getUserRole).toHaveBeenCalledWith(leagueId, userId);
      expect(mockLeagueRepo.getLeagueMembers).toHaveBeenCalledWith(leagueId);
      expect(mockLeagueRepo.getJoinRequests).toHaveBeenCalledWith(leagueId);
    });

    it('should throw error if user is not a league member', async () => {
      // Arrange
      const leagueId = 'league-1';
      const userId = 'user-1';

      vi.mocked(mockLeagueRepo.getLeague).mockResolvedValue(mockDataFactories.league());
      vi.mocked(mockLeagueRepo.getUserRole).mockResolvedValue(null);

      // Act & Assert
      await expect(service.loadLeagueData(leagueId, userId))
        .rejects
        .toThrow('User is not a member of this league');
    });

    it('should not load join requests for non-admin users', async () => {
      // Arrange
      const leagueId = 'league-1';
      const userId = 'user-1';

      vi.mocked(mockLeagueRepo.getLeague).mockResolvedValue(mockDataFactories.league());
      vi.mocked(mockLeagueRepo.getUserRole).mockResolvedValue({ role: 'member' });
      vi.mocked(mockLeagueRepo.getLeagueMembers).mockResolvedValue([]);

      // Act
      const result = await service.loadLeagueData(leagueId, userId);

      // Assert
      expect(result.isAdmin).toBe(false);
      expect(result.requests).toEqual([]);
      expect(mockLeagueRepo.getJoinRequests).not.toHaveBeenCalled();
    });
  });

  describe('searchUsers', () => {
    it('should return empty array for empty search term', async () => {
      // Act
      const result = await service.searchUsers('', [], [], 'user-1');

      // Assert
      expect(result).toEqual([]);
      expect(mockLeagueRepo.searchUsers).not.toHaveBeenCalled();
    });

    it('should categorize search results correctly', async () => {
      // Arrange
      const term = 'test';
      const members = [mockDataFactories.member({ user_id: 'user-2' })];
      const requests = [mockDataFactories.joinRequest({ user_id: 'user-3' })];
      const currentUserId = 'user-1';

      const mockSearchResults = [
        mockDataFactories.searchUser({ user_id: 'user-2' }), // existing member
        mockDataFactories.searchUser({ user_id: 'user-3' }), // pending request
        mockDataFactories.searchUser({ user_id: 'user-4' }), // can add
        mockDataFactories.searchUser({ user_id: 'user-1' }), // current user (should be filtered)
      ];

      vi.mocked(mockLeagueRepo.searchUsers).mockResolvedValue(mockSearchResults);

      // Act
      const result = await service.searchUsers(term, members, requests, currentUserId);

      // Assert
      expect(result).toHaveLength(3); // Current user should be filtered out
      expect(result[0].status).toBe('member');
      expect(result[1].status).toBe('pending');
      expect(result[2].status).toBe('can_add');

      expect(mockLeagueRepo.searchUsers).toHaveBeenCalledWith(term);
    });
  });

  describe('approveJoinRequest', () => {
    it('should approve join request successfully', async () => {
      // Arrange
      const requestId = 'request-1';

      // Act
      await service.approveJoinRequest(requestId);

      // Assert
      expect(mockLeagueRepo.approveJoinRequest).toHaveBeenCalledWith(requestId);
    });
  });

  describe('rejectJoinRequest', () => {
    it('should reject join request successfully', async () => {
      // Arrange
      const requestId = 'request-1';

      // Act
      await service.rejectJoinRequest(requestId);

      // Assert
      expect(mockLeagueRepo.rejectJoinRequest).toHaveBeenCalledWith(requestId);
    });
  });

  describe('addUserToLeague', () => {
    it('should add user to league successfully', async () => {
      // Arrange
      const leagueId = 'league-1';
      const userId = 'user-2';

      // Act
      await service.addUserToLeague(leagueId, userId);

      // Assert
      expect(mockLeagueRepo.addMember).toHaveBeenCalledWith(leagueId, userId);
    });
  });

  describe('removeMember', () => {
    it('should remove member successfully', async () => {
      // Arrange
      const memberId = 'member-1';

      // Act
      await service.removeMember(memberId);

      // Assert
      expect(mockLeagueRepo.removeMember).toHaveBeenCalledWith(memberId);
    });
  });

  describe('changeRole', () => {
    it('should change member role successfully', async () => {
      // Arrange
      const memberId = 'member-1';
      const newRole = 'admin';

      // Act
      await service.changeRole(memberId, newRole);

      // Assert
      expect(mockLeagueRepo.updateMemberRole).toHaveBeenCalledWith(memberId, newRole);
    });
  });
});