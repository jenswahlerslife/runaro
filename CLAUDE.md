# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

**Core Development:**
- `npm run dev` - Start development server (runs on localhost:8080 via Vite)
- `npm run build` - Production build (uses cross-env ROLLUP_DISABLE_NATIVE=1)
- `npm run build:dev` - Development build
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Run ESLint with automatic fixes
- `npm run type-check` - Run TypeScript type checking
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check code formatting
- `npm run preview` - Preview production build

**Database Operations (Supabase):**
- `npm run db:status` - Check migration status
- `npm run db:push` - Push local migrations to remote database
- `npm run db:pull` - Pull remote database schema to local
- `npm run db:new` - Create new migration file
- `npm run db:setup` - Initial database setup (login and link project)
- `npm run db:deploy` - Deploy all pending migrations
- `npm run db:env` - Load environment variables for database operations
- `npm run db:login` - Login to Supabase CLI with access token
- `npm run db:link` - Link local project to Supabase project
- `npm run db:link:pw` - Link project with database password
- `npm run db:push:remote` - Push migrations to remote with password and roles
- `npm run functions:deploy` - Deploy Supabase Edge Functions

**Migration Testing & Monitoring:**
- `npm run migration:test` - Run comprehensive database function testing
- `npm run migration:validate` - Alias for migration:test
- `npm run migration:health` - Quick database health check with environment setup
- `npm run performance:monitor` - Run performance monitoring and trend analysis
- `npm run performance:track` - Alias for performance:monitor
- `npm run db:performance` - Performance monitoring with environment setup

**V2.0 Migration Management:**
- `npm run v2:export` - Export clean schema for V2.0 migration generation
- `npm run v2:analyze` - Alias for v2:export
- `npm run migration:v2-export` - V2.0 export with environment setup
- `npm run v2:test` - Test V2.0 migration files and procedures
- `npm run v2:validate` - Alias for v2:test
- `npm run v2:rollback` - Execute V2.0 rollback procedures
- `npm run v2:rollback-dry` - Test rollback procedures in dry-run mode

**Deployment & Cloudflare:**
- `npm run deploy` - Full deployment script
- `npm run deploy:quick` - Quick build and deploy to Cloudflare
- `npm run cf:deploy` - Deploy to Cloudflare Pages
- `npm run cf:status` - Check Cloudflare deployment status
- `npm run cf:logs` - View Cloudflare deployment logs

**Testing:**
- `npm test` - Run Vitest test suite
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Run tests with coverage report
- `npm run test:ui` - Open Vitest UI dashboard
- Test setup includes Supabase, React Router, and browser API mocks
- Coverage thresholds: 70% for branches, functions, lines, statements
- Test environment: jsdom with comprehensive mocking setup
- Test setup file: `src/test/setup.ts` with full browser API mocking
- Coverage excludes: node_modules, test files, auto-generated types, Supabase types
- Use `/debug/strava` page for Strava integration testing
- Production testing available at https://runaro.dk
- Domain logic tests: Feature-based testing with domain service unit tests
- Run single test file: `npm test <filename>` or `npm test <pattern>`
- Run test in watch mode: `npm run test:watch <filename>`

**Git & Sync:**
- `npm run git:push` - Auto-commit and push changes
- `npm run git:status` - Check git status
- `npm run sync` - Auto-sync with remote
- `npm run sync:message` - Sync with custom commit message

**Secrets Management:**
- `npm run secrets:list` - List all Supabase secrets
- `npm run secrets:check` - Check secret configuration
- `npm run secrets:set` - Set Runaro-specific secrets
- `npm run secrets:fix-transfer` - Fix transfer-activity function secrets

**Edge Function Deployment (Automated):**
- `npm run edge:deploy <function-name>` - Deploy specific Edge Function
- `npm run edge:deploy-all` - Deploy all Edge Functions automatically
- `npm run edge:quick-fix <function-name>` - Deploy with common fixes applied
- `node scripts/automated-edge-function-deploy.js` - Full deployment toolkit

**Cloudflare Development:**
- `npm run cf:dev` - Cloudflare development utilities

**Workers & Cron:**
- `workers/game-finish-cron.js` - Cloudflare Worker for automatic game finishing (runs every 5 minutes)
- `workers/wrangler.toml` - Worker-specific configuration with cron triggers

## Architecture Overview

