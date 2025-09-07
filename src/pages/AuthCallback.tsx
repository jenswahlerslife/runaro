import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';

const AuthCallback = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [message, setMessage] = useState('Logger dig ind...');

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        setStatus('processing');
        setMessage('Behandler login...');

        // Supabase automatically parses the URL hash and restores the session
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          throw error;
        }

        if (session?.user) {
          setStatus('success');
          setMessage('Login gennemført! Omdirigerer...');
          
          // Ensure profile exists (self-healing)
          await ensureProfileExists(session.user);
          
          // Redirect to dashboard/leagues page
          setTimeout(() => {
            navigate('/leagues', { replace: true });
          }, 1500);
        } else {
          throw new Error('Ingen session fundet');
        }
      } catch (error: any) {
        console.error('Auth callback error:', error);
        setStatus('error');
        setMessage('Fejl ved login. Prøv igen.');
        
        // Redirect to login after error
        setTimeout(() => {
          navigate('/auth', { replace: true });
        }, 3000);
      }
    };

    // Also listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        setStatus('success');
        setMessage('Login gennemført! Omdirigerer...');
        
        await ensureProfileExists(session.user);
        
        setTimeout(() => {
          navigate('/leagues', { replace: true });
        }, 1500);
      }
    });

    handleAuthCallback();

    return () => subscription.unsubscribe();
  }, [navigate]);

  // Self-healing profile creation
  const ensureProfileExists = async (user: any) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!data && !error) {
        // Create profile if it doesn't exist
        const username = user.user_metadata?.username || user.email?.split('@')[0] || 'user';
        
        await supabase.from('profiles').insert({
          user_id: user.id,
          username,
          display_name: username,
        });
        
        console.log('Profile created for user:', user.id);
      }
    } catch (error) {
      console.warn('Error ensuring profile exists:', error);
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'processing':
        return (
          <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-primary mx-auto mb-6"></div>
        );
      case 'success':
        return (
          <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        );
      case 'error':
        return (
          <div className="w-12 h-12 bg-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-md mx-auto shadow-xl border-0 bg-white/95 backdrop-blur-lg">
        <CardContent className="p-8 text-center">
          {getStatusIcon()}
          
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            {status === 'processing' && 'Logger ind...'}
            {status === 'success' && 'Velkommen!'}
            {status === 'error' && 'Ups!'}
          </h1>
          
          <p className="text-gray-600 text-lg">
            {message}
          </p>
          
          {status === 'processing' && (
            <div className="mt-6">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-primary h-2 rounded-full animate-pulse" style={{width: '60%'}}></div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AuthCallback;