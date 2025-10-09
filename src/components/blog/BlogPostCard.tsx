import { Link } from "react-router-dom";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { BlogPost } from "@/lib/blogApi";

interface BlogPostCardProps {
  post: BlogPost;
}

export const BlogPostCard = ({ post }: BlogPostCardProps) => {
  return (
    <Link to={`/blog/${post.slug}`} className="block transition-transform hover:-translate-y-1">
      <Card className="h-full bg-[#242424] border-slate-800 text-slate-100 hover:border-slate-700 overflow-hidden">
        {post.cover_image_url && (
          <div className="aspect-[4/3] overflow-hidden">
            <img
              src={post.cover_image_url}
              alt={post.title}
              className="h-full w-full object-cover transition-transform duration-300 hover:scale-105"
              loading="lazy"
            />
          </div>
        )}
        <CardHeader>
          <CardTitle className="text-xl font-semibold tracking-tight text-white">
            {post.title}
          </CardTitle>
        </CardHeader>
      </Card>
    </Link>
  );
};