### Core Technologies
- **Frontend:** Vite + React 18 + TypeScript
- **UI Framework:** shadcn-ui components with Radix UI primitives
- **Styling:** Tailwind CSS with custom territory/gaming theme
- **State Management:** React Context (Auth) + TanStack Query
- **Backend:** Supabase (PostgreSQL + Edge Functions + Auth)
- **Deployment:** Cloudflare Pages with Workers for cron jobs
- **Maps:** Leaflet with React-Leaflet for territory visualization
- **External API:** Strava OAuth integration for activity import
- **Payments:** Stripe integration for subscription billing

### Application Structure

**Main App Flow:**
- `App.tsx` - Root component with providers and routing
- `main.tsx` - Entry point
- React Router with comprehensive route structure including auth callbacks

**Key Pages:**
- `/` - Homepage with game start functionality
- `/auth` - Authentication with email/magic link/signup
- `/dashboard` - User dashboard and activities
- `/leagues` - Multiplayer league system
- `/games/:gameId` - Individual territory game interface
- `/games/:gameId/setup` - Game setup and base selection interface (GameSetup.tsx)
- `/map` - Main territory visualization
- `/debug/strava` - Strava integration debugging tools
- `/subscription` - Subscription management and upgrade interface
- `/error-dashboard` - Error monitoring and reporting dashboard
- `/strava-connect` - Strava connection page (StravaConnectPage.tsx)

**New Architecture (Feature-Based):**
- `src/features/` - Feature-based architecture with domain separation
- `src/shared/` - Shared primitives and utilities across features
- `src/features/leagues/` - Complete league domain with UI, domain logic, and infrastructure layers
  - `src/features/leagues/ui/` - React components for league functionality
  - `src/features/leagues/domain/` - Business logic with ports/adapters pattern
  - `src/features/leagues/infrastructure/` - Supabase repository implementations
  - `src/features/leagues/hooks/` - React hooks for league operations
  - `src/features/leagues/services/` - Domain services and business rules
- `src/shared/primitives/` - Reusable UI components (LoadingSpinner, EmptyState, etc.)
- `src/utils/lazy-imports.ts` - Lazy loading utilities for performance optimization

### Authentication System
- Custom `useAuth` hook with React Context
- Supabase Auth integration with email/magic link/signup
- Automatic profile creation with username, display_name, and age fields
- Session persistence and auto-refresh
- Profile management with user metadata sync
- **Security Note**: Age is stored in database but never exposed to UI queries

### Database Architecture (Supabase)

**Core Tables:**
- `profiles` - User profiles with username, display_name, age (age not exposed to UI)
- `activities` - Running activities with GPX data and territory coordinates
- `leagues` - Multiplayer league system with join request functionality
- `league_join_requests` - Pending league join requests with admin approval
- `games` - Individual game instances with territory tracking
- `league_memberships` - League membership management
- `player_bases` - Player starting positions in territory games
- `territory_ownership` - Territory capture and ownership tracking
- `error_reports` - System error logging and monitoring
- `subscriptions` - User subscription management and billing

**Key Features:**
- PostGIS integration for geospatial territory calculations
- RLS (Row Level Security) policies with comprehensive security hardening
- Edge Functions for Strava OAuth and activity processing
- Auto-generated TypeScript types in `src/integrations/supabase/types.ts`
- Security-first function design with `SECURITY DEFINER` and locked `search_path`
- Performance optimized with strategic indexing and partial indexes

### Territory Game System
- Geospatial territory calculation using PostGIS
- Real-time territory visualization with Leaflet maps
- Activity-based territory expansion (running activities = territory claims)
- Multiplayer leagues with competitive territory acquisition
- GPX file processing for route-based territory creation

### Strava Integration
- Complete OAuth 2.0 flow with secure state management
- Activity import with filtering (running activities only)
- Automatic point calculation and territory generation
- Token refresh and persistent storage
- Comprehensive debugging interface at `/debug/strava`

### Development Notes

**TypeScript Configuration:**
- Strict mode enabled with comprehensive type safety (`strict: true`, `strictNullChecks: true`, `noImplicitAny: true`)
- Additional safety: `exactOptionalPropertyTypes: true`, `noImplicitReturns: true`, `noUncheckedIndexedAccess: true`
- Path aliases: `@/*` maps to `./src/*`
- Base URL configured for absolute imports
- Must handle nullable values explicitly due to strict null checks
- Array indexing returns `type | undefined` - always check before use

**Styling System:**
- CSS custom properties for consistent theming
- Territory-specific colors: `--territory`, `--territory-opponent`
- Dark mode support via `next-themes`
- Custom animations for UI feedback

