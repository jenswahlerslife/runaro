# 📤 Upload til Cloudflare Pages

## ✅ **Klar til upload!**

Build er kørt og `dist/` mappen indeholder:
- ✅ `_redirects` (kritisk for Strava callback)
- ✅ `index.html`
- ✅ `assets/` (CSS og JS)
- ✅ Alle images og favicon

---

## 🚀 **Upload Instruktioner:**

### **Manual Upload til Cloudflare Pages:**
1. Zip **hele indholdet** af `dist/` mappen:
   - Vælg **alt** i `dist/` mappen
   - Højreklik → "Send til" → "Komprimeret (zippet) mappe"
   
2. Gå til Cloudflare Dashboard → Pages
3. Find dit runaro.dk projekt
4. Klik **"Create deployment"** eller **"Upload assets"**
5. Upload zip filen
6. Deploy!

### **Eller Git Push (hvis auto-deploy):**
```bash
git add .
git commit -m "Add _redirects for Strava OAuth fix"
git push
```

---

## 🎯 **Efter Upload - Test Flow:**

1. **Vent 2-3 minutter** på deployment
   
2. **Test _redirects virker:**
   - Åbn: https://runaro.dk/auth/strava/callback?test=1
   - Skal automatisk redirecte til Supabase edge function
   
3. **Test Complete OAuth:**
   - Gå til: https://runaro.dk/debug/strava
   - Log ind først
   - Generer OAuth URL (med din user ID)
   - Start OAuth flow
   - Tjek Network tab - skal vise 302 redirects

---

## 🚨 **Vigtigt:**
`_redirects` filen **SKAL** ligge i roden af deployment (samme niveau som index.html). Dette er nu sikret via `public/_redirects` → `dist/_redirects`.

**Strava integration virker med det samme efter denne deployment! 🎉**