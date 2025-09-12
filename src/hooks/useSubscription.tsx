import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface SubscriptionData {
  plan: 'free' | 'pro';
  subscribed: boolean;
  subscription_tier: 'free' | 'pro';
  subscription_end: string | null;
  stripe_customer_id: string | null;
  is_active: boolean;
  email: string | null;
}

export interface PlanLimits {
  maxMembers: number;
  maxGamesPerMonth: number;
  maxGameDuration: number;
  minGameDuration: number;
}

export const PLAN_LIMITS: Record<string, PlanLimits> = {
  free: {
    maxMembers: 3,
    maxGamesPerMonth: 1,
    maxGameDuration: 14,
    minGameDuration: 1,
  },
  pro: {
    maxMembers: 50,
    maxGamesPerMonth: -1, // unlimited
    maxGameDuration: 30,
    minGameDuration: 14,
  },
};

export const useSubscription = () => {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const checkSubscription = async () => {
    if (!user) {
      setSubscription(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data, error: rpcError } = await supabase.rpc('get_user_subscription');

      if (rpcError) {
        throw rpcError;
      }

      setSubscription(data);
    } catch (err) {
      console.error('Error checking subscription:', err);
      setError(err instanceof Error ? err.message : 'Failed to check subscription');
      // Set default free subscription on error
      setSubscription({
        plan: 'free',
        subscribed: false,
        subscription_tier: 'free',
        subscription_end: null,
        stripe_customer_id: null,
        is_active: false,
        email: user?.email || null,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkSubscription();
  }, [user]);

  // Helper functions
  const isPro = subscription?.plan === 'pro' && subscription?.is_active;
  const isFree = !isPro;
  const limits = PLAN_LIMITS[subscription?.plan || 'free'];

  const canCreateLeague = async (memberCount: number = 1) => {
    if (!user) return false;
    
    try {
      const { data, error } = await supabase.rpc('can_create_league', {
        member_count: memberCount
      });
      
      if (error) throw error;
      return data;
    } catch (err) {
      console.error('Error checking league creation limits:', err);
      return false;
    }
  };

  const canCreateGame = async (leagueId?: string, durationDays: number = 14) => {
    if (!user) return false;
    
    try {
      const { data, error } = await supabase.rpc('can_create_game', {
        league_uuid: leagueId,
        game_duration_days: durationDays
      });
      
      if (error) throw error;
      return data;
    } catch (err) {
      console.error('Error checking game creation limits:', err);
      return false;
    }
  };

  return {
    subscription,
    loading,
    error,
    checkSubscription,
    isPro,
    isFree,
    limits,
    canCreateLeague,
    canCreateGame,
  };
};