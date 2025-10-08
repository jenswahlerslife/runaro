# 🏗️ Runaro Architecture Documentation

## System Overview

Runaro er et distributed territorielt løbespil bygget med moderne cloud-native architecture principper.

```
                                   RUNARO SYSTEM ARCHITECTURE

    ┌─────────────────┐    HTTPS/WSS     ┌──────────────────────────────────────┐
    │                 │◄─────────────────┤              FRONTEND                │
    │     USERS       │                  │                                      │
    │  (Web Browser)  │◄─────────────────┤ React 18 + TypeScript + Vite        │
    │                 │                  │ shadcn-ui + Tailwind CSS             │
    └─────────────────┘                  │ Leaflet Maps + React-Leaflet         │
            │                            │ TanStack Query + React Context       │
            │                            └──────────────────────────────────────┘
            │                                              │
            │ OAuth Flow                                   │ CDN + Edge Cache
            │                                              │
    ┌─────────────────┐                  ┌──────────────────────────────────────┐
    │                 │                  │         CLOUDFLARE PAGES             │
    │  STRAVA API     │                  │                                      │
    │                 │                  │ Static Asset Delivery                │
    │ - OAuth 2.0     │                  │ Global CDN                           │
    │ - Activity API  │                  │ Edge Workers (Cron Jobs)             │
    │ - Webhook       │                  │ SSL/TLS Termination                  │
    └─────────────────┘                  └──────────────────────────────────────┘
            │                                              │
            │                                              │
            └──────────────────────────────────────────────┼─────────┐
                                                           │         │
                                                           ▼         ▼
                            ┌──────────────────────────────────────────────────┐
                            │                 SUPABASE                         │
                            │                                                  │
    ┌─────────────────┐     │  ┌─────────────────┐    ┌────────────────────┐  │
    │                 │     │  │   EDGE          │    │                    │  │
    │   STRIPE API    │◄────┼──┤   FUNCTIONS     │    │    POSTGRESQL      │  │
    │                 │     │  │                 │    │    + POSTGIS       │  │
    │ - Subscriptions │     │  │ • strava-auth   │    │                    │  │
    │ - Payments      │     │  │ • strava-acts   │    │ Tables:            │  │
    │ - Webhooks      │     │  │ • stripe-hook   │    │ • profiles         │  │
    └─────────────────┘     │  │ • checkout      │    │ • leagues          │  │
                            │  │ • transfer-act  │    │ • games            │  │
                            │  │ • finish-games  │    │ • activities       │  │
                            │  │ • error-report  │    │ • territories      │  │
                            │  └─────────────────┘    │ • subscriptions    │  │
                            │           │             │                    │  │
                            │           │             │ Security:          │  │
                            │  ┌─────────▼───────┐    │ • Row Level Sec.   │  │
                            │  │                 │    │ • SECURITY DEFINER │  │
                            │  │   REALTIME      │    │ • Locked search_path│ │
                            │  │                 │    │                    │  │
                            │  │ • Live Updates  │    │ Performance:       │  │
                            │  │ • Territory     │    │ • Strategic Indexes│  │
                            │  │ • Game Status   │    │ • GIST Spatial     │  │
                            │  │               │    │ • Materialized Views│  │
                            │  └─────────────────┘    │ • Query Optimization│ │
                            └──────────────────────────────────────────────────┘
```

## Core Components Deep Dive

### 1. Frontend Architecture (React SPA)

```
Frontend Component Hierarchy:

App.tsx
├── Providers/
│   ├── AuthProvider (Context + useAuth)
│   ├── QueryProvider (TanStack Query)
│   └── ThemeProvider (next-themes)
├── Router/
│   ├── Public Routes (/, /auth)
│   ├── Protected Routes (/dashboard, /games)
│   └── Admin Routes (/admin/*)
├── Pages/
│   ├── Dashboard.tsx (activity overview)
│   ├── GamePage.tsx (territory game interface)
│   ├── LeaguesPage.tsx (multiplayer leagues)
│   └── GameSetup.tsx (base selection)
└── Components/
    ├── UI/ (shadcn-ui components)
    ├── leagues/ (specialized components)
    └── Layout.tsx (shared layout)
```

**State Management Flow:**
```
User Action → Component → Hook → TanStack Query → Supabase Client → PostgreSQL
                    ↓
               Local State Update (optimistic)
                    ↓
               Real-time Subscription Update
```

