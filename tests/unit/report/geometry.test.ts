import { describe, expect, it } from "vitest";
import { commentNumbers, diffGeometry, eventMarker, rallyLetter } from "@/components/report-pdf/charts/geometry";
import type { EventImpact } from "@/lib/report/metrics/event-impact";
import { buildRallies } from "@/lib/report/metrics/rallies";
import { P, US, makeData, rallies } from "./fixtures";

describe("diffGeometry", () => {
  it("draws a step line of the score difference and a bar per rally away from zero", () => {
    const geometry = diffGeometry(buildRallies(makeData([{ rallies: rallies("WL") }]), US), 100, 40);
    expect(geometry).toEqual({
      path: "M 0 20 V 14 H 50 V 20 H 100",
      zeroY: 20,
      step: 50,
      bars: [{ x: 0, y: 14, width: 50, height: 6, side: "us" }],
    });
  });

  it("handles a set without rallies", () => {
    expect(diffGeometry([], 100, 40)).toEqual({ path: "M 0 20", zeroY: 20, step: 100, bars: [] });
  });
});

describe("rallyLetter", () => {
  it("letters each rally by how it ended", () => {
    const data = makeData([
      {
        rallies: [
          { winner: "us", type: "serve", player: P.a },
          { winner: "us", type: "spike", player: P.b },
          { winner: "us", type: "block", player: P.c },
          { winner: "us", type: "defense", player: P.d },
          { winner: "us", by: "them" },
          { winner: "us" },
          { winner: "them", by: "us" },
          { winner: "them" },
        ],
      },
    ]);
    expect(buildRallies(data, US).map(rallyLetter).join("")).toBe("AKBWE·eO");
  });
});

describe("event markers", () => {
  it("marks event types and numbers comments in order", () => {
    const events = [{ eventId: "c1", type: "comment" }, { eventId: "t1", type: "timeout" }, { eventId: "c2", type: "comment" }] as EventImpact[];
    const numbers = commentNumbers(events);
    expect(events.map((e) => eventMarker(e.type, numbers.get(e.eventId) ?? 0))).toEqual(["1", "T", "2"]);
    expect(["substitution", "injury", "sanction", "technical"].map((type) => eventMarker(type as EventImpact["type"], 0))).toEqual(["S", "+", "C", "!"]);
  });
});
