import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  BlogPost,
  deleteBlogPost,
  fetchAllBlogPosts,
  saveBlogPost,
} from "@/lib/blogApi";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import { Link, useNavigate } from "react-router-dom";
import { Pencil, Plus, Trash2, CheckCircle2, ShieldAlert } from "lucide-react";
import { useBlogAdmin } from "@/hooks/useBlogAdmin";
import { toast } from "sonner";

const BlogAdminDashboard = () => {
  const navigate = useNavigate();
  const { isAdmin, loading: adminLoading, error: adminError } = useBlogAdmin();
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin) return;
    const load = async () => {
      try {
        setLoading(true);
        const data = await fetchAllBlogPosts();
        setPosts(data);
        setError(null);
      } catch (err) {
        console.error("Failed to load admin posts", err);
        setError(
          err instanceof Error
            ? err.message
            : "Kunne ikke hente blogindlæg til administration."
        );
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [isAdmin]);

  const handleTogglePublish = async (post: BlogPost) => {
    try {
      const nextStatus = post.status === "published" ? "draft" : "published";
      const updated = await saveBlogPost({
        id: post.id,
        title: post.title,
        slug: post.slug,
        excerpt: post.excerpt,
        content: post.content,
        coverImageUrl: post.cover_image_url ?? undefined,
        tags: post.tags,
        readingMinutes: post.reading_minutes,
        status: nextStatus,
        publishedAt:
          nextStatus === "published"
            ? post.published_at ?? new Date().toISOString()
            : null,
      });
      setPosts((prev) =>
        prev.map((p) => (p.id === post.id ? { ...p, ...updated } : p))
      );
      toast.success(
        nextStatus === "published"
          ? "Opslaget er publiceret."
          : "Opslaget er sat som kladde."
      );
    } catch (err) {
      console.error("Failed to toggle publish state", err);
      toast.error(
        err instanceof Error
          ? err.message
          : "Kunne ikke opdatere status for opslaget."
      );
    }
  };

  const handleDelete = async (post: BlogPost) => {
    if (
      !confirm(
        `Er du sikker på, at du vil slette "${post.title}"? Dette kan ikke fortrydes.`
      )
    ) {
      return;
    }
    try {
      await deleteBlogPost(post.id);
      setPosts((prev) => prev.filter((p) => p.id !== post.id));
      toast.success("Opslag slettet.");
    } catch (err) {
      console.error("Failed to delete post", err);
      toast.error(
        err instanceof Error
          ? err.message
          : "Kunne ikke slette opslaget. Prøv igen."
      );
    }
  };

  return (
    <Layout>
      <div className="space-y-10">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-blue-500">
              Blog administration
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight">
              Administrér Runaro Stories
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Opret, redigér og publicér historier til forsiden.
            </p>
          </div>
          <Button onClick={() => navigate("/admin/blog/new")}>
            <Plus className="mr-2 h-4 w-4" />
            Nyt opslag
          </Button>
        </header>

        {adminLoading ? (
          <Card>
            <CardContent className="py-16 text-center text-muted-foreground">
              Henter administratorrettigheder...
            </CardContent>
          </Card>
        ) : adminError ? (
          <Card>
            <CardContent className="py-16 text-center text-destructive">
              {adminError}
            </CardContent>
          </Card>
        ) : !isAdmin ? (
          <Card className="border-red-200 bg-red-50 dark:border-red-500/50 dark:bg-red-500/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-700 dark:text-red-200">
                <ShieldAlert className="h-5 w-5" />
                Adgang nægtet
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-red-700 dark:text-red-200">
              Du har ikke blog-administratorrettigheder. Kontakt en systemadministrator hvis du behøver adgang.
            </CardContent>
          </Card>
        ) : loading ? (
          <Card>
            <CardContent className="py-16 text-center text-muted-foreground">
              Henter blogindlæg...
            </CardContent>
          </Card>
        ) : error ? (
          <Card>
            <CardContent className="py-16 text-center text-destructive">
              {error}
            </CardContent>
          </Card>
        ) : posts.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center text-muted-foreground">
              Ingen opslag endnu. Klik på &quot;Nyt opslag&quot; for at komme i gang.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {posts.map((post) => (
              <Card key={post.id}>
                <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <CardTitle>{post.title}</CardTitle>
                      <Badge
                        variant={
                          post.status === "published" ? "default" : "secondary"
                        }
                      >
                        {post.status === "published" ? "Publiceret" : "Kladde"}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                      <span>Slug: {post.slug}</span>
                      <Separator orientation="vertical" className="hidden h-4 sm:block" />
                      <span>{post.reading_minutes} min læsning</span>
                      {post.published_at && (
                        <>
                          <Separator orientation="vertical" className="hidden h-4 sm:block" />
                          <time dateTime={post.published_at}>
                            Publiceret{" "}
                            {format(new Date(post.published_at), "PPP", {
                              locale: da,
                            })}
                          </time>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      className="gap-2"
                      onClick={() => handleTogglePublish(post)}
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      {post.status === "published" ? "Flyt til kladde" : "Publicér"}
                    </Button>
                    <Button
                      variant="outline"
                      className="gap-2"
                      asChild
                    >
                      <Link to={`/admin/blog/${post.id}`}>
                        <Pencil className="h-4 w-4" />
                        Redigér
                      </Link>
                    </Button>
                    <Button
                      variant="destructive"
                      className="gap-2"
                      onClick={() => handleDelete(post)}
                    >
                      <Trash2 className="h-4 w-4" />
                      Slet
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">{post.excerpt}</p>
                  {post.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {post.tags.map((tag) => (
                        <Badge key={`${post.id}-${tag}`} variant="outline">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default BlogAdminDashboard;
