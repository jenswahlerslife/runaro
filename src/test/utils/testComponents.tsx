// @ts-nocheck
import React from 'react';
import { render, RenderOptions, RenderResult } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';

/**
 * Options for rendering components with providers
 */
interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  initialEntries?: string[];
  queryClient?: QueryClient;
}

/**
 * Creates a comprehensive test wrapper with all necessary providers
 */
function createTestWrapper(options: CustomRenderOptions = {}) {
  const queryClient = options.queryClient || new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });

  const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={options.initialEntries || ['/']}>
          {children}
        </MemoryRouter>
      </QueryClientProvider>
    );
  };

  return { AllTheProviders, queryClient };
}

/**
 * Enhanced render function with all providers
 */
export function renderWithProviders(
  ui: React.ReactElement,
  options: CustomRenderOptions = {}
): RenderResult & { queryClient: QueryClient } {
  const { AllTheProviders, queryClient } = createTestWrapper(options);

  const renderResult = render(ui, {
    wrapper: AllTheProviders,
    ...options,
  });

  return {
    ...renderResult,
    queryClient,
  };
}

/**
 * Mock user events for testing interactions
 */
export const mockUserEvents = {
  click: (element: HTMLElement) => {
    element.click();
  },

  type: (element: HTMLInputElement, text: string) => {
    element.value = text;
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  },

  clear: (element: HTMLInputElement) => {
    element.value = '';
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  },

  submit: (form: HTMLFormElement) => {
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  },
};

/**
 * Common test data for components
 */
export const testData = {
  user: {
    id: 'user-1',
    email: 'test@example.com',
    user_metadata: {
      display_name: 'Test User',
      username: 'testuser',
    },
  },

  league: {
    id: 'league-1',
    name: 'Test League',
    max_members: 10,
    admin_user_id: 'user-1',
  },

  members: [
    {
      id: 'member-1',
      user_id: 'user-1',
      display_name: 'Test User',
      role: 'owner' as const,
      joined_at: '2024-01-01T00:00:00Z',
    },
    {
      id: 'member-2',
      user_id: 'user-2',
      display_name: 'Admin User',
      role: 'admin' as const,
      joined_at: '2024-01-02T00:00:00Z',
    },
    {
      id: 'member-3',
      user_id: 'user-3',
      display_name: 'Member User',
      role: 'member' as const,
      joined_at: '2024-01-03T00:00:00Z',
    },
  ],

  joinRequests: [
    {
      id: 'request-1',
      user_id: 'user-4',
      display_name: 'Requesting User',
      created_at: '2024-01-04T00:00:00Z',
    },
  ],

  activeGame: {
    id: 'game-1',
    name: 'Test Game',
    status: 'active' as const,
    end_at: '2024-12-31T23:59:59Z',
    time_left_seconds: 3600,
  },
};

/**
 * Setup function for component tests
 */
export function setupComponentTest() {
  // Mock console methods to avoid noise in tests
  const consoleMocks = {
    log: vi.spyOn(console, 'log').mockImplementation(() => {}),
    warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
    error: vi.spyOn(console, 'error').mockImplementation(() => {}),
  };

  return {
    consoleMocks,
    cleanup: () => {
      Object.values(consoleMocks).forEach(mock => mock.mockRestore());
    },
  };
}

/**
 * Assert helpers for common testing patterns
 */
export const assertions = {
  isLoading: (container: HTMLElement) => {
    const loadingElement = container.querySelector('[data-testid="loading"]') ||
                          container.querySelector('.animate-spin') ||
                          container.querySelector('[aria-label*="loading" i]');
    return expect(loadingElement).toBeInTheDocument();
  },

  hasErrorMessage: (container: HTMLElement, message?: string) => {
    const errorElement = container.querySelector('[role="alert"]') ||
                        container.querySelector('.text-destructive') ||
                        container.querySelector('[data-testid="error"]');

    expect(errorElement).toBeInTheDocument();
    if (message) {
      expect(errorElement).toHaveTextContent(message);
    }
  },

  isEmpty: (container: HTMLElement, message?: string) => {
    const emptyElement = container.querySelector('[data-testid="empty-state"]') ||
                        container.querySelector('.text-center');

    expect(emptyElement).toBeInTheDocument();
    if (message) {
      expect(emptyElement).toHaveTextContent(message);
    }
  },
};