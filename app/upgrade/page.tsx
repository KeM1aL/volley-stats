"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSubscription } from "@/contexts/subscription-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Check, Zap, Crown, Sparkles, Package, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";

const plans = {
  monthly: [
    {
      name: "Free",
      price: "$0",
      description: "For trying things out",
      features: ["1 team", "3 matches (lifetime)", "Basic stats tracking"],
      tier: "free" as const,
      priceId: null,
    },
    {
      name: "Premium",
      price: "$4.99",
      description: "For casual coaches",
      features: [
        "2 teams",
        "Unlimited matches",
        "Full stats tracking",
        "Priority support",
      ],
      tier: "premium" as const,
      priceId: "premium-monthly",
      popular: true,
    },
    {
      name: "Max",
      price: "$9.99",
      description: "For clubs & organizations",
      features: [
        "Unlimited teams",
        "Unlimited matches",
        "Full stats tracking",
        "Priority support",
        "Export to PDF/Excel",
      ],
      tier: "max" as const,
      priceId: "max-monthly",
    },
  ],
  annual: [
    {
      name: "Free",
      price: "$0",
      description: "For trying things out",
      features: ["1 team", "3 matches (lifetime)", "Basic stats tracking"],
      tier: "free" as const,
      priceId: null,
    },
    {
      name: "Premium",
      price: "$49.99",
      originalPrice: "$59.88",
      description: "For casual coaches",
      features: [
        "2 teams",
        "Unlimited matches",
        "Full stats tracking",
        "Priority support",
      ],
      tier: "premium" as const,
      priceId: "premium-annual",
      popular: true,
      savings: "Save 17%",
    },
    {
      name: "Max",
      price: "$99.99",
      originalPrice: "$119.88",
      description: "For clubs & organizations",
      features: [
        "Unlimited teams",
        "Unlimited matches",
        "Full stats tracking",
        "Priority support",
        "Export to PDF/Excel",
      ],
      tier: "max" as const,
      priceId: "max-annual",
      savings: "Save 17%",
    },
  ],
};

const oneTimePurchases = [
  {
    name: "Team Slot",
    price: "$2.99",
    description: "Add 1 additional team slot",
    productKey: "team-slot",
    icon: "team",
  },
  {
    name: "Match Pack (3)",
    price: "$1.49",
    description: "3 additional matches",
    productKey: "match-pack-3",
    icon: "match",
  },
  {
    name: "Match Pack (5)",
    price: "$1.99",
    description: "5 additional matches",
    productKey: "match-pack-5",
    icon: "match",
    popular: true,
  },
  {
    name: "Match Pack (10)",
    price: "$2.99",
    description: "10 additional matches",
    productKey: "match-pack-10",
    icon: "match",
  },
];

const bundles = [
  {
    name: "Starter Pack",
    price: "$3.99",
    originalPrice: "$4.98",
    description: "1 team slot + 5 matches",
    productKey: "starter-pack",
    savings: "Save 15%",
  },
  {
    name: "Season Pack",
    price: "$7.99",
    originalPrice: "$8.97",
    description: "2 team slots + 10 matches",
    productKey: "season-pack",
    savings: "Save 20%",
    popular: true,
  },
];

