import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { ArrowLeft, Check, X, Users, Crown, Clock, Shield } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { UIProfile } from '@/types/ui';

interface LeagueMember {
  id: string;
  user_id: string;
  role: string;
  joined_at: string;
  profile: {
    username: string | null;
    display_name: string | null;
  };
}

interface JoinRequest {
  id: string;
  user_id: string;
  created_at: string;
  profile: {
    username: string | null;
    display_name: string | null;
  };
}

interface LeagueInfo {
  id: string;
  name: string;
  description: string | null;
  admin_user_id: string;
  member_count: number;
  max_members: number;
}

export default function LeagueMembers() {
  const { leagueId } = useParams<{ leagueId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [members, setMembers] = useState<LeagueMember[]>([]);
  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const [leagueInfo, setLeagueInfo] = useState<LeagueInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (leagueId && user) {
      loadData();
    }
  }, [leagueId, user]);

  const loadData = async () => {
    if (!leagueId || !user) return;
    
    setLoading(true);
    try {
      // Load league info
      const { data: league, error: leagueError } = await supabase
        .from('leagues')
        .select('id, name, description, admin_user_id, max_members')
        .eq('id', leagueId)
        .single();

      if (leagueError) throw leagueError;
      
      // Check if user is admin by looking up their role in league_members
      const { data: userRole, error: roleError } = await supabase
        .from('league_members')
        .select('role')
        .eq('league_id', leagueId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (roleError) {
        console.error('Error checking user role:', roleError);
        // If we can't check role, assume not admin
      }

      const userIsAdmin = userRole && ['admin', 'owner'].includes(userRole.role);
      setIsAdmin(userIsAdmin || false);
      
      // Load members
      const { data: membersData, error: membersError } = await supabase
        .from('league_members')
        .select(`
          id,
          user_id,
          role,
          joined_at,
          profiles!inner(username, display_name)
        `)
        .eq('league_id', leagueId);

      if (membersError) throw membersError;

      const formattedMembers = membersData.map(member => ({
        id: member.id,
        user_id: member.user_id,
        role: member.role,
        joined_at: member.joined_at,
        profile: {
          username: member.profiles?.username || null,
          display_name: member.profiles?.display_name || null
        }
      }));

      // Load join requests (only for admins)
      let requestsData: JoinRequest[] = [];
      if (userIsAdmin) {
        const { data: reqData, error: reqError } = await supabase
          .from('league_join_requests')
          .select(`
            id,
            user_id,
            created_at,
            profiles!inner(username, display_name)
          `)
          .eq('league_id', leagueId)
          .eq('status', 'pending')
          .order('created_at', { ascending: false });

        if (reqError) throw reqError;

        requestsData = reqData.map(req => ({
          id: req.id,
          user_id: req.user_id,
          created_at: req.created_at,
          profile: {
            username: req.profiles?.username || null,
            display_name: req.profiles?.display_name || null
          }
        }));
      }

      setLeagueInfo({
        id: league.id,
        name: league.name,
        description: league.description,
        admin_user_id: league.admin_user_id,
        member_count: formattedMembers.length,
        max_members: league.max_members
      });
      setMembers(formattedMembers);
      setRequests(requestsData);

    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: "Fejl ved indlæsning",
        description: "Kunne ikke indlæse medlemmer og anmodninger",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const approveRequest = async (request: JoinRequest) => {
    try {
      // Call the approve function
      const { data, error } = await supabase.rpc('approve_join_request', {
        request_id: request.id
      });

      if (error) throw error;

      if (data && !data.success) {
        throw new Error(data.error);
      }

      toast({
        title: "Anmodning godkendt!",
        description: `${getDisplayName(request.profile)} er nu medlem af ligaen`,
      });

      // Reload data to show updated state
      loadData();
    } catch (error) {
      console.error('Error approving request:', error);
      toast({
        title: "Fejl ved godkendelse",
        description: String(error),
        variant: "destructive",
      });
    }
  };

  const rejectRequest = async (request: JoinRequest) => {
    try {
      // Call the reject function
      const { data, error } = await supabase.rpc('decline_join_request', {
        request_id: request.id
      });

      if (error) throw error;

      if (data && !data.success) {
        throw new Error(data.error);
      }

      toast({
        title: "Anmodning afvist",
        description: `Anmodning fra ${getDisplayName(request.profile)} er afvist`,
      });

      // Reload data to show updated state
      loadData();
    } catch (error) {
      console.error('Error rejecting request:', error);
      toast({
        title: "Fejl ved afvisning",
        description: String(error),
        variant: "destructive",
      });
    }
  };

  const getDisplayName = (profile: { username: string | null; display_name: string | null }) => {
    return profile.display_name || profile.username || 'Ukendt bruger';
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <Users className="h-8 w-8 animate-pulse mx-auto mb-4 text-primary" />
            <p className="text-muted-foreground">Loading members...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (!leagueInfo) {
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
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/leagues">
              <Button variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Tilbage til ligaer
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Users className="h-6 w-6 text-primary" />
                {leagueInfo.name} - Medlemmer
                {isAdmin && (
                  <Badge variant="secondary">
                    <Crown className="h-3 w-3 mr-1" />
                    Admin
                  </Badge>
                )}
              </h1>
              <p className="text-muted-foreground">
                {leagueInfo.member_count} af {leagueInfo.max_members} medlemmer
                {leagueInfo.description && ` • ${leagueInfo.description}`}
              </p>
            </div>
          </div>
        </div>

        {/* Join Requests Section - Only for admins */}
        {isAdmin && requests.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-yellow-600" />
                Ventende anmodninger
                <Badge variant="secondary">{requests.length}</Badge>
              </CardTitle>
              <CardDescription>
                Medlemsanmodninger der venter på godkendelse
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {requests.map((request) => (
                  <div key={request.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex flex-col">
                      <span className="font-medium">{getDisplayName(request.profile)}</span>
                      <span className="text-sm text-muted-foreground">
                        Anmodet: {new Date(request.created_at).toLocaleDateString('da-DK')}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button 
                        size="sm" 
                        onClick={() => approveRequest(request)}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        <Check className="h-4 w-4 mr-1" />
                        Godkend
                      </Button>
                      <Button 
                        size="sm" 
                        variant="destructive"
                        onClick={() => rejectRequest(request)}
                      >
                        <X className="h-4 w-4 mr-1" />
                        Afvis
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Current Members Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Nuværende medlemmer
              <Badge variant="outline">{members.length}</Badge>
            </CardTitle>
            <CardDescription>
              Alle medlemmer af ligaen
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {members.map((member) => (
                <div key={member.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="flex flex-col">
                      <span className="font-medium">{getDisplayName(member.profile)}</span>
                      <span className="text-sm text-muted-foreground">
                        Medlem siden: {new Date(member.joined_at).toLocaleDateString('da-DK')}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {member.user_id === leagueInfo.admin_user_id ? (
                      <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300">
                        <Crown className="h-3 w-3 mr-1" />
                        Admin
                      </Badge>
                    ) : member.role === 'moderator' ? (
                      <Badge variant="secondary">
                        <Shield className="h-3 w-3 mr-1" />
                        Moderator
                      </Badge>
                    ) : (
                      <Badge variant="outline">Medlem</Badge>
                    )}
                  </div>
                </div>
              ))}
              {members.length === 0 && (
                <div className="text-center py-8">
                  <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">Ingen medlemmer endnu</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Empty state for requests when admin */}
        {isAdmin && requests.length === 0 && (
          <Card className="bg-muted/30">
            <CardContent className="py-8 text-center">
              <Clock className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold text-muted-foreground mb-2">
                Ingen ventende anmodninger
              </h3>
              <p className="text-sm text-muted-foreground">
                Der er ingen anmodninger om medlemskab, der venter på godkendelse
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}