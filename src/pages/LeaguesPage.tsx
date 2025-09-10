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
import { ArrowLeft, Plus, Users, Trophy, Key, Crown, Clock, Play, Bell } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import LeagueDirectory from '@/components/leagues/LeagueDirectory';
import AdminRequestPanel from '@/components/leagues/AdminRequestPanel';
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
  const [requestPanelOpen, setRequestPanelOpen] = useState(false);
  const [selectedLeagueId, setSelectedLeagueId] = useState<string>('');
  const [selectedLeagueName, setSelectedLeagueName] = useState<string>('');
  const [games, setGames] = useState<Game[]>([]);
  const [adminLeagues, setAdminLeagues] = useState<League[]>([]);
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
      
      // Filter admin leagues for request counting
      const adminLeaguesList = userLeagues.filter(league => league.is_admin);
      setAdminLeagues(adminLeaguesList);
    } catch (error) {
      console.error('Error fetching leagues:', error);
      toast({
        title: "Fejl ved indlæsning af ligaer",
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

  // Get total pending requests count for all admin leagues
  const { data: totalPendingCount = 0 } = useQuery({
    queryKey: ['admin-pending-count'],
    queryFn: async () => {
      if (adminLeagues.length === 0) return 0;
      
      let totalCount = 0;
      for (const league of adminLeagues) {
        const { data, error } = await supabase.rpc('get_admin_pending_requests_count', {
          league_id: league.id
        });
        if (!error && typeof data === 'number') {
          totalCount += data;
        }
      }
      return totalCount;
    },
    enabled: adminLeagues.length > 0,
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  useEffect(() => {
    fetchLeagues();
  }, []);

  const handleCreateLeague = async () => {
    if (!newLeague.name.trim()) {
      toast({
        title: "Navn påkrævet",
        description: "Indtast venligst et navn til ligaen",
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
          title: "Liga oprettet!",
          description: `Invitationskode: ${result.invite_code}`,
        });
        setCreateDialogOpen(false);
        setNewLeague({ name: '', description: '', isPublic: false, maxMembers: 10 });
        fetchLeagues();
      } else {
        toast({
          title: "Fejl ved oprettelse af liga",
          description: result.error,
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Fejl ved oprettelse af liga",
        description: String(error),
        variant: "destructive",
      });
    }
  };

  const handleJoinLeague = async () => {
    if (!inviteCode.trim()) {
      toast({
        title: "Invitationskode påkrævet",
        description: "Indtast venligst en invitationskode",
        variant: "destructive",
      });
      return;
    }

    try {
      const result = await joinLeague(inviteCode.trim());

      if (result.success) {
        toast({
          title: "Tilmeldt liga!",
          description: `${result.league_name} - Status: ${result.status}`,
        });
        setJoinDialogOpen(false);
        setInviteCode('');
        fetchLeagues();
      } else {
        toast({
          title: "Fejl ved tilmelding til liga",
          description: result.error,
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Fejl ved tilmelding til liga",
        description: String(error),
        variant: "destructive",
      });
    }
  };

  const handleCreateGame = async () => {
    if (!newGameName.trim()) {
      toast({
        title: "Spilnavn påkrævet",
        description: "Indtast venligst et navn til spillet",
        variant: "destructive",
      });
      return;
    }

    try {
      const result = await createGame(selectedLeagueId, newGameName);

      if (result.success) {
        toast({
          title: "Spil oprettet!",
          description: `${result.game_name} med ${result.member_count} potentielle spillere`,
        });
        setGameDialogOpen(false);
        setNewGameName('');
        fetchLeagueGames(selectedLeagueId);
      } else {
        toast({
          title: "Fejl ved oprettelse af spil",
          description: result.error,
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Fejl ved oprettelse af spil",
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
          title: "Spil startet!",
          description: `30-dages konkurrence med ${result.base_count} spillere`,
        });
        fetchLeagueGames(selectedLeagueId);
      } else {
        toast({
          title: "Fejl ved start af spil",
          description: result.error,
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Fejl ved start af spil",
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

  const openRequestPanel = (leagueId: string, leagueName: string) => {
    setSelectedLeagueId(leagueId);
    setSelectedLeagueName(leagueName);
    setRequestPanelOpen(true);
  };

  const openRequestPanelForAll = () => {
    // For multi-league admin panel, use first admin league as primary
    if (adminLeagues.length > 0) {
      setSelectedLeagueId(adminLeagues[0].id);
      setSelectedLeagueName('Alle ligaer');
      setRequestPanelOpen(true);
    }
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
        <div className="space-y-6">
          {/* Back button */}
          <div className="flex justify-start">
            <Link to="/">
              <Button variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Home
              </Button>
            </Link>
          </div>

          {/* Centered Title */}
          <div className="text-center">
            <h1 className="text-3xl font-bold flex items-center justify-center gap-2 mb-2">
              <Trophy className="h-8 w-8 text-primary" />
              Territory Leagues
            </h1>
            <p className="text-muted-foreground">
              Join or create competitive running leagues
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 justify-center">
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

        {/* Admin Request Bar */}
        {adminLeagues.length > 0 && totalPendingCount > 0 && (
          <Card className="bg-yellow-50 border-yellow-200 dark:bg-yellow-950/20 dark:border-yellow-900/30">
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
                    <Bell className="h-4 w-4 text-yellow-600 dark:text-yellow-500" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-yellow-800 dark:text-yellow-300">
                      Ventende anmodninger
                    </h3>
                    <p className="text-sm text-yellow-700 dark:text-yellow-400">
                      Du har {totalPendingCount} ventende anmodning{totalPendingCount !== 1 ? 'er' : ''} til dine ligaer
                    </p>
                  </div>
                </div>
                <Button 
                  onClick={openRequestPanelForAll}
                  className="bg-yellow-600 hover:bg-yellow-700 text-white"
                >
                  <Bell className="h-4 w-4 mr-2" />
                  Se anmodninger ({totalPendingCount})
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

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
                          <button
                            onClick={() => navigate(`/leagues/${league.id}/members`)}
                            className="relative inline-flex items-center justify-center p-1 rounded hover:bg-blue-50 transition-colors"
                            title={`Admin panel ${league.pending_requests_count ? `- ${league.pending_requests_count} pending requests` : ''}`}
                          >
                            <Crown className="h-4 w-4 text-blue-600" />
                            {league.pending_requests_count && league.pending_requests_count > 0 && (
                              <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
                                {league.pending_requests_count > 9 ? '9+' : league.pending_requests_count}
                              </span>
                            )}
                          </button>
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
                        onClick={() => navigate(`/leagues/${league.id}/members`)}
                        className="flex-1 relative"
                      >
                        <Users className="h-4 w-4 mr-1" />
                        Members
                        {league.is_admin && league.pending_requests_count && league.pending_requests_count > 0 && (
                          <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-bold text-white">
                            {league.pending_requests_count > 9 ? '9+' : league.pending_requests_count}
                          </span>
                        )}
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

        {/* League Directory */}
        <div className="space-y-4">
          <LeagueDirectory />
        </div>

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

        {/* Admin Request Panel */}
        <AdminRequestPanel 
          isOpen={requestPanelOpen}
          onOpenChange={setRequestPanelOpen}
          leagueId={selectedLeagueId}
          leagueName={selectedLeagueName}
        />
      </div>
    </Layout>
  );
}