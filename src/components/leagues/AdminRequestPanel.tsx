import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Check, X, Clock, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { da } from 'date-fns/locale';

interface JoinRequestWithDetails {
  id: string;
  league_id: string;
  user_id: string;
  status: 'pending' | 'approved' | 'declined';
  created_at: string;
  decided_at: string | null;
  league: {
    name: string;
  };
  profiles: {
    username: string | null;
    display_name: string | null;
  } | null;
}

interface AdminRequestPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const AdminRequestPanel: React.FC<AdminRequestPanelProps> = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch join requests for leagues where user is admin
  const { data: joinRequests = [], isLoading } = useQuery({
    queryKey: ['admin-join-requests'],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from('league_join_requests')
        .select(`
          id,
          league_id,
          user_id,
          status,
          created_at,
          decided_at,
          league:leagues!league_join_requests_league_id_fkey(name),
          profiles!league_join_requests_user_id_fkey(username, display_name)
        `)
        .in('league_id', 
          // Subquery to get leagues where current user is admin
          supabase
            .from('league_memberships')
            .select('league_id')
            .eq('user_id', user.id)
            .eq('role', 'admin')
        )
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as JoinRequestWithDetails[];
    },
    enabled: !!user && isOpen,
    refetchInterval: isOpen ? 10000 : false, // Refresh every 10 seconds when open
  });

  // Approve request mutation
  const approveMutation = useMutation({
    mutationFn: async (requestId: string) => {
      const { data, error } = await supabase
        .rpc('approve_join_request', { request_id: requestId });
      
      if (error) throw error;
      if (!data.success) throw new Error(data.error);
      
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: "Success",
        description: data.message || "Member added to league",
      });
      queryClient.invalidateQueries({ queryKey: ['admin-join-requests'] });
      queryClient.invalidateQueries({ queryKey: ['admin-request-count'] });
      queryClient.invalidateQueries({ queryKey: ['user-join-requests'] }); // For directory update
      queryClient.invalidateQueries({ queryKey: ['user-memberships'] }); // For directory update
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to approve request",
        variant: "destructive",
      });
    },
  });

  // Decline request mutation
  const declineMutation = useMutation({
    mutationFn: async (requestId: string) => {
      const { data, error } = await supabase
        .rpc('decline_join_request', { request_id: requestId });
      
      if (error) throw error;
      if (!data.success) throw new Error(data.error);
      
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: "Success", 
        description: data.message || "Request declined",
      });
      queryClient.invalidateQueries({ queryKey: ['admin-join-requests'] });
      queryClient.invalidateQueries({ queryKey: ['admin-request-count'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to decline request",
        variant: "destructive",
      });
    },
  });

  const handleApprove = (requestId: string) => {
    approveMutation.mutate(requestId);
  };

  const handleDecline = (requestId: string) => {
    declineMutation.mutate(requestId);
  };

  const getUserDisplayName = (request: JoinRequestWithDetails) => {
    return request.profiles?.username || 
           request.profiles?.display_name || 
           `User ${request.user_id.slice(0, 8)}`;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="text-yellow-600"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      case 'approved':
        return <Badge variant="outline" className="text-green-600"><Check className="h-3 w-3 mr-1" />Approved</Badge>;
      case 'declined':
        return <Badge variant="outline" className="text-red-600"><X className="h-3 w-3 mr-1" />Declined</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Filter requests to show pending first, then recent decided ones
  const sortedRequests = React.useMemo(() => {
    return joinRequests.sort((a, b) => {
      // Pending first
      if (a.status === 'pending' && b.status !== 'pending') return -1;
      if (a.status !== 'pending' && b.status === 'pending') return 1;
      
      // Then by creation date (newest first)
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [joinRequests]);

  const pendingRequests = joinRequests.filter(r => r.status === 'pending');

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Join Requests
          </SheetTitle>
          <SheetDescription>
            Approve or decline requests to join your leagues
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6">
          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading requests...</p>
            </div>
          ) : sortedRequests.length === 0 ? (
            <div className="text-center py-8">
              <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">No pending requests</h3>
              <p className="text-muted-foreground text-sm">
                All join requests have been processed
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingRequests.length > 0 && (
                <div>
                  <h4 className="font-semibold text-sm text-muted-foreground mb-3 uppercase tracking-wide">
                    Pending ({pendingRequests.length})
                  </h4>
                  <div className="space-y-3">
                    {pendingRequests.map((request) => (
                      <div
                        key={request.id}
                        className="border rounded-lg p-4 bg-card"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <p className="font-medium">
                              {getUserDisplayName(request)}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              wants to join <span className="font-medium">{request.league.name}</span>
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {formatDistanceToNow(new Date(request.created_at), { 
                                addSuffix: true, 
                                locale: da 
                              })}
                            </p>
                          </div>
                          {getStatusBadge(request.status)}
                        </div>
                        
                        {request.status === 'pending' && (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleApprove(request.id)}
                              disabled={approveMutation.isPending}
                              className="flex-1"
                            >
                              <Check className="h-4 w-4 mr-1" />
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDecline(request.id)}
                              disabled={declineMutation.isPending}
                              className="flex-1"
                            >
                              <X className="h-4 w-4 mr-1" />
                              Decline
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Show recent processed requests */}
              {sortedRequests.filter(r => r.status !== 'pending').slice(0, 5).length > 0 && (
                <div>
                  <h4 className="font-semibold text-sm text-muted-foreground mb-3 uppercase tracking-wide">
                    Recent
                  </h4>
                  <div className="space-y-3">
                    {sortedRequests
                      .filter(r => r.status !== 'pending')
                      .slice(0, 5)
                      .map((request) => (
                        <div
                          key={request.id}
                          className="border rounded-lg p-4 bg-muted/20"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <p className="font-medium">
                                {getUserDisplayName(request)}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {request.league.name}
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {formatDistanceToNow(new Date(request.decided_at || request.created_at), { 
                                  addSuffix: true, 
                                  locale: da 
                                })}
                              </p>
                            </div>
                            {getStatusBadge(request.status)}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default AdminRequestPanel;