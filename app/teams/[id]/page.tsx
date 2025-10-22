"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useTeamApi } from "@/hooks/use-team-api";
import { Team } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function TeamDetailsPage() {
  const { id } = useParams();
  const [team, setTeam] = useState<Team | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const teamApi = useTeamApi();

  useEffect(() => {
    const loadTeam = async () => {
      if (typeof id !== "string") return;
      try {
        // This would ideally be a getTeamById function
        const team = await teamApi.getTeam(id);
        setTeam(team);
      } catch (error) {
        console.error("Failed to load team:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadTeam();
  }, [id, teamApi]);

  if (isLoading) {
    return <Skeleton className="h-[400px] w-full" />;
  }

  if (!team) {
    return <div>Team not found</div>;
  }

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold">{team.name}</h1>
      <Card>
        <CardHeader>
          <CardTitle>Team Details</CardTitle>
        </CardHeader>
        <CardContent>
          <p>
            <strong>Championship:</strong> {team.championships?.name}
          </p>
          {/* Add more team details here */}
        </CardContent>
      </Card>
    </div>
  );
}
