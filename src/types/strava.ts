// Shared Strava types used across the app
export interface StravaMapSummary {
  summary_polyline?: string;
  polyline?: string;
}

export interface StravaActivity {
  id: number;
  name: string;
  distance: number; // meters
  moving_time: number; // seconds
  type: string;
  start_date: string; // ISO string
  average_speed: number; // m/s
  max_speed?: number; // m/s
  total_elevation_gain?: number; // meters
  map: StravaMapSummary;
}

