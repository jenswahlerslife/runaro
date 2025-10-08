# Blog Integration - Runaro

## Oversigt
Blog-systemet er nu fuldt integreret i Runaro-platformen med support for:
- Offentlig blog med post-oversigt og individuelle post-sider
- Admin dashboard til at oprette/redigere posts
- Billedupload med crop-funktionalitet
- Markdown support
- Tag-baseret organisering
- Draft/Published status management
- Role-based admin access

## Database Ændringer

### Nye Tabeller

**1. `user_roles`**
- Administrerer bruger-roller (admin/user)
- Foreign key til `profiles.id`
- Unique constraint på (user_id, role)

**2. `posts`**
- Gemmer blog-opslag
- Felter: title, slug, excerpt, content, cover_image_url, tags, reading_minutes, status, published_at
- Foreign key til `profiles.id` (author_id)
- RLS policies for sikkerhed

### Nye Funktioner

**`has_role(user_id, role)`**
- Security definer function til role-checking
- Forhindrer RLS recursion

### Storage Bucket

**`post-images`**
- Offentlig bucket til blog-billeder
- RLS policies for authenticated users

## Migrations

1. `20251008133348_create_blog_system.sql` - Tabeller og funktioner
2. `20251008133729_create_blog_storage_bucket.sql` - Storage bucket og policies

## Frontend Komponenter

### UI Komponenter (`src/components/blog/`)
- `PostCard.tsx` - Post preview card
- `ImageCropDialog.tsx` - Billedkrop dialog
- `PostPreview.tsx` - Post preview modal
- `AdminPostList.tsx` - Admin post liste

### Sider (`src/pages/`)
- `Blog.tsx` - Offentlig blog-oversigt
- `BlogPost.tsx` - Individuel post-visning
- `AdminBlog.tsx` - Admin dashboard
- `AdminBlogEditor.tsx` - Post editor (create/edit)

## Routing

```
/blog                          - Blog oversigt (offentlig)
/blog/:slug                    - Individuel post (offentlig)
/admin/blog                    - Admin dashboard (kræver login)
/admin/blog/opret              - Opret nyt post (kræver login)
/admin/blog/rediger/:id        - Rediger post (kræver login)
```

## Auth Integration

### useAuth Hook Updates
Tilføjet `isAdmin` property som checker `user_roles` tabellen automatisk ved login.

```typescript
interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isAdmin: boolean;  // NY
  // ... andre methods
}
```

## NPM Dependencies

Nye pakker installeret:
- `slugify` - Auto-generering af slugs
- `react-markdown` - Markdown rendering
- `react-easy-crop` - Billedkrop funktionalitet

## Admin Access

### Automatisk Script (Anbefalet)

```bash
# Tildel admin til seneste bruger
node scripts/assign-admin-role.cjs

# Tildel admin til specifik email
node scripts/assign-admin-role.cjs user@example.com
```

### Manuel SQL (Alternativ)

```sql
INSERT INTO public.user_roles (user_id, role)
VALUES ('[USER_UUID_HERE]', 'admin');
```

**Note:** Admin rolle er allerede tildelt til `test@example.com`

## Workflow

### Oprette Blog Post
1. Login som admin
2. Gå til `/admin/blog`
3. Klik "Nyt opslag"
4. Udfyld title (slug genereres automatisk)
5. Tilføj excerpt og content (Markdown support)
6. Upload og crop cover billede (valgfrit)
7. Tilføj tags (kommasepareret)
8. Sæt læsetid og status (draft/published)
9. Preview post inden publicering
10. Gem som draft eller publicér direkte

### Redigere Post
1. Gå til `/admin/blog`
2. Find post i listen
3. Klik edit-ikon
4. Foretag ændringer
5. Gem

### Se Posts
- Offentlig liste: `/blog`
- Søg efter title eller tags
- Klik på post for at se fuld version

## Sikkerhed

- **RLS Policies**: Alle tabeller har Row-Level Security
- **Admin Check**: Bruger `SECURITY DEFINER` function for at undgå RLS recursion
- **Image Validation**: Client-side validering af filtype og størrelse (max 5MB)
- **Storage Policies**: Kun authenticated users kan uploade
- **Protected Routes**: Admin sider checker authentication status

## Test Checklist

- [x] Database migrations kørt succesfuldt
- [x] Storage bucket oprettet
- [x] TypeScript kompilerer uden fejl
- [x] Admin rolle tildelt til test bruger
- [x] Test blog post oprettet
- [x] Foreign key constraints fikseret
- [ ] User kan tilgå `/blog` (test efter deploy)
- [ ] Admin kan oprette posts via UI (test efter deploy)
- [ ] Billedupload virker (test efter deploy)
- [ ] Markdown rendering virker (test efter deploy)
- [ ] Draft/Published status virker (test efter deploy)
- [ ] Tags vises korrekt (test efter deploy)
- [ ] Search funktionalitet virker (test efter deploy)

## Næste Skridt

1. ✅ Admin rolle tildelt automatisk
2. ✅ Test blog post oprettet
3. Start dev server: `npm run dev`
4. Åbn browser på `http://localhost:8080/blog`
5. Verificer at test-posten vises
6. Login og gå til `/admin/blog`
7. Test at oprette nyt blog-post via UI
8. Test billedupload funktionalitet
9. Deploy til production: `npm run deploy:quick`

## Filer Ændret/Oprettet

### Database
- `supabase/migrations/20251008133348_create_blog_system.sql` (ny)
- `supabase/migrations/20251008133729_create_blog_storage_bucket.sql` (ny)

### Frontend
- `src/components/blog/PostCard.tsx` (ny)
- `src/components/blog/ImageCropDialog.tsx` (ny)
- `src/components/blog/PostPreview.tsx` (ny)
- `src/components/blog/AdminPostList.tsx` (ny)
- `src/pages/Blog.tsx` (ny)
- `src/pages/BlogPost.tsx` (ny)
- `src/pages/AdminBlog.tsx` (ny)
- `src/pages/AdminBlogEditor.tsx` (ny)
- `src/hooks/useAuth.tsx` (opdateret - tilføjet isAdmin)
- `src/App.tsx` (opdateret - tilføjet blog routes)
- `src/integrations/supabase/types.ts` (opdateret med nye tabeller)
- `package.json` (opdateret med nye dependencies)

## Support

Kontakt udvikler hvis der opstår problemer med:
- Admin access setup
- Billedupload issues
- Markdown rendering
- Performance problemer
