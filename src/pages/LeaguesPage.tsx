import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Navigate, Link, useNavigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { ArrowLeft, Plus, Users, Trophy, Key, Crown, Clock, Play } from 'lucide-react';
import { 
  League, 
  Game,
  getUserLeagues, 
  createLeague, 
  joinLeague, 
  getLeagueGames,
  createGame,
  startGame
} from '@/lib/leagues';

export default function LeaguesPage() {
  const { user, loading: authLoading } = useAuth();
  const [leagues, setLeagues] = useState<League[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [joinDialogOpen, setJoinDialogOpen] = useState(false);
  const [gameDialogOpen, setGameDialogOpen] = useState(false);
  const [selectedLeagueId, setSelectedLeagueId] = useState<string>('');
  const [games, setGames] = useState<Game[]>([]);
  const { toast } = useToast();
  const navigate = useNavigate();

  const [newLeague, setNewLeague] = useState({
    name: '',
    description: '',
    isPublic: false,
    maxMembers: 10
  });

  const [inviteCode, setInviteCode] = useState('');
  const [newGameName, setNewGameName] = useState('');

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  const fetchLeagues = async () => {
    try {
      const userLeagues = await getUserLeagues();
      setLeagues(userLeagues);
    } catch (error) {
      console.error('Error fetching leagues:', error);
      toast({
        title: "Error loading leagues",
        description: String(error),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchLeagueGames = async (leagueId: string) => {
    try {
      const leagueGames = await getLeagueGames(leagueId);
      setGames(leagueGames);
    } catch (error) {
      console.error('Error fetching games:', error);
      toast({
        title: "Error loading games",
        description: String(error),
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    fetchLeagues();
  }, []);

  const handleCreateLeague = async () => {
    if (!newLeague.name.trim()) {
      toast({
        title: "Name required",
        description: "Please enter a league name",
        variant: "destructive",
      });
      return;
    }

    try {
      const result = await createLeague(
        newLeague.name,
        newLeague.description || undefined,
        newLeague.isPublic,
        newLeague.maxMembers
      );

      if (result.success) {
        toast({
          title: "League created!",
          description: `Invite code: ${result.invite_code}`,
        });
        setCreateDialogOpen(false);
        setNewLeague({ name: '', description: '', isPublic: false, maxMembers: 10 });
        fetchLeagues();
      } else {
        toast({
          title: "Error creating league",
          description: result.error,
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error creating league",
        description: String(error),
        variant: "destructive",
      });
    }
  };

  const handleJoinLeague = async () => {
    if (!inviteCode.trim()) {
      toast({
        title: "Invite code required",
        description: "Please enter an invite code",
        variant: "destructive",
      });
      return;
    }

    try {
      const result = await joinLeague(inviteCode.trim());

      if (result.success) {
        toast({
          title: "League joined!",
          description: `${result.league_name} - Status: ${result.status}`,
        });
        setJoinDialogOpen(false);
        setInviteCode('');
        fetchLeagues();
      } else {
        toast({
          title: "Error joining league",
          description: result.error,
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error joining league",
        description: String(error),
        variant: "destructive",
      });
    }
  };

  const handleCreateGame = async () => {
    if (!newGameName.trim()) {
      toast({
        title: "Game name required",
        description: "Please enter a game name",
        variant: "destructive",
      });
      return;
    }

    try {
      const result = await createGame(selectedLeagueId, newGameName);

      if (result.success) {
        toast({
          title: "Game created!",
          description: `${result.game_name} with ${result.member_count} potential players`,
        });
        setGameDialogOpen(false);
        setNewGameName('');
        fetchLeagueGames(selectedLeagueId);
      } else {
        toast({
          title: "Error creating game",
          description: result.error,
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error creating game",
        description: String(error),
        variant: "destructive",
      });
    }
  };

  const handleStartGame = async (gameId: string) => {
    try {
      const result = await startGame(gameId);

      if (result.success) {
        toast({
          title: "Game started!",
          description: `30-day competition with ${result.base_count} players`,
        });
        fetchLeagueGames(selectedLeagueId);
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

  const openGameDialog = (leagueId: string) => {
    setSelectedLeagueId(leagueId);
    fetchLeagueGames(leagueId);
    setGameDialogOpen(true);
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <Trophy className="h-8 w-8 animate-pulse mx-auto mb-4 text-primary" />
            <p className="text-muted-foreground">Loading leagues...</p>
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
            <Link to="/">
              <Button variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Home
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <Trophy className="h-8 w-8 text-primary" />
                Territory Leagues
              </h1>
              <p className="text-muted-foreground">
                Join or create competitive running leagues
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Dialog open={joinDialogOpen} onOpenChange={setJoinDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Key className="h-4 w-4 mr-2" />
                  Join League
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Join a League</DialogTitle>
                  <DialogDescription>
                    Enter the invite code to join an existing league
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="inviteCode">Invite Code</Label>
                    <Input
                      id="inviteCode"
                      value={inviteCode}
                      onChange={(e) => setInviteCode(e.target.value)}
                      placeholder="Enter invite code"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setJoinDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleJoinLeague}>Join League</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Create League
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New League</DialogTitle>
                  <DialogDescription>
                    Set up a new competitive league for territorial battles
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="name">League Name</Label>
                    <Input
                      id="name"
                      value={newLeague.name}
                      onChange={(e) => setNewLeague({ ...newLeague, name: e.target.value })}
                      placeholder="Enter league name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="description">Description (optional)</Label>
                    <Input
                      id="description"
                      value={newLeague.description}
                      onChange={(e) => setNewLeague({ ...newLeague, description: e.target.value })}
                      placeholder="League description"
                    />
                  </div>
                  <div>
                    <Label htmlFor="maxMembers">Max Members</Label>
                    <Input
                      id="maxMembers"
                      type="number"
                      min="2"
                      max="20"
                      value={newLeague.maxMembers}
                      onChange={(e) => setNewLeague({ ...newLeague, maxMembers: parseInt(e.target.value) || 10 })}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreateLeague}>Create League</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Leagues Grid */}
        {leagues.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <Trophy className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold text-muted-foreground mb-2">
                No leagues found
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                Create a new league or join an existing one to start competing
              </p>
              <div className="flex gap-2 justify-center">
                <Button onClick={() => setCreateDialogOpen(true)}>
                  Create League
                </Button>
                <Button variant="outline" onClick={() => setJoinDialogOpen(true)}>
                  Join League
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {leagues.map((league) => (
              <Card key={league.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="flex items-center gap-2">
                        <Trophy className="h-5 w-5" />
                        {league.name}
                        {league.is_admin && (
                          <Badge variant="secondary">
                            <Crown className="h-3 w-3 mr-1" />
                            Admin
                          </Badge>
                        )}
                      </CardTitle>
                      <CardDescription className="mt-1">
                        {league.description || 'No description'}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-1">
                        <Users className="h-4 w-4" />
                        Members
                      </span>
                      <span className="font-medium">
                        {league.member_count} / {league.max_members}
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between text-sm">
                      <span>Invite Code</span>
                      <Badge variant="outline" className="font-mono text-xs">
                        {league.invite_code}
                      </Badge>
                    </div>

                    <div className="flex gap-2 pt-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => navigate(`/leagues/${league.id}`)}
                        className="flex-1"
                      >
                        <Users className="h-4 w-4 mr-1" />
                        Members
                      </Button>
                      {league.is_admin && (
                        <Button 
                          size="sm" 
                          onClick={() => openGameDialog(league.id)}
                          className="flex-1"
                        >
                          <Play className="h-4 w-4 mr-1" />
                          Games
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Games Dialog */}
        <Dialog open={gameDialogOpen} onOpenChange={setGameDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>League Games</DialogTitle>
              <DialogDescription>
                Manage games for this league
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex gap-2">
                <Input
                  value={newGameName}
                  onChange={(e) => setNewGameName(e.target.value)}
                  placeholder="Enter game name"
                  className="flex-1"
                />
                <Button onClick={handleCreateGame}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Game
                </Button>
              </div>

              <div className="space-y-2 max-h-96 overflow-y-auto">
                {games.map((game) => (
                  <Card key={game.id}>
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium">{game.name}</h4>
                          <p className="text-sm text-muted-foreground flex items-center gap-2">
                            <Badge variant={
                              game.status === 'active' ? 'default' :
                              game.status === 'setup' ? 'secondary' : 'outline'
                            }>
                              {game.status}
                            </Badge>
                            {game.status === 'active' && (
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                Ends: {new Date(game.end_date!).toLocaleDateString()}
                              </span>
                            )}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">
                            {game.bases_set} bases set
                          </span>
                          {game.status === 'setup' && game.bases_set && game.bases_set >= 2 && (
                            <Button size="sm" onClick={() => handleStartGame(game.id)}>
                              <Play className="h-4 w-4 mr-1" />
                              Start
                            </Button>
                          )}
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => navigate(`/games/${game.id}`)}
                          >
                            View
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {games.length === 0 && (
                  <p className="text-center text-muted-foreground py-8">
                    No games created yet
                  </p>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setGameDialogOpen(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}