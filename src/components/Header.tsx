import Logo from "./Logo";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

export default function Header() {
  const { user, signOut } = useAuth();

  return (
    <header className="w-full border-b bg-white/80 backdrop-blur sticky top-0 z-40">
      <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between">
        <Logo />

        <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
          <Link to="/map" className="hover:text-blue-600 transition-colors">
            Map
          </Link>
          <Link to="/dashboard" className="hover:text-blue-600 transition-colors">
            Dashboard
          </Link>
          <Link to="/leagues" className="hover:text-blue-600 transition-colors">
            Leagues
          </Link>
          <Link to="/upload" className="hover:text-blue-600 transition-colors">
            Upload
          </Link>
        </nav>

        <div className="flex items-center gap-2">
          {user ? (
            <>
              <span className="text-sm text-muted-foreground">
                {user.email}
              </span>
              <Button variant="outline" size="sm" onClick={signOut}>
                Sign Out
              </Button>
            </>
          ) : (
            <Link to="/auth">
              <Button size="sm">Sign In</Button>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}