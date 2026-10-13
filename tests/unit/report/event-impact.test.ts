import { describe, expect, it } from "vitest";
import { eventImpacts, eventSide, eventText } from "@/lib/report/metrics/event-impact";
import { buildRallies } from "@/lib/report/metrics/rallies";
import { LINEUP, P, US, at, event, makeData, rallies } from "./fixtures";

// Rallies at 30 s, 60 s, … ; scores 1-0 2-0 2-1 2-2 2-3 3-3 4-3 5-3
const ralliesOf = () => buildRallies(makeData([{ rallies: rallies("WWLLLWWW") }]), US);
const impactOf = (e: ReturnType<typeof event>) => eventImpacts([e], ralliesOf(), true, US)[0];

describe("eventImpacts", () => {
  it("compares the 5 rallies before and after an event", () => {
    expect(impactOf(event(1, "timeout", { point_number: 3, team: "home" }))).toMatchObject({
      afterRally: 3,
      team: "us",
      score: { us: 2, them: 1 },
      before: { us: 2, them: 1, rallies: 3 },
      after: { us: 3, them: 2, rallies: 5 },
      nextRallyWon: false,
    });
  });

  it("handles an event before the first rally", () => {
    expect(impactOf(event(1, "timeout", { point_number: 0 }))).toMatchObject({
      afterRally: 0,
      score: { us: 0, them: 0 },
      before: { us: 0, them: 0, rallies: 0 },
      after: { us: 2, them: 3, rallies: 5 },
      nextRallyWon: true,
    });
  });

  it("places an event without point number by its time", () => {
    expect(impactOf(event(1, "substitution", { timestamp: at(75) })).afterRally).toBe(2);
  });

  it("stops the windows at the end of the set", () => {
    expect(impactOf(event(1, "timeout", { point_number: 7 })).after).toEqual({ us: 1, them: 0, rallies: 1 });
    expect(impactOf(event(1, "timeout", { point_number: 99 }))).toMatchObject({ afterRally: 8, nextRallyWon: null });
  });

  it("gives the incoming player's +/- for the rest of the set", () => {
    const withG = { ...LINEUP, p1: P.g };
    const data = makeData([
      {
        rallies: [
          { winner: "us" },
          { winner: "us" },
          { winner: "them", rotation: withG },
          { winner: "us", rotation: withG },
          { winner: "us", rotation: withG },
        ],
      },
    ]);
    const substitution = event(1, "substitution", {
      point_number: 2,
      team: "home",
      details: { player_in_id: P.g, player_out_id: P.a },
    });
    expect(eventImpacts([substitution], buildRallies(data, US), true, US)[0]).toMatchObject({
      playerInId: P.g,
      playerOutId: P.a,
      plusMinus: 1,
    });
  });

  it("leaves out events without a set", () => {
    expect(eventImpacts([event(null, "comment")], ralliesOf(), true, US)).toEqual([]);
  });
});

describe("eventSide", () => {
  it("reads the team side, then the team id", () => {
    expect(eventSide(event(1, "timeout", { team: "away" }), true, US)).toBe("them");
    expect(eventSide(event(1, "timeout", { team: "away" }), false, US)).toBe("us");
    expect(eventSide(event(1, "timeout", { team_id: US }), true, US)).toBe("us");
    expect(eventSide(event(1, "comment"), true, US)).toBeNull();
  });
});

describe("eventText", () => {
  it("reads the text of each event type", () => {
    expect(eventText(event(1, "comment", { details: { text: " Bon service " } }))).toBe("Bon service");
    expect(eventText(event(1, "sanction", { details: { reason: "Delay" } }))).toBe("Delay");
    expect(eventText(event(1, "injury", { details: { description: "Ankle" } }))).toBe("Ankle");
    expect(eventText(event(1, "substitution", { details: { comments: "" } }))).toBeNull();
    expect(eventText(event(1, "timeout"))).toBeNull();
  });
});