### 2. Backend Architecture (Supabase)

#### Database Schema (PostgreSQL + PostGIS)
```sql
-- CORE ENTITIES
profiles (user_id, username, strava_tokens, subscription_id)
    ↓ 1:N
leagues (name, admin_user_id, max_members, is_public)
    ↓ 1:N
games (league_id, status, start_at, end_at, duration_days)
    ↓ 1:N
player_bases (game_id, user_id, base_location GEOMETRY)
    ↓ 1:N
territory_takeovers (game_id, user_id, intersection_point GEOMETRY)

-- SUPPORTING ENTITIES
league_members (league_id, user_id, role, status)
activities (user_id, strava_id, route_data, territory_points)
subscriptions (user_id, stripe_customer_id, status)
error_reports (user_id, error_type, context, created_at)
```

#### Security Model (Row Level Security)
```sql
-- EXAMPLE: leagues table policies
ENABLE ROW LEVEL SECURITY ON leagues;

-- Users can view public leagues or leagues they are members of
CREATE POLICY "leagues_select_policy" ON leagues FOR SELECT
USING (
  is_public = true
  OR admin_user_id = auth.uid()
  OR id IN (
    SELECT league_id FROM league_members
    WHERE user_id = auth.uid() AND status = 'approved'
  )
);

-- Only admins can update their leagues
CREATE POLICY "leagues_update_policy" ON leagues FOR UPDATE
USING (admin_user_id = auth.uid());
```

#### Edge Functions Architecture
```
Edge Functions (Deno Runtime):

strava-auth/           # OAuth token exchange
├── OAuth flow handling
├── State validation
├── Token storage
└── Secure redirects

strava-activities/     # Activity import
├── Strava API calls
├── GPX processing
├── Territory calculation
└── Database persistence

stripe-webhook/        # Payment processing
├── Webhook signature validation
├── Subscription lifecycle
├── Customer portal integration
└── Database sync

finish-due-games/      # Cron job (every 5min)
├── Game completion logic
├── Territory finalization
├── Winner calculation
└── Notification system
```

### 3. Deployment Architecture (Cloudflare + Supabase)

```
Internet Request Flow:

1. DNS Resolution (Cloudflare DNS)
        ↓
2. Cloudflare Edge Network
   • SSL/TLS termination
   • DDoS protection
   • Bot mitigation
   • CDN caching
        ↓
3. Cloudflare Pages (Static Hosting)
   • React SPA assets
   • Service Worker (PWA)
   • Edge-side includes
        ↓
4. API Calls → Supabase (Multi-region)
   • Load balancing
   • Connection pooling
   • Read replicas
        ↓
5. PostgreSQL Cluster
   • Primary-replica setup
   • Automated backups
   • Point-in-time recovery
```

## Data Flow Patterns

### 1. User Authentication Flow
```
1. User clicks "Login with Strava"
2. Redirect to Strava OAuth (with state)
3. User authorizes → Strava redirects to callback
4. Edge Function validates state & exchanges code
5. Store tokens in profiles table
6. Create/update user session
7. Redirect to dashboard with JWT
8. Frontend loads user profile via useAuth hook
```

### 2. Territory Game Flow
```
1. Admin creates league → leagues table
2. Users request to join → league_join_requests
3. Admin approves → league_members table
4. Admin starts game → games table (status: 'setup')
5. Players select base location → player_bases table
6. Game activates → status: 'active'
7. Players import Strava activities → activities table
8. Territory calculation → territory_takeovers table
9. Real-time updates via Supabase Realtime
10. Game ends (cron) → winner calculation
```

### 3. Payment Flow
```
1. User clicks "Upgrade" → /subscription page
2. Create Stripe checkout session → create-checkout function
3. User completes payment on Stripe
4. Stripe webhook → stripe-webhook function
5. Update subscriptions table
6. Enable premium features via RLS policies
7. Send confirmation email
```

## Performance Optimization Strategy

### Database Optimizations
```sql
-- Strategic Indexing
CREATE INDEX CONCURRENTLY idx_league_members_composite
ON league_members(league_id, user_id, status)
WHERE status = 'approved';

-- Geospatial Performance
CREATE INDEX idx_territory_takeovers_intersection
ON territory_takeovers USING GIST (intersection_point);

-- Materialized Views for Complex Queries
CREATE MATERIALIZED VIEW mv_league_statistics AS
SELECT
  l.id,
  COUNT(DISTINCT lm.user_id) as member_count,
  COUNT(DISTINCT g.id) as game_count
FROM leagues l
LEFT JOIN league_members lm ON l.id = lm.league_id
LEFT JOIN games g ON l.id = g.league_id
GROUP BY l.id;
```

