"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { NewTeamForm } from "@/components/teams/new-team-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDb } from "@/components/providers/database-provider";
import { createClient } from "@/lib/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Team } from "@/lib/supabase/types";
import { Volleyball } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function TeamsPage() {
  const router = useRouter();
  const { db } = useDb();
  const [teams, setTeams] = useState<Array<Team>>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadTeams = async () => {
      const supabase = createClient();
      const { data, error } = await supabase.from("teams").select("*");
      if (error) throw error;
      setTeams(data);

      setIsLoading(false);
    };

    loadTeams();
  }, [db]);

  if (isLoading) {
    return <Skeleton className="h-[600px] w-full" />;
  }

  return (
    <div className="flex flex-col gap-8">
      <section className="text-center py-12 md:py-20">
        <h1 className="text-4xl md:text-6xl font-bold mb-4">
          Existing Teams
        </h1>
        <p className="text-xl text-muted-foreground mb-8">
          Create and manage your teams and players
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <Button asChild size="lg">
            <Link href="/teams/new">
              New Team
            </Link>
          </Button>
        </div>
      </section>
      <section className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
        {teams.map((team) => (
          <Card key={team.id} className="max-w-2xl mx-auto p-6">
            <CardHeader>
              <Volleyball className="h-8 w-8 mb-2 text-primary" />
              <CardTitle className="text-2xl text-center">
                {team.name}
              </CardTitle>
            </CardHeader>
          </Card>
        ))}
      </section>
    </div>
  );
}
