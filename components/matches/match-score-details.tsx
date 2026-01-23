"use client";

import { Match, Set, Team } from "@/lib/types";
import { useLandscape } from "@/hooks/use-landscape";

type LiveMatchHeaderProps = {
  match: Match;
  sets: Set[];
  homeTeam: Team;
  awayTeam: Team;
  isPdfGenerating?: boolean; // Added for PDF generation context
};

export function MatchScoreDetails({
  match,
  sets,
  homeTeam,
  awayTeam,
}: LiveMatchHeaderProps) {
  const isLandscape = useLandscape();
  const maxSets = match.match_formats
    ? match.match_formats.sets_to_win * 2 - 1
    : 5;

  const currentSet = sets[sets.length - 1];

  // Landscape mode: Compact but readable grid layout
  if (isLandscape) {
    return (
      <div className="text-primary">
        {/* Team 1 Row */}
        <div className="grid grid-cols-8 gap-0.5">
          <div className="col-span-2 bg-primary/10 px-1 rounded flex items-center justify-center text-xs font-bold truncate">
            {homeTeam.name}
          </div>
          {sets.map((set, index) => (
            <div
              key={`home-${index}`}
              className="col-span-1 bg-primary/10 rounded flex items-center justify-center text-sm font-bold"
            >
              {set.home_score}
            </div>
          ))}
          {sets.length < 5 &&
            new Array(maxSets - sets.length).fill(0).map((_, index) => (
              <div
                key={`home-filler-${index}`}
                className="col-span-1 bg-primary/10 rounded flex items-center justify-center text-sm font-bold"
              >
                -
              </div>
            ))}
          <div className="col-span-1 bg-secondary rounded flex items-center justify-center text-sm font-bold text-secondary-foreground">
            {match.home_score}
          </div>
        </div>

        {/* Team 2 Row */}
        <div className="grid grid-cols-8 gap-0.5 mt-0.5">
          <div className="col-span-2 bg-primary/10 px-1 rounded flex items-center justify-center text-xs font-bold truncate">
            {awayTeam.name}
          </div>
          {sets.map((set, index) => (
            <div
              key={`away-${index}`}
              className="col-span-1 bg-primary/10 rounded flex items-center justify-center text-sm font-bold"
            >
              {set.away_score}
            </div>
          ))}
          {sets.length < 5 &&
            new Array(maxSets - sets.length).fill(0).map((_, index) => (
              <div
                key={`away-filler-${index}`}
                className="col-span-1 bg-primary/10 rounded flex items-center justify-center text-sm font-bold"
              >
                -
              </div>
            ))}
          <div className="col-span-1 bg-secondary rounded flex items-center justify-center text-sm font-bold text-secondary-foreground">
            {match.away_score}
          </div>
        </div>
      </div>
    );
  }

  // Portrait mode: Full grid layout
  return (
    <>
      <div className="text-primary">
        <div className="grid grid-cols-8 gap-1 sm:gap-4">
          {/* Team 1 Row */}
          <div className="col-span-2 bg-primary/10 p-1 sm:p-2 rounded-lg flex items-center justify-center text-sm sm:text-xl font-bold truncate">
            {homeTeam.name}
          </div>
          {sets.map((set, index) => (
            <div
              key={`home-${index}`}
              className="col-span-1 bg-primary/10 rounded-lg flex items-center justify-center text-base sm:text-xl font-bold p-1 sm:p-2"
            >
              {set.home_score}
            </div>
          ))}
          {sets.length < 5 &&
            new Array(maxSets - sets.length).fill(0).map((_, index) => (
              <div
                key={`home-filler-${index}`}
                className="col-span-1 bg-primary/10 rounded-lg flex items-center justify-center text-base sm:text-xl font-bold p-1 sm:p-2"
              >
                -
              </div>
            ))}
          <div className="col-span-1 bg-secondary rounded-lg flex items-center justify-center text-base sm:text-xl font-bold text-secondary-foreground p-1 sm:p-2">
            {match.home_score}
          </div>
        </div>

        {/* Set Labels */}
        <div className="grid grid-cols-8 gap-1 sm:gap-4">
          <div className="col-span-2 text-center text-[10px] sm:text-xs text-primary/70">
            VS
          </div>
          {new Array(maxSets).fill(0).map((_, index) => (
              <div key={`set-label-${index}`} className="col-span-1 text-center text-[10px] sm:text-xs text-primary/70">
                SET {index + 1}
              </div>
          ))}
          <div className="col-span-1 text-center text-[10px] sm:text-xs text-primary/70 font-bold">
            FINAL
          </div>
        </div>

        {/* Team 2 Row */}
        <div className="grid grid-cols-8 gap-1 sm:gap-4">
          <div className="col-span-2 bg-primary/10 p-1 sm:p-2 rounded-lg flex items-center justify-center text-sm sm:text-xl font-bold truncate">
            {awayTeam.name}
          </div>
          {sets.map((set, index) => (
            <div
              key={`away-${index}`}
              className="col-span-1 bg-primary/10 rounded-lg flex items-center justify-center text-base sm:text-xl font-bold p-1 sm:p-2"
            >
              {set.away_score}
            </div>
          ))}
          {sets.length < 5 &&
            new Array(maxSets - sets.length).fill(0).map((_, index) => (
              <div
                key={`away-filler-${index}`}
                className="col-span-1 bg-primary/10 rounded-lg flex items-center justify-center text-base sm:text-xl font-bold p-1 sm:p-2"
              >
                -
              </div>
            ))}
          <div className="col-span-1 bg-secondary rounded-lg flex items-center justify-center text-base sm:text-xl font-bold text-secondary-foreground p-1 sm:p-2">
            {match.away_score}
          </div>
        </div>
      </div>
    </>
  );
}
