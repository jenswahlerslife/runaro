import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { rpcGetGameOverview, rpcGetPlayerStats } from "@/lib/gamesApi";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import Layout from "@/components/Layout";
import Map from "@/components/Map";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowLeft, Trophy, Clock, Users, Target, Activity, Map as MapIcon } from "lucide-react";
import { Link } from "react-router-dom";

function StravaConnectedButton({ gameId }: { gameId: string }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [checkingStrava, setCheckingStrava] = useState(false);
  const [hasStravaConnection, setHasStravaConnection] = useState<boolean | null>(null);

  useEffect(() => {
    checkStravaConnection();
  }, [user]);

  const checkStravaConnection = async () => {
    if (!user) return;

    try {
      setCheckingStrava(true);
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('strava_access_token')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;

      const connected = !!profile?.strava_access_token;
      setHasStravaConnection(connected);
    } catch (error) {
      console.error('Error checking Strava connection:', error);
      setHasStravaConnection(false);
    } finally {
      setCheckingStrava(false);
    }
  };

  const handleBaseSelection = () => {
    if (hasStravaConnection === null || checkingStrava) return;

    if (!hasStravaConnection) {
      navigate(`/strava/connect?return=${encodeURIComponent(`/games/${gameId}/setup`)}`);
      return;
    }

    navigate(`/games/${gameId}/setup`);
  };

  if (checkingStrava) {
    return (
      <Button size="sm" disabled className="ml-4">
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
        Tjekker...
      </Button>
    );
  }

  return (
    <Button
      size="sm"
      onClick={handleBaseSelection}
      className="ml-4"
    >
      <Target className="h-4 w-4 mr-2" />
      Vælg din base
    </Button>
  );
}

