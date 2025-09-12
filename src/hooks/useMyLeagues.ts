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
    queryFn: async () => {
      const { data, error } = await supabase
        .from('league_members')
        .select(`
          role,
          league:league_id (
            id, name, description, invite_code, created_at
          )
        `)
        .eq('user_id', user!.id);

      if (error) throw error;
      
      // Flatten for convenient rendering
      return (data ?? []).map(row => ({
        role: row.role as 'owner' | 'admin' | 'member',
        id: row.league?.id,
        name: row.league?.name,
        description: row.league?.description,
        invite_code: row.league?.invite_code,
        created_at: row.league?.created_at,
      })).filter(league => league.id) as MyLeague[];
    },
  });
}