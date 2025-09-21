import { useState, useEffect, useCallback } from 'react';

/**
 * Hook for debouncing a value with configurable delay
 */
export function useDebounced<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Hook for debouncing a callback function
 */
export function useDebouncedCallback<T extends any[]>(
  callback: (...args: T) => void | Promise<void>,
  delay: number = 300
): (...args: T) => void {
  const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null);

  const debouncedCallback = useCallback((...args: T) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    const newTimeoutId = setTimeout(() => {
      callback(...args);
    }, delay);

    setTimeoutId(newTimeoutId);
  }, [callback, delay, timeoutId]);

  useEffect(() => {
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [timeoutId]);

  return debouncedCallback;
}