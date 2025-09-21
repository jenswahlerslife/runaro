# 🏃‍♂️ Runaro - Territorielt Løbespil

Et avanceret territorielt spil hvor løbere erobrer geografiske områder gennem deres aktiviteter. Bygget med moderne webteklogier og fokus på sikkerhed og performance.

## ✨ Funktioner

- **🗺️ Territorialt Gameplay**: Erobr territorie baseret på dine løberuter
- **👥 Multiplayer Ligaer**: Konkurrér mod andre løbere i private/offentlige ligaer
- **📱 Strava Integration**: Automatisk import af løbeaktiviteter via OAuth
- **💳 Subscription Billing**: Stripe integration for premium features
- **🔒 Sikkerhed-først**: Row Level Security (RLS) og comprehensive OWASP compliance
- **⚡ Performance**: PostGIS geospatiale beregninger, optimeret database queries
- **📊 Real-time Updates**: Live territorio opdateringer med Supabase Realtime

## 🚀 Live Application

- **Production**: https://runaro.dk
- **Admin Dashboard**: https://runaro.dk/admin/errors
- **Strava Debug**: https://runaro.dk/debug/strava

## 🛠️ Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **UI Framework**: shadcn-ui + Radix UI + Tailwind CSS
- **Backend**: Supabase (PostgreSQL + PostGIS + Edge Functions + Auth)
- **Deployment**: Cloudflare Pages + Workers
- **Maps**: Leaflet + React-Leaflet
- **Payments**: Stripe + Customer Portal
- **Testing**: Vitest + React Testing Library
- **CI/CD**: GitHub Actions + Automated deployments

## 🏗️ Quick Start

### Automatisk Setup (Anbefalet)
```bash
# Clone repository
git clone https://github.com/jenswahlerslife/runaro.git
cd runaro

# Kør automated setup script
chmod +x scripts/dev-setup.sh
./scripts/dev-setup.sh
```

### Manuel Setup
```bash
# Install dependencies
npm ci

# Setup miljøvariabler
cp .env.example .env.local
# Udfyld .env.local med dine API keys

# Type check
npm run type-check

# Start development server
npm run dev
```

## 🧪 Development

### Core Commands
```bash
npm run dev           # Development server (localhost:5173)
npm run build         # Production build
npm run test          # Run tests
npm run test:coverage # Test coverage report
npm run lint          # ESLint check
npm run lint:fix      # Fix linting errors
npm run format        # Format code with Prettier
```

### Database Operations
```bash
npm run db:setup      # Initial Supabase setup
npm run db:push       # Deploy migrations to remote
npm run db:pull       # Pull remote schema to local
npm run db:new        # Create new migration
```

### Deployment
```bash
npm run deploy:quick  # Quick build + Cloudflare Pages deploy
npm run cf:status     # Check deployment status
npm run cf:logs       # View deployment logs
```

## 📁 Project Structure

```
├── src/                    # React application source
├── supabase/              # Database migrations & edge functions
├── public/                # Static assets
├── DEPLOYMENT_GUIDE.md    # Production deployment guide
└── INTEGRATION_STATUS.md  # Strava integration documentation
```

## 🔧 Development

The application includes comprehensive debugging tools:

- React Debug Interface: `/debug/strava`
- HTML Test Suite: `/test-strava-integration.html`
- Flow Test Page: `/FLOW_FIXED_TEST.html`

## 🚀 Deployment

See [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) for detailed deployment instructions.

Critical: The `public/_redirects` file is essential for Strava OAuth callbacks to work correctly on Cloudflare Pages.

## 📋 Strava Integration

Complete OAuth 2.0 flow with:
- Secure state-based redirects
- Automatic token refresh
- Activity filtering (running only)
- Point calculation system
- Database persistence

## 🔒 Security & Performance Hardening

The database has been hardened with comprehensive security and performance optimizations:

### Security Measures
- **RLS (Row Level Security)** enabled on all application tables
- **Function Security**: All stored procedures use `SECURITY DEFINER` with locked `search_path`
- **PostGIS Security**: System tables secured from unauthorized access
- **Privilege Management**: Minimal privileges granted to `anon`/`authenticated` roles
- **Secure Policies**: Fine-grained access control policies for data protection

### Performance Optimizations
- **Strategic Indexing**: Foreign key, status, and composite indexes for common queries
- **Partial Indexes**: Optimized indexes for filtered queries (pending requests, admin roles)
- **Query Optimization**: Updated table statistics and index hints
- **Text Search**: Case-insensitive search indexes for league discovery

### How to Add New Functions Securely
When creating new stored procedures:

```sql
CREATE OR REPLACE FUNCTION public.your_function(param uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER  -- Important!
SET search_path = public, pg_temp  -- Lock search_path
AS $$
BEGIN
  -- Your logic here
END;
$$;

-- Set proper ownership and privileges
ALTER FUNCTION public.your_function(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.your_function(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.your_function(uuid) TO authenticated;
```

### Verification
Run the verification script to check security status:
```bash
# Check current security status
npm run db:status
```

See `supabase/verification/after_hardening.sql` for detailed verification queries.

## 🤝 Contributing

This project was built with assistance from Claude Code for rapid development and debugging.

---
**Built with ❤️ for the running community**
