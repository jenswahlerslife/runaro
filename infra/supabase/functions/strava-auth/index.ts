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

    // SIKKERHED: Kræv miljøvariabler - aldrig hardkodede secrets
    const STRAVA_CLIENT_ID = Deno.env.get('STRAVA_CLIENT_ID');
    const STRAVA_CLIENT_SECRET = Deno.env.get('STRAVA_CLIENT_SECRET');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');

    // Valider at alle nødvendige miljøvariabler er sat
    const missing = [];
    if (!STRAVA_CLIENT_ID) missing.push('STRAVA_CLIENT_ID');
    if (!STRAVA_CLIENT_SECRET) missing.push('STRAVA_CLIENT_SECRET');
    if (!SUPABASE_URL) missing.push('SUPABASE_URL');
    if (!SERVICE_ROLE) missing.push('SUPABASE_SERVICE_ROLE_KEY');
    if (!ANON_KEY) missing.push('SUPABASE_ANON_KEY');

    if (missing.length > 0) {
      console.error('Missing required environment variables:', missing);
      return new Response(
        JSON.stringify({ error: 'Server configuration error - missing environment variables' }),
        { status: 500, headers }
      );
    }

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
    const REDIRECT_URI = 'https://runaro.dk/auth/strava/callback';
    console.log('Exchanging code for tokens...', {
      endpoint: 'https://www.strava.com/oauth/token',
      client_id: STRAVA_CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      has_code: !!code
    });
    
    const form = new URLSearchParams();
    form.set('client_id', STRAVA_CLIENT_ID);
    form.set('client_secret', STRAVA_CLIENT_SECRET);
    form.set('code', code);
    form.set('grant_type', 'authorization_code');
    form.set('redirect_uri', REDIRECT_URI);

    console.log('DEBUG - Form data being sent:', {
      client_id: STRAVA_CLIENT_ID,
      client_secret: STRAVA_CLIENT_SECRET.substring(0, 8) + '...',
      code: code.substring(0, 8) + '...',
      grant_type: 'authorization_code',
      redirect_uri: REDIRECT_URI,
      form_body: form.toString()
    });

    const tokenResp = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    });

    if (!tokenResp.ok) {
      const txt = await tokenResp.text().catch(() => '');
      console.error('Strava token exchange failed:', {
        status: tokenResp.status,
        statusText: tokenResp.statusText,
        client_id_used: STRAVA_CLIENT_ID,
        redirect_uri_used: REDIRECT_URI,
        endpoint: 'https://www.strava.com/oauth/token',
        content_type_sent: 'application/x-www-form-urlencoded',
        response_body: txt,
        form_data_sent: 'client_id, client_secret, code, grant_type, redirect_uri'
      });
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