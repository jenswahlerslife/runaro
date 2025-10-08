import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { PostCard } from "@/components/PostCard";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

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

const Index = () => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPosts();
  }, []);

  const fetchPosts = async () => {
    const { data, error } = await supabase
      .from("posts")
      .select("*")
      .eq("status", "published")
      .order("published_at", { ascending: false });

    if (error) {
      console.error("Error fetching posts:", error);
    } else {
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

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      
      <main className="flex-1">
        {/* Hero Section */}
        <section className="py-16 md:py-24 border-b border-border">
          <div className="container mx-auto px-4">
            <h1 className="text-5xl md:text-7xl font-headline font-bold mb-6 tracking-tight">
              Runaro
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl">
              Urban running culture. Fra brostensintervaller på Nørrebro til sunrise runs ved havnen.
            </p>
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
      </main>

      <Footer />
    </div>
  );
};

export default Index;
