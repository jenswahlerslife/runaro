import { useState } from 'react';
import { useToast } from '@/components/ui/use-toast';

export interface AsyncActionOptions {
  successMessage?: string;
  errorMessage?: string;
  onSuccess?: () => void | Promise<void>;
  onError?: (error: any) => void;
}

export interface AsyncActionReturn<T extends any[]> {
  execute: (...args: T) => Promise<void>;
  loading: boolean;
  error: Error | null;
}

/**
 * Hook for managing async actions with loading states, error handling, and toast notifications
 */
export function useAsyncAction<T extends any[]>(
  action: (...args: T) => Promise<void>,
  options: AsyncActionOptions = {}
): AsyncActionReturn<T> {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const { toast } = useToast();

  const execute = async (...args: T) => {
    setLoading(true);
    setError(null);

    try {
      await action(...args);

      if (options.successMessage) {
        toast({
          title: options.successMessage,
        });
      }

      if (options.onSuccess) {
        await options.onSuccess();
      }
    } catch (err: any) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);

      if (options.errorMessage) {
        toast({
          title: options.errorMessage,
          description: error.message,
          variant: "destructive",
        });
      }

      if (options.onError) {
        options.onError(error);
      }
    } finally {
      setLoading(false);
    }
  };

  return {
    execute,
    loading,
    error
  };
}