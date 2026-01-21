"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { useAuth } from "./auth-context";
import { createSubscriptionApi } from "@/lib/api/subscriptions";
import {
  Subscription,
  Entitlement,
  UsageTracking,
  UserLimits,
  SubscriptionTier,
} from "@/lib/types";

interface SubscriptionContextType {
  // Data
  subscription: Subscription | null;
  usage: UsageTracking | null;
  entitlements: Entitlement[];
  limits: UserLimits | null;

  // Loading state
  isLoading: boolean;

  // Computed values
  canCreateTeam: boolean;
  canCreateMatch: boolean;
  isOnTrial: boolean;
  trialDaysRemaining: number;
  effectiveTier: SubscriptionTier;

  // Actions
  refreshLimits: () => Promise<void>;
  refreshSubscription: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(
  undefined
);

export function SubscriptionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, session } = useAuth();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [usage, setUsage] = useState<UsageTracking | null>(null);
  const [entitlements, setEntitlements] = useState<Entitlement[]>([]);
  const [limits, setLimits] = useState<UserLimits | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const subscriptionApi = createSubscriptionApi();

  // Load subscription data when user changes
  const loadSubscriptionData = useCallback(async () => {
    if (!user?.id) {
      setSubscription(null);
      setUsage(null);
      setEntitlements([]);
      setLimits(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      // Load all subscription data in parallel
      const [subscriptionData, usageData, entitlementsData, limitsData] =
        await Promise.all([
          subscriptionApi.getSubscription(user.id),
          subscriptionApi.getUsage(user.id),
          subscriptionApi.getEntitlements(user.id),
          subscriptionApi.getLimits(user.id),
        ]);

      setSubscription(subscriptionData);
      setUsage(usageData);
      setEntitlements(entitlementsData);
      setLimits(limitsData);
    } catch (error) {
      console.error("Failed to load subscription data:", error);
      // Set defaults on error
      setSubscription(null);
      setUsage(null);
      setEntitlements([]);
      setLimits(null);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadSubscriptionData();
  }, [loadSubscriptionData]);

  // Refresh just the limits (useful after creating team/match)
  const refreshLimits = useCallback(async () => {
    if (!user?.id) return;

    try {
      const [limitsData, usageData] = await Promise.all([
        subscriptionApi.getLimits(user.id),
        subscriptionApi.getUsage(user.id),
      ]);
      setLimits(limitsData);
      setUsage(usageData);
    } catch (error) {
      console.error("Failed to refresh limits:", error);
    }
  }, [user?.id]);

  // Full refresh of subscription data
  const refreshSubscription = useCallback(async () => {
    await loadSubscriptionData();
  }, [loadSubscriptionData]);

  // Computed values
  const canCreateTeam = limits?.canCreateTeam ?? true;
  const canCreateMatch = limits?.canCreateMatch ?? true;
  const isOnTrial = subscriptionApi.isOnTrial(subscription);
  const trialDaysRemaining = subscriptionApi.getTrialDaysRemaining(subscription);
  const effectiveTier = subscriptionApi.getEffectiveTier(subscription);

  return (
    <SubscriptionContext.Provider
      value={{
        subscription,
        usage,
        entitlements,
        limits,
        isLoading,
        canCreateTeam,
        canCreateMatch,
        isOnTrial,
        trialDaysRemaining,
        effectiveTier,
        refreshLimits,
        refreshSubscription,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  const context = useContext(SubscriptionContext);
  if (context === undefined) {
    throw new Error(
      "useSubscription must be used within a SubscriptionProvider"
    );
  }
  return context;
}

/**
 * Hook to check if user can create a team
 * Returns { canCreate, isLoading, limits }
 */
export function useCanCreateTeam() {
  const { canCreateTeam, isLoading, limits } = useSubscription();
  return {
    canCreate: canCreateTeam,
    isLoading,
    teamsUsed: limits?.teamsUsed ?? 0,
    teamLimit: limits?.teamLimit ?? 1,
  };
}

/**
 * Hook to check if user can create a match
 * Returns { canCreate, isLoading, limits }
 */
export function useCanCreateMatch() {
  const { canCreateMatch, isLoading, limits } = useSubscription();
  return {
    canCreate: canCreateMatch,
    isLoading,
    matchesUsed: limits?.matchesUsed ?? 0,
    matchCredits: limits?.matchCredits ?? 0,
  };
}

/**
 * Hook for trial status
 */
export function useTrialStatus() {
  const { isOnTrial, trialDaysRemaining, subscription } = useSubscription();
  return {
    isOnTrial,
    daysRemaining: trialDaysRemaining,
    trialEnd: subscription?.trial_end ?? null,
  };
}
