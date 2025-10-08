-- Blog integration schema
-- Adds blog post storage tied to Runaro profiles and basic admin flagging.

-- Ensure profiles table exposes a blog admin flag (defaults to false)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_blog_admin boolean DEFAULT false;

-- Helper: get current user's profile id (profiles.id)
CREATE OR REPLACE FUNCTION public.current_profile_id()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_profile_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT p.id
  INTO v_profile_id
  FROM public.profiles p
  WHERE p.user_id = auth.uid();

  RETURN v_profile_id;
END;
$$;

-- Helper: check if the current user is a blog admin
CREATE OR REPLACE FUNCTION public.is_blog_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_blog_admin
     FROM public.profiles
     WHERE user_id = auth.uid()),
    false
  );
$$;

-- Blog posts table (content lives as markdown in content column)
CREATE TABLE IF NOT EXISTS public.blog_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  slug text NOT NULL UNIQUE,
  excerpt text NOT NULL,
  content text NOT NULL,
  cover_image_url text,
  tags text[] DEFAULT '{}'::text[],
  reading_minutes integer DEFAULT 5 CHECK (reading_minutes > 0),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  published_at timestamptz,
  author_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;

-- Timestamp maintenance: update updated_at on changes and backfill published_at when publishing
CREATE OR REPLACE FUNCTION public.blog_posts_set_timestamps()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at := now();

  IF NEW.status = 'published'
     AND (OLD.status IS DISTINCT FROM 'published')
     AND NEW.published_at IS NULL THEN
    NEW.published_at := now();
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER blog_posts_touch_timestamp
BEFORE UPDATE ON public.blog_posts
FOR EACH ROW
EXECUTE FUNCTION public.blog_posts_set_timestamps();

-- RLS policies
CREATE POLICY "Public blog posts readable"
  ON public.blog_posts
  FOR SELECT
  USING (
    status = 'published'
    OR public.is_blog_admin()
    OR author_id = public.current_profile_id()
  );

CREATE POLICY "Blog admins can insert"
  ON public.blog_posts
  FOR INSERT
  WITH CHECK (
    public.is_blog_admin()
    AND author_id = public.current_profile_id()
  );

CREATE POLICY "Blog admins or authors can update"
  ON public.blog_posts
  FOR UPDATE
  USING (
    public.is_blog_admin()
    OR author_id = public.current_profile_id()
  )
  WITH CHECK (
    public.is_blog_admin()
    OR author_id = public.current_profile_id()
  );

CREATE POLICY "Blog admins or authors can delete"
  ON public.blog_posts
  FOR DELETE
  USING (
    public.is_blog_admin()
    OR author_id = public.current_profile_id()
  );

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_blog_posts_status ON public.blog_posts(status);
CREATE INDEX IF NOT EXISTS idx_blog_posts_published_at ON public.blog_posts(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_blog_posts_tags ON public.blog_posts USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_blog_posts_author ON public.blog_posts(author_id);

-- Storage bucket for blog cover images
INSERT INTO storage.buckets (id, name, public)
VALUES ('blog-post-images', 'blog-post-images', true)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Blog images public read'
  ) THEN
    CREATE POLICY "Blog images public read"
      ON storage.objects
      FOR SELECT
      USING (bucket_id = 'blog-post-images');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Blog images authenticated write'
  ) THEN
    CREATE POLICY "Blog images authenticated write"
      ON storage.objects
      FOR INSERT
      WITH CHECK (
        bucket_id = 'blog-post-images'
        AND auth.role() = 'authenticated'
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Blog images authenticated update'
  ) THEN
    CREATE POLICY "Blog images authenticated update"
      ON storage.objects
      FOR UPDATE
      USING (
        bucket_id = 'blog-post-images'
        AND auth.role() = 'authenticated'
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Blog images authenticated delete'
  ) THEN
    CREATE POLICY "Blog images authenticated delete"
      ON storage.objects
      FOR DELETE
      USING (
        bucket_id = 'blog-post-images'
        AND auth.role() = 'authenticated'
      );
  END IF;
END;
$$;

COMMENT ON TABLE public.blog_posts IS 'Runaro blog posts authored by profiles (markdown content).';
COMMENT ON FUNCTION public.current_profile_id() IS 'Returns the profiles.id for the current auth user.';
COMMENT ON FUNCTION public.is_blog_admin() IS 'Checks if the current auth user has blog admin privileges.';
