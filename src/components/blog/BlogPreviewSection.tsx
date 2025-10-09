import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { BlogPost, fetchPublishedBlogPosts } from "@/lib/blogApi";
import { BlogPostCard } from "./BlogPostCard";
import { Search } from "lucide-react";

const PREVIEW_LIMIT = 4;
const SKELETON_PLACEHOLDER_COUNT = PREVIEW_LIMIT;
const EMPTY_STATE_MESSAGE = {
  default: "Ingen opslag endnu. Kig snart tilbage for nye historier.",
  filtered: "Ingen opslag matcher din søgning endnu.",
} as const;

const matchesSearchQuery = (post: BlogPost, query: string) => {
  const q = query.toLowerCase();
  return (
    post.title.toLowerCase().includes(q) ||
    post.excerpt.toLowerCase().includes(q) ||
    post.tags.some((tag) => tag.toLowerCase().includes(q))
  );
};

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
    if (!searchQuery) {
      return posts.slice(0, PREVIEW_LIMIT);
    }
    return posts.filter((post) => matchesSearchQuery(post, searchQuery)).slice(0, PREVIEW_LIMIT);
  }, [posts, searchQuery]);

  return (
    <section className="rounded-[40px] bg-[#1a1a1a] text-slate-50 shadow-[0_35px_120px_-70px_rgba(0,0,0,0.5)]">
      <div className="px-6 py-10 sm:px-10 sm:py-12 xl:px-16">
        <header className="flex flex-col gap-6">
          <div className="text-center">
            <p className="text-[0.8rem] font-semibold uppercase tracking-[0.35em] text-[#3b82f6]">
              RUNARO STORIES
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
              Urban running culture i København
            </h2>
            <p className="mt-4 mx-auto max-w-2xl text-base text-slate-400 sm:text-lg">
              Fra brostensintervaller på Nørrebro til sunrise runs ved havnen. Vi deler fortællinger, taktikker og oplevelser fra Runaro fællesskabet.
            </p>
          </div>
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <div className="relative w-full sm:w-72">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Søg i opslag eller tags..."
                className="border-slate-800 bg-[#242424] pl-9 text-slate-100 placeholder:text-slate-500 focus-visible:ring-slate-700"
              />
            </div>
            <Button variant="secondary" asChild className="bg-white text-slate-900 hover:bg-white/90 w-full sm:w-auto">
              <Link to="/blog">Tilbage til forsiden</Link>
            </Button>
          </div>
        </header>

        <div className="mt-12">
          {loading ? (
            <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: SKELETON_PLACEHOLDER_COUNT }).map((_, idx) => (
                <div
                  key={idx}
                  className="h-64 animate-pulse rounded-2xl bg-[#242424]"
                />
              ))}
            </div>
          ) : error ? (
            <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-6 text-sm text-red-200">
              {error}
            </div>
          ) : filteredPosts.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-800 px-4 py-10 text-center text-sm text-slate-500">
              {searchQuery ? EMPTY_STATE_MESSAGE.filtered : EMPTY_STATE_MESSAGE.default}
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
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
