import { useAuth } from '@/hooks/useAuth';
import { Navigate, Link } from 'react-router-dom';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Map, Upload, Trophy, Activity } from 'lucide-react';

const Index = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <Layout>
      <div className="space-y-8">
        {/* Hero Section with Background */}
        <div 
          className="relative h-96 rounded-lg overflow-hidden bg-cover bg-center flex items-center justify-center"
          style={{ backgroundImage: 'url(/lovable-uploads/2217aa6a-b403-44ff-9572-c932cef9bedb.png)' }}
        >
          <div className="absolute inset-0 bg-black/40"></div>
          <div className="relative z-10 text-center space-y-4 text-white">
            <h1 className="text-4xl font-bold tracking-tight">
              Welcome to Your Dashboard
            </h1>
            <p className="text-xl max-w-2xl mx-auto">
              Explore maps, upload content, join leagues, and track your activities all in one place.
            </p>
          </div>
        </div>

        {/* Feature Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader className="text-center">
              <Map className="h-8 w-8 mx-auto text-primary" />
              <CardTitle>Map</CardTitle>
              <CardDescription>
                Explore your area with privacy protection
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full">
                <Link to="/map">
                  Open Map
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader className="text-center">
              <Upload className="h-8 w-8 mx-auto text-primary" />
              <CardTitle>Upload</CardTitle>
              <CardDescription>
                Share your content and files
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline" className="w-full">
                <Link to="/upload">
                  Upload Files
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader className="text-center">
              <Trophy className="h-8 w-8 mx-auto text-primary" />
              <CardTitle>Leagues</CardTitle>
              <CardDescription>
                Join competitions and challenges
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline" className="w-full">
                <Link to="/leagues">
                  View Leagues
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader className="text-center">
              <Activity className="h-8 w-8 mx-auto text-primary" />
              <CardTitle>Dashboard</CardTitle>
              <CardDescription>
                View your activity and stats
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline" className="w-full">
                <Link to="/dashboard">
                  Go to Dashboard
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="bg-muted/30 rounded-lg p-6">
          <h2 className="text-2xl font-semibold mb-4">Quick Actions</h2>
          <div className="flex flex-wrap gap-4">
            <Button asChild>
              <Link to="/map">
                <Map className="h-4 w-4 mr-2" />
                Explore Map
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/upload">
                <Upload className="h-4 w-4 mr-2" />
                Upload Content
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/leagues">
                <Trophy className="h-4 w-4 mr-2" />
                Join League
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Index;
