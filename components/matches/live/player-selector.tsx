"use client";

import { Player } from "@/lib/supabase/types";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface PlayerSelectorProps {
  players: Player[];
  selectedPlayer: Player | null;
  onPlayerSelect: (player: Player) => void;
  className?: string;
}

export function PlayerSelector({
  players,
  selectedPlayer,
  onPlayerSelect,
  className,
}: PlayerSelectorProps) {
  return (
    <div className={cn("grid grid-cols-3 gap-2", className)}>
      {players.map((player) => (
        <button
          key={player.id}
          onClick={() => onPlayerSelect(player)}
          className={cn(
            "flex items-center gap-2 p-2 rounded-lg transition-colors",
            selectedPlayer?.id === player.id
              ? "bg-primary text-primary-foreground"
              : "bg-muted hover:bg-muted/80"
          )}
        >
          <Avatar className="h-8 w-8">
            {player.avatar_url ? (
              <AvatarImage src={player.avatar_url} alt={player.name} />
            ) : (
              <AvatarFallback>
                {player.name.substring(0, 2).toUpperCase()}
              </AvatarFallback>
            )}
          </Avatar>
          <div className="text-left">
            <div className="text-sm font-medium">{player.name}</div>
            <div className="text-xs opacity-75">#{player.number}</div>
          </div>
        </button>
      ))}
    </div>
  );
}