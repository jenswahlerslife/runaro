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
    <Layout backgroundClassName="bg-[#1a1a1a]">
      <div className="space-y-12">
        <section className="space-y-8 px-8 py-16">
          <div className="space-y-4">
            <h1 className="text-5xl font-bold tracking-tight text-white sm:text-6xl md:text-7xl">
              Runaro
            </h1>
            <p className="max-w-2xl text-lg text-slate-400">
              Urban running culture. Fra brostensintervaller på Nørrebro til sunrise runs ved havnen.
            </p>
          </div>
          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
            <div className="relative w-full max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Søg i opslag eller tags..."
                className="border-slate-800 bg-[#242424] pl-9 text-slate-100 placeholder:text-slate-500 focus-visible:ring-slate-700"
              />
            </div>
          </div>
        </section>

        <section className="px-8">
          {loading ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, idx) => (
                <div
                  key={idx}
                  className="h-64 animate-pulse rounded-2xl bg-[#242424]"
                />
              ))}
            </div>
          ) : error ? (
            <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-6 text-sm text-red-200">
              {error}
            </div>
          ) : filteredPosts.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-800 p-10 text-center text-slate-500">
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
