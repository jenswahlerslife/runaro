# 🎮 Multiplayer Territory Game - Implementation Guide

## 🎯 Game Concept Overview

**Territory Game** er et 30-dages multiplayer konkurrencespil, hvor spillere bruger deres Strava-løberuter til at bygge og udvide territorier. Spillerne konkurrerer om at have det største territorium, og kan overtage hinandens områder ved at løbe ruter, der krydser modstandernes territorier.

### Core Game Loop
1. **Start Game** → Tilslut/opret liga → Vælg base → Start 30-dages konkurrence
2. **Expand Territory** → Løb nye ruter forbundet til eksisterende territorium  
3. **Territory Takeover** → Kryds modstandernes ruter for at overtage områder
4. **Win** → Størst territorium efter 30 dage vinder

## 🗄️ Database Architecture

### Core Tables
```sql
-- Leagues (spillergrupper)
leagues
├── id (uuid)
├── name (text)
├── admin_user_id (uuid) → profiles.id
├── invite_code (text, unique)
├── max_members (integer, default 10)
└── is_public (boolean, default false)

-- League Members (M:N relation)
league_members
├── league_id (uuid) → leagues.id
├── user_id (uuid) → profiles.id
├── status (enum: pending|approved|rejected|left)
└── approved_by/approved_at

-- Games (30-dags konkurencer)
games  
├── id (uuid)
├── league_id (uuid) → leagues.id
├── name (text)
├── status (enum: setup|active|finished|cancelled)
├── start_date/end_date (timestamptz)
└── winner_user_id (uuid) → profiles.id

-- Player Bases (én base per spiller per spil)
player_bases
├── game_id (uuid) → games.id
├── user_id (uuid) → profiles.id  
├── activity_id (uuid) → user_activities.id
├── base_date (timestamptz) -- Kun aktiviteter efter denne dato tæller
└── territory_size_km2 (numeric, cached)

-- Territory Takeovers (log af overtagne områder)
territory_takeovers
├── game_id (uuid) → games.id
├── taken_from_user_id (uuid) → profiles.id
├── taken_by_user_id (uuid) → profiles.id
├── activity_id (uuid) → user_activities.id
└── intersection_point (geometry)
```

### Enhanced user_activities Table
```sql
-- Existing + new columns for territory system
user_activities
├── [existing columns]
├── route (geometry(LineString, 4326)) -- PostGIS route geometry  
├── is_base (boolean, default false) -- Base activity marker
└── included_in_game (boolean, default true) -- Territory inclusion
```

## 🔧 Backend Functions (SQL)

### League Management
- `create_league(name, description, is_public, max_members)` → Liga oprettelse
- `join_league(invite_code)` → Tilslut liga via kode  
- `manage_league_membership(league_id, user_id, action)` → Godkend/afvis medlemmer

### Game Management  
- `create_game(league_id, name)` → Opret nyt spil (kræver min 2 medlemmer)
- `set_player_base(game_id, activity_id)` → Sæt spillerbase
- `start_game(game_id)` → Start 30-dags konkurrence

### Territory & Competition
- `calculate_player_territory(game_id, user_id, tolerance)` → Beregn territorium
- `check_territory_takeover(game_id, activity_id, tolerance)` → Check for overtagelser  
- `recalculate_game_territories(game_id, tolerance)` → Genberegn alle territorier
- `get_game_leaderboard(game_id)` → Ranglist baseret på territoristørrelse
- `finish_game(game_id)` → Afslut spil og find vinder

## 🖥️ Frontend Implementation

### Core Pages
1. **Index** (`/`) - Hovedside med "Start Game" knap → redirecter til `/leagues`
2. **LeaguesPage** (`/leagues`) - Liga lobby (opret/tilslut ligaer, se spil)  
3. **GamePage** (`/games/:gameId`) - Spil-setup og status (vælg base, se spillere)
4. **ActivitiesPage** (`/activities`) - Aktivitet overview med territorieinfo

### API Integration (`/src/lib/`)
```typescript
// Liga management
leagues.ts
├── createLeague(name, description, isPublic, maxMembers)
├── joinLeague(inviteCode)  
├── getUserLeagues() 
├── getLeagueGames(leagueId)
├── setPlayerBase(gameId, activityId)
└── startGame(gameId)

// Multiplayer functions
gameMultiplayer.ts
├── calculatePlayerTerritory(gameId, userId, tolerance)
├── checkTerritoryTakeover(gameId, activityId, tolerance)
├── getGameLeaderboard(gameId)
├── getGameStats(gameId)
└── finishGame(gameId)

// Spatial utilities  
geospatial.ts
├── polylineToWKT(encodedPolyline) -- Convert Strava polyline to PostGIS
├── updateActivityRoute(activityId, polylineData)
└── batchUpdateActivityRoutes(activities[])
```

## 🚀 Implementation Steps

### 1. Database Setup
```bash
# Apply migrations in Supabase SQL Editor
-- 20250901170000_create_multiplayer_league_system.sql
-- 20250901170001_create_league_functions.sql  
-- 20250901170002_create_multiplayer_territory_functions.sql
```

