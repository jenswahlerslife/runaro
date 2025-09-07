// Fix Supabase Auth URL configuration
const SUPABASE_ACCESS_TOKEN = 'sbp_eed1316b98c00000199ef9b93fa5dee163591696';
const PROJECT_REF = 'ojjpslrhyutizwpvvngu';

console.log('🔧 FIKSER SUPABASE AUTH URL KONFIGURATION');
console.log('==========================================');

async function updateSupabaseAuthConfig() {
  console.log('1️⃣ Opdaterer Supabase Auth konfiguration...');
  
  try {
    // Update Site URL and Additional Redirect URLs via Management API
    const response = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/config/auth`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        SITE_URL: 'https://runaro.dk',
        ADDITIONAL_REDIRECT_URLS: [
          'https://runaro.dk',
          'https://runaro.dk/*',
          'https://runaro.dk/auth/callback',
          'http://localhost:8081/*',
          'http://localhost:5173/*',
          'http://localhost:3000/*'
        ].join(',')
      })
    });

    if (response.ok) {
      console.log('✅ Supabase Auth konfiguration opdateret');
      const result = await response.json();
      console.log('📊 Ny konfiguration:', result);
    } else {
      const error = await response.text();
      console.log('⚠️  Auth konfiguration fejl:', error);
    }
  } catch (error) {
    console.log('⚠️  Exception ved auth konfiguration:', error.message);
  }
}

updateSupabaseAuthConfig().catch(console.error);