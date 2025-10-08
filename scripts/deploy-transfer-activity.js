// Simple deployment script for Supabase Edge Function transfer-activity
// Reads code from infra/supabase/functions/transfer-activity/index.ts and PATCHes via Management API
import fs from 'fs';

const PROJECT_REF = 'ojjpslrhyutizwpvvngu';
const API_BASE = 'https://api.supabase.com/v1';

// Try to read access token from .env.production
function readAccessToken() {
  if (process.env.SUPABASE_ACCESS_TOKEN) return process.env.SUPABASE_ACCESS_TOKEN;
  try {
    const env = fs.readFileSync('.env.production', 'utf8');
    const m = env.match(/^SUPABASE_ACCESS_TOKEN=(.+)$/m);
    if (m) return m[1].trim();
  } catch {}
  // Fallback to known token used in scripts (if present)
  return 'sbp_38d564351d1f0f43a23413c6e527faf2d255e858';
}

async function main() {
  const token = readAccessToken();
  const source = fs.readFileSync('infra/supabase/functions/transfer-activity/index.ts', 'utf8');
  const body = JSON.stringify({ source, body: source, verify_jwt: true, import_map: '{}' });

  // Try PATCH to update existing
  let res = await fetch(`${API_BASE}/projects/${PROJECT_REF}/functions/transfer-activity`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body
  });

  if (res.status === 404) {
    // Create if not exists
    const createBody = JSON.stringify({ slug: 'transfer-activity', name: 'transfer-activity', source, body: source, verify_jwt: true, import_map: '{}' });
    res = await fetch(`${API_BASE}/projects/${PROJECT_REF}/functions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: createBody
    });
  }

  const text = await res.text();
  console.log('Status:', res.status);
  console.log(text);
}

main().catch((e) => {
  console.error('Deploy error:', e);
  process.exit(1);
});
