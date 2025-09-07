# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

**Core Development:**
- `npm run dev` - Start development server (runs on localhost:8080)
- `npm run build` - Production build
- `npm run build:dev` - Development build
- `npm run lint` - Run ESLint
- `npm run preview` - Preview production build

**Deployment & Cloudflare:**
- `npm run deploy` - Full deployment script 
- `npm run deploy:quick` - Quick build and deploy to Cloudflare
- `npm run cf:deploy` - Deploy to Cloudflare Pages
- `npm run cf:status` - Check Cloudflare deployment status
- `npm run cf:logs` - View Cloudflare deployment logs

**Git & Sync:**
- `npm run git:push` - Auto-commit and push changes
- `npm run git:status` - Check git status
- `npm run sync` - Auto-sync with remote
- `npm run sync:message` - Sync with custom commit message

**Cloudflare Development:**
- `npm run cf:dev` - Cloudflare development utilities

## Architecture Overview

### Core Technologies
- **Frontend:** Vite + React 18 + TypeScript
- **UI Framework:** shadcn-ui components with Radix UI primitives
- **Styling:** Tailwind CSS with custom territory/gaming theme
- **State Management:** React Context (Auth) + TanStack Query
- **Backend:** Supabase (PostgreSQL + Edge Functions + Auth)
- **Deployment:** Cloudflare Pages
- **Maps:** Leaflet with React-Leaflet for territory visualization
- **External API:** Strava OAuth integration for activity import

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
- `/map` - Main territory visualization
- `/debug/strava` - Strava integration debugging tools

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
- `leagues` - Multiplayer league system
- `games` - Individual game instances with territory tracking
- `league_memberships` - League membership management
- `player_bases` - Player starting positions in territory games
- `territory_ownership` - Territory capture and ownership tracking

**Key Features:**
- PostGIS integration for geospatial territory calculations
- RLS (Row Level Security) policies for data access
- Edge Functions for Strava OAuth and activity processing
- Auto-generated TypeScript types in `src/integrations/supabase/types.ts`

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
- Relaxed settings: `noImplicitAny: false`, `strictNullChecks: false`
- Path aliases: `@/*` maps to `./src/*`
- Base URL configured for absolute imports

**Styling System:**
- CSS custom properties for consistent theming
- Territory-specific colors: `--territory`, `--territory-opponent`
- Dark mode support via `next-themes`
- Custom animations for UI feedback

**Critical Files:**
- `public/_redirects` - Essential for Strava OAuth callbacks on Cloudflare Pages
- `supabase/migrations/` - Database schema evolution (30+ migration files)
- `src/integrations/supabase/client.ts` - Supabase client configuration
- `src/integrations/supabase/types.ts` - Auto-generated TypeScript types
- `src/hooks/useAuth.tsx` - Central authentication logic
- `src/types/ui.ts` - UI-safe types that exclude sensitive data like age

## Development Workflow

When working on this codebase:

1. **Run development server:** `npm run dev` (starts on localhost:8080)
2. **For database changes:** Use Supabase migrations, then regenerate types
3. **For Strava testing:** Use `/debug/strava` page for OAuth flow testing
4. **For deployment:** Use `npm run deploy:quick` for fastest deployment to Cloudflare
5. **Always run `npm run lint`** before committing changes
6. **Territory features require PostGIS** - ensure database has geospatial extensions enabled

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

**Strava OAuth:**
- Callbacks handled at `/auth/strava/callback`  
- Debug interface at `/debug/strava`
- Production callbacks require `public/_redirects` file

**Cloudflare Pages:**
- Project name: "runaro"
- Deploy script: `cloudflare-deploy.js`
- Status monitoring via Wrangler CLI
- Production URL: https://runaro.dk
- Preview deployments: https://{deployment-id}.runaro.pages.dev

## Engine Requirements

- **Node.js**: >= 18.0.0
- **npm**: >= 9.0.0
- **Package Manager**: npm@10.9.2 (configured via packageManager field)