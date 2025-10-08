# Territory System Implementation

## Overview

The territory system allows users to select one activity as their "base" and automatically determines which other activities are connected to form a contiguous territory. Only activities within the territory can be included in the game.

## How It Works

1. **Base Selection**: User selects one activity as their main base
2. **Territory Calculation**: Using recursive spatial queries, the system finds all activities within 50 meters (configurable) of the base or any activity already in the territory
3. **Game Inclusion**: Only activities within the territory have `included_in_game = true`

## Database Changes

### New Columns Added to `user_activities`:
- `route` - PostGIS LineString geometry (EPSG:4326)
- `is_base` - Boolean flag for the user's base activity
- `included_in_game` - Updated to reflect territory inclusion

### Constraints:
- Unique constraint: Only one base per user
- Spatial index on `route` column for performance

### New Function:
- `refresh_user_territory(user_id, tolerance_meters)` - Recalculates territory

## Usage

### Setting a Base Activity
```typescript
import { setActivityAsBase } from '@/lib/territory';

const result = await setActivityAsBase(activityId, 50); // 50m tolerance
if (result.success) {
  console.log(`Territory includes ${result.territory_count} activities`);
}
```

### Recalculating Territory
```typescript
import { recalculateTerritory } from '@/lib/territory';

const result = await recalculateTerritory(50);
```

### Getting Activities with Territory Info
```typescript
import { getUserActivitiesWithTerritory } from '@/lib/territory';

const activities = await getUserActivitiesWithTerritory();
activities.forEach(activity => {
  console.log(`${activity.name}: Base=${activity.is_base}, InGame=${activity.included_in_game}`);
});
```

## Route Generation from Polyline

For activities with polyline data but no route geometry:

```typescript
import { updateActivityRoute, polylineToWKT } from '@/lib/geospatial';

// Convert polyline to PostGIS geometry
const wkt = polylineToWKT(polylineString);
const result = await updateActivityRoute(activityId, polylineString);
```

## UI Features

### Activities Page Updates:
- **Base Badge**: Shows which activity is the current base
- **Territory Status**: Green checkmark for included activities, gray X for excluded
- **Set Base Button**: Allow users to change their base
- **Recalculate Button**: Manual territory recalculation
- **Status Counts**: Shows "X/Y In territory / Total"

## Validation & Testing

Run the validation queries in `territory_validation.sql` to verify:
1. PostGIS extension is enabled
2. Schema changes are applied correctly
3. Territory function works as expected
4. Route geometries are valid

## Configuration

### Tolerance Distance
Default: 50 meters. Adjust based on your needs:
- Urban areas: 50-100m (accounts for GPS inaccuracy)
- Rural areas: 100-200m (longer distances between route intersections)

### Safety Limits
- Recursive CTE depth limited to 100 levels
- Statement timeout: 15 seconds
- Lock timeout: 3 seconds

## Troubleshooting

### Common Issues:

1. **No activities in territory after setting base**
   - Check if activities have route geometry (`route IS NOT NULL`)
   - Verify tolerance distance isn't too small
   - Run validation query #9 to find activities without routes

2. **Territory calculation fails**
   - Check user has a base set (`is_base = true`)
   - Verify user permissions (RLS policies)
   - Check for invalid route geometries (validation query #10)

3. **Performance issues**
   - Ensure spatial index exists on route column
   - Consider reducing tolerance distance
   - Check for large numbers of activities (>1000)

### Debug Queries:
```sql
-- Check user's territory status
SELECT 
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE is_base) as bases,
  COUNT(*) FILTER (WHERE included_in_game) as in_territory,
  COUNT(*) FILTER (WHERE route IS NOT NULL) as with_routes
FROM public.user_activities 
WHERE user_id = 'USER_PROFILE_ID';

-- Test territory calculation
SELECT public.refresh_user_territory('USER_PROFILE_ID', 50);
```

## Migration Order

1. `20250901160000_enable_postgis_and_territory_system.sql`
2. `20250901160001_create_territory_function.sql`

## Security Notes

- RLS (Row Level Security) remains enabled
- Users can only modify their own activities
- Territory function uses SECURITY DEFINER but validates user ownership
- All spatial operations use authenticated user context