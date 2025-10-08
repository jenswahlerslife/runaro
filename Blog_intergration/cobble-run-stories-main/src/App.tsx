import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/use-auth";
import Index from "./pages/Index";
import Post from "./pages/Post";
import Om from "./pages/Om";
import Auth from "./pages/Auth";
import Admin from "./pages/Admin";
import AdminEditor from "./pages/AdminEditor";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <BrowserRouter>
        <Toaster />
        <Sonner />
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/post/:slug" element={<Post />} />
            <Route path="/om" element={<Om />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/admin/opret" element={<AdminEditor />} />
            <Route path="/admin/rediger/:id" element={<AdminEditor />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
