import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Link } from 'react-router-dom';
import { MapPin, Trophy, Users, Activity } from 'lucide-react';
import Layout from '@/components/Layout';

interface League {
  id: string;
  name: string;
  description: string;
  invite_code: string;
}

interface TerritoryStats {
  total_area: number;
  territory_count: number;
  league_name: string;
}

interface UserStats {
  total_distance_km: number;
  total_activities: number;
}

interface Totals {
  total_distance_km: number;
  activities_count: number;
}

interface TerritoryTotals {
  total_area_km2: number;
  territories_count: number;
}

const Dashboard = () => {
  const { user } = useAuth();
  const [leagues, setLeagues] = useState<League[]>([]);
  const [stats, setStats] = useState<TerritoryStats[]>([]);
  const [userStats, setUserStats] = useState<UserStats>({ total_distance_km: 0, total_activities: 0 });
  const [totals, setTotals] = useState<Totals | null>(null);
  const [terrTotals, setTerrTotals] = useState<TerritoryTotals | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingTotals, setLoadingTotals] = useState(true);
  const [loadingTerr, setLoadingTerr] = useState(true);

  useEffect(() => {
    if (user) {
      loadUserData();
      loadTotals();
      loadTerritoryTotals();
    }
  }, [user]);

  const loadUserData = async () => {
    try {
      // Load user's leagues
      const { data: memberships, error: membershipError } = await supabase
        .from('league_memberships')
        .select('league_id')
        .eq('user_id', user?.id);

      if (membershipError) throw membershipError;

      let leaguesData: League[] = [];
      if (memberships && memberships.length > 0) {
        const leagueIds = memberships.map(m => m.league_id);
        
        const { data: leagues, error: leaguesError } = await supabase
          .from('leagues')
          .select('id, name, description, invite_code')
          .in('id', leagueIds);

        if (leaguesError) throw leaguesError;
        leaguesData = leagues || [];
      }

      setLeagues(leaguesData);

      // Load user's activity stats
      const { data: activities, error: activitiesError } = await supabase
        .from('activities')
        .select('distance_km')
        .eq('user_id', user?.id);

      if (activitiesError) throw activitiesError;

      const totalDistance = activities?.reduce((sum, activity) => sum + (activity.distance_km || 0), 0) || 0;
      const totalActivities = activities?.length || 0;

      setUserStats({
        total_distance_km: totalDistance,
        total_activities: totalActivities
      });

      // Load territory stats (mock for now)
      const mockStats: TerritoryStats[] = leaguesData?.map(league => ({
        total_area: Math.random() * 5,
        territory_count: Math.floor(Math.random() * 10),
        league_name: league.name
      })) || [];
      
      setStats(mockStats);
    } catch (error) {
      console.error('Error loading user data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTotals = async () => {
    try {
      const { data, error } = await supabase.rpc("user_totals");
      if (error) throw error;

      // data can be null if no rows - protect against that
      const result = Array.isArray(data) ? data[0] : data;
      setTotals({
        total_distance_km: Number(result?.total_distance_km ?? 0),
        activities_count: Number(result?.activities_count ?? 0),
      });
    } catch (err) {
      console.error("Failed to load totals:", err);
      setTotals({ total_distance_km: 0, activities_count: 0 });
    } finally {
      setLoadingTotals(false);
    }
  };

  const loadTerritoryTotals = async () => {
    try {
      const { data, error } = await supabase.rpc("user_territory_totals");
      if (error) throw error;
      const result = Array.isArray(data) ? data[0] : data;
      setTerrTotals({
        total_area_km2: Number(result?.total_area_km2 ?? 0),
        territories_count: Number(result?.territories_count ?? 0),
      });
    } catch (e) {
      console.error("Failed to load territory totals:", e);
      setTerrTotals({ total_area_km2: 0, territories_count: 0 });
    } finally {
      setLoadingTerr(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Activity className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading your territories...</p>
        </div>
      </div>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Territory Dashboard</h1>
          <Link to="/upload">
            <Button>
              <Activity className="h-4 w-4 mr-2" />
              Upload Activity
            </Button>
          </Link>
        </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Territory</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loadingTerr ? "…" : `${(terrTotals?.total_area_km2 ?? 0).toFixed(2)} km²`}
            </div>
            <p className="text-xs text-muted-foreground">
              Across {loadingTerr ? "…" : terrTotals?.territories_count ?? 0} territories
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Distance</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loadingTotals ? "…" : `${(totals?.total_distance_km ?? 0).toFixed(1)} km`}
            </div>
            <p className="text-xs text-muted-foreground">
              Total distance covered
            </p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => window.location.href = '/activities'}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Activities</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loadingTotals ? "…" : `${totals?.activities_count ?? 0}`}
            </div>
            <p className="text-xs text-muted-foreground">
              Activities uploaded
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Leagues</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{leagues.length}</div>
            <p className="text-xs text-muted-foreground">
              Active competitions
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Leagues */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Your Leagues</h2>
          <Link to="/leagues">
            <Button variant="outline" size="sm">
              Manage Leagues
            </Button>
          </Link>
        </div>

        {leagues.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center space-y-4">
                <Users className="h-12 w-12 mx-auto text-muted-foreground" />
                <div>
                  <h3 className="font-medium">No leagues yet</h3>
                  <p className="text-sm text-muted-foreground">
                    Create or join a league to start competing with friends
                  </p>
                </div>
                <Link to="/leagues">
                  <Button>
                    <Users className="h-4 w-4 mr-2" />
                    Browse Leagues
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {leagues.map((league) => {
              const leagueStats = stats.find(s => s.league_name === league.name);
              return (
                <Card key={league.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{league.name}</CardTitle>
                      <Badge variant="outline">{league.invite_code}</Badge>
                    </div>
                    <CardDescription>{league.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex justify-between items-center">
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">Your territory</p>
                        <p className="text-lg font-semibold">
                          {leagueStats?.total_area.toFixed(2) || 0} km²
                        </p>
                      </div>
                      <div className="space-y-1 text-right">
                        <p className="text-sm text-muted-foreground">Activities</p>
                        <p className="text-lg font-semibold">
                          {leagueStats?.territory_count || 0}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Call to Action */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="pt-6">
          <div className="text-center space-y-4">
            <Trophy className="h-12 w-12 mx-auto text-primary" />
            <div>
              <h3 className="font-medium">Ready to claim more territory?</h3>
              <p className="text-sm text-muted-foreground">
                Upload your latest run or walk to expand your conquered areas
              </p>
            </div>
            <Link to="/upload">
              <Button>
                <Activity className="h-4 w-4 mr-2" />
                Upload New Activity
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
      </div>
    </Layout>
  );
};

export default Dashboard;