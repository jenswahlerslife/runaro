import * as polyline from 'polyline';
import polylineDefault from 'polyline';
export type LatLng = [number, number];

export function decodePolylineToLatLngs(encoded: string): LatLng[] {
  if (!encoded) return [];
  
  try {
    // Use default export to satisfy various bundlers
    const decoded = (polylineDefault?.decode ?? polyline.decode)(encoded);
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

// Chaikin's corner-cutting to smooth polygon edges while preserving shape
export function smoothPolygonChaikin(points: LatLng[], iterations: number = 2): LatLng[] {
  if (!points || points.length < 4) return points;

  const isClosed = points[0][0] === points[points.length - 1][0] && points[0][1] === points[points.length - 1][1];
  let ring: LatLng[] = isClosed ? points.slice(0, -1) : points.slice();

  // Guard against exploding point count: reduce iterations for very long rings
  const iter = ring.length > 1500 ? 1 : Math.max(1, Math.min(iterations, 3));

  for (let k = 0; k < iter; k++) {
    const newPts: LatLng[] = [];
    const n = ring.length;
    for (let i = 0; i < n; i++) {
      const p0 = ring[i];
      const p1 = ring[(i + 1) % n];
      const q: LatLng = [0.75 * p0[0] + 0.25 * p1[0], 0.75 * p0[1] + 0.25 * p1[1]];
      const r: LatLng = [0.25 * p0[0] + 0.75 * p1[0], 0.25 * p0[1] + 0.75 * p1[1]];
      newPts.push(q, r);
    }
    ring = newPts;
  }

  const closedRing = [...ring, ring[0]];
  return closedRing;
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
  const smoothed = smoothPolygonChaikin(polygon, 2);
  console.log(`[Territory] Final polygon has ${smoothed.length} points (smoothed)`);
  
  // Log first and last few points to verify coordinate order
  console.log(`[Territory] First point: [${smoothed[0][0]}, ${smoothed[0][1]}]`);
  console.log(`[Territory] Last point: [${smoothed[smoothed.length-1][0]}, ${smoothed[smoothed.length-1][1]}]`);
  
  return {
    id: activity.id,
    name: activity.name,
    activityType: activity.activity_type,
    stravaActivityId: activity.strava_activity_id,
    polygon: smoothed,
    routeCoordinates: decodedLine, // Store original route for animation
    createdAt: activity.created_at,
  };
}
