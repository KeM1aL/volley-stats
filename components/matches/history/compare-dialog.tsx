"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Match } from "@/lib/types";

type CompareDialogProps = {
  matches: Match[];
  onClose: () => void;
};

export function CompareDialog({ matches, onClose }: CompareDialogProps) {
  if (matches.length !== 2) return null;

  const [match1, match2] = matches;

  const compareData = [
    {
      name: "Total Points",
      match1: match1.home_score + match1.away_score,
      match2: match2.home_score + match2.away_score,
    },
    {
      name: "Point Difference",
      match1: Math.abs(match1.home_score - match1.away_score),
      match2: Math.abs(match2.home_score - match2.away_score),
    },
  ];

  return (
    <Dialog open={matches.length === 2} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Compare Matches</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Match 1</CardTitle>
              </CardHeader>
              <CardContent>
                <p>
                  {match1.home_team?.name} vs {match1.away_team?.name}
                </p>
                <p className="text-muted-foreground">
                  {new Date(match1.date).toLocaleDateString()}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Match 2</CardTitle>
              </CardHeader>
              <CardContent>
                <p>
                  {match2.home_team?.name} vs {match2.away_team?.name}
                </p>
                <p className="text-muted-foreground">
                  {new Date(match2.date).toLocaleDateString()}
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Comparison</CardTitle>
            </CardHeader>
            <CardContent className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={compareData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar
                    dataKey="match1"
                    name="Match 1"
                    fill="hsl(var(--primary))"
                  />
                  <Bar
                    dataKey="match2"
                    name="Match 2"
                    fill="hsl(var(--secondary))"
                  />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}