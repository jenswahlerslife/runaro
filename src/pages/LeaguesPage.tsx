import { useState, useCallback, useEffect, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Navigate, Link, useNavigate } from "react-router-dom";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { ArrowLeft, Plus, Users, Trophy, Key, Crown, Clock, Play } from "lucide-react";
import LeagueDirectory from "@/components/leagues/LeagueDirectory";
import { createLeague, joinLeague, getUserLeagues, type League } from "@/lib/leagues";
import { rpcGetActiveGameForLeague } from "@/lib/gamesApi";
import GameManagement from "@/components/leagues/GameManagement";

type ActiveLeagueGame = NonNullable<Awaited<ReturnType<typeof rpcGetActiveGameForLeague>>>;
type ActiveGamesMap = Record<string, ActiveLeagueGame>;

interface NewLeagueForm {
  name: string;
  description: string;
  isPublic: boolean;
  maxMembers: number;
}

const MIN_LEAGUE_MEMBERS = 2;
const DEFAULT_MAX_MEMBERS = 3;
const PRO_MAX_MEMBERS = 50;
const PENDING_BADGE_LIMIT = 9;

const createDefaultLeagueForm = (): NewLeagueForm => ({
  name: "",
  description: "",
  isPublic: true,
  maxMembers: DEFAULT_MAX_MEMBERS,
});

const formatPendingCount = (count: number) =>
  count > PENDING_BADGE_LIMIT ? `${PENDING_BADGE_LIMIT}+` : `${count}`;

const getGameNavigationPath = (game: ActiveLeagueGame) =>
  game.status === "setup" ? `/games/${game.id}/setup` : `/games/${game.id}`;

