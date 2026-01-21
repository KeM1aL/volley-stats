"use client";

import { useState } from "react";
import { useSubscription } from "@/contexts/subscription-context";
import { Button } from "@/components/ui/button";
import { X, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

type TrialBannerProps = {
  className?: string;
};

export function TrialBanner({ className }: TrialBannerProps) {
  const { isOnTrial, trialDaysRemaining } = useSubscription();
  const [isDismissed, setIsDismissed] = useState(false);

  // Don't show if not on trial or dismissed
  if (!isOnTrial || isDismissed) {
    return null;
  }

  // Determine urgency level
  const urgency =
    trialDaysRemaining <= 1
      ? "urgent"
      : trialDaysRemaining <= 3
        ? "warning"
        : "normal";

  const urgencyStyles = {
    normal: "bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-950 dark:border-blue-800 dark:text-blue-200",
    warning: "bg-yellow-50 border-yellow-200 text-yellow-800 dark:bg-yellow-950 dark:border-yellow-800 dark:text-yellow-200",
    urgent: "bg-red-50 border-red-200 text-red-800 dark:bg-red-950 dark:border-red-800 dark:text-red-200",
  };

  const daysText =
    trialDaysRemaining === 0
      ? "expires today"
      : trialDaysRemaining === 1
        ? "1 day left"
        : `${trialDaysRemaining} days left`;

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 px-4 py-2 border-b text-sm",
        urgencyStyles[urgency],
        className
      )}
    >
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4" />
        <span>
          <strong>Premium Trial:</strong> {daysText}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant={urgency === "urgent" ? "destructive" : "default"}
          className="h-7 text-xs"
          asChild
        >
          <Link href="/upgrade">Subscribe Now</Link>
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 w-7 p-0"
          onClick={() => setIsDismissed(true)}
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Dismiss</span>
        </Button>
      </div>
    </div>
  );
}
