import { ratio, type Ratio } from "../ratio";
import type { LossOrigin, Rally, StatAction, WinOrigin } from "../types";

export const WIN_ORIGINS: WinOrigin[] = ["ace", "kill", "block", "otherWinner", "opponentError", "unspecified"];
export const LOSS_ORIGINS: LossOrigin[] = ["ownError", "opponentWinner"];

export interface TeamSummary {
  rallies: number;
  won: number;
  lost: number;
  wonBy: Record<WinOrigin, number>;
  lostBy: Record<LossOrigin, number>;
  ownErrorsByAction: Record<StatAction | "unspecified", number>;
  /** Rallies won when receiving. */
  sideOut: Ratio;
  /** Rallies won when serving. */
  breakPoint: Ratio;
  /** Rallies with a typed action. */
  coverage: Ratio;
}

export function summarizeTeam(rallies: Rally[]): TeamSummary {
  const wonBy = Object.fromEntries(WIN_ORIGINS.map((origin) => [origin, 0])) as Record<WinOrigin, number>;
  const lostBy: Record<LossOrigin, number> = { ownError: 0, opponentWinner: 0 };
  const ownErrorsByAction: Record<StatAction | "unspecified", number> = {
    serve: 0,
    reception: 0,
    spike: 0,
    block: 0,
    defense: 0,
    unspecified: 0,
  };
  let won = 0;
  let received = 0;
  let sideOuts = 0;
  let served = 0;
  let breaks = 0;
  let typed = 0;
  for (const rally of rallies) {
    if (rally.typed) typed++;
    if (rally.server === "us") {
      served++;
      if (rally.winner === "us") breaks++;
    } else {
      received++;
      if (rally.winner === "us") sideOuts++;
    }
    if (rally.winner === "us") {
      won++;
      wonBy[rally.winOrigin ?? "unspecified"]++;
    } else {
      const origin = rally.lossOrigin ?? "opponentWinner";
      lostBy[origin]++;
      if (origin === "ownError") ownErrorsByAction[rally.action ?? "unspecified"]++;
    }
  }
  return {
    rallies: rallies.length,
    won,
    lost: rallies.length - won,
    wonBy,
    lostBy,
    ownErrorsByAction,
    sideOut: ratio(sideOuts, received),
    breakPoint: ratio(breaks, served),
    coverage: ratio(typed, rallies.length),
  };
}
