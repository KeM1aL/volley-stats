import { cn } from "@/lib/utils";

interface CourtLinesProps {
  isFlipped: boolean;
}

export function CourtLines({ isFlipped }: CourtLinesProps) {
  return (
    <div className={cn("absolute inset-0", isFlipped && "scale-x-[-1]")}>
      {/* Main court outline */}
      <div className="absolute inset-2 border-[6px] border-neutral-800" />

      {/* Center line */}
      <div className="absolute top-2 bottom-2 left-1/2 w-1.5 bg-neutral-800" />

      {/* Attack lines (3-meter) - Adjusted to be parallel with net */}
      <div className="absolute left-[25%] right-2 top-2 bottom-2 border-l-[3px] border-neutral-600 border-dashed opacity-70" />
      <div className="absolute right-[25%] left-2 top-2 bottom-2 border-r-[3px] border-neutral-600 border-dashed opacity-70" />

      {/* Position markers */}
      <div className="absolute inset-2 grid grid-cols-6 grid-rows-2">
        {Array.from({ length: 12 }).map((_, i) => {
          const col = i % 6;
          const row = Math.floor(i / 6);
          return (
            <div
              key={i}
              className="relative"
            >
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full border-2 border-neutral-400 opacity-30" />
              <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-neutral-500 font-medium text-sm">
                P{(i % 6) + 1}
              </span>
            </div>
          );
        })}
      </div>

      {/* Net */}
      <div className="absolute left-1/2 top-[5%] bottom-[5%] -translate-x-1/2">
        <div className="relative w-2 h-full bg-neutral-900">
          {/* Net texture */}
          <div className="absolute inset-0 opacity-60" style={{
            backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 4px, #fff 4px, #fff 8px)',
            backgroundSize: '8px 8px'
          }} />
          {/* Net posts */}
          <div className="absolute -left-3 -top-6 w-8 h-8 rounded-full bg-red-600" />
          <div className="absolute -left-3 -bottom-6 w-8 h-8 rounded-full bg-red-600" />
        </div>
      </div>
    </div>
  );
}