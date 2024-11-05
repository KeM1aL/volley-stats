"use client";

import { useState } from "react";
import { X, Check, Trophy, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatType, StatResult } from "@/lib/types";
import { Match, Set, Player } from "@/lib/supabase/types";
import { useDb } from "@/components/providers/database-provider";

interface ActionPanelProps {
  match: Match;
  set: Set;
  selectedPlayer: Player | null;
  onAction: (type: "win" | "lose" | "neutral") => Promise<void>;
  onUndo: () => Promise<void>;
  className?: string;
}

export function ActionPanel({
  match,
  set,
  selectedPlayer,
  onAction,
  onUndo,
  className,
}: ActionPanelProps) {
  const { db } = useDb();
  const [isLoading, setIsLoading] = useState(false);

  const handleAction = async (type: "win" | "lose" | "neutral") => {
    setIsLoading(true);
    try {
      await onAction(type);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUndo = async () => {
    setIsLoading(true);
    try {
      await onUndo();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className={className}>
      <div className="p-4 space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <Button
            variant="destructive"
            disabled={isLoading}
            onClick={() => handleAction("lose")}
            className="w-full"
          >
            <X className="h-4 w-4 mr-2" />
            Lose Point
          </Button>

          <Button
            variant="secondary"
            disabled={isLoading}
            onClick={() => handleAction("neutral")}
            className="w-full"
          >
            <Check className="h-4 w-4 mr-2" />
            Complete Play
          </Button>

          <Button
            variant="default"
            disabled={isLoading}
            onClick={() => handleAction("win")}
            className="w-full"
          >
            <Trophy className="h-4 w-4 mr-2" />
            Win Point
          </Button>
        </div>

        <Button
          variant="outline"
          disabled={isLoading}
          onClick={handleUndo}
          className="w-full"
        >
          <Undo2 className="h-4 w-4 mr-2" />
          Undo Last Action
        </Button>
      </div>
    </Card>
  );
}