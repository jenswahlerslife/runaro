// @ts-nocheck
import React from 'react';
import { renderHook, RenderHookResult } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi } from 'vitest';

/**
 * Creates a wrapper component with providers for testing hooks
 */
export function createHookWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );

  return { wrapper, queryClient };
}

/**
 * Enhanced renderHook with default providers
 */
export function renderHookWithProviders<TProps, TResult>(
  callback: (props: TProps) => TResult,
  options?: {
    initialProps?: TProps;
    wrapper?: React.ComponentType<{ children: React.ReactNode }>;
  }
): RenderHookResult<TResult, TProps> & { queryClient: QueryClient } {
  const { wrapper: defaultWrapper, queryClient } = createHookWrapper();
  const wrapper = options?.wrapper || defaultWrapper;

  const result = renderHook(callback, {
    ...options,
    wrapper,
  });

  return { ...result, queryClient };
}

/**
 * Mock implementations for common hooks
 */
export const mockHooks = {
  useAuth: () => ({
    user: { id: 'user-1', email: 'test@example.com' },
    loading: false,
    signOut: vi.fn(),
  }),

  useSubscription: () => ({
    subscription: null,
    isPro: false,
    isLoading: false,
  }),

  useToast: () => ({
    toast: vi.fn(),
  }),

  useNavigate: () => vi.fn(),

  useParams: () => ({ leagueId: 'league-1' }),
};

/**
 * Sets up mock implementations for hooks
 */
export function setupMockHooks() {
  vi.mock('@/hooks/useAuth', () => ({
    useAuth: vi.fn(() => mockHooks.useAuth()),
  }));

  vi.mock('@/hooks/useSubscription', () => ({
    useSubscription: vi.fn(() => mockHooks.useSubscription()),
  }));

  vi.mock('@/components/ui/use-toast', () => ({
    useToast: vi.fn(() => mockHooks.useToast()),
  }));

  vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
      ...actual,
      useNavigate: vi.fn(() => mockHooks.useNavigate()),
      useParams: vi.fn(() => mockHooks.useParams()),
    };
  });
}

/**
 * Waits for async operations to complete
 */
export async function waitForAsync() {
  await new Promise(resolve => setTimeout(resolve, 0));
}