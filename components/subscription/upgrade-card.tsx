"use client";

import { useSubscription } from "@/contexts/subscription-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Rocket, Lightbulb, Zap } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

type UpgradeCardProps = {
  type: "team" | "match";
  className?: string;
};

export function UpgradeCard({ type, className }: UpgradeCardProps) {
  const { limits, effectiveTier } = useSubscription();

  // Don't show for premium/max users with active subscriptions
  if (effectiveTier !== "free") {
    return null;
  }

  // Calculate if we should show the card
  const teamsUsed = limits?.teamsUsed ?? 0;
  const teamLimit = limits?.teamLimit ?? 1;
  const matchesUsed = limits?.matchesUsed ?? 0;
  const matchCredits = limits?.matchCredits ?? 0;

  const isAtTeamLimit = teamsUsed >= teamLimit;
  const isNearTeamLimit = teamsUsed / teamLimit >= 0.8;
  const isLowOnMatches = matchCredits <= 1;
  const isOutOfMatches = matchCredits === 0;

  // Determine if card should be shown
  const shouldShowTeamCard = type === "team" && (isAtTeamLimit || isNearTeamLimit);
  const shouldShowMatchCard = type === "match" && (isOutOfMatches || isLowOnMatches);

  if (!shouldShowTeamCard && !shouldShowMatchCard) {
    return null;
  }

  const config = {
    team: {
      icon: Rocket,
      title: isAtTeamLimit ? "Team limit reached" : "Need more teams?",
      description: isAtTeamLimit
        ? "Upgrade to Premium for 2 teams, or Max for unlimited teams."
        : "You're almost at your team limit. Upgrade for more teams.",
      primaryAction: "View Plans",
      secondaryAction: "Buy Team Slot - $2.99",
      primaryHref: "/upgrade",
      secondaryHref: "/upgrade?product=team-slot",
    },
    match: {
      icon: Lightbulb,
      title: isOutOfMatches ? "Out of matches" : "Running low on matches?",
      description: isOutOfMatches
        ? "Get unlimited matches with Premium, or buy a match pack."
        : `Only ${matchCredits} match${matchCredits !== 1 ? "es" : ""} remaining. Stock up to keep tracking.`,
      primaryAction: "Upgrade",
      secondaryAction: "Buy 5 Matches - $1.99",
      primaryHref: "/upgrade",
      secondaryHref: "/upgrade?product=match-pack-5",
    },
  };

  const cardConfig = config[type];
  const Icon = cardConfig.icon;

  return (
    <Card
      className={cn(
        "border-dashed bg-muted/30",
        isAtTeamLimit || isOutOfMatches
          ? "border-destructive/50"
          : "border-yellow-500/50",
        className
      )}
    >
      <CardContent className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4">
        <div
          className={cn(
            "p-2 rounded-full",
            isAtTeamLimit || isOutOfMatches
              ? "bg-destructive/10 text-destructive"
              : "bg-yellow-500/10 text-yellow-600 dark:text-yellow-500"
          )}
        >
          <Icon className="h-5 w-5" />
        </div>

        <div className="flex-1 space-y-1">
          <p className="font-medium text-sm">{cardConfig.title}</p>
          <p className="text-xs text-muted-foreground">
            {cardConfig.description}
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button size="sm" asChild>
            <Link href={cardConfig.primaryHref}>
              <Zap className="h-3.5 w-3.5 mr-1" />
              {cardConfig.primaryAction}
            </Link>
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link href={cardConfig.secondaryHref}>
              {cardConfig.secondaryAction}
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
