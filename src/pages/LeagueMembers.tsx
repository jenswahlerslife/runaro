import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { ArrowLeft, Check, X, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface Member {
  id: string;
  user_id: string;
  display_name: string;
  role: string;
}

interface JoinRequest {
  id: string;
  user_id: string;
  display_name: string;
  created_at: string;
}

export default function LeagueMembers() {
  const { leagueId } = useParams<{ leagueId: string }>();
  const { user } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [requests, setRequests] = useState<JoinRequest[]>([]);

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

      // 1) Find brugerens rolle i ligaen
      const { data: roleRow, error: roleError } = await supabase
        .from('league_members')
        .select('role')
        .eq('league_id', leagueId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (roleError) {
        console.error('Error checking user role:', roleError);
      }

      // Sæt admin status baseret på rolle
      const userIsAdmin = roleRow && ['owner', 'admin'].includes(roleRow.role);
      setIsAdmin(userIsAdmin || false);

      // 2) Hent medlemmer via view (alle medlemmer i samme liga må se hinanden)
      const { data: membersData, error: membersError } = await supabase
        .from('league_members_view')
        .select('id, user_id, display_name, role')
        .eq('league_id', leagueId)
        .order('role', { ascending: false }); // owner/admin øverst

      if (membersError) {
        console.error('Error loading members:', membersError);
        throw membersError;
      }

      setMembers(membersData || []);

      // 3) Hent join requests KUN hvis admin/owner
      if (userIsAdmin) {
        const { data: requestsData, error: requestsError } = await supabase
          .from('league_join_requests_view')
          .select('id, user_id, display_name, created_at')
          .eq('league_id', leagueId)
          .eq('status', 'pending')
          .order('created_at', { ascending: true });

        if (requestsError) {
          console.error('Error loading requests:', requestsError);
          // Don't throw here - requests are optional for admins
        } else {
          setRequests(requestsData || []);
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

  const approveRequest = async (request: JoinRequest) => {
    try {
      // Add user to league_members
      const { error: insertError } = await supabase
        .from('league_members')
        .insert({
          league_id: leagueId,
          user_id: request.user_id,
          role: 'member',
        });

      if (insertError) throw insertError;

      // Update request status to approved
      const { error: updateError } = await supabase
        .from('league_join_requests')
        .update({ status: 'approved' })
        .eq('id', request.id);

      if (updateError) throw updateError;

      toast({
        title: "Anmodning godkendt!",
        description: `${request.display_name} er nu medlem af ligaen`,
      });

      // Reload data
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
      const { error } = await supabase
        .from('league_join_requests')
        .update({ status: 'rejected' })
        .eq('id', request.id);

      if (error) throw error;

      toast({
        title: "Anmodning afvist",
        description: `Anmodning fra ${request.display_name} er afvist`,
      });

      // Reload data
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
      <div className="mx-auto max-w-3xl p-6">
        <h1 className="mb-6 text-center text-2xl font-semibold">Members</h1>

        {/* Members Section */}
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-medium">Nuværende medlemmer</h2>
          <div className="grid gap-2">
            {members.map((member) => (
              <div key={member.id} className="flex items-center justify-between rounded-xl border p-3">
                <span className="font-medium">{member.display_name}</span>
                <span className="text-xs text-muted-foreground">{member.role}</span>
              </div>
            ))}
            {members.length === 0 && (
              <p className="text-sm text-muted-foreground">Ingen medlemmer endnu.</p>
            )}
          </div>
        </section>

        {/* Join Requests Section (only for admins/owners) */}
        {isAdmin && (
          <section>
            <h2 className="mb-3 text-lg font-medium">Ventende anmodninger</h2>
            <div className="grid gap-2">
              {requests.map((request) => (
                <div key={request.id} className="flex items-center justify-between rounded-xl border p-3">
                  <div className="flex flex-col">
                    <span className="font-medium">{request.display_name}</span>
                    <span className="text-xs text-muted-foreground">
                      Modtaget: {new Date(request.created_at).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" onClick={() => approveRequest(request)}>
                      <Check className="mr-1 h-4 w-4" />
                      Godkend
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => rejectRequest(request)}>
                      <X className="mr-1 h-4 w-4" />
                      Afvis
                    </Button>
                  </div>
                </div>
              ))}
              {requests.length === 0 && (
                <p className="text-sm text-muted-foreground">Ingen ventende anmodninger.</p>
              )}
            </div>
          </section>
        )}
      </div>
    </Layout>
  );
}