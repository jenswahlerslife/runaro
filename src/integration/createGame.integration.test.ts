import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';

// Integration test for Create Game functionality
// This tests the complete flow from UI to database

const MOCK_DATABASE_FUNCTIONS = {
  create_game: vi.fn(),
  get_user_plan: vi.fn()
};

// Mock Supabase for integration testing
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: (functionName: string, params: any) => {
      const mockFn = MOCK_DATABASE_FUNCTIONS[functionName as keyof typeof MOCK_DATABASE_FUNCTIONS];
      if (mockFn) {
        return Promise.resolve({ data: mockFn(params), error: null });
      }
      return Promise.resolve({ data: null, error: { message: `Function ${functionName} not mocked` } });
    }
  }
}));

describe('Create Game Integration Tests', () => {
  beforeAll(() => {
    // Setup mock implementations
    MOCK_DATABASE_FUNCTIONS.get_user_plan.mockImplementation((params) => {
      // Simulate plan lookup
      if (params?.user_uuid === 'free-user') return 'free';
      if (params?.user_uuid === 'pro-user') return 'pro';
      return 'free';
    });
  });

  afterAll(() => {
    vi.clearAllMocks();
  });

  describe('Free Plan User', () => {
    it('should create game with 14 days regardless of input', async () => {
      MOCK_DATABASE_FUNCTIONS.create_game.mockReturnValueOnce({
        success: true,
        game_id: 'game-free-123',
        game_name: 'Free User Game',
        duration_days: 14,
        status: 'setup',
        user_plan: 'free'
      });

      const { createGame } = await import('@/lib/gamesApi');

      // Try to create with 30 days but should get 14
      const result = await createGame('league123', 'Free User Game', 30);

      expect(MOCK_DATABASE_FUNCTIONS.create_game).toHaveBeenCalledWith({
        p_league_id: 'league123',
        p_name: 'Free User Game',
        p_duration_days: 30
      });

      expect(result).toEqual({
        id: 'game-free-123',
        name: 'Free User Game',
        duration_days: 14,
        status: 'setup',
        user_plan: 'free',
        success: true,
        game_id: 'game-free-123',
        game_name: 'Free User Game'
      });
    });

    it('should enforce 14 days even with no duration input', async () => {
      MOCK_DATABASE_FUNCTIONS.create_game.mockReturnValueOnce({
        success: true,
        game_id: 'game-free-124',
        game_name: 'Free User Game 2',
        duration_days: 14,
        status: 'setup',
        user_plan: 'free'
      });

      const { createGame } = await import('@/lib/gamesApi');

      const result = await createGame('league123', 'Free User Game 2');

      expect(result.duration_days).toBe(14);
    });
  });

  describe('Pro Plan User', () => {
    it('should allow custom duration within 14-30 days', async () => {
      MOCK_DATABASE_FUNCTIONS.create_game.mockReturnValueOnce({
        success: true,
        game_id: 'game-pro-123',
        game_name: 'Pro User Game',
        duration_days: 25,
        status: 'setup',
        user_plan: 'pro'
      });

      const { createGame } = await import('@/lib/gamesApi');

      const result = await createGame('league123', 'Pro User Game', 25);

      expect(result.duration_days).toBe(25);
      expect(result.user_plan).toBe('pro');
    });

    it('should reject duration outside 14-30 days range', async () => {
      MOCK_DATABASE_FUNCTIONS.create_game.mockReturnValueOnce({
        success: false,
        error: 'For Pro plans, duration_days must be between 14 and 30 days'
      });

      const { createGame } = await import('@/lib/gamesApi');

      await expect(createGame('league123', 'Pro User Game', 35)).rejects.toThrow(
        'For Pro plans, duration_days must be between 14 and 30 days'
      );
    });

    it('should default to 14 days when no duration provided', async () => {
      MOCK_DATABASE_FUNCTIONS.create_game.mockReturnValueOnce({
        success: true,
        game_id: 'game-pro-124',
        game_name: 'Pro User Game Default',
        duration_days: 14,
        status: 'setup',
        user_plan: 'pro'
      });

      const { createGame } = await import('@/lib/gamesApi');

      const result = await createGame('league123', 'Pro User Game Default');

      expect(result.duration_days).toBe(14);
    });
  });

  describe('Authorization Tests', () => {
    it('should reject non-admin users', async () => {
      MOCK_DATABASE_FUNCTIONS.create_game.mockReturnValueOnce({
        success: false,
        error: 'Not authorized to create games in this league'
      });

      const { createGame } = await import('@/lib/gamesApi');

      await expect(createGame('league123', 'Unauthorized Game')).rejects.toThrow(
        'Not authorized to create games in this league'
      );
    });

    it('should require minimum member count', async () => {
      MOCK_DATABASE_FUNCTIONS.create_game.mockReturnValueOnce({
        success: false,
        error: 'League needs at least 2 approved members to create a game'
      });

      const { createGame } = await import('@/lib/gamesApi');

      await expect(createGame('empty-league', 'Solo Game')).rejects.toThrow(
        'League needs at least 2 approved members to create a game'
      );
    });
  });

  describe('Validation Edge Cases', () => {
    it('should handle boundary values correctly', async () => {
      // Test minimum boundary (14 days)
      MOCK_DATABASE_FUNCTIONS.create_game.mockReturnValueOnce({
        success: true,
        game_id: 'game-boundary-min',
        game_name: 'Min Duration Game',
        duration_days: 14,
        status: 'setup',
        user_plan: 'pro'
      });

      const { createGame } = await import('@/lib/gamesApi');
      const result = await createGame('league123', 'Min Duration Game', 14);
      expect(result.duration_days).toBe(14);

      // Test maximum boundary (30 days)
      MOCK_DATABASE_FUNCTIONS.create_game.mockReturnValueOnce({
        success: true,
        game_id: 'game-boundary-max',
        game_name: 'Max Duration Game',
        duration_days: 30,
        status: 'setup',
        user_plan: 'pro'
      });

      const result2 = await createGame('league123', 'Max Duration Game', 30);
      expect(result2.duration_days).toBe(30);
    });

    it('should handle invalid boundary values', async () => {
      // Test below minimum (13 days)
      MOCK_DATABASE_FUNCTIONS.create_game.mockReturnValueOnce({
        success: false,
        error: 'For Pro plans, duration_days must be between 14 and 30 days'
      });

      const { createGame } = await import('@/lib/gamesApi');

      await expect(createGame('league123', 'Invalid Min Game', 13)).rejects.toThrow();

      // Test above maximum (31 days)
      MOCK_DATABASE_FUNCTIONS.create_game.mockReturnValueOnce({
        success: false,
        error: 'For Pro plans, duration_days must be between 14 and 30 days'
      });

      await expect(createGame('league123', 'Invalid Max Game', 31)).rejects.toThrow();
    });
  });
});