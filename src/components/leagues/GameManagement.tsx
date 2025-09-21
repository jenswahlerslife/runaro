import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '@/hooks/useSubscription';
import { supabase } from '@/integrations/supabase/client';
import { createGame, rpcStartGame } from '@/lib/gamesApi';
import { Plus, Play, Clock, Trophy, Users } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

interface Game {
  id: string;
  name: string;
  status: 'setup' | 'active' | 'finished' | 'cancelled';
  duration_days: number | null;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  league_id: string;
}

interface GameManagementProps {
  leagueId: string;
  isAdmin: boolean;
  autoOpenCreate?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

function DurationSelector({
  value,
  onChange,
  isPro,
}: { value: number; onChange: (v: number) => void; isPro: boolean }) {
  if (!isPro) {
    // Free plan: fixed 14 days (no editing UI, just show "14 days (Free)")
    return (
      <div className="space-y-2">
        <Label className="text-sm font-medium">Tidshorisont (dage)</Label>
        <div className="p-3 border rounded-md bg-muted">
          <span className="font-medium">14 dage (Gratis)</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Gratis plan bruger en fast 14-dages horisont.
        </p>
      </div>
    );
  }

  // Pro plan: any integer 14–30 days (inclusive). Default 14.
  const minDays = 14;
  const maxDays = 30;
  const options = Array.from({ length: maxDays - minDays + 1 }, (_, i) => minDays + i);

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">Tidshorisont (dage)</Label>
      <Select value={String(value)} onValueChange={(v) => onChange(Number(v))}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Vælg mellem 14 og 30 dage" />
        </SelectTrigger>
        <SelectContent>
          {options.map((d) => (
            <SelectItem key={d} value={String(d)}>{d} dage</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">
        Vælg mellem 14 og 30 dage.
      </p>
    </div>
  );
}

function StartGameCta({ gameId, gameStatus }: { gameId: string; gameStatus: string }) {
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

  const handleStartGame = () => {
    if (hasStravaConnection === null || checkingStrava) return; // Still checking

    if (!hasStravaConnection) {
      // User needs to connect Strava first - redirect to Strava connect then back to game setup
      navigate(`/strava/connect?return=${encodeURIComponent(`/activities?game=${gameId}&selectBase=1`)}`);
      return;
    }

    // User has Strava connected - go directly to game setup for base selection
    navigate(`/activities?game=${gameId}&selectBase=1`);
  };

  if (gameStatus !== 'setup') return null;

  if (checkingStrava) {
    return (
      <Button variant="default" size="sm" disabled>
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
        Tjekker...
      </Button>
    );
  }

  return (
    <Button onClick={handleStartGame} variant="default" size="sm">
      <Play className="h-4 w-4 mr-2" />
      Start spillet
    </Button>
  );
}

export default function GameManagement({ leagueId, isAdmin, autoOpenCreate, open, onOpenChange }: GameManagementProps) {
  const { isPro, canCreateGame } = useSubscription();
  const navigate = useNavigate();
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [internalCreateDialogOpen, setInternalCreateDialogOpen] = useState(false);
  const isControlled = open !== undefined;
  const isDialogOpen = isControlled ? Boolean(open) : internalCreateDialogOpen;
  const setDialogOpen = useCallback(
    (value: boolean) => {
      if (!isControlled) {
        setInternalCreateDialogOpen(value);
      }
      onOpenChange?.(value);
    },
    [isControlled, onOpenChange]
  );
  const [newGameName, setNewGameName] = useState('');
  const [durationDays, setDurationDays] = useState(14);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);

  const loadGames = async () => {
    try {
      const { data, error } = await supabase
        .from('games')
        .select('*')
        .eq('league_id', leagueId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setGames(data || []);
    } catch (error) {
      console.error('Error loading games:', error);
      toast.error('Failed to load games');
    } finally {
      setLoading(false);
    }
  };

  const handleDialogOpenChange = useCallback(
    (openState: boolean) => {
      if (openState) {
        setNewGameName('');
        setDurationDays(14);
        setError('');
      }
      setDialogOpen(openState);
    },
    [setDialogOpen]
  );

  useEffect(() => {
    loadGames();
  }, [leagueId]);

  // Auto-open create dialog if autoOpenCreate prop is true
  useEffect(() => {
    if (autoOpenCreate) {
      handleDialogOpenChange(true);
    }
  }, [autoOpenCreate, leagueId, handleDialogOpenChange]);

  const handleCreateGame = async () => {
    if (!newGameName.trim()) {
      setError('Spil navn er påkrævet');
      return;
    }

    setError('');
    setCreating(true);

    try {
      // Create game with duration_days (plan validation happens server-side)
      const result = await createGame(leagueId, newGameName, durationDays);

      // Check if result indicates success
      if (!result.success && result.error) {
        throw new Error(result.error);
      }

      const gameId = result.id || result.game_id;
      if (!gameId) {
        throw new Error('Game creation succeeded but no game ID returned');
      }

      toast.success(`Spil oprettet! Varighed: ${result.duration_days} dage. Status: setup.`);
      setDialogOpen(false);
      setNewGameName('');
      setDurationDays(14);

      // Reload games list to show the new game
      await loadGames();

      // Redirect to game setup for base selection
    navigate(`/activities?game=${gameId}&selectBase=1`);
    } catch (e: any) {
      console.error('Game creation failed:', e);
      const errorMessage = e.message || 'Kunne ikke oprette spil';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setCreating(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap = {
      setup: { label: 'Opsætning', variant: 'secondary' as const },
      active: { label: 'Aktiv', variant: 'default' as const },
      finished: { label: 'Afsluttet', variant: 'outline' as const },
      cancelled: { label: 'Annulleret', variant: 'destructive' as const },
    };
    const config = statusMap[status as keyof typeof statusMap] || statusMap.setup;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const formatTimeRemaining = (endDate: string | null) => {
    if (!endDate) return null;
    const remaining = new Date(endDate).getTime() - Date.now();
    if (remaining <= 0) return "Udløbet";
    
    const days = Math.floor(remaining / (1000 * 60 * 60 * 24));
    const hours = Math.floor((remaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (days > 0) return `${days}d ${hours}t`;
    return `${hours}t`;
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto mb-2"></div>
        <p className="text-sm text-muted-foreground">Henter spil...</p>
      </div>
    );
  }

  const dialogContent = (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Opret Nyt Spil</DialogTitle>
        <DialogDescription>
          Opret et nyt spil for ligaen. Spillet starter når alle spillere har sat deres Base.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="game-name">Spil Navn</Label>
          <Input
            id="game-name"
            placeholder="Indtast spil navn"
            value={newGameName}
            onChange={(e) => setNewGameName(e.target.value)}
          />
        </div>

        <DurationSelector
          value={durationDays}
          onChange={setDurationDays}
          isPro={isPro}
        />

        {error && (
          <Alert>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Button onClick={handleCreateGame} disabled={creating} className="w-full">
          {creating ? "Opretter..." : "Opret Spil"}
        </Button>
      </div>
    </DialogContent>
  );

  return (
    <div className="space-y-6">
      {!autoOpenCreate && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary text-primary-foreground">
              <Trophy className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-xl font-semibold">Spil</h3>
              <p className="text-sm text-muted-foreground">Administrer spil i denne liga</p>
            </div>
          </div>

          {isAdmin && (
            <Dialog open={isDialogOpen} onOpenChange={handleDialogOpenChange}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Opret Spil
                </Button>
              </DialogTrigger>
              {dialogContent}
            </Dialog>
          )}
        </div>
      )}

      {autoOpenCreate && isAdmin && (
        <Dialog open={isDialogOpen} onOpenChange={handleDialogOpenChange}>
          {dialogContent}
        </Dialog>
      )}

      {!autoOpenCreate && (games ?? []).length === 0 ? (
        <Card>
          <CardContent className="p-8">
            <div className="text-center space-y-4">
              <div className="p-3 rounded-xl bg-muted w-fit mx-auto">
                <Trophy className="h-8 w-8 text-muted-foreground" />
              </div>
              <div>
                <h4 className="font-semibold mb-1">Ingen spil endnu</h4>
                <p className="text-sm text-muted-foreground">
                  {isAdmin ? "Opret det første spil for denne liga" : "Venter på at admin opretter et spil"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : !autoOpenCreate ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {games.map((game) => (
            <Card key={game.id} className="border">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{game.name}</CardTitle>
                  {getStatusBadge(game.status)}
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    {game.duration_days ? `${game.duration_days} dage` : '14 dage'}
                  </div>
                  {game.end_date && (
                    <div className="flex items-center gap-1">
                      <span>⏱️</span>
                      {formatTimeRemaining(game.end_date)}
                    </div>
                  )}
                </div>
              </CardHeader>
              
              <CardContent className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Oprettet {new Date(game.created_at).toLocaleDateString('da-DK')}
                </p>
                
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => {
                      // For setup games, go to GameSetup for base selection
                      if (game.status === 'setup') {
        navigate(`/activities?game=${game.id}&selectBase=1`);
                      } else {
                        navigate(`/games/${game.id}`);
                      }
                    }}
                  >
                    <Trophy className="h-4 w-4 mr-2" />
                    {game.status === 'setup' ? 'Vælg Base' : 'Se Spil'}
                  </Button>
                  
                  <StartGameCta gameId={game.id} gameStatus={game.status} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}
    </div>
  );
}
