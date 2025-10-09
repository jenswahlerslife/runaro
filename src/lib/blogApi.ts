// @ts-nocheck
import { supabase } from "@/integrations/supabase/client";

export type BlogStatus = "draft" | "published";

export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  cover_image_url: string | null;
  tags: string[];
  reading_minutes: number;
  status: BlogStatus;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  author_id: string | null;
  author?: {
    username: string | null;
    display_name: string | null;
  } | null;
}

export interface SaveBlogPostInput {
  id?: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  coverImageUrl?: string | null;
  tags?: string[];
  readingMinutes?: number;
  status?: BlogStatus;
  publishedAt?: string | null;
}

type SupabaseError = { message?: string; details?: string; hint?: string } | null;

const BLOG_TABLE = "blog_posts";
const BLOG_IMAGE_BUCKET = "blog-post-images";

function buildErrorMessage(error: SupabaseError): string {
  if (!error) return "Ukendt fejl";
  return (
    error.message ??
    error.details ??
    error.hint ??
    "Ukendt fejl ved blog-forespørgsel"
  );
}

async function getCurrentProfileId(): Promise<string> {
  const { data, error } = await supabase.rpc("current_profile_id");
  if (error) {
    throw new Error(buildErrorMessage(error));
  }
  if (!data) {
    throw new Error("Ingen profil fundet for den nuværende bruger.");
  }
  return data as string;
}

function mapPost(row: any): BlogPost {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    excerpt: row.excerpt,
    content: row.content,
    cover_image_url: row.cover_image_url ?? null,
    tags: row.tags ?? [],
    reading_minutes: row.reading_minutes ?? 5,
    status: row.status,
    published_at: row.published_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
    author_id: row.author_id ?? null,
    author: row.author ?? null,
  };
}

export async function fetchPublishedBlogPosts(): Promise<BlogPost[]> {
  // Primary: new blog_posts table
  const { data, error } = await supabase
    .from(BLOG_TABLE)
    .select(
      "*, author:profiles!blog_posts_author_id_fkey(username, display_name)"
    )
    .eq("status", "published")
    .order("published_at", { ascending: false });

  if (error) {
    throw new Error(buildErrorMessage(error));
  }

  // If no rows found in blog_posts, fall back to legacy posts table
  if (!data || data.length === 0) {
    const { data: legacy, error: legacyError } = await supabase
      .from("posts")
      .select("*")
      .eq("status", "published")
      .order("published_at", { ascending: false });

    if (legacyError) {
      throw new Error(buildErrorMessage(legacyError));
    }

    return (legacy ?? []).map(mapPost);
  }

  return data.map(mapPost);
}

export async function fetchAllBlogPosts(): Promise<BlogPost[]> {
  const { data, error } = await supabase
    .from(BLOG_TABLE)
    .select(
      "*, author:profiles!blog_posts_author_id_fkey(username, display_name)"
    )
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(buildErrorMessage(error));
  }

  return (data ?? []).map(mapPost);
}

export async function fetchBlogPostBySlug(
  slug: string,
  includeDraft: boolean = false
): Promise<BlogPost | null> {
  const query = supabase
    .from(BLOG_TABLE)
    .select(
      "*, author:profiles!blog_posts_author_id_fkey(username, display_name)"
    )
    .eq("slug", slug)
    .single();

  const { data, error } = includeDraft
    ? await query
    : await query.eq("status", "published");

  if (error) {
    if (error.message?.includes("No rows")) {
      return null;
    }
    throw new Error(buildErrorMessage(error));
  }

  return data ? mapPost(data) : null;
}

export async function fetchBlogPostById(
  id: string
): Promise<BlogPost | null> {
  const { data, error } = await supabase
    .from(BLOG_TABLE)
    .select(
      "*, author:profiles!blog_posts_author_id_fkey(username, display_name)"
    )
    .eq("id", id)
    .single();

  if (error) {
    if (error.message?.includes("No rows")) {
      return null;
    }
    throw new Error(buildErrorMessage(error));
  }

  return data ? mapPost(data) : null;
}

export async function saveBlogPost(input: SaveBlogPostInput): Promise<BlogPost> {
  const profileId = await getCurrentProfileId();
  const payload = {
    title: input.title,
    slug: input.slug,
    excerpt: input.excerpt,
    content: input.content,
    cover_image_url: input.coverImageUrl ?? null,
    tags: input.tags ?? [],
    reading_minutes: input.readingMinutes ?? 5,
    status: input.status ?? "draft",
    published_at: input.publishedAt ?? null,
    author_id: profileId,
  };

  if (input.id) {
    const { data, error } = await supabase
      .from(BLOG_TABLE)
      .update(payload)
      .eq("id", input.id)
      .select(
        "*, author:profiles!blog_posts_author_id_fkey(username, display_name)"
      )
      .single();

    if (error) {
      throw new Error(buildErrorMessage(error));
    }

    return mapPost(data);
  }

  const { data, error } = await supabase
    .from(BLOG_TABLE)
    .insert(payload)
    .select(
      "*, author:profiles!blog_posts_author_id_fkey(username, display_name)"
    )
    .single();

  if (error) {
    throw new Error(buildErrorMessage(error));
  }

  return mapPost(data);
}

export async function deleteBlogPost(id: string): Promise<void> {
  const { error } = await supabase.from(BLOG_TABLE).delete().eq("id", id);
  if (error) {
    throw new Error(buildErrorMessage(error));
  }
}

export async function uploadBlogCoverImage(
  file: File,
  pathPrefix: string = ""
): Promise<string> {
  const ext = file.name.split(".").pop();
  const filename = `${pathPrefix}${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}.${ext}`;

  const { data, error } = await supabase.storage
    .from(BLOG_IMAGE_BUCKET)
    .upload(filename, file, {
      cacheControl: "3600",
      upsert: false,
    });

  if (error) {
    throw new Error(buildErrorMessage(error));
  }

  const { data: publicUrl } = supabase.storage
    .from(BLOG_IMAGE_BUCKET)
    .getPublicUrl(data.path);

  return publicUrl.publicUrl;
}
