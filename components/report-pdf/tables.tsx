import type { MatchReportModel } from "@/lib/report/build";
import type { EventImpact } from "@/lib/report/metrics/event-impact";
import type { PlayerLine, PlayerTotals } from "@/lib/report/metrics/players";
import type { RoleLine } from "@/lib/report/metrics/roles";
import type { RowLine } from "@/lib/report/metrics/rows";
import type { ServerLine } from "@/lib/report/metrics/servers";
import { DASH, decimal, homeAway, pct, playerLabel, signed, teamName, type ReportT } from "./format";
import { Table, type Column } from "./table";

const PLAYER_COLUMNS = [
  "aces",
  "serveErrors",
  "kills",
  "attackErrors",
  "blocks",
  "blockErrors",
  "receptionErrors",
  "defenseErrors",
  "points",
  "errors",
  "net",
  "plusMinus",
] as const;

const playerCells = (line: PlayerTotals): string[] => [
  ...[line.aces, line.serveErrors, line.kills, line.attackErrors, line.blocks, line.blockErrors, line.receptionErrors, line.defenseErrors, line.points, line.errors].map(String),
  signed(line.net),
  signed(line.plusMinus),
];

export function PlayerTable({ title, model, players, total, t }: { title?: string; model: MatchReportModel; players: PlayerLine[]; total: PlayerTotals; t: ReportT }) {
  const columns: Column[] = [{ label: t("table.player"), width: 135, align: "left" }, ...PLAYER_COLUMNS.map((key) => ({ label: t(`table.${key}`), width: 33 }))];
  return (
    <Table
      title={title}
      legend={t("detail.legend")}
      columns={columns}
      rows={players.map((line) => [playerLabel(model, line.playerId, t), ...playerCells(line)])}
      footer={[t("table.team"), ...playerCells(total)]}
    />
  );
}

export function ServerTable({
  title,
  model,
  servers,
  t,
  locale,
}: {
  title?: string;
  model: MatchReportModel;
  servers: ServerLine[];
  t: ReportT;
  locale: string;
}) {
  const columns: Column[] = [
    { label: t("table.player"), width: 135, align: "left" },
    ...(["served", "wonOnServe", "breakPct", "longestRun", "turns", "pointsPerTurn", "scoringTurns", "aces", "serveErrors"] as const).map((key) => ({
      label: t(`table.${key}`),
      width: 44,
    })),
  ];
  const rows = servers.map((s) => [
    playerLabel(model, s.playerId, t),
    String(s.served),
    String(s.won),
    pct({ pct: s.breakPct }),
    String(s.longestRun),
    String(s.turns),
    decimal(s.pointsPerTurn, locale),
    pct({ pct: s.scoringTurnPct }),
    String(s.aces),
    String(s.serveErrors),
  ]);
  return <Table title={title} legend={t("detail.serversLegend")} columns={columns} rows={rows} />;
}

/** +/- split by the row each player stood in (6x6). */
export function RowTable({ title, model, rows: lines, t }: { title?: string; model: MatchReportModel; rows: RowLine[]; t: ReportT }) {
  const columns: Column[] = [
    { label: t("table.player"), width: 191, align: "left" },
    ...(["front", "frontRallies", "back", "backRallies"] as const).map((key) => ({ label: t(`table.${key}`), width: 85 })),
  ];
  const rows = lines.map((line) => [
    playerLabel(model, line.playerId, t),
    line.front.rallies === 0 ? DASH : signed(line.front.plusMinus),
    String(line.front.rallies),
    line.back.rallies === 0 ? DASH : signed(line.back.plusMinus),
    String(line.back.rallies),
  ]);
  return <Table title={title} legend={t("detail.byRowHint")} columns={columns} rows={rows} />;
}

export function RoleTable({ title, model, roles, t }: { title?: string; model: MatchReportModel; roles: RoleLine[]; t: ReportT }) {
  const columns: Column[] = [
    { label: t("table.role"), width: 150, align: "left" },
    { label: t("table.points"), width: 60 },
    { label: t("table.errors"), width: 60 },
    { label: t("table.topScorer"), width: 261, align: "left" },
  ];
  const rows = roles.map((r) => [
    t(`roles.${r.role}`),
    String(r.points),
    String(r.errors),
    r.topScorerId ? `${playerLabel(model, r.topScorerId, t)} (${t("summary.points", { count: r.topScorerPoints })})` : DASH,
  ]);
  return <Table title={title} columns={columns} rows={rows} />;
}

/** Every score in the table is home–away. */
export function eventRows(model: MatchReportModel, events: EventImpact[], numbers: Map<string, number>, t: ReportT): string[][] {
  return events.map((e) => {
    const number = numbers.get(e.eventId);
    const label = `${number ? `${number} · ` : ""}${t(`events.${e.type}`)}${e.team ? ` (${teamName(model, e.team)})` : ""}`;
    const players =
      e.type === "substitution" && e.playerInId
        ? t("events.substitutionDetail", { playerIn: playerLabel(model, e.playerInId, t), playerOut: playerLabel(model, e.playerOutId, t) })
        : null;
    return [
      String(e.afterRally),
      homeAway(model, e.score),
      label,
      [players, e.text].filter(Boolean).join(" — "),
      homeAway(model, e.before),
      homeAway(model, e.after),
      e.nextRallyWon === null ? DASH : e.nextRallyWon ? t("set.won") : t("set.lost"),
      e.plusMinus === null ? "" : signed(e.plusMinus),
    ];
  });
}

export function EventTable({ title, model, events, numbers, t }: { title?: string; model: MatchReportModel; events: EventImpact[]; numbers: Map<string, number>; t: ReportT }) {
  const columns: Column[] = [
    { label: t("table.rally"), width: 35 },
    { label: t("table.score"), width: 45 },
    { label: t("table.event"), width: 95, align: "left" },
    { label: t("table.detail"), width: 181, align: "left" },
    { label: t("table.before"), width: 50 },
    { label: t("table.after"), width: 50 },
    { label: t("table.nextRally"), width: 40 },
    { label: t("table.plusMinus"), width: 35 },
  ];
  return <Table title={title} columns={columns} rows={eventRows(model, events, numbers, t)} rowsPerBlock={8} />;
}
