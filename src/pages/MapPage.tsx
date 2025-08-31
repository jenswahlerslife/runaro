import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';
import Map from '@/components/Map';
import Layout from '@/components/Layout';

const MapPage = () => {
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
      <div className="h-full">
        <div className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight">Map</h1>
          <p className="text-muted-foreground">
            Explore your area with privacy protection
          </p>
        </div>
        <Map />
      </div>
    </Layout>
  );
};

export default MapPage;