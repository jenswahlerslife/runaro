import { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { LogOut, Crown } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import MyGamesMenu from '@/components/MyGamesMenu';

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
          {/* Left navigation - now empty */}
          <div className="hidden md:flex items-center justify-end gap-4 pr-2">
            {/* Navigation items removed */}
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
              <MyGamesMenu variant="desktop" />
              <Link to="/subscription">
                <Button
                  variant={isActive('/subscription') ? 'default' : 'ghost'}
                  size="sm"
                >
                  <Crown className="h-4 w-4 mr-2" />
                  Pro
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
              <span className="hidden md:inline">Log Ud</span>
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
          <MyGamesMenu variant="mobile" />
          <Link to="/subscription">
            <Button
              variant={isActive('/subscription') ? 'default' : 'ghost'}
              size="sm"
              className="flex flex-col items-center h-12"
            >
              <Crown className="h-4 w-4" />
              <span className="text-xs mt-1">Pro</span>
            </Button>
          </Link>
        </div>
      </nav>
    </div>
  );
};

export default Layout;