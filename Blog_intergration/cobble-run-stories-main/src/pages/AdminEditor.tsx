import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import slugify from "slugify";
import { ArrowLeft, Save, Upload, X, Crop, Eye } from "lucide-react";
import { ImageCropDialog } from "@/components/admin/ImageCropDialog";
import { PostPreview } from "@/components/admin/PostPreview";

const AdminEditor = () => {
  const { id } = useParams();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [content, setContent] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [tempImageForCrop, setTempImageForCrop] = useState("");
  const [showCropDialog, setShowCropDialog] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [tags, setTags] = useState("");
  const [readingMinutes, setReadingMinutes] = useState(5);
  const [status, setStatus] = useState<"draft" | "published">("draft");

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (id) {
      fetchPost();
    }
  }, [id]);

  const fetchPost = async () => {
    if (!id) return;

    const { data, error } = await supabase
      .from("posts")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      toast({
        title: "Fejl",
        description: "Kunne ikke hente opslag",
        variant: "destructive",
      });
    } else if (data) {
      setTitle(data.title);
      setSlug(data.slug);
      setExcerpt(data.excerpt);
      setContent(data.content);
      setCoverImageUrl(data.cover_image_url || "");
      setTags(data.tags.join(", "));
      setReadingMinutes(data.reading_minutes);
      setStatus(data.status as "draft" | "published");
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Fejl",
        description: "Kun billedfiler er tilladt",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "Fejl",
        description: "Billedet må max være 5MB",
        variant: "destructive",
      });
      return;
    }

    // Show the image in crop dialog first
    const reader = new FileReader();
    reader.onload = () => {
      setTempImageForCrop(reader.result as string);
      setShowCropDialog(true);
    };
    reader.readAsDataURL(file);
  };

  const handleCropComplete = async (croppedImageUrl: string) => {
    if (!user) return;
    
    setUploading(true);

    try {
      // Convert blob URL to blob
      const response = await fetch(croppedImageUrl);
      const blob = await response.blob();

      const fileName = `${user.id}-${Date.now()}.jpg`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('post-images')
        .upload(filePath, blob, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) {
        throw uploadError;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('post-images')
        .getPublicUrl(filePath);

      setCoverImageUrl(publicUrl);
      
      toast({
        title: "Upload succesfuld",
        description: "Billedet er uploadet",
      });
    } catch (error: any) {
      console.error('Upload error:', error);
      toast({
        title: "Upload fejlede",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveImage = () => {
    setCoverImageUrl("");
  };

  const handleOpenPreview = () => {
    const tagsArray = tags
      .split(",")
      .map((tag) => tag.trim())
      .filter((tag) => tag);
    
    setShowPreview(true);
  };

  const handleTitleChange = (value: string) => {
    setTitle(value);
    if (!id) {
      setSlug(
        slugify(value, {
          lower: true,
          strict: true,
          locale: "da",
        })
      );
    }
  };

  const handleSave = async (publishNow = false) => {
    if (!user) return;

    if (!title || !excerpt || !content) {
      toast({
        title: "Fejl",
        description: "Udfyld titel, uddrag og indhold",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    const tagsArray = tags
      .split(",")
      .map((tag) => tag.trim())
      .filter((tag) => tag);

    const postData = {
      title,
      slug,
      excerpt,
      content,
      cover_image_url: coverImageUrl || null,
      tags: tagsArray,
      reading_minutes: readingMinutes,
      status: publishNow ? "published" : status,
      published_at: publishNow ? new Date().toISOString() : null,
      author_id: user.id,
    };

    if (id) {
      const { error } = await supabase
        .from("posts")
        .update(postData)
        .eq("id", id);

      if (error) {
        toast({
          title: "Fejl",
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Gemt",
          description: "Opslaget er opdateret",
        });
        navigate("/admin");
      }
    } else {
      const { error } = await supabase.from("posts").insert([postData]);

      if (error) {
        toast({
          title: "Fejl",
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Oprettet",
          description: "Opslaget er oprettet",
        });
        navigate("/admin");
      }
    }

    setLoading(false);
  };

  if (authLoading) {
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

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1">
        <div className="container mx-auto px-4 py-12 max-w-4xl">
          <Button
            variant="ghost"
            onClick={() => navigate("/admin")}
            className="mb-8"
          >
            <ArrowLeft className="mr-2 w-4 h-4" />
            Tilbage til oversigt
          </Button>

          <h1 className="text-4xl font-headline font-bold mb-4">
            {id ? "Rediger opslag" : "Nyt opslag"}
          </h1>

          <div className="flex gap-2 mb-8">
            <Button
              type="button"
              variant="outline"
              onClick={handleOpenPreview}
              disabled={!title || !content}
            >
              <Eye className="mr-2 h-4 w-4" />
              Preview opslag
            </Button>
          </div>

          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="title">Titel</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => handleTitleChange(e.target.value)}
                placeholder="Brostensintervaller på Dronning Louises"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="slug">Slug (URL)</Label>
              <Input
                id="slug"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="brostensintervaller-dronning-louises"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="excerpt">Uddrag (2-3 linjer)</Label>
              <Textarea
                id="excerpt"
                value={excerpt}
                onChange={(e) => setExcerpt(e.target.value)}
                placeholder="4×800, sidevind og flade sko."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cover">Cover billede</Label>
              <div className="flex flex-col gap-4">
                {coverImageUrl && (
                  <div className="relative w-full aspect-video rounded-lg overflow-hidden border border-border">
                    <img
                      src={coverImageUrl}
                      alt="Cover preview"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-2 right-2 flex gap-2">
                      <Button
                        variant="secondary"
                        size="icon"
                        onClick={() => {
                          setTempImageForCrop(coverImageUrl);
                          setShowCropDialog(true);
                        }}
                        type="button"
                      >
                        <Crop className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="destructive"
                        size="icon"
                        onClick={handleRemoveImage}
                        type="button"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
                
                <div className="flex gap-2">
                  <Input
                    id="cover-file"
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    disabled={uploading}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => document.getElementById('cover-file')?.click()}
                    disabled={uploading}
                    className="flex-1"
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    {uploading ? "Uploader..." : "Upload billede"}
                  </Button>
                  
                  <div className="flex-1">
                    <Input
                      id="cover-url"
                      value={coverImageUrl}
                      onChange={(e) => setCoverImageUrl(e.target.value)}
                      placeholder="Eller indsæt URL..."
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tags">Tags (kommasepareret)</Label>
              <Input
                id="tags"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="Nørrebro, Interval, Træning"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="reading">Læsetid (minutter)</Label>
                <Input
                  id="reading"
                  type="number"
                  value={readingMinutes}
                  onChange={(e) => setReadingMinutes(Number(e.target.value))}
                  min={1}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select value={status} onValueChange={(v) => setStatus(v as "draft" | "published")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Udkast</SelectItem>
                    <SelectItem value="published">Publiceret</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="content">Indhold (Markdown)</Label>
              <Textarea
                id="content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Skriv dit opslag her... Du kan bruge Markdown formatering."
                rows={20}
                className="font-mono"
              />
            </div>

            <div className="flex gap-4">
              <Button
                onClick={() => handleSave(false)}
                disabled={loading}
                variant="outline"
                size="lg"
              >
                <Save className="mr-2 w-4 h-4" />
                Gem udkast
              </Button>
              <Button
                onClick={() => handleSave(true)}
                disabled={loading}
                size="lg"
              >
                Publicér
              </Button>
            </div>
          </div>
        </div>
      </main>

      <ImageCropDialog
        imageUrl={tempImageForCrop}
        open={showCropDialog}
        onClose={() => setShowCropDialog(false)}
        onCropComplete={handleCropComplete}
      />

      <PostPreview
        open={showPreview}
        onClose={() => setShowPreview(false)}
        title={title}
        excerpt={excerpt}
        content={content}
        coverImageUrl={coverImageUrl}
        tags={tags.split(",").map((tag) => tag.trim()).filter((tag) => tag)}
        readingMinutes={readingMinutes}
      />

      <Footer />
    </div>
  );
};

export default AdminEditor;
