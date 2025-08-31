import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const STRAVA_CLIENT_ID = '174654';
const REDIRECT_URI = 'https://runaro.dk/auth/strava/callback'; // Server-side redirect til edge function

interface StravaConnectProps {
  onConnected?: () => void;
}

const StravaConnect = ({ onConnected }: StravaConnectProps) => {
  const [isConnecting, setIsConnecting] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  const toBase64Url = (obj: any) => {
    const json = JSON.stringify(obj);
    return btoa(json).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  };

  const connectStrava = () => {
    if (!user) {
      toast({
        title: "Fejl",
        description: "Du skal være logget ind for at forbinde Strava",
        variant: "destructive",
      });
      return;
    }

    setIsConnecting(true);
    
    const origin = window.location.origin;
    const returnUrl = origin.includes('localhost')
      ? `${origin}/strava/success`
      : 'https://runaro.dk/strava/success';

    const statePayload = {
      userId: user.id,
      returnUrl,
      nonce: crypto.getRandomValues(new Uint32Array(1))[0].toString(36),
      ts: Date.now(),
    };
    
    const STATE = toBase64Url(statePayload);
    const scope = 'read,activity:read_all';
    
    const authUrl = new URL('https://www.strava.com/oauth/authorize');
    authUrl.searchParams.set('client_id', STRAVA_CLIENT_ID);
    authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', scope);
    authUrl.searchParams.set('state', STATE);
    authUrl.searchParams.set('approval_prompt', 'force');
    
    // Redirect to Strava authorization page
    window.location.href = authUrl.toString();
  };

  return (
    <Card className="w-full max-w-md mx-auto shadow-2xl border-0 bg-white/95 backdrop-blur-lg rounded-3xl overflow-hidden">
      <CardHeader className="text-center pb-4">
        <CardTitle className="flex items-center justify-center gap-4 mb-4">
          <img 
            src="/lovable-uploads/bfdfc53b-d36b-4f82-b2d5-2038baf41b89.png" 
            alt="Strava Logo" 
            className="w-16 h-16"
          />
          <img 
            src="/lovable-uploads/130dc921-c91a-440f-b07a-6bd6740a874e.png" 
            alt="Strava" 
            className="h-12"
          />
        </CardTitle>
        <CardDescription className="text-lg text-gray-600">
          Forbind din Strava konto for automatisk at importere dine aktiviteter
        </CardDescription>
      </CardHeader>
      <CardContent className="p-6">
        <Button 
          onClick={connectStrava}
          disabled={isConnecting}
          className="w-full h-14 text-lg font-bold bg-[#FC4C02] hover:bg-[#e63c00] text-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-200"
        >
          {isConnecting ? (
            <div className="flex items-center gap-3">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              <span>Forbinder...</span>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <img 
                src="/lovable-uploads/bfdfc53b-d36b-4f82-b2d5-2038baf41b89.png" 
                alt="Strava" 
                className="w-6 h-6"
              />
              <span>Forbind Strava</span>
            </div>
          )}
        </Button>
      </CardContent>
    </Card>
  );
};

export default StravaConnect;