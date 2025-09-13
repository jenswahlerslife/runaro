import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bell, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';

interface AdminRequestBarProps {
  onOpenRequestPanel: () => void;
}

const AdminRequestBar: React.FC<AdminRequestBarProps> = ({ onOpenRequestPanel }) => {
  const { user } = useAuth();

  // Check if user is admin of any league and get pending request count
  const { data: adminInfo } = useQuery({
    queryKey: ['admin-request-count'],
    queryFn: async () => {
      if (!user) return { isAdmin: false, pendingCount: 0 };

      // Check if user is admin or owner of any league
      const { data: adminMemberships, error: membershipError } = await supabase
        .from('league_members')
        .select('league_id')
        .eq('user_id', user.id)
        .in('role', ['admin', 'owner']);

      if (membershipError) throw membershipError;

      const isAdmin = adminMemberships && adminMemberships.length > 0;
      
      if (!isAdmin) {
        return { isAdmin: false, pendingCount: 0 };
      }

      // Get pending request count using RPC function
      const { data: count, error: countError } = await supabase
        .rpc('get_admin_pending_requests_count');

      if (countError) {
        console.warn('Failed to get pending request count:', countError);
        return { isAdmin: true, pendingCount: 0 };
      }

      return { 
        isAdmin: true, 
        pendingCount: count || 0 
      };
    },
    enabled: !!user,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Don't render if user is not an admin
  if (!adminInfo?.isAdmin) {
    return null;
  }

  return (
    <div className="bg-muted/50 border-b px-6 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Users className="h-4 w-4" />
          <span>League Administration</span>
        </div>
        
        <Button
          variant="outline"
          size="sm"
          onClick={onOpenRequestPanel}
          className="flex items-center gap-2"
        >
          <Bell className="h-4 w-4" />
          <span>Requests</span>
          <Badge 
            variant={adminInfo.pendingCount > 0 ? "default" : "secondary"}
            className="ml-1"
          >
            {adminInfo.pendingCount}
          </Badge>
        </Button>
      </div>
    </div>
  );
};

export default AdminRequestBar;