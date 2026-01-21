"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useSubscription } from "@/contexts/subscription-context";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { UsageMeter } from "@/components/subscription/usage-meter";
import {
  Zap,
  Crown,
  CreditCard,
  ExternalLink,
  CheckCircle,
  AlertTriangle,
  Clock,
} from "lucide-react";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

export default function SubscriptionSettingsPage() {
  const searchParams = useSearchParams();
  const {
    subscription,
    limits,
    entitlements,
    effectiveTier,
    isOnTrial,
    trialDaysRemaining,
    isLoading,
    refreshSubscription,
  } = useSubscription();
  const [isPortalLoading, setIsPortalLoading] = useState(false);
  const { toast } = useToast();

  const showSuccess = searchParams.get("success") === "true";
  const showPurchaseSuccess = searchParams.get("purchase") === "success";

  const handleManageBilling = async () => {
    setIsPortalLoading(true);
    try {
      const response = await fetch("/api/customer-portal", {
        method: "POST",
      });

      const data = await response.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error(data.error || "Failed to open billing portal");
      }
    } catch (error) {
      console.error("Portal error:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to open billing portal. Please try again.",
      });
    } finally {
      setIsPortalLoading(false);
    }
  };

  const tierConfig = {
    free: {
      name: "Free",
      icon: null,
      color: "text-muted-foreground",
    },
    premium: {
      name: "Premium",
      icon: Zap,
      color: "text-blue-500",
    },
    max: {
      name: "Max",
      icon: Crown,
      color: "text-yellow-500",
    },
  };

  const config = tierConfig[effectiveTier];
  const Icon = config.icon;

  const hasActiveSubscription =
    subscription?.stripe_subscription_id && subscription.status === "active";

  // Count active entitlements
  const activeTeamSlots = entitlements
    .filter((e) => e.type === "team_slot" && e.status === "active")
    .reduce((sum, e) => sum + (e.quantity - e.quantity_used), 0);

  const activeMatchCredits = entitlements
    .filter((e) => e.type === "match_pack" && e.status === "active")
    .reduce((sum, e) => sum + (e.quantity - e.quantity_used), 0);

  const pausedEntitlements = entitlements.filter((e) => e.status === "paused");

  if (isLoading) {
    return (
      <div className="container max-w-2xl py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-muted rounded" />
          <div className="h-32 bg-muted rounded" />
          <div className="h-32 bg-muted rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-2xl py-8">
      <h1 className="text-2xl font-bold mb-6">Subscription</h1>

      {showSuccess && (
        <div className="mb-6 p-4 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg flex items-center gap-3">
          <CheckCircle className="h-5 w-5 text-green-600" />
          <div>
            <p className="font-medium text-green-800 dark:text-green-200">
              Subscription activated!
            </p>
            <p className="text-sm text-green-700 dark:text-green-300">
              Thank you for subscribing. Your new plan is now active.
            </p>
          </div>
        </div>
      )}

      {showPurchaseSuccess && (
        <div className="mb-6 p-4 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg flex items-center gap-3">
          <CheckCircle className="h-5 w-5 text-green-600" />
          <div>
            <p className="font-medium text-green-800 dark:text-green-200">
              Purchase successful!
            </p>
            <p className="text-sm text-green-700 dark:text-green-300">
              Your credits have been added to your account.
            </p>
          </div>
        </div>
      )}

      {/* Current Plan */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {Icon && <Icon className={`h-5 w-5 ${config.color}`} />}
              <CardTitle>{config.name} Plan</CardTitle>
              {isOnTrial && (
                <Badge variant="secondary">
                  <Clock className="mr-1 h-3 w-3" />
                  Trial: {trialDaysRemaining} days left
                </Badge>
              )}
            </div>
            {subscription?.status === "past_due" && (
              <Badge variant="destructive">
                <AlertTriangle className="mr-1 h-3 w-3" />
                Payment Issue
              </Badge>
            )}
          </div>
          <CardDescription>
            {isOnTrial
              ? "You're currently on a free trial of Premium features."
              : hasActiveSubscription
                ? `Your subscription renews on ${subscription.current_period_end ? format(new Date(subscription.current_period_end), "MMMM d, yyyy") : "N/A"}`
                : "You're on the free plan."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {limits && (
            <>
              <UsageMeter
                used={limits.teamsUsed}
                limit={limits.teamLimit}
                label="Teams"
              />
              <UsageMeter
                used={limits.matchesUsed}
                limit={
                  limits.matchCredits >= 999999
                    ? 999999
                    : limits.matchesUsed + limits.matchCredits
                }
                label="Matches"
              />
            </>
          )}
        </CardContent>
        <CardFooter className="flex gap-3">
          {effectiveTier === "free" && !isOnTrial && (
            <Button asChild>
              <Link href="/upgrade">
                <Zap className="mr-2 h-4 w-4" />
                Upgrade Plan
              </Link>
            </Button>
          )}
          {isOnTrial && (
            <Button asChild>
              <Link href="/upgrade">Subscribe Now</Link>
            </Button>
          )}
          {hasActiveSubscription && (
            <Button
              variant="outline"
              onClick={handleManageBilling}
              disabled={isPortalLoading}
            >
              <CreditCard className="mr-2 h-4 w-4" />
              {isPortalLoading ? "Loading..." : "Manage Billing"}
              <ExternalLink className="ml-2 h-3 w-3" />
            </Button>
          )}
        </CardFooter>
      </Card>

      {/* Purchased Credits */}
      {(activeTeamSlots > 0 || activeMatchCredits > 0 || pausedEntitlements.length > 0) && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Purchased Credits</CardTitle>
            <CardDescription>
              One-time purchases that never expire
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {activeTeamSlots > 0 && (
              <div className="flex justify-between items-center">
                <span className="text-sm">Team Slots</span>
                <Badge variant="secondary">{activeTeamSlots} available</Badge>
              </div>
            )}
            {activeMatchCredits > 0 && (
              <div className="flex justify-between items-center">
                <span className="text-sm">Match Credits</span>
                <Badge variant="secondary">{activeMatchCredits} available</Badge>
              </div>
            )}
            {pausedEntitlements.length > 0 && (
              <>
                <Separator />
                <div className="text-sm text-muted-foreground">
                  <p className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    {pausedEntitlements.length} credit(s) paused while on{" "}
                    {effectiveTier} plan
                  </p>
                  <p className="mt-1 text-xs">
                    These will become available again if you downgrade.
                  </p>
                </div>
              </>
            )}
          </CardContent>
          <CardFooter>
            <Button variant="outline" asChild>
              <Link href="/upgrade">Buy More Credits</Link>
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Need More?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button variant="outline" className="w-full justify-start" asChild>
            <Link href="/upgrade?tab=one-time">
              Buy additional team slots or match packs
            </Link>
          </Button>
          <Button variant="outline" className="w-full justify-start" asChild>
            <Link href="/upgrade">View all plans and pricing</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
