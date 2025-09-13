import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Search, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface League {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

interface JoinRequest {
  id: string;
  league_id: string;
  status: 'pending' | 'approved' | 'declined';
}

interface Membership {
  league_id: string;
  role: 'admin' | 'member';
}

const LeagueDirectory: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Debounced search term
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 250);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Fetch all leagues
  const { data: leagues = [], isLoading: loadingLeagues } = useQuery({
    queryKey: ['leagues-directory'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leagues')
        .select('id, name, description, created_at')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as League[];
    },
    enabled: !!user,
  });

  // Fetch user's join requests
  const { data: joinRequests = [] } = useQuery({
    queryKey: ['user-join-requests'],
    queryFn: async () => {
      if (!user) return [];
      
      // Non-blocking query: default to empty array if it fails
      try {
        const { data, error } = await supabase
          .from('league_join_requests')
          .select('id, league_id, status')
          .eq('user_id', user.id)
          .eq('status', 'pending');
        
        if (error) {
          console.warn('Failed to load join requests:', error);
          return [];
        }
        return data as JoinRequest[];
      } catch (error) {
        console.warn('Failed to load join requests:', error);
        return [];
      }
    },
    enabled: !!user,
  });

  // Fetch user's memberships
  const { data: memberships = [] } = useQuery({
    queryKey: ['user-memberships'],
    queryFn: async () => {
      if (!user) return [];
      
      // Non-blocking query: default to empty array if it fails
      try {
        const { data, error } = await supabase
          .from('league_members')
          .select('league_id, role')
          .eq('user_id', user.id);
        
        if (error) {
          console.warn('Failed to load memberships:', error);
          return [];
        }
        return data as Membership[];
      } catch (error) {
        console.warn('Failed to load memberships:', error);
        return [];
      }
    },
    enabled: !!user,
  });

  // Join league mutation
  const joinLeagueMutation = useMutation({
    mutationFn: async (leagueId: string) => {
      const { error } = await supabase
        .from('league_join_requests')
        .insert({
          league_id: leagueId,
          user_id: user!.id,
          status: 'pending'
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Anmodning sendt",
        description: "Din anmodning er sendt til liga-administratoren",
      });
      queryClient.invalidateQueries({ queryKey: ['user-join-requests'] });
    },
    onError: (error: any) => {
      toast({
        title: "Fejl",
        description: error.message || "Kunne ikke sende anmodning",
        variant: "destructive",
      });
    },
  });

  // Filter leagues based on search term
  const filteredLeagues = useMemo(() => {
    if (!debouncedSearchTerm) return leagues;
    
    return leagues.filter(league =>
      league.name.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
      league.description?.toLowerCase().includes(debouncedSearchTerm.toLowerCase())
    );
  }, [leagues, debouncedSearchTerm]);

  // Get button state for a league
  const getLeagueButtonState = (leagueId: string) => {
    // Check if user is a member
    const isMember = memberships.some(m => m.league_id === leagueId);
    if (isMember) return 'joined';

    // Check if user has a pending request
    const pendingRequest = joinRequests.find(r => r.league_id === leagueId && r.status === 'pending');
    if (pendingRequest) return 'requested';

    return 'available';
  };

  const handleJoinLeague = (leagueId: string) => {
    if (!user) return;
    joinLeagueMutation.mutate(leagueId);
  };

  if (!user) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            League Directory
          </CardTitle>
          <CardDescription>
            Discover and join leagues to compete with other runners
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">
            Please log in to browse and join leagues.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          League Directory
        </CardTitle>
        <CardDescription>
          Discover and join leagues to compete with other runners
        </CardDescription>
        
        {/* Search Field */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search leagues…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </CardHeader>
      
      <CardContent>
        {loadingLeagues ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading leagues...</p>
          </div>
        ) : filteredLeagues.length === 0 ? (
          <div className="text-center py-8">
            <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">No leagues found</h3>
            <p className="text-muted-foreground">
              {searchTerm ? 'Try adjusting your search terms' : 'No leagues available yet'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredLeagues.map((league) => {
              const buttonState = getLeagueButtonState(league.id);
              
              return (
                <div
                  key={league.id}
                  className="flex items-center justify-between p-4 border rounded-lg bg-card"
                >
                  <div className="flex-1">
                    <h4 className="font-semibold text-lg">{league.name}</h4>
                    {league.description && (
                      <p className="text-muted-foreground text-sm mt-1">
                        {league.description}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-2">
                      Created {new Date(league.created_at).toLocaleDateString('da-DK')}
                    </p>
                  </div>
                  
                  <div className="ml-4">
                    {buttonState === 'joined' ? (
                      <Button disabled variant="outline" size="sm">
                        Tilmeldt
                      </Button>
                    ) : buttonState === 'requested' ? (
                      <Button disabled variant="outline" size="sm">
                        Anmodet
                      </Button>
                    ) : (
                      <Button
                        onClick={() => handleJoinLeague(league.id)}
                        disabled={joinLeagueMutation.isPending}
                        size="sm"
                      >
                        {joinLeagueMutation.isPending ? 'Tilmelder...' : 'Tilmeld'}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default LeagueDirectory;