import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { ArrowLeft, Target, Crown, Users, Clock, Map, Activity, Calendar, Gauge, Play } from 'lucide-react';
import { 
  Game,
  PlayerBase,
  getGamePlayerBases,
  setPlayerBase,
  getUserActivitiesForBase,
  startGame
} from '@/lib/leagues';
import { supabase } from '@/integrations/supabase/client';

interface GameWithLeague extends Game {
  league?: {
    name: string;
    admin_user_id: string;
  };
}

interface ActivityForBase {
  id: string;
  name: string;
  distance: number;
  moving_time: number;
  activity_type: string;
  start_date: string;
  strava_activity_id: number;
}

export default function GamePage() {
  const { gameId } = useParams<{ gameId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [game, setGame] = useState<GameWithLeague | null>(null);
  const [playerBases, setPlayerBases] = useState<PlayerBase[]>([]);
  const [userActivities, setUserActivities] = useState<ActivityForBase[]>([]);
  const [loading, setLoading] = useState(true);
  const [settingBase, setSettingBase] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<string>('');
  const [currentUserProfile, setCurrentUserProfile] = useState<string>('');

  const fetchGameData = async () => {
    if (!gameId) return;

    try {
      // Fetch game with league info
      const { data: gameData, error: gameError } = await supabase
        .from('games')
        .select(`
          *,
          leagues!games_league_id_fkey(name, admin_user_id)
        `)
        .eq('id', gameId)
        .single();

      if (gameError) throw gameError;

      const gameWithLeague: GameWithLeague = {
        ...gameData,
        league: gameData.leagues
      };

      setGame(gameWithLeague);

      // Get current user profile ID
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user?.id)
        .single();
      
      if (profile) {
        setCurrentUserProfile(profile.id);
      }

      // Fetch player bases
      const bases = await getGamePlayerBases(gameId);
      setPlayerBases(bases);

      // If game is in setup and user hasn't set base yet, fetch user activities
      if (gameData.status === 'setup') {
        const userBase = bases.find(base => base.user_id === profile?.id);
        if (!userBase) {
          const activities = await getUserActivitiesForBase();
          setUserActivities(activities);
        }
      }
    } catch (error) {
      console.error('Error fetching game data:', error);
      toast({
        title: "Error loading game",
        description: String(error),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user && gameId) {
      fetchGameData();
    }
  }, [user, gameId]);

  const handleSetBase = async () => {
    if (!selectedActivity || !gameId) return;

    setSettingBase(true);
    try {
      const result = await setPlayerBase(gameId, selectedActivity);

      if (result.success) {
        toast({
          title: "Base set successfully!",
          description: `${result.activity_name} is now your base`,
        });
        await fetchGameData(); // Refresh data
      } else {
        toast({
          title: "Error setting base",
          description: result.error,
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error setting base",
        description: String(error),
        variant: "destructive",
      });
    } finally {
      setSettingBase(false);
    }
  };

  const handleStartGameClick = async () => {
    if (!gameId) return;

    try {
      const result = await startGame(gameId);

      if (result.success) {
        toast({
          title: "Game started! 🎮",
          description: `30-day territorial competition with ${result.base_count} players begins now!`,
        });
        await fetchGameData(); // Refresh data
      } else {
        toast({
          title: "Error starting game",
          description: result.error,
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error starting game",
        description: String(error),
        variant: "destructive",
      });
    }
  };

  const formatDistance = (distance: number | null): string => {
    if (!distance || distance <= 0) return "0.00 km";
    const km = distance > 1000 ? distance / 1000 : distance;
    return `${km.toFixed(2)} km`;
  };

  const formatTime = (seconds: number | null): string => {
    if (!seconds) return "0m";
    const s = Math.max(0, seconds);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  const formatDate = (dateStr: string): string => {
    return new Date(dateStr).toLocaleDateString('da-DK', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getCurrentUserBase = () => {
    return playerBases.find(base => base.user_id === currentUserProfile);
  };

  const isGameAdmin = () => {
    return game?.league?.admin_user_id === currentUserProfile;
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <Play className="h-8 w-8 animate-pulse mx-auto mb-4 text-primary" />
            <p className="text-muted-foreground">Loading game...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (!game) {
    return (
      <Layout>
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold mb-4">Game not found</h2>
          <Button onClick={() => navigate('/leagues')}>
            Back to Leagues
          </Button>
        </div>
      </Layout>
    );
  }

  const currentUserBase = getCurrentUserBase();

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/leagues">
              <Button variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Leagues
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <Play className="h-8 w-8 text-primary" />
                {game.name}
              </h1>
              <p className="text-muted-foreground">
                {game.league?.name} • {playerBases.length} players
              </p>
            </div>
          </div>
          <Badge variant={
            game.status === 'active' ? 'default' :
            game.status === 'setup' ? 'secondary' : 'outline'
          } className="text-sm">
            {game.status}
          </Badge>
        </div>

        {/* Game Status */}
        {game.status === 'active' && (
          <Card className="border-green-200 bg-green-50">
            <CardContent className="pt-4">
              <div className="flex items-center gap-4">
                <Clock className="h-5 w-5 text-green-600" />
                <div>
                  <p className="font-medium text-green-800">Game Active</p>
                  <p className="text-sm text-green-600">
                    Ends: {new Date(game.end_date!).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {game.status === 'setup' && (
          <Card className="border-blue-200 bg-blue-50">
            <CardContent className="pt-4">
              <div className="flex items-center gap-4">
                <Target className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="font-medium text-blue-800">Setup Phase</p>
                  <p className="text-sm text-blue-600">
                    Players need to set their bases before the game can start
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Player Bases */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Player Bases
            </CardTitle>
            <CardDescription>
              Each player's starting territory base
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {playerBases.map((base) => (
                <div key={base.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Target className="h-5 w-5 text-primary" />
                    <div>
                      <p className="font-medium">{base.activity_name || 'Unnamed Activity'}</p>
                      <p className="text-sm text-muted-foreground">{base.user_email}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">{formatDate(base.base_date)}</p>
                    {base.territory_size_km2 > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {base.territory_size_km2.toFixed(2)} km² territory
                      </p>
                    )}
                  </div>
                </div>
              ))}
              {playerBases.length === 0 && (
                <p className="text-center text-muted-foreground py-4">
                  No bases set yet
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Base Selection (only in setup phase) */}
        {game.status === 'setup' && !currentUserBase && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Select Your Base
              </CardTitle>
              <CardDescription>
                Choose an activity as your territorial base. Only activities after this date will count in the game.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {userActivities.length === 0 ? (
                <div className="text-center py-6">
                  <Activity className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground mb-4">No activities found</p>
                  <p className="text-sm text-muted-foreground">
                    Import activities from Strava to set your base
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid gap-3 max-h-96 overflow-y-auto">
                    {userActivities.map((activity) => (
                      <div 
                        key={activity.id}
                        className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                          selectedActivity === activity.id 
                            ? 'border-primary bg-primary/5' 
                            : 'hover:bg-muted/50'
                        }`}
                        onClick={() => setSelectedActivity(activity.id)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`w-4 h-4 rounded-full border-2 ${
                              selectedActivity === activity.id
                                ? 'border-primary bg-primary'
                                : 'border-muted-foreground'
                            }`} />
                            <div>
                              <p className="font-medium">{activity.name}</p>
                              <p className="text-sm text-muted-foreground">
                                {activity.activity_type} • {formatDate(activity.start_date)}
                              </p>
                            </div>
                          </div>
                          <div className="text-right text-sm">
                            <p>{formatDistance(activity.distance)}</p>
                            <p className="text-muted-foreground">{formatTime(activity.moving_time)}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <Button 
                    onClick={handleSetBase}
                    disabled={!selectedActivity || settingBase}
                    className="w-full"
                  >
                    {settingBase ? 'Setting Base...' : 'Set as Base'}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Current User Base (if set) */}
        {currentUserBase && (
          <Card className="border-green-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-800">
                <Target className="h-5 w-5" />
                Your Base
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{currentUserBase.activity_name}</p>
                  <p className="text-sm text-muted-foreground">
                    Set on {formatDate(currentUserBase.base_date)}
                  </p>
                </div>
                {currentUserBase.territory_size_km2 > 0 && (
                  <div className="text-right">
                    <p className="font-medium">{currentUserBase.territory_size_km2.toFixed(2)} km²</p>
                    <p className="text-sm text-muted-foreground">Territory size</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Admin Controls */}
        {isGameAdmin() && game.status === 'setup' && playerBases.length >= 2 && (
          <Card className="border-blue-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Crown className="h-5 w-5" />
                Game Administration
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                {playerBases.length} players have set their bases. Ready to start the 30-day competition?
              </p>
              <Button onClick={handleStartGameClick}>
                <Play className="h-4 w-4 mr-2" />
                Start Game
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}