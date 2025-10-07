import { useEffect, useMemo, useState } from "react";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  BlogPost,
  BlogStatus,
  fetchBlogPostById,
  saveBlogPost,
  uploadBlogCoverImage,
} from "@/lib/blogApi";
import { useNavigate, useParams } from "react-router-dom";
import { useBlogAdmin } from "@/hooks/useBlogAdmin";
import { toast } from "sonner";
import slugify from "slugify";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";

interface FormState {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  coverImageUrl: string | null;
  tags: string;
  readingMinutes: number;
  status: BlogStatus;
}

const defaultState: FormState = {
  title: "",
  slug: "",
  excerpt: "",
  content: "",
  coverImageUrl: null,
  tags: "",
  readingMinutes: 5,
  status: "draft",
};

const BlogEditorPage = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEditing = Boolean(id);
  const { isAdmin, loading: adminLoading } = useBlogAdmin();

  const [form, setForm] = useState<FormState>(defaultState);
  const [loading, setLoading] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);

  useEffect(() => {
    if (!isEditing || !id) {
      setInitialLoad(false);
      return;
    }

    let isMounted = true;
    setInitialLoad(true);

    fetchBlogPostById(id)
      .then((post) => {
        if (!isMounted) return;
        if (!post) {
          toast.error("Opslaget blev ikke fundet.");
          navigate("/admin/blog");
          return;
        }

        setForm({
          title: post.title,
          slug: post.slug,
          excerpt: post.excerpt,
          content: post.content,
          coverImageUrl: post.cover_image_url,
          tags: post.tags.join(", "),
          readingMinutes: post.reading_minutes ?? 5,
          status: post.status,
        });
        setSlugManuallyEdited(true);
      })
      .catch((err) => {
        console.error("Failed to fetch post", err);
        toast.error(
          err instanceof Error
            ? err.message
            : "Kunne ikke hente opslaget til redigering."
        );
        navigate("/admin/blog");
      })
      .finally(() => {
        if (isMounted) setInitialLoad(false);
      });

    return () => {
      isMounted = false;
    };
  }, [id, isEditing, navigate]);

  useEffect(() => {
    if (slugManuallyEdited || isEditing) return;
    if (!form.title.trim()) {
      setForm((prev) => ({ ...prev, slug: "" }));
      return;
    }
    const generated = slugify(form.title, {
      lower: true,
      strict: true,
      trim: true,
    });
    setForm((prev) => ({ ...prev, slug: generated }));
  }, [form.title, slugManuallyEdited, isEditing]);

  const tagList = useMemo(
    () =>
      form.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
    [form.tags]
  );

  const handleChange = <K extends keyof FormState>(
    key: K,
    value: FormState[K]
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    if (!event.target.files?.length) return;
    const file = event.target.files[0];
    try {
      setLoading(true);
      const url = await uploadBlogCoverImage(file, "covers/");
      handleChange("coverImageUrl", url);
      toast.success("Coverbillede uploadet.");
    } catch (err) {
      console.error("Failed to upload image", err);
      toast.error(
        err instanceof Error ? err.message : "Kunne ikke uploade billedet."
      );
    } finally {
      setLoading(false);
      event.target.value = "";
    }
  };

  const handleSubmit = async (publishAfterSave: boolean) => {
    try {
      setLoading(true);
      const payload = await saveBlogPost({
        id,
        title: form.title,
        slug: form.slug,
        excerpt: form.excerpt,
        content: form.content,
        coverImageUrl: form.coverImageUrl ?? undefined,
        tags: tagList,
        readingMinutes: Number(form.readingMinutes) || 5,
        status: publishAfterSave ? "published" : form.status,
        publishedAt:
          publishAfterSave || form.status === "published"
            ? form.status === "published"
              ? undefined
              : new Date().toISOString()
            : null,
      });
      toast.success(
        publishAfterSave
          ? "Opslaget er gemt og publiceret."
          : "Opslaget er gemt."
      );
      navigate("/admin/blog");
      return payload;
    } catch (err) {
      console.error("Failed to save blog post", err);
      toast.error(
        err instanceof Error
          ? err.message
          : "Kunne ikke gemme opslaget. Kontroller felterne og prøv igen."
      );
    } finally {
      setLoading(false);
    }
  };

  if (adminLoading || initialLoad) {
    return (
      <Layout>
        <div className="flex min-h-[60vh] items-center justify-center text-muted-foreground">
          Indlæser editor...
        </div>
      </Layout>
    );
  }

  if (!isAdmin) {
    return (
      <Layout>
        <div className="flex min-h-[60vh] flex-col items-center justify-center text-center text-muted-foreground">
          <p className="text-lg font-medium">
            Du har ikke blog-administratorrettigheder.
          </p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="mx-auto max-w-4xl space-y-10">
        <header className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-blue-500">
            {isEditing ? "Redigér opslag" : "Nyt opslag"}
          </p>
          <h1 className="text-3xl font-bold tracking-tight">
            {isEditing ? "Opdater blogindlæg" : "Opret blogindlæg"}
          </h1>
        </header>

        <div className="grid gap-8 lg:grid-cols-[2fr_1fr]">
          <section className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="title">Titel</Label>
              <Input
                id="title"
                value={form.title}
                onChange={(event) => handleChange("title", event.target.value)}
                placeholder="F.eks. Urban Trails ved Søerne"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="slug">Slug</Label>
              <Input
                id="slug"
                value={form.slug}
                onChange={(event) => {
                  setSlugManuallyEdited(true);
                  handleChange("slug", event.target.value);
                }}
                placeholder="urban-trails-ved-soerne"
              />
              <p className="text-xs text-muted-foreground">
                Slug bruges i URL&apos;en: <code>/blog/{form.slug || "slug"}</code>
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="excerpt">Uddrag</Label>
              <Textarea
                id="excerpt"
                value={form.excerpt}
                onChange={(event) =>
                  handleChange("excerpt", event.target.value)
                }
                placeholder="Kort introduktion til opslaget..."
                rows={4}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="content">Indhold (Markdown understøttet)</Label>
              <Textarea
                id="content"
                value={form.content}
                onChange={(event) =>
                  handleChange("content", event.target.value)
                }
                placeholder="# Overskrift\n\nSkriv din historie her..."
                rows={20}
              />
            </div>
          </section>

          <aside className="space-y-6">
            <div className="space-y-3 rounded-xl border bg-card p-5">
              <h2 className="text-lg font-semibold">Opslagsindstillinger</h2>
              <div className="flex items-center justify-between">
                <span className="text-sm">Publiceret</span>
                <Switch
                  checked={form.status === "published"}
                  onCheckedChange={(checked) =>
                    handleChange("status", checked ? "published" : "draft")
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="readingMinutes">Læsningstid (minutter)</Label>
                <Input
                  id="readingMinutes"
                  type="number"
                  min={1}
                  value={form.readingMinutes}
                  onChange={(event) =>
                    handleChange("readingMinutes", Number(event.target.value))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tags">Tags (komma-separeret)</Label>
                <Input
                  id="tags"
                  value={form.tags}
                  onChange={(event) => handleChange("tags", event.target.value)}
                  placeholder="intervaller, copenhagen, rutetips"
                />
                {tagList.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {tagList.map((tag) => (
                      <Badge key={tag} variant="outline">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-3 rounded-xl border bg-card p-5">
              <h2 className="text-lg font-semibold">Coverbillede</h2>
              <div className="space-y-3">
                {form.coverImageUrl ? (
                  <div className="overflow-hidden rounded-lg">
                    <img
                      src={form.coverImageUrl}
                      alt="Cover"
                      className="h-40 w-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="flex h-40 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
                    Intet billede valgt
                  </div>
                )}
                <Input type="file" accept="image/*" onChange={handleFileChange} />
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <Button
                disabled={loading}
                onClick={() => handleSubmit(false)}
                className="w-full"
              >
                Gem som kladde
              </Button>
              <Button
                disabled={loading}
                onClick={() => handleSubmit(true)}
                className="w-full"
              >
                Gem og publicér
              </Button>
              <Button
                variant="secondary"
                disabled={loading}
                onClick={() => navigate("/admin/blog")}
                className="w-full"
              >
                Annullér
              </Button>
            </div>
          </aside>
        </div>
      </div>
    </Layout>
  );
};

export default BlogEditorPage;
