import Layout from "@/components/Layout";
import { BlogPostCard } from "@/components/blog/BlogPostCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { BlogPost, fetchPublishedBlogPosts } from "@/lib/blogApi";
import { Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

const BlogIndex = () => {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const data = await fetchPublishedBlogPosts();
        setPosts(data);
        setError(null);
      } catch (err) {
        console.error("Failed to load blog posts", err);
        setError(
          err instanceof Error ? err.message : "Kunne ikke hente blogindlæg."
        );
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filteredPosts = useMemo(() => {
    if (!searchQuery) return posts;
    const q = searchQuery.toLowerCase();
    return posts.filter(
      (post) =>
        post.title.toLowerCase().includes(q) ||
        post.excerpt.toLowerCase().includes(q) ||
        post.tags.some((tag) => tag.toLowerCase().includes(q))
    );
  }, [posts, searchQuery]);

  return (
    <Layout>
      <div className="space-y-12">
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 px-8 py-16 text-slate-100 shadow-2xl ring-1 ring-white/10">
          <div className="relative mx-auto max-w-3xl space-y-6 text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-blue-400">
              Runaro Stories
            </p>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
              Urban running culture i København
            </h1>
            <p className="text-lg text-slate-300">
              Fra brostensintervaller på Nørrebro til sunrise runs ved havnen.
              Vi deler fortællinger, taktikker og oplevelser fra Runaro
              fællesskabet.
            </p>
            <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
              <div className="relative w-full max-w-md">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Søg i opslag eller tags..."
                  className="border-slate-700 bg-slate-900/90 pl-9 text-slate-100 placeholder:text-slate-500"
                />
              </div>
              <Button variant="secondary" asChild className="bg-white text-slate-900">
                <Link to="/">Tilbage til forsiden</Link>
              </Button>
            </div>
          </div>
        </section>

        <section>
          {loading ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, idx) => (
                <div
                  key={idx}
                  className="h-64 animate-pulse rounded-2xl bg-slate-200/60 dark:bg-slate-800/60"
                />
              ))}
            </div>
          ) : error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-sm text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-100">
              {error}
            </div>
          ) : filteredPosts.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 p-10 text-center text-slate-500 dark:border-slate-700 dark:text-slate-400">
              {searchQuery
                ? "Ingen opslag matcher din søgning endnu."
                : "Ingen opslag endnu. Når de publiceres, vises de her."}
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {filteredPosts.map((post) => (
                <BlogPostCard key={post.id} post={post} />
              ))}
            </div>
          )}
        </section>
      </div>
    </Layout>
  );
};

export default BlogIndex;
