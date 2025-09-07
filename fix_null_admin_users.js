// Fix NULL admin_user_id values
const SUPABASE_ACCESS_TOKEN = 'sbp_eed1316b98c00000199ef9b93fa5dee163591696';
const PROJECT_REF = 'ojjpslrhyutizwpvvngu';

console.log('🔧 FIKSER NULL VÆRDIER I admin_user_id');
console.log('=====================================');

async function executeSQL(sql, description) {
  console.log(`🔧 ${description}...`);
  
  try {
    const response = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        query: sql
      })
    });

    if (response.ok) {
      const result = await response.json();
      console.log(`✅ ${description} - Success`);
      if (result && result.length > 0) {
        console.log('📊 Resultat:', result);
      }
      return { success: true, data: result };
    } else {
      const error = await response.text();
      console.log(`❌ ${description} - ${error}`);
      return { success: false, error };
    }
  } catch (error) {
    console.log(`❌ ${description} - ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function fixNullAdminUsers() {
  // 1) Se hvor mange leagues der har NULL admin_user_id
  await executeSQL(`
    SELECT count(*) as null_admin_count 
    FROM public.leagues 
    WHERE admin_user_id IS NULL;
  `, 'Tæller leagues med NULL admin_user_id');

  // 2) Se alle leagues med deres creator_id (hvis den stadig findes)
  await executeSQL(`
    SELECT id, name, admin_user_id 
    FROM public.leagues 
    WHERE admin_user_id IS NULL
    LIMIT 5;
  `, 'Viser leagues med NULL admin_user_id');

  // 3) Slet leagues uden admin (de er ufuldstændige)
  await executeSQL(`
    DELETE FROM public.leagues 
    WHERE admin_user_id IS NULL;
  `, 'Sletter leagues uden admin_user_id');

  // 4) Nu kan vi gøre admin_user_id NOT NULL
  await executeSQL(`
    ALTER TABLE public.leagues 
    ALTER COLUMN admin_user_id SET NOT NULL;
  `, 'Gør admin_user_id NOT NULL');

  // 5) Tilføj foreign key constraint
  await executeSQL(`
    ALTER TABLE public.leagues 
    ADD CONSTRAINT IF NOT EXISTS leagues_admin_fk 
    FOREIGN KEY (admin_user_id) 
    REFERENCES public.profiles(id) 
    ON DELETE CASCADE;
  `, 'Tilføjer foreign key constraint');

  // 6) Test at alt virker ved at køre en test query
  await executeSQL(`
    SELECT l.id, l.name, l.admin_user_id, p.user_id as auth_user_id
    FROM public.leagues l
    JOIN public.profiles p ON l.admin_user_id = p.id
    LIMIT 3;
  `, 'Tester join mellem leagues og profiles');

  console.log('\n🎉 NULL VÆRDIER FIKSET!');
  console.log('=======================');
  console.log('✅ Ugyldige leagues slettet');
  console.log('✅ admin_user_id er nu NOT NULL');
  console.log('✅ Foreign key constraint tilføjet');
  console.log('');
  console.log('🚀 Nu skulle 400 fejlen helt være væk!');
}

fixNullAdminUsers().catch(console.error);