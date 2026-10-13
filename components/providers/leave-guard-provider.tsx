"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
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

/** `free`: nothing to confirm (no live match open); otherwise the user's answer. */
export type LeaveDecision = "free" | "leave" | "stay";

/** sessionStorage key of the last live match URL, read by public/offline.html. */
export const LAST_LIVE_MATCH_KEY = "volleystats:last-live-match";

interface GuardState {
  active: boolean;
  unsentCount: number;
}

interface LeaveGuardContextValue {
  setGuard: (state: GuardState) => void;
  isActive: () => boolean;
  confirmLeave: () => Promise<LeaveDecision>;
}

const LeaveGuardContext = createContext<LeaveGuardContextValue | null>(null);

/**
 * Asks before an in-app action leaves a live match (header links, logo, sign out). The live page turns
 * the guard on with `useLeaveGuard`; links and buttons ask through `useConfirmLeave`. Browser Back is
 * not intercepted.
 */
export function LeaveGuardProvider({ children }: { children: ReactNode }) {
  const t = useTranslations("matches.liveGuard");
  const [guard, setGuardState] = useState<GuardState>({ active: false, unsentCount: 0 });
  const guardRef = useRef(guard);
  const [open, setOpen] = useState(false);
  const pending = useRef<((decision: LeaveDecision) => void) | null>(null);

  const setGuard = useCallback((state: GuardState) => {
    guardRef.current = state;
    setGuardState(state);
  }, []);

  const isActive = useCallback(() => guardRef.current.active, []);

  const confirmLeave = useCallback((): Promise<LeaveDecision> => {
    if (!guardRef.current.active) return Promise.resolve("free");
    // A second request while the dialog is open answers the first one with "stay".
    pending.current?.("stay");
    return new Promise<LeaveDecision>((resolve) => {
      pending.current = resolve;
      setOpen(true);
    });
  }, []);

  const settle = useCallback((decision: "leave" | "stay") => {
    const resolve = pending.current;
    pending.current = null;
    setOpen(false);
    resolve?.(decision);
  }, []);

  const value = useMemo(() => ({ setGuard, isActive, confirmLeave }), [setGuard, isActive, confirmLeave]);

  return (
    <LeaveGuardContext.Provider value={value}>
      {children}
      <AlertDialog open={open} onOpenChange={(next) => !next && settle("stay")}>
        <AlertDialogContent data-testid="leave-live-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("title")}</AlertDialogTitle>
            <AlertDialogDescription>{t("body")}</AlertDialogDescription>
          </AlertDialogHeader>
          {guard.unsentCount > 0 && (
            <p className="text-sm font-medium">{t("unsent", { count: guard.unsentCount })}</p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => settle("stay")}>{t("stay")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => settle("leave")}>{t("leave")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </LeaveGuardContext.Provider>
  );
}

/** Turns the guard on while `active`; off again when the caller unmounts. */
export function useLeaveGuard({ active, unsentCount }: GuardState): void {
  const setGuard = useContext(LeaveGuardContext)?.setGuard;
  useEffect(() => {
    setGuard?.({ active, unsentCount });
  }, [setGuard, active, unsentCount]);
  useEffect(() => () => setGuard?.({ active: false, unsentCount: 0 }), [setGuard]);
}

const UNGUARDED = { isActive: () => false, confirmLeave: () => Promise.resolve<LeaveDecision>("free") };

export function useConfirmLeave(): Pick<LeaveGuardContextValue, "isActive" | "confirmLeave"> {
  const context = useContext(LeaveGuardContext);
  return context ?? UNGUARDED;
}
