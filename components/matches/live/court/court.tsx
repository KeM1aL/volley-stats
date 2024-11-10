import { motion } from "framer-motion";
import { CourtPlayer } from "./court-player";
import { CourtLines } from "./court-lines";

interface CourtProps {
  players: Array<{
    id: number;
    position: number;
    x: number;
    y: number;
    team: "home" | "away";
    role: string;
  }>;
  selectedPlayer: number | null;
  isFlipped: boolean;
  onPlayerClick: (id: number) => void;
}

export function Court({ players, selectedPlayer, isFlipped, onPlayerClick }: CourtProps) {
  return (
    <motion.div
      className="relative w-full aspect-[2/1] rounded-xl overflow-hidden bg-neutral-100 shadow-xl"
      animate={{ rotateY: isFlipped ? 180 : 0 }}
      transition={{ type: "spring", stiffness: 100, damping: 20 }}
    >
      {/* Court surface with subtle texture */}
      <div 
        className="absolute inset-0 bg-neutral-50"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, neutral-200 1px, transparent 0)`,
          backgroundSize: '24px 24px'
        }}
      />

      {/* Court lines */}
      <CourtLines isFlipped={isFlipped} />

      {/* Players */}
      <motion.div layout>
        {players.map((player) => (
          <CourtPlayer
            key={player.id}
            position={player.position}
            x={player.x}
            y={player.y}
            team={player.team}
            role={player.role}
            isSelected={selectedPlayer === player.id}
            onClick={() => onPlayerClick(player.id)}
          />
        ))}
      </motion.div>
    </motion.div>
  );
}