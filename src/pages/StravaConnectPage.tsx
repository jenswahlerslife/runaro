import { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import StravaConnect from '@/components/StravaConnect';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const StravaConnectPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const returnUrl = searchParams.get('return');

  const handleConnected = () => {
    if (returnUrl) {
      // Redirect to the return URL after successful connection
      navigate(returnUrl);
    } else {
      // Default redirect to dashboard
      navigate('/dashboard');
    }
  };

  return (
    <Layout>
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-orange-50 to-blue-50">
        <div className="w-full max-w-lg">
          <Card className="mb-6 bg-white/90 backdrop-blur">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl font-bold text-gray-900">
                Forbind Strava
              </CardTitle>
            </CardHeader>
            <CardContent className="text-center text-gray-600">
              <p>
                Du skal forbinde din Strava konto for at kunne vælge en base aktivitet til spillet.
              </p>
              {returnUrl && (
                <p className="mt-2 text-sm text-gray-500">
                  Du vil blive omdirigeret tilbage efter forbindelse.
                </p>
              )}
            </CardContent>
          </Card>

          <StravaConnect onConnected={handleConnected} returnUrl={returnUrl || undefined} />
        </div>
      </div>
    </Layout>
  );
};

export default StravaConnectPage;