import { useState, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Member, JoinRequest, SearchUser, League } from '../types';
import { memberService, LeagueDataResult } from '../services/memberService';
import { useToast } from '@/components/ui/use-toast';

export interface UseLeagueMembersProps {
  leagueId: string;
  userId: string;
}

export interface UseLeagueMembersReturn {
  // Data
  league: League | null;
  members: Member[];
  requests: JoinRequest[];
  searchResults: SearchUser[];

  // Permissions
  isAdmin: boolean;
  isOwner: boolean;

  // Loading states
  loading: boolean;
  searching: boolean;
  actionLoading: string | null;
  notFound: boolean;

  // Search
  searchTerm: string;
  setSearchTerm: (term: string) => void;

  // Actions
  refreshData: () => Promise<void>;
  approveRequest: (request: JoinRequest) => Promise<void>;
  rejectRequest: (request: JoinRequest) => Promise<void>;
  addUserToLeague: (user: SearchUser) => Promise<void>;
  removeMember: (member: Member) => Promise<void>;
  changeRole: (member: Member, newRole: 'admin' | 'member') => Promise<void>;
}

export function useLeagueMembers({ leagueId, userId }: UseLeagueMembersProps): UseLeagueMembersReturn {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // State
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

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setNotFound(false);

      if (!userId) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      const result: LeagueDataResult = await memberService.loadLeagueData(leagueId, userId);

      setLeague(result.league);
      setIsAdmin(result.isAdmin);
      setIsOwner(result.isOwner);
      setMembers(result.members);
      setRequests(result.requests);
      setLoading(false);
    } catch (error) {
      console.error('Error loading league data:', error);
      setNotFound(true);
      setLoading(false);
    }
  }, [leagueId, userId]);

  // Load data on mount
  useEffect(() => {
    if (!leagueId || !userId) return;
    loadData();
  }, [loadData]);

  // Debounced search function
  const searchUsers = useCallback(async (term: string) => {
    if (!term.trim() || !isAdmin || !league) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      const results = await memberService.searchUsers(term, members, requests, userId);
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
  }, [isAdmin, league, members, requests, userId, toast]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => searchUsers(searchTerm), 300);
    return () => clearTimeout(timer);
  }, [searchTerm, searchUsers]);

  const approveRequest = async (request: JoinRequest) => {
    console.log('🚀 Approve request called for:', request.display_name, request.id);
    setActionLoading(request.id);

    // Optimistic update: remove request and add member immediately
    const optimisticMember: Member = {
      id: `temp-${request.user_id}`,
      user_id: request.user_id,
      display_name: request.display_name,
      role: 'member',
      joined_at: new Date().toISOString()
    };

    const originalRequests = [...requests];
    const originalMembers = [...members];

    const newRequests = requests.filter(r => r.id !== request.id);
    const newMembers = [...members, optimisticMember];

    setRequests(newRequests);
    setMembers(newMembers);

    try {
      await memberService.approveJoinRequest(request.id);

      toast({
        title: "Anmodning godkendt!",
        description: `${request.display_name} er nu medlem af ligaen`,
      });

      // Reload data to get correct IDs and updated data
      await loadData();

      // Also invalidate my-leagues query so "Your leagues" panel updates
      queryClient.invalidateQueries({ queryKey: ['my-leagues'] });
    } catch (error: any) {
      // Rollback optimistic update on error
      setRequests(originalRequests);
      setMembers(originalMembers);

      console.error('Error approving request:', error);
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

    // Optimistic update: remove request immediately
    const originalRequests = [...requests];
    const newRequests = requests.filter(r => r.id !== request.id);
    setRequests(newRequests);

    try {
      await memberService.rejectJoinRequest(request.id);

      toast({
        title: "Anmodning afvist",
        description: `Anmodning fra ${request.display_name} er afvist`,
      });

      // Reload data to ensure consistency
      await loadData();

      // Also invalidate my-leagues query so "Your leagues" panel updates
      queryClient.invalidateQueries({ queryKey: ['my-leagues'] });
    } catch (error: any) {
      // Rollback optimistic update on error
      setRequests(originalRequests);

      console.error('Error rejecting request:', error);
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

    setActionLoading(searchUser.user_id);
    try {
      await memberService.addUserToLeague(leagueId, searchUser.user_id);

      toast({
        title: "Medlem tilføjet!",
        description: `${searchUser.display_name} er nu medlem af ligaen`,
      });

      // Clear search and reload data
      setSearchTerm('');
      await loadData();
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
    if (!isOwner || member.user_id === userId) return;

    setActionLoading(member.id);
    try {
      await memberService.removeMember(member.id);

      toast({
        title: "Medlem fjernet",
        description: `${member.display_name} er fjernet fra ligaen`,
      });

      await loadData();
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
    if (!isOwner || member.user_id === userId) return;

    setActionLoading(member.id);
    try {
      await memberService.changeRole(member.id, newRole);

      toast({
        title: "Rolle ændret",
        description: `${member.display_name} er nu ${newRole === 'admin' ? 'administrator' : 'medlem'}`,
      });

      await loadData();
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

  return {
    // Data
    league,
    members,
    requests,
    searchResults,

    // Permissions
    isAdmin,
    isOwner,

    // Loading states
    loading,
    searching,
    actionLoading,
    notFound,

    // Search
    searchTerm,
    setSearchTerm,

    // Actions
    refreshData: loadData,
    approveRequest,
    rejectRequest,
    addUserToLeague,
    removeMember,
    changeRole,
  };
}