import Layout from "@/components/Layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { fetchBlogPostBySlug } from "@/lib/blogApi";
import { Clock, ArrowLeft } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";

const BlogPostPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [post, setPost] = useState<Awaited<
    ReturnType<typeof fetchBlogPostBySlug>
  > | null>(null);

  useEffect(() => {
    if (!slug) return;
    const load = async () => {
      try {
        setLoading(true);
        const data = await fetchBlogPostBySlug(slug);
        setPost(data);
        setError(null);
      } catch (err) {
        console.error("Failed to load blog post", err);
        setError(
          err instanceof Error
            ? err.message
            : "Kunne ikke hente blogindlægget."
        );
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [slug]);

  const formattedDate = useMemo(() => {
    if (!post?.published_at) return null;
    return new Date(post.published_at).toLocaleDateString("da-DK", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }, [post?.published_at]);

  if (loading) {
    return (
      <Layout>
        <div className="flex min-h-[60vh] items-center justify-center">
          <p className="text-muted-foreground">Indlæser...</p>
        </div>
      </Layout>
    );
  }

  if (error || !post) {
    return (
      <Layout>
        <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
          <h1 className="mb-4 text-3xl font-semibold">
            {error ?? "Opslag ikke fundet"}
          </h1>
          <Button variant="outline" asChild>
            <Link to="/blog">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Tilbage til Runaro Stories
            </Link>
          </Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <article className="mx-auto flex w-full max-w-4xl flex-col gap-8">
        <Link
          to="/blog"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          Tilbage til alle historier
        </Link>

        {post.cover_image_url && (
          <div className="overflow-hidden rounded-3xl bg-muted shadow-lg">
            <img
              src={post.cover_image_url}
              alt={post.title}
              className="h-full w-full object-cover"
            />
          </div>
        )}

        <header className="space-y-6">
          <div className="flex flex-wrap gap-2">
            {post.tags.map((tag) => (
              <Badge key={`${post.id}-${tag}`} variant="secondary">
                {tag}
              </Badge>
            ))}
          </div>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            {post.title}
          </h1>
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            {formattedDate && <time>{formattedDate}</time>}
            <span className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              {post.reading_minutes} min læsning
            </span>
            {post.author && (
              <span>
                Skrevet af{" "}
                <span className="font-medium text-foreground">
                  {post.author.display_name ?? post.author.username ?? "Runaro"}
                </span>
              </span>
            )}
          </div>
        </header>

        <div className="prose prose-lg max-w-none dark:prose-invert prose-headings:font-semibold prose-a:text-primary">
          <ReactMarkdown>{post.content}</ReactMarkdown>
        </div>
      </article>
    </Layout>
  );
};

export default BlogPostPage;
