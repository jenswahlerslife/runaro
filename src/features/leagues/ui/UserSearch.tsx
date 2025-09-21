import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Search, UserPlus } from 'lucide-react';
import { SearchUser, League } from '../types';

export interface UserSearchProps {
  league: League | null;
  searchTerm: string;
  onSearchTermChange: (term: string) => void;
  searchResults: SearchUser[];
  searching: boolean;
  actionLoading: string | null;
  memberCount: number;
  isPro: boolean;
  onAddUser: (user: SearchUser) => void;
}

export function UserSearch({
  league,
  searchTerm,
  onSearchTermChange,
  searchResults,
  searching,
  actionLoading,
  memberCount,
  isPro,
  onAddUser
}: UserSearchProps) {
  const maxMembers = isPro ? 50 : 3;
  const isLeagueFull = memberCount >= maxMembers;
  const spotsLeft = maxMembers - memberCount;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Search className="h-5 w-5" />
          Søg og tilføj medlemmer
        </CardTitle>
        {league && (
          <p className="text-sm text-muted-foreground">
            {isLeagueFull ? (
              <span className="text-destructive font-medium">
                Ligaen er fuld ({maxMembers} medlemmer max for din plan)
              </span>
            ) : (
              `${spotsLeft} pladser tilbage`
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
              onChange={(e) => onSearchTermChange(e.target.value)}
              className="pl-9"
              disabled={isLeagueFull}
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
                        onClick={() => onAddUser(user)}
                        disabled={actionLoading === user.user_id || isLeagueFull}
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
  );
}