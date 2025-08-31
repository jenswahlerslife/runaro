-- Drop the dangerous policy that allows unrestricted access
DROP POLICY IF EXISTS "System can manage territory ownership" ON public.territory_ownership;

-- Create secure policies for territory ownership
-- Only allow territory creation through valid activities
CREATE POLICY "Users can claim territory through their activities" 
ON public.territory_ownership 
FOR INSERT 
WITH CHECK (
  auth.uid() = user_id AND 
  activity_id IN (
    SELECT id FROM public.activities 
    WHERE user_id = auth.uid() AND league_id = territory_ownership.league_id
  )
);

-- Users cannot update territory ownership once claimed
-- (Territory updates should only happen through new activities)
CREATE POLICY "Territory ownership cannot be modified" 
ON public.territory_ownership 
FOR UPDATE 
USING (false);

-- Users cannot manually delete territories
-- (Territories should only be lost through game mechanics)
CREATE POLICY "Territory ownership cannot be deleted manually" 
ON public.territory_ownership 
FOR DELETE 
USING (false);