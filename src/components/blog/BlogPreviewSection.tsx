import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { BlogPost, fetchPublishedBlogPosts } from "@/lib/blogApi";
import { BlogPostCard } from "./BlogPostCard";
import { Search } from "lucide-react";

export const BlogPreviewSection = () => {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
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
    if (!searchQuery) return posts.slice(0, 3);
    const q = searchQuery.toLowerCase();
    return posts
      .filter(
        (post) =>
          post.title.toLowerCase().includes(q) ||
          post.excerpt.toLowerCase().includes(q) ||
          post.tags.some((tag) => tag.toLowerCase().includes(q))
      )
      .slice(0, 3);
  }, [posts, searchQuery]);

  return (
    <section className="rounded-3xl bg-slate-950 text-slate-50 shadow-2xl ring-1 ring-inset ring-slate-800">
      <div className="px-6 py-10 sm:px-10 sm:py-12 lg:px-16">
        <header className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-400">
              Runaro Stories
            </p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
              Fra brostensintervaller til sunrise runs
            </h2>
            <p className="mt-3 max-w-xl text-base text-slate-300">
              Dyk ned i løbekulturen. Læs om ruter, taktik og hverdagsfortællinger
              fra Runaro fællesskabet.
            </p>
          </div>
          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
            <div className="relative w-full sm:w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Søg i opslag eller tags..."
                className="border-slate-700 bg-slate-900 pl-9 text-slate-100 placeholder:text-slate-500"
              />
            </div>
            <Button variant="secondary" asChild className="bg-slate-100 text-slate-900">
              <Link to="/blog">Se alle historier</Link>
            </Button>
          </div>
        </header>

        <div className="mt-10">
          {loading ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }).map((_, idx) => (
                <div
                  key={idx}
                  className="h-64 animate-pulse rounded-2xl bg-slate-900/80"
                />
              ))}
            </div>
          ) : error ? (
            <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-6 text-sm text-red-200">
              {error}
            </div>
          ) : filteredPosts.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-700 px-4 py-10 text-center text-sm text-slate-400">
              {searchQuery
                ? "Ingen opslag matcher din søgning endnu."
                : "Ingen opslag endnu. Kig snart tilbage for nye historier."}
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {filteredPosts.map((post) => (
                <BlogPostCard key={post.id} post={post} />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
