// Create fresh transfer-activity function from scratch
const freshFunction = `
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

function cors(origin) {
  const allowed = origin ?? '*';
  return {
    'Access-Control-Allow-Origin': allowed,
    'Vary': 'Origin',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };
}

Deno.serve(async (req) => {
  const headers = cors(req.headers.get('Origin'));

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers });
  }

  try {
    // Get user from JWT
    const jwt = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!jwt) {
      return new Response(JSON.stringify({ error: 'Authorization required' }), { status: 401, headers });
    }

    // For now, return success to test end-to-end flow
    const body = await req.json();
    const { activityId } = body;

    return new Response(JSON.stringify({
      success: true,
      message: 'Fresh function working!',
      activityId: activityId,
      timestamp: new Date().toISOString()
    }), { headers });

  } catch (error) {
    console.error('Transfer activity error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Unknown error' }),
      { status: 500, headers }
    );
  }
});
`;

const projectRef = 'ojjpslrhyutizwpvvngu';
const accessToken = 'sbp_38d564351d1f0f43a23413c6e527faf2d255e858';

async function createFreshFunction() {
  console.log('🆕 Creating fresh transfer-activity function...');

  try {
    // Create new function
    const response = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/functions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'transfer-activity',
        slug: 'transfer-activity',
        source: freshFunction,
        verify_jwt: false, // Start without JWT to test OPTIONS
        import_map: '{}'
      })
    });

    if (response.ok) {
      const result = await response.json();
      console.log('✅ Fresh function created:', result.id);

      // Wait for creation
      await new Promise(resolve => setTimeout(resolve, 8000));

      // Test it
      console.log('🧪 Testing fresh function...');

      // Test OPTIONS
      const optionsResponse = await fetch(`https://ojjpslrhyutizwpvvngu.supabase.co/functions/v1/transfer-activity`, {
        method: 'OPTIONS',
        headers: {
          'Origin': 'https://runaro.dk'
        }
      });

      console.log('Fresh OPTIONS result:', optionsResponse.status);

      // Test POST
      const postResponse = await fetch(`https://ojjpslrhyutizwpvvngu.supabase.co/functions/v1/transfer-activity`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ activityId: 123 })
      });

      console.log('Fresh POST result:', postResponse.status);
      const postText = await postResponse.text();
      console.log('Fresh POST response:', postText);

      if (optionsResponse.ok && postResponse.ok) {
        console.log('🎉 Fresh function fully working!');
        return true;
      } else {
        console.log('❌ Fresh function still has issues');
        return false;
      }

    } else {
      const error = await response.text();
      console.error('❌ Create failed:', response.status, error);
      return false;
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    return false;
  }
}

await createFreshFunction();