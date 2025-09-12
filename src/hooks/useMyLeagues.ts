import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface MyLeague {
  id: string;
  name: string;
  description: string | null;
  invite_code: string;
  created_at: string;
  role: 'owner' | 'admin' | 'member';
}

export function useMyLeagues() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['my-leagues', user?.id],
    enabled: !!user,
    queryFn: async (): Promise<MyLeague[]> => {
      // Step 1: Get memberships for current user (works with RLS: user_id = auth.uid())
      const { data: memberships, error: memErr } = await supabase
        .from('league_members')
        .select('league_id, role')
        .eq('user_id', user!.id);

      if (memErr) throw memErr;
      
      const leagueIds = Array.from(new Set((memberships ?? []).map(m => m.league_id)));
      if (leagueIds.length === 0) return [];

      // Step 2: Fetch those leagues directly
      const { data: leagues, error: leaguesErr } = await supabase
        .from('leagues')
        .select('id, name, description, invite_code, created_at')
        .in('id', leagueIds)
        .order('created_at', { ascending: false });

      if (leaguesErr) throw leaguesErr;

      // Step 3: Combine leagues with roles
      const leaguesWithRoles: MyLeague[] = (leagues ?? []).map(league => {
        const membership = memberships?.find(m => m.league_id === league.id);
        return {
          ...league,
          role: membership?.role as 'owner' | 'admin' | 'member'
        };
      });

      return leaguesWithRoles;
    },
  });
}