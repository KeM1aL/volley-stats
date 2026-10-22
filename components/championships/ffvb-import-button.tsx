"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useAuth } from "@/contexts/auth-context";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api-client";
import { platform } from "@/lib/platform";
import type { User } from "@/lib/types";

/** Application admins only (profiles.role); the server checks the same role, this only hides the button. */
export function isAdmin(user: User | null): boolean {
  return user?.profile.role === "admin";
}

/** Imports the championship's matches from the FFVB site. Web build only, and only for admins. */
export function FfvbImportButton({ seasonId, championshipId }: { seasonId: string | null; championshipId: string }) {
  const t = useTranslations("championships");
  const { user } = useAuth();
  const { toast } = useToast();
  const [isImporting, setIsImporting] = useState(false);

  if (platform.target !== "web" || !isAdmin(user)) return null;

  const runImport = async () => {
    setIsImporting(true);
    try {
      const response = await apiFetch("/api/import/ffvb", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seasonId, championshipId }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : String(response.status));
      toast({ title: t("import.success"), description: t("import.successDesc") });
    } catch (error) {
      toast({ variant: "destructive", title: t("import.failure"), description: (error as Error).message });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Button
      variant="outline"
      onClick={runImport}
      disabled={isImporting}
      className="flex-1 sm:flex-none text-xs sm:text-sm"
      data-testid="ffvb-import-button"
    >
      {isImporting ? <LoadingSpinner size="sm" className="mr-1 sm:mr-2" /> : <RefreshCw className="h-4 w-4 mr-1 sm:mr-2" />}
      {isImporting ? t("actions.refreshing") : t("actions.refresh")}
    </Button>
  );
}
