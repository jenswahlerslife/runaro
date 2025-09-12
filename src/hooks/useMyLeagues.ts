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
  return useQuery({
    queryKey: ['my-leagues'], // Stable key, no user dependency needed for RPC
    queryFn: async (): Promise<MyLeague[]> => {
      console.debug('🔄 Calling list_my_leagues_with_role RPC...');
      
      const { data, error } = await supabase.rpc('list_my_leagues_with_role');
      
      if (error) {
        console.error('❌ RPC list_my_leagues_with_role failed:', error);
        throw error;
      }

      console.debug('✅ My leagues RPC result:', data);
      
      return (data || []) as MyLeague[];
    },
  });
}