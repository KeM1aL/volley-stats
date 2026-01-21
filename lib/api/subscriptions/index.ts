import { SupabaseClient } from "@supabase/supabase-js";
import { supabase as defaultSupabase } from "@/lib/supabase/client";
import {
  Subscription,
  Entitlement,
  UsageTracking,
  UserLimits,
  SubscriptionTier,
} from "@/lib/types";

export const createSubscriptionApi = (supabaseClient?: SupabaseClient) => {
  // Note: Type assertion needed until database types are regenerated after migration
  const client = (supabaseClient || defaultSupabase) as any;

  return {
    /**
     * Get user's subscription record
     */
    getSubscription: async (userId: string): Promise<Subscription | null> => {
      const { data, error } = await client
        .from("subscriptions")
        .select("*")
        .eq("user_id", userId)
        .single();

      if (error && error.code !== "PGRST116") {
        // PGRST116 = no rows returned
        throw error;
      }

      return data;
    },

    /**
     * Get user's usage tracking record
     */
    getUsage: async (userId: string): Promise<UsageTracking | null> => {
      const { data, error } = await client
        .from("usage_tracking")
        .select("*")
        .eq("user_id", userId)
        .single();

      if (error && error.code !== "PGRST116") {
        throw error;
      }

      return data;
    },

    /**
     * Get user's entitlements (purchased items)
     */
    getEntitlements: async (userId: string): Promise<Entitlement[]> => {
      const { data, error } = await client
        .from("entitlements")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: true });

      if (error) {
        throw error;
      }

      return data || [];
    },

    /**
     * Get user's active entitlements (not paused or exhausted)
     */
    getActiveEntitlements: async (userId: string): Promise<Entitlement[]> => {
      const { data, error } = await client
        .from("entitlements")
        .select("*")
        .eq("user_id", userId)
        .eq("status", "active")
        .order("created_at", { ascending: true });

      if (error) {
        throw error;
      }

      return data || [];
    },

    /**
     * Check if user can create a team (calls database function)
     */
    canCreateTeam: async (userId: string): Promise<boolean> => {
      const { data, error } = await client.rpc("can_create_team", {
        p_user_id: userId,
      });

      if (error) {
        console.error("Error checking team creation permission:", error);
        return false;
      }

      return data === true;
    },

    /**
     * Check if user can create a match (calls database function)
     */
    canCreateMatch: async (userId: string): Promise<boolean> => {
      const { data, error } = await client.rpc("can_create_match", {
        p_user_id: userId,
      });

      if (error) {
        console.error("Error checking match creation permission:", error);
        return false;
      }

      return data === true;
    },

    /**
     * Get user's full limits info (calls database function)
     */
    getLimits: async (userId: string): Promise<UserLimits | null> => {
      const { data, error } = await client.rpc("get_user_limits", {
        p_user_id: userId,
      });

      if (error) {
        console.error("Error getting user limits:", error);
        return null;
      }

      return data as UserLimits;
    },

    /**
     * Get user's team limit (calls database function)
     */
    getTeamLimit: async (userId: string): Promise<number> => {
      const { data, error } = await client.rpc("get_user_team_limit", {
        p_user_id: userId,
      });

      if (error) {
        console.error("Error getting team limit:", error);
        return 1; // Default to free tier
      }

      return data || 1;
    },

    /**
     * Get user's available match credits (calls database function)
     */
    getMatchCredits: async (userId: string): Promise<number> => {
      const { data, error } = await client.rpc("get_user_match_credits", {
        p_user_id: userId,
      });

      if (error) {
        console.error("Error getting match credits:", error);
        return 0;
      }

      return data || 0;
    },

    /**
     * Initialize subscription for a new user (called after signup)
     */
    initializeSubscription: async (userId: string): Promise<void> => {
      const { error } = await client.rpc("initialize_user_subscription", {
        p_user_id: userId,
      });

      if (error) {
        console.error("Error initializing subscription:", error);
        throw error;
      }
    },

    /**
     * Update subscription (used by webhook handler)
     */
    updateSubscription: async (
      userId: string,
      updates: Partial<Subscription>
    ): Promise<Subscription | null> => {
      const { data, error } = await client
        .from("subscriptions")
        .update(updates)
        .eq("user_id", userId)
        .select()
        .single();

      if (error) {
        throw error;
      }

      return data;
    },

    /**
     * Create or update subscription by Stripe customer ID
     */
    upsertSubscriptionByStripeCustomer: async (
      stripeCustomerId: string,
      updates: Partial<Subscription>
    ): Promise<Subscription | null> => {
      // First find the subscription by stripe customer ID
      const { data: existing } = await client
        .from("subscriptions")
        .select("*")
        .eq("stripe_customer_id", stripeCustomerId)
        .single();

      if (existing) {
        const { data, error } = await client
          .from("subscriptions")
          .update(updates)
          .eq("id", existing.id)
          .select()
          .single();

        if (error) throw error;
        return data;
      }

      return null;
    },

    /**
     * Create an entitlement (purchased item)
     */
    createEntitlement: async (
      entitlement: Omit<Entitlement, "id" | "created_at" | "updated_at">
    ): Promise<Entitlement> => {
      const { data, error } = await client
        .from("entitlements")
        .insert(entitlement)
        .select()
        .single();

      if (error) {
        throw error;
      }

      return data;
    },

    /**
     * Get subscription by Stripe subscription ID
     */
    getSubscriptionByStripeId: async (
      stripeSubscriptionId: string
    ): Promise<Subscription | null> => {
      const { data, error } = await client
        .from("subscriptions")
        .select("*")
        .eq("stripe_subscription_id", stripeSubscriptionId)
        .single();

      if (error && error.code !== "PGRST116") {
        throw error;
      }

      return data;
    },

    /**
     * Set Stripe customer ID for a user
     */
    setStripeCustomerId: async (
      userId: string,
      stripeCustomerId: string
    ): Promise<void> => {
      const { error } = await client
        .from("subscriptions")
        .update({ stripe_customer_id: stripeCustomerId })
        .eq("user_id", userId);

      if (error) {
        throw error;
      }
    },

    /**
     * Calculate days remaining in trial
     */
    getTrialDaysRemaining: (subscription: Subscription | null): number => {
      if (!subscription || subscription.status !== "trialing" || !subscription.trial_end) {
        return 0;
      }

      const trialEnd = new Date(subscription.trial_end);
      const now = new Date();
      const diffTime = trialEnd.getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      return Math.max(0, diffDays);
    },

    /**
     * Check if user is on trial
     */
    isOnTrial: (subscription: Subscription | null): boolean => {
      if (!subscription) return false;
      return subscription.status === "trialing";
    },

    /**
     * Get effective tier (considering trial status)
     */
    getEffectiveTier: (subscription: Subscription | null): SubscriptionTier => {
      if (!subscription) return "free";

      if (subscription.status === "trialing" || subscription.status === "active") {
        return subscription.tier;
      }

      return "free";
    },
  };
};

export type SubscriptionApi = ReturnType<typeof createSubscriptionApi>;
