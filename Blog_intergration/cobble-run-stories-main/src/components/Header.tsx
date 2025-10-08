import { Link } from "react-router-dom";
import { Moon, Sun, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/hooks/use-theme";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";

export const Header = () => {
  const { theme, toggleTheme } = useTheme();

  const NavLinks = () => (
    <>
      <Link to="/" className="hover:text-primary transition-smooth font-medium">
        Opslag
      </Link>
      <Link to="/om" className="hover:text-primary transition-smooth font-medium">
        Om
      </Link>
      <Link to="/admin" className="hover:text-primary transition-smooth font-medium">
        Admin
      </Link>
    </>
  );

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center">
          <h1 className="text-2xl md:text-3xl font-headline font-bold tracking-tight">
            Runaro
          </h1>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-6">
          <NavLinks />
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="ml-2"
          >
            {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </Button>
        </nav>

        {/* Mobile Nav */}
        <div className="md:hidden flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
          >
            {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </Button>
          
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent>
              <nav className="flex flex-col gap-4 mt-8">
                <NavLinks />
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
};
