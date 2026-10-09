import type { ClaimState } from "./tracked-matches";

/** What the live page does after it asked for scoring (a forced claim or a take-back). */
export type ClaimFollowUp =
  /** The server named another device: scoring stays where it is. */
  | "not-claimed"
  /** Scoring is ours but the match couldn't be pulled again: the screen is stale, scoring stays blocked. */
  | "refresh-failed"
  /** Scoring is ours and the match is up to date: load it. */
  | "reload";

export function claimFollowUp(claimed: boolean, refreshed: boolean): ClaimFollowUp {
  if (!claimed) return "not-claimed";
  return refreshed ? "reload" : "refresh-failed";
}

/**
 * What confirming the "score on this device" prompt amounts to. A lost claim is only taken back
 * online (the take-back discards the superseded changes first), so offline it stays lost.
 */
export function offlineConfirmFollowUp(claim: ClaimState | null | undefined): "needs-connection" | "scoring-offline" {
  return claim === "lost" ? "needs-connection" : "scoring-offline";
}

/** The claim went from lost to held: an interrupted take-back was completed in the background. */
export function claimBecameHeld(previous: ClaimState | null | undefined, next: ClaimState | null | undefined): boolean {
  return previous === "lost" && next === "held";
}
