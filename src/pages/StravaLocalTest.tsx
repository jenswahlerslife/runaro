import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Check, X, AlertCircle } from 'lucide-react';

const StravaLocalTest = () => {
  const { user } = useAuth();
  const [authCode, setAuthCode] = useState('');
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<any>(null);

  const STRAVA_CLIENT_ID = '174654';
  const REDIRECT_URI = 'https://runaro.dk/auth/strava/callback';

  const openStravaAuth = () => {
    const scope = 'read,activity:read_all';
    const state = user?.id || 'test-user';
    const oauthUrl = `https://www.strava.com/oauth/authorize?client_id=${STRAVA_CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&approval_prompt=force&scope=${scope}&state=${state}`;
    
    window.open(oauthUrl, '_blank', 'width=600,height=700');
  };

  const testAuthCode = async () => {
    if (!authCode.trim()) {
      setResult({ error: 'Please enter an authorization code' });
      return;
    }

    setTesting(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('strava-auth', {
        body: {
          code: authCode,
          state: user?.id,
        },
      });

      if (error) {
        setResult({ error: error.message });
      } else if (data?.error) {
        setResult({ error: `Strava API Error: ${data.error}` });
      } else {
        setResult({ success: true, data });
      }
    } catch (error: any) {
      setResult({ error: error.message });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>Strava OAuth Test (Development)</CardTitle>
          <CardDescription>
            Test Strava integration during development when callback goes to production
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Development Workaround:</strong> Since Strava only allows production callbacks, 
              you'll need to manually copy the authorization code from the callback URL.
            </AlertDescription>
          </Alert>

          <div className="space-y-4">
            <div>
              <Label className="text-base font-semibold">Step 1: Authorize with Strava</Label>
              <p className="text-sm text-muted-foreground mb-2">
                This will open Strava in a new window and redirect to runaro.dk
              </p>
              <Button onClick={openStravaAuth} className="w-full">
                Open Strava Authorization
              </Button>
            </div>

            <div>
              <Label className="text-base font-semibold">Step 2: Copy Authorization Code</Label>
              <p className="text-sm text-muted-foreground mb-2">
                After authorizing, copy the 'code' parameter from the callback URL
              </p>
              <div className="space-y-2">
                <Label htmlFor="auth-code">Authorization Code</Label>
                <Input
                  id="auth-code"
                  placeholder="Paste the code parameter from callback URL"
                  value={authCode}
                  onChange={(e) => setAuthCode(e.target.value)}
                />
              </div>
            </div>

            <div>
              <Label className="text-base font-semibold">Step 3: Test Integration</Label>
              <Button 
                onClick={testAuthCode} 
                disabled={testing || !authCode.trim()}
                className="w-full mt-2"
              >
                {testing ? 'Testing...' : 'Test Authorization Code'}
              </Button>
            </div>
          </div>

          {result && (
            <Alert className={result.error ? "border-red-200" : "border-green-200"}>
              <div className="flex items-center gap-2">
                {result.error ? (
                  <X className="h-4 w-4 text-red-600" />
                ) : (
                  <Check className="h-4 w-4 text-green-600" />
                )}
                <div>
                  <AlertDescription>
                    {result.error ? (
                      <div>
                        <strong>Error:</strong> {result.error}
                      </div>
                    ) : (
                      <div>
                        <strong>Success!</strong> Strava account connected successfully.
                        <details className="mt-2">
                          <summary className="cursor-pointer">Show details</summary>
                          <pre className="text-xs mt-2 p-2 bg-muted rounded">
                            {JSON.stringify(result.data, null, 2)}
                          </pre>
                        </details>
                      </div>
                    )}
                  </AlertDescription>
                </div>
              </div>
            </Alert>
          )}

          <Card className="bg-muted/50">
            <CardContent className="p-4">
              <h4 className="font-semibold mb-2">How this works:</h4>
              <ol className="text-sm space-y-1 list-decimal list-inside">
                <li>Click "Open Strava Authorization" to start OAuth flow</li>
                <li>Authorize the app on Strava</li>
                <li>You'll be redirected to runaro.dk/auth/strava/callback?code=...</li>
                <li>Copy the 'code' parameter from that URL</li>
                <li>Paste it here and click "Test Authorization Code"</li>
                <li>This will call our Edge Function to complete the integration</li>
              </ol>
            </CardContent>
          </Card>
        </CardContent>
      </Card>
    </div>
  );
};

export default StravaLocalTest;