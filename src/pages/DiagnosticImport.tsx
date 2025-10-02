import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Layout from '@/components/Layout';

export default function DiagnosticImport() {
  const [output, setOutput] = useState<string>('Ready to test...\n');

  const addLog = (msg: string) => {
    setOutput(prev => prev + msg + '\n');
  };

  const runDiagnostic = async () => {
    setOutput('=== IMPORT DIAGNOSTIC TEST ===\n\n');

    // 1. Check session
    addLog('1. Checking session...');
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    addLog(`   Has session: ${!!session}`);
    addLog(`   Has access_token: ${!!session?.access_token}`);
    addLog(`   Token preview: ${session?.access_token?.substring(0, 30)}...`);
    addLog(`   Session error: ${sessionError?.message || 'none'}`);

    if (!session?.access_token) {
      addLog('\n❌ NO SESSION! User needs to sign in first.\n');
      return;
    }

    // 2. Test manual fetch
    addLog('\n2. Testing manual fetch with raw JWT...');
    try {
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

      const text = await response.text();
      addLog(`   Status: ${response.status}`);
      addLog(`   Response: ${text}`);

      if (response.status === 401) {
        addLog('\n❌ 401 from manual fetch - token invalid or Edge Function env misconfigured');
        try {
          const errorData = JSON.parse(text);
          addLog(`   Error details: ${JSON.stringify(errorData, null, 2)}`);
        } catch {}
      } else if (response.ok) {
        addLog('\n✅ Manual fetch worked!');
      }
    } catch (err: any) {
      addLog(`   Error: ${err.message}`);
    }

    // 3. Test functions.invoke
    addLog('\n3. Testing supabase.functions.invoke...');
    try {
      const { data, error } = await supabase.functions.invoke('import-recent-activities', {
        body: { limit: 1 },
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      addLog(`   Data: ${JSON.stringify(data, null, 2)}`);
      addLog(`   Error: ${error ? JSON.stringify(error, null, 2) : 'none'}`);

      if (error) {
        addLog('\n❌ functions.invoke failed');
      } else {
        addLog('\n✅ functions.invoke worked!');
      }
    } catch (err: any) {
      addLog(`   Exception: ${err.message}`);
    }

    addLog('\n=== TEST COMPLETE ===');
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Import Activities Diagnostic</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={runDiagnostic} size="lg">
              Run Diagnostic Test
            </Button>

            <div className="bg-black text-green-400 p-4 rounded font-mono text-sm whitespace-pre-wrap max-h-[600px] overflow-y-auto">
              {output}
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
