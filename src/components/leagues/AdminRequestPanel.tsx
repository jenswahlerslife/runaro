import React, { memo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, X, Users } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { da } from 'date-fns/locale';

interface JoinRequest {
  id: string;
  user_id: string;
  display_name: string;
  created_at: string;
  note?: string;
}

interface AdminRequestPanelProps {
  requests: JoinRequest[];
  onApprove: (requestId: string) => Promise<void>;
  onDecline: (requestId: string) => Promise<void>;
  isProcessing: boolean;
}

const AdminRequestPanel = memo<AdminRequestPanelProps>(({
  requests,
  onApprove,
  onDecline,
  isProcessing
}) => {
  const handleApprove = useCallback(async (requestId: string) => {
    await onApprove(requestId);
  }, [onApprove]);

  const handleDecline = useCallback(async (requestId: string) => {
    await onDecline(requestId);
  }, [onDecline]);

  if ((requests ?? []).length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Users className="h-5 w-5" />
          <span>Ansøgninger ({(requests ?? []).length})</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {(requests ?? []).map((request) => (
            <div key={request.id} className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2">
                  <p className="text-sm font-medium truncate">{request.display_name}</p>
                  <Badge variant="outline">Afventer</Badge>
                </div>
                <p className="text-xs text-gray-500">
                  {formatDistanceToNow(new Date(request.created_at), {
                    addSuffix: true,
                    locale: da
                  })}
                </p>
                {request.note && (
                  <p className="text-xs text-gray-600 mt-1 italic">
                    "{request.note}"
                  </p>
                )}
              </div>
              <div className="flex items-center space-x-2 ml-3">
                <Button
                  size="sm"
                  onClick={() => handleApprove(request.id)}
                  disabled={isProcessing}
                  className="bg-green-600 hover:bg-green-700 text-white h-8 px-3"
                >
                  <Check className="h-3 w-3 mr-1" />
                  Godkend
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleDecline(request.id)}
                  disabled={isProcessing}
                  className="text-red-600 hover:text-red-700 border-red-200 hover:border-red-300 h-8 px-3"
                >
                  <X className="h-3 w-3 mr-1" />
                  Afvis
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
});

AdminRequestPanel.displayName = 'AdminRequestPanel';

export default AdminRequestPanel;