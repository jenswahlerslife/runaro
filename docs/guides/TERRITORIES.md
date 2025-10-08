# Territory System - How-To Guide

## Overview

The territory system allows users to upload their Strava running activities and visualize them as territorial polygons on a Leaflet map. Routes are automatically closed to form territories if they're not already closed loops.

## Flow Summary

1. **Strava Connection**: User connects their Strava account via OAuth flow
2. **Activity Selection**: On `/strava/success`, user sees recent activities and clicks "Overfør til spillet" (Upload to Game)
3. **Data Processing**: Edge function `transfer-activity` fetches activity details from Strava API and saves to `user_activities` table
4. **Territory Visualization**: User is redirected to `/map?aid=<activity_id>` where territories are rendered as polygons

## Key Components

### Edge Function: `transfer-activity`
- Fetches detailed activity from Strava API
- Saves activity data including `summary_polyline` to `user_activities` table
- Calculates points earned for the activity
- Returns success response

### Frontend: Territory Utils (`src/utils/territory.ts`)
- `decodePolylineToLatLngs()`: Decodes Strava polyline format to lat/lng coordinates
- `closePolylineToPolygon()`: Closes open routes by connecting start/end points (30m threshold)
- `createTerritoryFromActivity()`: Converts DB activity to Territory object

### Map Component (`src/components/Map.tsx`)
- Fetches user activities from Supabase on load
- Renders each territory as a Leaflet Polygon
- Supports focusing on specific activity via `?aid=<id>` URL parameter
- Different colors for focused vs regular territories

## Database Schema

### Table: `user_activities`
- `id` (uuid, PK)
- `user_id` (uuid) - Links to authenticated user
- `strava_activity_id` (bigint) - Strava activity ID
- `name`, `distance`, `moving_time`, `activity_type`, etc.
- `polyline` (text) - Encoded polyline from Strava
- `points_earned` (integer) - Calculated points
- `created_at` (timestamptz)

RLS policies ensure users only see their own activities.

## URL Structure

- `/strava/success` - Activity selection and upload
- `/map` - Shows all user territories
- `/map?aid=12345` - Shows all territories, focuses on specific activity

## Territory Rules

1. Only running activities (`Run`, `TrailRun`) can be transferred
2. Activities without polylines are skipped
3. Open routes are automatically closed with direct line segment
4. If start/end points are < 30m apart, they're considered already closed
5. Territories are colored orange (#f97316) by default, red (#ef4444) when focused

## Development Notes

- Uses `polyline` npm package for decoding Strava polylines
- Leaflet handles map rendering and polygon display
- Copenhagen (55.6761, 12.5683) is default map center
- Territory data persists across sessions via database storage