# Cloudflare Development Workflow Guide

## 🚀 Complete Cloudflare Setup for Runaro

This guide provides the optimal Cloudflare workflow for seamless development and deployment.

## 📦 What's Been Installed

### Tools & CLI
- ✅ **Wrangler CLI** (latest version globally installed)
- ✅ **VS Code Extensions** for Cloudflare development
- ✅ **TypeScript support** for Wrangler configurations

### Configuration Files
- ✅ `wrangler.toml` - Cloudflare Pages configuration
- ✅ `cloudflare-deploy.js` - Automated deployment script  
- ✅ `cloudflare-dev.js` - Local development server with CF compatibility
- ✅ Updated VS Code settings for Cloudflare integration

## 🎯 Available Commands

### NPM Scripts (Recommended)
```bash
npm run cf:deploy    # Deploy to Cloudflare Pages
npm run cf:dev       # Start Cloudflare-compatible dev server  
npm run cf:status    # Check deployment status
npm run cf:logs      # View deployment logs
npm run deploy       # Build + Deploy (complete workflow)
```

### Direct Wrangler Commands
```bash
npx wrangler pages deploy dist --project-name runaro
npx wrangler pages deployment list --project-name runaro
npx wrangler pages deployment tail --project-name runaro
```

### VS Code Tasks (Ctrl+Shift+P → "Run Task")
- **Cloudflare Deploy** - Full deployment process
- **Cloudflare Dev Server** - Local development with CF compatibility  
- **Wrangler Status** - Check deployment status
- **Wrangler Logs** - Real-time logs

## 🔧 Development Workflow

### 1. Local Development
```bash
npm run dev              # Standard Vite dev server (fastest)
# OR  
npm run cf:dev           # Cloudflare-compatible dev server (production-like)
```

### 2. Testing Before Deploy
```bash
npm run build           # Build the project
npm run preview         # Preview built version locally
```

### 3. Deployment
```bash
npm run deploy          # Automated: build + deploy + status check
```

### 4. Monitoring
```bash
npm run cf:status       # Check all deployments
npm run cf:logs         # Live deployment logs
```

## 📁 File Structure

```
Runaro/
├── wrangler.toml              # Cloudflare configuration
├── cloudflare-deploy.js       # Automated deployment script
├── cloudflare-dev.js          # CF-compatible dev server
├── .vscode/
│   ├── settings.json          # CF-optimized editor settings
│   ├── tasks.json             # CF deployment tasks
│   └── extensions.json        # Recommended extensions
└── dist/                      # Build output (deployed to CF)
```

## 🌍 Environment Variables

All environment variables are configured in `.env.example`:

```env
# Cloudflare Configuration
CLOUDFLARE_ACCOUNT_ID=45ae1aa085ebaf8c78509f4ff3a31007
CLOUDFLARE_PROJECT_NAME=runaro
CLOUDFLARE_API_TOKEN=your_api_token_here

# Build Environment Variables  
VITE_SUPABASE_URL=https://ojjpslrhyutizwpvvngu.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
```

## 🎨 VS Code Integration

### Workspace Features
- **File nesting** - Cloudflare files grouped with `wrangler.toml`
- **Syntax highlighting** for `.toml` files
- **Task integration** - Deploy directly from VS Code
- **IntelliSense** for Cloudflare configurations

### Quick Actions
- `Ctrl+Shift+P` → "Tasks: Run Task" → "Cloudflare Deploy"
- `Ctrl+Shift+P` → "Tasks: Run Task" → "Cloudflare Dev Server"
- Bottom status bar shows deployment status

## 🔄 Automatic Deployments

### Branch-Based Deployment
- **main/master branch** → Production deployment  
- **Other branches** → Preview deployments
- **Pull requests** → Automatic preview URLs

### CI/CD Integration
The deployment script automatically:
1. ✅ Checks Wrangler CLI availability
2. ✅ Builds the project with optimizations
3. ✅ Deploys based on current Git branch  
4. ✅ Provides deployment URLs and status
5. ✅ Shows recent deployment history

## 🐛 Troubleshooting

### Common Issues
1. **"Wrangler not found"** → Run `npm install -g wrangler@latest`
2. **"Project not found"** → Check project name in `wrangler.toml`
3. **"Authentication failed"** → Run `wrangler auth login`
4. **"Build failed"** → Check `npm run build` works locally

### Debug Commands
```bash
wrangler --version                           # Check CLI version
wrangler auth whoami                         # Check authentication  
wrangler pages project list                  # List all projects
npx wrangler pages deployment list --help    # Command help
```

## 🎯 Optimization Features

### Build Optimizations
- **Tree shaking** - Removes unused code
- **Code splitting** - Faster loading
- **Asset optimization** - Images and CSS minification
- **Environment-specific builds** - Production vs development

### Cloudflare Features Used
- **Pages Functions** - Server-side functionality
- **Edge Runtime** - Global edge computing
- **Custom domains** - Professional URLs
- **SSL certificates** - Automatic HTTPS
- **CDN** - Global content delivery

## 🚀 Advanced Usage

### Custom Domains
Add to `wrangler.toml`:
```toml
[custom_domains]
domains = ["your-domain.com", "www.your-domain.com"]
```

### Environment Variables
Production secrets:
```bash
wrangler pages secret put API_KEY --project-name runaro
wrangler pages secret list --project-name runaro
```

### Functions (API Routes)
Create `functions/` directory for server-side API endpoints.

---

## 🎉 Ready to Deploy!

Your Cloudflare workflow is now fully optimized. For future Claude Code sessions, just mention "deploy to Cloudflare" and I'll use these automated scripts!