**Architecture Patterns:**
- **Feature-based organization**: Domain-driven design with `src/features/`
- **Shared primitives**: Reusable components and hooks in `src/shared/`
- **Domain separation**: Business logic separated from UI components
- **Repository pattern**: Infrastructure layer with ports/adapters pattern
- **Lazy loading**: Performance optimization with dynamic imports
- **Migration in progress**: Moving from legacy `src/components/leagues/` to new `src/features/leagues/` architecture

**Critical Files:**
- `public/_redirects` - Essential for Strava OAuth callbacks on Cloudflare Pages
- `supabase/migrations/` - Database schema evolution (50+ migration files)
- `supabase/config.toml` - Supabase project configuration with auth settings
- `src/integrations/supabase/client.ts` - Supabase client configuration
- `src/integrations/supabase/types.ts` - Auto-generated TypeScript types
- `src/hooks/useAuth.tsx` - Central authentication logic with profile management
- `src/hooks/useErrorReporting.tsx` - Error reporting and logging system
- `src/hooks/useSubscription.tsx` - Subscription management and billing integration
- `src/hooks/useMyLeagues.ts` - League membership and management utilities
- `src/types/ui.ts` - UI-safe types that exclude sensitive data like age
- `src/components/leagues/` - Legacy league management UI components
- `src/features/leagues/` - New feature-based league architecture with domain separation
- `src/shared/primitives/` - Reusable UI primitives and hooks (LoadingSpinner, EmptyState, etc.)
- `src/lib/leagues.ts` - League business logic and API functions
- `src/pages/LeaguesPage.tsx` - Main leagues interface with directory and admin features
- `src/pages/Subscription.tsx` - Subscription management interface
- `src/pages/ErrorDashboard.tsx` - Error monitoring and analytics dashboard
- `src/pages/GameSetup.tsx` - Game base selection interface with Strava activity integration
- `src/pages/StravaConnectPage.tsx` - Dedicated Strava connection interface
- `src/utils/lazy-imports.ts` - Lazy loading utilities for performance optimization
- `vitest.config.ts` - Test configuration with 70% coverage thresholds
- `workers/game-finish-cron.js` - Cloudflare Worker for automatic game completion
- `workers/wrangler.toml` - Worker configuration with cron scheduling

## Development Workflow

When working on this codebase:

1. **Run development server:** `npm run dev` (starts on localhost:8080 via Vite)
2. **For database changes:** Use `npm run db:new` to create migration, then `npm run db:push` to deploy
3. **For testing:** Run `npm test` or `npm run test:watch` for continuous testing
4. **For Strava testing:** Use `/debug/strava` page for OAuth flow testing
5. **For deployment:** Use `npm run deploy:quick` for fastest deployment to Cloudflare
6. **Before committing:** Always run `npm run lint`, `npm run type-check`, and `npm test`
7. **Territory features require PostGIS** - ensure database has geospatial extensions enabled
8. **Database setup:** Run `npm run db:setup` once to configure Supabase CLI connection
9. **Strict TypeScript:** Code must satisfy strict type checking including null checks and indexed access
10. **Component Development:** Uses lovable-tagger in development mode for component identification

**Common Development Patterns:**
- When adding new features, prefer extending existing feature modules in `src/features/`
- For new UI components, check `src/shared/primitives/` before creating new ones
- Database functions must follow security pattern: `SECURITY DEFINER` with locked `search_path`
- Always use `UIProfileSelect` type when querying profiles to exclude sensitive data
- Lazy load heavy components and pages using utilities in `src/utils/lazy-imports.ts`

## Profile Data Security

**Username Display Logic (Homepage):**
- Fallback priority: `profiles.username` → `auth.user_metadata.username` → `profiles.display_name` → `auth.user_metadata.display_name` → `email-prefix` → `"gæst"`
- Welcome message shows "Velkommen {username}!" (never full name)

**UI Data Safety:**
- Use `UIProfileSelect` type from `src/types/ui.ts` for profile queries
- Never query `age` field in UI components
- Age is stored in database but kept private from frontend

## Key Integrations

**Supabase Configuration:**
- Production URL: `https://ojjpslrhyutizwpvvngu.supabase.co`
- Client configured in `src/integrations/supabase/client.ts`
- Auth redirects to `/auth/callback`
- Edge Functions: Stripe webhooks, customer portal, checkout creation, error reporting, strava-activities, strava-auth, transfer-activity, finish-due-games, setup-database

**Strava OAuth:**
- Callbacks handled at `/auth/strava/callback`  
- Debug interface at `/debug/strava`
- Production callbacks require `public/_redirects` file

