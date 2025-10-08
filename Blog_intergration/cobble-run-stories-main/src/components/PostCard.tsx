import { Link } from "react-router-dom";
import { Clock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface PostCardProps {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  coverImageUrl?: string;
  tags: string[];
  readingMinutes: number;
  publishedAt: string;
}

export const PostCard = ({
  id,
  title,
  slug,
  excerpt,
  coverImageUrl,
  tags,
  readingMinutes,
  publishedAt,
}: PostCardProps) => {
  const formattedDate = new Date(publishedAt).toLocaleDateString("da-DK", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <Link to={`/post/${slug}`} className="group">
      <Card className="overflow-hidden border-border bg-card hover:border-primary transition-smooth h-full flex flex-col">
        {coverImageUrl && (
          <div className="aspect-[16/9] overflow-hidden">
            <img
              src={coverImageUrl}
              alt={title}
              className="w-full h-full object-cover group-hover:scale-105 transition-smooth"
            />
          </div>
        )}
        <div className="p-6 flex-1 flex flex-col">
          <div className="flex flex-wrap gap-2 mb-3">
            {tags.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
          
          <h3 className="text-2xl font-headline font-bold mb-2 group-hover:text-primary transition-smooth">
            {title}
          </h3>
          
          <p className="text-muted-foreground mb-4 line-clamp-2 flex-1">
            {excerpt}
          </p>
          
          <div className="flex items-center gap-4 text-sm text-muted-foreground mt-auto">
            <span>{formattedDate}</span>
            <div className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              <span>{readingMinutes} min</span>
            </div>
          </div>
        </div>
      </Card>
    </Link>
  );
};
