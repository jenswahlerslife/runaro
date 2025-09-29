import { useQuery } from '@tanstack/react-query';
import { getUserLeagues } from '@/lib/leagues';
import { rpcGetActiveGameForLeague } from '@/lib/gamesApi';

export interface MyActiveGame {
  id: string;
  name: string;
  leagueId: string;
  leagueName: string;
  timeLeftSeconds: number | null;
}

export const useMyActiveGames = () => {
  return useQuery({
    queryKey: ['my-active-games'],
    queryFn: async (): Promise<MyActiveGame[]> => {
      try {
        // Get user's leagues
        const leagues = await getUserLeagues();
        if (!leagues || leagues.length === 0) {
          return [];
        }

        // Get active game for each league using Promise.allSettled for robustness
        const gamePromises = leagues.map(async (league) => {
          try {
            const activeGame = await rpcGetActiveGameForLeague(league.id);
            if (activeGame && activeGame.id && activeGame.meta?.status === 'active') {
              return {
                id: activeGame.id,
                name: activeGame.meta?.name || `Spil i ${league.name}`,
                leagueId: league.id,
                leagueName: league.name,
                timeLeftSeconds: activeGame.meta?.time_left_seconds || null,
              };
            }
            return null;
          } catch (error) {
            console.error(`Error fetching active game for league ${league.id}:`, error);
            return null;
          }
        });

        const gameResults = await Promise.allSettled(gamePromises);

        // Filter out failed promises and null results, then sort by time left
        const activeGames = gameResults
          .filter((result): result is PromiseFulfilledResult<MyActiveGame> =>
            result.status === 'fulfilled' && result.value !== null
          )
          .map(result => result.value)
          .sort((a, b) => {
            // Sort by time left ascending (games ending soon first)
            if (a.timeLeftSeconds === null && b.timeLeftSeconds === null) return 0;
            if (a.timeLeftSeconds === null) return 1;
            if (b.timeLeftSeconds === null) return -1;
            return a.timeLeftSeconds - b.timeLeftSeconds;
          });

        return activeGames;
      } catch (error) {
        console.error('Error fetching active games:', error);
        throw error;
      }
    },
    staleTime: 1000 * 60 * 2, // 2 minutes
    refetchInterval: 1000 * 60 * 5, // Refetch every 5 minutes
  });
};