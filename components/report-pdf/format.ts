import type { MatchReportModel } from "@/lib/report/build";
import type { Side, Tally } from "@/lib/report/types";

export type ReportT = (key: string, values?: Record<string, string | number>) => string;

export const DASH = "–";
export const pct = (value: { pct: number | null }) => (value.pct === null ? DASH : `${value.pct}%`);
export const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : "0");

export function playerLabel(model: MatchReportModel, id: string | null | undefined, t: ReportT): string {
  if (!id) return DASH;
  const member = model.members[id];
  if (!member) return t("unknownPlayer");
  return member.number !== null ? `#${member.number} ${member.name}` : member.name;
}

/** "25–21" in home–away order. */
export const homeAway = (model: MatchReportModel, score: Tally) =>
  model.usIsHome ? `${score.us}–${score.them}` : `${score.them}–${score.us}`;

export const teamName = (model: MatchReportModel, side: Side) => (side === "us" ? model.us.name : model.them.name);

export const homeTeam = (model: MatchReportModel) => (model.usIsHome ? model.us : model.them);
export const awayTeam = (model: MatchReportModel) => (model.usIsHome ? model.them : model.us);

export const formatDate = (iso: string, locale: string) => new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(new Date(iso));
