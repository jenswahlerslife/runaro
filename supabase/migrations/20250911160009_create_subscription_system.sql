-- Create subscription system for Runaro
-- Based on reference project but adapted for current schema

-- Create subscribers table
CREATE TABLE IF NOT EXISTS public.subscribers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  email text NOT NULL UNIQUE,
  stripe_customer_id text,
  subscribed boolean NOT NULL DEFAULT false,
  subscription_tier text DEFAULT 'free' CHECK (subscription_tier IN ('free', 'pro')),
  subscription_end timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_subscribers_user_id ON public.subscribers(user_id);
CREATE INDEX IF NOT EXISTS idx_subscribers_stripe_customer_id ON public.subscribers(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_subscribers_subscription_tier ON public.subscribers(subscription_tier);

-- Enable RLS
ALTER TABLE public.subscribers ENABLE ROW LEVEL SECURITY;

-- RLS policies for subscribers
CREATE POLICY "Users can view their own subscription"
  ON public.subscribers FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own subscription"
  ON public.subscribers FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own subscription"
  ON public.subscribers FOR UPDATE
  USING (auth.uid() = user_id);

-- Function to get user plan with expiration check
CREATE OR REPLACE FUNCTION public.get_user_plan(user_uuid uuid DEFAULT auth.uid())
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_subscription subscribers%ROWTYPE;
BEGIN
  -- Get subscription info
  SELECT * INTO user_subscription 
  FROM subscribers 
  WHERE user_id = user_uuid;
  
  -- If no subscription record, return free
  IF user_subscription IS NULL THEN
    RETURN 'free';
  END IF;
  
  -- If not subscribed, return free
  IF NOT user_subscription.subscribed THEN
    RETURN 'free';
  END IF;
  
  -- If subscribed but expired, return free
  IF user_subscription.subscription_end IS NOT NULL 
     AND user_subscription.subscription_end < now() THEN
    RETURN 'free';
  END IF;
  
  -- Otherwise return the subscription tier
  RETURN COALESCE(user_subscription.subscription_tier, 'free');
END;
$$;

-- Function to check if user can create league with member limit
CREATE OR REPLACE FUNCTION public.can_create_league(
  user_uuid uuid DEFAULT auth.uid(),
  member_count integer DEFAULT 1
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_plan text;
  max_members integer;
BEGIN
  user_plan := get_user_plan(user_uuid);
  
  -- Set limits based on plan
  IF user_plan = 'pro' THEN
    max_members := 50;
  ELSE
    max_members := 3;
  END IF;
  
  RETURN member_count <= max_members;
END;
$$;

-- Function to check if user can create game
CREATE OR REPLACE FUNCTION public.can_create_game(
  user_uuid uuid DEFAULT auth.uid(),
  league_uuid uuid DEFAULT NULL,
  game_duration_days integer DEFAULT 14
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_plan text;
  max_duration integer;
  min_duration integer;
  games_this_month integer;
  max_games_per_month integer;
BEGIN
  user_plan := get_user_plan(user_uuid);
  
  -- Set limits based on plan
  IF user_plan = 'pro' THEN
    max_duration := 30;
    min_duration := 14;
    max_games_per_month := -1; -- unlimited
  ELSE
    max_duration := 14;
    min_duration := 1;
    max_games_per_month := 1;
  END IF;
  
  -- Check duration limits
  IF game_duration_days < min_duration OR game_duration_days > max_duration THEN
    RETURN false;
  END IF;
  
  -- Check monthly game limit (only for free users)
  IF max_games_per_month > 0 THEN
    SELECT COUNT(*) INTO games_this_month
    FROM games g
    JOIN leagues l ON l.id = g.league_id
    WHERE l.admin_user_id = user_uuid
    AND g.created_at >= date_trunc('month', now());
    
    IF games_this_month >= max_games_per_month THEN
      RETURN false;
    END IF;
  END IF;
  
  RETURN true;
END;
$$;

-- Function to get user subscription info
CREATE OR REPLACE FUNCTION public.get_user_subscription(user_uuid uuid DEFAULT auth.uid())
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  subscription subscribers%ROWTYPE;
  plan text;
  is_active boolean;
BEGIN
  -- Get subscription record
  SELECT * INTO subscription
  FROM subscribers
  WHERE user_id = user_uuid;
  
  -- Get current plan
  plan := get_user_plan(user_uuid);
  
  -- Check if subscription is active
  is_active := (subscription.subscribed = true 
               AND (subscription.subscription_end IS NULL 
                   OR subscription.subscription_end > now()));
  
  -- Return subscription info
  RETURN json_build_object(
    'plan', plan,
    'subscribed', COALESCE(subscription.subscribed, false),
    'subscription_tier', COALESCE(subscription.subscription_tier, 'free'),
    'subscription_end', subscription.subscription_end,
    'stripe_customer_id', subscription.stripe_customer_id,
    'is_active', is_active,
    'email', subscription.email
  );
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.get_user_plan(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_create_league(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_create_game(uuid, uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_subscription(uuid) TO authenticated;

-- Trigger to automatically create subscriber record when user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user_subscription()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.subscribers (user_id, email, subscribed, subscription_tier)
  VALUES (NEW.id, NEW.email, false, 'free')
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- Create trigger (only if it doesn't exist)
DROP TRIGGER IF EXISTS on_auth_user_created_subscription ON auth.users;
CREATE TRIGGER on_auth_user_created_subscription
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_subscription();

SELECT 'Subscription system schema created successfully' as status;