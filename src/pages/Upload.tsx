import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import StravaConnect from '@/components/StravaConnect';
import { Upload as UploadIcon, CheckCircle, FileText, ArrowRight } from 'lucide-react';
import Layout from '@/components/Layout';

const Upload = () => {
  console.log('🚀 Upload component rendered');
  const { user } = useAuth();
  const navigate = useNavigate();
  const [hasStravaConnection, setHasStravaConnection] = useState(false);
  const [loading, setLoading] = useState(true);

  // Read gameId from query parameters
  const params = new URLSearchParams(window.location.search);
  const gameId = params.get("gameId");

  useEffect(() => {
    if (user) {
      checkStravaConnection();
    }
  }, [user]);

  // Auto-redirect when Strava is connected
  useEffect(() => {
    console.log('Upload useEffect triggered:', { hasStravaConnection, loading, user: !!user, gameId });
    if (hasStravaConnection && !loading) {
      const targetUrl = gameId ? `/games/${gameId}/setup` : '/strava/success';
      console.log(`Strava connected, redirecting to ${targetUrl} in 2 seconds...`);
      const timer = setTimeout(() => {
        console.log(`Executing redirect to ${targetUrl}`);
        navigate(targetUrl);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [hasStravaConnection, loading, navigate, gameId]);

  const checkStravaConnection = async () => {
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('strava_access_token')
        .eq('user_id', user?.id)
        .maybeSingle();

      if (error) throw error;
      
      const connected = !!profile?.strava_access_token;
      console.log('Strava connection check:', connected);
      setHasStravaConnection(connected);
    } catch (error) {
      console.error('Error checking Strava connection:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-br from-blue-400 via-blue-500 to-blue-600 relative overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-20 left-10 w-32 h-32 bg-yellow-300/20 rounded-full blur-3xl"></div>
        <div className="absolute top-40 right-20 w-48 h-48 bg-yellow-400/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-32 left-32 w-64 h-64 bg-yellow-300/15 rounded-full blur-3xl"></div>
        <div className="absolute bottom-10 right-10 w-40 h-40 bg-blue-300/20 rounded-full blur-2xl"></div>
      </div>

      <div className="container mx-auto px-4 py-12 max-w-4xl relative z-10">
        {/* Header Section */}
        <div className="text-center mb-16 animate-fade-in">
          <div className="flex items-center justify-center gap-6 mb-6">
            <div>
              <h1 className="text-6xl font-black text-white drop-shadow-lg">
                Start med at erobr territorium
              </h1>
              <p className="text-2xl text-blue-100 mt-3 drop-shadow">
                Forbind til Strava
              </p>
            </div>
          </div>
        </div>

        {/* Strava Connection Section */}
        {!hasStravaConnection ? (
          <div className="flex justify-center animate-fade-in">
            <div className="max-w-lg w-full">
              <div className="bg-white/95 backdrop-blur-lg rounded-3xl p-8 shadow-2xl border-2 border-yellow-400/30">
                <StravaConnect onConnected={() => {
                console.log('StravaConnect onConnected triggered');
                setHasStravaConnection(true);
                setLoading(false);
              }} />
              </div>
            </div>
          </div>
        ) : (
          // Connected State - Success Message with auto-redirect
          <div className="max-w-2xl mx-auto">
            {/* Success Card */}
            <Card className="shadow-2xl border-0 bg-gradient-to-r from-green-400 to-emerald-500 mb-8 animate-scale-in rounded-3xl overflow-hidden">
              <CardContent className="p-10">
                <div className="flex items-center gap-6">
                  <div className="p-4 rounded-2xl bg-white/20 backdrop-blur">
                    <CheckCircle className="h-12 w-12 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-3xl font-black text-white mb-3 drop-shadow">
                      Strava Forbundet! 🔥 BUILD MARKER v2.0 🔥
                    </h3>
                    <p className="text-green-100 text-xl drop-shadow">
                      Sender dig videre til dine aktiviteter...
                    </p>
                    <div className="mt-4">
                      <Button
                        onClick={() => navigate(gameId ? `/games/${gameId}/setup` : '/strava/success')}
                        className="bg-white/20 hover:bg-white/30 text-white border-white/30"
                        size="lg"
                      >
                        <span>{gameId ? "Gå til base-opsætning" : "Gå til mine aktiviteter"}</span>
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                    </div>
                  </div>
                  <div className="p-3 rounded-2xl bg-white/20 backdrop-blur">
                    <svg className="w-16 h-16" viewBox="0 0 24 24" fill="white">
                      <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.599h3.065L5.38 0L0 10.172h3.065" />
                    </svg>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Info Section */}
            <div className="p-8 bg-white/95 backdrop-blur-lg border-2 border-yellow-400/30 rounded-3xl shadow-2xl">
              <h4 className="font-black text-blue-900 text-2xl mb-6 flex items-center gap-3">
                <div className="p-2 rounded-xl bg-yellow-400/20">
                  <FileText className="h-6 w-6 text-blue-700" />
                </div>
                Hvordan det virker
              </h4>
              <ul className="space-y-4 text-blue-800">
                <li className="flex items-start gap-4">
                  <div className="w-3 h-3 rounded-full bg-gradient-to-r from-yellow-400 to-yellow-500 mt-2 flex-shrink-0"></div>
                  <span className="text-xl font-medium">Dine Strava aktiviteter importeres automatisk</span>
                </li>
                <li className="flex items-start gap-4">
                  <div className="w-3 h-3 rounded-full bg-gradient-to-r from-yellow-400 to-yellow-500 mt-2 flex-shrink-0"></div>
                  <span className="text-xl font-medium">Kun løb og gang aktiviteter bruges til territorium</span>
                </li>
                <li className="flex items-start gap-4">
                  <div className="w-3 h-3 rounded-full bg-gradient-to-r from-yellow-400 to-yellow-500 mt-2 flex-shrink-0"></div>
                  <span className="text-xl font-medium">Minimum 2 kilometer for at erobre territorium</span>
                </li>
              </ul>
            </div>
          </div>
        )}
      </div>
      </div>
    </Layout>
  );
};

export default Upload;
