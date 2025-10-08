import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Clock } from "lucide-react";
import ReactMarkdown from "react-markdown";

interface PostPreviewProps {
  open: boolean;
  onClose: () => void;
  title: string;
  excerpt: string;
  content: string;
  coverImageUrl: string;
  tags: string[];
  readingMinutes: number;
}

export const PostPreview = ({
  open,
  onClose,
  title,
  excerpt,
  content,
  coverImageUrl,
  tags,
  readingMinutes,
}: PostPreviewProps) => {
  const today = new Date().toLocaleDateString("da-DK", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Preview af opslag</DialogTitle>
        </DialogHeader>

        <article className="py-4">
          {coverImageUrl && (
            <div className="w-full aspect-[21/9] overflow-hidden bg-muted rounded-lg mb-6">
              <img
                src={coverImageUrl}
                alt={title}
                className="w-full h-full object-cover"
              />
            </div>
          )}

          <div className="space-y-6">
            <header>
              <div className="flex flex-wrap gap-2 mb-4">
                {tags.map((tag) => (
                  <Badge key={tag} variant="secondary">
                    {tag}
                  </Badge>
                ))}
              </div>

              <h1 className="text-4xl md:text-5xl font-headline font-bold mb-4 tracking-tight">
                {title || "Titel mangler"}
              </h1>

              <div className="flex items-center gap-4 text-sm text-muted-foreground mb-6">
                <span>{today}</span>
                <div className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  <span>{readingMinutes} min læsning</span>
                </div>
              </div>

              {excerpt && (
                <p className="text-lg text-muted-foreground border-l-4 border-primary pl-4 py-2 mb-6">
                  {excerpt}
                </p>
              )}
            </header>

            <div className="prose prose-lg dark:prose-invert max-w-none prose-headings:font-headline prose-headings:font-bold prose-a:text-primary prose-a:no-underline hover:prose-a:underline prose-img:rounded-lg">
              {content ? (
                <ReactMarkdown>{content}</ReactMarkdown>
              ) : (
                <p className="text-muted-foreground">Indhold mangler</p>
              )}
            </div>
          </div>
        </article>
      </DialogContent>
    </Dialog>
  );
};
