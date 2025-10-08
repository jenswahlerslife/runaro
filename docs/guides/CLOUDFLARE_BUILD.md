# 🔧 Cloudflare Pages Build Setup

## ✅ **Fix til Bun Lockfile Fejl**

**Problem løst:** `bun.lockb` fjernet fra repository for at tvinge npm usage.

## 🛠 **Cloudflare Pages Build Settings:**

### **Framework Preset:**
```
Vite
```

### **Build Command:**
```bash
npm ci && npm run build
```
*Alternativ:* `npm install && npm run build`

### **Build Output Directory:**
```
dist
```

### **Environment Variables (Advanced):**
```
NODE_VERSION = 20
```
*Valgfrit:* `NPM_FLAGS = --legacy-peer-deps` (hvis peer dependency konflikter)

## 📁 **Repository Status:**
- ✅ `package-lock.json` - Behold (npm lockfile)
- ❌ `bun.lockb` - Fjernet
- ❌ `yarn.lock` - Ikke til stede
- ❌ `pnpm-lock.yaml` - Ikke til stede

## 🔄 **Build Process:**
```bash
1. npm ci                    # Install dependencies (fast, reliable)
2. npm run build             # Vite build to dist/
3. Deploy dist/ contents     # Include _redirects file
```

## 🎯 **Forventet Resultat:**
- ✅ Successful build med npm
- ✅ `dist/_redirects` deployed korrekt  
- ✅ Strava OAuth callbacks virker
- ✅ https://runaro.dk fungerer perfekt

## 📋 **Deployment Checklist:**
- [x] Remove bun.lockb
- [x] Verify package-lock.json exists
- [x] Build scripts correct in package.json
- [x] _redirects file in public/ folder
- [ ] Update Cloudflare build settings
- [ ] Retry deployment

**Build fejlen skulle nu være løst! 🚀**