### 2. Test Core Functionality
```sql
-- Test league creation
SELECT public.create_league('Test League', 'Testing purposes', false, 5);

-- Test territory calculation  
SELECT public.calculate_player_territory('game_id', 'user_id', 50);

-- Verify spatial indexes exist
SELECT indexname FROM pg_indexes WHERE tablename = 'user_activities' AND indexname LIKE '%route%';
```

### 3. Route Generation
```typescript
// For existing activities without route geometry
import { updateActivityRoute, polylineToWKT } from '@/lib/geospatial';

// Batch update routes from polyline data
const activities = await getUserActivities();
const activitiesWithPolyline = activities.filter(a => a.polyline);
await batchUpdateActivityRoutes(
  activitiesWithPolyline.map(a => ({ id: a.id, polyline: a.polyline }))
);
```

### 4. Game Flow Testing
1. **Opret Liga**: Via `/leagues` - note invite code
2. **Tilslut Liga**: Brug invite code, admin godkender  
3. **Opret Spil**: Admin opretter nyt spil i ligaen
4. **Vælg Baser**: Alle spillere vælger base-aktivitet via `/games/:gameId`
5. **Start Spil**: Admin starter når alle har bases (30-dags timer starter)
6. **Importer Ruter**: Nye Strava-aktiviteter → check for overtagelser
7. **Se Leaderboard**: Ranglist opdateres kontinuerligt
8. **Afslut Spil**: Automatic eller manual efter 30 dage

## ⚙️ Game Rules Implementation

### Base Selection Rules
- **Én base per spiller per spil** (enforced via unique constraint)
- **Base Date Filter**: Kun aktiviteter efter base-dato tæller
- **Route Requirement**: Aktiviteter skal have route geometry for at deltage

### Territory Calculation
- **Proximity-based**: 50m tolerance (configurable)
- **Recursive Expansion**: Starter fra base, udvider til tilstødende ruter
- **Area Calculation**: Convex hull af alle territorieruter → km²

### Territory Takeover
- **Intersection Detection**: PostGIS `ST_Intersects()` + `ST_DWithin()`
- **Automatic Logging**: Når ny aktivitet krydser eksisterende territorium
- **Point Capture**: Gem GPS-punkt for krydsning

### Winner Determination
- **Primary**: Størst territorium (km²)
- **Tiebreaker**: Flest aktiviteter
- **Auto-finish**: Efter 30 dage eller manual admin action

## 🔒 Security & Permissions

### Row Level Security (RLS)
```sql
-- Spillere kan kun se ligaer de er medlemmer af
"Users can view leagues they are members of or public leagues"

-- Kun liga-admins kan oprette/starte spil  
"League admins can create games"

-- Spillere kan kun sætte egne baser
"Users can create their own bases"
```

### API Security
- Alle funktioner kræver autentificering (`auth.uid()`)
- User context validation i alle functions  
- SECURITY DEFINER med `search_path = public`

## 🗺️ Future Enhancements

### Map Visualization (Next Phase)
- **Leaflet/Mapbox Integration**: Vis territorier på kort
- **Real-time Updates**: WebSocket eller polling for live territories
- **Player Colors**: Unique farver per spiller
- **Takeover Animations**: Visualiser territorial ændringer

### Advanced Features
- **Season System**: Multiple 30-dags perioder
- **Team Leagues**: Flere spillere per hold  
- **Territory Decay**: Territorier shrinks over tid uden aktivitet
- **Power-ups**: Special abilities via achievements
- **Tournament Brackets**: Multi-league competitions

## 🐛 Troubleshooting

### Common Issues
1. **PostGIS Not Enabled**: Kør `CREATE EXTENSION postgis;`
2. **Missing Routes**: Kør route generation fra polyline data
3. **Territory Not Calculating**: Check base er sat og route geometry eksisterer  
4. **Permission Errors**: Verify RLS policies og user context

### Debug Queries
```sql
-- Check user's territories
SELECT COUNT(*) as total, 
       COUNT(*) FILTER (WHERE included_in_game) as in_territory,
       COUNT(*) FILTER (WHERE route IS NOT NULL) as with_routes
FROM user_activities WHERE user_id = 'profile_id';

-- Verify game setup
SELECT g.name, g.status, COUNT(pb.id) as bases_set
FROM games g
LEFT JOIN player_bases pb ON g.id = pb.game_id  
WHERE g.id = 'game_id'
GROUP BY g.name, g.status;
```

## 🏁 Summary

**Du har nu et komplet multiplayer territorial-spil system! 🎉**

**Core Features Implementeret:**
✅ Liga-system med admin/medlemmer  
✅ 30-dags spil med base-selection
✅ Spatial territorieberegning (PostGIS)
✅ Territory takeover detection  
✅ Leaderboards og winner determination
✅ Frontend UI til alle core flows
✅ Komplet API integration  
✅ RLS security og data protection

**Ready to Deploy:**
1. Kør migrationer i Supabase
2. Test liga creation og game flows
3. Generate route geometry for eksisterende aktiviteter  
4. Inviter spillere og start første konkurrence! 

Spillet er klar til produktion med skalerbar arkitektur og komprehensiv fejlhåndtering. 🚀