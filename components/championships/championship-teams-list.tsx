"use client";

import { useState } from "react";
import { Team } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ChevronDown, Eye, Users } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/contexts/auth-context";

type ChampionshipTeamsListProps = {
  teams: Team[];
  isLoading: boolean;
  championshipId: string;
};

export function ChampionshipTeamsList({
  teams,
  isLoading,
  championshipId,
}: ChampionshipTeamsListProps) {
  const [showTeams, setShowTeams] = useState(false);
  const { user } = useAuth();

  // Check if user can manage a team (owner or club admin)
  const canManage = (team: Team): boolean => {
    if (!user) return false;

    // Check if user owns the team
    if (team.user_id === user.id) return true;

    // Check if user is admin/owner of the team's club
    if (team.club_id && user.clubMembers) {
      const clubMember = user.clubMembers.find(
        (cm) => cm.club_id === team.club_id
      );
      return clubMember?.role === "owner" || clubMember?.role === "admin";
    }

    return false;
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-center text-muted-foreground">Loading teams...</p>
        </CardContent>
      </Card>
    );
  }

  if (teams.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-center text-muted-foreground">
            No active teams in this championship yet. Click "New Team" above to
            create one.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Collapsible open={showTeams} onOpenChange={setShowTeams}>
      <div className="flex items-center justify-center">
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="flex items-center gap-2">
            <ChevronDown
              className={`h-4 w-4 transition-transform ${
                showTeams ? "rotate-180" : ""
              }`}
            />
            {showTeams ? "Hide" : "Show"} Teams List ({teams.length})
          </Button>
        </CollapsibleTrigger>
      </div>

      <CollapsibleContent className="mt-4">
        <Card>
          <CardContent className="p-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Team Name</TableHead>
                  <TableHead>Club</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {teams.map((team) => (
                  <TableRow key={team.id}>
                    <TableCell className="font-medium">{team.name}</TableCell>
                    <TableCell>
                      {team.clubs?.name || <span className="text-muted-foreground italic">No club</span>}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/teams/${team.id}`}>
                            <Eye className="h-4 w-4 mr-1" />
                            View
                          </Link>
                        </Button>
                        {canManage(team) && (
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={`/teams/${team.id}/players`}>
                              <Users className="h-4 w-4 mr-1" />
                              Players
                            </Link>
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </CollapsibleContent>
    </Collapsible>
  );
}
