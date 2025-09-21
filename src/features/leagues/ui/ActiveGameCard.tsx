import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Play, Trophy } from 'lucide-react';
import { ActiveGame } from '../types';

export interface ActiveGameCardProps {
  activeGame: ActiveGame;
  timeLeftLabel: string;
  onNavigateToGame: () => void;
}

export function ActiveGameCard({
  activeGame,
  timeLeftLabel,
  onNavigateToGame
}: ActiveGameCardProps) {
  return (
    <Card className="mt-6">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Trophy className="h-5 w-5" />
          Spil i gang
        </CardTitle>
        <div className="text-sm text-muted-foreground">
          {activeGame.status === "setup" ? "Venter på baser" : "Live"}
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
          <div>
            <div className="text-sm text-muted-foreground">Game</div>
            <div className="font-semibold">{activeGame.name}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Tid tilbage</div>
            <div className="font-semibold">{timeLeftLabel}</div>
          </div>
          <div className="md:text-right">
            <Button
              className="w-full md:w-auto"
              onClick={onNavigateToGame}
            >
              <Play className="h-4 w-4 mr-2" />
              {activeGame.status === "setup" ? "Start game" : "Gå til spillet"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}