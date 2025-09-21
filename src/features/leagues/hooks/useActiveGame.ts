import { useState, useEffect, useMemo } from 'react';
import { formatDuration, intervalToDuration } from 'date-fns';
import { rpcGetActiveGameForLeague } from '@/lib/gamesApi';
import { ActiveGame } from '../types';

export interface UseActiveGameReturn {
  activeGame: ActiveGame | null;
  timeLeftLabel: string;
  loading: boolean;
}

export function useActiveGame(leagueId: string): UseActiveGameReturn {
  const [activeGame, setActiveGame] = useState<ActiveGame | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!leagueId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const g = await rpcGetActiveGameForLeague(leagueId);
        if (!cancelled && g && (g as any).id) {
          setActiveGame({
            id: (g as any).id!,
            name: (g as any).name ?? "Game",
            status: (g as any).status ?? "active",
            end_at: (g as any).end_at ?? null,
            time_left_seconds: (g as any).time_left_seconds ?? null,
          });
        }
      } catch (e) {
        console.error("Failed to load active game:", e);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [leagueId]);

  const timeLeftLabel = useMemo(() => {
    if (!activeGame?.time_left_seconds || activeGame.time_left_seconds <= 0) return "—";
    const dur = intervalToDuration({ start: 0, end: activeGame.time_left_seconds * 1000 });
    // Show e.g. "12 timer" or "1 dag 3 t"
    return formatDuration(
      { days: dur.days, hours: dur.hours, minutes: dur.minutes },
      { format: ["days","hours","minutes"], zero: false }
    );
  }, [activeGame]);

  return {
    activeGame,
    timeLeftLabel,
    loading
  };
}