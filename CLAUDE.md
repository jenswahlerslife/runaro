# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Runaro is a territorial running game where runners capture geographic territories through their activities. Built with React/TypeScript + Supabase (PostgreSQL/PostGIS) + Cloudflare Pages, it features Strava OAuth integration, Stripe payments, multiplayer leagues, and real-time territory calculations.

**Live Site**: https://runaro.dk

## Development Commands

### Core Development
```bash
npm ci                    # Install dependencies (use ci for clean installs)
npm run dev               # Start dev server (localhost:8080)
npm run build             # Production build
npm run type-check        # TypeScript type checking
npm run lint              # Run ESLint
npm run lint:fix          # Auto-fix linting errors
npm run format            # Format with Prettier
```

### Testing
```bash
npm test                  # Run tests in watch mode
npm run test:coverage     # Generate coverage report
npm run test:ui           # Open Vitest UI
```

### Database Operations
**IMPORTANT**: All Supabase CLI commands use custom config at `infra/supabase/config.toml`. Scripts automatically load environment variables from `.env` via `scripts/load-env.cjs`.

```bash
npm run db:setup          # Initial setup (login + link project)
npm run db:push           # Deploy migrations to remote
npm run db:pull           # Pull remote schema to local
npm run db:new <name>     # Create new migration file
npm run db:status         # List migration status
```

Migrations are located in `infra/supabase/migrations/`.

### Edge Functions
```bash
npm run functions:deploy          # Deploy all edge functions
npm run edge:deploy              # Deploy specific function
npm run edge:deploy-all          # Automated deployment of all functions
```

Edge functions are in `infra/supabase/functions/`. Key functions:
- `strava-auth`: OAuth flow handler
- `strava-activities`: Activity import
- `transfer-activity`: Territory transfer logic
- `stripe-webhook`: Payment processing
- `finish-due-games`: Scheduled game completion

### Deployment
```bash
npm run deploy:quick              # Build + deploy to Cloudflare Pages
npm run cf:status                 # Check deployment status
npm run cf:logs                   # View deployment logs
```

**Critical**: The `public/_redirects` file is essential for Strava OAuth callbacks on Cloudflare Pages (all routes redirect to `/index.html` for client-side routing).

### Utility Scripts
```bash
npm run blog:assign-admin         # Assign admin role to user
npm run performance:monitor       # Database performance analysis
npm run v2:export                 # Export V2 schema
npm run secrets:check             # Verify edge function secrets
```

## Architecture

### Frontend Structure

```
src/
├── pages/                 # Route components (Auth, Dashboard, GamePage, etc.)
├── components/            # Reusable components
│   ├── ui/               # shadcn-ui components
│   ├── leagues/          # League management components
│   └── blog/             # Blog components
├── hooks/                # Custom React hooks (useAuth, useSubscription, etc.)
├── lib/                  # Business logic (leagues, gamesApi, territory, auth-utils)
├── features/             # Feature-based modules (leagues domain logic)
├── integrations/         # External integrations
│   └── supabase/        # Supabase client + auto-generated types
├── utils/                # Utility functions
└── App.tsx              # Route definitions
```

**Path Alias**: `@/` maps to `src/` (configured in vite.config.ts and tsconfig.json)

### Key Frontend Patterns

1. **Authentication**: `useAuth` hook provides auth context. Protected routes check auth state.
2. **Data Fetching**: TanStack Query (@tanstack/react-query) for server state management
3. **Supabase Client**: Import via `import { supabase } from "@/integrations/supabase/client"`
4. **Type Safety**: Database types auto-generated in `src/integrations/supabase/types.ts`
5. **UI Components**: shadcn-ui (Radix UI + Tailwind) in `src/components/ui/`

### Backend Architecture (Supabase)

**Database**: PostgreSQL 15 with PostGIS extension for geospatial operations

**Core Tables**:
- `profiles`: User profiles (linked to auth.users)
- `leagues`: Game leagues (private/public)
- `league_members`: User membership + roles (owner/admin/member)
- `games`: Game instances with start/end dates
- `activities`: Running activities with territory data
- `territories`: Captured territory polygons per game
- `strava_tokens`: OAuth tokens for Strava integration
- `subscriptions`: Stripe subscription tracking
- `blog_posts`: Blog content management

**Security Model**: All tables have Row Level Security (RLS) enabled. Functions use `SECURITY DEFINER` with locked `search_path = public, pg_temp` for security.

**Performance**: Strategic indexing on foreign keys, status columns, and composite indexes. PostGIS spatial indexes for territory queries.

### Important Implementation Details

#### Strava Integration
- OAuth flow: `strava-auth` edge function → `StravaCallback` component
- Activity import: Automatic via `import-recent-activities` edge function
- Territory calculation: PostGIS buffer operations on activity routes
- Token refresh: Handled automatically in edge functions

#### Game Flow
1. League owner creates game via `create_game()` RPC
2. Game starts on `game_start_date`, territories are captured
3. Activities imported → territories calculated → leaderboard updated
4. Game ends on `game_end_date` or via `finish-due-games` cron
5. Winner determined, game marked complete

#### Territory System
- Activities create 50m buffer around route (PostGIS `ST_Buffer`)
- Territories merge per user per game
- Overlap resolution: Last activity wins
- Area calculated in km² via `ST_Area(ST_Transform(...))`

#### Stripe Integration
- Checkout: `create-checkout` edge function
- Webhooks: `stripe-webhook` validates and processes events
- Customer portal: `customer-portal` generates Stripe portal links