**Stripe Integration:**
- Subscription billing and payment processing
- Customer portal for subscription management
- Webhook handlers in `supabase/functions/`
- Integration with Supabase for user subscription tracking

**Cloudflare Pages:**
- Project name: "runaro"
- Deploy script: `cloudflare-deploy.js`
- Status monitoring via Wrangler CLI
- Production URL: https://runaro.dk
- Preview deployments: https://{deployment-id}.runaro.pages.dev
- **Critical**: `public/_redirects` file required for Strava OAuth callbacks
- Supports SPA routing with `/* /index.html 200` redirect rule

**Cloudflare Workers:**
- `runaro-game-finish-cron` - Automatic game finishing worker (runs every 5 minutes)
- Separate wrangler configuration in `workers/wrangler.toml`
- Uses environment variables and secrets for Supabase connection
- Deployed independently from main application

## Database Security & Performance

**Security Requirements:**
- All new database functions MUST use `SECURITY DEFINER` with locked `search_path = public, pg_temp`
- Grant minimal privileges: `REVOKE ALL FROM PUBLIC, anon` then `GRANT EXECUTE TO authenticated`
- Never query `age` field in UI components - use `UIProfileSelect` type from `src/types/ui.ts`
- Test all functions with comprehensive RLS policy verification

**League System Architecture:**
- Join requests flow: User submits → Admin approves → Automatic membership creation
- AdminRequestPanel component handles pending requests with real-time updates
- LeagueDirectory provides public league discovery with join functionality
- League memberships managed through dedicated views and RLS policies
- Recent fixes ensure proper conflict resolution for membership view operations
- All league operations secured with user-specific RLS policies

## Engine Requirements

- **Node.js**: >= 18.0.0
- **npm**: >= 9.0.0
- **Package Manager**: npm@10.9.2 (configured via packageManager field)

## Claude Code Full Access Configuration

**Complete Supabase Access:**
Claude has full administrative access to the Supabase database with the following credentials stored in `.env.production`:

- **Project URL**: https://ojjpslrhyutizwpvvngu.supabase.co
- **Project Ref**: ojjpslrhyutizwpvvngu
- **Service Role Key**: Available (full database access)
- **Database Password**: Configured
- **CLI Access Token**: `sbp_38d564351d1f0f43a23413c6e527faf2d255e858` (Claude-Code-Full-Access with deployment permissions)

**Available Tools:**
- `scripts/claude-supabase-toolkit.js` - Comprehensive database toolkit
  - `node scripts/claude-supabase-toolkit.js analyze` - Full database analysis
  - `node scripts/claude-supabase-toolkit.js test` - Test all database functions
  - `node scripts/claude-supabase-toolkit.js optimize` - Performance optimization
  - `node scripts/claude-supabase-toolkit.js security` - Security audit
  - `node scripts/claude-supabase-toolkit.js migrate` - Migration management
- Additional specialized scripts:
  - `scripts/migration-test-framework.cjs` - Migration validation framework
  - `scripts/performance-monitor.cjs` - Database performance monitoring
  - `scripts/v2-schema-export.cjs` - V2.0 migration schema export
  - `scripts/v2-migration-test.cjs` - V2.0 migration testing
  - `scripts/v2-rollback-procedures.cjs` - V2.0 rollback procedures
  - `scripts/comprehensive-db-analysis.js` - Complete database health analysis
  - `scripts/test-core-functions.js` - Core function testing and validation

**What Claude Can Do:**
- ✅ Analyze all database tables and relationships
- ✅ Test and debug database functions (RPC calls)
- ✅ Monitor and optimize query performance
- ✅ Audit security policies and RLS rules
- ✅ Manage database migrations
- ✅ Generate comprehensive reports
- ✅ Identify and fix data integrity issues
- ✅ Create and modify database schemas
- ✅ Real-time debugging and troubleshooting

**Key Database Tables:**
- `profiles` (7 rows) - User profiles with security controls
- `leagues` (17 rows) - League management system
- `games` (41 rows) - Game instances and states
- `league_memberships` (6 rows) - User league relationships
- `league_join_requests` (7 rows) - Pending membership requests
- `error_reports` (12 rows) - System error logging
- `activities`, `player_bases`, `territory_ownership`, `subscriptions` - Feature tables

**Security Notes:**
- Age field in profiles is properly secured (not exposed to UI)
- RLS policies are active and properly configured
- Service role access is restricted to development/debugging only
- All sensitive credentials are stored in environment files (not in code)