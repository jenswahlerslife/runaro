import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { BuildBadge } from "@/components/BuildBadge";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import MapPage from "./pages/MapPage";
import LeaguesPage from "./pages/LeaguesPage";
import GamePage from "./pages/GamePage";
import Upload from "./pages/Upload";
import StravaCallback from "./pages/StravaCallback";
import StravaSuccess from "./pages/StravaSuccess";
import NotFound from "./pages/NotFound";
import Dashboard from "./pages/Dashboard";
import ActivitiesPage from "./pages/ActivitiesPage";
import StravaDebug from "./pages/StravaDebug";
import StravaLocalTest from "./pages/StravaLocalTest";
import StravaTestFlow from "./pages/StravaTestFlow";
import StravaConnectPage from "./pages/StravaConnectPage";
import AuthCallback from "./pages/AuthCallback";
import LeagueMembers from "./pages/LeagueMembers";
import ErrorDashboard from "./pages/ErrorDashboard";
import Subscription from "./pages/Subscription";
import GameSetup from "./pages/GameSetup";
import ErrorBoundary from "./components/ErrorBoundary";
import AuthDebugPage from "./pages/AuthDebugPage";

const queryClient = new QueryClient();

const ENABLE_DEBUG_ROUTES = import.meta.env.VITE_ENABLE_DEBUG_ROUTES === 'true';

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BuildBadge />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/map" element={<MapPage />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/activities" element={<ActivitiesPage />} />
            <Route path="/leagues" element={<LeaguesPage />} />
            <Route path="/leagues/:leagueId/members" element={<LeagueMembers />} />
            <Route path="/subscription" element={<Subscription />} />
            <Route
              path="/games/:gameId/setup"
              element={
                <ErrorBoundary>
                  <GameSetup />
                </ErrorBoundary>
              }
            />
            <Route path="/games/:gameId" element={<GamePage />} />
            <Route path="/upload" element={<Upload />} />
            <Route path="/auth/strava/callback" element={<StravaCallback />} />
            <Route path="/strava/connect" element={<StravaConnectPage />} />
            <Route path="/strava/success" element={<StravaSuccess />} />
            {ENABLE_DEBUG_ROUTES && (
              <>
                <Route path="/debug/strava" element={<StravaDebug />} />
                <Route path="/debug/auth" element={<AuthDebugPage />} />
                <Route path="/test/strava-local" element={<StravaLocalTest />} />
                <Route path="/test/strava-flow" element={<StravaTestFlow />} />
              </>
            )}
            <Route path="/admin/errors" element={<ErrorDashboard />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
