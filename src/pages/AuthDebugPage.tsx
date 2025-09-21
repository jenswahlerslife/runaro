// Debug page to check authentication status
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useEffect, useState } from 'react';

export default function AuthDebugPage() {
  const { user, loading: authLoading } = useAuth();
  const [sessionInfo, setSessionInfo] = useState<any>(null);

  useEffect(() => {
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();
      setSessionInfo(data);
    };
    checkSession();
  }, []);

  return (
    <div style={{ padding: '20px', fontFamily: 'monospace' }}>
      <h1>🔍 Auth Debug Page</h1>

      <div style={{ marginBottom: '20px', padding: '10px', border: '1px solid #ccc' }}>
        <h2>useAuth() Status:</h2>
        <p><strong>Loading:</strong> {authLoading ? 'true' : 'false'}</p>
        <p><strong>User:</strong> {user ? JSON.stringify({
          id: user.id,
          email: user.email,
          role: user.role
        }, null, 2) : 'null'}</p>
      </div>

      <div style={{ marginBottom: '20px', padding: '10px', border: '1px solid #ccc' }}>
        <h2>Supabase Session:</h2>
        <pre>{JSON.stringify(sessionInfo, null, 2)}</pre>
      </div>

      <div style={{ marginBottom: '20px', padding: '10px', border: '1px solid #ccc' }}>
        <h2>Instructions:</h2>
        <p>1. If user is null and loading is false → You are not logged in</p>
        <p>2. If user exists → You are logged in</p>
        <p>3. If loading is true → Auth is still checking</p>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <button
          onClick={() => window.location.href = '/auth'}
          style={{ padding: '10px 20px', fontSize: '16px' }}
        >
          Go to Login Page
        </button>
        <button
          onClick={() => window.location.href = '/leagues'}
          style={{ padding: '10px 20px', fontSize: '16px', marginLeft: '10px' }}
        >
          Go to Leagues Page
        </button>
      </div>
    </div>
  );
}