### Environment Variables

Required in `.env` (see `.env.example`):
```bash
VITE_SUPABASE_URL                  # Supabase project URL
VITE_SUPABASE_PUBLISHABLE_KEY      # Anon key
VITE_SUPABASE_PROJECT_ID           # Project ID
VITE_STRIPE_PRICE_ID               # Stripe price ID
VITE_SITE_URL                      # Application URL
VITE_ENABLE_DEBUG_ROUTES           # Enable debug routes (true/false)
```

**Backend (Edge Functions)** use secrets managed via Supabase dashboard:
- `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET`
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- `SUPABASE_SERVICE_ROLE_KEY`

### Database Function Patterns

When creating new stored procedures, follow this security pattern:

```sql
CREATE OR REPLACE FUNCTION public.your_function(param uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER  -- Required for privileged operations
SET search_path = public, pg_temp  -- Prevent search_path exploits
AS $$
BEGIN
  -- Your logic here
END;
$$;

-- Set ownership and privileges
ALTER FUNCTION public.your_function(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.your_function(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.your_function(uuid) TO authenticated;
```

### Testing Approach

- **Unit Tests**: Components and business logic (Vitest + React Testing Library)
- **Integration Tests**: `src/integration/` for end-to-end flows
- **Coverage Target**: 70% (configured in vitest.config.ts)
- **Setup**: `src/test/setup.ts` configures test environment

### Common Development Workflows

#### Adding a New Page
1. Create page component in `src/pages/`
2. Add route in `src/App.tsx`
3. Update navigation components if needed

#### Adding Database Table
1. Create migration: `npm run db:new your_table_name`
2. Write SQL in `infra/supabase/migrations/YYYYMMDDHHMMSS_your_table_name.sql`
3. Add RLS policies in same migration
4. Deploy: `npm run db:push`
5. Pull types: `npm run db:pull` (regenerates `types.ts`)

#### Adding Edge Function
1. Create function dir: `infra/supabase/functions/your-function/`
2. Write `index.ts` with Deno runtime
3. Add secrets via Supabase dashboard if needed
4. Deploy: `npm run functions:deploy`
5. Test via function URL or local Supabase CLI

#### Working with Migrations
- Migrations are timestamped and run in order
- Always test migrations locally before deploying
- Use `npm run db:status` to verify applied migrations
- Never edit applied migrations; create new ones for changes

### Development Environment

**Node.js**: >=18.0.0 (specified in package.json)
**Package Manager**: npm >=9.0.0
**Platform**: Developed on WSL2 (Windows Subsystem for Linux)
**Build Tool**: Vite 5 with SWC for fast refresh

### TypeScript Configuration

Strict mode enabled with additional checks:
- `noImplicitAny`, `strictNullChecks`, `strict`
- `noUnusedLocals`, `noUnusedParameters`
- `noImplicitReturns`, `noFallthroughCasesInSwitch`
- `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`

### Known Quirks

1. **Cloudflare Pages Routing**: All routes must redirect to `/index.html` for SPA routing (configured in `public/_redirects`)
2. **Debug Routes**: Only available when `VITE_ENABLE_DEBUG_ROUTES=true`
3. **Supabase Config**: Always use `--config infra/supabase/config.toml` flag
4. **Environment Loading**: Scripts use `scripts/load-env.cjs` to load `.env` automatically
5. **Database Types**: Auto-generated, don't edit `src/integrations/supabase/types.ts` manually

### Key Dependencies

- **React**: 18.3.1 with React Router 6.30.1
- **Supabase**: @supabase/supabase-js 2.56.0
- **Stripe**: stripe 18.5.0
- **Maps**: leaflet 1.9.4 + react-leaflet 4.2.1
- **UI**: Radix UI + Tailwind CSS + shadcn-ui
- **Forms**: react-hook-form + zod
- **State**: TanStack Query 5.83.0

### Debugging Tools

Access these routes when `VITE_ENABLE_DEBUG_ROUTES=true`:
- `/debug/strava` - Strava integration debugging
- `/debug/auth` - Auth state inspection
- `/debug/import` - Activity import diagnostics
- `/debug/health` - Function health checks
- `/admin/errors` - Production error dashboard (always enabled)

### Performance Considerations

1. **PostGIS Operations**: Territory calculations are expensive; use spatial indexes
2. **RLS Policies**: Complex policies can slow queries; test with `EXPLAIN ANALYZE`
3. **Edge Function Cold Starts**: First request after idle may be slow
4. **Large Migrations**: Break into smaller migrations for safety
5. **Cloudflare Pages**: Cached aggressively; use cache busting for assets

### Security Notes

- All database functions use `SECURITY DEFINER` with locked `search_path`
- RLS enabled on all application tables
- Stripe webhook signatures validated
- Strava tokens encrypted at rest
- No sensitive data in client-side code
- CORS configured in edge functions

### Blog System

The application includes a blog system with:
- Admin dashboard at `/admin/blog`
- Blog editor at `/admin/blog/opret` (create) and `/admin/blog/rediger/:id` (edit)
- Public blog at `/blog` and posts at `/blog/:slug`
- Admin role required for blog management
- Image upload with cropping support

## Additional Resources

- **README.md**: Project overview and setup
- **CONTRIBUTING.md**: Contribution guidelines
- **scripts/README.md**: Documentation for utility scripts
- **infra/supabase/verification/**: SQL verification scripts for security audit
