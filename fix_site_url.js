// Fix Site URL til https://runaro.dk
const SUPABASE_ACCESS_TOKEN = 'sbp_eed1316b98c00000199ef9b93fa5dee163591696';
const PROJECT_REF = 'ojjpslrhyutizwpvvngu';

console.log('🔧 OPDATERER SITE_URL TIL HTTPS://RUNARO.DK');
console.log('===========================================');

async function updateSiteURL() {
  console.log('1️⃣ Opdaterer Site URL...');
  
  try {
    // Update just the SITE_URL
    const response = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/config/auth`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        SITE_URL: 'https://runaro.dk'
      })
    });

    if (response.ok) {
      console.log('✅ Site URL opdateret til https://runaro.dk');
    } else {
      const error = await response.text();
      console.log('❌ Site URL opdatering fejlede:', error);
    }
  } catch (error) {
    console.log('❌ Exception:', error.message);
  }

  console.log('2️⃣ Opdaterer Additional Redirect URLs...');
  
  try {
    // Add authorized redirect URLs
    const response2 = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/config/auth`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        URI_ALLOW_LIST: 'https://runaro.dk,https://runaro.dk/*,https://runaro.dk/auth/callback,http://localhost:8081/*,http://localhost:5173/*,http://localhost:3000/*'
      })
    });

    if (response2.ok) {
      console.log('✅ Additional Redirect URLs opdateret');
    } else {
      const error = await response2.text();
      console.log('❌ Redirect URLs opdatering fejlede:', error);
    }
  } catch (error) {
    console.log('❌ Exception:', error.message);
  }

  console.log('\n🎉 AUTH KONFIGURATION OPDATERET!');
  console.log('================================');
  console.log('✅ Site URL: https://runaro.dk');
  console.log('✅ Redirect URLs: inkluderer både produktion og localhost');
  console.log('');
  console.log('🚀 Nu skulle email activation links pege til runaro.dk!');
}

updateSiteURL().catch(console.error);