import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Target, Users, Clock } from 'lucide-react';
import { Game } from '@/lib/leagues';

export interface SetupGameCardProps {
  setupGame: Game;
  baseCount: number;
  memberCount: number;
  onNavigateToSetup: () => void;
}

export function SetupGameCard({
  setupGame,
  baseCount,
  memberCount,
  onNavigateToSetup
}: SetupGameCardProps) {
  const remainingBases = memberCount - baseCount;

  return (
    <Card className="mt-6 border-orange-200 bg-orange-50">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Target className="h-5 w-5 text-orange-600" />
          Spil Mangler Setup
        </CardTitle>
        <Badge variant="secondary" className="bg-orange-100 text-orange-800">
          Setup
        </Badge>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
          <div>
            <div className="text-sm text-muted-foreground">Spil Navn</div>
            <div className="font-semibold">{setupGame.name}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Baser Mangler</div>
            <div className="font-semibold flex items-center gap-1">
              <Users className="h-4 w-4" />
              {remainingBases > 0 ? (
                <span className="text-orange-600">
                  {remainingBases} spillere
                </span>
              ) : (
                <span className="text-green-600">
                  Alle baser sat
                </span>
              )}
            </div>
            <div className="text-xs text-muted-foreground">
              {baseCount}/{memberCount} baser sat
            </div>
          </div>
          <div className="md:text-right">
            <Button
              className="w-full md:w-auto bg-orange-600 hover:bg-orange-700"
              onClick={onNavigateToSetup}
            >
              <Target className="h-4 w-4 mr-2" />
              Fortsæt Opsætning
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}