function useGameOverview(gameId: string | undefined) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<any>(null);

  async function load() {
    if (!gameId) return;
    setLoading(true);
    try {
      const d = await rpcGetGameOverview(gameId);
      setData(d);
      setErr(null);
    } catch (e) {
      setErr(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!gameId) return;
    load();

    // Enhanced realtime: listen to all game-related changes
    const gameChannel = supabase
      .channel(`game_updates_${gameId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'games',
        filter: `id=eq.${gameId}`
      }, (payload) => {
        console.log('Game update received:', payload);
        load();
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'player_bases',
        filter: `game_id=eq.${gameId}`
      }, (payload) => {
        console.log('Player base update received:', payload);
        load();
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'territory_ownership',
        filter: `game_id=eq.${gameId}`
      }, (payload) => {
        console.log('Territory update received:', payload);
        load();
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'activities'
      }, (payload) => {
        // Only reload if activity affects this game (check if user is in this game)
        console.log('Activity update received:', payload);
        load();
      })
      .subscribe((status) => {
        console.log('Realtime subscription status:', status);
      });

    return () => {
      console.log('Cleaning up realtime subscriptions');
      supabase.removeChannel(gameChannel);
    };
  }, [gameId]);

  return { data, loading, err, reload: load };
}

function useCountdown(endIso?: string | null) {
  const [now, setNow] = useState<number>(Date.now());
  useEffect(() => {
    if (!endIso) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [endIso]);
  return useMemo(() => {
    if (!endIso) return null;
    const remainingMs = new Date(endIso).getTime() - now;
    const clamped = Math.max(0, remainingMs);
    const s = Math.floor(clamped / 1000);
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return { d, h, m, s: sec, ms: clamped, isOver: remainingMs <= 0 };
  }, [endIso, now]);
}

export default function GamePage() {
  // Match React Router route `/games/:gameId`
  const { gameId } = useParams<{ gameId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data, loading, err } = useGameOverview(gameId!);
  const countdown = useCountdown(data?.meta?.end_date);
  const timeLeftSeconds = data?.meta?.time_left_seconds;

  const status = data?.meta?.status;
  const needBases = status === "setup";
  const finished = status === "finished";

  const [stats, setStats] = useState<{ total_distance_km: number; total_moving_time_s: number }>({ total_distance_km: 0, total_moving_time_s: 0 });

  useEffect(() => {
    if (!gameId || !user?.id) return;
    rpcGetPlayerStats(gameId, user.id).then(setStats).catch(() => {});
  }, [gameId, user?.id, data?.meta?.end_date, data?.meta?.start_date]);

  const getStatusBadge = (status: string) => {
    const statusMap = {
      setup: { label: 'Opsætning', variant: 'secondary' as const, color: 'text-blue-600' },
      active: { label: 'Aktiv', variant: 'default' as const, color: 'text-green-600' },
      finished: { label: 'Afsluttet', variant: 'outline' as const, color: 'text-gray-600' },
      cancelled: { label: 'Annulleret', variant: 'destructive' as const, color: 'text-red-600' },
    };
    return statusMap[status as keyof typeof statusMap] || statusMap.setup;
  };

  const formatTimeHours = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}t ${minutes}m`;
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <Trophy className="h-8 w-8 animate-pulse mx-auto mb-4 text-primary" />
            <p className="text-muted-foreground">Henter spil...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (err) {
    return (
      <Layout>
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold mb-4">Fejl ved indlæsning</h2>
          <p className="text-muted-foreground mb-4">{String(err.message || err)}</p>
          <Button onClick={() => navigate('/leagues')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Tilbage til Ligaer
          </Button>
        </div>
      </Layout>
    );
  }

  const statusConfig = getStatusBadge(status);

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
                <Trophy className="h-8 w-8 text-primary" />
                Spil
              </h1>
              <p className="text-muted-foreground">
                {data?.counts.member_count} spillere deltager
              </p>
            </div>
          </div>
          <Badge variant={statusConfig.variant} className="text-sm">
            {statusConfig.label}
          </Badge>
        </div>

        {/* Status Cards */}
        {needBases && (
          <Alert>
            <Target className="h-4 w-4" />
            <AlertDescription>
              <div className="flex items-center justify-between">
                <div>
                  <strong>Venter på baser: {data.counts.base_count}/{data.counts.member_count}</strong>
                  <br />
                  Spillet startes automatisk når alle spillere har valgt deres base.
                </div>
                <StravaConnectedButton gameId={gameId!} />
              </div>
            </AlertDescription>
          </Alert>
        )}

        {status === "active" && (countdown || timeLeftSeconds !== null) && (
          <Card className="border-green-200 bg-green-50">
            <CardContent className="pt-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-xs text-green-700 mb-1">Time remaining</div>
                  <div className="text-2xl font-bold text-green-800 tabular-nums">
                    {countdown && countdown.ms > 0 ? (
                      `${countdown.d}d ${countdown.h}t ${countdown.m}m ${countdown.s}s`
                    ) : timeLeftSeconds && timeLeftSeconds > 0 ? (
                      (() => {
                        const d = Math.floor(timeLeftSeconds / 86400);
                        const h = Math.floor((timeLeftSeconds % 86400) / 3600);
                        const m = Math.floor((timeLeftSeconds % 3600) / 60);
                        const s = timeLeftSeconds % 60;
                        return `${d}d ${h}t ${m}m ${s}s`;
                      })()
                    ) : (
                      "Game Ended"
                    )}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-green-700 mb-1">Total distance</div>
                  <div className="text-2xl font-bold text-green-800">{stats.total_distance_km.toFixed(2)} km</div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-green-700 mb-1">Time spent</div>
                  <div className="text-2xl font-bold text-green-800">
                    {formatTimeHours(stats.total_moving_time_s)}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {finished && (
          <Alert>
            <Trophy className="h-4 w-4" />
            <AlertDescription>
              <strong>Spillet er afsluttet!</strong>
              {data.meta.winner_user_id ? (
                <> Vinder: <span className="font-semibold">{data.meta.winner_user_id}</span></>
              ) : (
                " Vinder afventer serverberegning."
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* Main Layout: Map on left, Game info on right */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-[600px]">
          {/* Left Side: Territory Map (2/3 width) */}
          <div className="lg:col-span-2">
            <Card className="h-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapIcon className="h-5 w-5" />
                  Live Territory Map
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Real-time view of player territories and activity
                </p>
              </CardHeader>
              <CardContent className="p-0">
                <div className="h-[500px] rounded-lg overflow-hidden">
                  <Map />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Side: Game Stats & Leaderboard (1/3 width) */}
          <div className="space-y-4">
            {/* Stats - kun vis hvis aktiv eller afsluttet */}
            {(status === "active" || finished) && (
              <div className="space-y-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Varighed</CardTitle>
                    <Clock className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{data.meta.duration_days || 14} dage</div>
                    <p className="text-xs text-muted-foreground">
                      Spil længde
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Deltagere</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{data.counts.member_count}</div>
                    <p className="text-xs text-muted-foreground">
                      Spillere i spillet
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Min Distance</CardTitle>
                    <Activity className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats.total_distance_km.toFixed(1)} km</div>
                    <p className="text-xs text-muted-foreground">
                      Total løbet
                    </p>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Leaderboard */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="h-5 w-5" />
                  Leaderboard (størst areal)
                </CardTitle>
                <CardDescription>
                  Rangering baseret på erobret territory
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {data.leaderboard.map((row: any, i: number) => (
                    <div key={row.user_id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                          i === 0 ? 'bg-yellow-100 text-yellow-800' :
                          i === 1 ? 'bg-gray-100 text-gray-800' :
                          i === 2 ? 'bg-orange-100 text-orange-800' :
                          'bg-muted text-muted-foreground'
                        }`}>
                          {i + 1}
                        </div>
                        <div>
                          <p className="font-medium text-sm">{row.username || row.user_id}</p>
                          {i === 0 && finished && (
                            <Badge variant="default" className="text-xs mt-1">
                              <Trophy className="h-3 w-3 mr-1" />
                              Vinder
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold">{row.area_km2.toFixed(2)} km²</p>
                        <p className="text-xs text-muted-foreground">Territory</p>
                      </div>
                    </div>
                  ))}
                  {data.leaderboard.length === 0 && (
                    <div className="text-center py-8">
                      <MapIcon className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                      <p className="text-muted-foreground mb-2">Ingen territory-data endnu</p>
                      <p className="text-sm text-muted-foreground">
                        Territory data vil vises når spillere begynder at løbe
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Debug Info - kun i development */}
            {process.env.NODE_ENV === 'development' && (
              <Card className="border-yellow-200 bg-yellow-50">
                <CardHeader>
                  <CardTitle className="text-sm text-yellow-800">Debug Info</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-yellow-700">
                  <pre>{JSON.stringify(data, null, 2)}</pre>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
