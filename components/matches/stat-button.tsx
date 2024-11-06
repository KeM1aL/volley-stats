"use client";

import { Button } from "@/components/ui/button";
import { StatResult } from "@/lib/types";
import { cn } from "@/lib/utils";

interface StatButtonProps {
  result: StatResult;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}

export function StatButton({
  result,
  onClick,
  disabled,
  className,
}: StatButtonProps) {
  const variants = {
    [StatResult.SUCCESS]: "bg-green-500 hover:bg-green-600 text-white",
    [StatResult.ERROR]: "bg-red-500 hover:bg-red-600 text-white",
    [StatResult.ATTEMPT]: "bg-yellow-500 hover:bg-yellow-600 text-white",
  };

  return (
    <Button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "h-16 text-lg font-semibold transition-transform active:scale-95",
        variants[result],
        className
      )}
    >
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
                return;
            }
          })()}
      </div>
    </Button>
  );
}
