import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChevronUp, ChevronDown, Trash2, Users } from 'lucide-react';
import { Member } from '../types';
import { RoleDisplay, getRoleIcon } from './RoleDisplay';

export interface MembersListProps {
  members: Member[];
  currentUserId: string;
  isOwner: boolean;
  actionLoading: string | null;
  onChangeRole: (member: Member, newRole: 'admin' | 'member') => void;
  onRemoveMember: (member: Member) => void;
}

export function MembersList({
  members,
  currentUserId,
  isOwner,
  actionLoading,
  onChangeRole,
  onRemoveMember
}: MembersListProps) {
  return (
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
            const isCurrentUser = member.user_id === currentUserId;
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
                  <RoleDisplay role={member.role} size="sm" showIcon={false} />
                  {canManage && (
                    <div className="flex items-center gap-1">
                      {member.role === 'member' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onChangeRole(member, 'admin')}
                          disabled={actionLoading === member.id}
                        >
                          <ChevronUp className="h-3 w-3" />
                        </Button>
                      )}
                      {member.role === 'admin' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onChangeRole(member, 'member')}
                          disabled={actionLoading === member.id}
                        >
                          <ChevronDown className="h-3 w-3" />
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onRemoveMember(member)}
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
  );
}