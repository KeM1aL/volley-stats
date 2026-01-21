"use client";

import { useSubscription } from "@/contexts/subscription-context";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { UsageMeter } from "./usage-meter";
import { Crown, Zap, ChevronDown, Sparkles, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

type SubscriptionBadgeProps = {
  showUsage?: boolean;
  className?: string;
};

export function SubscriptionBadge({
  showUsage = true,
  className,
}: SubscriptionBadgeProps) {
  const {
    effectiveTier,
    isOnTrial,
    trialDaysRemaining,
    limits,
    isLoading,
  } = useSubscription();

  if (isLoading) {
    return (
      <Badge variant="outline" className={cn("animate-pulse", className)}>
        Loading...
      </Badge>
    );
  }

  const tierConfig = {
    free: {
      label: "Free",
      variant: "outline" as const,
      icon: null,
    },
    premium: {
      label: "Premium",
      variant: "default" as const,
      icon: Zap,
    },
    max: {
      label: "Max",
      variant: "default" as const,
      icon: Crown,
    },
  };

  const config = tierConfig[effectiveTier];
  const Icon = config.icon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn("gap-1 h-8 px-2", className)}
        >
          {Icon && <Icon className="h-3.5 w-3.5" />}
          <span className="text-xs font-medium">{config.label}</span>
          {isOnTrial && (
            <Badge
              variant="secondary"
              className="ml-1 px-1 py-0 text-[10px] h-4"
            >
              Trial
            </Badge>
          )}
          <ChevronDown className="h-3 w-3 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>{config.label} Plan</span>
          {isOnTrial && (
            <Badge variant="secondary" className="text-xs">
              {trialDaysRemaining} days left
            </Badge>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {showUsage && limits && (
          <>
            <div className="px-2 py-1.5">
              <UsageMeter
                used={limits.teamsUsed}
                limit={limits.teamLimit}
                label="Teams"
                size="sm"
              />
            </div>
            <div className="px-2 py-1.5">
              <UsageMeter
                used={limits.matchesUsed}
                limit={limits.matchCredits + limits.matchesUsed}
                label="Matches"
                size="sm"
              />
            </div>
            <DropdownMenuSeparator />
          </>
        )}

        {effectiveTier === "free" && (
          <DropdownMenuItem asChild>
            <Link href="/upgrade" className="cursor-pointer">
              <Sparkles className="mr-2 h-4 w-4 text-yellow-500" />
              Upgrade Plan
            </Link>
          </DropdownMenuItem>
        )}

        <DropdownMenuItem asChild>
          <Link href="/settings/subscription" className="cursor-pointer">
            <Settings className="mr-2 h-4 w-4" />
            Manage Subscription
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
