// LAZY LOADING UTILITIES
// Optimeret code splitting for bedre performance

import { lazy } from 'react';
import { ComponentType } from 'react';

// Higher-order function til retry logic for lazy loading
export function retryLazy<T extends ComponentType<any>>(
  componentImport: () => Promise<{ default: T }>,
  name: string,
  maxRetries: number = 3
): React.LazyExoticComponent<T> {
  return lazy(async () => {
    let retries = 0;

    const load = async (): Promise<{ default: T }> => {
      try {
        return await componentImport();
      } catch (error) {
        console.warn(`Failed to load ${name}, attempt ${retries + 1}`);

        if (retries < maxRetries) {
          retries++;
          // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retries)));
          return load();
        }

        throw error;
      }
    };

    return load();
  });
}

// Lazy loaded page komponenter med retry logic
export const LazyDashboard = retryLazy(
  () => import('@/pages/Dashboard'),
  'Dashboard'
);

export const LazyLeaguesPage = retryLazy(
  () => import('@/pages/LeaguesPage'),
  'LeaguesPage'
);

export const LazyLeagueMembers = retryLazy(
  () => import('@/pages/LeagueMembers'),
  'LeagueMembers'
);

export const LazyGamePage = retryLazy(
  () => import('@/pages/GamePage'),
  'GamePage'
);

export const LazyGameSetup = retryLazy(
  () => import('@/pages/GameSetup'),
  'GameSetup'
);

export const LazyActivitiesPage = retryLazy(
  () => import('@/pages/ActivitiesPage'),
  'ActivitiesPage'
);

export const LazySubscription = retryLazy(
  () => import('@/pages/Subscription'),
  'Subscription'
);

export const LazyErrorDashboard = retryLazy(
  () => import('@/pages/ErrorDashboard'),
  'ErrorDashboard'
);

export const LazyStravaConnectPage = retryLazy(
  () => import('@/pages/StravaConnectPage'),
  'StravaConnectPage'
);

export const LazyUpload = retryLazy(
  () => import('@/pages/Upload'),
  'Upload'
);

// Preload functions til critical routes
export const preloadDashboard = () => import('@/pages/Dashboard');
export const preloadLeagues = () => import('@/pages/LeaguesPage');
export const preloadActivities = () => import('@/pages/ActivitiesPage');

// Bundle analyzer utility (kun i development)
export const logBundleSize = async () => {
  if (process.env.NODE_ENV === 'development') {
    const performanceEntries = performance.getEntriesByType('navigation');
    if (performanceEntries.length > 0) {
      const [entry] = performanceEntries as PerformanceNavigationTiming[];
      console.log('📦 Bundle Performance:', {
        domContentLoaded: `${entry.domContentLoadedEventEnd - entry.domContentLoadedEventStart}ms`,
        totalLoadTime: `${entry.loadEventEnd - entry.loadEventStart}ms`,
        transferSize: entry.transferSize ? `${Math.round(entry.transferSize / 1024)}KB` : 'N/A'
      });
    }
  }
};