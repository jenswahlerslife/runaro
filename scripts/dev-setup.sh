#!/bin/bash

# RUNARO DEVELOPER SETUP SCRIPT
# Automatisk setup af development miljø

set -e

echo "🚀 Runaro Developer Setup"
echo "========================="

# Tjek Node.js version
NODE_VERSION=$(node -v 2>/dev/null || echo "not found")
if [[ "$NODE_VERSION" == "not found" ]]; then
    echo "❌ Node.js ikke fundet. Install Node.js >= 18.0.0"
    exit 1
fi

# Tjek npm version
NPM_VERSION=$(npm -v 2>/dev/null || echo "not found")
echo "✅ Node.js: $NODE_VERSION, npm: $NPM_VERSION"

# Install dependencies
echo "📦 Installing dependencies..."
npm ci

# Setup git hooks
echo "🪝 Setting up git hooks..."
cat > .git/hooks/pre-commit << 'EOF'
#!/bin/bash
# Pre-commit hook for code quality

set -e

echo "🔍 Running pre-commit checks..."

# Type check
echo "📋 TypeScript check..."
npm run type-check

# Lint
echo "🧹 ESLint..."
npm run lint

# Format check
echo "💅 Prettier check..."
npm run format:check

# Tests (only staged files)
echo "🧪 Running tests..."
npm run test -- --run

echo "✅ Pre-commit checks passed!"
EOF

chmod +x .git/hooks/pre-commit

# Setup environment files
echo "🔧 Setting up environment files..."

if [ ! -f .env.local ]; then
    cat > .env.local << 'EOF'
# DEVELOPMENT ENVIRONMENT VARIABLER
# Kopier fra .env.example og udfyld med dine værdier

# Supabase
SUPABASE_URL=https://ojjpslrhyutizwpvvngu.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_ACCESS_TOKEN=your_access_token_here
SUPABASE_PROJECT_REF=ojjpslrhyutizwpvvngu

# Strava
STRAVA_CLIENT_ID=your_client_id
STRAVA_CLIENT_SECRET=your_client_secret

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Cloudflare
CLOUDFLARE_API_TOKEN=your_api_token
CLOUDFLARE_ACCOUNT_ID=your_account_id

VITE_SITE_URL=http://localhost:5173
EOF
    echo "⚙️  .env.local oprettet. Udfyld med dine værdier!"
else
    echo "✅ .env.local findes allerede"
fi

# Setup Supabase CLI hvis ikke installeret
if ! command -v supabase &> /dev/null; then
    echo "📥 Installing Supabase CLI..."
    npm install -g supabase
fi

# Setup Wrangler CLI hvis ikke installeret
if ! command -v wrangler &> /dev/null; then
    echo "📥 Installing Wrangler CLI..."
    npm install -g wrangler
fi

# Test build
echo "🏗️  Testing build..."
npm run build:dev

# Test lint
echo "🧹 Testing lint..."
npm run lint

echo ""
echo "🎉 Setup komplet!"
echo ""
echo "📚 Næste steps:"
echo "1. Udfyld .env.local med dine API keys"
echo "2. Kør 'npm run dev' for at starte dev server"
echo "3. Kør 'npm run db:setup' for database setup"
echo "4. Besøg http://localhost:5173"
echo ""
echo "🛠️  Nyttige commands:"
echo "   npm run dev          - Start development server"
echo "   npm run test         - Run tests"
echo "   npm run test:watch   - Run tests in watch mode"
echo "   npm run lint:fix     - Fix linting errors"
echo "   npm run format       - Format code"
echo "   npm run build        - Build for production"
echo ""
echo "📖 Se CLAUDE.md for flere detaljer!"