# 🚨 Øjeblikkelige fixes for Strava Integration

## ✅ Files oprettet/opdateret:
- `_redirects` - Cloudflare server-side redirect (CRITICAL!)
- Updated `StravaCallback.tsx` - Dev fallback + production warning
- Updated `DEPLOYMENT_GUIDE.md` - Added _redirects info

---

## 🔥 UMIDDELBAR HANDLING PÅKRÆVET:

### 1. Deploy `_redirects` til Cloudflare Pages
```bash
# _redirects indhold er allerede korrekt:
/auth/strava/callback  https://ojjpslrhyutizwpvvngu.supabase.co/functions/v1/strava-auth  302
/*                     /index.html  200
```

**Hvordan:** Upload til Cloudflare Pages eller commit til git if auto-deploy

### 2. Verificer Edge Function (åbn disse URLs)
**Test 1 (ingen state):**
https://ojjpslrhyutizwpvvngu.supabase.co/functions/v1/strava-auth?code=test123
- **Forventet:** 401 "User not authenticated"

**Test 2 (med fake state):**  
https://ojjpslrhyutizwpvvngu.supabase.co/functions/v1/strava-auth?code=test123&state=eyJ1c2VySWQiOiJ0ZXN0IiwicmV0dXJuVXJsIjoiaHR0cHM6Ly9ydW5hcm8uZGsvc3RyYXZhL3N1Y2Nlc3MifQ
- **Forventet:** 502 fra Strava token exchange (men function kører)

### 3. Test Complete OAuth Flow
Når `_redirects` er deployed:
1. Gå til: https://runaro.dk/debug/strava
2. Log ind først 
3. Generer OAuth URL
4. Start OAuth Flow
5. **Vigtigt:** Se Network tab - skal vise:
   - `https://runaro.dk/auth/strava/callback` → 302
   - Til `https://ojjpslrhyutizwpvvngu.supabase.co/functions/v1/strava-auth` → 302
   - Til success page

---

## 🎯 Root Cause Fix:
**Problem:** Strava callback ramte React router i stedet for edge function
**Løsning:** Server-side 302 redirect via `_redirects` fil

---

## 📞 Hvis stadig fejl efter `_redirects`:
Send screenshots af:
1. Network tab under OAuth flow
2. Supabase Edge Function logs (strava-auth)
3. Cloudflare deployment confirmation

**Integrationen er 99% klar - kun deploy-step mangler! 🚀**