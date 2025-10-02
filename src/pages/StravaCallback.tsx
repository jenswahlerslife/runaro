import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { fromBase64Url } from '@/lib/oauth';

const StravaCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');

  useEffect(() => {
    const handleStravaCallback = async () => {
      try {
        const code = searchParams.get('code');
        const state = searchParams.get('state');
        const authError = searchParams.get('error');

        if (authError) {
          throw new Error(`Strava authorization failed: ${authError}`);
        }

        if (!code) {
          throw new Error('No authorization code received from Strava');
        }

        console.log('Processing Strava callback via client-side function invoke...');

        // Use client-side function invoke
        const { data, error } = await supabase.functions.invoke('strava-auth', {
          body: { code, state }
        });

        if (error) {
          throw new Error(`Strava auth function error: ${error.message}`);
        }

        console.log('Strava auth successful:', data);
        setStatus('success');

        // Decode state to get return URL
        let returnUrl = '/strava/success'; // default
        if (state) {
          try {
            const stateData = fromBase64Url(state);
            if (stateData && stateData.returnUrl) {
              // Sanitize returnUrl - only allow internal paths or runaro.dk
              const url = stateData.returnUrl;
              if (url.startsWith('/') || url.startsWith('https://runaro.dk')) {
                returnUrl = url;
              }
            }
          } catch (e) {
            console.warn('Could not decode state:', e);
          }
        }

        // Navigate to return URL using replace to prevent back navigation to callback
        setTimeout(() => {
          navigate(returnUrl, { replace: true });
        }, 1500);
        
      } catch (error: any) {
        console.error('Strava callback error:', error);
        setStatus('error');
        
        toast({
          title: "Fejl ved Strava forbindelse",
          description: error.message || 'Der opstod en fejl ved forbindelsen til Strava',
          variant: "destructive",
        });

        // Redirect to upload page after a short delay
        setTimeout(() => {
          navigate('/upload');
        }, 3000);
      }
    };

    handleStravaCallback();
  }, [searchParams, navigate, toast]);

  const getStatusMessage = () => {
    switch (status) {
      case 'processing':
        return 'Forbinder med Strava...';
      case 'success':
        return 'Strava konto forbundet! Omdirigerer...';
      case 'error':
        return 'Fejl ved forbindelse. Omdirigerer...';
      default:
        return 'Behandler...';
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'processing':
        return (
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
        );
      case 'success':
        return (
          <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        );
      case 'error':
        return (
          <div className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center max-w-md">
        {getStatusIcon()}
        <h1 className="text-2xl font-bold mb-2">Strava Integration</h1>
        <p className="text-muted-foreground">{getStatusMessage()}</p>
      </div>
    </div>
  );
};

export default StravaCallback;