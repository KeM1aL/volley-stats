"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from "recharts";
import { Match, PlayerStat, ScorePoint, Set } from "@/lib/supabase/types";

interface TeamPerformanceProps {
  match: Match;
  sets: Set[];
  points: ScorePoint[];
  stats: PlayerStat[];
}

export function TeamPerformance({
  match,
  sets,
  points,
  stats,
}: TeamPerformanceProps) {
  const calculateTeamStats = (teamId: string) => {
    const teamPoints = points.filter(p => 
      p.scoring_team === (teamId === match.home_team_id ? 'home' : 'away')
    );
    const teamStats = stats.filter(s => {
      const pointScorer = points.find(p => p.set_id === s.set_id && p.player_id === s.player_id);
      return pointScorer?.scoring_team === (teamId === match.home_team_id ? 'home' : 'away');
    });

    return {
      points: {
        total: teamPoints.length,
        serves: teamPoints.filter(p => p.point_type === 'serve').length,
        spikes: teamPoints.filter(p => p.point_type === 'spike').length,
        blocks: teamPoints.filter(p => p.point_type === 'block').length,
        opponentErrors: teamPoints.filter(p => p.point_type === 'unknown').length,
      },
      stats: {
        serves: {
          total: teamStats.filter(s => s.stat_type === 'serve').length,
          success: teamStats.filter(s => s.stat_type === 'serve' && s.result === 'success').length,
          errors: teamStats.filter(s => s.stat_type === 'serve' && s.result === 'error').length,
        },
        spikes: {
          total: teamStats.filter(s => s.stat_type === 'spike').length,
          success: teamStats.filter(s => s.stat_type === 'spike' && s.result === 'success').length,
          errors: teamStats.filter(s => s.stat_type === 'spike' && s.result === 'error').length,
        },
        blocks: {
          total: teamStats.filter(s => s.stat_type === 'block').length,
          success: teamStats.filter(s => s.stat_type === 'block' && s.result === 'success').length,
          errors: teamStats.filter(s => s.stat_type === 'block' && s.result === 'error').length,
        },
        reception: {
          total: teamStats.filter(s => s.stat_type === 'reception').length,
          success: teamStats.filter(s => s.stat_type === 'reception' && s.result === 'success').length,
          errors: teamStats.filter(s => s.stat_type === 'reception' && s.result === 'error').length,
        },
      },
    };
  };

  const homeStats = calculateTeamStats(match.home_team_id);
  const awayStats = calculateTeamStats(match.away_team_id);

  const getEfficiencyData = () => [
    {
      name: 'Serves',
      home: (homeStats.stats.serves.success / homeStats.stats.serves.total * 100) || 0,
      away: (awayStats.stats.serves.success / awayStats.stats.serves.total * 100) || 0,
    },
    {
      name: 'Spikes',
      home: (homeStats.stats.spikes.success / homeStats.stats.spikes.total * 100) || 0,
      away: (awayStats.stats.spikes.success / awayStats.stats.spikes.total * 100) || 0,
    },
    {
      name: 'Blocks',
      home: (homeStats.stats.blocks.success / homeStats.stats.blocks.total * 100) || 0,
      away: (awayStats.stats.blocks.success / awayStats.stats.blocks.total * 100) || 0,
    },
    {
      name: 'Reception',
      home: (homeStats.stats.reception.success / homeStats.stats.reception.total * 100) || 0,
      away: (awayStats.stats.reception.success / awayStats.stats.reception.total * 100) || 0,
    },
  ];

  const getPointDistribution = (teamStats: ReturnType<typeof calculateTeamStats>) => [
    { name: 'Serves', value: teamStats.points.serves },
    { name: 'Spikes', value: teamStats.points.spikes },
    { name: 'Blocks', value: teamStats.points.blocks },
    { name:'Opponent Errors', value: teamStats.points.opponentErrors },
  ];

  const COLORS = [
    "hsl(var(--chart-1))",
    "hsl(var(--chart-2))",
    "hsl(var(--chart-3))",
    "hsl(var(--chart-4))",
  ];

  const getRotationEfficiency = () => {
    const rotationData = Array.from({ length: 6 }, (_, i) => ({
      rotation: `R${i + 1}`,
      home: points
        .filter(p => 
          p.scoring_team === 'home' && 
          Object.values(p.current_rotation)[0] === `position${i + 1}`
        ).length,
      away: points
        .filter(p => 
          p.scoring_team === 'away' && 
          Object.values(p.current_rotation)[0] === `position${i + 1}`
        ).length,
    }));

    return rotationData;
  };

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Team Efficiency Comparison</CardTitle>
            <CardDescription>Success rates across different skills</CardDescription>
          </CardHeader>
          <CardContent className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={getEfficiencyData()}>
                <PolarGrid />
                <PolarAngleAxis dataKey="name" />
                <PolarRadiusAxis domain={[0, 100]} />
                <Radar
                  name="Home Team"
                  dataKey="home"
                  stroke="hsl(var(--chart-1))"
                  fill="hsl(var(--chart-1))"
                  fillOpacity={0.6}
                />
                <Radar
                  name="Away Team"
                  dataKey="away"
                  stroke="hsl(var(--chart-2))"
                  fill="hsl(var(--chart-2))"
                  fillOpacity={0.6}
                />
                <Legend />
              </RadarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Rotation Efficiency</CardTitle>
            <CardDescription>Points scored in each rotation</CardDescription>
          </CardHeader>
          <CardContent className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={getRotationEfficiency()}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="rotation" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar
                  dataKey="home"
                  fill="hsl(var(--chart-1))"
                  name="Home Team"
                />
                <Bar
                  dataKey="away"
                  fill="hsl(var(--chart-2))"
                  name="Away Team"
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Home Team Point Distribution</CardTitle>
            <CardDescription>Breakdown of scoring methods</CardDescription>
          </CardHeader>
          <CardContent className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={getPointDistribution(homeStats)}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                  label
                >
                  {getPointDistribution(homeStats).map((_, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Away Team Point Distribution</CardTitle>
            <CardDescription>Breakdown of scoring methods</CardDescription>
          </CardHeader>
          <CardContent className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={getPointDistribution(awayStats)}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                  label
                >
                  {getPointDistribution(awayStats).map((_, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Detailed Team Statistics</CardTitle>
            <CardDescription>Comprehensive breakdown of team performance</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-8">
              <div>
                <h4 className="font-semibold mb-4">Home Team</h4>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-medium">Serves</p>
                    <p className="text-sm text-muted-foreground">
                      Success: {((homeStats.stats.serves.success / homeStats.stats.serves.total) * 100).toFixed(1)}%
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Errors: {homeStats.stats.serves.errors}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Spikes</p>
                    <p className="text-sm text-muted-foreground">
                      Success: {((homeStats.stats.spikes.success / homeStats.stats.spikes.total) * 100).toFixed(1)}%
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Errors: {homeStats.stats.spikes.errors}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Blocks</p>
                    <p className="text-sm text-muted-foreground">
                      Success: {((homeStats.stats.blocks.success / homeStats.stats.blocks.total) * 100).toFixed(1)}%
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Errors: {homeStats.stats.blocks.errors}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Reception</p>
                    <p className="text-sm text-muted-foreground">
                      Success: {((homeStats.stats.reception.success / homeStats.stats.reception.total) * 100).toFixed(1)}%
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Errors: {homeStats.stats.reception.errors}
                    </p>
                  </div>
                </div>
              </div>
              <div>
                <h4 className="font-semibold mb-4">Away Team</h4>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-medium">Serves</p>
                    <p className="text-sm text-muted-foreground">
                      Success: {((awayStats.stats.serves.success / awayStats.stats.serves.total) * 100).toFixed(1)}%
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Errors: {awayStats.stats.serves.errors}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Spikes</p>
                    <p className="text-sm text-muted-foreground">
                      Success: {((awayStats.stats.spikes.success / awayStats.stats.spikes.total) * 100).toFixed(1)}%
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Errors: {awayStats.stats.spikes.errors}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Blocks</p>
                    <p className="text-sm text-muted-foreground">
                      Success: {((awayStats.stats.blocks.success / awayStats.stats.blocks.total) * 100).toFixed(1)}%
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Errors: {awayStats.stats.blocks.errors}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Reception</p>
                    <p className="text-sm text-muted-foreground">
                      Success: {((awayStats.stats.reception.success / awayStats.stats.reception.total) * 100).toFixed(1)}%
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Errors: {awayStats.stats.reception.errors}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}