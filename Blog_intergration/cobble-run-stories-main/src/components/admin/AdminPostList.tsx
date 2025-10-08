import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Edit, Trash2, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Post {
  id: string;
  title: string;
  slug: string;
  status: string;
  published_at: string | null;
  created_at: string;
  tags: string[];
}

export const AdminPostList = () => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [filteredPosts, setFilteredPosts] = useState<Post[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [deletePostId, setDeletePostId] = useState<string | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    fetchPosts();
  }, [user]);

  useEffect(() => {
    filterPosts();
  }, [posts, searchQuery, statusFilter]);

  const fetchPosts = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from("posts")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching posts:", error);
      toast({
        title: "Fejl",
        description: "Kunne ikke hente opslag",
        variant: "destructive",
      });
    } else {
      setPosts(data || []);
    }
  };

  const filterPosts = () => {
    let filtered = posts;

    if (statusFilter !== "all") {
      filtered = filtered.filter((post) => post.status === statusFilter);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (post) =>
          post.title.toLowerCase().includes(query) ||
          post.tags.some((tag) => tag.toLowerCase().includes(query))
      );
    }

    setFilteredPosts(filtered);
  };

  const handleDelete = async () => {
    if (!deletePostId) return;

    const { error } = await supabase
      .from("posts")
      .delete()
      .eq("id", deletePostId);

    if (error) {
      toast({
        title: "Fejl",
        description: "Kunne ikke slette opslag",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Slettet",
        description: "Opslaget er slettet",
      });
      fetchPosts();
    }

    setDeletePostId(null);
  };

  return (
    <>
      <div className="mb-6 flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Søg i opslag..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Alle status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle status</SelectItem>
            <SelectItem value="draft">Udkast</SelectItem>
            <SelectItem value="published">Publiceret</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="border border-border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Titel</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Tags</TableHead>
              <TableHead>Dato</TableHead>
              <TableHead className="text-right">Handlinger</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredPosts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  Ingen opslag fundet
                </TableCell>
              </TableRow>
            ) : (
              filteredPosts.map((post) => (
                <TableRow key={post.id}>
                  <TableCell className="font-medium">{post.title}</TableCell>
                  <TableCell>
                    <Badge variant={post.status === "published" ? "default" : "secondary"}>
                      {post.status === "published" ? "Publiceret" : "Udkast"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {post.tags.slice(0, 2).map((tag) => (
                        <Badge key={tag} variant="outline" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                      {post.tags.length > 2 && (
                        <Badge variant="outline" className="text-xs">
                          +{post.tags.length - 2}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {new Date(
                      post.published_at || post.created_at
                    ).toLocaleDateString("da-DK")}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(`/admin/rediger/${post.id}`)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeletePostId(post.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={!!deletePostId} onOpenChange={() => setDeletePostId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Er du sikker?</AlertDialogTitle>
            <AlertDialogDescription>
              Dette vil permanent slette opslaget. Denne handling kan ikke fortrydes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuller</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Slet</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
