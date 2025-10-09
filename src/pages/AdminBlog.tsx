import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { AdminPostList } from "@/components/blog/AdminPostList";
import { Button } from "@/components/ui/button";
import { PlusCircle, Home } from "lucide-react";

const AdminBlog = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Indlæser...</p>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-12">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl md:text-5xl font-headline font-bold mb-2">
              Blog Admin
            </h1>
            <p className="text-muted-foreground">
              Administrer dine blog-opslag
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => navigate("/")} variant="outline" size="lg">
              <Home className="mr-2 w-5 h-5" />
              Til forsiden
            </Button>
            <Button onClick={() => navigate("/admin/blog/opret")} size="lg">
              <PlusCircle className="mr-2 w-5 h-5" />
              Nyt opslag
            </Button>
          </div>
        </div>

        <AdminPostList />
      </div>
    </div>
  );
};

export default AdminBlog;
