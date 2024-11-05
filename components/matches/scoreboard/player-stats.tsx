"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Match, Set, Player, PlayerStat } from "@/lib/supabase/types";
import { useDb } from "@/components/providers/database-provider";

interface PlayerStatsProps {
  match: Match;
  set: Set;
  player: Player;
  className?: string;
}

interface StatSummary {
  serve: { success: number; error: number; total: number };
  attack: { success: number; error: number; total: number };
  block: { success: number; error: number; total: number };
  reception: { success: number; error: number; total: number };
}

export function PlayerStats({
  match,
  set,
  player,
  className,
}: PlayerStatsProps) {
  const { db } = useDb();
  const [stats, setStats] = useState<PlayerStat[]>([]);
  const [summary, setSummary] = useState<StatSummary>({
    serve: { success: 0, error: 0, total: 0 },
    attack: { success: 0, error: 0, total: 0 },
    block: { success: 0, error: 0, total: 0 },
    reception: { success: 0, error: 0, total: 0 },
  });

  useEffect(() => {
    const loadStats = async () => {
      if (!db) return;

      const playerStats = await db.player_stats
        .find({
          selector: {
            match_id: match.id,
            set_id: set.id,
            player_id: player.id,
          },
        })
        .exec();

      setStats(playerStats.map(stat => stat.toJSON()));
    };

    loadStats();
  }, [db, match.id, set.id, player.id]);

  useEffect(() => {
    const newSummary: StatSummary = {
      serve: { success: 0, error: 0, total: 0 },
      attack: { success: 0, error: 0, total: 0 },
      block: { success: 0, error: 0, total: 0 },
      reception: { success: 0, error: 0, total: 0 },
    };

    stats.forEach((stat) => {
      const type = stat.stat_type as keyof StatSummary;
      newSummary[type].total++;
      if (stat.result === "success") newSummary[type].success++;
      if (stat.result === "error") newSummary[type].error++;
    });

    setSummary(newSummary);
  }, [stats]);

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Player Statistics</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Action</TableHead>
              <TableHead>Success</TableHead>
              <TableHead>Error</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Rate</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Object.entries(summary).map(([type, data]) => (
              <TableRow key={type}>
                <TableCell className="capitalize">
                  {type}
                </TableCell>
                <TableCell>{data.success}</TableCell>
                <TableCell>{data.error}</TableCell>
                <TableCell>{data.total}</TableCell>
                <TableCell>
                  {data.total > 0
                    ? `${((data.success / data.total) * 100).toFixed(1)}%`
                    : "-"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}