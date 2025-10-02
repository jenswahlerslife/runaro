import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function FunctionHealthCheck() {
  const [output, setOutput] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const addLog = (message: string) => {
    setOutput(prev => prev + '\n' + message);
    console.log(message);
  };

  const runHealthCheck = async () => {
    setOutput('Starting health check...\n');
    setLoading(true);

    try {
      // 1. Check session
      addLog('1. Checking authentication session...');
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError || !session) {
        addLog(`❌ Not authenticated: ${sessionError?.message || 'No session'}`);
        setLoading(false);
        return;
      }

      addLog(`✅ Authenticated as: ${session.user.email}`);
      addLog(`   User ID: ${session.user.id}`);
      addLog(`   Token expires: ${new Date(session.expires_at! * 1000).toISOString()}`);

      // 2. Check project fingerprint
      addLog('\n2. Verifying project configuration...');
      const projectRef = import.meta.env.VITE_SUPABASE_URL?.match(/https:\/\/(.+?)\.supabase\.co/)?.[1];
      addLog(`   Project Ref: ${projectRef}`);
      addLog(`   Expected: ojjpslrhyutizwpvvngu`);

      if (projectRef !== 'ojjpslrhyutizwpvvngu') {
        addLog('❌ Project mismatch! Client is pointing to wrong project.');
        setLoading(false);
        return;
      }
      addLog('✅ Project fingerprint matches');

      // 3. Manual fetch to function
      addLog('\n3. Testing manual fetch to import-recent-activities...');
      addLog('   URL: https://ojjpslrhyutizwpvvngu.supabase.co/functions/v1/import-recent-activities');

      const response = await fetch(
        'https://ojjpslrhyutizwpvvngu.supabase.co/functions/v1/import-recent-activities',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ limit: 1 })
        }
      );

      addLog(`   Response status: ${response.status} ${response.statusText}`);

      const responseText = await response.text();
      addLog(`   Response body: ${responseText.substring(0, 500)}`);

      if (!response.ok) {
        addLog(`❌ Function returned ${response.status}`);
        addLog('\nDEBUG INFO:');
        addLog('- Check Supabase Dashboard → Functions → import-recent-activities → Logs');
        addLog('- Look for "AUTH DEBUG" entries');
        addLog('- Verify SUPABASE_URL, SUPABASE_ANON_KEY are set in function env');
        setLoading(false);
        return;
      }

      const data = JSON.parse(responseText);
      addLog('✅ Function call succeeded!');
      addLog(`   Result: ${JSON.stringify(data, null, 2)}`);

      // 4. Test supabase.functions.invoke
      addLog('\n4. Testing supabase.functions.invoke...');
      const { data: invokeData, error: invokeError } = await supabase.functions.invoke(
        'import-recent-activities',
        {
          body: { limit: 1 },
          headers: {
            Authorization: `Bearer ${session.access_token}`
          }
        }
      );

      if (invokeError) {
        addLog(`❌ Invoke failed: ${invokeError.message}`);
        addLog(`   Details: ${JSON.stringify(invokeError, null, 2)}`);
      } else {
        addLog('✅ Invoke succeeded!');
        addLog(`   Result: ${JSON.stringify(invokeData, null, 2)}`);
      }

      // 5. Check database
      addLog('\n5. Checking user_activities table...');
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', session.user.id)
        .single();

      if (profile) {
        const { data: activities, error: activitiesError } = await supabase
          .from('user_activities')
          .select('id, name, distance, start_date, strava_activity_id')
          .eq('user_id', profile.id)
          .order('start_date', { ascending: false })
          .limit(5);

        if (activitiesError) {
          addLog(`❌ Failed to query activities: ${activitiesError.message}`);
        } else {
          addLog(`✅ Found ${activities?.length || 0} recent activities`);
          activities?.forEach((act, i) => {
            addLog(`   ${i + 1}. ${act.name} (${(act.distance / 1000).toFixed(2)} km) - Strava ID: ${act.strava_activity_id}`);
          });
        }
      }

      addLog('\n✅ HEALTH CHECK COMPLETE');

    } catch (error: any) {
      addLog(`\n❌ Error: ${error.message}`);
      addLog(`   Stack: ${error.stack}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle>Function Health Check</CardTitle>
          <CardDescription>
            Diagnostic tool to test import-recent-activities function and isolate 401 errors
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={runHealthCheck} disabled={loading}>
            {loading ? 'Running checks...' : 'Run Health Check'}
          </Button>

          {output && (
            <div className="bg-black text-green-400 p-4 rounded-lg font-mono text-sm whitespace-pre-wrap overflow-auto max-h-[600px]">
              {output}
            </div>
          )}

          <div className="text-sm text-muted-foreground space-y-2">
            <p><strong>What this tests:</strong></p>
            <ul className="list-disc list-inside space-y-1">
              <li>Authentication session validity</li>
              <li>Project configuration matching</li>
              <li>Manual fetch to Edge Function (bypasses client SDK)</li>
              <li>Supabase functions.invoke method</li>
              <li>Database access to user_activities table</li>
            </ul>
            <p className="mt-4"><strong>If you see 401:</strong></p>
            <ul className="list-disc list-inside space-y-1">
              <li>Check Supabase Dashboard → Functions → import-recent-activities → Logs</li>
              <li>Look for "AUTH DEBUG" messages showing what's failing</li>
              <li>Verify function environment variables are set</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
