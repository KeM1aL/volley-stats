import { describe, expect, it } from "vitest";
import { eventRows } from "@/components/report-pdf/tables";
import { buildMatchReport } from "@/lib/report/build";
import { eventImpacts } from "@/lib/report/metrics/event-impact";
import { buildRallies } from "@/lib/report/metrics/rallies";
import { US, event, makeData, rallies } from "./fixtures";

describe("eventRows", () => {
  it("prints the score and the before/after windows in home-away order when we are away", () => {
    const data = makeData([{ rallies: rallies("WWWL") }], { usIsHome: false });
    const model = buildMatchReport(data, US);
    const impacts = eventImpacts([event(1, "timeout", { point_number: 2, team: "away" })], buildRallies(data, US), false, US);
    const [row] = eventRows(model, impacts, new Map(), (key) => key);
    const { before, after } = impacts[0];
    expect(before.us).not.toBe(before.them);
    expect(row[1]).toBe(`${impacts[0].score.them}–${impacts[0].score.us}`);
    expect(row[4]).toBe(`${before.them}–${before.us}`);
    expect(row[5]).toBe(`${after.them}–${after.us}`);
  });
});
