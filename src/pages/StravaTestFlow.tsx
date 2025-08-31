import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import StravaConnect from '@/components/StravaConnect';

const StravaTestFlow = () => {
  const [status, setStatus] = useState<string>('Not connected');
  const [debugInfo, setDebugInfo] = useState<any>({});
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      checkStravaConnection();
    }
  }, [user]);

  const checkStravaConnection = async () => {
    try {
      setStatus('Checking connection...');
      
      // Check if user has Strava tokens
      const { data, error } = await supabase
        .from('profiles')
        .select('strava_access_token, strava_refresh_token, strava_expires_at, strava_athlete_id')
        .eq('user_id', user?.id)
        .single();

      if (error) {
        console.error('Database error:', error);
        setStatus('Database error: ' + error.message);
        return;
      }

      if (data?.strava_access_token) {
        setStatus('Connected to Strava');
        setDebugInfo({
          hasAccessToken: !!data.strava_access_token,
          hasRefreshToken: !!data.strava_refresh_token,
          athleteId: data.strava_athlete_id,
          expiresAt: data.strava_expires_at,
          tokenExpired: data.strava_expires_at ? new Date(data.strava_expires_at) < new Date() : null
        });
      } else {
        setStatus('Not connected to Strava');
        setDebugInfo({});
      }
    } catch (error: any) {
      console.error('Check connection error:', error);
      setStatus('Error: ' + error.message);
    }
  };

  const testActivitiesFetch = async () => {
    try {
      setStatus('Fetching activities...');
      
      const { data, error } = await supabase.functions.invoke('strava-activities', {
        body: { limit: 5 }
      });

      if (error) {
        console.error('Activities fetch error:', error);
        setStatus('Activities fetch failed: ' + error.message);
        setDebugInfo({ ...debugInfo, activitiesError: error });
        return;
      }

      setStatus('Activities fetched successfully');
      setDebugInfo({ 
        ...debugInfo, 
        activitiesCount: data.activities?.length || 0,
        activities: data.activities?.slice(0, 3) || [] // Show first 3 for debug
      });

      toast({
        title: "Success!",
        description: `Fetched ${data.activities?.length || 0} activities from Strava`,
      });
    } catch (error: any) {
      console.error('Test fetch error:', error);
      setStatus('Test failed: ' + error.message);
    }
  };

  const testEdgeFunction = async () => {
    try {
      setStatus('Testing edge function...');
      
      const { data, error } = await supabase.functions.invoke('strava-auth', {
        body: { 
          code: 'test_code',
          state: user?.id 
        }
      });

      console.log('Edge function test:', { data, error });
      
      if (error) {
        setStatus('Edge function error: ' + error.message);
        setDebugInfo({ ...debugInfo, edgeFunctionError: error });
      } else {
        setStatus('Edge function responded (might fail due to test code)');
        setDebugInfo({ ...debugInfo, edgeFunctionResponse: data });
      }
    } catch (error: any) {
      setStatus('Edge function test failed: ' + error.message);
    }
  };

  const clearStravaConnection = async () => {
    try {
      setStatus('Clearing connection...');
      
      const { error } = await supabase
        .from('profiles')
        .update({
          strava_access_token: null,
          strava_refresh_token: null,
          strava_expires_at: null,
          strava_athlete_id: null,
        })
        .eq('user_id', user?.id);

      if (error) {
        setStatus('Clear failed: ' + error.message);
      } else {
        setStatus('Connection cleared');
        setDebugInfo({});
        toast({
          title: "Cleared",
          description: "Strava connection has been cleared",
        });
      }
    } catch (error: any) {
      setStatus('Clear error: ' + error.message);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Authentication Required</CardTitle>
            <CardDescription>You need to be logged in to test Strava integration</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Strava Integration Test Flow</CardTitle>
            <CardDescription>Debug and test the complete Strava integration</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-gray-100 rounded-lg">
              <h3 className="font-semibold mb-2">Current Status:</h3>
              <p className="text-sm">{status}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Button onClick={checkStravaConnection} variant="outline">
                Check Connection
              </Button>
              <Button onClick={testEdgeFunction} variant="outline">
                Test Edge Function
              </Button>
              <Button onClick={testActivitiesFetch} variant="outline" disabled={!debugInfo.hasAccessToken}>
                Test Activities Fetch
              </Button>
              <Button onClick={clearStravaConnection} variant="destructive">
                Clear Connection
              </Button>
            </div>

            {Object.keys(debugInfo).length > 0 && (
              <div className="p-4 bg-blue-50 rounded-lg">
                <h3 className="font-semibold mb-2">Debug Info:</h3>
                <pre className="text-xs overflow-auto">
                  {JSON.stringify(debugInfo, null, 2)}
                </pre>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Strava Connection</CardTitle>
            <CardDescription>Connect your Strava account</CardDescription>
          </CardHeader>
          <CardContent>
            <StravaConnect onConnected={() => {
              toast({
                title: "Connected!",
                description: "Strava account connected successfully",
              });
              setTimeout(checkStravaConnection, 1000);
            }} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Environment Info</CardTitle>
            <CardDescription>Current environment details</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <p><strong>URL:</strong> {window.location.href}</p>
              <p><strong>Hostname:</strong> {window.location.hostname}</p>
              <p><strong>User ID:</strong> {user?.id}</p>
              <p><strong>Supabase URL:</strong> {supabase.supabaseUrl}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default StravaTestFlow;