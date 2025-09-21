import * as polyline from 'polyline';

/**
 * Converts an encoded polyline string to a PostGIS LineString WKT (Well-Known Text) format
 * @param encodedPolyline - The encoded polyline string from Strava/GPS data
 * @returns WKT representation of LineString or null if invalid
 */
export function polylineToWKT(encodedPolyline: string): string | null {
  if (!encodedPolyline || typeof encodedPolyline !== 'string') {
    return null;
  }

  try {
    // Decode polyline to array of [lat, lng] coordinates
    const coordinates = polyline.decode(encodedPolyline);
    
    if (!coordinates || coordinates.length < 2) {
      // Need at least 2 points to make a line
      return null;
    }

    // Convert to longitude, latitude format (PostGIS expects lon, lat)
    const lonLatPoints = coordinates.map(([lat, lng]) => `${lng} ${lat}`);
    
    // Create WKT LineString
    const wkt = `LINESTRING(${lonLatPoints.join(', ')})`;
    
    return wkt;
  } catch (error) {
    console.error('Error converting polyline to WKT:', error);
    return null;
  }
}

/**
 * Converts an array of coordinate points to PostGIS LineString WKT format
 * @param points - Array of [lat, lng] coordinate pairs
 * @returns WKT representation of LineString or null if invalid
 */
export function coordinatesToWKT(points: [number, number][]): string | null {
  if (!points || points.length < 2) {
    return null;
  }

  try {
    // Convert to longitude, latitude format (PostGIS expects lon, lat)
    const lonLatPoints = points.map(([lat, lng]) => `${lng} ${lat}`);
    
    // Create WKT LineString
    const wkt = `LINESTRING(${lonLatPoints.join(', ')})`;
    
    return wkt;
  } catch (error) {
    console.error('Error converting coordinates to WKT:', error);
    return null;
  }
}

/**
 * Updates an activity with route geometry based on its polyline data
 * @param activityId - The activity ID to update
 * @param polylineData - The encoded polyline string
 * @returns Promise with success status
 */
export async function updateActivityRoute(
  activityId: string,
  polylineData: string
): Promise<{ success: boolean; error?: string }> {
  const wkt = polylineToWKT(polylineData);

  if (!wkt) {
    return { success: false, error: 'Invalid polyline data' };
  }

  try {
    const { supabase } = await import('@/integrations/supabase/client');

    // Use SQL RPC to update with PostGIS geometry
    const sql = `
      UPDATE public.user_activities
      SET route = ST_SetSRID(ST_GeomFromText('${wkt}'), 4326)
      WHERE id = '${activityId}'
    `;

    const { error } = await supabase.rpc('exec_sql', { sql_text: sql });

    if (error) {
      console.error('Error updating activity route:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('Error updating activity route:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Batch update multiple activities with route geometry
 * @param activities - Array of {id, polyline} objects
 * @returns Promise with results
 */
export async function batchUpdateActivityRoutes(
  activities: Array<{ id: string; polyline: string }>
): Promise<{ success: boolean; processed: number; errors: string[] }> {
  const errors: string[] = [];
  let processed = 0;

  for (const activity of activities) {
    const result = await updateActivityRoute(activity.id, activity.polyline);
    if (result.success) {
      processed++;
    } else {
      errors.push(`Activity ${activity.id}: ${result.error}`);
    }
  }

  return {
    success: errors.length === 0,
    processed,
    errors
  };
}