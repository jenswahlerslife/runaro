# 🚀 Deploy Blog til Production

Blog-systemet er bygget og klar til deployment! Da vi mangler Cloudflare API credentials, skal du deploye manuelt via Cloudflare Dashboard.

## ✅ Status

- ✅ **Build komplet** - Production build i `dist/` folder
- ✅ **Database migreret** - Alle blog-tabeller er live
- ✅ **Admin tildelt** - wahlers3@hotmail.com har admin rettigheder
- ✅ **Test post oprettet** - "Velkommen til Runaro Blog" er live i databasen

## 📤 Manuel Deployment via Cloudflare Dashboard

### Option 1: Via Dashboard (Nemmest)

1. **Log ind på Cloudflare Dashboard:**
   - Gå til https://dash.cloudflare.com/
   - Find "runaro" projektet under Pages

2. **Upload ny deployment:**
   - Klik på "Create deployment" eller "Upload assets"
   - Upload hele `dist/` mappen
   - Eller drag-and-drop `dist` folderen

3. **Vent på deployment:**
   - Cloudflare vil automatisk deploye
   - Du får en URL når det er færdigt

### Option 2: Via Wrangler CLI (Kræver Node 20+)

Hvis du har Node 20 eller nyere:

```bash
npx wrangler pages deploy dist --project-name runaro
```

**Hvis du får "needs authentication" fejl:**

```bash
# Login først
npx wrangler login

# Derefter deploy
npx wrangler pages deploy dist --project-name runaro
```

### Option 3: Via Git Push (Automatisk)

Hvis projektet er connectet til Git:

```bash
git add .
git commit -m "feat: add blog system"
git push origin main
```

Cloudflare vil automatisk bygge og deploye fra main branch.

## 🔧 Tilføj Cloudflare Credentials (Valgfrit)

For at kunne deploye direkte fra terminal, tilføj til `.env.local`:

```env
CLOUDFLARE_API_TOKEN=your_api_token_here
CLOUDFLARE_ACCOUNT_ID=your_account_id_here
```

**Få Cloudflare API Token:**
1. Gå til https://dash.cloudflare.com/profile/api-tokens
2. Klik "Create Token"
3. Vælg "Edit Cloudflare Workers" template
4. Eller custom token med permissions:
   - Account - Cloudflare Pages - Edit
5. Kopier tokenet til `.env.local`

**Find Account ID:**
1. Gå til Cloudflare Dashboard
2. Vælg dit account
3. Account ID vises i højre sidebar

## 📍 Efter Deployment

### Verificer Blog Fungerer

1. **Åbn production URL:**
   ```
   https://runaro.dk/blog
   ```

2. **Tjek at test-post vises:**
   - Du burde se "Velkommen til Runaro Blog"

3. **Test admin funktioner:**
   - Gå til https://runaro.dk/auth
   - Login med wahlers3@hotmail.com
   - Gå til https://runaro.dk/admin/blog
   - Opret nyt blog post

### Test Checklist

- [ ] Blog oversigt vises på `/blog`
- [ ] Test post er synlig
- [ ] Kan klikke ind på post og se fuld content
- [ ] Markdown rendering virker
- [ ] Tags vises korrekt
- [ ] Søgning virker
- [ ] Kan logge ind som admin
- [ ] Admin dashboard tilgængeligt på `/admin/blog`
- [ ] Kan oprette nyt post
- [ ] Billedupload virker
- [ ] Preview funktionalitet virker
- [ ] Draft/Published status management virker

## 🐛 Troubleshooting

### Build folder mangler
```bash
npm run build
```

### Deployment fejler
- Tjek Cloudflare Dashboard for fejlmeddelelser
- Verificer at `dist/` folder indeholder `index.html`
- Tjek at `public/_redirects` file er inkluderet

### Blog vises ikke
- Tjek browser console for fejl
- Verificer Supabase connection (se `/blog` i DevTools Network tab)
- Tjek at environment variables er sat korrekt i Cloudflare

### Admin access virker ikke
```bash
# Verificer admin rolle
node scripts/assign-admin-role.cjs wahlers3@hotmail.com
```

## 📚 Relaterede Filer

- **Quick Start:** `BLOG_QUICK_START.md`
- **Full Docs:** `BLOG_INTEGRATION_SUMMARY.md`
- **Build Output:** `dist/` folder

## 🎯 Hurtig Kommandoer

```bash
# Rebuild production
npm run build

# Test lokalt først
npm run dev

# Verificer admin
npm run blog:assign-admin wahlers3@hotmail.com

# Opret flere test posts
npm run blog:create-test
```

---

**Når deployment er færdig, kan du:**
1. Oprette blog posts via admin interface
2. Dele blog URL med brugere
3. Begynde at skrive content!

**Held og lykke! 🚀**
