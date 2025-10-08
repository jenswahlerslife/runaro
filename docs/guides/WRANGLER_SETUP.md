# 🚀 Wrangler Setup - Automated Cloudflare Deployment

Wrangler er nu fuldt integreret i Runaro projektet for automatiseret deployment til Cloudflare Pages.

## ✅ Setup Komplet

Følgende er allerede konfigureret:
- ✅ Wrangler 3.78.0 installeret (Node 18 compatible)
- ✅ Wrangler authenticated (blendableanimation@gmail.com)
- ✅ `wrangler.jsonc` konfigurationsfil oprettet
- ✅ Deployment scripts tilføjet til `package.json`
- ✅ Claude kan nu deploye automatisk

## 🎯 Brug

### Automatisk Deployment (Anbefalet)

```bash
# Build og deploy i ét kommando
npm run deploy

# Eller
npm run deploy:production
```

### Manuel Deployment

```bash
# Byg først
npm run build

# Deploy derefter
npm run deploy:wrangler
```

### Tjek Deployment Status

```bash
# Se alle deployments
npm run cf:status

# Se logs
npm run cf:logs
```

## 📋 Deployment Workflow

Når du kører `npm run deploy`:

1. **Build** - Vite bygger production bundle
2. **Upload** - Wrangler uploader `dist/` til Cloudflare
3. **Deploy** - Cloudflare deployer automatisk
4. **URL** - Du får en preview URL (f.eks. https://44de21b8.runaro.pages.dev)
5. **Live** - Ændringer er live på https://runaro.dk efter få minutter

## 🔐 Authentication

Wrangler er allerede authenticated via OAuth:
- **Account:** blendableanimation@gmail.com
- **Account ID:** 45ae1aa085ebaf8c78509f4ff3a31007
- **Permissions:** Full Pages write access

### Re-authenticate (hvis nødvendigt)

```bash
npx wrangler login
```

Dette åbner browser for OAuth login.

### Tjek Authentication Status

```bash
npx wrangler whoami
```

## 📁 Konfiguration

### wrangler.jsonc

```json
{
  "name": "runaro",
  "pages_build_output_dir": "dist",
  "compatibility_date": "2025-10-08",
  "vars": {
    "NODE_ENV": "production"
  }
}
```

### package.json Scripts

```json
{
  "deploy": "npm run build && npm run deploy:wrangler",
  "deploy:quick": "npm run deploy",
  "deploy:wrangler": "npx wrangler pages deploy dist --project-name runaro --commit-dirty=true",
  "deploy:production": "npm run build && npm run deploy:wrangler"
}
```

## 🤖 Claude Code Integration

Claude kan nu automatisk deploye ved at køre:

```bash
npm run deploy
```

Dette betyder:
- ✅ Ingen manuel intervention nødvendig
- ✅ Konsistent deployment proces
- ✅ Automatisk build og upload
- ✅ Deployment i én kommando

## 🌍 URLs

### Preview Deployments
Hver deployment får en unik preview URL:
- https://[hash].runaro.pages.dev

### Production
Main deployment er live på:
- https://runaro.dk
- https://runaro.pages.dev

## 🔧 Avanceret Brug

### Deploy Specific Branch

```bash
npx wrangler pages deploy dist --project-name runaro --branch feature-branch
```

### Deploy med Custom Commit Message

```bash
npx wrangler pages deploy dist --project-name runaro --commit-message "Deploy blog system"
```

### Environment Variables

Set via Cloudflare Dashboard eller:

```bash
npx wrangler pages secret put MY_SECRET
```

## 📊 Monitoring

### Se Deployment Logs

```bash
npm run cf:logs
```

### List Alle Deployments

```bash
npm run cf:status
```

### Cloudflare Dashboard

Gå til: https://dash.cloudflare.com/
- Find "runaro" under Pages
- Se deployment history
- Tjek analytics
- Konfigurer custom domains

## 🐛 Troubleshooting

### "Not authenticated" fejl

```bash
npx wrangler login
```

### "Node version" fejl

Projektet bruger Wrangler 3.78.0 som understøtter Node 18. Hvis du opgraderer til Node 20+, kan du bruge:

```bash
npm install -D wrangler@latest
```

### Build fejler

```bash
# Tjek TypeScript
npm run type-check

# Tjek linting
npm run lint

# Test build lokalt
npm run build
```

### Deployment timeout

```bash
# Deploy med længere timeout
npx wrangler pages deploy dist --project-name runaro --timeout 180
```

## 📚 Ressourcer

- **Wrangler Docs:** https://developers.cloudflare.com/workers/wrangler/
- **Pages Docs:** https://developers.cloudflare.com/pages/
- **Configuration:** https://developers.cloudflare.com/workers/wrangler/configuration/

## 🎉 Quick Reference

```bash
# Full deployment
npm run deploy

# Check status
npm run cf:status

# View logs
npm run cf:logs

# Re-authenticate
npx wrangler login

# Check auth
npx wrangler whoami
```

---

**Wrangler er nu fuldt integreret! Claude kan deploye automatisk med `npm run deploy`. 🚀**
