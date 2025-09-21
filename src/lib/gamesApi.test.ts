import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createGame } from './gamesApi';

// Mock Supabase
const mockSupabase = {
  rpc: vi.fn()
};

vi.mock('@/integrations/supabase/client', () => ({
  supabase: mockSupabase
}));

describe('createGame', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create game with duration_days for FREE plan', async () => {
    const mockResponse = {
      data: {
        success: true,
        game_id: '123-abc',
        game_name: 'Test Game',
        duration_days: 14,
        status: 'setup',
        user_plan: 'free'
      },
      error: null
    };

    mockSupabase.rpc.mockResolvedValue(mockResponse);

    const result = await createGame('league-123', 'Test Game', 21); // Try 21 days but should get 14

    expect(mockSupabase.rpc).toHaveBeenCalledWith('create_game', {
      p_league_id: 'league-123',
      p_name: 'Test Game',
      p_duration_days: 21
    });

    expect(result).toEqual({
      id: '123-abc',
      name: 'Test Game',
      duration_days: 14,
      status: 'setup',
      user_plan: 'free',
      ...mockResponse.data
    });
  });

  it('should create game with duration_days for PRO plan', async () => {
    const mockResponse = {
      data: {
        success: true,
        game_id: '123-abc',
        game_name: 'Test Game',
        duration_days: 25,
        status: 'setup',
        user_plan: 'pro'
      },
      error: null
    };

    mockSupabase.rpc.mockResolvedValue(mockResponse);

    const result = await createGame('league-123', 'Test Game', 25);

    expect(mockSupabase.rpc).toHaveBeenCalledWith('create_game', {
      p_league_id: 'league-123',
      p_name: 'Test Game',
      p_duration_days: 25
    });

    expect(result).toEqual({
      id: '123-abc',
      name: 'Test Game',
      duration_days: 25,
      status: 'setup',
      user_plan: 'pro',
      ...mockResponse.data
    });
  });

  it('should create game with default duration when no duration_days provided', async () => {
    const mockResponse = {
      data: {
        success: true,
        game_id: '123-abc',
        game_name: 'Test Game',
        duration_days: 14,
        status: 'setup',
        user_plan: 'free'
      },
      error: null
    };

    mockSupabase.rpc.mockResolvedValue(mockResponse);

    const result = await createGame('league-123', 'Test Game');

    expect(mockSupabase.rpc).toHaveBeenCalledWith('create_game', {
      p_league_id: 'league-123',
      p_name: 'Test Game',
      p_duration_days: undefined
    });

    expect(result.duration_days).toBe(14);
  });

  it('should throw error when server returns success: false', async () => {
    const mockResponse = {
      data: {
        success: false,
        error: 'For Pro plans, duration_days must be between 14 and 30 days'
      },
      error: null
    };

    mockSupabase.rpc.mockResolvedValue(mockResponse);

    await expect(createGame('league-123', 'Test Game', 35)).rejects.toThrow(
      'For Pro plans, duration_days must be between 14 and 30 days'
    );
  });

  it('should throw error when not authorized', async () => {
    const mockResponse = {
      data: {
        success: false,
        error: 'Not authorized to create games in this league'
      },
      error: null
    };

    mockSupabase.rpc.mockResolvedValue(mockResponse);

    await expect(createGame('league-123', 'Test Game')).rejects.toThrow(
      'Not authorized to create games in this league'
    );
  });

  it('should throw error when supabase returns error', async () => {
    mockSupabase.rpc.mockResolvedValue({
      data: null,
      error: { message: 'Database error' }
    });

    await expect(createGame('league-123', 'Test Game')).rejects.toThrow();
  });

  it('should throw error when no game_id returned', async () => {
    const mockResponse = {
      data: {
        success: true,
        game_name: 'Test Game'
        // Missing game_id
      },
      error: null
    };

    mockSupabase.rpc.mockResolvedValue(mockResponse);

    await expect(createGame('league-123', 'Test Game')).rejects.toThrow(
      'create_game returned no game_id'
    );
  });
});