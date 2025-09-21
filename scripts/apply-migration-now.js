// Apply a single SQL migration file to Supabase via Management API
import fs from 'fs';

const PROJECT_REF = 'ojjpslrhyutizwpvvngu';
const API = 'https://api.supabase.com/v1';
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN || 'sbp_38d564351d1f0f43a23413c6e527faf2d255e858';

async function applySql(filePath) {
  const sql = fs.readFileSync(filePath, 'utf8');
  const res = await fetch(`${API}/projects/${PROJECT_REF}/database/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query: sql })
  });
  const text = await res.text();
  console.log('Status:', res.status);
  console.log(text);
}

const file = process.argv[2];
if (!file) {
  console.error('Usage: node scripts/apply-migration-now.js <path-to-sql>');
  process.exit(1);
}

applySql(file).catch((e) => { console.error(e); process.exit(1); });

