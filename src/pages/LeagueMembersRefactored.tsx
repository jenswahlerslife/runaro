import { Link, useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '@/hooks/useSubscription';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Users } from 'lucide-react';
import {
  useLeagueMembers,
  useActiveGame,
  MembersList,
  JoinRequestsList,
  UserSearch,
  ActiveGameCard
} from '@/features/leagues';

export default function LeagueMembersRefactored() {
  const { leagueId } = useParams<{ leagueId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { isPro } = useSubscription();

  const {
    league,
    members,
    requests,
    searchResults,
    isAdmin,
    isOwner,
    loading,
    searching,
    actionLoading,
    notFound,
    searchTerm,
    setSearchTerm,
    approveRequest,
    rejectRequest,
    addUserToLeague,
    removeMember,
    changeRole,
  } = useLeagueMembers({
    leagueId: leagueId!,
    userId: user?.id!
  });

  const { activeGame, timeLeftLabel } = useActiveGame(leagueId!);

  const handleNavigateToGame = () => {
    if (!activeGame) return;
    const path = activeGame.status === "setup"
      ? `/games/${activeGame.id}/setup`
      : `/games/${activeGame.id}`;
    navigate(path);
  };

  const handleAddUserWithPlanCheck = async (searchUser: any) => {
    const currentMemberCount = members.length;
    const maxMembers = isPro ? 50 : 3;

    if (currentMemberCount >= maxMembers) {
      // This will be handled by the toast in the hook
      return;
    }

    await addUserToLeague(searchUser);
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
          <MembersList
            members={members}
            currentUserId={user?.id!}
            isOwner={isOwner}
            actionLoading={actionLoading}
            onChangeRole={changeRole}
            onRemoveMember={removeMember}
          />

          {/* Active Game Section */}
          {activeGame && (
            <ActiveGameCard
              activeGame={activeGame}
              timeLeftLabel={timeLeftLabel}
              onNavigateToGame={handleNavigateToGame}
            />
          )}

          {/* Join Requests Section (only for admins/owners) */}
          {isAdmin && (
            <JoinRequestsList
              requests={requests}
              actionLoading={actionLoading}
              onApproveRequest={approveRequest}
              onRejectRequest={rejectRequest}
            />
          )}

          {/* User Search Section (only for admins/owners) */}
          {isAdmin && (
            <UserSearch
              league={league}
              searchTerm={searchTerm}
              onSearchTermChange={setSearchTerm}
              searchResults={searchResults}
              searching={searching}
              actionLoading={actionLoading}
              memberCount={members.length}
              isPro={isPro}
              onAddUser={handleAddUserWithPlanCheck}
            />
          )}
        </div>
      </div>
    </Layout>
  );
}
