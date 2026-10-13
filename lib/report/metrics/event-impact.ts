import type { Event } from "@/lib/types";
import type { Rally, Side, Tally } from "../types";

export const IMPACT_WINDOW = 5;

export type Window = Tally & { rallies: number };

export interface EventImpact {
  eventId: string;
  setId: string;
  type: Event["event_type"];
  team: Side | null;
  /** Rallies played in the set before the event (0 = before the first rally). */
  afterRally: number;
  score: Tally;
  before: Window;
  after: Window;
  nextRallyWon: boolean | null;
  playerInId: string | null;
  playerOutId: string | null;
  /** Substitutions of the managed team: the incoming player's +/- for the rest of the set. */
  plusMinus: number | null;
  text: string | null;
  timestamp: string;
}

export function eventSide(event: Event, usIsHome: boolean, managedTeamId: string): Side | null {
  if (event.team === "home" || event.team === "away") return (event.team === "home") === usIsHome ? "us" : "them";
  if (event.team_id) return event.team_id === managedTeamId ? "us" : "them";
  return null;
}

export function eventText(event: Event): string | null {
  const details = (event.details ?? {}) as Record<string, unknown>;
  const pick = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : null);
  switch (event.event_type) {
    case "comment":
      return pick(details.text) ?? pick(event.comment);
    case "sanction":
      return pick(details.reason);
    case "injury":
    case "technical":
      return pick(details.description);
    case "substitution":
      return pick(details.comments);
    default:
      return pick(event.comment);
  }
}

const windowOf = (rallies: Rally[]): Window => ({
  us: rallies.filter((r) => r.winner === "us").length,
  them: rallies.filter((r) => r.winner === "them").length,
  rallies: rallies.length,
});

/** Events of the sets, placed after the rally they followed, with the rallies around them. */
export function eventImpacts(events: Event[], rallies: Rally[], usIsHome: boolean, managedTeamId: string): EventImpact[] {
  const impacts: EventImpact[] = [];
  for (const event of events) {
    if (!event.set_id) continue;
    const setRallies = rallies.filter((r) => r.setId === event.set_id);
    const afterRally =
      typeof event.point_number === "number"
        ? Math.min(Math.max(event.point_number, 0), setRallies.length)
        : setRallies.filter((r) => Date.parse(r.timestamp) < Date.parse(event.timestamp)).length;
    const details = (event.details ?? {}) as Record<string, unknown>;
    const team = eventSide(event, usIsHome, managedTeamId);
    const isSubstitution = event.event_type === "substitution";
    const playerInId = isSubstitution && typeof details.player_in_id === "string" ? details.player_in_id : null;
    const playerOutId = isSubstitution && typeof details.player_out_id === "string" ? details.player_out_id : null;
    const next = setRallies[afterRally];
    impacts.push({
      eventId: event.id,
      setId: event.set_id,
      type: event.event_type,
      team,
      afterRally,
      score: afterRally > 0 ? { ...setRallies[afterRally - 1].score } : { us: 0, them: 0 },
      before: windowOf(setRallies.slice(Math.max(0, afterRally - IMPACT_WINDOW), afterRally)),
      after: windowOf(setRallies.slice(afterRally, afterRally + IMPACT_WINDOW)),
      nextRallyWon: next ? next.winner === "us" : null,
      playerInId,
      playerOutId,
      plusMinus:
        playerInId && team === "us"
          ? setRallies
              .slice(afterRally)
              .filter((r) => r.onCourt.includes(playerInId))
              .reduce((sum, r) => sum + (r.winner === "us" ? 1 : -1), 0)
          : null,
      text: eventText(event),
      timestamp: event.timestamp,
    });
  }
  return impacts.sort((a, b) => a.afterRally - b.afterRally || Date.parse(a.timestamp) - Date.parse(b.timestamp));
}
