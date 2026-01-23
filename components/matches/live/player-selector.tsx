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
  isLandscape?: boolean;
}

export function PlayerSelector({
  players,
  liberoPlayer,
  selectedPlayer,
  onPlayerSelect,
  className,
  isLandscape = false,
}: PlayerSelectorProps) {
  // Landscape mode: horizontal row of player buttons with avatar + name
  if (isLandscape) {
    const allPlayers = liberoPlayer ? [...players, liberoPlayer] : players;
    return (
      <div className={cn("flex gap-1.5 overflow-x-auto", className)}>
        {allPlayers
          .sort((a, b) => a.number - b.number)
          .map((player) => (
            <Button
              key={player.id}
              onClick={(e) => {
                onPlayerSelect(player);
                e.stopPropagation();
              }}
              className={cn(
                "flex items-center gap-1.5 px-2 py-1.5 rounded-lg transition-colors border h-[48px] shrink-0",
                selectedPlayer?.id === player.id
                  ? "bg-primary text-primary-foreground ring-2 ring-primary ring-offset-1"
                  : "bg-muted hover:bg-muted/80 text-primary",
                liberoPlayer?.id === player.id && "border-yellow-400 border-2"
              )}
            >
              <Avatar className="h-8 w-8">
                {player.avatar_url ? (
                  <AvatarImage src={player.avatar_url} alt={player.name} />
                ) : (
                  <AvatarFallback className="text-xs">
                    {player.name.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                )}
              </Avatar>
              <div className="text-left">
                <div className="text-xs font-medium leading-tight truncate max-w-[70px]">{player.name}</div>
                <div className="text-[10px] opacity-75">#{player.number}</div>
              </div>
            </Button>
          ))}
      </div>
    );
  }

  // Portrait mode: original grid layout
  return (
    <div className={cn("grid grid-cols-5 gap-1 sm:gap-2", className)}>
      <div className={cn("grid grid-cols-3 gap-1 sm:gap-2", liberoPlayer ? "col-span-4" : "col-span-5")}>
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
                "flex justify-start gap-1 sm:gap-2 p-1 sm:p-2 rounded-lg transition-colors border min-h-[44px] sm:min-h-[60px]",
                selectedPlayer?.id === player.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted hover:bg-muted/80  text-primary"
              )}
            >
              <Avatar className="h-6 w-6 sm:h-8 sm:w-8">
                {player.avatar_url ? (
                  <AvatarImage src={player.avatar_url} alt={player.name} />
                ) : (
                  <AvatarFallback className="text-xs sm:text-sm">
                    {player.name.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                )}
              </Avatar>
              <div className="text-left min-w-0">
                <div className="text-xs sm:text-sm font-medium truncate">{player.name}</div>
                <div className="text-[10px] sm:text-xs opacity-75">#{player.number}</div>
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
              "flex justify-center gap-1 sm:gap-2 p-1 sm:p-2 rounded-lg transition-colors h-full border",
              selectedPlayer?.id === liberoPlayer.id
                ? "bg-primary text-primary-foreground"
                : "bg-muted hover:bg-muted/80  text-primary"
            )}
          >
            <Avatar className="h-6 w-6 sm:h-8 sm:w-8">
              {liberoPlayer.avatar_url ? (
                <AvatarImage
                  src={liberoPlayer.avatar_url}
                  alt={liberoPlayer.name}
                />
              ) : (
                <AvatarFallback className="text-xs sm:text-sm">
                  {liberoPlayer.name.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              )}
            </Avatar>
            <div className="text-left min-w-0">
              <div className="text-xs sm:text-sm font-medium truncate">{liberoPlayer.name}</div>
              <div className="text-[10px] sm:text-xs opacity-75">#{liberoPlayer.number}</div>
            </div>
          </Button>

      )}
    </div>
  );
}
