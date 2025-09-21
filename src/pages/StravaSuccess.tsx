import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { MapPin, Clock, Zap, ArrowRight, Upload } from 'lucide-react';

import type { StravaActivity } from '@/types/strava';

const StravaSuccess = () => {
  const navigate = useNavigate();
  const [activities, setActivities] = useState<StravaActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [transferring, setTransferring] = useState<number | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    const fetchRecentActivities = async () => {
      if (!user) return;

      try {
        console.log('Calling strava-activities function...');
        // Call edge function to get recent activities
        const { data, error } = await supabase.functions.invoke('strava-activities', {
          body: { limit: 10 }
        });

        console.log('Strava activities response:', { data, error });

        if (error) {
          console.error('Error fetching activities:', error);
          toast({
            title: "Fejl",
            description: `Kunne ikke hente dine løberuter fra Strava: ${error.message}`,
            variant: "destructive",
          });
          return;
        }

        setActivities(data.activities || []);
      } catch (error) {
        console.error('Error:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchRecentActivities();
  }, [user, toast]);

  // Formatting helpers moved to shared util for reuse and testing
  import { formatDistance, formatTime, formatSpeed } from '@/utils/format';

  const handleTransferActivity = async (activity: StravaActivity) => {
    setTransferring(activity.id);

    try {
      // Call edge function to transfer activity to game
      const { error } = await supabase.functions.invoke('transfer-activity', {
        body: { activityId: activity.id }
      });

      if (error) {
        throw error;
      }

      toast({
        title: "Aktivitet overført!",
        description: `"${activity.name}" er nu tilføjet til spillet. Sender dig til kortet...`,
      });

      // Remove transferred activity from list
      setActivities(prev => prev.filter(a => a.id !== activity.id));

      // Redirect to map page to see the territory with activity ID and animation
      setTimeout(() => {
        console.log('Redirecting to /map to show territory with animation...');
        navigate(`/map?aid=${activity.id}&animate=true`);
      }, 1500);
    } catch (error: any) {
      console.error('Transfer error:', error);
      toast({
        title: "Fejl ved overførsel",
        description: error.message || "Kunne ikke overføre aktiviteten",
        variant: "destructive",
      });
    } finally {
      setTransferring(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Henter dine løberuter...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-blue-50 to-purple-50 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Success Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Strava Forbundet!</h1>
          <p className="text-lg text-gray-600">Dine seneste løberuter er klar til at blive overført til spillet</p>
        </div>

        {/* Activities Grid */}
        {activities.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2">
            {activities.map((activity) => (
              <Card key={activity.id} className="shadow-lg border-0 bg-white/95 backdrop-blur-lg">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg font-semibold text-gray-900 mb-1">
                        {activity.name}
                      </CardTitle>
                      <CardDescription className="flex items-center gap-2">
                        <Badge variant="secondary" className="bg-orange-100 text-orange-800">
                          {activity.type}
                        </Badge>
                        <span className="text-sm text-gray-500">
                          {new Date(activity.start_date).toLocaleDateString('da-DK')}
                        </span>
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center">
                      <div className="flex items-center justify-center mb-1">
                        <MapPin className="w-4 h-4 text-blue-500" />
                      </div>
                      <p className="text-sm font-semibold text-gray-900">
                        {formatDistance(activity.distance)}
                      </p>
                      <p className="text-xs text-gray-500">Distance</p>
                    </div>
                    <div className="text-center">
                      <div className="flex items-center justify-center mb-1">
                        <Clock className="w-4 h-4 text-green-500" />
                      </div>
                      <p className="text-sm font-semibold text-gray-900">
                        {formatTime(activity.moving_time)}
                      </p>
                      <p className="text-xs text-gray-500">Tid</p>
                    </div>
                    <div className="text-center">
                      <div className="flex items-center justify-center mb-1">
                        <Zap className="w-4 h-4 text-purple-500" />
                      </div>
                      <p className="text-sm font-semibold text-gray-900">
                        {formatSpeed(activity.average_speed)}
                      </p>
                      <p className="text-xs text-gray-500">Hastighed</p>
                    </div>
                  </div>

                  {/* Transfer Button */}
                  <Button
                    onClick={() => handleTransferActivity(activity)}
                    disabled={transferring === activity.id}
                    className="w-full h-12 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-medium rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl"
                  >
                    {transferring === activity.id ? (
                      <div className="flex items-center gap-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        <span>Overfører...</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Upload className="w-4 h-4" />
                        <span>Overfør til spillet</span>
                        <ArrowRight className="w-4 h-4" />
                      </div>
                    )}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="text-center py-12 shadow-lg border-0 bg-white/95 backdrop-blur-lg">
            <CardContent>
              <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
                <MapPin className="w-8 h-8 text-gray-400" />
              </div>
              <CardTitle className="text-xl text-gray-900 mb-2">
                Ingen aktiviteter fundet
              </CardTitle>
              <CardDescription className="text-gray-600 mb-6">
                Gå en tur og kom tilbage for at se dine løberuter her
              </CardDescription>
              <Button 
                onClick={() => window.location.reload()}
                variant="outline"
                className="border-gray-300 hover:bg-gray-50"
              >
                Opdater siden
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Navigation */}
        <div className="mt-8 text-center">
          <Button 
            onClick={() => navigate('/dashboard')}
            variant="outline"
            className="border-gray-300 hover:bg-gray-50"
          >
            Gå til Dashboard
          </Button>
        </div>
      </div>
    </div>
  );
};

export default StravaSuccess;