const LeaguesPage = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [leagues, setLeagues] = useState<League[]>([]);
  const [activeGames, setActiveGames] = useState<ActiveGamesMap>({});
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [joinDialogOpen, setJoinDialogOpen] = useState(false);
  const [gameDialogOpen, setGameDialogOpen] = useState(false);
  const [selectedLeagueId, setSelectedLeagueId] = useState<string>("");
  const [newLeague, setNewLeague] = useState<NewLeagueForm>(() => createDefaultLeagueForm());
  const [inviteCode, setInviteCode] = useState("");

  const selectedLeague = useMemo(
    () => leagues.find((league) => league.id === selectedLeagueId),
    [leagues, selectedLeagueId],
  );

  const showErrorToast = useCallback(
    (title: string, description: string) => {
      toast({ title, description, variant: "destructive" });
    },
    [toast],
  );

  const showSuccessToast = useCallback(
    (title: string, description?: string) => {
      toast({ title, description });
    },
    [toast],
  );

  const updateLeagueForm = useCallback(
    <Field extends keyof NewLeagueForm>(field: Field, value: NewLeagueForm[Field]) => {
      setNewLeague((prev) => ({ ...prev, [field]: value }));
    },
    [],
  );

  const resetLeagueForm = useCallback(() => {
    setNewLeague(createDefaultLeagueForm());
  }, []);

  const fetchActiveGames = useCallback(async (targetLeagues: League[]) => {
    if (targetLeagues.length === 0) {
      setActiveGames({});
      return;
    }

    const entries = await Promise.all(
      targetLeagues.map(async (league) => {
        try {
          const activeGame = await rpcGetActiveGameForLeague(league.id);
          return activeGame ? ([league.id, activeGame] as const) : null;
        } catch (error) {
          console.error(`Error fetching active game for league ${league.id}:`, error);
          return null;
        }
      }),
    );

    const nextActiveGames = entries.reduce<ActiveGamesMap>((acc, entry) => {
      if (entry) {
        const [leagueId, game] = entry;
        acc[leagueId] = game;
      }
      return acc;
    }, {});

    setActiveGames(nextActiveGames);
  }, []);

  const fetchLeagues = useCallback(async () => {
    setLoading(true);
    try {
      const userLeagues = await getUserLeagues();
      setLeagues(userLeagues);
      await fetchActiveGames(userLeagues);
    } catch (error) {
      showErrorToast("Fejl ved indlæsning af ligaer", String(error));
    } finally {
      setLoading(false);
    }
  }, [fetchActiveGames, showErrorToast]);

  useEffect(() => {
    if (!authLoading && user) {
      fetchLeagues();
    }
  }, [authLoading, user, fetchLeagues]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  const handleCreateLeague = async () => {
    const trimmedName = newLeague.name.trim();

    if (!trimmedName) {
      showErrorToast("Navn påkrævet", "Indtast venligst et navn til ligaen");
      return;
    }

    try {
      const league = await createLeague(
        trimmedName,
        newLeague.description.trim() || undefined,
        newLeague.isPublic,
        newLeague.maxMembers,
      );

      showSuccessToast("Liga oprettet!", `Invitationskode: ${league.invite_code}`);
      setCreateDialogOpen(false);
      resetLeagueForm();
      await fetchLeagues();
    } catch (error) {
      showErrorToast("Fejl ved oprettelse af liga", String(error));
    }
  };

  const handleJoinLeague = async () => {
    const trimmedCode = inviteCode.trim();

    if (!trimmedCode) {
      showErrorToast("Invitationskode påkrævet", "Indtast venligst en invitationskode");
      return;
    }

    try {
      const result = await joinLeague(trimmedCode);

      if (result.success) {
        showSuccessToast("Tilmeldt liga!", `${result.league_name} - Status: ${result.status}`);
        setJoinDialogOpen(false);
        setInviteCode("");
        await fetchLeagues();
      } else {
        showErrorToast("Fejl ved tilmelding til liga", result.error ?? "Prøv igen senere.");
      }
    } catch (error) {
      showErrorToast("Fejl ved tilmelding til liga", String(error));
    }
  };

  const openGameDialog = (leagueId: string) => {
    setSelectedLeagueId(leagueId);
    setGameDialogOpen(true);
  };

  const handleGameButtonClick = (league: League) => {
    const activeGame = activeGames[league.id];

    if (activeGame) {
      navigate(getGameNavigationPath(activeGame));
      return;
    }

    openGameDialog(league.id);
  };

  const renderGameAction = (league: League, activeGame: ActiveLeagueGame | undefined) => {
    if (activeGame && activeGame.status === "setup") {
      return (
        <Button
          size="sm"
          onClick={(event) => {
            event.stopPropagation();
            navigate(getGameNavigationPath(activeGame));
          }}
          className="flex-1"
        >
          <Play className="h-4 w-4 mr-1" />
          Start Game
        </Button>
      );
    }

    if (league.is_admin) {
      return (
        <Button
          size="sm"
          onClick={(event) => {
            event.stopPropagation();
            handleGameButtonClick(league);
          }}
          className="flex-1"
        >
          <Play className="h-4 w-4 mr-1" />
          {activeGame ? "Gå til spillet" : "Games"}
        </Button>
      );
    }

    if (activeGame) {
      return (
        <Button
          size="sm"
          variant="outline"
          onClick={(event) => {
            event.stopPropagation();
            navigate(getGameNavigationPath(activeGame));
          }}
          className="flex-1"
        >
          <Trophy className="h-4 w-4 mr-1" />
          Vis Spil
        </Button>
      );
    }

    return (
      <Button size="sm" variant="outline" disabled className="flex-1">
        <Clock className="h-4 w-4 mr-1" />
        Afventer spil
      </Button>
    );
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="space-y-6">
          <div className="flex justify-start">
            <Link to="/">
              <Button variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Tilbage til Hjem
              </Button>
            </Link>
          </div>

          <div className="text-center">
            <h1 className="text-3xl font-bold flex items-center justify-center gap-2 mb-2">
              <Trophy className="h-8 w-8 text-primary" />
              Territorium Ligaer
            </h1>
            <p className="text-muted-foreground">
              Deltag i eller opret konkurrencedygtige løbeligaer
            </p>
          </div>

          <div className="flex gap-3 justify-center">
            <Dialog open={joinDialogOpen} onOpenChange={setJoinDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Key className="h-4 w-4 mr-2" />
                  Deltag i Liga
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Deltag i en Liga</DialogTitle>
                  <DialogDescription>
                    Indtast invitationskoden for at deltage i en eksisterende liga
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="inviteCode">Invitationskode</Label>
                    <Input
                      id="inviteCode"
                      value={inviteCode}
                      onChange={(event) => setInviteCode(event.target.value)}
                      placeholder="Indtast invitationskode"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setJoinDialogOpen(false)}>
                    Annuller
                  </Button>
                  <Button onClick={handleJoinLeague}>Deltag i Liga</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Opret Liga
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Opret Ny Liga</DialogTitle>
                  <DialogDescription>
                    Opret en ny konkurrencepræget liga for territoriale kampe
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="name">Liga Navn</Label>
                    <Input
                      id="name"
                      value={newLeague.name}
                      onChange={(event) => updateLeagueForm("name", event.target.value)}
                      placeholder="Indtast liga navn"
                    />
                  </div>
                  <div>
                    <Label htmlFor="description">Beskrivelse (valgfri)</Label>
                    <Input
                      id="description"
                      value={newLeague.description}
                      onChange={(event) => updateLeagueForm("description", event.target.value)}
                      placeholder="Liga beskrivelse"
                    />
                  </div>
                  <div>
                    <Label htmlFor="maxMembers">Maks Medlemmer</Label>
                    <Input
                      id="maxMembers"
                      type="number"
                      min={MIN_LEAGUE_MEMBERS}
                      max={PRO_MAX_MEMBERS}
                      value={newLeague.maxMembers}
                      onChange={(event) => {
                        const parsed = Number.parseInt(event.target.value, 10);
                        updateLeagueForm(
                          "maxMembers",
                          Number.isNaN(parsed) ? DEFAULT_MAX_MEMBERS : parsed,
                        );
                      }}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Gratis plan: maks {DEFAULT_MAX_MEMBERS} medlemmer. Pro plan: op til{" "}
                      {PRO_MAX_MEMBERS} medlemmer.
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="isPublic"
                      checked={newLeague.isPublic}
                      onChange={(event) => updateLeagueForm("isPublic", event.target.checked)}
                      className="rounded border-gray-300"
                    />
                    <Label htmlFor="isPublic" className="text-sm">
                      Offentlig liga (vises i biblioteket)
                    </Label>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                    Annuller
                  </Button>
                  <Button onClick={handleCreateLeague}>Opret Liga</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <Trophy className="h-8 w-8 animate-pulse mx-auto mb-4 text-primary" />
              <p className="text-muted-foreground">Indlæser ligaer...</p>
            </div>
          </div>
        ) : leagues.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <Trophy className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold text-muted-foreground mb-2">
                Ingen ligaer fundet
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                Opret en ny liga eller deltag i en eksisterende for at komme i gang.
              </p>
              <div className="flex gap-2 justify-center">
                <Button onClick={() => setCreateDialogOpen(true)}>Opret Liga</Button>
                <Button variant="outline" onClick={() => setJoinDialogOpen(true)}>
                  Deltag i Liga
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {leagues.map((league) => {
              const activeGame = activeGames[league.id];
              const memberCount = league.member_count ?? 0;
              const pendingRequests = league.pending_requests_count ?? 0;
              const showPendingBadge = league.is_admin && pendingRequests > 0;
              const pendingBadgeLabel = formatPendingCount(pendingRequests);
              const memberStats = `${memberCount} / ${league.max_members ?? 0}`;

              const handleNavigateToLeague = () => {
                navigate(`/leagues/${league.id}/members`);
              };

              return (
                <Card
                  key={league.id}
                  className="hover:shadow-lg transition-shadow cursor-pointer hover:bg-muted/40"
                  role="button"
                  tabIndex={0}
                  onClick={handleNavigateToLeague}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      handleNavigateToLeague();
                    }
                  }}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="flex items-center gap-2">
                          <Trophy className="h-5 w-5" />
                          {league.name}
                          {league.is_admin && (
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                handleNavigateToLeague();
                              }}
                              className="relative inline-flex items-center justify-center p-1 rounded hover:bg-blue-50 transition-colors"
                              title={
                                pendingRequests > 0
                                  ? `Admin panel - ${pendingRequests} afventende anmodninger`
                                  : "Admin panel"
                              }
                            >
                              <Crown className="h-4 w-4 text-blue-600" />
                              {showPendingBadge && (
                                <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
                                  {pendingBadgeLabel}
                                </span>
                              )}
                            </button>
                          )}
                        </CardTitle>
                        <CardDescription className="mt-1">
                          {league.description || "Ingen beskrivelse"}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-1">
                          <Users className="h-4 w-4" />
                          Medlemmer
                        </span>
                        <span className="font-medium">{memberStats}</span>
                      </div>

                      <div className="flex items-center justify-between text-sm">
                        <span>Rolle</span>
                        <Badge variant={league.role === "owner" ? "default" : "secondary"}>
                          {league.role}
                        </Badge>
                      </div>

                      <div className="flex items-center justify-between text-sm">
                        <span>Invitationskode</span>
                        <Badge variant="outline" className="font-mono text-xs">
                          {league.invite_code}
                        </Badge>
                      </div>

                      <div className="flex gap-2 pt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleNavigateToLeague();
                          }}
                          className="flex-1 relative"
                        >
                          <Users className="h-4 w-4 mr-1" />
                          Se liga
                          {showPendingBadge && (
                            <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-bold text-white">
                              {pendingBadgeLabel}
                            </span>
                          )}
                        </Button>

                        {renderGameAction(league, activeGame)}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        <div className="space-y-4">
          <LeagueDirectory />
        </div>

        {selectedLeagueId && (
          <GameManagement
            leagueId={selectedLeagueId}
            isAdmin={selectedLeague?.is_admin ?? false}
            autoOpenCreate
            open={gameDialogOpen}
            onOpenChange={(open) => {
              setGameDialogOpen(open);
              if (!open) {
                setSelectedLeagueId("");
              }
            }}
          />
        )}
      </div>
    </Layout>
  );
};

export default LeaguesPage;
