import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

/**
 * Helper to invoke Supabase Edge Functions with proper JWT authentication
 *
 * Usage:
 *   const result = await invokeWithAuth('import-recent-activities', { limit: 20 });
 *   if (result.error) {
 *     // Handle error
 *   } else {
 *     // Use result.data
 *   }
 */
export async function invokeWithAuth<T = any>(
  functionName: string,
  body?: Record<string, any>,
  options?: {
    showToastOnError?: boolean;
    redirectOnAuthError?: boolean;
  }
): Promise<{ data: T | null; error: Error | null }> {
  const { showToastOnError = true, redirectOnAuthError = true } = options || {};

  try {
    // Get current session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !session) {
      const error = new Error('Du skal være logget ind. Log venligst ind igen.');

      if (showToastOnError) {
        toast.error(error.message);
      }

      if (redirectOnAuthError) {
        // Soft redirect to auth page
        window.location.href = '/auth';
      }

      return { data: null, error };
    }

    // Verify project fingerprint matches
    const projectRef = import.meta.env.VITE_SUPABASE_URL?.match(/https:\/\/(.+?)\.supabase\.co/)?.[1];
    if (projectRef !== 'ojjpslrhyutizwpvvngu') {
      const error = new Error('Konfigurationsfejl: Projekt-ID matcher ikke');
      console.error('Project mismatch!', { expected: 'ojjpslrhyutizwpvvngu', got: projectRef });

      if (showToastOnError) {
        toast.error('Der er en konfigurationsfejl. Kontakt venligst support.');
      }

      return { data: null, error };
    }

    // Invoke function with explicit JWT header
    console.log(`[invokeWithAuth] Calling ${functionName}...`);
    const { data, error } = await supabase.functions.invoke(functionName, {
      body,
      headers: {
        Authorization: `Bearer ${session.access_token}`
      }
    });

    if (error) {
      console.error(`[invokeWithAuth] ${functionName} failed:`, error);

      // Check if it's a 401 auth error
      if (error.message.includes('401') || error.message.includes('Unauthorized')) {
        const authError = new Error('Session udløbet. Log venligst ind igen.');

        if (showToastOnError) {
          toast.error(authError.message);
        }

        if (redirectOnAuthError) {
          // Clear session and redirect
          await supabase.auth.signOut();
          setTimeout(() => {
            window.location.href = '/auth';
          }, 1500);
        }

        return { data: null, error: authError };
      }

      // Generic error
      if (showToastOnError) {
        toast.error(error.message || 'Der opstod en fejl');
      }

      return { data: null, error };
    }

    console.log(`[invokeWithAuth] ${functionName} succeeded:`, data);
    return { data: data as T, error: null };

  } catch (error: any) {
    console.error(`[invokeWithAuth] Unexpected error:`, error);

    if (showToastOnError) {
      toast.error(error.message || 'Der opstod en uventet fejl');
    }

    return { data: null, error };
  }
}

/**
 * Check function health without side effects (no toasts, no redirects)
 * Useful for health checks and diagnostics
 */
export async function checkFunctionHealth(
  functionName: string
): Promise<{ healthy: boolean; message: string; details?: any }> {
  try {
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      return {
        healthy: false,
        message: 'No active session',
      };
    }

    // Simple ping with minimal payload
    const { data, error } = await supabase.functions.invoke(functionName, {
      body: { limit: 1 },
      headers: {
        Authorization: `Bearer ${session.access_token}`
      }
    });

    if (error) {
      return {
        healthy: false,
        message: error.message,
        details: error,
      };
    }

    return {
      healthy: true,
      message: 'Function is responding',
      details: data,
    };
  } catch (error: any) {
    return {
      healthy: false,
      message: error.message || 'Unknown error',
      details: error,
    };
  }
}
