"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { NewMatchForm } from "@/components/matches/new-match-form";
import { Card } from "@/components/ui/card";

export default function NewMatchPage() {
  const [matchId, setMatchId] = useState<string | null>(null);
  const router = useRouter();

  const onMatchCreated = (id: string) => {
    setMatchId(id);
    router.push("/matches");
  };

  return (
    <Card className="max-w-2xl mx-auto p-6">
      <NewMatchForm onMatchCreated={onMatchCreated} />
    </Card>
  );
}
