#!/usr/bin/env node

/**
 * Script to create a test blog post
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://ojjpslrhyutizwpvvngu.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9qanBzbHJoeXV0aXp3cHZ2bmd1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjIzMDI0NSwiZXhwIjoyMDcxODA2MjQ1fQ.Wm6AbiLNjIVM-T4a7TUhBMphb5EW9fMMLJC9-wSJNS4';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function getFirstUser() {
  const { data: { users }, error } = await supabase.auth.admin.listUsers();
  if (error || !users || users.length === 0) {
    throw new Error('No users found');
  }
  return users[0];
}

async function createTestPost() {
  console.log('🚀 Creating test blog post...\n');

  const user = await getFirstUser();
  console.log(`Using author: ${user.email}`);

  const testPost = {
    title: 'Velkommen til Runaro Blog',
    slug: 'velkommen-til-runaro-blog',
    excerpt: 'En blog om løb, territorier og jagten på nye ruter gennem byen.',
    content: `# Velkommen til Runaro Blog

Runaro handler om at gøre løb til et eventyr gennem byen. Her deler vi historier, tips og oplevelser fra løbeverdenen.

## Hvad kan du forvente?

- **Rute-anbefalinger**: De bedste steder at løbe i København
- **Træningsråd**: Tips til at forbedre din løbeteknik
- **Territorier**: Strategier til at erobre nye områder i spillet
- **Community stories**: Historier fra andre løbere

## Kom i gang

Udforsk vores blog-indlæg og find inspiration til din næste løbetur. God fornøjelse!

*- Runaro Team*`,
    cover_image_url: 'https://images.unsplash.com/photo-1552674605-db6ffd4facb5?w=1200',
    tags: ['Velkommen', 'Løb', 'København'],
    reading_minutes: 3,
    status: 'published',
    published_at: new Date().toISOString(),
    author_id: user.id
  };

  const { data, error } = await supabase
    .from('posts')
    .insert([testPost])
    .select()
    .single();

  if (error) {
    console.error('❌ Error creating post:', error);
    return;
  }

  console.log('\n✅ Test post created successfully!');
  console.log(`\n📝 Post details:`);
  console.log(`   Title: ${data.title}`);
  console.log(`   Slug: ${data.slug}`);
  console.log(`   URL: /blog/${data.slug}`);
  console.log(`   Status: ${data.status}`);
  console.log('\n✨ You can now view it at http://localhost:8080/blog\n');
}

createTestPost().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
