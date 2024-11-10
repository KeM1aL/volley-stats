import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { Tooltip } from "@/components/ui/tooltip";
import { TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface PlayerProps {
  position: number;
  x: number;
  y: number;
  team: "home" | "away";
  role: string;
  isSelected: boolean;
  onClick: () => void;
}

const roleColors = {
  "Setter": "bg-indigo-500 hover:bg-indigo-600",
  "Outside Hitter": "bg-sky-500 hover:bg-sky-600",
  "Middle Blocker": "bg-emerald-500 hover:bg-emerald-600",
  "Opposite": "bg-rose-500 hover:bg-rose-600",
  "Libero": "bg-amber-500 hover:bg-amber-600"
} as const;

export function CourtPlayer({ position, x, y, team, role, isSelected, onClick }: PlayerProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <motion.div
            className={cn(
              "absolute w-14 h-14 rounded-full flex items-center justify-center cursor-pointer shadow-lg",
              roleColors[role as keyof typeof roleColors],
              isSelected && "ring-4 ring-white ring-offset-4 ring-offset-neutral-100"
            )}
            style={{ 
              left: `${x}%`, 
              top: `${y}%`,
              transform: `translate(-50%, -50%) ${team === "away" ? "scaleX(-1)" : ""}`
            }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={onClick}
            layout
            transition={{
              layout: { type: "spring", stiffness: 300, damping: 30 },
              scale: { type: "spring", stiffness: 300, damping: 20 }
            }}
          >
            <div className="flex flex-col items-center">
              <span className={cn(
                "text-white font-bold text-lg",
                team === "away" && "transform scale-x-[-1]"
              )}>
                {position}
              </span>
              <span className={cn(
                "text-white/80 text-xs font-medium",
                team === "away" && "transform scale-x-[-1]"
              )}>
                {role.split(" ")[0]}
              </span>
            </div>
          </motion.div>
        </TooltipTrigger>
        <TooltipContent>
          <p className="font-semibold">{role}</p>
          <p className="text-sm text-muted-foreground">Position {position}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}