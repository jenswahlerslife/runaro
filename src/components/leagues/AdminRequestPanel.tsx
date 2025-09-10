import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Check, X, Clock, User } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface JoinRequest {
  id: string;
  league_id: string;
  user_id: string;
  username: string;
  created_at: string;
  updated_at?: string;
  status: 'pending' | 'approved' | 'declined';
}

interface AdminRequestPanelProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  leagueId: string;
  leagueName: string;
}

const AdminRequestPanel: React.FC<AdminRequestPanelProps> = ({
  isOpen,
  onOpenChange,
  leagueId,
  leagueName,
}) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch pending requests
  const { data: pendingRequestsData, isLoading: loadingPending } = useQuery({
    queryKey: ['admin-pending-requests', leagueId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_admin_pending_requests', {
        league_id: leagueId
      });
      
      if (error) throw error;
      return data;
    },
    enabled: isOpen && !!leagueId,
    refetchInterval: isOpen ? 30000 : false, // Refetch every 30 seconds when panel is open
  });

  // Fetch recent requests
  const { data: recentRequestsData, isLoading: loadingRecent } = useQuery({
    queryKey: ['admin-recent-requests', leagueId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_admin_recent_requests', {
        league_id: leagueId
      });
      
      if (error) throw error;
      return data;
    },
    enabled: isOpen && !!leagueId,
  });

  // Approve request mutation
  const approveMutation = useMutation({
    mutationFn: async (requestId: string) => {
      const { data, error } = await supabase.rpc('approve_join_request', {
        request_id: requestId
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data, requestId) => {
      if (data.success) {
        toast({
          title: "Anmodning godkendt",
          description: "Brugeren er nu medlem af ligaen",
        });
        // Invalidate queries to refresh data
        queryClient.invalidateQueries({ queryKey: ['admin-pending-requests', leagueId] });
        queryClient.invalidateQueries({ queryKey: ['admin-recent-requests', leagueId] });
        queryClient.invalidateQueries({ queryKey: ['admin-pending-count'] });
        queryClient.invalidateQueries({ queryKey: ['user-join-requests'] });
        queryClient.invalidateQueries({ queryKey: ['user-memberships'] });
      } else {
        toast({
          title: "Fejl",
          description: data.error || "Kunne ikke godkende anmodningen",
          variant: "destructive",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Fejl",
        description: error.message || "Kunne ikke godkende anmodningen",
        variant: "destructive",
      });
    },
  });

  // Decline request mutation
  const declineMutation = useMutation({
    mutationFn: async (requestId: string) => {
      const { data, error } = await supabase.rpc('decline_join_request', {
        request_id: requestId
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data, requestId) => {
      if (data.success) {
        toast({
          title: "Anmodning afvist",
          description: "Anmodningen er blevet afvist",
        });
        // Invalidate queries to refresh data
        queryClient.invalidateQueries({ queryKey: ['admin-pending-requests', leagueId] });
        queryClient.invalidateQueries({ queryKey: ['admin-recent-requests', leagueId] });
        queryClient.invalidateQueries({ queryKey: ['admin-pending-count'] });
        queryClient.invalidateQueries({ queryKey: ['user-join-requests'] });
      } else {
        toast({
          title: "Fejl",
          description: data.error || "Kunne ikke afvise anmodningen",
          variant: "destructive",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Fejl",
        description: error.message || "Kunne ikke afvise anmodningen",
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('da-DK', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const pendingRequests = pendingRequestsData?.success ? pendingRequestsData.requests || [] : [];
  const recentRequests = recentRequestsData?.success ? recentRequestsData.requests || [] : [];

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent className="w-[400px] sm:w-[540px]">
        <SheetHeader>
          <SheetTitle>Anmodninger for {leagueName}</SheetTitle>
          <SheetDescription>
            Administrer tilmeldingsanmodninger til din liga
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Pending Requests */}
          <div>
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Ventende anmodninger ({pendingRequests.length})
            </h3>
            
            <ScrollArea className="h-[300px]">
              <div className="space-y-3">
                {loadingPending ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                  </div>
                ) : pendingRequests.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Clock className="h-8 w-8 mx-auto mb-2" />
                    <p>Ingen ventende anmodninger</p>
                  </div>
                ) : (
                  pendingRequests.map((request: JoinRequest) => (
                    <div
                      key={request.id}
                      className="flex items-center justify-between p-3 border rounded-lg bg-card"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <User className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="font-medium">{request.username}</p>
                          <p className="text-sm text-muted-foreground">
                            {formatDate(request.created_at)}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDecline(request.id)}
                          disabled={declineMutation.isPending}
                        >
                          <X className="h-4 w-4 mr-1" />
                          Afvis
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleApprove(request.id)}
                          disabled={approveMutation.isPending}
                        >
                          <Check className="h-4 w-4 mr-1" />
                          Godkend
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>

          <Separator />

          {/* Recent Requests */}
          <div>
            <h3 className="text-lg font-semibold mb-3">
              Seneste anmodninger (7 dage)
            </h3>
            
            <ScrollArea className="h-[200px]">
              <div className="space-y-3">
                {loadingRecent ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                  </div>
                ) : recentRequests.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>Ingen seneste anmodninger</p>
                  </div>
                ) : (
                  recentRequests.map((request: JoinRequest) => (
                    <div
                      key={request.id}
                      className="flex items-center justify-between p-3 border rounded-lg bg-muted/30"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <User className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="font-medium">{request.username}</p>
                          <p className="text-sm text-muted-foreground">
                            {request.updated_at ? formatDate(request.updated_at) : formatDate(request.created_at)}
                          </p>
                        </div>
                      </div>
                      
                      <Badge 
                        variant={request.status === 'approved' ? 'default' : 'destructive'}
                      >
                        {request.status === 'approved' ? 'Godkendt' : 'Afvist'}
                      </Badge>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default AdminRequestPanel;