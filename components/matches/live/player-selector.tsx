"use client";

import { TeamMember } from "@/lib/types";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface PlayerSelectorProps {
  players: TeamMember[];
  liberoPlayer?: TeamMember | null;
  selectedPlayer: TeamMember | null;
  onPlayerSelect: (player: TeamMember) => void;
  className?: string;
}

export function PlayerSelector({
  players,
  liberoPlayer,
  selectedPlayer,
  onPlayerSelect,
  className,
}: PlayerSelectorProps) {
  return (
    <div className={cn("grid grid-cols-5 gap-2", className)}>
      <div className={cn("grid grid-cols-3 gap-2", liberoPlayer ? "col-span-4" : "col-span-5")}>
        {players
          .sort((a, b) => a.number - b.number)
          .map((player) => (
            <Button
              key={player.id}
              onClick={(e) => {
                onPlayerSelect(player);
                e.stopPropagation();
              }}
              className={cn(
                "flex justify-start gap-2 p-2 rounded-lg transition-colors border",
                selectedPlayer?.id === player.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted hover:bg-muted/80  text-primary"
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
            </Button>
          ))}
      </div>
      {liberoPlayer && (
          <Button
            onClick={(e) => {
              onPlayerSelect(liberoPlayer);
              e.stopPropagation();
            }}
            className={cn(
              "flex justify-center gap-2 p-2 rounded-lg transition-colors h-full border",
              selectedPlayer?.id === liberoPlayer.id
                ? "bg-primary text-primary-foreground"
                : "bg-muted hover:bg-muted/80  text-primary"
            )}
          >
            <Avatar className="h-8 w-8">
              {liberoPlayer.avatar_url ? (
                <AvatarImage
                  src={liberoPlayer.avatar_url}
                  alt={liberoPlayer.name}
                />
              ) : (
                <AvatarFallback>
                  {liberoPlayer.name.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              )}
            </Avatar>
            <div className="text-left">
              <div className="text-sm font-medium">{liberoPlayer.name}</div>
              <div className="text-xs opacity-75">#{liberoPlayer.number}</div>
            </div>
          </Button>
        
      )}
    </div>
  );
}
