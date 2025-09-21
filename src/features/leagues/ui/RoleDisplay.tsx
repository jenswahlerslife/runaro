import { Badge } from '@/components/ui/badge';
import { Crown, Shield, Users } from 'lucide-react';
import { UserRole } from '../types';

export interface RoleDisplayProps {
  role: UserRole;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  showText?: boolean;
}

export function RoleDisplay({
  role,
  size = 'md',
  showIcon = true,
  showText = true
}: RoleDisplayProps) {
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

  const getRoleText = (role: string) => {
    switch (role) {
      case 'owner': return 'Ejer';
      case 'admin': return 'Admin';
      case 'member': return 'Medlem';
      default: return 'Medlem';
    }
  };

  const RoleIcon = getRoleIcon(role);
  const iconSize = size === 'sm' ? 3 : size === 'lg' ? 5 : 4;

  return (
    <div className="flex items-center gap-2">
      {showIcon && <RoleIcon className={`h-${iconSize} w-${iconSize} text-muted-foreground`} />}
      {showText && (
        <Badge variant={getRoleBadgeVariant(role)}>
          {getRoleText(role)}
        </Badge>
      )}
    </div>
  );
}

export function getRoleIcon(role: UserRole) {
  switch (role) {
    case 'owner': return Crown;
    case 'admin': return Shield;
    case 'member': return Users;
    default: return Users;
  }
}