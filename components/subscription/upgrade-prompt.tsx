"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useSubscription } from "@/contexts/subscription-context";
import { Lock, Zap, Crown, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

type UpgradePromptProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: "team" | "match";
  onUpgrade?: () => void;
  onPurchase?: () => void;
};

const tierConfig = {
  free: {
    name: "Free",
    icon: null,
    teams: 1,
    matches: "3 lifetime",
  },
  premium: {
    name: "Premium",
    icon: Zap,
    teams: 2,
    matches: "Unlimited",
    price: "$4.99/mo",
    highlight: true,
  },
  max: {
    name: "Max",
    icon: Crown,
    teams: "Unlimited",
    matches: "Unlimited",
    price: "$9.99/mo",
  },
};

export function UpgradePrompt({
  open,
  onOpenChange,
  type,
  onUpgrade,
  onPurchase,
}: UpgradePromptProps) {
  const { limits, effectiveTier } = useSubscription();

  const title = type === "team" ? "Team Limit Reached" : "Match Limit Reached";
  const description =
    type === "team"
      ? `You're on the ${effectiveTier === "free" ? "Free" : effectiveTier} plan with ${limits?.teamsUsed ?? 0}/${limits?.teamLimit ?? 1} teams. Unlock more teams to manage multiple squads!`
      : `You've used all your match credits (${limits?.matchesUsed ?? 0} matches). Get more matches to keep tracking your games!`;

  const purchaseText =
    type === "team"
      ? "Buy 1 Team Slot - $2.99"
      : "Buy 5 Matches - $1.99";

  const purchaseDescription =
    type === "team"
      ? "One-time purchase, never expires"
      : "One-time purchase, never expires";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-muted-foreground" />
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-3 my-4">
          {(["free", "premium", "max"] as const).map((tier) => {
            const config = tierConfig[tier];
            const Icon = config.icon;
            const isCurrent = effectiveTier === tier;
            const isHighlight = "highlight" in config && config.highlight;

            return (
              <div
                key={tier}
                className={cn(
                  "rounded-lg border p-4 text-center",
                  isHighlight && "border-primary bg-primary/5",
                  isCurrent && "ring-2 ring-primary"
                )}
              >
                <div className="flex items-center justify-center gap-1 mb-2">
                  {Icon && <Icon className="h-4 w-4" />}
                  <span className="font-semibold">{config.name}</span>
                  {isHighlight && (
                    <Sparkles className="h-3 w-3 text-yellow-500" />
                  )}
                </div>

                <div className="space-y-1 text-sm text-muted-foreground">
                  <p>{config.teams} team{config.teams !== 1 && config.teams !== "Unlimited" ? "s" : ""}</p>
                  <p>{config.matches} matches</p>
                </div>

                {isCurrent ? (
                  <div className="mt-3 text-xs text-muted-foreground">
                    Current plan
                  </div>
                ) : "price" in config ? (
                  <Button
                    size="sm"
                    className="mt-3 w-full"
                    variant={isHighlight ? "default" : "outline"}
                    onClick={onUpgrade}
                  >
                    {config.price}
                  </Button>
                ) : null}
              </div>
            );
          })}
        </div>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">Or</span>
          </div>
        </div>

        <div className="mt-4 p-4 rounded-lg bg-muted/50 text-center">
          <p className="text-sm font-medium mb-1">
            Just need {type === "team" ? "one more team" : "a few more matches"}?
          </p>
          <p className="text-xs text-muted-foreground mb-3">
            {purchaseDescription}
          </p>
          <Button variant="outline" onClick={onPurchase}>
            {purchaseText}
          </Button>
        </div>

        <div className="flex justify-end mt-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Maybe Later
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
