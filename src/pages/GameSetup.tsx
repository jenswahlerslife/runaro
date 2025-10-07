import { useEffect, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { invokeWithAuth } from "@/lib/function-helpers";
import { useAuth } from "@/hooks/useAuth";
import { rpcGetGameOverview, setPlayerBase } from "@/lib/gamesApi";
import { getUserActivitiesWithTerritory } from "@/lib/territory";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import Layout from "@/components/Layout";
import Map from "@/components/Map";
import { ArrowLeft, Target, Activity, Clock, Map as MapIcon, CheckCircle, AlertCircle, Users, Trophy, RefreshCw, Calendar, Gauge } from "lucide-react";
import { Link } from "react-router-dom";

type ActivityRow = {
  id: string;
  name: string;
  distance: number | null;
  moving_time: number | null;
  activity_type: string | null;
  start_date: string;
  strava_activity_id: number;
  is_base: boolean;
  included_in_game: boolean;
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
  const km = distanceValue > 1000 ? distanceValue / 1000 : distanceValue;
  return `${km.toFixed(2)} km`;
}

function formatPaceMinPerKm(movingSec: number | null, distanceValue: number | null): string {
  if (!movingSec || movingSec <= 0 || !distanceValue || distanceValue <= 0) return "–";
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

export default function GameSetup() {
  // Match React Router route `/games/:gameId/setup`
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, loading: authLoading } = useAuth();

  const [gameData, setGameData] = useState<any>(null);
  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [settingBase, setSettingBase] = useState<string | null>(null);
  const [hasStravaConnection, setHasStravaConnection] = useState<boolean | null>(null);
  const [importingActivities, setImportingActivities] = useState(false);

  // Selected preview activity (by Strava activity id) controls the map focus via URL params
  const selectedAid = searchParams.get("aid");

  // Derive status safely (may be undefined during initial renders)
  const gameStatus = gameData?.meta?.status as 'setup' | 'active' | 'finished' | 'cancelled' | undefined;

  // Removed redirect - GameSetup now handles base selection directly

  // IMPORTANT: Hooks must not be conditional. This effect must be declared
  // before any early returns so the hook order remains stable across renders.
  useEffect(() => {
    if (!gameId) return;
    if (gameStatus === 'active' || gameStatus === 'finished') {
      navigate(`/games/${gameId}`);
    }
  }, [gameStatus, gameId, navigate]);

  // Check Strava connection status
  useEffect(() => {
    const checkStravaConnection = async () => {
      if (!user) return;

      try {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('strava_access_token')
          .eq('user_id', user.id)
          .maybeSingle();

        if (error) throw error;
        setHasStravaConnection(!!profile?.strava_access_token);
      } catch (error) {
        console.error('Error checking Strava connection:', error);
        setHasStravaConnection(false);
      }
    };

    checkStravaConnection();
  }, [user]);

  // Load game data and activities
  useEffect(() => {
    if (!gameId) return;

    // Wait for auth to finish loading
    if (authLoading) {
      return;
    }

    // If no user after auth has loaded, redirect to login
    if (!user) {
      setLoading(false);
      setError("Du skal være logget ind for at deltage i spil. Vender tilbage til login...");
      setTimeout(() => {
        navigate('/auth?redirect=' + encodeURIComponent(window.location.pathname));
      }, 2000);
      return;
    }

    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        // Load game overview
        const overview = await rpcGetGameOverview(gameId);

        // Check if overview has an error
        if (overview && overview.error) {
          throw new Error(overview.error);
        }

        setGameData(overview);

        // Load user activities
        const userActivities = await getUserActivitiesWithTerritory();
        setActivities(
          userActivities.map((d: any) => ({
            id: d.id,
            name: d.name ?? "Unavngivet aktivitet",
            distance: typeof d.distance === "number" ? d.distance : (d.distance ?? 0),
            moving_time: d.moving_time ?? 0,
            activity_type: d.activity_type ?? "Run",
            start_date: d.start_date,
            strava_activity_id: d.strava_activity_id,
            is_base: d.is_base ?? false,
            included_in_game: d.included_in_game ?? true,
          }))
        );
      } catch (error: any) {
        console.error('Error loading data:', error);
        setError(error.message || 'Kunne ikke indlæse spildata');
        toast.error(error.message || 'Kunne ikke indlæse spildata');
      } finally {
        setLoading(false);
      }
    };

    loadData();

    // Enhanced real-time updates for comprehensive game monitoring
    const channel = supabase
      .channel(`game_setup_${gameId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'games',
        filter: `id=eq.${gameId}`
      }, (payload) => {
        console.log('Game status updated:', payload);
        loadData(); // Reload data when game status changes
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'player_bases',
        filter: `game_id=eq.${gameId}`
      }, (payload) => {
        console.log('Player base updated:', payload);
        loadData(); // Reload data when bases change
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'territory_ownership',
        filter: `game_id=eq.${gameId}`
      }, (payload) => {
        console.log('Territory ownership updated:', payload);
        loadData(); // Reload data when territory changes
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'activities'
      }, (payload) => {
        // Reload if activity might affect this user's game participation
        if (payload.new?.user_id === user?.id) {
          console.log('User activity updated:', payload);
          loadData();
        }
      })
      .subscribe((status) => {
        console.log('GameSetup realtime subscription status:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [gameId, user, authLoading, navigate]);

  const handleSetBase = async (activityId: string) => {
    if (!gameId) return;

    setSettingBase(activityId);
    try {
      const result = await setPlayerBase(gameId, activityId);

      if (!result?.success) {
        throw new Error(result?.error || "Kunne ikke sætte base");
      }

      toast.success("Base sat med succes! Tjekker om spillet kan aktiveres...");

      // Check if game was activated
      const activationResult = result.activation_result;
      if (activationResult?.activated) {
        toast.success("Spil aktiveret! Alle spillere har sat deres baser. Omdirigerer til live spil...");
        setTimeout(() => {
          navigate(`/games/${gameId}`);
        }, 2000);
      } else {
        const memberCount = activationResult?.member_count ?? gameData?.counts?.member_count ?? 0;
        const playersWithBases = activationResult?.players_with_bases ?? gameData?.counts?.base_count ?? 0;
        const remaining = Math.max(0, memberCount - playersWithBases);
        console.debug('Base set activation status', {
          memberCount,
          playersWithBases,
          remaining,
          rawActivationResult: activationResult
        });
        toast.info(
          remaining > 0
            ? `Base sat. Venter på at ${remaining} flere spillere sætter deres baser.`
            : "Base sat. Afventer spilaktivering fra serveren."
        );
        // Reload game data to update UI
        const overview = await rpcGetGameOverview(gameId);
        setGameData(overview);
      }
    } catch (error: any) {
      console.error('Error setting base:', error);
      toast.error(error?.message || "Kunne ikke sætte base");
    } finally {
      setSettingBase(null);
    }
  };

  const handleConnectStrava = () => {
    navigate(`/strava/connect?return=${encodeURIComponent(`/games/${gameId}/setup`)}`);
  };

  const handleImportActivities = async () => {
    setImportingActivities(true);
    try {
      // Use the helper function for proper JWT handling and error messages
      const { data: result, error } = await invokeWithAuth<{
        success: boolean;
        inserted_count: number;
        already_present: number;
        total_running_activities: number;
      }>('import-recent-activities', { limit: 20 });

      if (error || !result?.success) {
        throw new Error(result?.error || error?.message || 'Failed to import activities');
      }

      toast.success(
        `Importerede ${result.inserted_count} nye aktiviteter (${result.already_present} allerede tilstede)`
      );

      // Reload activities
      const userActivities = await getUserActivitiesWithTerritory();
      setActivities(
        userActivities.map((d: any) => ({
          id: d.id,
          name: d.name ?? "Unavngivet aktivitet",
          distance: typeof d.distance === "number" ? d.distance : (d.distance ?? 0),
          moving_time: d.moving_time ?? 0,
          activity_type: d.activity_type ?? "Run",
          start_date: d.start_date,
          strava_activity_id: d.strava_activity_id,
          is_base: d.is_base ?? false,
          included_in_game: d.included_in_game ?? true,
        }))
      );
    } catch (error: any) {
      console.error('Error importing activities:', error);
      toast.error(error.message || 'Kunne ikke importere aktiviteter');
    } finally {
      setImportingActivities(false);
    }
  };

  // Preview a route on the map by updating query params the Map component listens to
  const handlePreviewRoute = (stravaActivityId: number) => {
    // Animate the route draw the first time a user clicks a card
    setSearchParams({ aid: String(stravaActivityId), animate: "true" });
  };

  if (!user) {
    return <div>Not authenticated</div>;
  }

  // Show error state if there's an error
  if (error && !loading) {
    return (
      <Layout>
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <Link to="/leagues">
              <Button variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Tilbage til Ligaer
              </Button>
            </Link>
          </div>

          <Card className="border-red-200 bg-red-50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <AlertCircle className="h-8 w-8 text-red-600" />
                <div>
                  <h2 className="text-xl font-semibold text-red-900">Spil Setup Fejl</h2>
                  <p className="text-red-700 mt-1">{error}</p>
                  <Button
                    onClick={() => window.location.reload()}
                    variant="outline"
                    size="sm"
                    className="mt-3"
                  >
                    Try Again
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  // Show loading state
  if (loading || !gameData) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <Trophy className="h-8 w-8 animate-pulse mx-auto mb-4 text-primary" />
            <p className="text-muted-foreground">Indlæser spil setup...</p>
            {loading && !gameData && (
              <p className="text-xs text-muted-foreground/70 mt-2">
                Fetching game data... ({gameId})
              </p>
            )}
          </div>
        </div>
      </Layout>
    );
  }

  const baseCount = gameData.counts?.base_count || 0;
  const memberCount = gameData.counts?.member_count || 0;

  if (!gameData) {
    return (
      <Layout>
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold mb-4">Spil Ikke Fundet</h2>
          <p className="text-muted-foreground mb-4">Dette spil eksisterer ikke, eller du har ikke adgang til det.</p>
          <Link to="/leagues">
            <Button>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Leagues
            </Button>
          </Link>
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
            <Link to="/leagues">
              <Button variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Tilbage til Ligaer
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <Target className="h-8 w-8 text-primary" />
                Sæt Din Base
              </h1>
              <p className="text-muted-foreground">
                Vælg en aktivitet som din startbase for dette spil
              </p>
            </div>
          </div>
          <Badge variant="secondary" className="text-sm">
            Setup Fase
          </Badge>
        </div>

        {/* Game Status Card */}
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-blue-100">
                  <Users className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-blue-900">
                    Waiting for bases: {baseCount}/{memberCount}
                  </h3>
                  <p className="text-sm text-blue-700">
                    The game will automatically start when all {memberCount} players have set their base
                  </p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-blue-900">{gameData.meta?.duration_days || 14}</div>
                <div className="text-xs text-blue-700">days duration</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Main Layout: Map on left, Activity selection on right */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 min-h-[600px]">
          {/* Left Side: Territory Map */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapIcon className="h-5 w-5" />
                Territory Preview
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Your current territory and potential base locations
              </p>
            </CardHeader>
            <CardContent className="p-0">
              <div className="h-[500px] rounded-lg overflow-hidden">
                <Map />
              </div>
            </CardContent>
          </Card>

          {/* Right Side: Activity Selection */}
          <div className="space-y-4">
            {/* Strava Connection Check */}
            {hasStravaConnection === false && (
              <Alert>
                <Activity className="h-4 w-4" />
                <AlertDescription>
                  <div className="flex items-center justify-between">
                    <div>
                      <strong>Strava Connection Required</strong>
                      <br />
                      You need to connect your Strava account to access your activities.
                    </div>
                    <Button onClick={handleConnectStrava} size="sm">
                      Connect Strava
                    </Button>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {/* Activities List */}
            {hasStravaConnection && (
              <>
                {activities.filter(a => a.included_in_game).length === 0 ? (
                  <Card>
                    <CardContent className="py-8 text-center">
                      <Activity className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                      <h3 className="text-lg font-semibold text-muted-foreground mb-2">
                        Ingen Aktiviteter Fundet
                      </h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        Importer dine seneste løbeaktiviteter fra Strava for at vælge din base
                      </p>
                      <Button
                        onClick={handleImportActivities}
                        disabled={importingActivities}
                        size="lg"
                      >
                        {importingActivities ? (
                          <>
                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                            Importerer...
                          </>
                        ) : (
                          <>
                            <Activity className="h-4 w-4 mr-2" />
                            Hent Aktiviteter
                          </>
                        )}
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="flex items-center gap-2">
                            <Activity className="h-5 w-5" />
                            Vælg Din Base Aktivitet
                          </CardTitle>
                          <p className="text-sm text-muted-foreground">
                            Vælg en aktivitet, der vil definere dit startterritorium og baseline dato
                          </p>
                        </div>
                        <Button
                          onClick={handleImportActivities}
                          disabled={importingActivities}
                          variant="outline"
                          size="sm"
                        >
                          {importingActivities ? (
                            <RefreshCw className="h-4 w-4 animate-spin" />
                          ) : (
                            <RefreshCw className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3 max-h-[400px] overflow-y-auto">
                        {activities
                          .filter(activity => activity.included_in_game) // Only show activities that are part of territory
                          .map((activity) => (
                          <div
                            key={activity.id}
                            className={`p-4 border rounded-lg transition-all duration-200 ease-out cursor-pointer hover:-translate-y-0.5 hover:shadow-lg hover:ring-2 hover:ring-blue-500/40 active:scale-[.99] ${
                              selectedAid && String(activity.strava_activity_id) === selectedAid
                                ? "ring-2 ring-blue-600 shadow-lg shadow-blue-600/10 bg-blue-50 dark:bg-blue-900/20"
                                : ""
                            }`}
                            onClick={() => handlePreviewRoute(activity.strava_activity_id)}
                            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handlePreviewRoute(activity.strava_activity_id)}
                            role="button"
                            tabIndex={0}
                          >
                            <div className="space-y-3">
                              <div className="flex items-center gap-2">
                                <h3 className="font-medium flex-1">{activity.name}</h3>
                                <Badge variant="outline" className="text-xs">
                                  {activity.activity_type}
                                </Badge>
                                <Badge variant="default" className="text-xs">
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  In Territory
                                </Badge>
                              </div>
                              <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground">
                                <div className="flex items-center gap-1">
                                  <Calendar className="h-4 w-4" />
                                  {formatDate(activity.start_date)}
                                </div>
                                <div className="flex items-center gap-1">
                                  <Activity className="h-4 w-4" />
                                  {formatKm(activity.distance)}
                                </div>
                                <div className="flex items-center gap-1">
                                  <Clock className="h-4 w-4" />
                                  {formatTimeSec(activity.moving_time)}
                                </div>
                                <div className="flex items-center gap-1">
                                  <Gauge className="h-4 w-4" />
                                  {formatPaceMinPerKm(activity.moving_time, activity.distance)}
                                </div>
                              </div>
                              <Button
                                onClick={(e) => { e.stopPropagation(); handleSetBase(activity.id); }}
                                disabled={settingBase === activity.id}
                                size="sm"
                                className="w-full"
                              >
                                {settingBase === activity.id ? (
                                  <>
                                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                                    Sætter...
                                  </>
                                ) : (
                                  <>
                                    <Target className="h-4 w-4 mr-2" />
                                    Sæt som Base
                                  </>
                                )}
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </div>
        </div>

        {/* Instructions */}
        <Card className="border-yellow-200 bg-yellow-50">
          <CardHeader>
            <CardTitle className="text-sm text-yellow-800 flex items-center gap-2">
              <Target className="h-4 w-4" />
              Sådan Fungerer Base Valg
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-yellow-700 space-y-2">
            <ul className="list-disc list-inside space-y-1">
              <li>Din base aktivitet definerer dit startterritorium og baseline dato</li>
              <li>Vælg en aktivitet, der repræsenterer en god central placering for din strategi</li>
              <li>Kun aktiviteter inden for dit territorium kan vælges som base</li>
              <li>Spillet starter automatisk, når alle {memberCount} spillere har sat deres base</li>
              <li>Du kan ændre dit base valg, indtil spillet aktiveres</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
