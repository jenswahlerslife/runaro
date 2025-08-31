import { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { Home, Map as MapIcon, LogOut, Plus, Users, Activity } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

interface LayoutProps {
  children: ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  const { signOut } = useAuth();
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-3 grid grid-cols-[1fr_auto_1fr] items-center md:gap-x-16 lg:gap-x-24">
          {/* Left navigation */}
          <div className="hidden md:flex items-center justify-end gap-4 pr-2">
            <Link to="/map">
              <Button 
                variant={isActive('/map') ? 'default' : 'ghost'}
                size="sm"
              >
                <MapIcon className="h-4 w-4 mr-2" />
                Map
              </Button>
            </Link>
            <Link to="/dashboard">
              <Button 
                variant={isActive('/dashboard') ? 'default' : 'ghost'}
                size="sm"
              >
                <Activity className="h-4 w-4 mr-2" />
                Dashboard
              </Button>
            </Link>
          </div>

          {/* Centered logo acts as Home */}
          <Link to="/" className="flex items-center justify-self-center">
            <img 
              src="/lovable-uploads/e5d5e0c5-6573-4ca7-823e-08d5d7708873.png" 
              alt="Runaro Logo" 
              className="h-12 md:h-14"
            />
          </Link>
          
          {/* Right aligned navigation + actions */}
          <div className="justify-self-start flex items-center gap-4">
            <nav className="hidden md:flex items-center gap-4">
              <Link to="/leagues">
                <Button 
                  variant={isActive('/leagues') ? 'default' : 'ghost'}
                  size="sm"
                >
                  <Users className="h-4 w-4 mr-2" />
                  Leagues
                </Button>
              </Link>
              <Link to="/upload">
                <Button 
                  variant={isActive('/upload') ? 'default' : 'ghost'}
                  size="sm"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Upload
                </Button>
              </Link>
            </nav>

            <Button 
              variant="outline" 
              size="sm" 
              onClick={signOut}
              className="ml-4 flex items-center space-x-2"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden md:inline">Sign Out</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        {children}
      </main>

      {/* Mobile navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border">
        <div className="flex justify-around py-2">
          <Link to="/map">
            <Button 
              variant={isActive('/map') ? 'default' : 'ghost'}
              size="sm"
              className="flex flex-col items-center h-12"
            >
              <MapIcon className="h-4 w-4" />
              <span className="text-xs mt-1">Map</span>
            </Button>
          </Link>
          <Link to="/leagues">
            <Button 
              variant={isActive('/leagues') ? 'default' : 'ghost'}
              size="sm"
              className="flex flex-col items-center h-12"
            >
              <Users className="h-4 w-4" />
              <span className="text-xs mt-1">Leagues</span>
            </Button>
          </Link>
          <Link to="/upload">
            <Button 
              variant={isActive('/upload') ? 'default' : 'ghost'}
              size="sm"
              className="flex flex-col items-center h-12"
            >
              <Plus className="h-4 w-4" />
              <span className="text-xs mt-1">Upload</span>
            </Button>
          </Link>
        </div>
      </nav>
    </div>
  );
};

export default Layout;