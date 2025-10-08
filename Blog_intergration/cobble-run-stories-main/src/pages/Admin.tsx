import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { AdminPostList } from "@/components/admin/AdminPostList";
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";

const Admin = () => {
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <p className="text-muted-foreground">Indlæser...</p>
        </main>
        <Footer />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      
      <main className="flex-1">
        <div className="container mx-auto px-4 py-12">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-4xl md:text-5xl font-headline font-bold mb-2">
                Admin Dashboard
              </h1>
              <p className="text-muted-foreground">
                Administrer dine opslag
              </p>
            </div>
            <Button onClick={() => navigate("/admin/opret")} size="lg">
              <PlusCircle className="mr-2 w-5 h-5" />
              Nyt opslag
            </Button>
          </div>

          <AdminPostList />
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Admin;
