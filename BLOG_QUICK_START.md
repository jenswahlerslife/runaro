# 🎉 Blog Integration - Quick Start

Blog-systemet er nu **fuldt integreret** i Runaro!

## ✅ Hvad er gjort?

- ✅ Database tabeller oprettet (`posts`, `user_roles`)
- ✅ Storage bucket for billeder (`post-images`)
- ✅ Admin rolle system implementeret
- ✅ Alle UI komponenter og sider oprettet
- ✅ Test blog post oprettet automatisk
- ✅ Admin tildelt til `test@example.com`

## 🚀 Start Blog Systemet

### 1. Start Development Server

```bash
npm run dev
```

### 2. Se Blog

Åbn browser på:
```
http://localhost:8080/blog
```

Du burde se en test-post: **"Velkommen til Runaro Blog"**

### 3. Login som Admin

```
http://localhost:8080/auth
```

Login med: `test@example.com` (eller din egen bruger hvis du har tildelt admin rolle)

### 4. Gå til Admin Dashboard

```
http://localhost:8080/admin/blog
```

Her kan du:
- Se alle posts
- Søge og filtrere
- Oprette nye posts
- Redigere eksisterende posts

## 📝 Opret Dit Første Blog Post

1. Klik "Nyt opslag" i admin dashboard
2. Udfyld felter:
   - **Titel**: Bliver automatisk til URL slug
   - **Uddrag**: Kort beskrivelse (2-3 linjer)
   - **Indhold**: Fuld tekst med Markdown support
   - **Cover billede**: Upload og crop (valgfrit)
   - **Tags**: Kommasepareret (f.eks. "Løb, Træning, Tips")
   - **Læsetid**: Antal minutter
3. Klik "Preview opslag" for at se hvordan det ser ud
4. Gem som **Draft** eller **Publicér** direkte

## 🖼️ Billeder

### Upload Billede
1. Klik "Upload billede"
2. Vælg billede (max 5MB)
3. Crop billede til 16:9 format
4. Zoom og justér
5. Gem

### Re-crop Eksisterende Billede
Klik crop-ikonet på billedet for at justere

## 📍 Routes

### Offentlige
- `/blog` - Blog oversigt
- `/blog/:slug` - Individuel post

### Admin (kræver login + admin rolle)
- `/admin/blog` - Dashboard
- `/admin/blog/opret` - Opret ny post
- `/admin/blog/rediger/:id` - Rediger post

## 🔐 Admin Rettigheder

### Tildel Admin til Anden Bruger

```bash
# Automatisk - seneste bruger
node scripts/assign-admin-role.cjs

# Specifik email
node scripts/assign-admin-role.cjs user@example.com
```

### Tjek Hvem der er Admin

Script viser alle brugere når det køres.

## 📦 Scripts

### Opret Test Post

```bash
node scripts/create-test-post.cjs
```

### Tildel Admin Rolle

```bash
node scripts/assign-admin-role.cjs [email]
```

## 🎨 Markdown Support

Content feltet understøtter fuld Markdown:

```markdown
# Overskrift 1
## Overskrift 2

**Fed tekst**
*Kursiv tekst*

- Punkt 1
- Punkt 2

[Link](https://example.com)

![Billede](https://example.com/image.jpg)
```

## 🚢 Deploy til Production

```bash
npm run deploy:quick
```

Blog-systemet vil være tilgængeligt på:
```
https://runaro.dk/blog
```

## 📊 Database Struktur

### `posts` Tabel
- `id` - UUID
- `title` - Post titel
- `slug` - URL-venlig slug
- `excerpt` - Kort uddrag
- `content` - Fuld tekst (Markdown)
- `cover_image_url` - Cover billede URL
- `tags` - Array af tags
- `reading_minutes` - Læsetid
- `status` - draft | published
- `published_at` - Publicerings dato
- `author_id` - Reference til auth.users

### `user_roles` Tabel
- `id` - UUID
- `user_id` - Reference til auth.users
- `role` - admin | user
- `created_at` - Oprettelses dato

## 🔒 Sikkerhed

- ✅ RLS policies aktiveret
- ✅ Admin checks via `has_role()` function
- ✅ Billedvalidering (type + størrelse)
- ✅ Storage policies for authenticated users
- ✅ Protected admin routes

## 📚 Fuld Dokumentation

Se `BLOG_INTEGRATION_SUMMARY.md` for:
- Komplet teknisk dokumentation
- Database schema detaljer
- Alle migrations
- Sikkerhedsinformation

## ❓ Troubleshooting

### Kan ikke se blog
- Tjek at dev server kører: `npm run dev`
- Åbn http://localhost:8080/blog

### Kan ikke tilgå admin
- Verificer at du er logget ind
- Tjek at din bruger har admin rolle: `node scripts/assign-admin-role.cjs`

### Billedupload virker ikke
- Tjek at filen er under 5MB
- Verificer at det er en billedfil (jpg, png, etc.)

### Posts vises ikke
- Tjek at status er "published"
- Verificer at `published_at` er sat

## 🎯 Næste Skridt

1. Test blog på localhost
2. Opret dit første rigtige blog post
3. Test alle features (upload, markdown, preview, etc.)
4. Deploy til production
5. Inviter brugere til at læse!

---

**Held og lykke med din blog! 🚀**
