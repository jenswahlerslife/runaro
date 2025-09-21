import { useState, useCallback } from 'react';

export interface LoadingStateReturn<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  execute: () => Promise<void>;
  refresh: () => Promise<void>;
  reset: () => void;
}

/**
 * Hook for managing data loading with loading states and error handling
 */
export function useLoadingState<T>(
  dataLoader: () => Promise<T>,
  initialData: T | null = null
): LoadingStateReturn<T> {
  const [data, setData] = useState<T | null>(initialData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const execute = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await dataLoader();
      setData(result);
    } catch (err: any) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      console.error('Data loading failed:', error);
    } finally {
      setLoading(false);
    }
  }, [dataLoader]);

  const reset = useCallback(() => {
    setData(initialData);
    setLoading(false);
    setError(null);
  }, [initialData]);

  return {
    data,
    loading,
    error,
    execute,
    refresh: execute,
    reset
  };
}