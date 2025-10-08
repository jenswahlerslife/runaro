// Quick fix to deploy function with correct credentials
const fs = require('fs');
const path = require('path');

// Create a temporary version with hardcoded credentials for deployment
const functionPath = path.join(__dirname, 'infra', 'supabase', 'functions', 'strava-auth', 'index.ts');
const originalContent = fs.readFileSync(functionPath, 'utf8');

console.log('Creating deployment-ready function...');

// Ensure we have the fallback values in place
const updatedContent = originalContent.replace(
    /const clientId = Deno\.env\.get\('STRAVA_CLIENT_ID'\).*$/m,
    "const clientId = Deno.env.get('STRAVA_CLIENT_ID') || '174654'"
).replace(
    /const clientSecret = Deno\.env\.get\('STRAVA_CLIENT_SECRET'\).*$/m,
    "const clientSecret = Deno.env.get('STRAVA_CLIENT_SECRET') || '1b87ab9bfbda09608bda2bdc9e5d2036f0ddfd6'"
);

fs.writeFileSync(functionPath, updatedContent);
console.log('✅ Function updated with fallback credentials');
console.log('📝 Now go to Supabase Dashboard > Settings > Edge Functions > Environment Variables');
console.log('📝 Add: STRAVA_CLIENT_ID = 174654');
console.log('📝 Add: STRAVA_CLIENT_SECRET = 1b87ab9bfbda09608bda2bdc9e5d2036f0ddfd6');
console.log('🚀 Then redeploy the function from the Supabase Dashboard UI');
