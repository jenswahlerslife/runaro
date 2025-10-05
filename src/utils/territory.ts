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

// Densify a closed ring so that no segment exceeds maxSegmentMeters
export function densifyRing(points: LatLng[], maxSegmentMeters: number = 35): LatLng[] {
  if (!points || points.length < 4) return points;
  const isClosed = points[0][0] === points[points.length - 1][0] && points[0][1] === points[points.length - 1][1];
  const ring = isClosed ? points.slice(0, -1) : points.slice();
  const n = ring.length;
  const out: LatLng[] = [];

  const addInterp = (a: LatLng, b: LatLng) => {
    const d = haversineMeters(a, b);
    if (d <= maxSegmentMeters) {
      out.push(a);
      return;
    }
    const steps = Math.ceil(d / maxSegmentMeters);
    out.push(a);
    for (let s = 1; s < steps; s++) {
      const t = s / steps;
      const lat = a[0] + t * (b[0] - a[0]);
      const lng = a[1] + t * (b[1] - a[1]);
      out.push([lat, lng]);
    }
  };

  for (let i = 0; i < n; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % n];
    addInterp(a, b);
  }
  // close ring
  out.push(out[0]);
  return out;
}

// Simple circular moving-average smoothing on a closed ring
export function movingAverageRing(points: LatLng[], window: number = 5, passes: number = 1): LatLng[] {
  if (!points || points.length < 4 || window < 2) return points;
  const isClosed = points[0][0] === points[points.length - 1][0] && points[0][1] === points[points.length - 1][1];
  let ring = (isClosed ? points.slice(0, -1) : points.slice());
  const n = ring.length;
  const half = Math.floor(window / 2);

  for (let p = 0; p < passes; p++) {
    const sm: LatLng[] = new Array(n);
    for (let i = 0; i < n; i++) {
      let latSum = 0, lngSum = 0, c = 0;
      for (let k = -half; k <= half; k++) {
        const idx = (i + k + n) % n;
        latSum += ring[idx][0];
        lngSum += ring[idx][1];
        c++;
      }
      sm[i] = [latSum / c, lngSum / c];
    }
    ring = sm;
  }
  return [...ring, ring[0]];
}

// Aggressive smoother for territory borders: densify -> chaikin -> moving-average
export function smoothTerritoryPolygon(polygon: LatLng[]): LatLng[] {
  if (!polygon || polygon.length < 4) return polygon;

  // Cap work for huge inputs
  const baseLen = polygon.length;
  const densifyTarget = baseLen > 1200 ? 55 : 35; // meters
  const chaikinIterations = baseLen > 1600 ? 1 : baseLen > 800 ? 2 : 3;

  let ring = densifyRing(polygon, densifyTarget);
  ring = smoothPolygonChaikin(ring, chaikinIterations);
  ring = movingAverageRing(ring, 5, 1);
  return ring;
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
  const smoothed = smoothTerritoryPolygon(polygon);
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
