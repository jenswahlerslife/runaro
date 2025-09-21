import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Activity, ArrowLeft, Map, Calendar, Clock, Gauge, Target, CheckCircle, XCircle, RefreshCw } from "lucide-react";
import { setActivityAsBase, recalculateTerritory, getUserActivitiesWithTerritory } from "@/lib/territory";
import { setPlayerBase } from "@/lib/gamesApi";

type ActivityRow = {
  id: string;
  name: string;
  distance: number | null; // km (real)
  moving_time: number | null; // seconds (integer)
  activity_type: string | null;
  start_date: string; // timestamptz
  strava_activity_id: number;
  is_base: boolean;
  included_in_game: boolean;
  route: any; // PostGIS geometry
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

function formatDate(dateStr?: string | null): string {
  try {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('da-DK', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  } catch {
    return '—';
  }
}

export default function ActivitiesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const gameId = searchParams.get("game");
  const selectBase = searchParams.get("selectBase") === "1";
  const [rows, setRows] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [settingBase, setSettingBase] = useState<string | null>(null);
  const [recalculating, setRecalculating] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      setLoading(true);
      console.log('[Activities] Fetching activities for user:', user.id);
      
      try {
        const activities = await getUserActivitiesWithTerritory();
        console.log('[Activities] Found activities:', activities.length);
        
        if (activities.length > 0) {
          console.log('[Activities] Sample activity:', activities[0]);
        }
        
        setRows(
          activities.map((d: any) => ({
            id: d.id,
            name: d.name ?? "Untitled activity",
            distance: typeof d.distance === "number" ? d.distance : (d.distance ?? 0),
            moving_time: d.moving_time ?? 0,
            activity_type: d.activity_type ?? "Run",
            start_date: d.start_date,
            strava_activity_id: d.strava_activity_id,
            is_base: d.is_base ?? false,
            included_in_game: d.included_in_game ?? true,
            route: d.route,
          }))
        );
      } catch (error) {
        console.error("[Activities] Database error:", error);
        setRows([]);
        toast({
          title: "Error loading activities",
          description: String(error),
          variant: "destructive",
        });
      }
      setLoading(false);
    };

    fetchData();
  }, [user]);

  const totalDistance = useMemo(
    () => rows.filter(r => r.included_in_game).reduce((acc, r) => acc + (r.distance ?? 0), 0),
    [rows]
  );

  const totalTime = useMemo(
    () => rows.filter(r => r.included_in_game).reduce((acc, r) => acc + (r.moving_time ?? 0), 0),
    [rows]
  );

  const baseActivity = useMemo(
    () => rows.find(r => r.is_base),
    [rows]
  );

  const territoryCount = useMemo(
    () => rows.filter(r => r.included_in_game).length,
    [rows]
  );

  const handleSetBase = async (activityId: string) => {
    setSettingBase(activityId);
    try {
      if (gameId && selectBase) {
        // 🎯 Spil-flow: sæt Base pr. spil
        const result = await setPlayerBase(gameId, activityId);
        if (!result?.success) {
          throw new Error(result?.error || "Kunne ikke sætte base for spil");
        }

        toast({
          title: "Base valgt til spillet",
          description: "Spillet starter automatisk når alle spillere har valgt Base.",
        });

        // 👉 Efter success: send spilleren til spillet
        navigate(`/games/${gameId}`);
      } else {
        // 🗺️ "Global" territory-flow (uden for spil)
        const result = await setActivityAsBase(activityId, 50);
        if (!result.success) {
          throw new Error(result.error || "Ukendt fejl ved base-valg");
        }
        toast({
          title: "Base sat",
          description: `Territory inkluderer ${result.territory_count} af ${result.total_count} aktiviteter`,
        });
        await refetchData();
      }
    } catch (error: any) {
      toast({
        title: "Fejl ved base-valg",
        description: String(error?.message || error),
        variant: "destructive",
      });
    } finally {
      setSettingBase(null);
    }
  };

  const refetchData = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const activities = await getUserActivitiesWithTerritory();
      setRows(
        activities.map((d: any) => ({
          id: d.id,
          name: d.name ?? "Untitled activity",
          distance: typeof d.distance === "number" ? d.distance : (d.distance ?? 0),
          moving_time: d.moving_time ?? 0,
          activity_type: d.activity_type ?? "Run",
          start_date: d.start_date,
          strava_activity_id: d.strava_activity_id,
          is_base: d.is_base ?? false,
          included_in_game: d.included_in_game ?? true,
          route: d.route,
        }))
      );
    } catch (error) {
      console.error("[Activities] Database error:", error);
      setRows([]);
    }
    setLoading(false);
  };


  const handleRecalculateTerritory = async () => {
    setRecalculating(true);
    try {
      const result = await recalculateTerritory(50);
      if (result.success) {
        toast({
          title: "Territory recalculated",
          description: `Territory includes ${result.territory_count} of ${result.total_count} activities`,
        });
        await refetchData(); // Refresh the data
      } else {
        toast({
          title: "Error recalculating territory",
          description: result.error || "Unknown error",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error recalculating territory",
        description: String(error),
        variant: "destructive",
      });
    } finally {
      setRecalculating(false);
    }
  };

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
        {/* Game Base Selection Banner */}
        {gameId && selectBase && (
          <Alert>
            <Target className="h-4 w-4" />
            <AlertDescription>
              Du er ved at vælge din <b>Base</b> til dette spil. Vælg en aktivitet som definerer dit startområde.
              Spillet kan startes manuelt når alle spillere har sat deres base.
            </AlertDescription>
          </Alert>
        )}

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to={gameId ? "/leagues" : "/dashboard"}>
              <Button variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                {gameId ? "Tilbage til Ligaer" : "Back to Dashboard"}
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <Activity className="h-8 w-8 text-primary" />
                {gameId && selectBase ? "Vælg Spil Base" : "My Activities"}
              </h1>
              <p className="text-muted-foreground">
                {gameId && selectBase 
                  ? "Vælg din startbase til spillet" 
                  : "Manage your territory base and game activities"
                }
              </p>
              {baseActivity && !gameId && (
                <p className="text-sm text-muted-foreground mt-1">
                  Base: <span className="font-medium">{baseActivity.name}</span>
                </p>
              )}
            </div>
          </div>
          {!gameId && (
            <div className="flex gap-2">
              <Button 
                onClick={handleRecalculateTerritory}
                disabled={recalculating || !baseActivity}
                variant="outline"
                size="sm"
              >
                {recalculating ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Recalculate Territory
              </Button>
            </div>
          )}
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Activities</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{territoryCount} / {rows.length}</div>
              <p className="text-xs text-muted-foreground">
                In territory / Total
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
                      <th className="text-left py-3 px-2 font-medium">Status</th>
                      <th className="text-left py-3 px-2 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.id} className={`border-b hover:bg-muted/50 transition-colors ${
                        !row.included_in_game ? 'opacity-60' : ''
                      }`}>
                        <td className="py-3 px-2">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{row.name}</span>
                            {row.is_base && (
                              <Badge variant="secondary" className="text-xs">
                                <Target className="h-3 w-3 mr-1" />
                                Base
                              </Badge>
                            )}
                          </div>
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
                          <div className="flex items-center gap-1">
                            {row.included_in_game ? (
                              <Badge variant="default" className="text-xs">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                In Territory
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="text-xs">
                                <XCircle className="h-3 w-3 mr-1" />
                                Outside Territory
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-2">
                          <div className="flex gap-1">
                            {gameId && selectBase ? (
                              <Button
                                variant="default"
                                size="sm"
                                onClick={() => handleSetBase(row.id)}
                                disabled={settingBase === row.id}
                              >
                                {settingBase === row.id ? (
                                  <RefreshCw className="h-4 w-4 animate-spin" />
                                ) : (
                                  <>
                                    <Target className="h-4 w-4 mr-1" />
                                    Sæt som Base
                                  </>
                                )}
                              </Button>
                            ) : (
                              <>
                                {!row.is_base && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleSetBase(row.id)}
                                    disabled={settingBase === row.id}
                                  >
                                    {settingBase === row.id ? (
                                      <RefreshCw className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <Target className="h-4 w-4" />
                                    )}
                                  </Button>
                                )}
                                <Link to={`/map?aid=${row.strava_activity_id}`}>
                                  <Button variant="outline" size="sm">
                                    <Map className="h-4 w-4" />
                                  </Button>
                                </Link>
                              </>
                            )}
                          </div>
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
