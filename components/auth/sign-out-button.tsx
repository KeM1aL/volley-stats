"use client";

import { useState, type ComponentProps } from "react";
import { useTranslations } from "next-intl";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/contexts/auth-context";
import { useConfirmLeave } from "@/components/providers/leave-guard-provider";
import { useSyncStatus } from "@/hooks/use-sync-status";
import { allowNextUnload } from "@/hooks/use-unsent-guard";

/**
 * Sign out, shared by the website header and the app's Profile page. Unsent changes: the warning says where they go
 * (they upload at the next sign-in), and it stands for leaving a live match too, so it is the only dialog. Otherwise
 * it asks before leaving a live match.
 */
export function SignOutButton({
  variant = "ghost",
  size = "sm",
  className = "px-2 md:px-3 text-xs md:text-sm",
}: Pick<ComponentProps<typeof Button>, "variant" | "size" | "className">) {
  const { signOut } = useAuth();
  const t = useTranslations("navigation");
  const tSync = useTranslations("sync");
  const syncStatus = useSyncStatus();
  const unsentCount = (syncStatus?.pendingCount ?? 0) + (syncStatus?.rejectedCount ?? 0);
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const { confirmLeave } = useConfirmLeave();

  const handleSignOut = async () => {
    if (unsentCount > 0) {
      setConfirmSignOut(true);
      return;
    }
    const decision = await confirmLeave();
    if (decision === "stay") return;
    if (decision === "leave") allowNextUnload();
    void signOut();
  };

  return (
    <>
      <Button variant={variant} size={size} onClick={() => void handleSignOut()} className={className}>
        <LogOut className="h-4 w-4 mr-1 md:mr-2" />
        <span>{t("actions.signOut")}</span>
      </Button>
      <AlertDialog open={confirmSignOut} onOpenChange={setConfirmSignOut}>
        <AlertDialogContent data-testid="sign-out-warning">
          <AlertDialogHeader>
            <AlertDialogTitle>{tSync("guards.signOutTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{tSync("guards.signOutBody", { count: unsentCount })}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tSync("claim.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmSignOut(false);
                allowNextUnload();
                void signOut();
              }}
            >
              {tSync("guards.signOutConfirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
