"use client";

import { useState } from "react";
import { ArchiveRestore } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/contexts/auth-context";
import { useMatchApi } from "@/hooks/use-match-api";
import { useToast } from "@/hooks/use-toast";
import { canRemoveMatch } from "@/lib/matches/can-manage-match";
import { removalError } from "@/lib/matches/removal";
import type { Match } from "@/lib/types";

type ArchivedMatchNoticeProps = {
  /** Loaded with its home_team and away_team (the restore button needs their creators). */
  match: Match;
  /** Called once the match is restored: the page reloads its data. */
  onRestored: () => void;
};

/** Stands in for the data of an archived match (stats and score pages); whoever may restore it gets the button. */
export function ArchivedMatchNotice({ match, onRestored }: ArchivedMatchNoticeProps) {
  const t = useTranslations("matches");
  const { user } = useAuth();
  const { toast } = useToast();
  const matchApi = useMatchApi();
  const [isRestoring, setIsRestoring] = useState(false);

  const handleRestore = async () => {
    setIsRestoring(true);
    try {
      await matchApi.restoreMatch(match.id);
      toast({ title: t("removal.toast.restored") });
      onRestored();
    } catch (error) {
      console.error("Failed to restore match:", error);
      toast({
        variant: "destructive",
        title: t("toast.error"),
        description: t(`removal.errors.${removalError(error)}`),
      });
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <Card>
      <CardContent className="flex flex-wrap items-center justify-between gap-4 p-6">
        <p>{t("removal.archivedNotice")}</p>
        {canRemoveMatch(user, match) && (
          <Button variant="outline" onClick={handleRestore} disabled={isRestoring}>
            <ArchiveRestore className="h-4 w-4 mr-2" />
            {t("removal.restore")}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
