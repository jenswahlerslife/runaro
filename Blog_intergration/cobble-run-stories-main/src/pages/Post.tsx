import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Badge } from "@/components/ui/badge";
import { Clock, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import ReactMarkdown from "react-markdown";

interface PostData {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  cover_image_url: string | null;
  tags: string[];
  reading_minutes: number;
  published_at: string;
}

const Post = () => {
  const { slug } = useParams();
  const [post, setPost] = useState<PostData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (slug) {
      fetchPost();
    }
  }, [slug]);

  const fetchPost = async () => {
    const { data, error } = await supabase
      .from("posts")
      .select("*")
      .eq("slug", slug)
      .eq("status", "published")
      .single();

    if (error) {
      console.error("Error fetching post:", error);
    } else {
      setPost(data);
    }
    setLoading(false);
  };

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

  if (!post) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-4xl font-headline font-bold mb-4">Opslag ikke fundet</h1>
            <Link to="/">
              <Button variant="outline">
                <ArrowLeft className="mr-2 w-4 h-4" />
                Tilbage til forsiden
              </Button>
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const formattedDate = new Date(post.published_at).toLocaleDateString("da-DK", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      
      <main className="flex-1">
        <article>
          {/* Hero Image */}
          {post.cover_image_url && (
            <div className="w-full aspect-[21/9] md:aspect-[21/7] overflow-hidden bg-muted">
              <img
                src={post.cover_image_url}
                alt={post.title}
                className="w-full h-full object-cover"
              />
            </div>
          )}

          {/* Article Content */}
          <div className="container mx-auto px-4 py-12 max-w-4xl">
            <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-smooth mb-8">
              <ArrowLeft className="w-4 h-4" />
              Tilbage til alle opslag
            </Link>

            <header className="mb-8">
              <div className="flex flex-wrap gap-2 mb-4">
                {post.tags.map((tag) => (
                  <Badge key={tag} variant="secondary">
                    {tag}
                  </Badge>
                ))}
              </div>

              <h1 className="text-4xl md:text-6xl font-headline font-bold mb-4 tracking-tight">
                {post.title}
              </h1>

              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span>{formattedDate}</span>
                <div className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  <span>{post.reading_minutes} min læsning</span>
                </div>
              </div>
            </header>

            <div className="prose prose-lg dark:prose-invert max-w-none prose-headings:font-headline prose-headings:font-bold prose-a:text-primary prose-a:no-underline hover:prose-a:underline prose-img:rounded-lg">
              <ReactMarkdown>{post.content}</ReactMarkdown>
            </div>
          </div>
        </article>
      </main>

      <Footer />
    </div>
  );
};

export default Post;
