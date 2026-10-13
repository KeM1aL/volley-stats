import type { EventImpact } from "@/lib/report/metrics/event-impact";
import type { Rally, WinOrigin } from "@/lib/report/types";

const round = (n: number) => Math.round(n * 100) / 100;

export interface DiffBar {
  x: number;
  y: number;
  width: number;
  height: number;
  side: "us" | "them";
}

export interface DiffGeometry {
  path: string;
  zeroY: number;
  step: number;
  bars: DiffBar[];
}

/** Step line of the score difference (us − them) after each rally, and one bar per rally from zero. */
export function diffGeometry(rallies: Rally[], width: number, height: number): DiffGeometry {
  const maxAbs = Math.max(3, ...rallies.map((r) => Math.abs(r.score.us - r.score.them)));
  const step = width / Math.max(rallies.length, 1);
  const zeroY = round(height / 2);
  const yOf = (diff: number) => round(height / 2 - (diff / maxAbs) * (height / 2 - 2));
  let path = `M 0 ${zeroY}`;
  const bars: DiffBar[] = [];
  rallies.forEach((rally, i) => {
    const diff = rally.score.us - rally.score.them;
    const y = yOf(diff);
    path += ` V ${y} H ${round((i + 1) * step)}`;
    if (diff !== 0) {
      bars.push({ x: round(i * step), y: Math.min(y, zeroY), width: round(step), height: round(Math.abs(y - zeroY)), side: diff > 0 ? "us" : "them" });
    }
  });
  return { path, zeroY, step: round(step), bars };
}

const WIN_LETTERS: Record<WinOrigin, string> = { ace: "A", kill: "K", block: "B", otherWinner: "W", opponentError: "E", unspecified: "·" };

export function rallyLetter(rally: Rally): string {
  if (rally.winner === "us") return WIN_LETTERS[rally.winOrigin ?? "unspecified"];
  return rally.lossOrigin === "ownError" ? "e" : "O";
}

const MARKERS: Record<EventImpact["type"], string> = { substitution: "S", timeout: "T", injury: "+", sanction: "C", technical: "!", comment: "" };

/** Label above the timeline; comments show their number in the set. */
export function eventMarker(type: EventImpact["type"], commentNumber: number): string {
  return type === "comment" ? String(commentNumber) : MARKERS[type];
}

export function commentNumbers(events: Pick<EventImpact, "eventId" | "type">[]): Map<string, number> {
  const numbers = new Map<string, number>();
  let n = 0;
  for (const event of events) if (event.type === "comment") numbers.set(event.eventId, ++n);
  return numbers;
}
