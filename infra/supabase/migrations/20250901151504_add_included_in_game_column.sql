-- Add included_in_game column to user_activities table
ALTER TABLE public.user_activities
  ADD COLUMN IF NOT EXISTS included_in_game boolean NOT NULL DEFAULT true;

-- Update existing rows to be included in game by default  
UPDATE public.user_activities 
SET included_in_game = true 
WHERE included_in_game IS NULL;

-- Add comment
COMMENT ON COLUMN public.user_activities.included_in_game 
IS 'Flag to indicate if activity is included in the game/territory system';