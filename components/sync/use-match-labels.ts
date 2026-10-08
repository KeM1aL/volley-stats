"use client";

import { useEffect, useState } from "react";
import { useLocalDb } from "@/components/providers/local-database-provider";

/** "Home – Away · 07/10/2026" for each match id, read from the local database. */
export function useMatchLabels(matchIds: string[]): Map<string, string> {
  const { localDb } = useLocalDb();
  const [labels, setLabels] = useState<Map<string, string>>(new Map());
  const key = matchIds.join(",");

  useEffect(() => {
    const ids = key ? key.split(",") : [];
    if (!localDb || ids.length === 0) return;
    let cancelled = false;
    void (async () => {
      const matches = await localDb.matches.findByIds(ids).exec();
      const teamIds = [...matches.values()].flatMap((match) => [match.home_team_id, match.away_team_id]);
      const teams = await localDb.teams.findByIds(teamIds).exec();
      const next = new Map<string, string>();
      for (const [id, match] of matches) {
        const home = teams.get(match.home_team_id)?.name ?? "?";
        const away = teams.get(match.away_team_id)?.name ?? "?";
        next.set(id, `${home} – ${away} · ${new Date(match.date).toLocaleDateString()}`);
      }
      if (!cancelled) setLabels(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [localDb, key]);

  return labels;
}
