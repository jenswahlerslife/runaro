// @ts-nocheck
import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { 
  AlertTriangle, 
  Bug, 
  Network, 
  Database, 
  RefreshCw, 
  CheckCircle,
  Clock,
  User,
  Globe
} from 'lucide-react';

interface ErrorReport {
  id: string;
  error_type: string;
  error_message: string;
  error_stack?: string;
  url: string;
  timestamp: string;
  severity: string;
  source: string;
  context?: any;
  username: string;
  user_id?: string;
  resolved: boolean;
}

export default function ErrorDashboard() {
  const { user, profile, loading: authLoading } = useAuth();
  const [errors, setErrors] = useState<ErrorReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedError, setSelectedError] = useState<ErrorReport | null>(null);
  const { toast } = useToast();

  // Check if user is admin
  const isAdmin = profile?.username === 'admin';

  const fetchErrors = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_recent_errors', {
        p_limit: 100,
        p_hours: 72
      });

      if (error) throw error;

      if (data && Array.isArray(data)) {
        setErrors(data);
      } else {
        setErrors([]);
      }
    } catch (error) {
      console.error('Error fetching error reports:', error);
      toast({
        title: "Fejl ved indlæsning af fejlrapporter",
        description: String(error),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const resolveError = async (errorId: string) => {
    try {
      const { data, error } = await supabase.rpc('resolve_error', {
        p_error_id: errorId
      });

      if (error) throw error;

      toast({
        title: "Fejl markeret som løst",
        description: "Fejlrapporten er blevet markeret som løst.",
      });

      // Refresh the errors list
      fetchErrors();
    } catch (error) {
      console.error('Error resolving error:', error);
      toast({
        title: "Fejl ved markering som løst",
        description: String(error),
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    if (!authLoading && user && isAdmin) {
      fetchErrors();
    }
  }, [authLoading, user, isAdmin]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
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

  if (!isAdmin) {
    return (
      <Layout>
        <div className="text-center py-8">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Du har ikke adgang til fejldashboardet. Kun admin brugere kan se fejlrapporter.
            </AlertDescription>
          </Alert>
        </div>
      </Layout>
    );
  }

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return <AlertTriangle className="h-4 w-4 text-red-600" />;
      case 'error': return <Bug className="h-4 w-4 text-red-500" />;
      case 'warning': return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      default: return <AlertTriangle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getSourceIcon = (source: string) => {
    switch (source) {
      case 'frontend': return <Globe className="h-4 w-4" />;
      case 'backend': return <Database className="h-4 w-4" />;
      case 'supabase': return <Database className="h-4 w-4" />;
      default: return <Network className="h-4 w-4" />;
    }
  };

  const unresolvedErrors = errors.filter(e => !e.resolved);
  const resolvedErrors = errors.filter(e => e.resolved);

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Bug className="h-8 w-8 text-primary" />
              Error Dashboard
            </h1>
            <p className="text-muted-foreground">
              Overvåg og administrer fejlrapporter fra hjemmesiden
            </p>
          </div>
          <Button onClick={fetchErrors} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Opdater
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Uløste fejl
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {unresolvedErrors.length}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Løste fejl
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {resolvedErrors.length}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Seneste 72 timer
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {errors.length}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Error List */}
        <Tabs defaultValue="unresolved" className="w-full">
          <TabsList>
            <TabsTrigger value="unresolved">
              Uløste fejl ({unresolvedErrors.length})
            </TabsTrigger>
            <TabsTrigger value="resolved">
              Løste fejl ({resolvedErrors.length})
            </TabsTrigger>
            <TabsTrigger value="all">
              Alle fejl ({errors.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="unresolved">
            <div className="space-y-4">
              {unresolvedErrors.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center">
                    <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
                    <h3 className="text-lg font-semibold mb-2">Ingen uløste fejl!</h3>
                    <p className="text-muted-foreground">
                      Alle fejl er blevet løst eller der er ingen nye fejl.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                unresolvedErrors.map((error) => (
                  <Card key={error.id} className="cursor-pointer hover:shadow-md transition-shadow">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          {getSeverityIcon(error.severity)}
                          <div>
                            <CardTitle className="text-base">{error.error_type}</CardTitle>
                            <CardDescription className="flex items-center gap-2 mt-1">
                              <Clock className="h-3 w-3" />
                              {new Date(error.timestamp).toLocaleString('da-DK')}
                              <User className="h-3 w-3 ml-2" />
                              {error.username}
                            </CardDescription>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {getSourceIcon(error.source)}
                          <Badge variant={error.severity === 'error' ? 'destructive' : 'secondary'}>
                            {error.severity}
                          </Badge>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              resolveError(error.id);
                            }}
                          >
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Løs
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground mb-2">
                        <strong>URL:</strong> {error.url}
                      </p>
                      <p className="text-sm">
                        {error.error_message}
                      </p>
                      {error.context && (
                        <details className="mt-2">
                          <summary className="text-xs text-muted-foreground cursor-pointer">
                            Vis kontekst
                          </summary>
                          <pre className="mt-1 text-xs bg-muted p-2 rounded overflow-x-auto">
                            {JSON.stringify(error.context, null, 2)}
                          </pre>
                        </details>
                      )}
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="resolved">
            <div className="space-y-4">
              {resolvedErrors.map((error) => (
                <Card key={error.id} className="opacity-75">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        {getSeverityIcon(error.severity)}
                        <div>
                          <CardTitle className="text-base">{error.error_type}</CardTitle>
                          <CardDescription className="flex items-center gap-2 mt-1">
                            <Clock className="h-3 w-3" />
                            {new Date(error.timestamp).toLocaleString('da-DK')}
                            <User className="h-3 w-3 ml-2" />
                            {error.username}
                          </CardDescription>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {getSourceIcon(error.source)}
                        <Badge variant="outline" className="text-green-600">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Løst
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-2">
                      <strong>URL:</strong> {error.url}
                    </p>
                    <p className="text-sm">
                      {error.error_message}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="all">
            <div className="space-y-4">
              {errors.map((error) => (
                <Card key={error.id} className={error.resolved ? "opacity-75" : ""}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        {getSeverityIcon(error.severity)}
                        <div>
                          <CardTitle className="text-base">{error.error_type}</CardTitle>
                          <CardDescription className="flex items-center gap-2 mt-1">
                            <Clock className="h-3 w-3" />
                            {new Date(error.timestamp).toLocaleString('da-DK')}
                            <User className="h-3 w-3 ml-2" />
                            {error.username}
                          </CardDescription>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {getSourceIcon(error.source)}
                        <Badge variant={
                          error.resolved ? "outline" :
                          error.severity === 'error' ? 'destructive' : 'secondary'
                        }>
                          {error.resolved ? (
                            <>
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Løst
                            </>
                          ) : (
                            error.severity
                          )}
                        </Badge>
                        {!error.resolved && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => resolveError(error.id)}
                          >
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Løs
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-2">
                      <strong>URL:</strong> {error.url}
                    </p>
                    <p className="text-sm">
                      {error.error_message}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}