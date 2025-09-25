// League domain types
export interface Member {
  id: string;
  user_id: string;
  display_name: string;
  role: 'owner' | 'admin' | 'member';
  joined_at: string;
}

export interface JoinRequest {
  id: string;
  user_id: string;
  display_name: string;
  created_at: string;
  note?: string;
}

export interface SearchUser {
  user_id: string;
  display_name: string;
  username?: string;
  email?: string;
  status: 'can_add' | 'member' | 'pending';
}

export interface League {
  id: string;
  name: string;
  max_members: number;
  admin_user_id: string;
}

export interface ActiveGame {
  id: string;
  name: string;
  status: "setup" | "active" | "finished";
  end_at: string | null;
  time_left_seconds: number | null;
  finished_at?: string | null;
  winner_user_id?: string | null;
}

export type UserRole = 'owner' | 'admin' | 'member';

export interface LeaguePermissions {
  canManageMembers: boolean;
  canApproveRequests: boolean;
  canRemoveMembers: boolean;
  canChangeRoles: boolean;
}