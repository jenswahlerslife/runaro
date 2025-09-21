import { useState, useCallback, useEffect } from 'react';
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
import { useQueryClient, useQuery } from '@tanstack/react-query';
import LeagueDirectory from '@/components/leagues/LeagueDirectory';
import { createLeague, joinLeague, getUserLeagues, type League } from '@/lib/leagues';
import { rpcGetActiveGameForLeague } from '@/lib/gamesApi';
import AdminRequestPanel from '@/components/leagues/AdminRequestPanel';
import GameManagement from '@/components/leagues/GameManagement';
import { supabase } from '@/integrations/supabase/client';

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
  const [activeGames, setActiveGames] = useState<Record<string, any>>({});
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Filter admin leagues based on is_admin property from the RPC
  const adminLeagues = (leagues ?? []).filter(league => league.is_admin);

  const [newLeague, setNewLeague] = useState({
    name: '',
    description: '',
    isPublic: true,
    maxMembers: 3
  });

  const [inviteCode, setInviteCode] = useState('');

  const fetchActiveGames = useCallback(async (leagues: League[]) => {
    const games: Record<string, any> = {};

    for (const league of leagues) {
      try {
        const activeGame = await rpcGetActiveGameForLeague(league.id);
        if (activeGame && (activeGame as any).id) {
          games[league.id] = activeGame;
        }
      } catch (error) {
        console.error(`Error fetching active game for league ${league.id}:`, error);
      }
    }

    setActiveGames(games);
  }, []);

  const fetchLeagues = useCallback(async () => {
    try {
      const userLeagues = await getUserLeagues();
      setLeagues(userLeagues || []);

      // Also fetch active games for each league
      await fetchActiveGames(userLeagues || []);
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
  }, [toast, fetchActiveGames]);





  // Get total pending requests count for all admin leagues
  const { data: totalPendingCount = 0 } = useQuery({
    queryKey: ['admin-pending-count'],
    queryFn: async () => {
      if ((adminLeagues ?? []).length === 0) return 0;
      
      let totalCount = 0;
      for (const league of (adminLeagues ?? [])) {
        const { data, error } = await supabase.rpc('get_admin_pending_requests_count', {
          league_id: league.id
        });
        if (!error && typeof data === 'number') {
          totalCount += data;
        }
      }
      return totalCount;
    },
    enabled: (adminLeagues ?? []).length > 0,
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  useEffect(() => {
    // Only fetch leagues after authentication is confirmed and user exists
    if (!authLoading && user) {
      fetchLeagues();
    }
  }, [authLoading, user, fetchLeagues]);


  // Early returns after all hooks are defined
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
      const league = await createLeague(
        newLeague.name,
        newLeague.description || undefined,
        newLeague.isPublic,
        newLeague.maxMembers
      );

      toast({
        title: "Liga oprettet!",
        description: `Invitationskode: ${league.invite_code}`,
      });
      setCreateDialogOpen(false);
      setNewLeague({ name: '', description: '', isPublic: true, maxMembers: 3 });
      fetchLeagues();
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



  const openGameDialog = (leagueId: string) => {
    setSelectedLeagueId(leagueId);
    setGameDialogOpen(true);
  };

  const handleGameButtonClick = (league: League) => {
    const activeGame = activeGames[league.id];

    if (activeGame) {
      // Navigate to existing game
      const gameId = activeGame.id;
      const gameStatus = activeGame.status || 'setup';

      const path = gameStatus === 'setup'
        ? `/activities?game=${gameId}&selectBase=1`
        : `/games/${gameId}`;

      navigate(path);
    } else {
      // No game exists, open create dialog
      openGameDialog(league.id);
    }
  };

  const openRequestPanel = (leagueId: string, leagueName: string) => {
    setSelectedLeagueId(leagueId);
    setSelectedLeagueName(leagueName);
    setRequestPanelOpen(true);
  };

  const openRequestPanelForAll = () => {
    // For multi-league admin panel, use first admin league as primary
    if ((adminLeagues ?? []).length > 0) {
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
                      max="50"
                      value={newLeague.maxMembers}
                      onChange={(e) => setNewLeague({ ...newLeague, maxMembers: parseInt(e.target.value) || 3 })}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Free plan: max 3 members. Pro plan: up to 50 members.
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="isPublic"
                      checked={newLeague.isPublic}
                      onChange={(e) => setNewLeague({ ...newLeague, isPublic: e.target.checked })}
                      className="rounded border-gray-300"
                    />
                    <Label htmlFor="isPublic" className="text-sm">
                      Public league (appears in directory)
                    </Label>
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
        {(leagues ?? []).length === 0 ? (
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
            {(leagues ?? []).map((league) => (
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
                            title={`Admin panel ${(league?.pending_requests_count ?? 0) > 0 ? `- ${league.pending_requests_count} pending requests` : ''}`}
                          >
                            <Crown className="h-4 w-4 text-blue-600" />
                            {(league?.pending_requests_count ?? 0) > 0 && (
                              <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
                                {(league?.pending_requests_count ?? 0) > 9 ? '9+' : league?.pending_requests_count ?? 0}
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
                        {league?.member_count ?? 0} / {league?.max_members ?? 0}
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between text-sm">
                      <span>Role</span>
                      <Badge variant={league.role === 'owner' ? 'default' : 'secondary'}>
                        {league.role}
                      </Badge>
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
                        {league?.is_admin && (league?.pending_requests_count ?? 0) > 0 && (
                          <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-bold text-white">
                            {(league?.pending_requests_count ?? 0) > 9 ? '9+' : league?.pending_requests_count ?? 0}
                          </span>
                        )}
                      </Button>

                      {/* Show Start Game CTA for all members when setup game exists */}
                      {activeGames[league.id] && (activeGames[league.id] as any)?.status === 'setup' ? (
                        <Button
                          size="sm"
                          onClick={() => {
                            const game = activeGames[league.id] as any;
                            navigate(`/activities?game=${game.id}&selectBase=1`);
                          }}
                          className="flex-1"
                        >
                          <Play className="h-4 w-4 mr-1" />
                          Start Game
                        </Button>
                      ) : league.is_admin ? (
                        <Button
                          size="sm"
                          onClick={() => handleGameButtonClick(league)}
                          className="flex-1"
                        >
                          <Play className="h-4 w-4 mr-1" />
                          {activeGames[league.id] ? 'Gå til spillet' : 'Games'}
                        </Button>
                      ) : activeGames[league.id] ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            const game = activeGames[league.id] as any;
                            navigate(`/games/${game.id}`);
                          }}
                          className="flex-1"
                        >
                          <Trophy className="h-4 w-4 mr-1" />
                          Vis Spil
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled
                          className="flex-1"
                        >
                          <Clock className="h-4 w-4 mr-1" />
                          Afventer spil
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

        {/* Games Dialog - Direct Create Mode */}
        {selectedLeagueId && (
          <GameManagement
            leagueId={selectedLeagueId}
            isAdmin={leagues.find(l => l.id === selectedLeagueId)?.is_admin || false}
            autoOpenCreate
            open={gameDialogOpen}
            onOpenChange={(open) => {
              setGameDialogOpen(open);
              if (!open) {
                setSelectedLeagueId('');
              }
            }}
          />
        )}

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
