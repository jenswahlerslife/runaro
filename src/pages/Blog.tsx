import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PostCard } from "@/components/blog/PostCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Settings, Home } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface Post {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  cover_image_url: string | null;
  tags: string[];
  reading_minutes: number;
  published_at: string;
}

const Blog = () => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const { isAdmin } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    console.log("Blog component mounted, fetching posts...");
    fetchPosts();
  }, []);

  const fetchPosts = async () => {
    console.log("fetchPosts called");
    const { data, error } = await supabase
      .from("posts")
      .select("*")
      .eq("status", "published")
      .order("published_at", { ascending: false });

    console.log("Supabase query result:", { data, error, count: data?.length });

    if (error) {
      console.error("Error fetching posts:", error);
    } else {
      console.log("Setting posts to state:", data);
      setPosts(data || []);
    }
    setLoading(false);
  };

  const filteredPosts = posts.filter((post) => {
    const query = searchQuery.toLowerCase();
    return (
      post.title.toLowerCase().includes(query) ||
      post.excerpt.toLowerCase().includes(query) ||
      post.tags.some((tag) => tag.toLowerCase().includes(query))
    );
  });

  console.log("Render state:", {
    postsCount: posts.length,
    filteredPostsCount: filteredPosts.length,
    loading,
    searchQuery
  });

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="py-16 md:py-24 border-b border-border">
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-5xl md:text-7xl font-headline font-bold mb-6 tracking-tight">
                Runaro Blog
              </h1>
              <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl">
                Historier fra løbeverdenen. Fra brostensintervaller på Nørrebro til sunrise runs ved havnen.
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => navigate("/")}
                variant="outline"
                className="flex items-center gap-2"
              >
                <Home className="w-4 h-4" />
                Forside
              </Button>
              {isAdmin && (
                <Button
                  onClick={() => navigate("/admin/blog")}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <Settings className="w-4 h-4" />
                  Admin
                </Button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Search */}
      <section className="py-12 border-b border-border bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="relative max-w-xl">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Søg i opslag eller tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
      </section>

      {/* Posts Grid */}
      <section className="py-12">
        <div className="container mx-auto px-4">
          {loading ? (
            <div className="text-center py-12 text-muted-foreground">
              Indlæser opslag...
            </div>
          ) : filteredPosts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {searchQuery ? "Ingen opslag matchede din søgning." : "Ingen opslag endnu."}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredPosts.map((post) => (
                <PostCard
                  key={post.id}
                  id={post.id}
                  title={post.title}
                  slug={post.slug}
                  excerpt={post.excerpt}
                  coverImageUrl={post.cover_image_url || ""}
                  tags={post.tags}
                  readingMinutes={post.reading_minutes}
                  publishedAt={post.published_at}
                />
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default Blog;