### Frontend Optimizations
```typescript
// Code Splitting with Lazy Loading
const LazyGamePage = lazy(() => import('./pages/GamePage'));
const LazyDashboard = lazy(() => import('./pages/Dashboard'));

// Component Memoization
const MembersList = memo<MembersListProps>(({ members, onAction }) => {
  const sortedMembers = useMemo(
    () => members.sort((a, b) => a.role.localeCompare(b.role)),
    [members]
  );

  return <div>{/* render */}</div>;
});

// TanStack Query Optimization
const { data: leagues } = useQuery({
  queryKey: ['leagues', { userId }],
  queryFn: () => fetchUserLeagues(userId),
  staleTime: 5 * 60 * 1000, // 5 minutes
  gcTime: 10 * 60 * 1000,   // 10 minutes
});
```

## Security Architecture

### 1. Application Security Layers
```
┌─────────────────────────────────────────────────┐
│                  WAF + DDoS                     │ Layer 7
├─────────────────────────────────────────────────┤
│              TLS 1.3 + HSTS                     │ Layer 6
├─────────────────────────────────────────────────┤
│         CSP + Security Headers                  │ Layer 5
├─────────────────────────────────────────────────┤
│              JWT Authentication                 │ Layer 4
├─────────────────────────────────────────────────┤
│           Row Level Security (RLS)              │ Layer 3
├─────────────────────────────────────────────────┤
│         SECURITY DEFINER Functions             │ Layer 2
├─────────────────────────────────────────────────┤
│          Input Validation + Sanitization       │ Layer 1
└─────────────────────────────────────────────────┘
```

### 2. Database Security Model
```sql
-- Function Security Template
CREATE OR REPLACE FUNCTION secure_function(param uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER          -- Kører med elevated privileges
SET search_path = public, pg_temp  -- Locked search path
AS $$
BEGIN
  -- Validate input
  IF param IS NULL THEN
    RAISE EXCEPTION 'Invalid input parameters';
  END IF;

  -- Business logic here
  RETURN json_build_object('success', true);
END;
$$;

-- Secure permissions
ALTER FUNCTION secure_function(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION secure_function(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION secure_function(uuid) TO authenticated;
```

## Monitoring & Observability

### Application Monitoring Stack
```
GitHub Actions CI/CD
├── Security Scanning (Snyk, CodeQL)
├── Performance Testing (Lighthouse)
├── Automated Testing (Vitest)
└── Deployment Validation

Supabase Observability
├── Real-time Metrics Dashboard
├── Query Performance Insights
├── Connection Pool Monitoring
└── Error Tracking & Alerting

Cloudflare Analytics
├── Edge Performance Metrics
├── Security Threat Detection
├── Cache Hit Rates
└── Geographic Traffic Analysis
```

### Health Check Endpoints
```typescript
// Custom health check implementation
app.get('/health', async (req, res) => {
  const health = {
    uptime: process.uptime(),
    timestamp: Date.now(),
    checks: {
      database: await checkDatabaseConnection(),
      strava_api: await checkStravaAPI(),
      stripe_api: await checkStripeAPI(),
    }
  };

  const hasFailures = Object.values(health.checks)
    .some(check => !check.healthy);

  res.status(hasFailures ? 503 : 200).json(health);
});
```

## Future Architecture Evolution

### 30-Day Roadmap
- [ ] Redis caching layer for frequent queries
- [ ] Background job queue for heavy processing
- [ ] Enhanced error tracking with Sentry integration
- [ ] API rate limiting per user tier

### 60-Day Roadmap
- [ ] Multi-region database replication
- [ ] Microservice extraction for payment processing
- [ ] Advanced analytics with ClickHouse
- [ ] Push notification system

### 90-Day Roadmap
- [ ] Machine learning territory prediction
- [ ] Advanced geospatial clustering algorithms
- [ ] Real-time collaborative features
- [ ] Mobile app with React Native

Dette arkitektur dokument bør opdateres sammen med system evolution og nye features.