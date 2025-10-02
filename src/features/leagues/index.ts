// Export public types
export type {
  Member,
  JoinRequest,
  SearchUser,
  League,
  ActiveGame,
  UserRole,
  LeaguePermissions
} from './types';

// Export hooks
export { useLeagueMembers } from './hooks/useLeagueMembers';
export { useActiveGame } from './hooks/useActiveGame';

// Export UI components
export { MembersList } from './ui/MembersList';
export { JoinRequestsList } from './ui/JoinRequestsList';
export { UserSearch } from './ui/UserSearch';
export { ActiveGameCard } from './ui/ActiveGameCard';
export { SetupGameCard } from './ui/SetupGameCard';
export { RoleDisplay, getRoleIcon } from './ui/RoleDisplay';

// Export services (for advanced usage)
export { memberService } from './services/memberService';
export type { LeagueDataResult } from './services/memberService';

// Export domain ports (for testing/mocking)
export type { LeagueRepository, UserRepository } from './domain/ports/LeagueRepository';
export { LeagueMemberService } from './domain/LeagueMemberService';

// Export infrastructure (for dependency injection)
export { SupabaseLeagueRepository, supabaseLeagueRepository } from './infrastructure/SupabaseLeagueRepository';