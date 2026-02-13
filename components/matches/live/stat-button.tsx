"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { StatResult } from "@/lib/enums";
import { cn } from "@/lib/utils";
import { LoadingSpinner } from "../../ui/loading-spinner";

interface StatButtonProps {
  result: StatResult;
  onClick: () => void;
  disabled?: boolean;
  isLoading?: boolean;
  className?: string;
  isLandscape?: boolean;
}

export const variants = {
  [StatResult.SUCCESS]: "bg-green-500 hover:bg-green-600 text-white",
  [StatResult.ERROR]: "bg-red-500 hover:bg-red-600 text-white",
  [StatResult.BAD]: "bg-yellow-500 hover:bg-yellow-600 text-white",
  [StatResult.GOOD]: "bg-blue-500 hover:bg-blue-600 text-white",
};

export function StatButton({
  result,
  onClick,
  disabled,
  isLoading,
  className,
  isLandscape = false,
}: StatButtonProps) {
  const t = useTranslations("matches");
  const resultLabel: Record<StatResult, string> = {
    [StatResult.SUCCESS]: t("stats.statResults.success"),
    [StatResult.ERROR]: t("stats.statResults.error"),
    [StatResult.GOOD]: t("stats.statResults.good"),
    [StatResult.BAD]: t("stats.statResults.bad"),
  };

  // Landscape compact mode
  if (isLandscape) {
    return (
      <Button
        onClick={(e) => {
          onClick();
          e.stopPropagation();
        }}
        disabled={disabled || isLoading}
        className={cn(
          "h-8 text-xs font-semibold transition-transform active:scale-95 px-2",
          variants[result],
          className
        )}
      >
        {isLoading ? (
          <LoadingSpinner size="sm" className="text-white" />
        ) : (
          <span>
            {resultLabel[result]}
            {result === StatResult.SUCCESS && " +1"}
            {result === StatResult.ERROR && " -1"}
          </span>
        )}
      </Button>
    );
  }

  // Portrait mode
  return (
    <Button
      onClick={(e) => {
        onClick();
        e.stopPropagation();
      }}
      disabled={disabled || isLoading}
      className={cn(
        "h-12 sm:h-14 text-sm sm:text-base md:text-md font-semibold transition-transform active:scale-95",
        variants[result],
        className
      )}
    >
      {isLoading ? (
        <LoadingSpinner size="sm" className="text-white" />
      ) : (
        <div>
          <div className="text-xs sm:text-sm md:text-md font-medium">
            {resultLabel[result]}
          </div>
          {(() => {
            switch (result) {
              case StatResult.SUCCESS:
                return <div className="text-[10px] sm:text-xs md:text-sm opacity-75">+1</div>;
              case StatResult.ERROR:
                return <div className="text-[10px] sm:text-xs md:text-sm opacity-75">-1</div>;
              default:
                return null;
            }
          })()}
        </div>
      )}
    </Button>
  );
}
