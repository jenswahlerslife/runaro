-- Fix posts foreign key constraint to reference auth.users instead of profiles
-- This allows post creation to work independently of profile creation

-- Drop the existing constraint
ALTER TABLE public.posts 
  DROP CONSTRAINT IF EXISTS fk_posts_author_id;

-- Recreate with reference to auth.users
ALTER TABLE public.posts
  ADD CONSTRAINT fk_posts_author_id 
  FOREIGN KEY (author_id) 
  REFERENCES auth.users(id) 
  ON DELETE CASCADE;

-- Update RLS policies to use auth.uid() directly
DROP POLICY IF EXISTS "Posts are viewable by everyone" ON public.posts;
DROP POLICY IF EXISTS "Authenticated users can create posts" ON public.posts;
DROP POLICY IF EXISTS "Users can update their own posts" ON public.posts;
DROP POLICY IF EXISTS "Users can delete their own posts" ON public.posts;
DROP POLICY IF EXISTS "Admins can manage all posts" ON public.posts;

-- Recreate policies
CREATE POLICY "Posts are viewable by everyone"
  ON public.posts
  FOR SELECT
  USING (status = 'published' OR author_id = auth.uid());

CREATE POLICY "Authenticated users can create posts"
  ON public.posts
  FOR INSERT
  WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Users can update their own posts"
  ON public.posts
  FOR UPDATE
  USING (auth.uid() = author_id);

CREATE POLICY "Users can delete their own posts"
  ON public.posts
  FOR DELETE
  USING (auth.uid() = author_id);

-- Allow admins to manage all posts (uses security definer function)
CREATE POLICY "Admins can manage all posts"
  ON public.posts
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
