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
import Leagues from "./pages/Leagues";
import Upload from "./pages/Upload";
import StravaCallback from "./pages/StravaCallback";
import StravaSuccess from "./pages/StravaSuccess";
import NotFound from "./pages/NotFound";
import Dashboard from "./pages/Dashboard";
import StravaDebug from "./pages/StravaDebug";
import StravaLocalTest from "./pages/StravaLocalTest";
import StravaTestFlow from "./pages/StravaTestFlow";

const queryClient = new QueryClient();

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
            <Route path="/map" element={<MapPage />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/leagues" element={<Leagues />} />
            <Route path="/upload" element={<Upload />} />
            <Route path="/auth/strava/callback" element={<StravaCallback />} />
            <Route path="/strava/success" element={<StravaSuccess />} />
            <Route path="/debug/strava" element={<StravaDebug />} />
            <Route path="/test/strava-local" element={<StravaLocalTest />} />
            <Route path="/test/strava-flow" element={<StravaTestFlow />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
