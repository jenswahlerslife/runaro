import { Link } from 'react-router-dom';
import { ArrowLeft, Gamepad2, Clock, Users, Trophy } from 'lucide-react';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useMyActiveGames } from '@/hooks/useMyActiveGames';

const formatTimeLeft = (seconds: number | null): string => {
  if (!seconds || seconds <= 0) return '';

  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (days > 0) return `${days}d ${hours}t`;
  if (hours > 0) return `${hours}t ${minutes}m`;
  return `${minutes}m`;
};

export default function MyGamesPage() {
  const { data: games, isLoading, error } = useMyActiveGames();

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/dashboard">
              <Button variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Tilbage til Dashboard
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <Gamepad2 className="h-8 w-8 text-primary" />
                Dine Spil
              </h1>
              <p className="text-muted-foreground">
                Oversigt over dine aktive spil på tværs af ligaer
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <Gamepad2 className="h-8 w-8 animate-pulse mx-auto mb-4 text-primary" />
              <p className="text-muted-foreground">Indlæser dine spil...</p>
            </div>
          </div>
        ) : error ? (
          <Card>
            <CardContent className="py-8 text-center">
              <Trophy className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold text-muted-foreground mb-2">
                Fejl ved indlæsning
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                Kunne ikke hente dine spil. Prøv at genindlæse siden.
              </p>
              <Button onClick={() => window.location.reload()} variant="outline">
                Genindlæs
              </Button>
            </CardContent>
          </Card>
        ) : !games || games.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <Gamepad2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold text-muted-foreground mb-2">
                Ingen aktive spil endnu
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                Du har i øjeblikket ingen aktive spil. Deltag i en liga for at komme i gang!
              </p>
              <Link to="/leagues">
                <Button>
                  <Users className="h-4 w-4 mr-2" />
                  Gå til Ligaer
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {games.map((game) => (
              <Card key={game.id} className="cursor-pointer hover:shadow-md transition-shadow">
                <Link to={`/games/${game.id}`}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{game.name}</CardTitle>
                      {game.timeLeftSeconds && (
                        <Badge variant="outline">
                          <Clock className="h-3 w-3 mr-1" />
                          {formatTimeLeft(game.timeLeftSeconds)}
                        </Badge>
                      )}
                    </div>
                    <CardDescription>{game.leagueName}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <Badge variant="secondary">Aktiv</Badge>
                      <div className="flex items-center text-sm text-muted-foreground">
                        <Trophy className="h-4 w-4 mr-1" />
                        Klik for at spille
                      </div>
                    </div>
                  </CardContent>
                </Link>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}

