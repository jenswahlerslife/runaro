import { useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface ErrorReport {
  error_type: string;
  error_message: string;
  error_stack?: string;
  url?: string;
  user_agent?: string;
  severity?: 'error' | 'warning' | 'info' | 'critical';
  source?: 'frontend' | 'backend' | 'supabase';
  context?: Record<string, unknown>;
}

export function useErrorReporting() {
  const logError = useCallback(async (errorData: ErrorReport) => {
    try {
      const { data, error } = await supabase.rpc('log_error', {
        p_error_type: errorData.error_type,
        p_error_message: errorData.error_message,
        p_error_stack: errorData.error_stack || null,
        p_url: errorData.url || window.location.href,
        p_user_agent: errorData.user_agent || navigator.userAgent,
        p_severity: errorData.severity || 'error',
        p_source: errorData.source || 'frontend',
        p_context: errorData.context || null
      });

      if (error) {
        console.error('Failed to log error:', error);
      } else {
        console.log('Error logged successfully:', data);
      }
    } catch (err) {
      // Silent fail - don't create infinite error loops
      console.error('Error reporting failed:', err);
    }
  }, []);

  const logJavaScriptError = useCallback((error: Error, errorInfo?: Record<string, unknown>) => {
    logError({
      error_type: 'javascript',
      error_message: error.message,
      error_stack: error.stack,
      severity: 'error',
      context: {
        name: error.name,
        errorInfo: errorInfo
      }
    });
  }, [logError]);

  const logNetworkError = useCallback((url: string, status: number, statusText: string) => {
    logError({
      error_type: 'network',
      error_message: `Network request failed: ${status} ${statusText}`,
      severity: status >= 500 ? 'error' : 'warning',
      context: {
        url,
        status,
        statusText
      }
    });
  }, [logError]);

  const logSupabaseError = useCallback((operation: string, error: { message: string; code?: string; details?: string; hint?: string }) => {
    logError({
      error_type: 'supabase',
      error_message: `Supabase ${operation} failed: ${error.message}`,
      severity: 'error',
      source: 'backend',
      context: {
        operation,
        error_code: error.code,
        error_details: error.details,
        hint: error.hint
      }
    });
  }, [logError]);

  const logUserAction = useCallback((action: string, context?: Record<string, unknown>) => {
    logError({
      error_type: 'user_action',
      error_message: `User action: ${action}`,
      severity: 'info',
      context: {
        action,
        ...context
      }
    });
  }, [logError]);

  useEffect(() => {
    // Global error handler for uncaught JavaScript errors
    const handleError = (event: ErrorEvent) => {
      logJavaScriptError(new Error(event.message), {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno
      });
    };

    // Global handler for unhandled promise rejections
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const error = event.reason instanceof Error 
        ? event.reason 
        : new Error(String(event.reason));
      
      logJavaScriptError(error, {
        type: 'unhandled_promise_rejection'
      });
    };

    // Monitor network requests for errors
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      try {
        const response = await originalFetch(...args);
        
        if (!response.ok) {
          const url = args[0] instanceof Request ? args[0].url : String(args[0]);
          logNetworkError(url, response.status, response.statusText);
        }
        
        return response;
      } catch (error) {
        const url = args[0] instanceof Request ? args[0].url : String(args[0]);
        logNetworkError(url, 0, 'Network Error');
        throw error;
      }
    };

    // Add event listeners
    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    // Cleanup
    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      window.fetch = originalFetch;
    };
  }, [logJavaScriptError, logNetworkError]);

  return {
    logError,
    logJavaScriptError,
    logNetworkError,
    logSupabaseError,
    logUserAction
  };
}

// Error boundary component for React errors
import React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private logError?: (error: Error, errorInfo?: Record<string, unknown>) => void;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Use the error reporting system
    if (this.logError) {
      this.logError(error, errorInfo);
    } else {
      // Fallback logging
      console.error('React Error Boundary caught error:', error, errorInfo);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="text-center space-y-4 p-8">
            <h2 className="text-2xl font-bold text-destructive">Something went wrong</h2>
            <p className="text-muted-foreground">
              An error occurred and has been reported automatically.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}