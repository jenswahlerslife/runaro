import { useState, useEffect } from 'react';
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
}

function DurationSelector({
  value,
  onChange,
  isPro,
}: { value: number; onChange: (v: number) => void; isPro: boolean }) {
  const maxDays = isPro ? 30 : 14;
  const options = Array.from({ length: maxDays - 13 }, (_, i) => 14 + i); // 14..30 / 14..14
  
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">Tidshorisont (dage)</Label>
      <Select value={String(value)} onValueChange={(v) => onChange(Number(v))}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Vælg dage" />
        </SelectTrigger>
        <SelectContent>
          {options.map((d) => (
            <SelectItem key={d} value={String(d)}>{d}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      {!isPro && (
        <p className="text-xs text-muted-foreground">
          Gratis konto: maks 14 dage. Opgradér til Pro for op til 30.
        </p>
      )}
    </div>
  );
}

function StartGameCta({ gameId, gameStatus }: { gameId: string; gameStatus: string }) {
  const { user } = useAuth();
  const navigate = useNavigate();

  function handleStartGame() {
    // Check if user has Strava connected (assuming profile has strava_connected field)
    // For now, navigate directly to activities with game param
    const returnTo = `/activities?game=${gameId}&selectBase=1`;
    navigate(returnTo);
  }

  if (gameStatus !== 'setup') return null;

  return (
    <Button onClick={handleStartGame} variant="default" size="sm">
      <Play className="h-4 w-4 mr-2" />
      Start spillet
    </Button>
  );
}

export default function GameManagement({ leagueId, isAdmin }: GameManagementProps) {
  const { isPro } = useSubscription();
  const navigate = useNavigate();
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newGameName, setNewGameName] = useState('');
  const [durationDays, setDurationDays] = useState(14);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadGames();
  }, [leagueId]);

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

  const handleCreateGame = async () => {
    if (!newGameName.trim()) {
      setError('Spil navn er påkrævet');
      return;
    }

    setError('');
    setCreating(true);
    
    try {
      // 1) Opret game (status='setup')
      const result = await createGame(leagueId, newGameName);
      if (!result.success) {
        throw new Error(result.error || 'Failed to create game');
      }
      
      const gameId = result.game_id;

      // 2) Sæt varighed + (evtl. auto-aktiver hvis alle har base)
      await rpcStartGame(gameId, durationDays);

      toast.success('Spil oprettet!');
      setCreateDialogOpen(false);
      setNewGameName('');
      setDurationDays(14);
      loadGames();
    } catch (e: any) {
      console.error(e);
      setError(e.message || 'Kunne ikke oprette spil');
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

  return (
    <div className="space-y-6">
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
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Opret Spil
              </Button>
            </DialogTrigger>
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
          </Dialog>
        )}
      </div>

      {games.length === 0 ? (
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
      ) : (
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
                    onClick={() => navigate(`/games/${game.id}`)}
                  >
                    <Trophy className="h-4 w-4 mr-2" />
                    Se Spil
                  </Button>
                  
                  <StartGameCta gameId={game.id} gameStatus={game.status} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}