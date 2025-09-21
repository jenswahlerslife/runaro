import React, { memo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Crown, Shield, Trash2, ChevronUp, ChevronDown } from 'lucide-react';

interface Member {
  id: string;
  user_id: string;
  display_name: string;
  role: 'owner' | 'admin' | 'member';
  joined_at: string;
}

interface MembersListProps {
  members: Member[];
  isAdmin: boolean;
  sortField: 'display_name' | 'role' | 'joined_at';
  sortDirection: 'asc' | 'desc';
  onSortChange: (field: 'display_name' | 'role' | 'joined_at') => void;
  onRoleChange: (memberId: string, newRole: 'admin' | 'member') => Promise<void>;
  onRemoveMember: (memberId: string) => Promise<void>;
}

const MembersList = memo<MembersListProps>(({
  members,
  isAdmin,
  sortField,
  sortDirection,
  onSortChange,
  onRoleChange,
  onRemoveMember
}) => {
  const SortButton = memo<{ field: 'display_name' | 'role' | 'joined_at'; children: React.ReactNode }>(
    ({ field, children }) => (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onSortChange(field)}
        className="h-8 px-2"
      >
        {children}
        {sortField === field && (
          sortDirection === 'asc' ? <ChevronUp className="ml-1 h-3 w-3" /> : <ChevronDown className="ml-1 h-3 w-3" />
        )}
      </Button>
    )
  );

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'owner': return <Crown className="h-3 w-3 text-yellow-500" />;
      case 'admin': return <Shield className="h-3 w-3 text-blue-500" />;
      default: return null;
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'owner': return 'default' as const;
      case 'admin': return 'secondary' as const;
      default: return 'outline' as const;
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm text-gray-600 px-2">
        <SortButton field="display_name">Navn</SortButton>
        <SortButton field="role">Rolle</SortButton>
        <SortButton field="joined_at">Tilmeldt</SortButton>
        {isAdmin && <div className="w-20">Handlinger</div>}
      </div>

      {members.map((member) => (
        <div key={member.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center space-x-3 flex-1 min-w-0">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{member.display_name}</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Badge variant={getRoleBadgeVariant(member.role)} className="flex items-center space-x-1">
              {getRoleIcon(member.role)}
              <span className="capitalize">{member.role === 'owner' ? 'ejer' : member.role === 'admin' ? 'admin' : 'medlem'}</span>
            </Badge>

            <span className="text-xs text-gray-500">
              {new Date(member.joined_at).toLocaleDateString('da-DK')}
            </span>

            {isAdmin && member.role !== 'owner' && (
              <div className="flex items-center space-x-1">
                {member.role === 'member' && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onRoleChange(member.id, 'admin')}
                    className="h-6 px-2 text-xs"
                  >
                    Gør til admin
                  </Button>
                )}
                {member.role === 'admin' && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onRoleChange(member.id, 'member')}
                    className="h-6 px-2 text-xs"
                  >
                    Fjern admin
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onRemoveMember(member.id)}
                  className="h-6 px-2 text-xs text-red-600 hover:text-red-700"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
});

MembersList.displayName = 'MembersList';

export default MembersList;