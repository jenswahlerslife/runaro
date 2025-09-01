import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "react-router-dom";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Activity, ArrowLeft, Map, Calendar, Clock, Gauge } from "lucide-react";

type ActivityRow = {
  id: string;
  name: string;
  distance: number | null; // km (real)
  moving_time: number | null; // seconds (integer)
  activity_type: string | null;
  start_date: string; // timestamptz
  strava_activity_id: number;
};

function formatTimeSec(sec: number | null): string {
  const s = Math.max(0, sec ?? 0);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  if (h > 0) return `${h}h ${m}m ${r}s`;
  if (m > 0) return `${m}m ${r}s`;
  return `${r}s`;
}

function formatKm(distanceValue: number | null): string {
  if (!distanceValue || distanceValue <= 0) return "0.00 km";
  
  // If value is > 1000, assume it's in meters and convert to km
  const km = distanceValue > 1000 ? distanceValue / 1000 : distanceValue;
  return `${km.toFixed(2)} km`;
}

function formatPaceMinPerKm(movingSec: number | null, distanceValue: number | null): string {
  if (!movingSec || movingSec <= 0 || !distanceValue || distanceValue <= 0) return "–";
  
  // Convert to km if needed
  const km = distanceValue > 1000 ? distanceValue / 1000 : distanceValue;
  if (km <= 0) return "–";
  
  const paceSecPerKm = movingSec / km;
  const mm = Math.floor(paceSecPerKm / 60);
  const ss = Math.round(paceSecPerKm % 60);
  return `${mm}:${ss.toString().padStart(2, "0")} /km`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('da-DK', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

export default function ActivitiesPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      setLoading(true);
      console.log('[Activities] Fetching activities for user:', user.id);
      
      // First try with included_in_game filter
      let { data, error } = await supabase
        .from("user_activities")
        .select(
          "id, name, distance, moving_time, activity_type, start_date, strava_activity_id, included_in_game"
        )
        .eq("user_id", user.id)
        .eq("included_in_game", true)
        .order("start_date", { ascending: false });

      // If no results, try without included_in_game filter (maybe column doesn't exist yet)
      if (!error && (!data || data.length === 0)) {
        console.log('[Activities] No activities with included_in_game=true, trying without filter...');
        const fallback = await supabase
          .from("user_activities")
          .select(
            "id, name, distance, moving_time, activity_type, start_date, strava_activity_id"
          )
          .eq("user_id", user.id)
          .order("start_date", { ascending: false });
        
        data = fallback.data;
        error = fallback.error;
      }

      if (error) {
        console.error("[Activities] Database error:", error);
        console.error("[Activities] Error details:", {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint
        });
        setRows([]);
      } else {
        console.log('[Activities] Raw database response:', data);
        console.log('[Activities] Found activities:', data?.length || 0);
        
        if (data && data.length > 0) {
          console.log('[Activities] Sample activity:', data[0]);
        }
        
        setRows(
          (data ?? []).map((d: any) => ({
            id: d.id,
            name: d.name ?? "Untitled activity",
            distance: typeof d.distance === "number" ? d.distance : (d.distance ?? 0),
            moving_time: d.moving_time ?? 0,
            activity_type: d.activity_type ?? "Run",
            start_date: d.start_date,
            strava_activity_id: d.strava_activity_id,
          }))
        );
      }
      setLoading(false);
    };

    fetchData();
  }, [user]);

  const totalDistance = useMemo(
    () => rows.reduce((acc, r) => acc + (r.distance ?? 0), 0),
    [rows]
  );

  const totalTime = useMemo(
    () => rows.reduce((acc, r) => acc + (r.moving_time ?? 0), 0),
    [rows]
  );

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <Activity className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-muted-foreground">Loading activities...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/dashboard">
              <Button variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <Activity className="h-8 w-8 text-primary" />
                My Activities
              </h1>
              <p className="text-muted-foreground">
                Activities included in the game
              </p>
            </div>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Activities</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{rows.length}</div>
              <p className="text-xs text-muted-foreground">
                Included in game
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Distance</CardTitle>
              <Map className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatKm(totalDistance)}</div>
              <p className="text-xs text-muted-foreground">
                Combined distance
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Time</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatTimeSec(totalTime)}</div>
              <p className="text-xs text-muted-foreground">
                Moving time
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Debug Info (remove this in production) */}
        {process.env.NODE_ENV === 'development' && (
          <Card className="border-yellow-200 bg-yellow-50">
            <CardHeader>
              <CardTitle className="text-sm text-yellow-800">Debug Info</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-yellow-700">
              <p>User ID: {user?.id}</p>
              <p>Activities found: {rows.length}</p>
              <p>Loading: {loading.toString()}</p>
              <p>Check browser console for detailed logs</p>
              {rows.length > 0 && (
                <p>Sample activity: {JSON.stringify(rows[0], null, 2)}</p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Activities Table */}
        {rows.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <Activity className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold text-muted-foreground mb-2">
                No activities found
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                Upload activities from Strava to see them here
              </p>
              <p className="text-xs text-muted-foreground mb-4">
                Run the debug SQL queries in Supabase to check if data exists in the database
              </p>
              <Link to="/upload">
                <Button>
                  <Activity className="h-4 w-4 mr-2" />
                  Upload Activities
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Activity Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-2 font-medium">Name</th>
                      <th className="text-left py-3 px-2 font-medium">
                        <div className="flex items-center gap-1">
                          <Activity className="h-4 w-4" />
                          Type
                        </div>
                      </th>
                      <th className="text-left py-3 px-2 font-medium">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          Date
                        </div>
                      </th>
                      <th className="text-left py-3 px-2 font-medium">
                        <div className="flex items-center gap-1">
                          <Map className="h-4 w-4" />
                          Distance
                        </div>
                      </th>
                      <th className="text-left py-3 px-2 font-medium">
                        <div className="flex items-center gap-1">
                          <Gauge className="h-4 w-4" />
                          Pace
                        </div>
                      </th>
                      <th className="text-left py-3 px-2 font-medium">
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          Time
                        </div>
                      </th>
                      <th className="text-left py-3 px-2 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.id} className="border-b hover:bg-muted/50 transition-colors">
                        <td className="py-3 px-2">
                          <div className="font-medium">{row.name}</div>
                        </td>
                        <td className="py-3 px-2 text-muted-foreground">
                          {row.activity_type}
                        </td>
                        <td className="py-3 px-2 text-muted-foreground">
                          {formatDate(row.start_date)}
                        </td>
                        <td className="py-3 px-2 font-medium">
                          {formatKm(row.distance)}
                        </td>
                        <td className="py-3 px-2 font-mono">
                          {formatPaceMinPerKm(row.moving_time, row.distance)}
                        </td>
                        <td className="py-3 px-2">
                          {formatTimeSec(row.moving_time)}
                        </td>
                        <td className="py-3 px-2">
                          <Link to={`/map?aid=${row.strava_activity_id}`}>
                            <Button variant="outline" size="sm">
                              <Map className="h-4 w-4 mr-1" />
                              View on Map
                            </Button>
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}