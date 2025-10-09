import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock } from "lucide-react";
import { BlogPost } from "@/lib/blogApi";
import { formatDistanceToNow } from "date-fns";
import { da } from "date-fns/locale";

interface BlogPostCardProps {
  post: BlogPost;
}

export const BlogPostCard = ({ post }: BlogPostCardProps) => {
  const publishedDate = post.published_at
    ? new Date(post.published_at)
    : null;

  return (
    <Link to={`/blog/${post.slug}`} className="block transition-transform hover:-translate-y-1">
      <Card className="h-full bg-[#242424] border-slate-800 text-slate-100 hover:border-slate-700">
        {post.cover_image_url && (
          <div className="aspect-video overflow-hidden rounded-t-lg">
            <img
              src={post.cover_image_url}
              alt={post.title}
              className="h-full w-full object-cover transition-transform duration-300 hover:scale-105"
              loading="lazy"
            />
          </div>
        )}
        <CardHeader className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {post.tags.slice(0, 3).map((tag) => (
              <Badge
                key={`${post.id}-${tag}`}
                variant="secondary"
                className="bg-slate-800 text-slate-300 border-slate-700"
              >
                {tag}
              </Badge>
            ))}
          </div>
          <CardTitle className="text-2xl font-semibold tracking-tight text-white">
            {post.title}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm leading-relaxed text-slate-400 line-clamp-3">
            {post.excerpt}
          </p>
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {post.reading_minutes} min læsning
            </span>
            {publishedDate && (
              <time dateTime={publishedDate.toISOString()}>
                {formatDistanceToNow(publishedDate, {
                  addSuffix: true,
                  locale: da,
                })}
              </time>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
};
