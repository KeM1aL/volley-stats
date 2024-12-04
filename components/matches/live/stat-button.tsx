"use client";

import { Button } from "@/components/ui/button";
import { StatResult } from "@/lib/types";
import { cn } from "@/lib/utils";
import { LoadingSpinner } from "../../ui/loading-spinner";

interface StatButtonProps {
  result: StatResult;
  onClick: () => void;
  disabled?: boolean;
  isLoading?: boolean;
  className?: string;
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
}: StatButtonProps) {
  return (
    <Button
      onClick={(e) => {
        onClick();
        e.stopPropagation();
      }}
      disabled={disabled || isLoading}
      className={cn(
        "h-14 text-lg font-semibold transition-transform active:scale-95",
        variants[result],
        className
      )}
    >
      {isLoading ? (
        <LoadingSpinner size="sm" className="text-white" />
      ) : (
        <div>
          <div className="text-md font-medium">
            {result.charAt(0).toUpperCase() + result.slice(1)}
          </div>
          {(() => {
            switch (result) {
              case StatResult.SUCCESS:
                return <div className="text-sm opacity-75">+1</div>;
              case StatResult.ERROR:
                return <div className="text-sm opacity-75">-1</div>;
              default:
                return null;
            }
          })()}
        </div>
      )}
    </Button>
  );
}
