"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { NewMatchForm } from "@/components/matches/new-match-form";
import { MatchSetup } from "@/components/matches/match-setup";
import { Card } from "@/components/ui/card";

export default function NewMatchPage() {
  const [step, setStep] = useState<"form" | "setup">("form");
  const [matchId, setMatchId] = useState<string | null>(null);
  const router = useRouter();

  const onMatchCreated = (id: string) => {
    setMatchId(id);
    setStep("setup");
  };

  const onSetupComplete = () => {
    router.push(`/matches/${matchId}/live`);
  };

  return (
    <Card className="max-w-2xl mx-auto p-6">
      {step === "form" ? (
        <NewMatchForm onMatchCreated={onMatchCreated} />
      ) : (
        <MatchSetup matchId={matchId!} onComplete={onSetupComplete} />
      )}
    </Card>
  );
}