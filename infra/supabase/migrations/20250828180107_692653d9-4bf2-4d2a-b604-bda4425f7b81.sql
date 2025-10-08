-- Clean up existing blog tables and create territory game schema
DROP TABLE IF EXISTS public.blog_post_likes CASCADE;
DROP TABLE IF EXISTS public.blog_posts CASCADE;
DROP TABLE IF EXISTS public.newsletter_subscribers CASCADE;

-- Update profiles table for the game
ALTER TABLE public.profiles 
  DROP COLUMN IF EXISTS email,
  DROP COLUMN IF EXISTS full_name,
  ADD COLUMN IF NOT EXISTS username TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS display_name TEXT,
  ADD COLUMN IF NOT EXISTS strava_access_token TEXT,
  ADD COLUMN IF NOT EXISTS strava_refresh_token TEXT,
  ADD COLUMN IF NOT EXISTS strava_athlete_id BIGINT;

-- Create leagues table
CREATE TABLE public.leagues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  invite_code TEXT UNIQUE NOT NULL,
  creator_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  is_private BOOLEAN DEFAULT true,
  season_start_date TIMESTAMP WITH TIME ZONE DEFAULT now(),
  season_end_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create league memberships table
CREATE TABLE public.league_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID REFERENCES public.leagues(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(league_id, user_id)
);

-- Create activities table (using simple JSON for geometry until PostGIS is enabled)
CREATE TABLE public.activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  league_id UUID REFERENCES public.leagues(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  activity_type TEXT NOT NULL CHECK (activity_type IN ('Run', 'Walk')),
  distance_km NUMERIC(10,3) NOT NULL,
  gpx_data TEXT, -- Store the full GPX data
  route_coordinates JSONB, -- Store as GeoJSON LineString coordinates
  territory_coordinates JSONB, -- Store as GeoJSON Polygon coordinates
  territory_area_km2 NUMERIC(15,6),
  strava_activity_id BIGINT,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create territory ownership table (for tracking who owns what areas)
CREATE TABLE public.territory_ownership (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID REFERENCES public.leagues(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  activity_id UUID REFERENCES public.activities(id) ON DELETE CASCADE,
  territory_coordinates JSONB, -- Store as GeoJSON Polygon coordinates
  area_km2 NUMERIC(15,6),
  claimed_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(league_id, activity_id)
);

-- Enable RLS on all tables
ALTER TABLE public.leagues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.league_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.territory_ownership ENABLE ROW LEVEL SECURITY;

-- RLS policies for leagues
CREATE POLICY "Users can view leagues they are members of" 
ON public.leagues FOR SELECT 
USING (
  auth.uid() IN (
    SELECT user_id FROM public.league_memberships 
    WHERE league_id = leagues.id
  )
);

CREATE POLICY "Users can create leagues" 
ON public.leagues FOR INSERT 
WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "League creators can update their leagues" 
ON public.leagues FOR UPDATE 
USING (auth.uid() = creator_id);

-- RLS policies for league memberships
CREATE POLICY "Users can view memberships for their leagues" 
ON public.league_memberships FOR SELECT 
USING (
  auth.uid() IN (
    SELECT user_id FROM public.league_memberships lm 
    WHERE lm.league_id = league_memberships.league_id
  )
);

CREATE POLICY "Users can join leagues" 
ON public.league_memberships FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- RLS policies for activities
CREATE POLICY "Users can view activities in their leagues" 
ON public.activities FOR SELECT 
USING (
  auth.uid() IN (
    SELECT user_id FROM public.league_memberships 
    WHERE league_id = activities.league_id
  )
);

CREATE POLICY "Users can upload their own activities" 
ON public.activities FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own activities" 
ON public.activities FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own activities" 
ON public.activities FOR DELETE 
USING (auth.uid() = user_id);

-- RLS policies for territory ownership
CREATE POLICY "Users can view territory in their leagues" 
ON public.territory_ownership FOR SELECT 
USING (
  auth.uid() IN (
    SELECT user_id FROM public.league_memberships 
    WHERE league_id = territory_ownership.league_id
  )
);

CREATE POLICY "System can manage territory ownership" 
ON public.territory_ownership FOR ALL 
USING (true);

-- Create indexes for performance
CREATE INDEX idx_activities_league_id ON public.activities(league_id);
CREATE INDEX idx_activities_user_id ON public.activities(user_id);
CREATE INDEX idx_territory_ownership_league_id ON public.territory_ownership(league_id);
CREATE INDEX idx_league_memberships_user_id ON public.league_memberships(user_id);
CREATE INDEX idx_league_memberships_league_id ON public.league_memberships(league_id);

-- Create function to generate unique invite codes
CREATE OR REPLACE FUNCTION public.generate_invite_code()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  code TEXT;
  exists_check BOOLEAN;
BEGIN
  LOOP
    code := upper(substring(md5(random()::text) from 1 for 8));
    SELECT EXISTS(SELECT 1 FROM public.leagues WHERE invite_code = code) INTO exists_check;
    IF NOT exists_check THEN
      RETURN code;
    END IF;
  END LOOP;
END;
$$;

-- Trigger to auto-generate invite codes
CREATE OR REPLACE FUNCTION public.set_invite_code()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.invite_code IS NULL OR NEW.invite_code = '' THEN
    NEW.invite_code := public.generate_invite_code();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_set_invite_code
  BEFORE INSERT ON public.leagues
  FOR EACH ROW
  EXECUTE FUNCTION public.set_invite_code();

-- Function to update updated_at timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_leagues_updated_at
  BEFORE UPDATE ON public.leagues
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();