export default function UpgradePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { effectiveTier, isOnTrial, trialDaysRemaining } = useSubscription();
  const [isLoading, setIsLoading] = useState<string | null>(null);
  const [billingInterval, setBillingInterval] = useState<"monthly" | "annual">("monthly");
  const { toast } = useToast();

  const wasCanceled = searchParams.get("canceled") === "true";

  const handleSubscriptionCheckout = async (priceId: string) => {
    setIsLoading(priceId);
    try {
      const response = await fetch("/api/checkout/subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productKey: priceId }),
      });

      const data = await response.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error(data.error || "Failed to create checkout session");
      }
    } catch (error) {
      console.error("Checkout error:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to start checkout. Please try again.",
      });
    } finally {
      setIsLoading(null);
    }
  };

  const handleOneTimeCheckout = async (productKey: string) => {
    setIsLoading(productKey);
    try {
      const response = await fetch("/api/checkout/one-time", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productKey }),
      });

      const data = await response.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error(data.error || "Failed to create checkout session");
      }
    } catch (error) {
      console.error("Checkout error:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to start checkout. Please try again.",
      });
    } finally {
      setIsLoading(null);
    }
  };

  return (
    <div className="container max-w-6xl py-8">
      <div className="mb-8">
        <Button variant="ghost" size="sm" asChild className="mb-4">
          <Link href="/">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Link>
        </Button>

        <h1 className="text-3xl font-bold">Choose Your Plan</h1>
        <p className="text-muted-foreground mt-2">
          {isOnTrial
            ? `Your trial ends in ${trialDaysRemaining} days. Subscribe now to keep your premium features.`
            : "Unlock more teams and matches to track your volleyball journey."}
        </p>

        {wasCanceled && (
          <div className="mt-4 p-4 bg-muted rounded-lg">
            <p className="text-sm">Checkout was canceled. Feel free to try again when you&apos;re ready.</p>
          </div>
        )}
      </div>

      {/* Subscription Plans */}
      <div className="mb-12">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold">Subscription Plans</h2>
          <Tabs value={billingInterval} onValueChange={(v) => setBillingInterval(v as any)}>
            <TabsList>
              <TabsTrigger value="monthly">Monthly</TabsTrigger>
              <TabsTrigger value="annual">Annual</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {plans[billingInterval].map((plan) => {
            const isCurrent = plan.tier === effectiveTier && !isOnTrial;
            const Icon = plan.tier === "max" ? Crown : plan.tier === "premium" ? Zap : null;

            return (
              <Card
                key={plan.name}
                className={cn(
                  "relative",
                  plan.popular && "border-primary shadow-lg"
                )}
              >
                {plan.popular && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Sparkles className="mr-1 h-3 w-3" />
                    Most Popular
                  </Badge>
                )}
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {Icon && <Icon className="h-5 w-5" />}
                    {plan.name}
                  </CardTitle>
                  <CardDescription>{plan.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="mb-4">
                    <span className="text-3xl font-bold">{plan.price}</span>
                    {plan.priceId && (
                      <span className="text-muted-foreground">
                        /{billingInterval === "monthly" ? "mo" : "yr"}
                      </span>
                    )}
                    {"originalPrice" in plan && plan.originalPrice && (
                      <span className="ml-2 text-sm text-muted-foreground line-through">
                        {plan.originalPrice}
                      </span>
                    )}
                  </div>
                  {"savings" in plan && plan.savings && (
                    <Badge variant="secondary" className="mb-4">
                      {plan.savings}
                    </Badge>
                  )}
                  <ul className="space-y-2">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-center gap-2 text-sm">
                        <Check className="h-4 w-4 text-green-500" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter>
                  {isCurrent ? (
                    <Button className="w-full" variant="outline" disabled>
                      Current Plan
                    </Button>
                  ) : plan.priceId ? (
                    <Button
                      className="w-full"
                      variant={plan.popular ? "default" : "outline"}
                      onClick={() => handleSubscriptionCheckout(plan.priceId!)}
                      disabled={isLoading !== null}
                    >
                      {isLoading === plan.priceId ? "Loading..." : "Subscribe"}
                    </Button>
                  ) : (
                    <Button className="w-full" variant="outline" disabled>
                      {effectiveTier === "free" ? "Current Plan" : "Downgrade"}
                    </Button>
                  )}
                </CardFooter>
              </Card>
            );
          })}
        </div>
      </div>

      {/* One-time Purchases */}
      <div className="mb-12">
        <h2 className="text-xl font-semibold mb-6">One-time Purchases</h2>
        <p className="text-muted-foreground mb-4">
          Need just a bit more? These purchases never expire.
        </p>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {oneTimePurchases.map((item) => (
            <Card key={item.productKey} className={cn(item.popular && "border-primary")}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{item.name}</CardTitle>
                <CardDescription className="text-xs">{item.description}</CardDescription>
              </CardHeader>
              <CardContent className="pb-2">
                <span className="text-2xl font-bold">{item.price}</span>
              </CardContent>
              <CardFooter>
                <Button
                  className="w-full"
                  variant={item.popular ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleOneTimeCheckout(item.productKey)}
                  disabled={isLoading !== null}
                >
                  {isLoading === item.productKey ? "Loading..." : "Buy"}
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>

      {/* Bundles */}
      <div>
        <h2 className="text-xl font-semibold mb-6">
          <Package className="inline-block mr-2 h-5 w-5" />
          Bundle Deals
        </h2>
        <p className="text-muted-foreground mb-4">
          Get more value with our bundle packages.
        </p>

        <div className="grid sm:grid-cols-2 gap-4">
          {bundles.map((bundle) => (
            <Card key={bundle.productKey} className={cn(bundle.popular && "border-primary")}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{bundle.name}</CardTitle>
                  {bundle.savings && (
                    <Badge variant="secondary">{bundle.savings}</Badge>
                  )}
                </div>
                <CardDescription>{bundle.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <span className="text-2xl font-bold">{bundle.price}</span>
                <span className="ml-2 text-sm text-muted-foreground line-through">
                  {bundle.originalPrice}
                </span>
              </CardContent>
              <CardFooter>
                <Button
                  className="w-full"
                  variant={bundle.popular ? "default" : "outline"}
                  onClick={() => handleOneTimeCheckout(bundle.productKey)}
                  disabled={isLoading !== null}
                >
                  {isLoading === bundle.productKey ? "Loading..." : "Buy Bundle"}
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
