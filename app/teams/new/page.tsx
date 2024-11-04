"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { NewTeamForm } from "@/components/teams/new-team-form";
import { Card } from "@/components/ui/card";

export default function NewTeamPage() {
  const [matchId, setTeamId] = useState<string | null>(null);
  const router = useRouter();

  const onTeamCreated = (id: string) => {
    setTeamId(id);
  };

  return (
    <Card className="max-w-2xl mx-auto p-6">
      <NewTeamForm onTeamCreated={onTeamCreated} />
    </Card>
  );
}
