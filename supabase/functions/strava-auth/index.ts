import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

function cors(origin: string | null) {
  const allowed = origin ?? '*';
  return {
    'Access-Control-Allow-Origin': allowed,
    'Vary': 'Origin',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Content-Type': 'application/json',
  };
}

function fromBase64Url(s?: string | null) {
  if (!s) return null;
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + pad;
  try {
    return JSON.parse(atob(b64));
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  const headers = cors(req.headers.get('Origin'));
  if (req.method === 'OPTIONS') return new Response('ok', { headers });

  try {
    const url = new URL(req.url);
    const contentType = req.headers.get('content-type') || '';
    const body = contentType.includes('application/json') ? await req.json().catch(() => ({})) : {};

    const code = body.code ?? url.searchParams.get('code');
    const rawState = body.state ?? url.searchParams.get('state');

    console.log('Strava auth request:', { 
      hasCode: !!code, 
      hasState: !!rawState, 
      method: req.method,
      url: req.url
    });

    if (!code) {
      return new Response(JSON.stringify({ error: 'Authorization code is required' }), { status: 400, headers });
    }

    // ENV variabler - fallback til hardcoded for nu
    const STRAVA_CLIENT_ID = Deno.env.get('STRAVA_CLIENT_ID') || '174654';
    const STRAVA_CLIENT_SECRET = Deno.env.get('STRAVA_CLIENT_SECRET') || '1b87ab9bfbda09608bda2bdc9e5d2036f0ddfd6';
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || 'https://ojjpslrhyutizwpvvngu.supabase.co';
    const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9qanBzbHJoeXV0aXp3cHZ2bmd1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjIzMDI0NSwiZXhwIjoyMDcxODA2MjQ1fQ.Wm6AbiLNjIVM-T4a7TUhBMphb5EW9fMMLJC9-wSJNS4';
    const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9qanBzbHJoeXV0aXp3cHZ2bmd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYyMzAyNDUsImV4cCI6MjA3MTgwNjI0NX0.qsKY1YPBaphie0BwV71-kHcg73ZfKNuBUHR9yHO78zA';

    // Auth: prøv at finde userId fra JWT, ellers fra state
    let userId: string | null = null;
    const jwt = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (jwt) {
      const supabaseAuth = createClient(SUPABASE_URL, ANON_KEY);
      const { data: userRes } = await supabaseAuth.auth.getUser(jwt);
      userId = userRes?.user?.id ?? null;
    }

    const parsedState = fromBase64Url(String(rawState ?? ''));
    if (!userId && parsedState?.userId) userId = String(parsedState.userId);

    if (!userId) {
      console.error('No user identification available');
      return new Response(
        JSON.stringify({ error: 'User not authenticated and no state provided' }),
        { status: 401, headers }
      );
    }

    console.log('Processing for userId:', userId);

    // Strava token exchange
    console.log('Exchanging code for tokens...');
    const tokenResp = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: STRAVA_CLIENT_ID,
        client_secret: STRAVA_CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResp.ok) {
      const txt = await tokenResp.text().catch(() => '');
      console.error('Strava token exchange failed:', tokenResp.status, txt);
      return new Response(
        JSON.stringify({ error: `Strava token exchange failed: ${tokenResp.status} ${txt}` }),
        { status: 502, headers }
      );
    }

    const token = await tokenResp.json();
    console.log('Strava tokens received for athlete:', token?.athlete?.id);

    // Gem tokens på profilen
    console.log('Saving tokens to database...');
    const supabaseSrv = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { error: upErr } = await supabaseSrv
      .from('profiles')
      .update({
        strava_access_token: token?.access_token ?? null,
        strava_refresh_token: token?.refresh_token ?? null,
        strava_expires_at: token?.expires_at ? new Date(token.expires_at * 1000).toISOString() : null,
        strava_athlete_id: token?.athlete?.id ?? null,
      })
      .eq('user_id', userId);

    if (upErr) {
      console.error('Database update failed:', upErr);
      return new Response(JSON.stringify({ error: `DB update failed: ${upErr.message}` }), { status: 500, headers });
    }

    console.log('Strava connection saved successfully');

    // Redirect: brug state.returnUrl, men whitelist!
    const allowedPrefixes = [
      'http://localhost:8080',
      'http://localhost:8081', 
      'http://localhost:3000',
      'http://localhost:5173',
      'https://runaro.dk',
    ];
    let returnUrl: string =
      (parsedState?.returnUrl && allowedPrefixes.some((p) => String(parsedState.returnUrl).startsWith(p)))
        ? String(parsedState.returnUrl)
        : 'https://runaro.dk/strava/success';

    console.log('Redirecting to:', returnUrl);

    // 302 redirect (Strava lander altid på runaro.dk)
    return new Response(null, {
      status: 302,
      headers: { ...headers, Location: returnUrl },
    });

  } catch (e: any) {
    console.error('Strava auth error:', e);
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), { status: 400, headers });
  }
});