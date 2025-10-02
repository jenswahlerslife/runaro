import { useNavigate } from 'react-router-dom';
import { Gamepad2, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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

interface MyGamesMenuProps {
  variant?: 'desktop' | 'mobile';
}

export const MyGamesMenu = ({ variant = 'desktop' }: MyGamesMenuProps) => {
  const navigate = useNavigate();
  const { data: games, isLoading, error } = useMyActiveGames();

  const handleGameSelect = (gameId: string) => {
    navigate(`/games/${gameId}`);
  };

  const buttonSize = variant === 'mobile' ? 'sm' : 'sm';
  const buttonClass = variant === 'mobile'
    ? 'flex flex-col items-center h-12'
    : '';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size={buttonSize} className={buttonClass}>
          <Gamepad2 className={variant === 'mobile' ? 'h-4 w-4' : 'h-4 w-4 mr-2'} />
          {variant === 'mobile' ? (
            <span className="text-xs mt-1">Dine spil</span>
          ) : (
            'Dine spil'
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {isLoading ? (
          <DropdownMenuItem disabled>
            <div className="flex items-center">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary mr-2"></div>
              Indlæser...
            </div>
          </DropdownMenuItem>
        ) : error ? (
          <DropdownMenuItem disabled>
            <span className="text-muted-foreground">Kunne ikke hente spil</span>
          </DropdownMenuItem>
        ) : !games || games.length === 0 ? (
          <DropdownMenuItem disabled>
            <span className="text-muted-foreground text-sm leading-relaxed">
              Du har i øjeblikket ikke nogen aktive spil
            </span>
          </DropdownMenuItem>
        ) : (
          games.map((game) => (
            <DropdownMenuItem
              key={game.id}
              onSelect={() => handleGameSelect(game.id)}
              className="cursor-pointer"
            >
              <div className="flex flex-col w-full">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{game.name}</span>
                  {game.timeLeftSeconds && (
                    <div className="flex items-center text-xs text-muted-foreground">
                      <Clock className="h-3 w-3 mr-1" />
                      {formatTimeLeft(game.timeLeftSeconds)}
                    </div>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">{game.leagueName}</span>
              </div>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default MyGamesMenu;

