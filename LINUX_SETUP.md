# Linux/WSL Development Setup Guide

This guide helps you set up the Runaro development environment on Linux or Windows Subsystem for Linux (WSL).

## Quick Start

### Optional: Load Quick Commands
```bash
# Load helpful aliases and functions
source .linux-quickstart

# Now you have access to:
# - runaro-help     : Show all commands
# - runaro-check    : Quick health check
# - runaro-clean    : Clean reinstall
# - runaro-env      : Show environment status
```

### Automated Setup (Recommended)

```bash
# Clone the repository (if not already cloned)
git clone https://github.com/jenswahlerslife/runaro.git
cd runaro

# Run the setup script
./scripts/linux-setup.sh
```

The setup script will:
- ✅ Verify Node.js and npm installation (>= 18.0.0 required)
- ✅ Install project dependencies
- ✅ Set up environment configuration
- ✅ Install Supabase CLI
- ✅ Configure database connection
- ✅ Run type checking

### Manual Setup

If the automated script fails or you prefer manual setup:

```bash
# 1. Install Node.js (if not installed)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install --lts
nvm use --lts

# 2. Install dependencies
npm ci

# 3. Set up environment variables
cp .env.example .env.local
# Edit .env.local and add your API keys

# 4. Install Supabase CLI (choose one method)
# Method 1: via npm (works on WSL)
npm install -g supabase

# Method 2: via binary (native Linux)
curl -L https://github.com/supabase/cli/releases/latest/download/supabase_linux_amd64.tar.gz -o supabase.tar.gz
tar -xzf supabase.tar.gz
sudo mv supabase /usr/local/bin/
rm supabase.tar.gz

# 5. Connect to Supabase
npm run db:setup

# 6. Verify setup
npm run type-check
```

## Development Commands

All npm scripts are now cross-platform compatible (Linux/macOS/Windows):

### Core Development
```bash
npm run dev           # Start dev server (localhost:8080)
npm run build         # Production build
npm run preview       # Preview production build
npm test              # Run tests
npm run lint          # Run linter
npm run type-check    # TypeScript type checking
```

### Database Operations
```bash
npm run db:status     # Check migration status
npm run db:push       # Deploy migrations to remote
npm run db:pull       # Pull remote schema
npm run db:new        # Create new migration
npm run db:setup      # Initial setup (login + link)
```

### Deployment
```bash
npm run deploy:quick  # Build + deploy to Cloudflare
npm run cf:status     # Check deployment status
npm run cf:logs       # View deployment logs
```

## WSL-Specific Notes

### Running in WSL
This project is fully compatible with WSL2. To verify you're in WSL:

```bash
uname -a
# Should show: Linux ... microsoft-standard-WSL2
```

### Port Access
The dev server runs on `localhost:8080`. Access it from Windows at:
- `http://localhost:8080` (WSL2 auto-forwards ports)

### File System Performance
For best performance in WSL:
- Keep project files in the Linux filesystem (`~/projects/runaro`)
- Avoid Windows filesystem paths (`/mnt/c/...`) for active development
- Consider moving the project if currently in /mnt/c/

```bash
# Recommended: Move project to Linux home directory
cd ~
mkdir -p projects
cd projects
git clone https://github.com/jenswahlerslife/runaro.git
cd runaro
./scripts/linux-setup.sh
```

### VS Code Integration
Use the "Remote - WSL" extension for VS Code:

1. Install "Remote - WSL" extension in VS Code
2. Open WSL terminal
3. Navigate to project: `cd ~/projects/runaro`
4. Open in VS Code: `code .`
5. VS Code will reopen in WSL mode

Check bottom-left corner shows: `WSL: Ubuntu`

## Environment Variables

Create `.env.local` with these required variables:

```bash
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_ACCESS_TOKEN=your-access-token
SUPABASE_PROJECT_REF=your-project-ref
SUPABASE_DB_PASSWORD=your-db-password

# Stripe Configuration
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...

# Strava Configuration
VITE_STRAVA_CLIENT_ID=your-client-id
VITE_STRAVA_CLIENT_SECRET=your-client-secret

# Site Configuration
VITE_SITE_URL=http://localhost:8080
```

## Troubleshooting

### "Command not found: supabase"
```bash
# Install Supabase CLI
npm install -g supabase

# Or add to PATH if installed manually
echo 'export PATH="$PATH:/usr/local/bin"' >> ~/.bashrc
source ~/.bashrc
```

### "Cannot find module" errors
```bash
# Clean install dependencies
rm -rf node_modules package-lock.json
npm ci
```

### Database connection fails
```bash
# Verify .env.local has correct values
cat .env.local | grep SUPABASE

# Re-run setup
npm run db:setup
```

### Port 8080 already in use
```bash
# Find process using port 8080
lsof -i :8080

# Kill the process (replace PID)
kill -9 <PID>

# Or change port in vite.config.ts
```

### WSL file permission issues
```bash
# Fix file permissions
chmod +x scripts/*.sh
chmod +x scripts/*.js

# Fix git line endings
git config core.autocrlf false
git rm -rf --cached .
git reset --hard
```

## Performance Tips

### WSL Performance
1. **Use Linux filesystem**: Keep projects in `~/` not `/mnt/c/`
2. **Disable Windows Defender**: Exclude WSL directories
3. **Allocate resources**: Edit `.wslconfig` in Windows user directory:

```ini
[wsl2]
memory=8GB
processors=4
swap=2GB
```

### Node.js Performance
```bash
# Increase Node.js memory limit for large builds
export NODE_OPTIONS="--max-old-space-size=4096"

# Add to ~/.bashrc for persistence
echo 'export NODE_OPTIONS="--max-old-space-size=4096"' >> ~/.bashrc
```

## Testing Your Setup

Run these commands to verify everything works:

```bash
# 1. Check Node.js version
node -v  # Should be >= 18.0.0

# 2. Check dependencies
npm list --depth=0

# 3. Run type check
npm run type-check

# 4. Run tests
npm test

# 5. Start dev server
npm run dev
# Open http://localhost:8080 in browser

# 6. Check database connection
npm run db:status
```

## Getting Help

- **Documentation**: See `CLAUDE.md` for comprehensive project docs
- **Architecture**: See `ARCHITECTURE.md` for system design
- **Issues**: Check existing issues or create new one

## What's Different from Windows?

The main improvements for Linux compatibility:

1. ✅ **No PowerShell**: All `db:*` commands now use cross-platform Node.js script
2. ✅ **POSIX variables**: Changed from `%VAR%` to `$VAR` syntax
3. ✅ **Shell scripts**: All `.sh` files work natively in Linux
4. ✅ **Better performance**: Native Linux tools run faster than Windows equivalents
5. ✅ **Supabase CLI**: Proper Linux binaries or npm global install

All npm scripts in `package.json` are now fully cross-platform! 🎉
