import { useState } from "react";
import { Court } from "./court";
import { CourtControls } from "./court-controls";

const initialPlayers = [
  // Home team - Front row (left to right)
  { id: 1, position: 4, x: 20, y: 30, team: "home", role: "Outside Hitter" },
  { id: 2, position: 3, x: 50, y: 30, team: "home", role: "Middle Blocker" },
  { id: 3, position: 2, x: 80, y: 30, team: "home", role: "Opposite" },
  // Home team - Back row (left to right)
  { id: 4, position: 5, x: 20, y: 70, team: "home", role: "Setter" },
  { id: 5, position: 6, x: 50, y: 70, team: "home", role: "Middle Blocker" },
  { id: 6, position: 1, x: 80, y: 70, team: "home", role: "Outside Hitter" },
  // Away team - Front row (right to left)
  { id: 7, position: 4, x: 80, y: 30, team: "away", role: "Outside Hitter" },
  { id: 8, position: 3, x: 50, y: 30, team: "away", role: "Middle Blocker" },
  { id: 9, position: 2, x: 20, y: 30, team: "away", role: "Opposite" },
  // Away team - Back row (right to left)
  { id: 10, position: 5, x: 80, y: 70, team: "away", role: "Setter" },
  { id: 11, position: 6, x: 50, y: 70, team: "away", role: "Middle Blocker" },
  { id: 12, position: 1, x: 20, y: 70, team: "away", role: "Outside Hitter" },
] as const;

const positionCoordinates = {
  home: {
    1: { x: 80, y: 70 }, // Back Right
    2: { x: 80, y: 30 }, // Front Right
    3: { x: 50, y: 30 }, // Front Center
    4: { x: 20, y: 30 }, // Front Left
    5: { x: 20, y: 70 }, // Back Left
    6: { x: 50, y: 70 }, // Back Center
  },
  away: {
    1: { x: 20, y: 70 }, // Back Left (mirrored)
    2: { x: 20, y: 30 }, // Front Left (mirrored)
    3: { x: 50, y: 30 }, // Front Center (mirrored)
    4: { x: 80, y: 30 }, // Front Right (mirrored)
    5: { x: 80, y: 70 }, // Back Right (mirrored)
    6: { x: 50, y: 70 }, // Back Center (mirrored)
  },
} as const;

export function VolleyballCourt() {
  const [players, setPlayers] = useState(initialPlayers);
  const [selectedPlayer, setSelectedPlayer] = useState<number | null>(null);
  const [isFlipped, setIsFlipped] = useState(false);

  const rotateTeam = (team: "home" | "away", clockwise: boolean) => {
    setPlayers((currentPlayers) => {
      const teamPlayers = currentPlayers.filter((p) => p.team === team);
      const otherPlayers = currentPlayers.filter((p) => p.team !== team);
      
      const rotatedPlayers = teamPlayers.map((player) => {
        const newPosition = clockwise
          ? player.position === 1 ? 6 : player.position - 1
          : player.position === 6 ? 1 : player.position + 1;
        
        const newCoords = positionCoordinates[team][newPosition as keyof typeof positionCoordinates.home];
        
        return {
          ...player,
          position: newPosition,
          x: newCoords.x,
          y: newCoords.y,
        };
      });

      return [...rotatedPlayers, ...otherPlayers].sort((a, b) => a.id - b.id);
    });
  };

  const handleRotateClockwise = () => {
    rotateTeam("home", true);
    rotateTeam("away", true);
  };

  const handleRotateCounterClockwise = () => {
    rotateTeam("home", false);
    rotateTeam("away", false);
  };

  const handleFlipCourt = () => {
    setIsFlipped((prev) => !prev);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-4 p-4">
      <Court
        players={players}
        selectedPlayer={selectedPlayer}
        isFlipped={isFlipped}
        onPlayerClick={setSelectedPlayer}
      />
      <CourtControls
        onRotateClockwise={handleRotateClockwise}
        onRotateCounterClockwise={handleRotateCounterClockwise}
        onFlipCourt={handleFlipCourt}
      />
    </div>
  );
}