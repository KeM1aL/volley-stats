"use client";

import { cn } from "@/lib/utils";

type UsageMeterProps = {
  used: number;
  limit: number;
  label?: string;
  showLabel?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
};

export function UsageMeter({
  used,
  limit,
  label,
  showLabel = true,
  size = "md",
  className,
}: UsageMeterProps) {
  const isUnlimited = limit >= 999999;
  const percentage = isUnlimited ? 0 : Math.min((used / limit) * 100, 100);
  const isAtLimit = !isUnlimited && used >= limit;
  const isNearLimit = !isUnlimited && percentage >= 80;

  const sizeClasses = {
    sm: "h-1.5",
    md: "h-2",
    lg: "h-3",
  };

  return (
    <div className={cn("space-y-1", className)}>
      {showLabel && (
        <div className="flex justify-between text-xs">
          {label && <span className="text-muted-foreground">{label}</span>}
          <span
            className={cn(
              "font-medium",
              isAtLimit && "text-destructive",
              isNearLimit && !isAtLimit && "text-yellow-600 dark:text-yellow-500"
            )}
          >
            {isUnlimited ? (
              <span className="text-muted-foreground">Unlimited</span>
            ) : (
              `${used}/${limit}`
            )}
          </span>
        </div>
      )}
      {!isUnlimited && (
        <div
          className={cn(
            "w-full bg-secondary rounded-full overflow-hidden",
            sizeClasses[size]
          )}
        >
          <div
            className={cn(
              "h-full transition-all duration-300 rounded-full",
              isAtLimit
                ? "bg-destructive"
                : isNearLimit
                  ? "bg-yellow-500"
                  : "bg-primary"
            )}
            style={{ width: `${percentage}%` }}
          />
        </div>
      )}
    </div>
  );
}

/**
 * Dot-based usage indicator (●●○ style)
 */
type UsageDotsProps = {
  used: number;
  limit: number;
  maxDots?: number;
  className?: string;
};

export function UsageDots({
  used,
  limit,
  maxDots = 5,
  className,
}: UsageDotsProps) {
  const isUnlimited = limit >= 999999;
  const remaining = limit - used;
  const dotsToShow = Math.min(limit, maxDots);

  if (isUnlimited) {
    return (
      <span className={cn("text-xs text-muted-foreground", className)}>
        Unlimited
      </span>
    );
  }

  return (
    <div className={cn("flex items-center gap-0.5", className)}>
      {Array.from({ length: dotsToShow }).map((_, i) => (
        <span
          key={i}
          className={cn(
            "text-sm",
            i < used ? "text-primary" : "text-muted-foreground/30"
          )}
        >
          ●
        </span>
      ))}
      {limit > maxDots && (
        <span className="text-xs text-muted-foreground ml-1">
          +{limit - maxDots}
        </span>
      )}
    </div>
  );
}
