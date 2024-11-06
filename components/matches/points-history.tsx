"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScorePoint } from "@/lib/supabase/types";

interface PointsHistoryProps {
  points: ScorePoint[];
  className?: string;
}

export function PointsHistory({ points, className }: PointsHistoryProps) {
  return (
    <div className={className}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Team</TableHead>
            <TableHead>Point Type</TableHead>
            <TableHead>Score</TableHead>
            <TableHead>Time</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {points.map((point) => (
            <TableRow key={point.id}>
              <TableCell className="capitalize">
                {point.scoring_team}
              </TableCell>
              <TableCell className="capitalize">
                {point.point_type.replace('_', ' ')}
              </TableCell>
              <TableCell>
                {point.home_score} - {point.away_score}
              </TableCell>
              <TableCell>
                {new Date(point.timestamp).toLocaleTimeString()}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}