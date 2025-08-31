-- Add total_points column to profiles if it doesn't exist
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS total_points INTEGER DEFAULT 0;

-- Create function to increment user points
CREATE OR REPLACE FUNCTION public.increment_user_points(user_uuid UUID, points_to_add INTEGER)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.profiles 
  SET total_points = COALESCE(total_points, 0) + points_to_add
  WHERE user_id = user_uuid;
END;
$$;