"use client";

import { Match, Set } from "@/lib/supabase/types";
import { Card, CardContent } from "@/components/ui/card";

type LiveMatchHeaderProps = {
  match: Match;
  sets: Set[];
};

export function LiveMatchHeader({ match, sets }: LiveMatchHeaderProps) {
  
  return (
    <Card>
      <CardContent className="flex items-center justify-between p-2">
        <div>
          <h1 className="text-2xl font-bold">Live Match</h1>
          <p className="text-muted-foreground">
            {new Date(match.date).toLocaleDateString()}
          </p>
        </div>
        <div className="w-full max-w-4xl ml-auto">
          <div className="text-primary">
            <div className="grid grid-cols-7 gap-4">
              {/* Team 1 Row */}
              <div className="col-span-1 bg-primary/10 p-2 rounded-lg flex items-center justify-center text-xl font-bold">
                Home
              </div>
              {sets.map((set, index) => (
                <div
                  key={`home-${index}`}
                  className="col-span-1 bg-primary/10 rounded-lg flex items-center justify-center text-xl font-bold p-2"
                >
                  {set.home_score}
                </div>
              ))}
              {sets.length < 5 && (new Array(5 - sets.length)).fill(0).map((_, index) =>
                <div key={`home-filler-${index}`} className="col-span-1 bg-primary/10 rounded-lg flex items-center justify-center text-xl font-bold p-2">
                  -
                </div>
              )}
              <div className="col-span-1 bg-secondary rounded-lg flex items-center justify-center text-xl font-bold text-secondary-foreground">
                {match.home_score}
              </div>
            </div>

            {/* Set Labels */}
            <div className="grid grid-cols-7 gap-4">
              <div className="col-span-1"></div>
              <div className="col-span-1 text-center text-primary/70">SET 1</div>
              <div className="col-span-1 text-center text-primary/70">SET 2</div>
              <div className="col-span-1 text-center text-primary/70">SET 3</div>
              <div className="col-span-1 text-center text-primary/70">SET 4</div>
              <div className="col-span-1 text-center text-primary/70">SET 5</div>
              <div className="col-span-1 text-center text-primary/70 font-bold">FINAL</div>
            </div>

            {/* Team 2 Row */}
            <div className="grid grid-cols-7 gap-4">
              <div className="col-span-1 bg-primary/10 p-2 rounded-lg flex items-center justify-center text-xl font-bold">
                Ext.
              </div>
              {sets.map((set, index) => (
                <div
                  key={`away-${index}`}
                  className="col-span-1 bg-primary/10 rounded-lg flex items-center justify-center text-xl font-bold p-2"
                >
                  {set.away_score}
                </div>
              ))}
              {sets.length < 5 && (new Array(5 - sets.length)).fill(0).map((_, index) =>
                <div key={`away-filler-${index}`} className="col-span-1 bg-primary/10 rounded-lg flex items-center justify-center text-xl font-bold p-2">
                  -
                </div>
              )}
              <div className="col-span-1 bg-secondary rounded-lg flex items-center justify-center text-xl font-bold text-secondary-foreground">
                {match.away_score}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
