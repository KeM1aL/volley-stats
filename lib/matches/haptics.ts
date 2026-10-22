import type { MatchState } from "@/lib/commands/command";

/** Feedback for a recorded point or stat: a success pattern when a set or the match just ended, a light tap otherwise. */
export function hapticFor(previous: MatchState, next: MatchState): "tap" | "success" {
  if (next.match?.status === "completed" && previous.match?.status !== "completed") return "success";
  if (next.currentSet?.id !== previous.currentSet?.id) return "success";
  if (next.currentSet?.status === "completed" && previous.currentSet?.status !== "completed") return "success";
  return "tap";
}
