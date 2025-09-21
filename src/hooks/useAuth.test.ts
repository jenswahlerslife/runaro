import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAuth } from './useAuth';

// Mock Supabase
const mockSupabase = {
  auth: {
    getSession: vi.fn(),
    getUser: vi.fn(),
    onAuthStateChange: vi.fn(),
    signOut: vi.fn(),
  },
  from: vi.fn(() => ({
    select: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn() })) })),
    update: vi.fn(() => ({ eq: vi.fn() }))
  }))
};

vi.mock('@/integrations/supabase/client', () => ({
  supabase: mockSupabase
}));

describe('useAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize with null user', async () => {
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: null },
      error: null
    });
    mockSupabase.auth.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } }
    });

    const { result } = renderHook(() => useAuth());

    expect(result.current.user).toBeNull();
    expect(result.current.loading).toBe(true);
  });

  it('should handle user session correctly', async () => {
    const mockUser = {
      id: '123',
      email: 'test@example.com'
    };
    const mockSession = {
      user: mockUser,
      access_token: 'token'
    };

    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: mockSession },
      error: null
    });
    mockSupabase.auth.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } }
    });

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      // Trigger auth state change
      const callback = mockSupabase.auth.onAuthStateChange.mock.calls[0][0];
      callback('SIGNED_IN', mockSession);
    });

    expect(result.current.user).toEqual(mockUser);
  });

  it('should handle sign out', async () => {
    mockSupabase.auth.signOut.mockResolvedValue({ error: null });

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signOut();
    });

    expect(mockSupabase.auth.signOut).toHaveBeenCalled();
  });
});