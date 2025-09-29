import { useAuth } from '@/hooks/useAuth';
import { Navigate, Link } from 'react-router-dom';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Play, Gamepad2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { UIProfileSelect } from '@/types/ui';

const Index = () => {
  const { user, loading } = useAuth();
  const [userProfile, setUserProfile] = useState<UIProfileSelect | null>(null);

  // Fetch user profile data when user is available
  useEffect(() => {
    if (user) {
      const fetchUserProfile = async () => {
        try {
          // Use maybeSingle to handle case where profile doesn't exist yet
          const { data: prof, error } = await supabase
            .from('profiles')
            .select('username, display_name')
            .eq('user_id', user.id)
            .maybeSingle();

          if (error) {
            console.warn('Error fetching user profile:', error);
          }

          // Set the profile data (might be null)
          setUserProfile(prof);

          // Self-heal: if profile doesn't exist, create one based on user metadata
          if (!prof && user) {
            console.log('Profile missing for user, creating self-heal profile...');
            try {
              await supabase.from('profiles').upsert({
                id: user.id,  // Use 'id' not 'user_id'
                user_id: user.id,  // Keep user_id in sync for compatibility
                username: user.user_metadata?.username ?? null,
                display_name: user.user_metadata?.display_name ?? null,
                // age is handled by the database trigger from metadata
              }, { onConflict: 'id' });  // Use 'id' as conflict target
              
              // Refetch after creation
              const { data: newProf } = await supabase
                .from('profiles')
                .select('username, display_name')
                .eq('user_id', user.id)
                .maybeSingle();
              
              if (newProf) {
                setUserProfile(newProf);
                console.log('Self-heal profile created successfully');
              }
            } catch (healError) {
              console.warn('Self-heal profile creation failed (non-blocking):', healError);
            }
          }
        } catch (err) {
          console.warn('Failed to fetch user profile:', err);
        }
      };

      fetchUserProfile();
    }
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Indlæser...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Get username with proper fallback as specified:
  // profiles.username → auth.user_metadata.username → profiles.display_name → auth.user_metadata.display_name → email-prefix → "gæst"
  const displayName = userProfile?.username 
    || user?.user_metadata?.username 
    || userProfile?.display_name 
    || user?.user_metadata?.display_name 
    || user?.email?.split('@')[0] 
    || 'gæst';

  return (
    <Layout>
      <div className="space-y-8">
        {/* Welcome Message */}
        <div className="text-center">
          <h1 className="text-4xl font-bold text-foreground mb-4">
            Velkommen {displayName}!
          </h1>
        </div>

        {/* Hero Section with Background */}
        <div 
          className="relative h-96 rounded-lg overflow-hidden bg-gradient-to-r from-blue-600 to-purple-600 flex items-center justify-center"
        >
          <div className="absolute inset-0 bg-black/20"></div>
          <div className="relative z-10 text-center space-y-6 text-white">
            <div className="flex items-center justify-center mb-4">
              <Gamepad2 className="h-16 w-16 text-white mr-4" />
              <h1 className="text-5xl font-bold tracking-tight">
                Territorielt Spil
              </h1>
            </div>
            <p className="text-xl max-w-2xl mx-auto">
              Konkurrér med venner i territoriale kampe ved hjælp af dine løberuter. Udvid dit territorium og erobr kortet!
            </p>
            <Button size="lg" asChild className="text-lg px-8 py-3">
              <Link to="/leagues">
                <Play className="h-6 w-6 mr-2" />
                Start Spil
              </Link>
            </Button>
          </div>
        </div>

      </div>
    </Layout>
  );
};

export default Index;
