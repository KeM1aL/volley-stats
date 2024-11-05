import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Volleyball, Trophy, BarChart3, Users } from "lucide-react";
import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col gap-8">
      <section className="text-center py-12 md:py-20">
        <h1 className="text-4xl md:text-6xl font-bold mb-4">
          Professional Volleyball Statistics
        </h1>
        <p className="text-xl text-muted-foreground mb-8">
          Track, analyze, and improve your team's performance with advanced analytics
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <Button asChild size="lg">
            <Link href="/matches/new">
              New Match
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/matches/history">
              View Matches
            </Link>
          </Button>
        </div>
      </section>

      <section className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader>
            <Volleyball className="h-8 w-8 mb-2 text-primary" />
            <CardTitle>Match Tracking</CardTitle>
            <CardDescription>
              Real-time statistics and scoring
            </CardDescription>
          </CardHeader>
          <CardContent>
            Track serves, attacks, blocks, and more during live matches with our intuitive interface.
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <Trophy className="h-8 w-8 mb-2 text-primary" />
            <CardTitle>Team Management</CardTitle>
            <CardDescription>
              Organize players and teams
            </CardDescription>
          </CardHeader>
          <CardContent>
            Manage multiple teams, player rosters, and track individual performance metrics.
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <BarChart3 className="h-8 w-8 mb-2 text-primary" />
            <CardTitle>Advanced Analytics</CardTitle>
            <CardDescription>
              Detailed performance insights
            </CardDescription>
          </CardHeader>
          <CardContent>
            Analyze team and player statistics with comprehensive charts and reports.
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <Users className="h-8 w-8 mb-2 text-primary" />
            <CardTitle>Collaboration</CardTitle>
            <CardDescription>
              Share and export data
            </CardDescription>
          </CardHeader>
          <CardContent>
            Export statistics to CSV/PDF and share match results with team members.
          </CardContent>
        </Card>
      </section>
    </div>
  );
}