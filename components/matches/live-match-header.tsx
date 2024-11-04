"use client";

import { Match, Set } from "@/lib/supabase/types";
import { Card, CardContent } from "@/components/ui/card";
import { useDb } from "@/components/providers/database-provider";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useRouter } from "next/navigation";

type LiveMatchHeaderProps = {
  match: Match;
  set: Set
};

export function LiveMatchHeader({ match, set }: LiveMatchHeaderProps) {
  const { db } = useDb();
  const router = useRouter();
  const [isEnding, setIsEnding] = useState(false);

  const endMatch = async () => {
    setIsEnding(true);
    try {
      await db?.matches.findOne(match.id).update({
        $set: {
          status: "completed",
        },
      });
      router.push("/matches");
    } catch (error) {
      console.error("Failed to end match:", error);
    } finally {
      setIsEnding(false);
    }
  };

  return (
    <Card>
      <CardContent className="flex items-center justify-between p-6">
        <div>
          <h1 className="text-2xl font-bold">Live Match</h1>
          <p className="text-muted-foreground">
            {new Date(match.date).toLocaleDateString()}
          </p>
        </div>

        <Button
          variant="destructive"
          onClick={endMatch}
          disabled={isEnding}
        >
          End Match
        </Button>
      </CardContent>
    </Card>
  );
}