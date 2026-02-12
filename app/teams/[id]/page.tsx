"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { ArrowLeft, Pencil, Trophy, Building2, Users, Calendar } from "lucide-react";
import { useTeamApi } from "@/hooks/use-team-api";
import { useMatchApi } from "@/hooks/use-match-api";
import { useTeamMembersApi } from "@/hooks/use-team-members-api";
import { useAuth } from "@/contexts/auth-context";
import { Match, Team, TeamMember } from "@/lib/types";
import { Filter, Sort } from "@/lib/api/types";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EditTeamDialog } from "@/components/teams/edit-team-dialog";
import { useTranslations } from "next-intl";

export default function TeamDetailsPage() {
  const t = useTranslations('teams');
  const te = useTranslations("enums");
  const { id } = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const [team, setTeam] = useState<Team | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const teamApi = useTeamApi();
  const matchApi = useMatchApi();
  const teamMembersApi = useTeamMembersApi();

  // Permission check
  const canManageTeam = useMemo(() => {
    if (!user || !team) return false;

    // User created the team
    if (team.user_id === user.id) return true;

    // User is a team member
    const membership = user.teamMembers?.find((m) => m.team_id === team.id);
    if (membership) return true;

    // User is a club admin (if team has club)
    if (team.club_id) {
      const clubMembership = user.clubMembers?.find(
        (m) => m.club_id === team.club_id
      );
      if (clubMembership && ["owner", "admin"].includes(clubMembership.role)) {
        return true;
      }
    }

    return false;
  }, [user, team]);

  useEffect(() => {
    const loadData = async () => {
      if (typeof id !== "string") return;

      setIsLoading(true);
      try {
        const filters: Filter[] = [
          {
            field: "id",
            operator: "eq",
            value: id
          }
        ];
        // Load team with relations
        const joins = ["championships", "clubs"];
        const teamsData = await teamApi.getTeams(filters, undefined, joins);
        setTeam(teamsData[0] || null);

        // Load matches where this team is home or away
        const matchFilters: Filter[] = [
          {
            operator: "or",
            value: `home_team_id.eq.${id},away_team_id.eq.${id}`,
          },
        ];
        const matchSort: Sort<Match>[] = [{ field: "date", direction: "desc" }];
        const matchJoins = [
          "home_team:teams!matches_home_team_id_fkey",
          "away_team:teams!matches_away_team_id_fkey",
        ];
        const matchesData = await matchApi.getMatchs(
          matchFilters,
          matchSort,
          matchJoins
        );
        setMatches(matchesData);

        // Load team members
        const memberFilters: Filter[] = [
          { field: "team_id", operator: "eq", value: id },
        ];
        const memberSort: Sort<TeamMember>[] = [
          { field: "number", direction: "asc" },
        ];
        const membersData = await teamMembersApi.getTeamMembers(
          memberFilters,
          memberSort
        );
        setTeamMembers(membersData);
      } catch (error) {
        console.error("Failed to load team data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [id, teamApi, matchApi, teamMembersApi, refreshKey]);

  const handleTeamRefresh = useCallback(() => {
    setRefreshKey((prev) => prev + 1);
    setEditingTeam(null);
  }, []);

  // Separate matches into recent (completed) and upcoming
  const today = new Date().toISOString().split("T")[0];
  const recentMatches = matches
    .filter((m) => m.date && m.date < today)
    .slice(0, 5);
  const upcomingMatches = matches
    .filter((m) => m.date && m.date >= today)
    .sort((a, b) => (a.date || "").localeCompare(b.date || ""))
    .slice(0, 5);

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      active: "default",
      incomplete: "secondary",
      archived: "outline",
    };
    return (
      <Badge variant={variants[status] || "default"}>
        {t(`status.${status}` as any)}
      </Badge>
    );
  };

  const formatMatchResult = (match: Match) => {
    if (match.home_score === null || match.away_score === null) {
      return "-";
    }
    return `${match.home_score} - ${match.away_score}`;
  };

  if (isLoading) {
    return (
      <div className="space-y-8">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-[200px] w-full" />
        <div className="grid md:grid-cols-2 gap-6">
          <Skeleton className="h-[300px]" />
          <Skeleton className="h-[300px]" />
        </div>
        <Skeleton className="h-[300px] w-full" />
      </div>
    );
  }

  if (!team) {
    return (
      <div className="space-y-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push("/teams")}
          aria-label={t('details.backToTeams')}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-2xl font-bold">{t('details.teamNotFound')}</h1>
        <p className="text-muted-foreground">
          {t('details.teamNotFoundDesc')}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/teams")}
            aria-label={t('details.backToTeams')}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold">{team.name}</h1>
              {getStatusBadge(team.status)}
            </div>
          </div>
        </div>
        {canManageTeam && (
          <Button variant="outline" onClick={() => setEditingTeam(team)}>
            <Pencil className="h-4 w-4 mr-2" />
            {t('details.editTeam')}
          </Button>
        )}
      </div>

      {/* Team Info Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            {t('details.information')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">{t('details.championship')}</p>
                {team.championships ? (
                  <Link
                    href={`/championships/${team.championships.id}`}
                    className="text-primary hover:underline font-medium"
                  >
                    {team.championships.name}
                  </Link>
                ) : (
                  <p className="text-muted-foreground">{t('details.notAssigned')}</p>
                )}
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">{t('details.club')}</p>
                {team.clubs ? (
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{team.clubs.name}</span>
                  </div>
                ) : (
                  <p className="text-muted-foreground">{t('details.noClub')}</p>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Matches Section */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Recent Matches */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              {t('details.recentMatches')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentMatches.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('table.date')}</TableHead>
                    <TableHead>{t('details.opponent')}</TableHead>
                    <TableHead className="text-center">{t('details.result')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentMatches.map((match) => {
                    const isHome = match.home_team_id === team.id;
                    const opponent = isHome ? match.away_team : match.home_team;
                    return (
                      <TableRow key={match.id}>
                        <TableCell>
                          {match.date
                            ? format(new Date(match.date), "MMM d, yyyy")
                            : "-"}
                        </TableCell>
                        <TableCell>
                          {isHome ? t('details.vs') + " " : t('details.at') + " "}
                          {opponent?.name || t('details.unknown')}
                        </TableCell>
                        <TableCell className="text-center font-medium">
                          {formatMatchResult(match)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ) : (
              <p className="text-muted-foreground text-center py-8">
                {t('details.noRecentMatches')}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Upcoming Matches */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              {t('details.upcomingMatches')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {upcomingMatches.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('table.date')}</TableHead>
                    <TableHead>{t('details.opponent')}</TableHead>
                    <TableHead className="text-center">{t('details.location')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {upcomingMatches.map((match) => {
                    const isHome = match.home_team_id === team.id;
                    const opponent = isHome ? match.away_team : match.home_team;
                    return (
                      <TableRow key={match.id}>
                        <TableCell>
                          {match.date
                            ? format(new Date(match.date), "MMM d, yyyy")
                            : "-"}
                        </TableCell>
                        <TableCell>{opponent?.name || t('details.unknown')}</TableCell>
                        <TableCell className="text-center">
                          {isHome ? t('details.home') : t('details.away')}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ) : (
              <p className="text-muted-foreground text-center py-8">
                {t('details.noUpcomingMatches')}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Team Members */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            {t('details.teamMembers', { count: teamMembers.length })}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {teamMembers.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">#</TableHead>
                  <TableHead>{t('table.name')}</TableHead>
                  <TableHead>{t('table.position')}</TableHead>
                  <TableHead>{t('table.role')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {teamMembers.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell className="font-bold">{member.number}</TableCell>
                    <TableCell className="font-medium">{member.name}</TableCell>
                    <TableCell>{member.position ? te(`playerRole.${member.position}`) : "-"}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{te(`teamMemberRole.${member.role}`)}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-muted-foreground text-center py-8">
              {t('details.noTeamMembers')}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <EditTeamDialog
        team={editingTeam}
        onClose={() => setEditingTeam(null)}
        onSuccess={handleTeamRefresh}
      />
    </div>
  );
}
