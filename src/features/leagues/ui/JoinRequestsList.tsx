import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Check, X, UserPlus } from 'lucide-react';
import { JoinRequest } from '../types';

export interface JoinRequestsListProps {
  requests: JoinRequest[];
  actionLoading: string | null;
  onApproveRequest: (request: JoinRequest) => void;
  onRejectRequest: (request: JoinRequest) => void;
}

export function JoinRequestsList({
  requests,
  actionLoading,
  onApproveRequest,
  onRejectRequest
}: JoinRequestsListProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserPlus className="h-5 w-5" />
          Anmodninger
          {requests.length > 0 && (
            <Badge variant="secondary">{requests.length}</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {requests.map((request) => (
            <div key={request.id} className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="font-medium">{request.display_name}</p>
                <p className="text-xs text-muted-foreground">
                  Modtaget {new Date(request.created_at).toLocaleDateString('da-DK')} kl. {new Date(request.created_at).toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => onApproveRequest(request)}
                  disabled={actionLoading === request.id}
                >
                  <Check className="mr-1 h-4 w-4" />
                  Accepter
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  onClick={() => onRejectRequest(request)}
                  disabled={actionLoading === request.id}
                >
                  <X className="mr-1 h-4 w-4" />
                  Afvis
                </Button>
              </div>
            </div>
          ))}
          {requests.length === 0 && (
            <p className="text-center text-sm text-muted-foreground">Ingen anmodninger endnu</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}