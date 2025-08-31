import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

// Base64URL encoding/decoding helpers
const toBase64Url = (obj: any): string => {
  const json = JSON.stringify(obj);
  return btoa(json).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const fromBase64Url = (str: string): any => {
  try {
    const pad = str.length % 4 === 0 ? '' : '='.repeat(4 - (str.length % 4));
    const b64 = str.replace(/-/g, '+').replace(/_/g, '/') + pad;
    return JSON.parse(atob(b64));
  } catch {
    return null;
  }
};

const StravaDebug = () => {
  const { user, session } = useAuth();
  const { toast } = useToast();
  const [debugState, setDebugState] = useState<any>({
    oauthUrl: '',
    statePayload: null,
    state: '',
    environment: window.location.hostname === 'localhost' ? 'development' : 'production',
    responses: {}
  });

  useEffect(() => {
    if (user) {
      generateOAuthUrl();
    }
  }, [user]);

  const generateOAuthUrl = () => {
    if (!user) return;

    const origin = window.location.origin;
    const returnUrl = origin.includes('localhost')
      ? `${origin}/strava/success`
      : 'https://runaro.dk/strava/success';

    const statePayload = {
      userId: user.id,
      returnUrl,
      nonce: crypto.getRandomValues(new Uint32Array(1))[0].toString(36),
      ts: Date.now(),
    };

    const state = toBase64Url(statePayload);
    const STRAVA_CLIENT_ID = '174654';
    const REDIRECT_URI = 'https://runaro.dk/auth/strava/callback';

    const authUrl = new URL('https://www.strava.com/oauth/authorize');
    authUrl.searchParams.set('client_id', STRAVA_CLIENT_ID);
    authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', 'read,activity:read_all');
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('approval_prompt', 'force');

    setDebugState(prev => ({
      ...prev,
      oauthUrl: authUrl.toString(),
      statePayload,
      state
    }));

    toast({
      title: "OAuth URL Generated",
      description: "Ready for testing",
    });
  };

  const testEdgeFunction = async (functionName: string, payload: any = {}) => {
    try {
      const { data, error } = await supabase.functions.invoke(functionName, {
        body: payload,
      });

      const result = { data, error, timestamp: new Date().toISOString(), payload };
      
      setDebugState(prev => ({
        ...prev,
        responses: {
          ...prev.responses,
          [functionName]: result
        }
      }));

      toast({
        title: `${functionName} Response`,
        description: error ? `Error: ${error.message}` : "Check debug panel",
        variant: error ? "destructive" : "default"
      });

      return result;
    } catch (err: any) {
      const result = { error: err.message, timestamp: new Date().toISOString(), payload };
      
      setDebugState(prev => ({
        ...prev,
        responses: {
          ...prev.responses,
          [functionName]: result
        }
      }));

      toast({
        title: `${functionName} Error`,
        description: err.message,
        variant: "destructive"
      });

      return result;
    }
  };

  const testStravaAuth = () => testEdgeFunction('strava-auth', {
    code: 'fake_test_code_123',
    state: debugState.state
  });

  const testListActivities = () => testEdgeFunction('strava-activities', { limit: 5 });

  const testTransferActivity = () => testEdgeFunction('transfer-activity', { activityId: 123456789 });

  const maskToken = (token: string) => {
    if (!token || token.length < 20) return token;
    return `${token.substring(0, 10)}...${token.substring(token.length - 10)}`;
  };

  const startOAuthFlow = () => {
    if (debugState.oauthUrl) {
      window.location.href = debugState.oauthUrl;
    } else {
      toast({
        title: "Error",
        description: "OAuth URL not generated. Please log in first.",
        variant: "destructive"
      });
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen p-6 bg-gray-50">
        <div className="max-w-4xl mx-auto">
          <Card className="border-red-200">
            <CardHeader>
              <CardTitle className="text-red-600">Authentication Required</CardTitle>
              <CardDescription>
                You need to be logged in to use the Strava debug tools.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => window.location.href = '/auth'}>
                Go to Login
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 bg-gray-50">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">🚀 Strava Integration Debugger</h1>
          <p className="text-gray-600 mt-2">Internal testing and validation tools for senior developers</p>
        </div>

        {/* Environment Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Environment Info
              <Badge variant={debugState.environment === 'development' ? 'default' : 'secondary'}>
                {debugState.environment}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-gray-500">User ID</p>
              <p className="font-mono text-sm">{user.id}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">JWT Token</p>
              <p className="font-mono text-sm">{maskToken(session?.access_token || 'N/A')}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Origin</p>
              <p className="font-mono text-sm">{window.location.origin}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Return URL</p>
              <p className="font-mono text-sm">
                {window.location.origin.includes('localhost')
                  ? `${window.location.origin}/strava/success`
                  : 'https://runaro.dk/strava/success'
                }
              </p>
            </div>
          </CardContent>
        </Card>

        {/* OAuth URL Generation */}
        <Card>
          <CardHeader>
            <CardTitle>OAuth URL Generation</CardTitle>
            <CardDescription>Test the OAuth URL construction with state parameter</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Button onClick={generateOAuthUrl} variant="outline">
                Generate OAuth URL
              </Button>
              <Button onClick={startOAuthFlow} disabled={!debugState.oauthUrl}>
                Start OAuth Flow
              </Button>
            </div>
            
            {debugState.oauthUrl && (
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-2">Generated URL:</p>
                  <div className="p-3 bg-gray-100 rounded-md">
                    <p className="font-mono text-xs break-all">{debugState.oauthUrl}</p>
                  </div>
                </div>

                {debugState.statePayload && (
                  <div>
                    <p className="text-sm font-medium text-gray-500 mb-2">State Payload:</p>
                    <pre className="p-3 bg-gray-100 rounded-md text-xs overflow-auto">
                      {JSON.stringify(debugState.statePayload, null, 2)}
                    </pre>
                    <p className="text-sm font-medium text-gray-500 mt-2 mb-1">State (Base64URL):</p>
                    <p className="font-mono text-xs break-all p-2 bg-gray-100 rounded">
                      {debugState.state}
                    </p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Edge Function Tests */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Test strava-auth</CardTitle>
              <CardDescription>Call with fake code to test error handling</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button onClick={testStravaAuth} className="w-full" variant="outline">
                Call strava-auth (mock)
              </Button>
              
              {debugState.responses['strava-auth'] && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-500">Response:</p>
                  <pre className="p-3 bg-gray-100 rounded-md text-xs overflow-auto max-h-32">
                    {JSON.stringify(debugState.responses['strava-auth'], null, 2)}
                  </pre>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">List Activities</CardTitle>
              <CardDescription>Test strava-activities function with JWT</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button onClick={testListActivities} className="w-full" variant="outline">
                Call strava-activities
              </Button>
              
              {debugState.responses['strava-activities'] && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-500">Response:</p>
                  <pre className="p-3 bg-gray-100 rounded-md text-xs overflow-auto max-h-32">
                    {JSON.stringify(debugState.responses['strava-activities'], null, 2)}
                  </pre>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Transfer Activity</CardTitle>
              <CardDescription>Test transfer-activity with dummy ID</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button onClick={testTransferActivity} className="w-full" variant="outline">
                Transfer Dummy Activity
              </Button>
              
              {debugState.responses['transfer-activity'] && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-500">Response:</p>
                  <pre className="p-3 bg-gray-100 rounded-md text-xs overflow-auto max-h-32">
                    {JSON.stringify(debugState.responses['transfer-activity'], null, 2)}
                  </pre>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Navigation and testing shortcuts</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => window.location.href = '/strava/success'} variant="outline">
                Go to Success Page
              </Button>
              <Button onClick={() => window.open('/test-strava-integration.html', '_blank')} variant="outline">
                Open HTML Test Page
              </Button>
              <Button onClick={() => window.location.reload()} variant="outline">
                Refresh Debug
              </Button>
              <Button onClick={() => setDebugState(prev => ({ ...prev, responses: {} }))} variant="outline">
                Clear Responses
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default StravaDebug;