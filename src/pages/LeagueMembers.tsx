import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '@/hooks/useSubscription';
import { useQueryClient } from '@tanstack/react-query';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { ArrowLeft, Check, X, Users, Search, Crown, Shield, UserPlus, Trash2, ChevronUp, ChevronDown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { manageLeagueMembership } from '@/lib/leagues';

interface Member {
  id: string;
  user_id: string;
  display_name: string;
  role: 'owner' | 'admin' | 'member';
  joined_at: string;
}

interface JoinRequest {
  id: string;
  user_id: string;
  display_name: string;
  created_at: string;
  note?: string;
}

interface SearchUser {
  user_id: string;
  display_name: string;
  username?: string;
  email?: string;
  status: 'can_add' | 'member' | 'pending';
}

interface League {
  id: string;
  name: string;
  max_members: number;
  admin_user_id: string;
}

export default function LeagueMembers() {
  const { leagueId } = useParams<{ leagueId: string }>();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const [league, setLeague] = useState<League | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  
  const { subscription, isPro } = useSubscription();

  useEffect(() => {
    if (!leagueId || !user) return;
    
    loadData();
  }, [leagueId, user]);

  const loadData = async () => {
    try {
      setLoading(true);
      setNotFound(false);

      if (!user?.id) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      // 1) Get league details and user role
      const { data: leagueData, error: leagueError } = await supabase
        .from('leagues')
        .select('id, name, max_members, admin_user_id')
        .eq('id', leagueId)
        .single();

      if (leagueError || !leagueData) {
        throw new Error('League not found');
      }

      setLeague(leagueData);

      // 2) Find brugerens rolle i ligaen
      const { data: roleRow, error: roleError } = await supabase
        .from('league_members')
        .select('role')
        .eq('league_id', leagueId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (roleError) {
        console.error('Error checking user role:', roleError);
      }

      if (!roleRow) {
        // User is not a member of this league
        setNotFound(true);
        setLoading(false);
        return;
      }

      // Sæt admin status baseret på rolle
      const userIsAdmin = roleRow && ['owner', 'admin'].includes(roleRow.role);
      const userIsOwner = roleRow?.role === 'owner';
      setIsAdmin(userIsAdmin || false);
      setIsOwner(userIsOwner || false);

      // 3) Hent medlemmer via view (alle medlemmer i samme liga må se hinanden)
      const { data: membersData, error: membersError } = await supabase
        .from('league_members_view')
        .select('id, user_id, display_name, role, joined_at')
        .eq('league_id', leagueId)
        .order('role', { ascending: false }); // owner/admin øverst

      if (membersError) {
        console.error('Error loading members:', membersError);
        throw membersError;
      }

      setMembers(membersData || []);

      // 4) Hent join requests KUN hvis admin/owner
      if (userIsAdmin) {
        // Step 1: Hent rå join requests (uden JOIN til profiles)
        const { data: rawRequests, error: requestsError } = await supabase
          .from('league_join_requests')
          .select('id, user_id, created_at')
          .eq('league_id', leagueId)
          .eq('status', 'pending')
          .order('created_at', { ascending: true });

        if (requestsError) {
          console.error('Error loading requests:', requestsError);
          setRequests([]);
        } else if (!rawRequests || rawRequests.length === 0) {
          setRequests([]);
        } else {
          // Step 2: Hent profiler for disse user_ids (best-effort)
          const userIds = Array.from(new Set(rawRequests.map(r => r.user_id)));
          const { data: profiles } = await supabase
            .from('profiles')
            .select('user_id, display_name, username')
            .in('user_id', userIds);

          // Step 3: Map profiles til requests
          const profilesById = Object.fromEntries(
            (profiles || []).map(p => [p.user_id, p])
          );
          
          const requestsWithNames = rawRequests.map(r => ({
            id: r.id,
            user_id: r.user_id,
            created_at: r.created_at,
            display_name: profilesById[r.user_id]?.display_name || 
                         profilesById[r.user_id]?.username || 
                         'Ukendt bruger'
          }));

          setRequests(requestsWithNames);
        }
      } else {
        setRequests([]);
      }

      setLoading(false);
    } catch (error) {
      console.error('Error loading league data:', error);
      setNotFound(true);
      setLoading(false);
    }
  };

  // Debounced search function
  const searchUsers = useCallback(async (term: string) => {
    if (!term.trim() || !isAdmin || !league) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      // Search for users by display_name, username, or email
      const { data: users, error } = await supabase
        .from('profiles')
        .select('user_id, display_name, username')
        .or(`display_name.ilike.%${term}%,username.ilike.%${term}%`)
        .limit(10);

      if (error) throw error;

      // Get current member user_ids and pending request user_ids
      const memberUserIds = new Set(members.map(m => m.user_id));
      const pendingUserIds = new Set(requests.map(r => r.user_id));

      // Filter and categorize results
      const results: SearchUser[] = (users || [])
        .filter(user => user.user_id !== user?.id) // Don't show current user
        .map(user => ({
          user_id: user.user_id,
          display_name: user.display_name || user.username || 'Bruger',
          username: user.username,
          status: memberUserIds.has(user.user_id) 
            ? 'member' 
            : pendingUserIds.has(user.user_id) 
            ? 'pending' 
            : 'can_add'
        }));

      setSearchResults(results);
    } catch (error) {
      console.error('Error searching users:', error);
      toast({
        title: "Fejl ved søgning",
        description: String(error),
        variant: "destructive",
      });
    } finally {
      setSearching(false);
    }
  }, [isAdmin, league, members, requests, user?.id]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => searchUsers(searchTerm), 300);
    return () => clearTimeout(timer);
  }, [searchTerm, searchUsers]);

  const approveRequest = async (request: JoinRequest) => {
    console.log('🚀 Approve request called for:', request.display_name, request.id);
    setActionLoading(request.id);
    
    // Optimistisk opdatering: fjern request og tilføj medlem med det samme
    const optimisticMember: Member = {
      id: `temp-${request.user_id}`, // temp ID
      user_id: request.user_id,
      display_name: request.display_name,
      role: 'member',
      joined_at: new Date().toISOString()
    };
    
    console.log('📝 Before update - Requests:', requests.length, 'Members:', members.length);
    
    // Opdater UI optimistisk
    const originalRequests = [...requests];
    const originalMembers = [...members];
    
    const newRequests = requests.filter(r => r.id !== request.id);
    const newMembers = [...members, optimisticMember];
    
    console.log('📝 After filter - New requests:', newRequests.length, 'New members:', newMembers.length);
    
    setRequests(newRequests);
    setMembers(newMembers);
    
    try {
      console.log('🔄 Calling RPC approve_join_request...');
      const { error } = await supabase.rpc('approve_join_request', {
        request_id: request.id
      });
      
      if (error) {
        console.error('❌ RPC approve_join_request failed:', {
          message: error.message,
          details: (error as any).details,
          hint: (error as any).hint,
          code: error.code,
          fullError: error
        });
        throw error;
      }

      console.log('✅ RPC success!');
      toast({
        title: "Anmodning godkendt!",
        description: `${request.display_name} er nu medlem af ligaen`,
      });

      // Reload data for at få rigtige IDs og opdateret data
      console.log('🔄 Reloading data...');
      await loadData();
      
      // Also invalidate my-leagues query so "Your leagues" panel updates
      queryClient.invalidateQueries({ queryKey: ['my-leagues'] });
      console.log('✅ Data reloaded');
    } catch (error: any) {
      // Rollback optimistisk opdatering ved fejl
      console.log('❌ Rolling back optimistic update');
      setRequests(originalRequests);
      setMembers(originalMembers);
      
      console.error('Error approving request:', {
        message: error?.message,
        details: error?.details,
        hint: error?.hint,
        code: error?.code,
        error
      });
      toast({
        title: "Fejl ved godkendelse",
        description: error?.message || String(error),
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const rejectRequest = async (request: JoinRequest) => {
    console.log('🚀 Reject request called for:', request.display_name, request.id);
    setActionLoading(request.id);
    
    console.log('📝 Before reject - Requests:', requests.length);
    
    // Optimistisk opdatering: fjern request med det samme
    const originalRequests = [...requests];
    const newRequests = requests.filter(r => r.id !== request.id);
    
    console.log('📝 After filter - New requests:', newRequests.length);
    setRequests(newRequests);
    
    try {
      console.log('🔄 Calling RPC decline_join_request...');
      const { error } = await supabase.rpc('decline_join_request', {
        request_id: request.id
      });
      
      if (error) {
        console.error('❌ RPC decline_join_request failed:', {
          message: error.message,
          details: (error as any).details,
          hint: (error as any).hint,
          code: error.code,
          fullError: error
        });
        throw error;
      }

      console.log('✅ RPC success!');
      toast({
        title: "Anmodning afvist",
        description: `Anmodning fra ${request.display_name} er afvist`,
      });

      // Reload data for at sikre konsistens
      console.log('🔄 Reloading data...');
      await loadData();
      
      // Also invalidate my-leagues query so "Your leagues" panel updates
      queryClient.invalidateQueries({ queryKey: ['my-leagues'] });
      console.log('✅ Data reloaded');
    } catch (error: any) {
      // Rollback optimistisk opdatering ved fejl
      console.log('❌ Rolling back optimistic update');
      setRequests(originalRequests);
      
      console.error('Error rejecting request:', {
        message: error?.message,
        details: error?.details,
        hint: error?.hint,
        code: error?.code,
        error
      });
      toast({
        title: "Fejl ved afvisning",
        description: error?.message || String(error),
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const addUserToLeague = async (searchUser: SearchUser) => {
    if (!league || !isAdmin) return;

    // Check plan limits
    const currentMemberCount = members.length;
    const maxMembers = isPro ? 50 : 3;
    
    if (currentMemberCount >= maxMembers) {
      toast({
        title: "Ligaen er fuld",
        description: `Max ${maxMembers} medlemmer tilladt for din plan`,
        variant: "destructive",
      });
      return;
    }

    setActionLoading(searchUser.user_id);
    try {
      // Add user directly as member
      const { error } = await supabase
        .from('league_members')
        .insert({
          league_id: leagueId,
          user_id: searchUser.user_id,
          role: 'member',
        });

      if (error) throw error;

      toast({
        title: "Medlem tilføjet!",
        description: `${searchUser.display_name} er nu medlem af ligaen`,
      });

      // Clear search and reload data
      setSearchTerm('');
      loadData();
    } catch (error) {
      console.error('Error adding user:', error);
      toast({
        title: "Fejl ved tilføjelse",
        description: String(error),
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const removeMember = async (member: Member) => {
    if (!isOwner || member.user_id === user?.id) return;

    setActionLoading(member.id);
    try {
      const { error } = await supabase
        .from('league_members')
        .delete()
        .eq('id', member.id);

      if (error) throw error;

      toast({
        title: "Medlem fjernet",
        description: `${member.display_name} er fjernet fra ligaen`,
      });

      loadData();
    } catch (error) {
      console.error('Error removing member:', error);
      toast({
        title: "Fejl ved fjernelse",
        description: String(error),
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const changeRole = async (member: Member, newRole: 'admin' | 'member') => {
    if (!isOwner || member.user_id === user?.id) return;

    setActionLoading(member.id);
    try {
      const { error } = await supabase
        .from('league_members')
        .update({ role: newRole })
        .eq('id', member.id);

      if (error) throw error;

      toast({
        title: "Rolle ændret",
        description: `${member.display_name} er nu ${newRole === 'admin' ? 'administrator' : 'medlem'}`,
      });

      loadData();
    } catch (error) {
      console.error('Error changing role:', error);
      toast({
        title: "Fejl ved rolleændring",
        description: String(error),
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'owner': return 'default';
      case 'admin': return 'secondary';
      case 'member': return 'outline';
      default: return 'outline';
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'owner': return Crown;
      case 'admin': return Shield;
      case 'member': return Users;
      default: return Users;
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <Users className="h-8 w-8 animate-pulse mx-auto mb-4 text-primary" />
            <p className="text-muted-foreground">Indlæser...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (notFound) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <h2 className="text-xl font-semibold mb-2">Liga ikke fundet</h2>
            <p className="text-muted-foreground mb-4">Ligaen kunne være slettet, eller du har ikke adgang.</p>
            <Link to="/leagues">
              <Button variant="outline">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Tilbage til leagues-siden
              </Button>
            </Link>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="mx-auto max-w-4xl p-6">
        <div className="mb-6 flex items-center gap-4">
          <Link to="/leagues">
            <Button variant="outline" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Tilbage til leagues
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-semibold">{league?.name || 'League'} Members</h1>
            <p className="text-sm text-muted-foreground">
              {members.length} / {league?.max_members || 0} medlemmer
            </p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-1">
          {/* Current Members Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Nuværende medlemmer
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {members.map((member) => {
                  const RoleIcon = getRoleIcon(member.role);
                  const isCurrentUser = member.user_id === user?.id;
                  const canManage = isOwner && !isCurrentUser;
                  
                  return (
                    <div key={member.id} className="flex items-center justify-between rounded-lg border p-3">
                      <div className="flex items-center gap-3">
                        <RoleIcon className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="font-medium">
                            {member.display_name}
                            {isCurrentUser && ' (dig)'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Medlem siden {new Date(member.joined_at).toLocaleDateString('da-DK')}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={getRoleBadgeVariant(member.role)}>
                          {member.role === 'owner' ? 'Ejer' : 
                           member.role === 'admin' ? 'Admin' : 'Medlem'}
                        </Badge>
                        {canManage && (
                          <div className="flex items-center gap-1">
                            {member.role === 'member' && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => changeRole(member, 'admin')}
                                disabled={actionLoading === member.id}
                              >
                                <ChevronUp className="h-3 w-3" />
                              </Button>
                            )}
                            {member.role === 'admin' && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => changeRole(member, 'member')}
                                disabled={actionLoading === member.id}
                              >
                                <ChevronDown className="h-3 w-3" />
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => removeMember(member)}
                              disabled={actionLoading === member.id}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                {members.length === 0 && (
                  <p className="text-center text-sm text-muted-foreground">Ingen medlemmer endnu.</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Join Requests Section (only for admins/owners) */}
          {isAdmin && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserPlus className="h-5 w-5" />
                  Anmodninger
                  {requests.length > 0 && (
                    <Badge variant="secondary">{requests.length}</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {requests.map((request) => (
                    <div key={request.id} className="flex items-center justify-between rounded-lg border p-3">
                      <div>
                        <p className="font-medium">{request.display_name}</p>
                        <p className="text-xs text-muted-foreground">
                          Modtaget {new Date(request.created_at).toLocaleDateString('da-DK')} kl. {new Date(request.created_at).toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => approveRequest(request)}
                          disabled={actionLoading === request.id}
                        >
                          <Check className="mr-1 h-4 w-4" />
                          Accepter
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          onClick={() => rejectRequest(request)}
                          disabled={actionLoading === request.id}
                        >
                          <X className="mr-1 h-4 w-4" />
                          Afvis
                        </Button>
                      </div>
                    </div>
                  ))}
                  {requests.length === 0 && (
                    <p className="text-center text-sm text-muted-foreground">Ingen anmodninger endnu</p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* User Search Section (only for admins/owners) */}
          {isAdmin && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Search className="h-5 w-5" />
                  Søg og tilføj medlemmer
                </CardTitle>
                {league && (
                  <p className="text-sm text-muted-foreground">
                    {members.length >= (isPro ? 50 : 3) ? (
                      <span className="text-destructive font-medium">
                        Ligaen er fuld ({isPro ? '50' : '3'} medlemmer max for din plan)
                      </span>
                    ) : (
                      `${(isPro ? 50 : 3) - members.length} pladser tilbage`
                    )}
                  </p>
                )}
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="memberSearch"
                      name="memberSearch"
                      placeholder="Søg brugere efter navn eller brugernavn..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9"
                      disabled={members.length >= (isPro ? 50 : 3)}
                    />
                  </div>
                  
                  {searching && (
                    <p className="text-sm text-muted-foreground text-center">Søger...</p>
                  )}
                  
                  {searchResults.length > 0 && (
                    <div className="space-y-2">
                      {searchResults.map((user) => (
                        <div key={user.user_id} className="flex items-center justify-between rounded-lg border p-3">
                          <div>
                            <p className="font-medium">{user.display_name}</p>
                            {user.username && (
                              <p className="text-xs text-muted-foreground">@{user.username}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {user.status === 'member' && (
                              <Badge variant="outline">Allerede medlem</Badge>
                            )}
                            {user.status === 'pending' && (
                              <Badge variant="secondary">Anmodet</Badge>
                            )}
                            {user.status === 'can_add' && (
                              <Button
                                size="sm"
                                onClick={() => addUserToLeague(user)}
                                disabled={actionLoading === user.user_id || members.length >= (isPro ? 50 : 3)}
                              >
                                <UserPlus className="mr-1 h-4 w-4" />
                                Tilføj
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {searchTerm && !searching && searchResults.length === 0 && (
                    <p className="text-center text-sm text-muted-foreground">Ingen brugere fundet</p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </Layout>
  );
}