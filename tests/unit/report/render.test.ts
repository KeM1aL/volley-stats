import { describe, expect, it } from "vitest";
import { renderMatchReport, reportTranslator } from "@/components/report-pdf/render";
import { PlayerRole } from "@/lib/enums";
import { SUPPORTED_LOCALES } from "@/lib/i18n/config";
import { buildMatchReport } from "@/lib/report/build";
import { LINEUP, P, US, event, makeData, members, rallies, stat } from "./fixtures";

function fullMatch() {
  const roster = members();
  roster[6] = { ...roster[6], name: "Zoë Łukasiewicz-Ñúñez de la Fuente y Castellanos", number: Number.NaN };
  const typed = [
    { winner: "us" as const, type: "serve" as const, player: P.a },
    { winner: "us" as const, type: "spike" as const, player: P.d },
    { winner: "them" as const, by: "us" as const, type: "reception" as const, player: P.e },
    { winner: "us" as const, by: "them" as const },
  ];
  const set = (pattern: string) => ({
    rallies: [...typed, ...rallies(pattern)],
    roles: { [P.d]: PlayerRole.OUTSIDE_HITTER, [P.c]: PlayerRole.MIDDLE_HITTER, [P.a]: PlayerRole.SETTER },
  });
  return makeData(
    [
      set("WWLWWLWWWLLWWWWLWLWWWW"),
      set("LLWLLWLLLWWLLLLWLWLLLL"),
      set("WWWWWLWWWWLWWWWWWWWWLW"),
      { rallies: [...typed, ...rallies("WLWLWLWLWLWLW")] },
      { rallies: [], status: "upcoming" },
    ],
    {
      members: roster,
      stats: [stat(1, P.a, "serve", "success", "p1"), stat(1, P.d, "spike", "success", "p4"), stat(1, P.e, "reception", "error"), stat(2, P.g, "block", "success", "p3")],
      events: [
        event(1, "timeout", { point_number: 5, team: "away" }),
        event(1, "substitution", { point_number: 8, team: "home", details: { player_in_id: P.g, player_out_id: P.c } }),
        event(2, "comment", { point_number: 10, details: { text: "Réception en difficulté sur le service flottant" } }),
        event(null, "comment", { details: { text: "Échauffement écourté" } }),
      ],
    }
  );
}

describe("renderMatchReport", () => {
  for (const locale of SUPPORTED_LOCALES) {
    it(`renders a full match in ${locale}`, async () => {
      const pdf = await renderMatchReport(buildMatchReport(fullMatch(), US), locale, { strict: true });
      expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
      expect(pdf.length).toBeGreaterThan(5_000);
    });
  }

  it("renders a match without rallies, away, in a 4x4 format without rotation", async () => {
    const data = makeData([{ rallies: [], status: "upcoming", lineup: { p1: LINEUP.p1 } }], { usIsHome: false, status: "upcoming", format: { format: "4x4", rotation: false } });
    const pdf = await renderMatchReport(buildMatchReport(data, US), "en", { strict: true });
    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
  });
});

describe("report plurals", () => {
  for (const locale of SUPPORTED_LOCALES) {
    it(`uses the singular for one in ${locale}`, () => {
      const t = reportTranslator(locale, { strict: true });
      expect(t("detail.unplaced", { count: 1 })).not.toBe(t("detail.unplaced", { count: 2 }));
      expect(t("detail.unplaced", { count: 1 })).toMatch(/^1 /);
      if (locale !== "it") expect(t("table.zonePoints", { points: 1, errors: 1 })).not.toBe(t("table.zonePoints", { points: 2, errors: 2 }));
    });
  }

  it("prints 1 pt and 2 pts in English", () => {
    const t = reportTranslator("en", { strict: true });
    expect(t("table.zonePoints", { points: 1, errors: 3 })).toBe("1 pt · 3 err");
    expect(t("table.zonePoints", { points: 2, errors: 1 })).toBe("2 pts · 1 err");
    expect(t("detail.unplaced", { count: 1 })).toBe("1 action without a position");
  });
});
