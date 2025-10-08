-- Create storage bucket for post images
INSERT INTO storage.buckets (id, name, public)
VALUES ('post-images', 'post-images', true);

-- Create storage policies for post images
CREATE POLICY "Anyone can view post images"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'post-images');

CREATE POLICY "Authenticated users can upload post images"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'post-images' 
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "Users can update their own images"
  ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'post-images' 
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "Users can delete their own images"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'post-images' 
    AND auth.role() = 'authenticated'
  );