import { getApi } from "@/lib/api";

/**
 * Hook to access the subscription API
 * Use this when you need direct API access (e.g., in forms or mutations)
 * For reactive subscription state, use useSubscription() from subscription-context
 */
export const useSubscriptionApi = () => {
  return getApi().subscriptions;
};
