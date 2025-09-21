import * as polyline from 'polyline';

export type LatLng = [number, number];

export function decodePolylineToLatLngs(encoded: string): LatLng[] {
  if (!encoded) return [];
  
  try {
    const decoded = polyline.decode(encoded);
    return decoded.map(([lat, lng]) => [lat, lng] as LatLng);
  } catch (error) {
    console.error('Error decoding polyline:', error);
    return [];
  }
}

export function haversineMeters(a: LatLng, b: LatLng): number {
  const R = 6371000; // Earth's radius in meters
  const [lat1, lon1] = a;
  const [lat2, lon2] = b;
  
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  
  const a1 = Math.sin(dLat/2) * Math.sin(dLat/2) +
          Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
          Math.sin(dLon/2) * Math.sin(dLon/2);
  
  const c = 2 * Math.atan2(Math.sqrt(a1), Math.sqrt(1-a1));
  
  return R * c;
}

export function closePolylineToPolygon(
  line: LatLng[], 
  closeThresholdMeters: number = 30
): LatLng[] {
  if (line.length < 3) return line;
  
  const firstPoint = line[0];
  const lastPoint = line[line.length - 1];
  
  const distance = haversineMeters(firstPoint, lastPoint);
  
  if (distance > closeThresholdMeters) {
    return [...line, firstPoint];
  }
  
  if (distance > 0.1) {
    const result = [...line];
    result[result.length - 1] = firstPoint;
    return result;
  }
  
  return line;
}

export interface Territory {
  id: string;
  name: string;
  activityType: string;
  stravaActivityId: number;
  polygon: LatLng[];
  routeCoordinates?: LatLng[];
  createdAt: string;
}

export function createTerritoryFromActivity(
  activity: {
    id: string;
    name: string;
    activity_type: string;
    strava_activity_id: number;
    polyline?: string;
    created_at: string;
  }
): Territory | null {
  console.log(`[Territory] Processing activity: ${activity.name} (ID: ${activity.strava_activity_id})`);
  
  if (!activity.polyline) {
    console.warn(`[Territory] Activity has no polyline:`, activity.name, activity.id);
    return null;
  }
  
  console.log(`[Territory] Polyline length: ${activity.polyline.length} characters`);
  
  const decodedLine = decodePolylineToLatLngs(activity.polyline);
  console.log(`[Territory] Decoded ${decodedLine.length} coordinate points`);
  
  if (decodedLine.length < 3) {
    console.warn(`[Territory] Polyline too short for territory (${decodedLine.length} points):`, activity.name);
    return null;
  }
  
  const polygon = closePolylineToPolygon(decodedLine);
  console.log(`[Territory] Final polygon has ${polygon.length} points`);
  
  // Log first and last few points to verify coordinate order
  console.log(`[Territory] First point: [${polygon[0][0]}, ${polygon[0][1]}]`);
  console.log(`[Territory] Last point: [${polygon[polygon.length-1][0]}, ${polygon[polygon.length-1][1]}]`);
  
  return {
    id: activity.id,
    name: activity.name,
    activityType: activity.activity_type,
    stravaActivityId: activity.strava_activity_id,
    polygon,
    routeCoordinates: decodedLine, // Store original route for animation
    createdAt: activity.created_at,
  };
}