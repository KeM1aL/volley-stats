# Match PDF Report Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the client-side screenshot PDF export with a server-generated, redesigned match report (`GET /api/v1/matches/[id]/report`) that only team members and club owners/admins can download.

**Architecture:** Pure metric functions in `lib/report/metrics/` turn the match's rows into a `MatchReportModel` (`lib/report/build.ts`). `@react-pdf/renderer` components in `components/report-pdf/` draw that model, with translations from a new `report` namespace. A Node.js route handler authenticates the caller with the anon key plus their own session (never the service role), checks membership, loads the rows, and returns the PDF with an `ETag`. The stats page fetches it and saves the file.

**Tech Stack:** Next.js 16 route handlers, `@react-pdf/renderer` 4.x, next-intl `createTranslator`, Supabase JS / `@supabase/ssr`, Vitest 5 (`tests/unit/**/*.test.ts`, node environment), Playwright.

**Spec:** [docs/superpowers/specs/2026-10-09-pdf-report-design.md](../specs/2026-10-09-pdf-report-design.md) (parent: [2026-10-09-mobile-app-decision.md](../specs/2026-10-09-mobile-app-decision.md))

## Global Constraints

- Renderer: `@react-pdf/renderer` 4.x in a `runtime = "nodejs"` route with `maxDuration = 30`. No headless browser.
- Access: signed-in caller who is a `team_members` row of the analysed team (not deleted), the team's creator (`teams.user_id`), or an `owner`/`admin` in `club_members` of the team's club. The Supabase client uses the **anon key and the caller's token, never the service role**.
- Route contract: `GET /api/v1/matches/[id]/report?team=<teamId>&locale=<locale>`. `401` no session, `400` missing team / team not in match, `403` not allowed, `404` match not found, `304` on matching `If-None-Match`, `500` JSON `{ error }` on failure. Headers: `Content-Type: application/pdf`, `Content-Disposition: attachment; filename="…"; filename*=UTF-8''…`, `Cache-Control: private, no-store`, `ETag`.
- No metric depends on `good` / `bad` results (users mostly type rally-ending actions). A rally's origin comes from `scoring_team_id` and `action_team_id` only, never from `result`.
- A ratio with a zero denominator is `null` and prints as "–". No `NaN` / `Infinity` anywhere.
- MVP per stat: success +1, good +0.5, bad 0, error −1, times weight (serve 1, spike 1.2, block 1.5, reception 1, defense 1.2). The stats screen uses the same function.
- Event impact window: 5 rallies before and after, cut at set boundaries.
- Set ending starts when either team reaches `target − 5`; `target` = `point_final_set` for set `2 × sets_to_win − 1`, else `point_by_set`.
- Report text lives in `messages/<locale>/report.json` for `en`, `fr`, `es`, `it`, `pt` (Brazilian Portuguese, like the existing `pt` files). `pnpm i18n:check` must pass.
- Out of scope: tactical insights, per-rotation tables, opponent player stats, logos, making the stats page private, the Capacitor download flow.
- Every commit message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **The managed team plays away.** Scores, set winners, sets won and the "home – away" header must follow the managed team, not `home_score`. Pinned in Task 1 (rally scores) and Task 9 (`buildMatchReport` with `usIsHome: false`).
2. **A soft-deleted row must change the `ETag`.** If deleted rows were left out of `lastModified`, deleting the latest point would serve a stale `304`. Pinned in Task 10 (`lastModified` after `editAsWebsite(..., { _deleted: true })`).
3. **A set created but never played (0 rallies).** No `NaN`, no crash, "no data" on its page. Pinned in Task 9 (empty set report) and Task 12 (render fixture with an empty set).
4. **No session, an invalid Bearer token, or a signed-out browser.** The route must answer `401`, not redirect to `/auth` and not `500`. Pinned in Task 13 (proxy exemption) and Task 14 (e2e with no cookies and with `Bearer not-a-token`).
5. **Two `score_points` with the same `point_number`** (sync can produce them). Rallies are ordered by number then time, and indexes stay 1..n. Pinned in Task 1.

---

## File Structure

```
lib/report/
  types.ts                 MatchReportData, Rally, Side, Tally, WinOrigin, LossOrigin, StatAction
  ratio.ts                 Ratio + ratio()
  metrics/rallies.ts       buildRallies()
  metrics/team.ts          summarizeTeam(), WIN_ORIGINS, LOSS_ORIGINS
  metrics/players.ts       playerLines(), teamTotals()
  metrics/mvp.ts           mvpScores(), mvp()
  metrics/roles.ts         roleLines(), isPointStat(), ROLE_ORDER
  metrics/zones.ts         zoneSummary(), lineupByZone(), ZONES
  metrics/servers.ts       serverLines()
  metrics/score-flow.ts    scoreFlow(), setTarget(), setEnding()
  metrics/event-impact.ts  eventImpacts(), eventSide(), eventText(), IMPACT_WINDOW
  build.ts                 buildMatchReport() + MatchReportModel
  query.ts                 rows(), live()
  load.ts                  loadMatchReportData(), ReportNotFoundError
  access.ts                checkReportAccess()
  can-export.ts            canExportForTeam() (client-side mirror of access.ts)
  caller.ts                getReportCaller() (server only)
  http.ts                  resolveLocale(), reportEtag(), reportFileName(), contentDisposition(), REPORT_VERSION
  download.ts              fileNameFromDisposition(), saveBlob() (browser)
  fonts/                   NotoSans-Regular.ttf, NotoSans-Bold.ttf, OFL.txt
components/report-pdf/
  theme.ts  format.ts  parts.tsx  table.tsx  tables.tsx  court.tsx
  charts/geometry.ts  charts/diff-chart.tsx  charts/timeline.tsx  charts/origin-bars.tsx
  summary-page.tsx  detail-page.tsx  set-page.tsx  match-report.tsx  render.tsx
app/api/v1/matches/[id]/report/route.ts
messages/<locale>/report.json (+ index.ts import)
tests/unit/report/*.test.ts, tests/unit/report/fixtures.ts
```

Modified: `components/matches/stats/mvp-analysis.tsx`, `lib/stats/calculations.ts`, `lib/supabase/middleware.ts`, `next.config.js`, `app/matches/[id]/stats/page.tsx`, `components/matches/stats/{match-overview,score-progression,set-breakdown,player-performance,team-performance}.tsx`, `components/matches/match-score-details.tsx`, `app/matches/[id]/score/page.tsx`, `app/globals.css`, `messages/*/matches.json`, `package.json`, `tests/e2e/06-match-stats.spec.ts`, `.claude/docs/02-architecture.md`, `.claude/docs/07-features.md`, `.claude/docs/capacitor-integration.md`.
Deleted: `lib/pdf/types.ts`, `components/ui/pdf-loading-overlay.tsx`.

Run every Vitest command from the repo root. A single file: `pnpm vitest run tests/unit/report/<file>.test.ts`.

---

### Task 1: Rally model

**Files:**
- Create: `lib/report/types.ts`, `lib/report/ratio.ts`, `lib/report/metrics/rallies.ts`
- Create: `tests/unit/report/fixtures.ts`
- Test: `tests/unit/report/rallies.test.ts`

**Interfaces:**
- Consumes: `Event, Match, MatchFormat, PlayerStat, ScorePoint, Set, Team, TeamMember` from `@/lib/types`.
- Produces: `MatchReportData`, `Rally`, `Side`, `Tally`, `StatAction`, `WinOrigin`, `LossOrigin` (types.ts); `Ratio`, `ratio(made, of)` (ratio.ts); `buildRallies(data, managedTeamId): Rally[]`; test fixtures `makeData`, `rallies`, `stat`, `event`, `at`, `setId`, `members`, `US`, `THEM`, `P`, `LINEUP`, `FORMAT`, `MATCH_ID`.

- [ ] **Step 1: Create the report types**

`lib/report/types.ts`:

```ts
import type { Event, Match, MatchFormat, PlayerStat, ScorePoint, Set, Team, TeamMember } from "@/lib/types";

export type Side = "us" | "them";
export type StatAction = PlayerStat["stat_type"];

/** Raw inputs of a report. Rows marked `_deleted` are already removed (except referenced members). */
export interface MatchReportData {
  match: Match;
  format: MatchFormat;
  homeTeam: Team;
  awayTeam: Team;
  championshipName: string | null;
  /** Members of both teams, including removed members the match still references. */
  members: TeamMember[];
  sets: Set[];
  points: ScorePoint[];
  stats: PlayerStat[];
  events: Event[];
}

/** How a rally won by the managed team ended. */
export type WinOrigin = "ace" | "kill" | "block" | "otherWinner" | "opponentError" | "unspecified";
/** How a rally lost by the managed team ended. */
export type LossOrigin = "ownError" | "opponentWinner";

export interface Tally {
  us: number;
  them: number;
}

/** One rally, from the managed team's point of view. */
export interface Rally {
  setId: string;
  setNumber: number;
  /** Position of the rally in its set, from 1. */
  index: number;
  winner: Side;
  server: Side;
  /** The managed team's server (player in p1) when it serves and the format rotates. */
  serverPlayerId: string | null;
  /** The managed team's players on court before the rally. */
  onCourt: string[];
  /** Score after the rally. */
  score: Tally;
  winOrigin: WinOrigin | null;
  lossOrigin: LossOrigin | null;
  /** The managed team's action that ended the rally, when typed. */
  action: StatAction | null;
  /** Whether the rally has a typed action (`point_type` other than `unknown`). */
  typed: boolean;
  timestamp: string;
}
```

`lib/report/ratio.ts`:

```ts
export interface Ratio {
  made: number;
  of: number;
  /** Rounded percentage, or null when `of` is 0. */
  pct: number | null;
}

export function ratio(made: number, of: number): Ratio {
  return { made, of, pct: of === 0 ? null : Math.round((made / of) * 100) };
}
```

- [ ] **Step 2: Create the test fixtures**

`tests/unit/report/fixtures.ts`:

```ts
import type { PlayerRole } from "@/lib/enums";
import type { MatchReportData } from "@/lib/report/types";
import type { Event, MatchFormat, PlayerStat, ScorePoint, Set, Team, TeamMember } from "@/lib/types";

export const MATCH_ID = "match-1";
export const US = "team-us";
export const THEM = "team-them";
export const P = { a: "p-a", b: "p-b", c: "p-c", d: "p-d", e: "p-e", f: "p-f", g: "p-g" } as const;
export const LINEUP: Set["first_lineup"] = { p1: P.a, p2: P.b, p3: P.c, p4: P.d, p5: P.e, p6: P.f };
const NAMES = ["Alice", "Bea", "Chloé", "Dana", "Emma", "Fanny", "Gina"];

export interface RallySpec {
  winner: "us" | "them";
  /** Team whose action ended the rally (default: the winner). */
  by?: "us" | "them";
  type?: ScorePoint["point_type"];
  player?: string;
  rotation?: ScorePoint["current_rotation"];
  pointNumber?: number;
  /** Seconds after the match start (default: 30 s after the previous rally). */
  at?: number;
}

export interface SetSpec {
  firstServer?: "us" | "them";
  status?: Set["status"];
  rallies: RallySpec[];
  roles?: Record<string, PlayerRole>;
  lineup?: Set["first_lineup"];
}

export interface DataOptions {
  usIsHome?: boolean;
  format?: Partial<MatchFormat>;
  stats?: PlayerStat[];
  events?: Event[];
  status?: string;
  members?: TeamMember[];
}

const T0 = Date.parse("2026-10-01T18:00:00.000Z");
export const at = (seconds: number) => new Date(T0 + seconds * 1000).toISOString();
export const setId = (n: number) => `set-${n}`;

/** "WWL": rallies won, won, lost by the managed team, nothing typed. */
export function rallies(pattern: string): RallySpec[] {
  return [...pattern].map((c) => ({ winner: c === "W" ? "us" : "them" }));
}

export const FORMAT: MatchFormat = {
  id: "fmt-6x6",
  description: null,
  format: "6x6",
  sets_to_win: 3,
  rotation: true,
  point_by_set: 25,
  point_final_set: 15,
  decisive_point: false,
};

export function members(): TeamMember[] {
  return Object.values(P).map((id, i) => ({ id, team_id: US, name: NAMES[i], number: i + 1, position: null, role: "player" }));
}

const team = (id: string, name: string): Team => ({
  id,
  name,
  status: "active",
  club_id: id === US ? "club-1" : null,
  championship_id: null,
  ext_code: null,
  ext_source: null,
  created_at: at(0),
  user_id: id === US ? "owner-1" : null,
});

export function makeData(specs: SetSpec[], options: DataOptions = {}): MatchReportData {
  const usIsHome = options.usIsHome ?? true;
  const teamOf = (side: "us" | "them") => (side === "us" ? US : THEM);
  const sets: Set[] = [];
  const points: ScorePoint[] = [];
  let clock = 0;
  specs.forEach((spec, i) => {
    const sid = setId(i + 1);
    const lineup = spec.lineup ?? LINEUP;
    let us = 0;
    let them = 0;
    spec.rallies.forEach((rally, k) => {
      if (rally.winner === "us") us++;
      else them++;
      clock += 30;
      points.push({
        id: `${sid}-r${k + 1}`,
        match_id: MATCH_ID,
        set_id: sid,
        point_number: rally.pointNumber ?? k + 1,
        player_stat_id: null,
        scoring_team_id: teamOf(rally.winner),
        point_type: rally.type ?? "unknown",
        action_team_id: teamOf(rally.by ?? rally.winner),
        // Like the app: `result` is stored from the managed team's point of view.
        result: rally.winner === "us" ? "success" : "error",
        player_id: rally.player ?? null,
        timestamp: at(rally.at ?? clock),
        home_score: usIsHome ? us : them,
        away_score: usIsHome ? them : us,
        current_rotation: rally.rotation ?? lineup,
      });
    });
    const first = teamOf(spec.firstServer ?? "us");
    sets.push({
      id: sid,
      match_id: MATCH_ID,
      set_number: i + 1,
      home_score: usIsHome ? us : them,
      away_score: usIsHome ? them : us,
      status: spec.status ?? "completed",
      first_server_team_id: first,
      server_team_id: first,
      first_lineup: lineup,
      current_lineup: lineup,
      player_roles: spec.roles ?? {},
    });
    clock += 300;
  });
  const usTeam = team(US, "Volley Club");
  const themTeam = team(THEM, "Les Rivales");
  return {
    match: {
      id: MATCH_ID,
      date: at(0),
      location: "Gymnase Jean Moulin",
      home_team_id: usIsHome ? US : THEM,
      away_team_id: usIsHome ? THEM : US,
      championship_id: "champ-1",
      season_id: null,
      match_format_id: FORMAT.id,
      home_score: null,
      away_score: null,
      status: options.status ?? "completed",
      home_available_players: null,
      away_available_players: null,
      ext_code: null,
      ext_source: null,
      home_total: null,
      away_total: null,
      detailed_scores: null,
    },
    format: { ...FORMAT, ...options.format },
    homeTeam: usIsHome ? usTeam : themTeam,
    awayTeam: usIsHome ? themTeam : usTeam,
    championshipName: "Régionale U18",
    members: options.members ?? members(),
    sets,
    points,
    stats: options.stats ?? [],
    events: options.events ?? [],
  };
}

let statCount = 0;
export function stat(
  set: number,
  player: string,
  type: PlayerStat["stat_type"],
  result: PlayerStat["result"],
  position: PlayerStat["position"] = null
): PlayerStat {
  statCount += 1;
  return { id: `stat-${statCount}`, match_id: MATCH_ID, set_id: setId(set), player_id: player, team_id: US, position, stat_type: type, result };
}

let eventCount = 0;
export function event(set: number | null, type: Event["event_type"], fields: Partial<Event> = {}): Event {
  eventCount += 1;
  return {
    id: `event-${eventCount}`,
    match_id: MATCH_ID,
    set_id: set === null ? null : setId(set),
    team_id: null,
    event_type: type,
    timestamp: at(0),
    team: null,
    player_id: null,
    details: {},
    point_number: null,
    ...fields,
  };
}
```

- [ ] **Step 3: Write the failing tests**

`tests/unit/report/rallies.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildRallies } from "@/lib/report/metrics/rallies";
import { P, US, makeData, rallies } from "./fixtures";

describe("buildRallies", () => {
  it("passes the serve to the winner of each rally", () => {
    const data = makeData([{ firstServer: "us", rallies: rallies("WLLW") }]);
    expect(buildRallies(data, US).map((r) => r.server)).toEqual(["us", "us", "them", "them"]);
  });

  it("names the player in p1 as our server only when we serve and the format rotates", () => {
    const data = makeData([{ firstServer: "us", rallies: rallies("WLL") }]);
    expect(buildRallies(data, US).map((r) => r.serverPlayerId)).toEqual([P.a, P.a, null]);
    const noRotation = makeData([{ firstServer: "us", rallies: rallies("W") }], { format: { rotation: false } });
    expect(buildRallies(noRotation, US)[0].serverPlayerId).toBeNull();
  });

  it("classifies how each rally ended from the scoring and acting teams, never from result", () => {
    const data = makeData([
      {
        rallies: [
          { winner: "us", type: "serve", player: P.a },
          { winner: "us", type: "spike", player: P.b },
          { winner: "us", type: "block", player: P.c },
          { winner: "us", type: "defense", player: P.d },
          { winner: "us", by: "them" },
          { winner: "us" },
          { winner: "them", by: "us", type: "reception", player: P.e },
          { winner: "them", by: "us" },
          { winner: "them" },
        ],
      },
    ]);
    const result = buildRallies(data, US);
    expect(result.map((r) => r.winOrigin)).toEqual(["ace", "kill", "block", "otherWinner", "opponentError", "unspecified", null, null, null]);
    expect(result.map((r) => r.lossOrigin)).toEqual([null, null, null, null, null, null, "ownError", "ownError", "opponentWinner"]);
    expect(result.map((r) => r.action)).toEqual(["serve", "spike", "block", "defense", null, null, "reception", null, null]);
    expect(result.map((r) => r.typed)).toEqual([true, true, true, true, false, false, true, false, false]);
  });

  it("reports the score from the managed team's side when it plays away", () => {
    const data = makeData([{ rallies: rallies("WWL") }], { usIsHome: false });
    expect(buildRallies(data, US).map((r) => r.score)).toEqual([
      { us: 1, them: 0 },
      { us: 2, them: 0 },
      { us: 2, them: 1 },
    ]);
  });

  it("orders sets by number and rallies by point number, then time, with indexes 1..n", () => {
    const data = makeData([
      { rallies: rallies("WL") },
      { rallies: [{ winner: "us", pointNumber: 1, at: 900 }, { winner: "them", pointNumber: 1, at: 899 }] },
    ]);
    data.sets.reverse();
    data.points.reverse();
    expect(buildRallies(data, US).map((r) => [r.setNumber, r.index, r.winner])).toEqual([
      [1, 1, "us"],
      [1, 2, "them"],
      [2, 1, "them"],
      [2, 2, "us"],
    ]);
  });

  it("lists our players on court before the rally", () => {
    const data = makeData([{ rallies: [{ winner: "us", rotation: { p1: P.g, p2: P.b } }] }]);
    expect(buildRallies(data, US)[0].onCourt).toEqual([P.g, P.b]);
  });
});
```

- [ ] **Step 4: Run the tests to verify they fail**

Run: `pnpm vitest run tests/unit/report/rallies.test.ts`
Expected: FAIL, `Failed to resolve import "@/lib/report/metrics/rallies"`.

- [ ] **Step 5: Implement `buildRallies`**

`lib/report/metrics/rallies.ts`:

```ts
import type { MatchReportData, Rally, Side, StatAction, WinOrigin } from "../types";

/**
 * Every rally of the match in order, from the managed team's point of view.
 * The origin comes from `scoring_team_id` and `action_team_id` only: for points entered
 * without a player, the app stores `result` from the managed team's point of view
 * (an opponent error is `action_team_id` = opponent with `result` = success).
 */
export function buildRallies(data: MatchReportData, managedTeamId: string): Rally[] {
  const usIsHome = data.match.home_team_id === managedTeamId;
  const sets = [...data.sets].sort((a, b) => a.set_number - b.set_number);
  const result: Rally[] = [];
  for (const set of sets) {
    const points = data.points
      .filter((point) => point.set_id === set.id)
      .sort((a, b) => a.point_number - b.point_number || Date.parse(a.timestamp) - Date.parse(b.timestamp));
    let server: Side = set.first_server_team_id === managedTeamId ? "us" : "them";
    points.forEach((point, position) => {
      const winner: Side = point.scoring_team_id === managedTeamId ? "us" : "them";
      const actedByUs = point.action_team_id === managedTeamId;
      const typed = point.point_type !== "unknown";
      const action = actedByUs && typed ? (point.point_type as StatAction) : null;
      const rotation = point.current_rotation ?? {};
      result.push({
        setId: set.id,
        setNumber: set.set_number,
        index: position + 1,
        winner,
        server,
        serverPlayerId: server === "us" && data.format.rotation ? (rotation.p1 ?? null) : null,
        onCourt: Object.values(rotation).filter((id): id is string => typeof id === "string" && id.length > 0),
        score: usIsHome ? { us: point.home_score, them: point.away_score } : { us: point.away_score, them: point.home_score },
        winOrigin: winner === "us" ? winOrigin(actedByUs, action) : null,
        lossOrigin: winner === "them" ? (actedByUs ? "ownError" : "opponentWinner") : null,
        action,
        typed,
        timestamp: point.timestamp,
      });
      server = winner;
    });
  }
  return result;
}

function winOrigin(actedByUs: boolean, action: StatAction | null): WinOrigin {
  if (!actedByUs) return "opponentError";
  switch (action) {
    case "serve":
      return "ace";
    case "spike":
      return "kill";
    case "block":
      return "block";
    case "reception":
    case "defense":
      return "otherWinner";
    default:
      return "unspecified";
  }
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `pnpm vitest run tests/unit/report/rallies.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 7: Commit**

```bash
git add lib/report/types.ts lib/report/ratio.ts lib/report/metrics/rallies.ts tests/unit/report/fixtures.ts tests/unit/report/rallies.test.ts
git commit -m "feat(report): rally model from the managed team's point of view

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Team summary (points origin, side-out, break point, coverage)

**Files:**
- Create: `lib/report/metrics/team.ts`
- Test: `tests/unit/report/team.test.ts`

**Interfaces:**
- Consumes: `Rally`, `WinOrigin`, `LossOrigin`, `StatAction` (Task 1), `ratio`, `Ratio` (Task 1).
- Produces: `summarizeTeam(rallies: Rally[]): TeamSummary`; `TeamSummary { rallies; won; lost; wonBy: Record<WinOrigin, number>; lostBy: Record<LossOrigin, number>; ownErrorsByAction: Record<StatAction | "unspecified", number>; sideOut: Ratio; breakPoint: Ratio; coverage: Ratio }`; `WIN_ORIGINS: WinOrigin[]`; `LOSS_ORIGINS: LossOrigin[]`.

- [ ] **Step 1: Write the failing tests**

`tests/unit/report/team.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildRallies } from "@/lib/report/metrics/rallies";
import { summarizeTeam } from "@/lib/report/metrics/team";
import { P, US, makeData, rallies } from "./fixtures";

describe("summarizeTeam", () => {
  it("counts where the points came from", () => {
    const data = makeData([
      {
        rallies: [
          { winner: "us", type: "serve", player: P.a },
          { winner: "us", type: "spike", player: P.b },
          { winner: "us", by: "them" },
          { winner: "us" },
          { winner: "them", by: "us", type: "serve", player: P.a },
          { winner: "them", by: "us" },
          { winner: "them" },
        ],
      },
    ]);
    const summary = summarizeTeam(buildRallies(data, US));
    expect(summary).toMatchObject({ rallies: 7, won: 4, lost: 3 });
    expect(summary.wonBy).toEqual({ ace: 1, kill: 1, block: 0, otherWinner: 0, opponentError: 1, unspecified: 1 });
    expect(summary.lostBy).toEqual({ ownError: 2, opponentWinner: 1 });
    expect(summary.ownErrorsByAction).toEqual({ serve: 1, reception: 0, spike: 0, block: 0, defense: 0, unspecified: 1 });
  });

  it("computes side-out and break-point rates from the serve order", () => {
    // Them serve r1 (we win: side-out), we serve r2 (lost), them serve r3 (won), we serve r4 (lost).
    const data = makeData([{ firstServer: "them", rallies: rallies("WLWL") }]);
    const summary = summarizeTeam(buildRallies(data, US));
    expect(summary.sideOut).toEqual({ made: 2, of: 2, pct: 100 });
    expect(summary.breakPoint).toEqual({ made: 0, of: 2, pct: 0 });
  });

  it("measures how many rallies have a typed action", () => {
    const data = makeData([{ rallies: [{ winner: "us", type: "spike", player: P.b }, ...rallies("WLL")] }]);
    expect(summarizeTeam(buildRallies(data, US)).coverage).toEqual({ made: 1, of: 4, pct: 25 });
  });

  it("returns null rates instead of NaN without rallies", () => {
    const summary = summarizeTeam([]);
    expect(summary.sideOut.pct).toBeNull();
    expect(summary.breakPoint.pct).toBeNull();
    expect(summary.coverage.pct).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run tests/unit/report/team.test.ts`
Expected: FAIL, `Failed to resolve import "@/lib/report/metrics/team"`.

- [ ] **Step 3: Implement `summarizeTeam`**

`lib/report/metrics/team.ts`:

```ts
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm vitest run tests/unit/report/team.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/report/metrics/team.ts tests/unit/report/team.test.ts
git commit -m "feat(report): points origin, side-out, break point and coverage

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Player lines and +/−

**Files:**
- Create: `lib/report/metrics/players.ts`
- Test: `tests/unit/report/players.test.ts`

**Interfaces:**
- Consumes: `Rally` (Task 1), `PlayerStat` from `@/lib/types`.
- Produces: `PlayerTotals { aces; serveErrors; kills; attackErrors; blocks; blockErrors; receptionErrors; defenseErrors; points; errors; net; plusMinus; ralliesOnCourt }` (all `number`); `PlayerLine extends PlayerTotals { playerId: string }`; `playerLines(stats, rallies): PlayerLine[]`; `teamTotals(lines, rallies): PlayerTotals`.

- [ ] **Step 1: Write the failing tests**

`tests/unit/report/players.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { playerLines, teamTotals } from "@/lib/report/metrics/players";
import { buildRallies } from "@/lib/report/metrics/rallies";
import { P, US, makeData, rallies, stat } from "./fixtures";

describe("playerLines", () => {
  const stats = [
    stat(1, P.a, "serve", "success"),
    stat(1, P.a, "serve", "success"),
    stat(1, P.a, "serve", "error"),
    stat(1, P.a, "spike", "success"),
    stat(1, P.a, "reception", "error"),
    stat(1, P.a, "defense", "good"),
    stat(1, P.g, "block", "success"),
  ];
  const data = makeData([{ rallies: rallies("WWL") }], { stats });
  const rallyList = buildRallies(data, US);
  const lines = playerLines(stats, rallyList);
  const lineOf = (id: string) => lines.find((line) => line.playerId === id)!;

  it("counts rally-ending actions and ignores good / bad", () => {
    expect(lineOf(P.a)).toMatchObject({
      aces: 2,
      serveErrors: 1,
      kills: 1,
      attackErrors: 0,
      receptionErrors: 1,
      defenseErrors: 0,
      points: 3,
      errors: 2,
      net: 1,
    });
  });

  it("gives +/- over the rallies a player was on court", () => {
    expect(lineOf(P.a)).toMatchObject({ plusMinus: 1, ralliesOnCourt: 3 });
    expect(lineOf(P.g)).toMatchObject({ blocks: 1, points: 1, plusMinus: 0, ralliesOnCourt: 0 });
  });

  it("lists every player on court, even without stats", () => {
    expect(lines.map((line) => line.playerId).sort()).toEqual([P.a, P.b, P.c, P.d, P.e, P.f, P.g].sort());
  });

  it("totals the team with the team's own +/-", () => {
    expect(teamTotals(lines, rallyList)).toMatchObject({ aces: 2, kills: 1, blocks: 1, points: 4, errors: 2, net: 2, plusMinus: 1, ralliesOnCourt: 3 });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run tests/unit/report/players.test.ts`
Expected: FAIL, `Failed to resolve import "@/lib/report/metrics/players"`.

- [ ] **Step 3: Implement the player lines**

`lib/report/metrics/players.ts`:

```ts
import type { PlayerStat } from "@/lib/types";
import type { Rally } from "../types";

export interface PlayerTotals {
  aces: number;
  serveErrors: number;
  kills: number;
  attackErrors: number;
  blocks: number;
  blockErrors: number;
  receptionErrors: number;
  defenseErrors: number;
  /** Aces + kills + block points. */
  points: number;
  /** Every `error` result. */
  errors: number;
  /** Points − errors. */
  net: number;
  /** Rallies won − lost while on court. */
  plusMinus: number;
  ralliesOnCourt: number;
}

export interface PlayerLine extends PlayerTotals {
  playerId: string;
}

const emptyTotals = (): PlayerTotals => ({
  aces: 0,
  serveErrors: 0,
  kills: 0,
  attackErrors: 0,
  blocks: 0,
  blockErrors: 0,
  receptionErrors: 0,
  defenseErrors: 0,
  points: 0,
  errors: 0,
  net: 0,
  plusMinus: 0,
  ralliesOnCourt: 0,
});

/** One line per player with a stat or on court. `stats` and `rallies` cover the same scope (match or set). */
export function playerLines(stats: PlayerStat[], rallies: Rally[]): PlayerLine[] {
  const lines = new Map<string, PlayerLine>();
  const lineOf = (playerId: string): PlayerLine => {
    let line = lines.get(playerId);
    if (!line) {
      line = { playerId, ...emptyTotals() };
      lines.set(playerId, line);
    }
    return line;
  };
  for (const s of stats) {
    const line = lineOf(s.player_id);
    if (s.result === "success") {
      if (s.stat_type === "serve") line.aces++;
      else if (s.stat_type === "spike") line.kills++;
      else if (s.stat_type === "block") line.blocks++;
    } else if (s.result === "error") {
      line.errors++;
      if (s.stat_type === "serve") line.serveErrors++;
      else if (s.stat_type === "spike") line.attackErrors++;
      else if (s.stat_type === "block") line.blockErrors++;
      else if (s.stat_type === "reception") line.receptionErrors++;
      else line.defenseErrors++;
    }
  }
  for (const rally of rallies) {
    for (const playerId of rally.onCourt) {
      const line = lineOf(playerId);
      line.ralliesOnCourt++;
      line.plusMinus += rally.winner === "us" ? 1 : -1;
    }
  }
  for (const line of lines.values()) {
    line.points = line.aces + line.kills + line.blocks;
    line.net = line.points - line.errors;
  }
  return [...lines.values()];
}

/** Team row: sums of the lines, with the team's rallies won − lost as +/-. */
export function teamTotals(lines: PlayerLine[], rallies: Rally[]): PlayerTotals {
  const total = emptyTotals();
  const keys = Object.keys(total) as (keyof PlayerTotals)[];
  for (const line of lines) for (const key of keys) total[key] += line[key];
  const won = rallies.filter((rally) => rally.winner === "us").length;
  total.plusMinus = won - (rallies.length - won);
  total.ralliesOnCourt = rallies.length;
  return total;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm vitest run tests/unit/report/players.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/report/metrics/players.ts tests/unit/report/players.test.ts
git commit -m "feat(report): player lines with +/- on court

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Shared MVP, used by the stats screen

**Files:**
- Create: `lib/report/metrics/mvp.ts`
- Modify: `components/matches/stats/mvp-analysis.tsx` (whole file)
- Modify: `lib/stats/calculations.ts:1-91` (remove `calculateMVPScore`, `MVPStat`, `calculateStatScore`, the unused `zod` import)
- Test: `tests/unit/report/mvp.test.ts`

**Interfaces:**
- Consumes: `PlayerStat` from `@/lib/types`, `StatAction` (Task 1).
- Produces: `MvpResult { playerId: string; score: number }`; `mvpScores(stats): Map<string, number>`; `mvp(stats): MvpResult | null`.

- [ ] **Step 1: Write the failing tests**

`tests/unit/report/mvp.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { mvp, mvpScores } from "@/lib/report/metrics/mvp";
import { P, stat } from "./fixtures";

describe("mvp", () => {
  it("scores bad as 0, not like good (former bug)", () => {
    expect(mvp([stat(1, P.a, "reception", "bad"), stat(1, P.a, "reception", "bad")])).toBeNull();
    expect(mvpScores([stat(1, P.a, "reception", "good"), stat(1, P.a, "reception", "good")]).get(P.a)).toBe(1);
  });

  it("weights actions and subtracts errors", () => {
    const stats = [
      stat(1, P.a, "serve", "success"),
      stat(1, P.a, "serve", "success"),
      stat(1, P.a, "serve", "error"),
      stat(1, P.b, "spike", "success"),
      stat(1, P.c, "block", "error"),
    ];
    expect(mvpScores(stats)).toEqual(new Map([[P.a, 1], [P.b, 1.2], [P.c, -1.5]]));
    expect(mvp(stats)).toEqual({ playerId: P.b, score: 1.2 });
  });

  it("breaks ties on the lower player id", () => {
    expect(mvp([stat(1, P.b, "serve", "success"), stat(1, P.a, "serve", "success")])).toEqual({ playerId: P.a, score: 1 });
  });

  it("has no MVP without a positive score", () => {
    expect(mvp([])).toBeNull();
    expect(mvp([stat(1, P.a, "spike", "error")])).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run tests/unit/report/mvp.test.ts`
Expected: FAIL, `Failed to resolve import "@/lib/report/metrics/mvp"`.

- [ ] **Step 3: Implement the MVP**

`lib/report/metrics/mvp.ts`:

```ts
import type { PlayerStat } from "@/lib/types";
import type { StatAction } from "../types";

const WEIGHTS: Record<StatAction, number> = { serve: 1, spike: 1.2, block: 1.5, reception: 1, defense: 1.2 };
const BASE: Record<PlayerStat["result"], number> = { success: 1, good: 0.5, bad: 0, error: -1 };

export interface MvpResult {
  playerId: string;
  score: number;
}

/** Sum of base × weight per player, rounded to 2 decimals. */
export function mvpScores(stats: PlayerStat[]): Map<string, number> {
  const scores = new Map<string, number>();
  for (const s of stats) scores.set(s.player_id, (scores.get(s.player_id) ?? 0) + BASE[s.result] * WEIGHTS[s.stat_type]);
  for (const [playerId, score] of scores) scores.set(playerId, Math.round(score * 100) / 100);
  return scores;
}

/** Highest positive score; ties go to the lower player id so the result is stable. */
export function mvp(stats: PlayerStat[]): MvpResult | null {
  let best: MvpResult | null = null;
  for (const [playerId, score] of mvpScores(stats)) {
    if (score <= 0) continue;
    if (!best || score > best.score || (score === best.score && playerId < best.playerId)) best = { playerId, score };
  }
  return best;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm vitest run tests/unit/report/mvp.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Switch the stats screen to the shared MVP**

Replace the whole content of `components/matches/stats/mvp-analysis.tsx` with (same markup, new data source; `isPdfGenerating` stays optional until Task 14 removes its last caller):

```tsx
"use client";

import { useTranslations } from "next-intl";
import { PlayerStat, TeamMember, Set } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { mvp } from "@/lib/report/metrics/mvp";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Trophy } from "lucide-react";

interface MVPCalculatorProps {
  stats: PlayerStat[];
  players: TeamMember[];
  sets: Set[];
  isPdfGenerating?: boolean;
}

const initials = (name: string) =>
  name
    .split(" ")
    .map((n) => n[0])
    .join("");

export function MVPAnalysis({ stats, players, sets }: MVPCalculatorProps) {
  const t = useTranslations("matches");
  const playerById = new Map(players.map((player) => [player.id, player]));
  const matchResult = mvp(stats);
  const matchMVP = matchResult ? playerById.get(matchResult.playerId) : undefined;
  const setMVPs = [...sets]
    .sort((a, b) => a.set_number - b.set_number)
    .flatMap((set) => {
      const result = mvp(stats.filter((s) => s.set_id === set.id));
      const player = result ? playerById.get(result.playerId) : undefined;
      return result && player ? [{ setNumber: set.set_number, player, score: result.score }] : [];
    });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("stats.mvpAnalysis")}</CardTitle>
      </CardHeader>
      <CardContent>
        {matchResult && matchMVP && (
          <div className="space-y-6">
            <div className="flex items-center justify-center p-6 bg-primary/5 rounded-lg">
              <div className="text-center">
                <Avatar className="w-20 h-20 mx-auto mb-4">
                  <AvatarImage src={matchMVP.avatar_url || undefined} />
                  <AvatarFallback>{initials(matchMVP.name)}</AvatarFallback>
                </Avatar>
                <h3 className="text-xl font-bold flex items-center justify-center gap-2">
                  <Trophy className="h-5 w-5 text-yellow-500" />
                  {t("stats.matchMVP")}
                </h3>
                <p className="text-lg font-medium mt-2">{matchMVP.name}</p>
                <p className="text-sm text-muted-foreground mt-1">Score: {matchResult.score.toFixed(2)}</p>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="font-semibold">{t("stats.setMVPs")}</h3>
              {setMVPs.map((setMvp) => (
                <div key={setMvp.setNumber} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-4">
                    <Avatar>
                      <AvatarImage src={setMvp.player.avatar_url || undefined} />
                      <AvatarFallback>{initials(setMvp.player.name)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{setMvp.player.name}</p>
                      <p className="text-sm text-muted-foreground">Set {setMvp.setNumber}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">Score: {setMvp.score.toFixed(2)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 6: Remove the old MVP calculation**

In `lib/stats/calculations.ts`, delete the line `import { string } from 'zod';`, the `interface MVPStat { … }` block, the `export function calculateMVPScore(…) { … }` function and the `function calculateStatScore(…) { … }` function (they run from line 5 to the line before `// Position-based Performance`). Keep every other function. Then remove any name from the first `import` line that is no longer used in the file (check with the type check below).

Run: `pnpm exec tsc --noEmit -p tsconfig.json`
Expected: no error mentioning `calculations.ts` or `mvp-analysis.tsx`. (If `rg calculateMVPScore` finds a caller other than the removed code, switch it to `mvp()` the same way.)

- [ ] **Step 7: Commit**

```bash
git add lib/report/metrics/mvp.ts tests/unit/report/mvp.test.ts components/matches/stats/mvp-analysis.tsx lib/stats/calculations.ts
git commit -m "fix(stats): one MVP formula for the screen and the report; bad no longer scores like good

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Points by role and by court zone

**Files:**
- Create: `lib/report/metrics/roles.ts`, `lib/report/metrics/zones.ts`
- Test: `tests/unit/report/roles-zones.test.ts`

**Interfaces:**
- Consumes: `PlayerStat`, `ScorePoint`, `Set` from `@/lib/types`; `PlayerRole` from `@/lib/enums`.
- Produces: `RoleKey`; `ROLE_ORDER`; `RoleLine { role: RoleKey; points; errors; topScorerId: string | null; topScorerPoints }`; `roleLines(stats, sets): RoleLine[]`; `isPointStat(stat): boolean`; `Zone = "p1" | … | "p6"`; `ZONES: Zone[]`; `ZoneCount { points; errors }`; `ZoneSummary { zones: Record<Zone, ZoneCount>; frontRow: ZoneCount; backRow: ZoneCount; unplaced: number }`; `zoneSummary(stats, points): ZoneSummary`; `lineupByZone(lineup): Partial<Record<Zone, string>>`.

- [ ] **Step 1: Write the failing tests**

`tests/unit/report/roles-zones.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { PlayerRole } from "@/lib/enums";
import { roleLines } from "@/lib/report/metrics/roles";
import { lineupByZone, zoneSummary } from "@/lib/report/metrics/zones";
import { LINEUP, P, makeData, rallies, stat } from "./fixtures";

describe("roleLines", () => {
  it("sums points and errors by the role played in each set, with the top scorer", () => {
    const stats = [
      stat(1, P.d, "spike", "success"),
      stat(1, P.d, "spike", "success"),
      stat(1, P.b, "spike", "success"),
      stat(1, P.b, "spike", "error"),
      stat(1, P.c, "block", "success"),
      stat(1, P.g, "serve", "error"),
      stat(1, P.a, "reception", "good"),
    ];
    const data = makeData([
      { rallies: rallies("W"), roles: { [P.d]: PlayerRole.OUTSIDE_HITTER, [P.b]: PlayerRole.OUTSIDE_HITTER, [P.c]: PlayerRole.MIDDLE_HITTER } },
    ]);
    expect(roleLines(stats, data.sets)).toEqual([
      { role: "outside_hitter", points: 3, errors: 1, topScorerId: P.d, topScorerPoints: 2 },
      { role: "middle_hitter", points: 1, errors: 0, topScorerId: P.c, topScorerPoints: 1 },
      { role: "none", points: 0, errors: 1, topScorerId: null, topScorerPoints: 0 },
    ]);
  });
});

describe("zoneSummary", () => {
  it("uses the stat position, then the player's spot in the rally rotation", () => {
    const placed = stat(1, P.d, "spike", "success", "p4");
    const fromRotation = stat(1, P.b, "spike", "error");
    const libero = stat(1, P.g, "defense", "error");
    const data = makeData([{ rallies: rallies("WL") }]);
    data.points[1].player_stat_id = fromRotation.id;
    const summary = zoneSummary([placed, fromRotation, libero], data.points);
    expect(summary.zones.p4).toEqual({ points: 1, errors: 0 });
    expect(summary.zones.p2).toEqual({ points: 0, errors: 1 });
    expect(summary.frontRow).toEqual({ points: 1, errors: 1 });
    expect(summary.backRow).toEqual({ points: 0, errors: 0 });
    expect(summary.unplaced).toBe(1);
  });

  it("maps a lineup to zones", () => {
    expect(lineupByZone(LINEUP)).toEqual({ p1: P.a, p2: P.b, p3: P.c, p4: P.d, p5: P.e, p6: P.f });
    expect(lineupByZone(null)).toEqual({});
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run tests/unit/report/roles-zones.test.ts`
Expected: FAIL, `Failed to resolve import "@/lib/report/metrics/roles"`.

- [ ] **Step 3: Implement `roles.ts`**

`lib/report/metrics/roles.ts`:

```ts
import type { PlayerRole } from "@/lib/enums";
import type { PlayerStat, Set } from "@/lib/types";

export type RoleKey = `${PlayerRole}` | "none";
export const ROLE_ORDER: RoleKey[] = ["outside_hitter", "opposite", "middle_hitter", "setter", "libero", "none"];

export interface RoleLine {
  role: RoleKey;
  points: number;
  errors: number;
  topScorerId: string | null;
  topScorerPoints: number;
}

/** An ace, kill or block point. */
export const isPointStat = (s: PlayerStat): boolean =>
  s.result === "success" && (s.stat_type === "serve" || s.stat_type === "spike" || s.stat_type === "block");

export function roleLines(stats: PlayerStat[], sets: Set[]): RoleLine[] {
  const rolesBySet = new Map(sets.map((set) => [set.id, set.player_roles ?? {}]));
  const byRole = new Map<RoleKey, { points: number; errors: number; scorers: Map<string, number> }>();
  for (const s of stats) {
    const isPoint = isPointStat(s);
    if (!isPoint && s.result !== "error") continue;
    const raw = rolesBySet.get(s.set_id)?.[s.player_id] as string | undefined;
    const role: RoleKey = raw && ROLE_ORDER.includes(raw as RoleKey) ? (raw as RoleKey) : "none";
    const entry = byRole.get(role) ?? { points: 0, errors: 0, scorers: new Map<string, number>() };
    byRole.set(role, entry);
    if (isPoint) {
      entry.points++;
      entry.scorers.set(s.player_id, (entry.scorers.get(s.player_id) ?? 0) + 1);
    } else {
      entry.errors++;
    }
  }
  return ROLE_ORDER.flatMap((role) => {
    const entry = byRole.get(role);
    if (!entry) return [];
    let topScorerId: string | null = null;
    let topScorerPoints = 0;
    for (const [playerId, points] of entry.scorers) {
      if (points > topScorerPoints || (points === topScorerPoints && topScorerId !== null && playerId < topScorerId)) {
        topScorerId = playerId;
        topScorerPoints = points;
      }
    }
    return [{ role, points: entry.points, errors: entry.errors, topScorerId, topScorerPoints }];
  });
}
```

- [ ] **Step 4: Implement `zones.ts`**

`lib/report/metrics/zones.ts`:

```ts
import type { PlayerStat, ScorePoint } from "@/lib/types";
import { isPointStat } from "./roles";

export type Zone = "p1" | "p2" | "p3" | "p4" | "p5" | "p6";
export const ZONES: Zone[] = ["p1", "p2", "p3", "p4", "p5", "p6"];
const FRONT_ROW: Zone[] = ["p2", "p3", "p4"];

export interface ZoneCount {
  points: number;
  errors: number;
}

export interface ZoneSummary {
  zones: Record<Zone, ZoneCount>;
  frontRow: ZoneCount;
  backRow: ZoneCount;
  /** Points and errors with no known position (e.g. the libero). */
  unplaced: number;
}

export function lineupByZone(lineup: Record<string, string | undefined> | null | undefined): Partial<Record<Zone, string>> {
  return Object.fromEntries(ZONES.flatMap((zone) => (lineup?.[zone] ? [[zone, lineup[zone] as string]] : [])));
}

export function zoneSummary(stats: PlayerStat[], points: ScorePoint[]): ZoneSummary {
  const zones = Object.fromEntries(ZONES.map((zone) => [zone, { points: 0, errors: 0 }])) as Record<Zone, ZoneCount>;
  const pointByStat = new Map(points.filter((p) => p.player_stat_id).map((p) => [p.player_stat_id as string, p]));
  let unplaced = 0;
  for (const s of stats) {
    const isPoint = isPointStat(s);
    if (!isPoint && s.result !== "error") continue;
    const zone = (s.position as Zone | null) ?? zoneInRotation(pointByStat.get(s.id), s.player_id);
    if (!zone) {
      unplaced++;
      continue;
    }
    if (isPoint) zones[zone].points++;
    else zones[zone].errors++;
  }
  const sum = (list: Zone[]): ZoneCount =>
    list.reduce((acc, zone) => ({ points: acc.points + zones[zone].points, errors: acc.errors + zones[zone].errors }), { points: 0, errors: 0 });
  return { zones, frontRow: sum(FRONT_ROW), backRow: sum(ZONES.filter((zone) => !FRONT_ROW.includes(zone))), unplaced };
}

function zoneInRotation(point: ScorePoint | undefined, playerId: string): Zone | null {
  if (!point) return null;
  const entry = Object.entries(point.current_rotation ?? {}).find(([, id]) => id === playerId);
  return entry && ZONES.includes(entry[0] as Zone) ? (entry[0] as Zone) : null;
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm vitest run tests/unit/report/roles-zones.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add lib/report/metrics/roles.ts lib/report/metrics/zones.ts tests/unit/report/roles-zones.test.ts
git commit -m "feat(report): points by role and by court zone

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Servers

**Files:**
- Create: `lib/report/metrics/servers.ts`
- Test: `tests/unit/report/servers.test.ts`

**Interfaces:**
- Consumes: `Rally` (Task 1), `PlayerStat`.
- Produces: `ServerLine { playerId: string; served: number; won: number; breakPct: number | null; longestRun: number; aces: number; serveErrors: number }`; `serverLines(rallies, stats): ServerLine[]` (sorted by won desc, then served desc).

- [ ] **Step 1: Write the failing tests**

`tests/unit/report/servers.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildRallies } from "@/lib/report/metrics/rallies";
import { serverLines } from "@/lib/report/metrics/servers";
import { LINEUP, P, US, makeData, rallies, stat } from "./fixtures";

const ROTATED = { p1: P.b, p2: P.c, p3: P.d, p4: P.e, p5: P.f, p6: P.a };

describe("serverLines", () => {
  it("credits each serve to the player in p1, with the longest winning run", () => {
    const data = makeData([
      {
        firstServer: "us",
        rallies: [
          { winner: "us", rotation: LINEUP },
          { winner: "us", rotation: LINEUP },
          { winner: "us", rotation: LINEUP },
          { winner: "them", rotation: LINEUP },
          { winner: "us", rotation: LINEUP }, // they served: side-out
          { winner: "us", rotation: ROTATED },
          { winner: "them", rotation: ROTATED },
        ],
      },
    ]);
    const stats = [stat(1, P.a, "serve", "success"), stat(1, P.a, "serve", "error"), stat(1, P.c, "serve", "success")];
    expect(serverLines(buildRallies(data, US), stats)).toEqual([
      { playerId: P.a, served: 4, won: 3, breakPct: 75, longestRun: 3, aces: 1, serveErrors: 1 },
      { playerId: P.b, served: 2, won: 1, breakPct: 50, longestRun: 1, aces: 0, serveErrors: 0 },
    ]);
  });

  it("does not carry a run across sets", () => {
    const data = makeData([
      { firstServer: "us", rallies: rallies("W") },
      { firstServer: "us", rallies: rallies("W") },
    ]);
    expect(serverLines(buildRallies(data, US), [])).toEqual([
      { playerId: P.a, served: 2, won: 2, breakPct: 100, longestRun: 1, aces: 0, serveErrors: 0 },
    ]);
  });

  it("is empty when the format does not rotate", () => {
    const data = makeData([{ firstServer: "us", rallies: rallies("WW") }], { format: { rotation: false } });
    expect(serverLines(buildRallies(data, US), [])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run tests/unit/report/servers.test.ts`
Expected: FAIL, `Failed to resolve import "@/lib/report/metrics/servers"`.

- [ ] **Step 3: Implement `serverLines`**

`lib/report/metrics/servers.ts`:

```ts
import type { PlayerStat } from "@/lib/types";
import type { Rally } from "../types";

export interface ServerLine {
  playerId: string;
  served: number;
  won: number;
  breakPct: number | null;
  /** Most rallies won in a row while serving, within one set. */
  longestRun: number;
  aces: number;
  serveErrors: number;
}

export function serverLines(rallies: Rally[], stats: PlayerStat[]): ServerLine[] {
  const lines = new Map<string, ServerLine>();
  let runPlayer: string | null = null;
  let runSet: string | null = null;
  let run = 0;
  for (const rally of rallies) {
    const playerId = rally.server === "us" ? rally.serverPlayerId : null;
    if (!playerId) {
      runPlayer = null;
      run = 0;
      continue;
    }
    const line = lines.get(playerId) ?? { playerId, served: 0, won: 0, breakPct: null, longestRun: 0, aces: 0, serveErrors: 0 };
    lines.set(playerId, line);
    line.served++;
    if (rally.winner === "us") {
      line.won++;
      run = runPlayer === playerId && runSet === rally.setId ? run + 1 : 1;
      runPlayer = playerId;
      runSet = rally.setId;
      line.longestRun = Math.max(line.longestRun, run);
    } else {
      runPlayer = null;
      run = 0;
    }
  }
  for (const s of stats) {
    const line = lines.get(s.player_id);
    if (!line || s.stat_type !== "serve") continue;
    if (s.result === "success") line.aces++;
    else if (s.result === "error") line.serveErrors++;
  }
  for (const line of lines.values()) line.breakPct = line.served === 0 ? null : Math.round((line.won / line.served) * 100);
  return [...lines.values()].sort((a, b) => b.won - a.won || b.served - a.served || a.playerId.localeCompare(b.playerId));
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm vitest run tests/unit/report/servers.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/report/metrics/servers.ts tests/unit/report/servers.test.ts
git commit -m "feat(report): server table with break rate and longest serving run

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Score flow and set ending

**Files:**
- Create: `lib/report/metrics/score-flow.ts`
- Test: `tests/unit/report/score-flow.test.ts`

**Interfaces:**
- Consumes: `Rally`, `Side`, `Tally` (Task 1), `MatchFormat`.
- Produces: `ScoreFlow { largestLead: Tally; ties: number; leadChanges: number; longestRun: Tally; deficitOvercome: number }`; `scoreFlow(rallies): ScoreFlow`; `setTarget(setNumber, format): number`; `SetEnding { threshold: number; from: Tally | null; won: Tally }`; `setEnding(rallies, target): SetEnding`.

- [ ] **Step 1: Write the failing tests**

`tests/unit/report/score-flow.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildRallies } from "@/lib/report/metrics/rallies";
import { scoreFlow, setEnding, setTarget } from "@/lib/report/metrics/score-flow";
import { FORMAT, US, makeData, rallies } from "./fixtures";

const ralliesOf = (pattern: string) => buildRallies(makeData([{ rallies: rallies(pattern) }]), US);

describe("scoreFlow", () => {
  it("measures leads, ties, lead changes, runs and the deficit the winner overcame", () => {
    // Scores: 1-0 2-0 2-1 2-2 2-3 3-3 4-3 5-3
    expect(scoreFlow(ralliesOf("WWLLLWWW"))).toEqual({
      largestLead: { us: 2, them: 1 },
      ties: 2,
      leadChanges: 2,
      longestRun: { us: 3, them: 3 },
      deficitOvercome: 1,
    });
  });

  it("is all zeros without rallies", () => {
    expect(scoreFlow([])).toEqual({ largestLead: { us: 0, them: 0 }, ties: 0, leadChanges: 0, longestRun: { us: 0, them: 0 }, deficitOvercome: 0 });
  });
});

describe("setTarget", () => {
  it("uses the final-set target only for the deciding set", () => {
    expect(setTarget(4, FORMAT)).toBe(25);
    expect(setTarget(5, FORMAT)).toBe(15);
    expect(setTarget(3, { ...FORMAT, sets_to_win: 2 })).toBe(15);
  });
});

describe("setEnding", () => {
  it("counts the rallies played after either team reached target - 5", () => {
    const ending = setEnding(ralliesOf(`${"W".repeat(20)}LLW`), 25);
    expect(ending).toEqual({ threshold: 20, from: { us: 20, them: 0 }, won: { us: 1, them: 2 } });
  });

  it("starts at 10 in a 15-point set", () => {
    expect(setEnding(ralliesOf(`${"L".repeat(10)}W`), 15)).toEqual({ threshold: 10, from: { us: 0, them: 10 }, won: { us: 1, them: 0 } });
  });

  it("has no start when the threshold was not reached", () => {
    expect(setEnding(ralliesOf("WWL"), 25)).toEqual({ threshold: 20, from: null, won: { us: 0, them: 0 } });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run tests/unit/report/score-flow.test.ts`
Expected: FAIL, `Failed to resolve import "@/lib/report/metrics/score-flow"`.

- [ ] **Step 3: Implement the score flow**

`lib/report/metrics/score-flow.ts`:

```ts
import type { MatchFormat } from "@/lib/types";
import type { Rally, Side, Tally } from "../types";

export interface ScoreFlow {
  largestLead: Tally;
  /** Times the score was level after a rally. */
  ties: number;
  leadChanges: number;
  longestRun: Tally;
  /** Largest deficit the set's leader at the end came back from. */
  deficitOvercome: number;
}

/** Score flow of one set's rallies. */
export function scoreFlow(rallies: Rally[]): ScoreFlow {
  const largestLead: Tally = { us: 0, them: 0 };
  const longestRun: Tally = { us: 0, them: 0 };
  let ties = 0;
  let leadChanges = 0;
  let leader: Side | null = null;
  let previousWinner: Side | null = null;
  let run = 0;
  for (const rally of rallies) {
    const diff = rally.score.us - rally.score.them;
    largestLead.us = Math.max(largestLead.us, diff);
    largestLead.them = Math.max(largestLead.them, -diff);
    if (diff === 0) {
      ties++;
    } else {
      const now: Side = diff > 0 ? "us" : "them";
      if (leader && leader !== now) leadChanges++;
      leader = now;
    }
    run = rally.winner === previousWinner ? run + 1 : 1;
    previousWinner = rally.winner;
    longestRun[rally.winner] = Math.max(longestRun[rally.winner], run);
  }
  return { largestLead, ties, leadChanges, longestRun, deficitOvercome: deficitOvercome(rallies) };
}

function deficitOvercome(rallies: Rally[]): number {
  const last = rallies.at(-1);
  if (!last || last.score.us === last.score.them) return 0;
  const leader: Side = last.score.us > last.score.them ? "us" : "them";
  return rallies.reduce((max, r) => Math.max(max, leader === "us" ? r.score.them - r.score.us : r.score.us - r.score.them), 0);
}

/** Points needed to win the set: `point_final_set` for the deciding set, else `point_by_set`. */
export function setTarget(setNumber: number, format: Pick<MatchFormat, "sets_to_win" | "point_by_set" | "point_final_set">): number {
  return setNumber === format.sets_to_win * 2 - 1 ? format.point_final_set : format.point_by_set;
}

export interface SetEnding {
  threshold: number;
  /** Score when either team first reached the threshold. */
  from: Tally | null;
  /** Rallies won by each team after that point. */
  won: Tally;
}

export function setEnding(rallies: Rally[], target: number): SetEnding {
  const threshold = Math.max(target - 5, 0);
  const start = rallies.findIndex((r) => Math.max(r.score.us, r.score.them) >= threshold);
  if (start === -1) return { threshold, from: null, won: { us: 0, them: 0 } };
  const won: Tally = { us: 0, them: 0 };
  for (const rally of rallies.slice(start + 1)) won[rally.winner]++;
  return { threshold, from: { ...rallies[start].score }, won };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm vitest run tests/unit/report/score-flow.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/report/metrics/score-flow.ts tests/unit/report/score-flow.test.ts
git commit -m "feat(report): score flow and set ending

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Event impact

**Files:**
- Create: `lib/report/metrics/event-impact.ts`
- Test: `tests/unit/report/event-impact.test.ts`

**Interfaces:**
- Consumes: `Rally`, `Side`, `Tally` (Task 1), `Event`.
- Produces: `IMPACT_WINDOW = 5`; `Window = Tally & { rallies: number }`; `EventImpact { eventId; setId; type: Event["event_type"]; team: Side | null; afterRally: number; score: Tally; before: Window; after: Window; nextRallyWon: boolean | null; playerInId: string | null; playerOutId: string | null; plusMinus: number | null; text: string | null; timestamp: string }`; `eventImpacts(events, rallies, usIsHome, managedTeamId): EventImpact[]`; `eventSide(event, usIsHome, managedTeamId): Side | null`; `eventText(event): string | null`.

Note: `events.point_number` is the number of rallies already played in the set when the event was recorded; substitutions are recorded without it, so they are placed by `timestamp`.

- [ ] **Step 1: Write the failing tests**

`tests/unit/report/event-impact.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run tests/unit/report/event-impact.test.ts`
Expected: FAIL, `Failed to resolve import "@/lib/report/metrics/event-impact"`.

- [ ] **Step 3: Implement the event impact**

`lib/report/metrics/event-impact.ts`:

```ts
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm vitest run tests/unit/report/event-impact.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/report/metrics/event-impact.ts tests/unit/report/event-impact.test.ts
git commit -m "feat(report): event impact over the 5 rallies before and after

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: `buildMatchReport`

**Files:**
- Create: `lib/report/build.ts`
- Test: `tests/unit/report/build.test.ts`

**Interfaces:**
- Consumes: everything from Tasks 1–8.
- Produces (used by Tasks 12–13):

```ts
export interface MemberInfo { name: string; number: number | null }
export interface MatchEventLine { eventId: string; type: EventImpact["type"]; team: Side | null; text: string | null; timestamp: string }
export interface SetReport {
  setId: string; number: number; status: Set["status"]; score: Tally; winner: Side | null; durationMinutes: number | null;
  firstServer: Side; startingSix: Partial<Record<Zone, string>>; target: number; rallies: Rally[]; team: TeamSummary;
  flow: ScoreFlow; ending: SetEnding; events: EventImpact[]; players: PlayerLine[]; total: PlayerTotals;
  servers: ServerLine[] | null; mvp: MvpResult | null;
}
export interface Leaders { topScorers: { playerId: string; points: number }[]; bestServer: ServerLine | null; bestPlusMinus: { playerId: string; plusMinus: number } | null }
export interface MatchReportModel {
  matchId: string; date: string; location: string | null; championship: string | null; completed: boolean;
  us: { id: string; name: string }; them: { id: string; name: string }; usIsHome: boolean;
  format: { format: string; rotation: boolean; sixPlayers: boolean };
  setsWon: Tally; durationMinutes: number | null; team: TeamSummary; players: PlayerLine[]; total: PlayerTotals;
  roles: RoleLine[]; zones: ZoneSummary | null; servers: ServerLine[] | null; mvp: MvpResult | null; leaders: Leaders;
  sets: SetReport[]; matchEvents: MatchEventLine[]; members: Record<string, MemberInfo>;
}
export function buildMatchReport(data: MatchReportData, managedTeamId: string): MatchReportModel
```

- [ ] **Step 1: Write the failing tests**

`tests/unit/report/build.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildMatchReport } from "@/lib/report/build";
import { P, THEM, US, event, makeData, rallies, stat } from "./fixtures";

describe("buildMatchReport", () => {
  it("counts sets won from the managed team's side, also away", () => {
    for (const usIsHome of [true, false]) {
      const data = makeData([{ rallies: rallies("WWW") }, { rallies: rallies("LL") }, { rallies: rallies("W"), status: "live" }], {
        usIsHome,
        status: "live",
      });
      const model = buildMatchReport(data, US);
      expect(model.usIsHome).toBe(usIsHome);
      expect(model.us.name).toBe("Volley Club");
      expect(model.setsWon).toEqual({ us: 1, them: 1 });
      expect(model.sets.map((s) => [s.score, s.winner])).toEqual([
        [{ us: 3, them: 0 }, "us"],
        [{ us: 0, them: 2 }, "them"],
        [{ us: 1, them: 0 }, null],
      ]);
      expect(model.completed).toBe(false);
    }
  });

  it("reports a set that was never played without NaN", () => {
    const model = buildMatchReport(makeData([{ rallies: rallies("WL") }, { rallies: [], status: "upcoming" }]), US);
    const empty = model.sets[1];
    expect(empty).toMatchObject({ rallies: [], durationMinutes: null, winner: null, mvp: null, ending: { from: null } });
    expect(empty.team.sideOut.pct).toBeNull();
    expect(JSON.stringify(model)).not.toMatch(/NaN|Infinity/);
  });

  it("keeps only the managed team's stats and sorts players by number", () => {
    const stats = [stat(1, P.c, "spike", "success"), stat(1, P.a, "serve", "success"), { ...stat(1, "opponent-1", "spike", "success"), team_id: THEM }];
    const model = buildMatchReport(makeData([{ rallies: rallies("WW") }], { stats }), US);
    expect(model.players.map((p) => p.playerId)).toEqual([P.a, P.b, P.c, P.d, P.e, P.f]);
    expect(model.total.points).toBe(2);
    expect(model.leaders.topScorers).toEqual([
      { playerId: P.a, points: 1 },
      { playerId: P.c, points: 1 },
    ]);
    expect(model.mvp).toEqual({ playerId: P.c, score: 1.2 });
  });

  it("drops court zones outside 6x6 and servers without rotation", () => {
    expect(buildMatchReport(makeData([{ rallies: rallies("W") }]), US)).toMatchObject({ zones: expect.any(Object), servers: expect.any(Array) });
    expect(buildMatchReport(makeData([{ rallies: rallies("W") }], { format: { format: "4x4" } }), US).zones).toBeNull();
    const noRotation = buildMatchReport(makeData([{ rallies: rallies("W") }], { format: { rotation: false } }), US);
    expect(noRotation.servers).toBeNull();
    expect(noRotation.sets[0].servers).toBeNull();
  });

  it("splits events into set timelines and match-level events", () => {
    const inSet = event(1, "timeout", { point_number: 1 });
    const outside = event(null, "comment", { details: { text: "Warm-up was short" } });
    const model = buildMatchReport(makeData([{ rallies: rallies("WW") }], { events: [inSet, outside] }), US);
    expect(model.sets[0].events.map((e) => e.eventId)).toEqual([inSet.id]);
    expect(model.matchEvents).toEqual([{ eventId: outside.id, type: "comment", team: null, text: "Warm-up was short", timestamp: outside.timestamp }]);
  });

  it("measures durations from the first to the last rally", () => {
    const model = buildMatchReport(makeData([{ rallies: rallies("WWWW") }]), US);
    expect(model.sets[0].durationMinutes).toBe(2); // 90 s rounded
    expect(model.members[P.c]).toEqual({ name: "Chloé", number: 3 });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run tests/unit/report/build.test.ts`
Expected: FAIL, `Failed to resolve import "@/lib/report/build"`.

- [ ] **Step 3: Implement `buildMatchReport`**

`lib/report/build.ts`:

```ts
import type { Set } from "@/lib/types";
import { eventImpacts, eventSide, eventText, type EventImpact } from "./metrics/event-impact";
import { mvp, type MvpResult } from "./metrics/mvp";
import { playerLines, teamTotals, type PlayerLine, type PlayerTotals } from "./metrics/players";
import { buildRallies } from "./metrics/rallies";
import { roleLines, type RoleLine } from "./metrics/roles";
import { scoreFlow, setEnding, setTarget, type ScoreFlow, type SetEnding } from "./metrics/score-flow";
import { serverLines, type ServerLine } from "./metrics/servers";
import { summarizeTeam, type TeamSummary } from "./metrics/team";
import { lineupByZone, zoneSummary, type Zone, type ZoneSummary } from "./metrics/zones";
import type { MatchReportData, Rally, Side, Tally } from "./types";

export interface MemberInfo {
  name: string;
  number: number | null;
}

export interface MatchEventLine {
  eventId: string;
  type: EventImpact["type"];
  team: Side | null;
  text: string | null;
  timestamp: string;
}

export interface SetReport {
  setId: string;
  number: number;
  status: Set["status"];
  score: Tally;
  winner: Side | null;
  durationMinutes: number | null;
  firstServer: Side;
  startingSix: Partial<Record<Zone, string>>;
  target: number;
  rallies: Rally[];
  team: TeamSummary;
  flow: ScoreFlow;
  ending: SetEnding;
  events: EventImpact[];
  players: PlayerLine[];
  total: PlayerTotals;
  servers: ServerLine[] | null;
  mvp: MvpResult | null;
}

export interface Leaders {
  topScorers: { playerId: string; points: number }[];
  bestServer: ServerLine | null;
  bestPlusMinus: { playerId: string; plusMinus: number } | null;
}

export interface MatchReportModel {
  matchId: string;
  date: string;
  location: string | null;
  championship: string | null;
  completed: boolean;
  us: { id: string; name: string };
  them: { id: string; name: string };
  usIsHome: boolean;
  format: { format: string; rotation: boolean; sixPlayers: boolean };
  setsWon: Tally;
  durationMinutes: number | null;
  team: TeamSummary;
  players: PlayerLine[];
  total: PlayerTotals;
  roles: RoleLine[];
  zones: ZoneSummary | null;
  servers: ServerLine[] | null;
  mvp: MvpResult | null;
  leaders: Leaders;
  sets: SetReport[];
  matchEvents: MatchEventLine[];
  members: Record<string, MemberInfo>;
}

export function buildMatchReport(data: MatchReportData, managedTeamId: string): MatchReportModel {
  const usIsHome = data.match.home_team_id === managedTeamId;
  const usTeam = usIsHome ? data.homeTeam : data.awayTeam;
  const themTeam = usIsHome ? data.awayTeam : data.homeTeam;
  const sixPlayers = data.format.format === "6x6";
  const rallies = buildRallies(data, managedTeamId);
  const stats = data.stats.filter((s) => s.team_id === managedTeamId);
  const members: Record<string, MemberInfo> = Object.fromEntries(
    data.members.map((m) => [m.id, { name: m.name, number: Number.isFinite(m.number) ? m.number : null }])
  );
  const sortPlayers = (lines: PlayerLine[]) =>
    [...lines].sort(
      (a, b) =>
        (members[a.playerId]?.number ?? 999) - (members[b.playerId]?.number ?? 999) ||
        (members[a.playerId]?.name ?? "").localeCompare(members[b.playerId]?.name ?? "") ||
        a.playerId.localeCompare(b.playerId)
    );
  const impacts = eventImpacts(data.events, rallies, usIsHome, managedTeamId);

  const sets = [...data.sets]
    .sort((a, b) => a.set_number - b.set_number)
    .map((set): SetReport => {
      const setRallies = rallies.filter((r) => r.setId === set.id);
      const setStats = stats.filter((s) => s.set_id === set.id);
      const score: Tally = usIsHome ? { us: set.home_score, them: set.away_score } : { us: set.away_score, them: set.home_score };
      const players = sortPlayers(playerLines(setStats, setRallies));
      const target = setTarget(set.set_number, data.format);
      return {
        setId: set.id,
        number: set.set_number,
        status: set.status,
        score,
        winner: set.status === "completed" && score.us !== score.them ? (score.us > score.them ? "us" : "them") : null,
        durationMinutes: duration(setRallies),
        firstServer: set.first_server_team_id === managedTeamId ? "us" : "them",
        startingSix: lineupByZone(set.first_lineup),
        target,
        rallies: setRallies,
        team: summarizeTeam(setRallies),
        flow: scoreFlow(setRallies),
        ending: setEnding(setRallies, target),
        events: impacts.filter((e) => e.setId === set.id),
        players,
        total: teamTotals(players, setRallies),
        servers: data.format.rotation ? serverLines(setRallies, setStats) : null,
        mvp: mvp(setStats),
      };
    });

  const players = sortPlayers(playerLines(stats, rallies));
  const servers = data.format.rotation ? serverLines(rallies, stats) : null;
  return {
    matchId: data.match.id,
    date: data.match.date,
    location: data.match.location,
    championship: data.championshipName,
    completed: data.match.status === "completed",
    us: { id: usTeam.id, name: usTeam.name },
    them: { id: themTeam.id, name: themTeam.name },
    usIsHome,
    format: { format: data.format.format, rotation: data.format.rotation, sixPlayers },
    setsWon: { us: sets.filter((s) => s.winner === "us").length, them: sets.filter((s) => s.winner === "them").length },
    durationMinutes: duration(rallies),
    team: summarizeTeam(rallies),
    players,
    total: teamTotals(players, rallies),
    roles: roleLines(stats, data.sets),
    zones: sixPlayers ? zoneSummary(stats, data.points) : null,
    servers,
    mvp: mvp(stats),
    leaders: leaders(players, servers),
    sets,
    matchEvents: data.events
      .filter((e) => !e.set_id)
      .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp))
      .map((e) => ({ eventId: e.id, type: e.event_type, team: eventSide(e, usIsHome, managedTeamId), text: eventText(e), timestamp: e.timestamp })),
    members,
  };
}

function duration(rallies: Rally[]): number | null {
  if (rallies.length < 2) return null;
  return Math.round((Date.parse(rallies[rallies.length - 1].timestamp) - Date.parse(rallies[0].timestamp)) / 60_000);
}

function leaders(players: PlayerLine[], servers: ServerLine[] | null): Leaders {
  const topScorers = players
    .filter((p) => p.points > 0)
    .sort((a, b) => b.points - a.points || b.net - a.net || a.playerId.localeCompare(b.playerId))
    .slice(0, 3)
    .map((p) => ({ playerId: p.playerId, points: p.points }));
  const bestServer =
    [...(servers ?? [])].filter((s) => s.won > 0).sort((a, b) => b.longestRun - a.longestRun || (b.breakPct ?? 0) - (a.breakPct ?? 0))[0] ?? null;
  const onCourt = players.filter((p) => p.ralliesOnCourt > 0).sort((a, b) => b.plusMinus - a.plusMinus || a.playerId.localeCompare(b.playerId));
  const bestPlusMinus = onCourt[0] ? { playerId: onCourt[0].playerId, plusMinus: onCourt[0].plusMinus } : null;
  return { topScorers, bestServer, bestPlusMinus };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm vitest run tests/unit/report/build.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/report/build.ts tests/unit/report/build.test.ts
git commit -m "feat(report): assemble the match report model

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Loading and access

**Files:**
- Create: `lib/report/query.ts`, `lib/report/load.ts`, `lib/report/access.ts`, `lib/report/can-export.ts`
- Test: `tests/unit/report/load-access.test.ts`

**Interfaces:**
- Consumes: `MatchReportData` (Task 1); `isoToMicros(value: unknown): number | null` from `@/lib/rxdb/sync/timestamps`; test helper `createFakeServer()` from `tests/unit/helpers/server.ts` (12 tables; `server.seed(table, row)` adds `_deleted: false` and `_modified`; `server.seedAt(table, row, modified)`; `server.editAsWebsite(table, id, patch)` bumps `_modified`; `server.client({ userId })` returns a client with `from().select().eq().in().limit()`).
- Produces: `rows(query): Promise<Row[]>`, `live(rows): Row[]`; `ReportNotFoundError`; `loadMatchReportData(supabase, matchId): Promise<{ data: MatchReportData; lastModified: string }>`; `ReportAccess = "allowed" | "match-not-found" | "team-not-in-match" | "forbidden"`; `checkReportAccess(supabase, userId, matchId, teamId): Promise<ReportAccess>`; `canExportForTeam(user, team): boolean`.

Queries use only `select`, `eq`, `in` (the fake client supports no other filter, and no `.single()`). `_deleted` is filtered in code so that `lastModified` can include deleted rows.

- [ ] **Step 1: Write the failing tests**

`tests/unit/report/load-access.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { checkReportAccess } from "@/lib/report/access";
import { canExportForTeam } from "@/lib/report/can-export";
import { loadMatchReportData, ReportNotFoundError } from "@/lib/report/load";
import type { TeamMember } from "@/lib/types";
import type { FakeSupabaseServer } from "../fakes/fake-supabase";
import { createFakeServer } from "../helpers/server";

const HOME = "team-home";
const AWAY = "team-away";
const MATCH = "match-1";
const OLD = "2026-10-01T10:00:00.000000+00:00";
const NEW = "2026-10-02T10:00:00.000000+00:00";

let server: FakeSupabaseServer;

function seedMatch(): void {
  server.seedAt("match_formats", { id: "fmt", format: "6x6", sets_to_win: 3, rotation: true, point_by_set: 25, point_final_set: 15, decisive_point: false, description: null }, OLD);
  server.seedAt("teams", { id: HOME, name: "Volley Club", status: "active", user_id: "creator", club_id: "club-1" }, OLD);
  server.seedAt("teams", { id: AWAY, name: "Les Rivales", status: "active", user_id: null, club_id: null }, OLD);
  server.seedAt("championships", { id: "champ", name: "Régionale U18" }, OLD);
  server.seedAt("matches", { id: MATCH, date: OLD, home_team_id: HOME, away_team_id: AWAY, match_format_id: "fmt", championship_id: "champ", status: "completed", location: null }, OLD);
  server.seedAt("team_members", { id: "player-1", team_id: HOME, name: "Alice", number: 1, role: "player", user_id: "member" }, OLD);
  server.seedAt("team_members", { id: "player-gone", team_id: HOME, name: "Gone but scored", number: 9, role: "player", _deleted: true }, OLD);
  server.seedAt("team_members", { id: "player-unused", team_id: HOME, name: "Gone", number: 8, role: "player", _deleted: true }, OLD);
  server.seedAt("team_members", { id: "member-deleted", team_id: HOME, name: "Left", number: 7, role: "player", user_id: "left", _deleted: true }, OLD);
  server.seedAt("sets", { id: "set-1", match_id: MATCH, set_number: 1, home_score: 1, away_score: 0, status: "completed", first_server_team_id: HOME, server_team_id: HOME, first_lineup: { p1: "player-1" }, current_lineup: { p1: "player-1" }, player_roles: {} }, OLD);
  server.seedAt("score_points", { id: "point-1", match_id: MATCH, set_id: "set-1", point_number: 1, scoring_team_id: HOME, action_team_id: HOME, point_type: "spike", result: "success", player_id: "player-gone", player_stat_id: null, timestamp: OLD, home_score: 1, away_score: 0, current_rotation: { p1: "player-1" } }, OLD);
  server.seedAt("player_stats", { id: "stat-1", match_id: MATCH, set_id: "set-1", player_id: "player-gone", team_id: HOME, position: "p4", stat_type: "spike", result: "success" }, OLD);
  server.seedAt("player_stats", { id: "stat-deleted", match_id: MATCH, set_id: "set-1", player_id: "player-1", team_id: HOME, position: null, stat_type: "serve", result: "error", _deleted: true }, OLD);
  server.seedAt("events", { id: "event-1", match_id: MATCH, set_id: "set-1", event_type: "timeout", timestamp: OLD, team: "home", details: {} }, OLD);
  server.seedAt("club_members", { id: "cm-owner", club_id: "club-1", user_id: "club-owner", role: "owner" }, OLD);
  server.seedAt("club_members", { id: "cm-admin", club_id: "club-1", user_id: "club-admin", role: "admin" }, OLD);
  server.seedAt("club_members", { id: "cm-member", club_id: "club-1", user_id: "club-member", role: "member" }, OLD);
}

beforeEach(() => {
  server = createFakeServer();
  seedMatch();
});

describe("loadMatchReportData", () => {
  it("loads the match without deleted rows, keeping removed players the match references", async () => {
    const { data } = await loadMatchReportData(server.client(), MATCH);
    expect(data.homeTeam.name).toBe("Volley Club");
    expect(data.championshipName).toBe("Régionale U18");
    expect(data.stats.map((s) => s.id)).toEqual(["stat-1"]);
    expect(data.members.map((m) => m.id).sort()).toEqual(["player-1", "player-gone"]);
    expect(data.sets).toHaveLength(1);
    expect(data.points).toHaveLength(1);
    expect(data.events).toHaveLength(1);
  });

  it("changes lastModified when a row is soft-deleted", async () => {
    const before = (await loadMatchReportData(server.client(), MATCH)).lastModified;
    expect(before).toBe(OLD);
    server.editAsWebsite("score_points", "point-1", { _deleted: true });
    const after = (await loadMatchReportData(server.client(), MATCH)).lastModified;
    expect(after).not.toBe(before);
  });

  it("uses the latest change of any row", async () => {
    server.seedAt("events", { id: "event-2", match_id: MATCH, set_id: null, event_type: "comment", timestamp: NEW, details: {} }, NEW);
    expect((await loadMatchReportData(server.client(), MATCH)).lastModified).toBe(NEW);
  });

  it("throws ReportNotFoundError for an unknown match", async () => {
    await expect(loadMatchReportData(server.client(), "nope")).rejects.toBeInstanceOf(ReportNotFoundError);
  });
});

describe("checkReportAccess", () => {
  const check = (userId: string, teamId = HOME, matchId = MATCH) => checkReportAccess(server.client(), userId, matchId, teamId);

  it("allows team members, the team's creator and club owners/admins", async () => {
    expect(await check("member")).toBe("allowed");
    expect(await check("creator")).toBe("allowed");
    expect(await check("club-owner")).toBe("allowed");
    expect(await check("club-admin")).toBe("allowed");
  });

  it("refuses club members without a role, removed members and strangers", async () => {
    expect(await check("club-member")).toBe("forbidden");
    expect(await check("left")).toBe("forbidden");
    expect(await check("stranger")).toBe("forbidden");
    expect(await check("member", AWAY)).toBe("forbidden");
  });

  it("tells a missing match from a team that did not play it", async () => {
    expect(await check("member", HOME, "nope")).toBe("match-not-found");
    expect(await check("member", "team-other")).toBe("team-not-in-match");
  });
});

describe("canExportForTeam", () => {
  const team = { id: HOME, user_id: "creator", club_id: "club-1" };
  const membership = (fields: Partial<TeamMember> & { _deleted?: boolean } = {}): TeamMember => ({
    id: "tm-1",
    team_id: HOME,
    name: "",
    number: 1,
    position: null,
    role: "player",
    ...fields,
  });

  it("mirrors the server rule on the signed-in user's memberships", () => {
    expect(canExportForTeam(null, team)).toBe(false);
    expect(canExportForTeam({ id: "creator" }, team)).toBe(true);
    expect(canExportForTeam({ id: "member", teamMembers: [membership({})] }, team)).toBe(true);
    expect(canExportForTeam({ id: "member", teamMembers: [membership({ _deleted: true })] }, team)).toBe(false);
    expect(canExportForTeam({ id: "admin", clubMembers: [{ id: "cm", club_id: "club-1", user_id: "admin", role: "admin" }] }, team)).toBe(true);
  });

  it("ignores the club-team entries the profile adds for every club member", () => {
    // lib/api/users.ts adds one entry per club team with id === team_id and the club role.
    const clubEntry = membership({ id: HOME, role: "member" });
    const user = { id: "club-member", teamMembers: [clubEntry], clubMembers: [{ id: "cm", club_id: "club-1", user_id: "club-member", role: "member" as const }] };
    expect(canExportForTeam(user, team)).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run tests/unit/report/load-access.test.ts`
Expected: FAIL, `Failed to resolve import "@/lib/report/access"`.

- [ ] **Step 3: Implement the query helpers**

`lib/report/query.ts`:

```ts
export type Row = Record<string, any>;

interface QueryResult {
  data: unknown;
  error: { message: string } | null;
}

/** Rows of a Supabase query; throws on a query error. */
export async function rows(query: PromiseLike<QueryResult>): Promise<Row[]> {
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data as Row[] | null) ?? [];
}

/** Rows not soft-deleted. */
export const live = (list: Row[]): Row[] => list.filter((row) => row._deleted !== true);
```

- [ ] **Step 4: Implement the loader**

`lib/report/load.ts`:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import { isoToMicros } from "@/lib/rxdb/sync/timestamps";
import type { Event, Match, MatchFormat, PlayerStat, ScorePoint, Set as MatchSet, Team, TeamMember } from "@/lib/types";
import { live, rows, type Row } from "./query";
import type { MatchReportData } from "./types";

export class ReportNotFoundError extends Error {
  constructor() {
    super("matchNotFound");
  }
}

export interface LoadedReport {
  data: MatchReportData;
  /** Latest `_modified` of every row read, deleted ones included (a deletion changes the report). */
  lastModified: string;
}

export async function loadMatchReportData(supabase: SupabaseClient, matchId: string): Promise<LoadedReport> {
  const matchRows = await rows(supabase.from("matches").select("*").eq("id", matchId));
  const match = live(matchRows)[0];
  if (!match) throw new ReportNotFoundError();
  const teamIds = [match.home_team_id, match.away_team_id];
  const [formats, teams, championships, members, sets, points, stats, events] = await Promise.all([
    rows(supabase.from("match_formats").select("*").eq("id", match.match_format_id)),
    rows(supabase.from("teams").select("*").in("id", teamIds)),
    match.championship_id ? rows(supabase.from("championships").select("*").eq("id", match.championship_id)) : Promise.resolve([] as Row[]),
    rows(supabase.from("team_members").select("*").in("team_id", teamIds)),
    rows(supabase.from("sets").select("*").eq("match_id", matchId)),
    rows(supabase.from("score_points").select("*").eq("match_id", matchId)),
    rows(supabase.from("player_stats").select("*").eq("match_id", matchId)),
    rows(supabase.from("events").select("*").eq("match_id", matchId)),
  ]);
  const format = formats[0];
  const homeTeam = teams.find((team) => team.id === match.home_team_id);
  const awayTeam = teams.find((team) => team.id === match.away_team_id);
  if (!format || !homeTeam || !awayTeam) throw new Error("matchDataIncomplete");

  const liveSets = live(sets);
  const livePoints = live(points);
  const liveStats = live(stats);
  const liveEvents = live(events);
  const referenced = referencedPlayerIds(liveSets, livePoints, liveStats, liveEvents);
  const keptMembers = members.filter((member) => member._deleted !== true || referenced.has(member.id));

  return {
    data: {
      match: match as Match,
      format: format as MatchFormat,
      homeTeam: homeTeam as Team,
      awayTeam: awayTeam as Team,
      championshipName: live(championships)[0]?.name ?? null,
      members: keptMembers as TeamMember[],
      sets: liveSets as MatchSet[],
      points: livePoints as ScorePoint[],
      stats: liveStats as PlayerStat[],
      events: liveEvents as Event[],
    },
    lastModified: latestModified([...matchRows, ...formats, ...teams, ...championships, ...members, ...sets, ...points, ...stats, ...events]),
  };
}

function referencedPlayerIds(sets: Row[], points: Row[], stats: Row[], events: Row[]): Set<string> {
  const ids = new Set<string>();
  const add = (value: unknown) => {
    if (typeof value === "string" && value) ids.add(value);
  };
  for (const set of sets) {
    Object.values(set.first_lineup ?? {}).forEach(add);
    Object.values(set.current_lineup ?? {}).forEach(add);
    Object.keys(set.player_roles ?? {}).forEach(add);
  }
  for (const point of points) {
    add(point.player_id);
    Object.values(point.current_rotation ?? {}).forEach(add);
  }
  for (const stat of stats) add(stat.player_id);
  for (const event of events) {
    add(event.player_id);
    add(event.details?.player_in_id);
    add(event.details?.player_out_id);
  }
  return ids;
}

function latestModified(list: Row[]): string {
  let best: { micros: number; value: string } | null = null;
  for (const row of list) {
    const micros = isoToMicros(row._modified);
    if (micros !== null && (!best || micros > best.micros)) best = { micros, value: row._modified };
  }
  return best?.value ?? "";
}
```

Note: PostgREST returns at most 1000 rows per request; a match has far fewer score points or stats (5 sets × ~50 rallies), so no paging is needed.

- [ ] **Step 5: Implement the access check**

`lib/report/access.ts`:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import { live, rows } from "./query";

export type ReportAccess = "allowed" | "match-not-found" | "team-not-in-match" | "forbidden";

/**
 * Whether `userId` may export the report of `matchId` analysed for `teamId`: a member of the team,
 * its creator, or an owner/admin of its club. Runs with the caller's own client, before any match data is read.
 */
export async function checkReportAccess(supabase: SupabaseClient, userId: string, matchId: string, teamId: string): Promise<ReportAccess> {
  const match = live(await rows(supabase.from("matches").select("id, home_team_id, away_team_id, _deleted").eq("id", matchId)))[0];
  if (!match) return "match-not-found";
  if (teamId !== match.home_team_id && teamId !== match.away_team_id) return "team-not-in-match";

  const memberships = live(await rows(supabase.from("team_members").select("id, _deleted").eq("team_id", teamId).eq("user_id", userId)));
  if (memberships.length > 0) return "allowed";

  const team = live(await rows(supabase.from("teams").select("id, user_id, club_id, _deleted").eq("id", teamId)))[0];
  if (!team) return "forbidden";
  if (team.user_id === userId) return "allowed";
  if (!team.club_id) return "forbidden";

  const clubRoles = live(await rows(supabase.from("club_members").select("role, _deleted").eq("club_id", team.club_id).eq("user_id", userId)));
  return clubRoles.some((member) => member.role === "owner" || member.role === "admin") ? "allowed" : "forbidden";
}
```

- [ ] **Step 6: Implement the client-side mirror**

`lib/report/can-export.ts`:

```ts
import type { ClubMember, Team, TeamMember } from "@/lib/types";

export interface ExportUser {
  id: string;
  teamMembers?: TeamMember[];
  clubMembers?: ClubMember[];
}

/**
 * Client-side copy of `checkReportAccess`, to show the export button. The route remains the authority.
 * `user.teamMembers` also holds one entry per team of each of the user's clubs (lib/api/users.ts),
 * whose `id` is the team id; those are not team memberships.
 */
export function canExportForTeam(
  user: ExportUser | null | undefined,
  team: Pick<Team, "id" | "user_id" | "club_id"> | null | undefined
): boolean {
  if (!user || !team) return false;
  if (team.user_id === user.id) return true;
  const isMember = (user.teamMembers ?? []).some(
    (m) => m.team_id === team.id && m.id !== m.team_id && (m as { _deleted?: boolean })._deleted !== true
  );
  if (isMember) return true;
  return !!team.club_id && (user.clubMembers ?? []).some((m) => m.club_id === team.club_id && (m.role === "owner" || m.role === "admin"));
}
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `pnpm vitest run tests/unit/report/load-access.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 8: Commit**

```bash
git add lib/report/query.ts lib/report/load.ts lib/report/access.ts lib/report/can-export.ts tests/unit/report/load-access.test.ts
git commit -m "feat(report): load the match rows and check who may export

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Report translations

**Files:**
- Create: `messages/en/report.json`, `messages/fr/report.json`, `messages/es/report.json`, `messages/it/report.json`, `messages/pt/report.json`
- Modify: `messages/{en,fr,es,it,pt}/index.ts` (import and export `report`)

**Interfaces:**
- Produces: the `report` namespace. Keys used by Task 12: `title`, `inProgress`, `noData`, `page`, `unknownPlayer`, `setLabel`, `minutes`, `summary.*`, `origin.*`, `actions.*`, `detail.*`, `table.*`, `roles.*`, `set.*`, `events.*` (exact keys below).

- [ ] **Step 1: Write the English messages**

`messages/en/report.json`:

```json
{
  "title": "Match report",
  "inProgress": "In progress",
  "noData": "No rallies have been recorded yet.",
  "page": "Page {page} / {total}",
  "unknownPlayer": "Unknown player",
  "setLabel": "Set {number}",
  "minutes": "{minutes} min",
  "summary": {
    "duration": "Duration",
    "sideOut": "Side-out",
    "sideOutHint": "Rallies won when receiving",
    "breakPoint": "Break point",
    "breakPointHint": "Rallies won when serving",
    "pointsOrigin": "Where the points came from",
    "won": "Won",
    "lost": "Lost",
    "leaders": "Leaders",
    "topScorers": "Top scorers",
    "bestServer": "Best server",
    "bestServerValue": "{name}: run of {run}, {pct} on serve",
    "bestPlusMinus": "Best +/−",
    "mvp": "MVP",
    "matchMvp": "Match",
    "momentum": "Momentum (score difference, rally by rally)",
    "coverage": "{pct} of rallies have a typed action ({typed} of {total}).",
    "points": "{count, plural, one {# pt} other {# pts}}"
  },
  "origin": {
    "ace": "Aces",
    "kill": "Kills",
    "block": "Blocks",
    "otherWinner": "Other winners",
    "opponentError": "Opponent errors",
    "unspecified": "Unspecified",
    "ownError": "Our errors",
    "opponentWinner": "Opponent points"
  },
  "actions": {
    "serve": "serve",
    "reception": "reception",
    "spike": "attack",
    "block": "block",
    "defense": "defense",
    "unspecified": "unspecified"
  },
  "detail": {
    "title": "Match detail",
    "players": "Players",
    "byRole": "Points by role",
    "byZone": "Points by court zone",
    "frontRow": "Front row",
    "backRow": "Back row",
    "unplaced": "{count} actions without a position",
    "servers": "Servers",
    "matchEvents": "Other events",
    "legend": "Ace: aces · SE: serve errors · Kill: kills · AE: attack errors · Blk: block points · BE: block errors · RE: reception errors · DE: defense errors · Pts: points · Err: errors · Net: points − errors · +/−: rallies won − lost on court"
  },
  "table": {
    "player": "Player",
    "aces": "Ace",
    "serveErrors": "SE",
    "kills": "Kill",
    "attackErrors": "AE",
    "blocks": "Blk",
    "blockErrors": "BE",
    "receptionErrors": "RE",
    "defenseErrors": "DE",
    "points": "Pts",
    "errors": "Err",
    "net": "Net",
    "plusMinus": "+/−",
    "team": "Team",
    "served": "Served",
    "wonOnServe": "Won",
    "breakPct": "Break %",
    "longestRun": "Best run",
    "role": "Role",
    "topScorer": "Top scorer",
    "rally": "Rally",
    "score": "Score",
    "event": "Event",
    "detail": "Detail",
    "before": "5 before",
    "after": "5 after",
    "nextRally": "Next",
    "zonePoints": "{points} pts · {errors} err"
  },
  "roles": {
    "outside_hitter": "Outside hitter",
    "opposite": "Opposite",
    "middle_hitter": "Middle",
    "setter": "Setter",
    "libero": "Libero",
    "none": "No role"
  },
  "set": {
    "winner": "Won by {team}",
    "firstServer": "First serve: {team}",
    "startingSix": "Starting six",
    "timeline": "Timeline",
    "legend": "A ace · K kill · B block · W other winner · E opponent error · e our error · O opponent point · · unspecified · dot: our serve",
    "flow": "Score flow",
    "largestLead": "Largest lead",
    "ties": "Ties",
    "leadChanges": "Lead changes",
    "longestRun": "Longest run",
    "deficitOvercome": "Deficit overcome",
    "ending": "Set ending",
    "endingFrom": "From {score}: {wonUs} rallies won, {wonThem} lost.",
    "endingNotReached": "No team reached {threshold} points.",
    "events": "Events and their impact",
    "noEvents": "No events in this set.",
    "comments": "Comments",
    "won": "won",
    "lost": "lost"
  },
  "events": {
    "substitution": "Substitution",
    "timeout": "Timeout",
    "injury": "Injury",
    "sanction": "Sanction",
    "technical": "Technical issue",
    "comment": "Comment",
    "substitutionDetail": "{playerIn} for {playerOut}"
  }
}
```

- [ ] **Step 2: Write the French messages**

`messages/fr/report.json`:

```json
{
  "title": "Rapport de match",
  "inProgress": "En cours",
  "noData": "Aucun échange n'a encore été enregistré.",
  "page": "Page {page} / {total}",
  "unknownPlayer": "Joueur inconnu",
  "setLabel": "Set {number}",
  "minutes": "{minutes} min",
  "summary": {
    "duration": "Durée",
    "sideOut": "Side-out",
    "sideOutHint": "Échanges gagnés en réception",
    "breakPoint": "Break",
    "breakPointHint": "Échanges gagnés au service",
    "pointsOrigin": "D'où viennent les points",
    "won": "Gagnés",
    "lost": "Perdus",
    "leaders": "Leaders",
    "topScorers": "Meilleurs marqueurs",
    "bestServer": "Meilleur serveur",
    "bestServerValue": "{name} : série de {run}, {pct} au service",
    "bestPlusMinus": "Meilleur +/−",
    "mvp": "MVP",
    "matchMvp": "Match",
    "momentum": "Dynamique (écart au score, échange par échange)",
    "coverage": "{pct} des échanges ont une action saisie ({typed} sur {total}).",
    "points": "{count, plural, one {# pt} other {# pts}}"
  },
  "origin": {
    "ace": "Aces",
    "kill": "Attaques gagnantes",
    "block": "Contres",
    "otherWinner": "Autres points gagnants",
    "opponentError": "Fautes adverses",
    "unspecified": "Non précisé",
    "ownError": "Nos fautes",
    "opponentWinner": "Points adverses"
  },
  "actions": {
    "serve": "service",
    "reception": "réception",
    "spike": "attaque",
    "block": "contre",
    "defense": "défense",
    "unspecified": "non précisé"
  },
  "detail": {
    "title": "Détail du match",
    "players": "Joueurs",
    "byRole": "Points par poste",
    "byZone": "Points par zone",
    "frontRow": "Avant",
    "backRow": "Arrière",
    "unplaced": "{count} actions sans position",
    "servers": "Serveurs",
    "matchEvents": "Autres événements",
    "legend": "Ace : aces · FS : fautes de service · Att : attaques gagnantes · FA : fautes d'attaque · Ctr : points de contre · FC : fautes de contre · FR : fautes de réception · FD : fautes de défense · Pts : points · Ftes : fautes · Net : points − fautes · +/− : échanges gagnés − perdus sur le terrain"
  },
  "table": {
    "player": "Joueur",
    "aces": "Ace",
    "serveErrors": "FS",
    "kills": "Att",
    "attackErrors": "FA",
    "blocks": "Ctr",
    "blockErrors": "FC",
    "receptionErrors": "FR",
    "defenseErrors": "FD",
    "points": "Pts",
    "errors": "Ftes",
    "net": "Net",
    "plusMinus": "+/−",
    "team": "Équipe",
    "served": "Servis",
    "wonOnServe": "Gagnés",
    "breakPct": "Break %",
    "longestRun": "Meilleure série",
    "role": "Poste",
    "topScorer": "Meilleur marqueur",
    "rally": "Éch.",
    "score": "Score",
    "event": "Événement",
    "detail": "Détail",
    "before": "5 avant",
    "after": "5 après",
    "nextRally": "Suivant",
    "zonePoints": "{points} pts · {errors} ftes"
  },
  "roles": {
    "outside_hitter": "Réceptionneur-attaquant",
    "opposite": "Pointu",
    "middle_hitter": "Central",
    "setter": "Passeur",
    "libero": "Libéro",
    "none": "Sans poste"
  },
  "set": {
    "winner": "Gagné par {team}",
    "firstServer": "Premier service : {team}",
    "startingSix": "Six de départ",
    "timeline": "Déroulé",
    "legend": "A ace · K attaque gagnante · B contre · W autre point gagnant · E faute adverse · e notre faute · O point adverse · · non précisé · point : notre service",
    "flow": "Évolution du score",
    "largestLead": "Plus grand écart",
    "ties": "Égalités",
    "leadChanges": "Changements de leader",
    "longestRun": "Plus longue série",
    "deficitOvercome": "Retard comblé",
    "ending": "Fin de set",
    "endingFrom": "À partir de {score} : {wonUs} échanges gagnés, {wonThem} perdus.",
    "endingNotReached": "Aucune équipe n'a atteint {threshold} points.",
    "events": "Événements et leur impact",
    "noEvents": "Aucun événement dans ce set.",
    "comments": "Commentaires",
    "won": "gagné",
    "lost": "perdu"
  },
  "events": {
    "substitution": "Remplacement",
    "timeout": "Temps mort",
    "injury": "Blessure",
    "sanction": "Sanction",
    "technical": "Problème technique",
    "comment": "Commentaire",
    "substitutionDetail": "{playerIn} pour {playerOut}"
  }
}
```

- [ ] **Step 3: Write the Spanish messages**

`messages/es/report.json`:

```json
{
  "title": "Informe del partido",
  "inProgress": "En curso",
  "noData": "Todavía no se ha registrado ningún punto.",
  "page": "Página {page} / {total}",
  "unknownPlayer": "Jugador desconocido",
  "setLabel": "Set {number}",
  "minutes": "{minutes} min",
  "summary": {
    "duration": "Duración",
    "sideOut": "Side-out",
    "sideOutHint": "Puntos ganados en recepción",
    "breakPoint": "Break point",
    "breakPointHint": "Puntos ganados con el saque",
    "pointsOrigin": "De dónde vinieron los puntos",
    "won": "Ganados",
    "lost": "Perdidos",
    "leaders": "Líderes",
    "topScorers": "Máximos anotadores",
    "bestServer": "Mejor sacador",
    "bestServerValue": "{name}: racha de {run}, {pct} con el saque",
    "bestPlusMinus": "Mejor +/−",
    "mvp": "MVP",
    "matchMvp": "Partido",
    "momentum": "Dinámica (diferencia en el marcador, punto a punto)",
    "coverage": "El {pct} de los puntos tiene una acción registrada ({typed} de {total}).",
    "points": "{count, plural, one {# pt} other {# pts}}"
  },
  "origin": {
    "ace": "Aces",
    "kill": "Remates ganadores",
    "block": "Bloqueos",
    "otherWinner": "Otros puntos ganadores",
    "opponentError": "Errores rivales",
    "unspecified": "Sin especificar",
    "ownError": "Nuestros errores",
    "opponentWinner": "Puntos rivales"
  },
  "actions": {
    "serve": "saque",
    "reception": "recepción",
    "spike": "remate",
    "block": "bloqueo",
    "defense": "defensa",
    "unspecified": "sin especificar"
  },
  "detail": {
    "title": "Detalle del partido",
    "players": "Jugadores",
    "byRole": "Puntos por posición",
    "byZone": "Puntos por zona",
    "frontRow": "Zona delantera",
    "backRow": "Zona trasera",
    "unplaced": "{count} acciones sin posición",
    "servers": "Sacadores",
    "matchEvents": "Otros eventos",
    "legend": "Ace: aces · ES: errores de saque · Rem: remates ganadores · ER: errores de remate · Blq: puntos de bloqueo · EB: errores de bloqueo · ERc: errores de recepción · ED: errores de defensa · Pts: puntos · Err: errores · Neto: puntos − errores · +/−: puntos ganados − perdidos en pista"
  },
  "table": {
    "player": "Jugador",
    "aces": "Ace",
    "serveErrors": "ES",
    "kills": "Rem",
    "attackErrors": "ER",
    "blocks": "Blq",
    "blockErrors": "EB",
    "receptionErrors": "ERc",
    "defenseErrors": "ED",
    "points": "Pts",
    "errors": "Err",
    "net": "Neto",
    "plusMinus": "+/−",
    "team": "Equipo",
    "served": "Sacados",
    "wonOnServe": "Ganados",
    "breakPct": "Break %",
    "longestRun": "Mejor racha",
    "role": "Posición",
    "topScorer": "Máximo anotador",
    "rally": "Punto",
    "score": "Marcador",
    "event": "Evento",
    "detail": "Detalle",
    "before": "5 antes",
    "after": "5 después",
    "nextRally": "Siguiente",
    "zonePoints": "{points} pts · {errors} err"
  },
  "roles": {
    "outside_hitter": "Receptor-atacante",
    "opposite": "Opuesto",
    "middle_hitter": "Central",
    "setter": "Colocador",
    "libero": "Líbero",
    "none": "Sin posición"
  },
  "set": {
    "winner": "Ganado por {team}",
    "firstServer": "Primer saque: {team}",
    "startingSix": "Seis inicial",
    "timeline": "Desarrollo",
    "legend": "A ace · K remate ganador · B bloqueo · W otro punto ganador · E error rival · e error nuestro · O punto rival · · sin especificar · punto: nuestro saque",
    "flow": "Evolución del marcador",
    "largestLead": "Mayor ventaja",
    "ties": "Empates",
    "leadChanges": "Cambios de líder",
    "longestRun": "Racha más larga",
    "deficitOvercome": "Desventaja remontada",
    "ending": "Final del set",
    "endingFrom": "Desde {score}: {wonUs} puntos ganados, {wonThem} perdidos.",
    "endingNotReached": "Ningún equipo llegó a {threshold} puntos.",
    "events": "Eventos y su impacto",
    "noEvents": "No hay eventos en este set.",
    "comments": "Comentarios",
    "won": "ganado",
    "lost": "perdido"
  },
  "events": {
    "substitution": "Sustitución",
    "timeout": "Tiempo muerto",
    "injury": "Lesión",
    "sanction": "Sanción",
    "technical": "Problema técnico",
    "comment": "Comentario",
    "substitutionDetail": "{playerIn} por {playerOut}"
  }
}
```

- [ ] **Step 4: Write the Italian messages**

`messages/it/report.json`:

```json
{
  "title": "Report della partita",
  "inProgress": "In corso",
  "noData": "Nessuno scambio è ancora stato registrato.",
  "page": "Pagina {page} / {total}",
  "unknownPlayer": "Giocatore sconosciuto",
  "setLabel": "Set {number}",
  "minutes": "{minutes} min",
  "summary": {
    "duration": "Durata",
    "sideOut": "Cambio palla",
    "sideOutHint": "Scambi vinti in ricezione",
    "breakPoint": "Break point",
    "breakPointHint": "Scambi vinti al servizio",
    "pointsOrigin": "Da dove sono arrivati i punti",
    "won": "Vinti",
    "lost": "Persi",
    "leaders": "Migliori",
    "topScorers": "Migliori marcatori",
    "bestServer": "Miglior battitore",
    "bestServerValue": "{name}: serie di {run}, {pct} al servizio",
    "bestPlusMinus": "Miglior +/−",
    "mvp": "MVP",
    "matchMvp": "Partita",
    "momentum": "Andamento (differenza punteggio, scambio per scambio)",
    "coverage": "Il {pct} degli scambi ha un'azione registrata ({typed} su {total}).",
    "points": "{count, plural, one {# pt} other {# pt}}"
  },
  "origin": {
    "ace": "Ace",
    "kill": "Attacchi vincenti",
    "block": "Muri",
    "otherWinner": "Altri punti vincenti",
    "opponentError": "Errori avversari",
    "unspecified": "Non specificato",
    "ownError": "Nostri errori",
    "opponentWinner": "Punti avversari"
  },
  "actions": {
    "serve": "battuta",
    "reception": "ricezione",
    "spike": "attacco",
    "block": "muro",
    "defense": "difesa",
    "unspecified": "non specificato"
  },
  "detail": {
    "title": "Dettaglio della partita",
    "players": "Giocatori",
    "byRole": "Punti per ruolo",
    "byZone": "Punti per zona",
    "frontRow": "Prima linea",
    "backRow": "Seconda linea",
    "unplaced": "{count} azioni senza posizione",
    "servers": "Battitori",
    "matchEvents": "Altri eventi",
    "legend": "Ace: ace · EB: errori in battuta · Att: attacchi vincenti · EA: errori in attacco · Muro: punti a muro · EM: errori a muro · ER: errori in ricezione · ED: errori in difesa · Pt: punti · Err: errori · Netto: punti − errori · +/−: scambi vinti − persi in campo"
  },
  "table": {
    "player": "Giocatore",
    "aces": "Ace",
    "serveErrors": "EB",
    "kills": "Att",
    "attackErrors": "EA",
    "blocks": "Muro",
    "blockErrors": "EM",
    "receptionErrors": "ER",
    "defenseErrors": "ED",
    "points": "Pt",
    "errors": "Err",
    "net": "Netto",
    "plusMinus": "+/−",
    "team": "Squadra",
    "served": "Battute",
    "wonOnServe": "Vinti",
    "breakPct": "Break %",
    "longestRun": "Serie migliore",
    "role": "Ruolo",
    "topScorer": "Miglior marcatore",
    "rally": "Scambio",
    "score": "Punteggio",
    "event": "Evento",
    "detail": "Dettaglio",
    "before": "5 prima",
    "after": "5 dopo",
    "nextRally": "Successivo",
    "zonePoints": "{points} pt · {errors} err"
  },
  "roles": {
    "outside_hitter": "Schiacciatore",
    "opposite": "Opposto",
    "middle_hitter": "Centrale",
    "setter": "Palleggiatore",
    "libero": "Libero",
    "none": "Senza ruolo"
  },
  "set": {
    "winner": "Vinto da {team}",
    "firstServer": "Prima battuta: {team}",
    "startingSix": "Sestetto iniziale",
    "timeline": "Andamento",
    "legend": "A ace · K attacco vincente · B muro · W altro punto vincente · E errore avversario · e nostro errore · O punto avversario · · non specificato · punto: nostra battuta",
    "flow": "Andamento del punteggio",
    "largestLead": "Vantaggio massimo",
    "ties": "Pareggi",
    "leadChanges": "Cambi di vantaggio",
    "longestRun": "Serie più lunga",
    "deficitOvercome": "Svantaggio recuperato",
    "ending": "Finale del set",
    "endingFrom": "Da {score}: {wonUs} scambi vinti, {wonThem} persi.",
    "endingNotReached": "Nessuna squadra ha raggiunto {threshold} punti.",
    "events": "Eventi e loro impatto",
    "noEvents": "Nessun evento in questo set.",
    "comments": "Commenti",
    "won": "vinto",
    "lost": "perso"
  },
  "events": {
    "substitution": "Sostituzione",
    "timeout": "Time-out",
    "injury": "Infortunio",
    "sanction": "Sanzione",
    "technical": "Problema tecnico",
    "comment": "Commento",
    "substitutionDetail": "{playerIn} per {playerOut}"
  }
}
```

- [ ] **Step 5: Write the Portuguese messages**

`messages/pt/report.json` (Brazilian Portuguese, like the other `pt` files):

```json
{
  "title": "Relatório da partida",
  "inProgress": "Em andamento",
  "noData": "Nenhum rali foi registrado ainda.",
  "page": "Página {page} / {total}",
  "unknownPlayer": "Jogador desconhecido",
  "setLabel": "Set {number}",
  "minutes": "{minutes} min",
  "summary": {
    "duration": "Duração",
    "sideOut": "Side-out",
    "sideOutHint": "Ralis vencidos na recepção",
    "breakPoint": "Break point",
    "breakPointHint": "Ralis vencidos no saque",
    "pointsOrigin": "De onde vieram os pontos",
    "won": "Ganhos",
    "lost": "Perdidos",
    "leaders": "Destaques",
    "topScorers": "Maiores pontuadores",
    "bestServer": "Melhor sacador",
    "bestServerValue": "{name}: sequência de {run}, {pct} no saque",
    "bestPlusMinus": "Melhor +/−",
    "mvp": "MVP",
    "matchMvp": "Partida",
    "momentum": "Dinâmica (diferença no placar, rali a rali)",
    "coverage": "{pct} dos ralis têm uma ação registrada ({typed} de {total}).",
    "points": "{count, plural, one {# pt} other {# pts}}"
  },
  "origin": {
    "ace": "Aces",
    "kill": "Ataques vencedores",
    "block": "Bloqueios",
    "otherWinner": "Outros pontos vencedores",
    "opponentError": "Erros do adversário",
    "unspecified": "Não especificado",
    "ownError": "Nossos erros",
    "opponentWinner": "Pontos do adversário"
  },
  "actions": {
    "serve": "saque",
    "reception": "recepção",
    "spike": "ataque",
    "block": "bloqueio",
    "defense": "defesa",
    "unspecified": "não especificado"
  },
  "detail": {
    "title": "Detalhes da partida",
    "players": "Jogadores",
    "byRole": "Pontos por posição",
    "byZone": "Pontos por zona",
    "frontRow": "Rede",
    "backRow": "Fundo",
    "unplaced": "{count} ações sem posição",
    "servers": "Sacadores",
    "matchEvents": "Outros eventos",
    "legend": "Ace: aces · ES: erros de saque · Atq: ataques vencedores · EA: erros de ataque · Blq: pontos de bloqueio · EB: erros de bloqueio · ER: erros de recepção · ED: erros de defesa · Pts: pontos · Err: erros · Saldo: pontos − erros · +/−: ralis ganhos − perdidos em quadra"
  },
  "table": {
    "player": "Jogador",
    "aces": "Ace",
    "serveErrors": "ES",
    "kills": "Atq",
    "attackErrors": "EA",
    "blocks": "Blq",
    "blockErrors": "EB",
    "receptionErrors": "ER",
    "defenseErrors": "ED",
    "points": "Pts",
    "errors": "Err",
    "net": "Saldo",
    "plusMinus": "+/−",
    "team": "Equipe",
    "served": "Sacados",
    "wonOnServe": "Ganhos",
    "breakPct": "Break %",
    "longestRun": "Melhor sequência",
    "role": "Posição",
    "topScorer": "Maior pontuador",
    "rally": "Rali",
    "score": "Placar",
    "event": "Evento",
    "detail": "Detalhe",
    "before": "5 antes",
    "after": "5 depois",
    "nextRally": "Seguinte",
    "zonePoints": "{points} pts · {errors} err"
  },
  "roles": {
    "outside_hitter": "Ponteiro",
    "opposite": "Oposto",
    "middle_hitter": "Central",
    "setter": "Levantador",
    "libero": "Líbero",
    "none": "Sem posição"
  },
  "set": {
    "winner": "Vencido por {team}",
    "firstServer": "Primeiro saque: {team}",
    "startingSix": "Seis iniciais",
    "timeline": "Desenrolar",
    "legend": "A ace · K ataque vencedor · B bloqueio · W outro ponto vencedor · E erro do adversário · e nosso erro · O ponto do adversário · · não especificado · ponto: nosso saque",
    "flow": "Evolução do placar",
    "largestLead": "Maior vantagem",
    "ties": "Empates",
    "leadChanges": "Trocas de liderança",
    "longestRun": "Maior sequência",
    "deficitOvercome": "Desvantagem superada",
    "ending": "Final do set",
    "endingFrom": "A partir de {score}: {wonUs} ralis ganhos, {wonThem} perdidos.",
    "endingNotReached": "Nenhuma equipe chegou a {threshold} pontos.",
    "events": "Eventos e seu impacto",
    "noEvents": "Nenhum evento neste set.",
    "comments": "Comentários",
    "won": "ganho",
    "lost": "perdido"
  },
  "events": {
    "substitution": "Substituição",
    "timeout": "Pedido de tempo",
    "injury": "Lesão",
    "sanction": "Sanção",
    "technical": "Problema técnico",
    "comment": "Comentário",
    "substitutionDetail": "{playerIn} no lugar de {playerOut}"
  }
}
```

- [ ] **Step 6: Register the namespace**

In each of `messages/en/index.ts`, `messages/fr/index.ts`, `messages/es/index.ts`, `messages/it/index.ts`, `messages/pt/index.ts`, add after `import sync from './sync.json';`:

```ts
import report from './report.json';
```

and add `report,` after `sync,` in the exported object.

- [ ] **Step 7: Check the translations**

Run: `pnpm i18n:check`
Expected: no missing or invalid keys reported for `report`.

- [ ] **Step 8: Commit**

```bash
git add messages
git commit -m "feat(report): report translations in five languages

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: PDF document

**Files:**
- Modify: `package.json`, `pnpm-lock.yaml` (add `@react-pdf/renderer`)
- Create: `lib/report/fonts/NotoSans-Regular.ttf`, `lib/report/fonts/NotoSans-Bold.ttf`, `lib/report/fonts/OFL.txt`
- Create: `components/report-pdf/theme.ts`, `format.ts`, `parts.tsx`, `table.tsx`, `tables.tsx`, `court.tsx`, `charts/geometry.ts`, `charts/diff-chart.tsx`, `charts/timeline.tsx`, `charts/origin-bars.tsx`, `summary-page.tsx`, `detail-page.tsx`, `set-page.tsx`, `match-report.tsx`, `render.tsx`
- Test: `tests/unit/report/geometry.test.ts`, `tests/unit/report/render.test.ts`

**Interfaces:**
- Consumes: `MatchReportModel`, `SetReport` (Task 9); `EventImpact` (Task 8); `Rally`, `Tally` (Task 1); `Ratio` (Task 1); `ZONES`, `Zone` (Task 5); `WIN_ORIGINS`, `LOSS_ORIGINS`, `TeamSummary` (Task 2); `PlayerLine`, `PlayerTotals` (Task 3); `ServerLine` (Task 6); `RoleLine` (Task 5); `report` messages (Task 11); `Locale` from `@/lib/i18n/config`.
- Produces: `renderMatchReport(model: MatchReportModel, locale: Locale, options?: { strict?: boolean }): Promise<Buffer>`; `reportTranslator(locale, options?): ReportT`; `ReportT = (key: string, values?: Record<string, string | number>) => string`; geometry helpers `diffGeometry`, `rallyLetter`, `eventMarker`, `commentNumbers`.

- [ ] **Step 1: Add the renderer and the fonts**

```bash
pnpm add @react-pdf/renderer@^4.9.0
mkdir -p lib/report/fonts
curl -sSL -o lib/report/fonts/NotoSans-Regular.ttf https://github.com/notofonts/notofonts.github.io/raw/main/fonts/NotoSans/hinted/ttf/NotoSans-Regular.ttf
curl -sSL -o lib/report/fonts/NotoSans-Bold.ttf https://github.com/notofonts/notofonts.github.io/raw/main/fonts/NotoSans/hinted/ttf/NotoSans-Bold.ttf
curl -sSL -o lib/report/fonts/OFL.txt https://raw.githubusercontent.com/notofonts/latin-greek-cyrillic/main/OFL.txt
node -e "for (const f of ['Regular','Bold']) { const b = require('fs').readFileSync('lib/report/fonts/NotoSans-' + f + '.ttf'); if (b.readUInt32BE(0) !== 0x00010000) throw new Error(f + ' is not a TTF'); console.log(f, b.length, 'bytes OK'); }"
```

Expected: `Regular 621572 bytes OK` and `Bold 631484 bytes OK` (sizes may differ slightly if upstream updated; the TTF check must pass). If `pnpm add` reports blocked build scripts, none are needed for `@react-pdf/renderer`; leave `allowBuilds` unchanged.

- [ ] **Step 2: Write the failing geometry tests**

`tests/unit/report/geometry.test.ts`:

```ts
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
```

- [ ] **Step 3: Run the geometry tests to verify they fail**

Run: `pnpm vitest run tests/unit/report/geometry.test.ts`
Expected: FAIL, `Failed to resolve import "@/components/report-pdf/charts/geometry"`.

- [ ] **Step 4: Implement the geometry helpers**

`components/report-pdf/charts/geometry.ts`:

```ts
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
```

- [ ] **Step 5: Run the geometry tests to verify they pass**

Run: `pnpm vitest run tests/unit/report/geometry.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Add the theme and formatting helpers**

`components/report-pdf/theme.ts`:

```ts
import path from "node:path";
import { Font, StyleSheet } from "@react-pdf/renderer";

export const FONT = "NotoSans";
/** A4 width (595 pt) minus the 32 pt side margins. */
export const PAGE_WIDTH = 531;

export const COLORS = {
  us: "#2563eb",
  them: "#dc2626",
  text: "#111827",
  muted: "#6b7280",
  grid: "#e5e7eb",
  zebra: "#f9fafb",
  header: "#f3f4f6",
};

export const ORIGIN_COLORS: Record<string, string> = {
  ace: "#1e3a8a",
  kill: "#2563eb",
  block: "#60a5fa",
  otherWinner: "#93c5fd",
  opponentError: "#a5b4fc",
  unspecified: "#d1d5db",
  ownError: "#dc2626",
  opponentWinner: "#fca5a5",
};

let fontsRegistered = false;

/** Noto Sans covers accents and most scripts in player names. The files are traced into the route (next.config.js). */
export function registerReportFonts(): void {
  if (fontsRegistered) return;
  const dir = path.join(process.cwd(), "lib", "report", "fonts");
  Font.register({
    family: FONT,
    fonts: [
      { src: path.join(dir, "NotoSans-Regular.ttf"), fontWeight: 400 },
      { src: path.join(dir, "NotoSans-Bold.ttf"), fontWeight: 700 },
    ],
  });
  Font.registerHyphenationCallback((word) => [word]);
  fontsRegistered = true;
}

export const styles = StyleSheet.create({
  page: { fontFamily: FONT, fontSize: 8.5, color: COLORS.text, paddingTop: 32, paddingBottom: 40, paddingHorizontal: 32 },
  h1: { fontSize: 18, fontWeight: 700 },
  h2: { fontSize: 11, fontWeight: 700, marginTop: 14, marginBottom: 6 },
  muted: { color: COLORS.muted },
  small: { fontSize: 6.5, color: COLORS.muted, marginTop: 2 },
  bigNumber: { fontSize: 18, fontWeight: 700 },
  row: { flexDirection: "row", gap: 8 },
  card: { flexGrow: 1, flexBasis: 0, padding: 7, borderWidth: 1, borderColor: COLORS.grid, borderRadius: 4 },
  cardTitle: { fontSize: 6.5, color: COLORS.muted, marginBottom: 3, textTransform: "uppercase" },
  footer: {
    position: "absolute",
    bottom: 18,
    left: 32,
    right: 32,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 7,
    color: COLORS.muted,
  },
});
```

`components/report-pdf/format.ts`:

```ts
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
```

`components/report-pdf/parts.tsx`:

```tsx
import { Text, View } from "@react-pdf/renderer";
import type { MatchReportModel } from "@/lib/report/build";
import { awayTeam, formatDate, homeTeam, type ReportT } from "./format";
import { styles } from "./theme";

export function Footer({ model, t, locale }: { model: MatchReportModel; t: ReportT; locale: string }) {
  return (
    <View style={styles.footer} fixed>
      <Text>{`${homeTeam(model).name} – ${awayTeam(model).name} · ${formatDate(model.date, locale)}`}</Text>
      <Text render={({ pageNumber, totalPages }) => t("page", { page: pageNumber, total: totalPages })} />
    </View>
  );
}

export function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{label}</Text>
      <Text style={styles.bigNumber}>{value}</Text>
      {hint ? <Text style={styles.small}>{hint}</Text> : null}
    </View>
  );
}
```

- [ ] **Step 7: Add the tables and the court**

`components/report-pdf/table.tsx`:

```tsx
import { Text, View } from "@react-pdf/renderer";
import { COLORS } from "./theme";

export interface Column {
  label: string;
  width: number;
  align?: "left" | "right" | "center";
}

const ROWS_PER_BLOCK = 24;

/** Rows are drawn in blocks that never split across pages; each block repeats the header. */
export function Table({ columns, rows, footer }: { columns: Column[]; rows: string[][]; footer?: string[] }) {
  const blocks: string[][][] = [];
  for (let i = 0; i < Math.max(rows.length, 1); i += ROWS_PER_BLOCK) blocks.push(rows.slice(i, i + ROWS_PER_BLOCK));
  return (
    <View>
      {blocks.map((block, b) => (
        <View key={b} wrap={false} style={{ marginBottom: 4 }}>
          <Row columns={columns} cells={columns.map((column) => column.label)} header />
          {block.map((cells, i) => (
            <Row key={i} columns={columns} cells={cells} zebra={i % 2 === 1} />
          ))}
          {footer && b === blocks.length - 1 ? <Row columns={columns} cells={footer} header /> : null}
        </View>
      ))}
    </View>
  );
}

function Row({ columns, cells, header = false, zebra = false }: { columns: Column[]; cells: string[]; header?: boolean; zebra?: boolean }) {
  return (
    <View
      style={{
        flexDirection: "row",
        backgroundColor: header ? COLORS.header : zebra ? COLORS.zebra : "#ffffff",
        borderBottomWidth: 0.5,
        borderBottomColor: COLORS.grid,
        paddingVertical: 2,
      }}
    >
      {columns.map((column, i) => (
        <Text key={i} style={{ width: column.width, paddingHorizontal: 2, textAlign: column.align ?? (i === 0 ? "left" : "right"), fontWeight: header ? 700 : 400 }}>
          {cells[i] ?? ""}
        </Text>
      ))}
    </View>
  );
}
```

`components/report-pdf/tables.tsx`:

```tsx
import type { MatchReportModel } from "@/lib/report/build";
import type { EventImpact } from "@/lib/report/metrics/event-impact";
import type { PlayerLine, PlayerTotals } from "@/lib/report/metrics/players";
import type { RoleLine } from "@/lib/report/metrics/roles";
import type { ServerLine } from "@/lib/report/metrics/servers";
import { DASH, homeAway, pct, playerLabel, signed, teamName, type ReportT } from "./format";
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

export function PlayerTable({ model, players, total, t }: { model: MatchReportModel; players: PlayerLine[]; total: PlayerTotals; t: ReportT }) {
  const columns: Column[] = [{ label: t("table.player"), width: 135, align: "left" }, ...PLAYER_COLUMNS.map((key) => ({ label: t(`table.${key}`), width: 33 }))];
  return (
    <Table
      columns={columns}
      rows={players.map((line) => [playerLabel(model, line.playerId, t), ...playerCells(line)])}
      footer={[t("table.team"), ...playerCells(total)]}
    />
  );
}

export function ServerTable({ model, servers, t }: { model: MatchReportModel; servers: ServerLine[]; t: ReportT }) {
  const columns: Column[] = [
    { label: t("table.player"), width: 171, align: "left" },
    { label: t("table.served"), width: 60 },
    { label: t("table.wonOnServe"), width: 60 },
    { label: t("table.breakPct"), width: 60 },
    { label: t("table.longestRun"), width: 60 },
    { label: t("table.aces"), width: 60 },
    { label: t("table.serveErrors"), width: 60 },
  ];
  const rows = servers.map((s) => [
    playerLabel(model, s.playerId, t),
    String(s.served),
    String(s.won),
    pct({ pct: s.breakPct }),
    String(s.longestRun),
    String(s.aces),
    String(s.serveErrors),
  ]);
  return <Table columns={columns} rows={rows} />;
}

export function RoleTable({ model, roles, t }: { model: MatchReportModel; roles: RoleLine[]; t: ReportT }) {
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
  return <Table columns={columns} rows={rows} />;
}

export function EventTable({ model, events, numbers, t }: { model: MatchReportModel; events: EventImpact[]; numbers: Map<string, number>; t: ReportT }) {
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
  const rows = events.map((e) => {
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
      `${e.before.us}–${e.before.them}`,
      `${e.after.us}–${e.after.them}`,
      e.nextRallyWon === null ? DASH : e.nextRallyWon ? t("set.won") : t("set.lost"),
      e.plusMinus === null ? "" : signed(e.plusMinus),
    ];
  });
  return <Table columns={columns} rows={rows} />;
}
```

`components/report-pdf/court.tsx`:

```tsx
import { Text, View } from "@react-pdf/renderer";
import type { Zone } from "@/lib/report/metrics/zones";
import { COLORS } from "./theme";

const LAYOUT: Zone[][] = [
  ["p4", "p3", "p2"],
  ["p5", "p6", "p1"],
];

/** A half court seen from behind the end line, net on top; one cell per position. */
export function Court({ cells, width = 240 }: { cells: Partial<Record<Zone, string>>; width?: number }) {
  return (
    <View style={{ width, borderWidth: 1, borderColor: COLORS.text }}>
      <View style={{ height: 3, backgroundColor: COLORS.text }} />
      {LAYOUT.map((row, r) => (
        <View key={r} style={{ flexDirection: "row", borderTopWidth: r === 0 ? 0 : 0.5, borderTopColor: COLORS.muted }}>
          {row.map((zone, c) => (
            <View key={zone} style={{ width: width / 3, height: 36, padding: 3, borderLeftWidth: c === 0 ? 0 : 0.5, borderLeftColor: COLORS.grid }}>
              <Text style={{ fontSize: 6, color: COLORS.muted }}>{zone.toUpperCase()}</Text>
              <Text style={{ textAlign: "center", marginTop: 3 }}>{cells[zone] ?? ""}</Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}
```

- [ ] **Step 8: Add the charts**

`components/report-pdf/charts/diff-chart.tsx`:

```tsx
import { Line, Path, Rect, Svg } from "@react-pdf/renderer";
import type { Rally } from "@/lib/report/types";
import { COLORS } from "../theme";
import { diffGeometry } from "./geometry";

export function DiffChart({ rallies, width, height }: { rallies: Rally[]; width: number; height: number }) {
  const geometry = diffGeometry(rallies, width, height);
  return (
    <Svg width={width} height={height}>
      {geometry.bars.map((bar, i) => (
        <Rect key={i} x={bar.x} y={bar.y} width={bar.width} height={bar.height} fill={bar.side === "us" ? COLORS.us : COLORS.them} fillOpacity={0.18} />
      ))}
      <Line x1={0} y1={geometry.zeroY} x2={width} y2={geometry.zeroY} stroke={COLORS.grid} strokeWidth={0.5} />
      <Path d={geometry.path} stroke={COLORS.text} strokeWidth={0.8} fill="none" />
    </Svg>
  );
}
```

`components/report-pdf/charts/timeline.tsx`:

Labels are regular `Text` absolutely positioned over the `Svg`: inside an `Svg`, react-pdf's `Text` only accepts SVG presentation attributes (no `fontSize`), per `SVGTextProps` in its type definitions.

```tsx
import { Circle, G, Line, Path, Rect, Svg, Text, View } from "@react-pdf/renderer";
import type { SetReport } from "@/lib/report/build";
import { COLORS, PAGE_WIDTH } from "../theme";
import { commentNumbers, diffGeometry, eventMarker, rallyLetter } from "./geometry";

const MARKER_HEIGHT = 12;
const CHART_HEIGHT = 90;
const STRIP_HEIGHT = 12;
const HEIGHT = MARKER_HEIGHT + CHART_HEIGHT + STRIP_HEIGHT;

/** Score difference per rally, one coloured cell per rally with its ending letter, and the set's events on the same axis. */
export function Timeline({ set, width = PAGE_WIDTH }: { set: SetReport; width?: number }) {
  const geometry = diffGeometry(set.rallies, width, CHART_HEIGHT);
  const numbers = commentNumbers(set.events);
  const stripY = MARKER_HEIGHT + CHART_HEIGHT;
  return (
    <View style={{ position: "relative", width, height: HEIGHT }}>
      <Svg width={width} height={HEIGHT}>
        <G transform={`translate(0, ${MARKER_HEIGHT})`}>
          {geometry.bars.map((bar, i) => (
            <Rect key={i} x={bar.x} y={bar.y} width={bar.width} height={bar.height} fill={bar.side === "us" ? COLORS.us : COLORS.them} fillOpacity={0.18} />
          ))}
          <Line x1={0} y1={geometry.zeroY} x2={width} y2={geometry.zeroY} stroke={COLORS.grid} strokeWidth={0.5} />
          <Path d={geometry.path} stroke={COLORS.text} strokeWidth={0.9} fill="none" />
        </G>
        {set.events.map((event) => {
          const x = event.afterRally * geometry.step;
          return <Line key={event.eventId} x1={x} y1={MARKER_HEIGHT} x2={x} y2={stripY} stroke={COLORS.muted} strokeWidth={0.5} strokeDasharray="2,2" />;
        })}
        {set.rallies.map((rally, i) => (
          <G key={i}>
            <Rect x={i * geometry.step} y={stripY + 1} width={Math.max(geometry.step - 0.4, 0.4)} height={STRIP_HEIGHT - 4} fill={rally.winner === "us" ? COLORS.us : COLORS.them} />
            {rally.server === "us" ? <Circle cx={i * geometry.step + geometry.step / 2} cy={stripY + STRIP_HEIGHT - 1.5} r={0.9} fill={COLORS.us} /> : null}
          </G>
        ))}
      </Svg>
      {set.events.map((event) => (
        <Text key={event.eventId} style={{ position: "absolute", left: Math.max(event.afterRally * geometry.step - 2, 0), top: 0, fontSize: 7 }}>
          {eventMarker(event.type, numbers.get(event.eventId) ?? 0)}
        </Text>
      ))}
      {geometry.step >= 6
        ? set.rallies.map((rally, i) => (
            <Text
              key={i}
              style={{ position: "absolute", left: i * geometry.step, top: stripY + 1.5, width: geometry.step, fontSize: 5, color: "#ffffff", textAlign: "center" }}
            >
              {rallyLetter(rally)}
            </Text>
          ))
        : null}
    </View>
  );
}
```

`components/report-pdf/charts/origin-bars.tsx`:

```tsx
import { Text, View } from "@react-pdf/renderer";
import { LOSS_ORIGINS, WIN_ORIGINS, type TeamSummary } from "@/lib/report/metrics/team";
import type { ReportT } from "../format";
import { ORIGIN_COLORS, PAGE_WIDTH } from "../theme";

const LABEL_WIDTH = 60;
const TOTAL_WIDTH = 30;

/** Two stacked bars (points won, points lost) split by origin, with a legend under each. */
export function OriginBars({ team, t }: { team: TeamSummary; t: ReportT }) {
  const max = Math.max(team.won, team.lost, 1);
  const barWidth = PAGE_WIDTH - LABEL_WIDTH - TOTAL_WIDTH;
  const won = WIN_ORIGINS.map((origin) => [origin, team.wonBy[origin]] as const);
  const lost = LOSS_ORIGINS.map((origin) => [origin, team.lostBy[origin]] as const);
  const ownErrors = Object.entries(team.ownErrorsByAction)
    .filter(([, n]) => n > 0)
    .map(([action, n]) => `${t(`actions.${action}`)} ${n}`)
    .join(" · ");

  const bar = (label: string, total: number, parts: readonly (readonly [string, number])[]) => (
    <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 3 }}>
      <Text style={{ width: LABEL_WIDTH }}>{label}</Text>
      <View style={{ flexDirection: "row", width: barWidth, height: 12 }}>
        {parts
          .filter(([, n]) => n > 0)
          .map(([key, n]) => (
            <View key={key} style={{ width: (n / max) * barWidth, height: 12, backgroundColor: ORIGIN_COLORS[key] }} />
          ))}
      </View>
      <Text style={{ width: TOTAL_WIDTH, textAlign: "right", fontWeight: 700 }}>{total}</Text>
    </View>
  );
  const legend = (parts: readonly (readonly [string, number])[]) => (
    <View style={{ flexDirection: "row", flexWrap: "wrap", marginLeft: LABEL_WIDTH, marginBottom: 6 }}>
      {parts.map(([key, n]) => (
        <View key={key} style={{ flexDirection: "row", alignItems: "center", marginRight: 10, marginBottom: 2 }}>
          <View style={{ width: 7, height: 7, backgroundColor: ORIGIN_COLORS[key], marginRight: 3 }} />
          <Text style={{ fontSize: 7 }}>{`${t(`origin.${key}`)} ${n}`}</Text>
        </View>
      ))}
    </View>
  );

  return (
    <View>
      {bar(t("summary.won"), team.won, won)}
      {legend(won)}
      {bar(t("summary.lost"), team.lost, lost)}
      {legend(lost)}
      {ownErrors ? <Text style={{ fontSize: 7, marginLeft: LABEL_WIDTH }}>{`${t("origin.ownError")}: ${ownErrors}`}</Text> : null}
    </View>
  );
}
```

- [ ] **Step 9: Add the pages and the document**

`components/report-pdf/summary-page.tsx`:

```tsx
import { Page, Text, View } from "@react-pdf/renderer";
import type { MatchReportModel } from "@/lib/report/build";
import { DiffChart } from "./charts/diff-chart";
import { OriginBars } from "./charts/origin-bars";
import { awayTeam, DASH, formatDate, homeAway, homeTeam, pct, playerLabel, signed, type ReportT } from "./format";
import { Footer, Stat } from "./parts";
import { COLORS, PAGE_WIDTH, styles } from "./theme";

export function SummaryPage({ model, t, locale }: { model: MatchReportModel; t: ReportT; locale: string }) {
  const home = homeTeam(model);
  const away = awayTeam(model);
  const setsWon = homeAway(model, model.setsWon);
  const leaders = model.leaders;
  const mvpLines = [
    model.mvp ? `${t("summary.matchMvp")}: ${playerLabel(model, model.mvp.playerId, t)}` : null,
    ...model.sets.map((set) => (set.mvp ? `${t("setLabel", { number: set.number })}: ${playerLabel(model, set.mvp.playerId, t)}` : null)),
  ].filter((line): line is string => line !== null);
  const momentumWidth = (PAGE_WIDTH - 6 * Math.max(model.sets.length - 1, 0)) / Math.max(model.sets.length, 1);

  return (
    <Page size="A4" style={styles.page}>
      <Footer model={model} t={t} locale={locale} />
      <Text style={styles.muted}>{t("title")}</Text>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginTop: 4 }}>
        <Text style={styles.h1}>
          <Text style={{ color: home.id === model.us.id ? COLORS.us : COLORS.text }}>{home.name}</Text>
          {"  –  "}
          <Text style={{ color: away.id === model.us.id ? COLORS.us : COLORS.text }}>{away.name}</Text>
        </Text>
        <Text style={styles.bigNumber}>{setsWon}</Text>
      </View>
      <Text style={styles.muted}>{[formatDate(model.date, locale), model.location, model.championship].filter(Boolean).join(" · ")}</Text>
      {!model.completed ? <Text style={{ color: COLORS.them, fontWeight: 700, marginTop: 2 }}>{t("inProgress")}</Text> : null}
      <Text style={{ marginTop: 6 }}>{model.sets.map((set) => homeAway(model, set.score)).join("    ")}</Text>

      {model.team.rallies === 0 ? (
        <Text style={{ marginTop: 20 }}>{t("noData")}</Text>
      ) : (
        <View>
          <View style={[styles.row, { marginTop: 12 }]}>
            <Stat label={t("summary.sideOut")} value={pct(model.team.sideOut)} hint={t("summary.sideOutHint")} />
            <Stat label={t("summary.breakPoint")} value={pct(model.team.breakPoint)} hint={t("summary.breakPointHint")} />
            <Stat label={t("summary.duration")} value={model.durationMinutes === null ? DASH : t("minutes", { minutes: model.durationMinutes })} />
          </View>

          <Text style={styles.h2}>{t("summary.pointsOrigin")}</Text>
          <OriginBars team={model.team} t={t} />

          <Text style={styles.h2}>{t("summary.leaders")}</Text>
          <View style={styles.row}>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{t("summary.topScorers")}</Text>
              {leaders.topScorers.length === 0 ? (
                <Text>{DASH}</Text>
              ) : (
                leaders.topScorers.map((s) => <Text key={s.playerId}>{`${playerLabel(model, s.playerId, t)} · ${t("summary.points", { count: s.points })}`}</Text>)
              )}
            </View>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{t("summary.bestServer")}</Text>
              <Text>
                {leaders.bestServer
                  ? t("summary.bestServerValue", {
                      name: playerLabel(model, leaders.bestServer.playerId, t),
                      run: leaders.bestServer.longestRun,
                      pct: pct({ pct: leaders.bestServer.breakPct }),
                    })
                  : DASH}
              </Text>
              <Text style={[styles.cardTitle, { marginTop: 6 }]}>{t("summary.bestPlusMinus")}</Text>
              <Text>{leaders.bestPlusMinus ? `${playerLabel(model, leaders.bestPlusMinus.playerId, t)} ${signed(leaders.bestPlusMinus.plusMinus)}` : DASH}</Text>
            </View>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{t("summary.mvp")}</Text>
              {mvpLines.length === 0 ? <Text>{DASH}</Text> : mvpLines.map((line) => <Text key={line}>{line}</Text>)}
            </View>
          </View>

          <Text style={styles.h2}>{t("summary.momentum")}</Text>
          <View style={{ flexDirection: "row", gap: 6 }}>
            {model.sets.map((set) => (
              <View key={set.setId} style={{ width: momentumWidth }}>
                <Text style={{ fontSize: 7 }}>{`${t("setLabel", { number: set.number })} · ${homeAway(model, set.score)}`}</Text>
                <DiffChart rallies={set.rallies} width={momentumWidth} height={40} />
              </View>
            ))}
          </View>

          <Text style={[styles.muted, { marginTop: 10 }]}>
            {t("summary.coverage", { pct: pct(model.team.coverage), typed: model.team.coverage.made, total: model.team.coverage.of })}
          </Text>
        </View>
      )}
    </Page>
  );
}
```

`components/report-pdf/detail-page.tsx`:

```tsx
import { Page, Text, View } from "@react-pdf/renderer";
import type { MatchReportModel } from "@/lib/report/build";
import { ZONES } from "@/lib/report/metrics/zones";
import { Court } from "./court";
import { teamName, type ReportT } from "./format";
import { Footer } from "./parts";
import { PlayerTable, RoleTable, ServerTable } from "./tables";
import { styles } from "./theme";

export function DetailPage({ model, t, locale }: { model: MatchReportModel; t: ReportT; locale: string }) {
  const zones = model.zones;
  return (
    <Page size="A4" style={styles.page}>
      <Footer model={model} t={t} locale={locale} />
      <Text style={styles.h1}>{t("detail.title")}</Text>

      <Text style={styles.h2}>{t("detail.players")}</Text>
      <PlayerTable model={model} players={model.players} total={model.total} t={t} />
      <Text style={styles.small}>{t("detail.legend")}</Text>

      {model.roles.length > 0 ? (
        <View wrap={false}>
          <Text style={styles.h2}>{t("detail.byRole")}</Text>
          <RoleTable model={model} roles={model.roles} t={t} />
        </View>
      ) : null}

      {zones ? (
        <View wrap={false}>
          <Text style={styles.h2}>{t("detail.byZone")}</Text>
          <View style={{ flexDirection: "row", gap: 16, alignItems: "center" }}>
            <Court cells={Object.fromEntries(ZONES.map((zone) => [zone, t("table.zonePoints", { points: zones.zones[zone].points, errors: zones.zones[zone].errors })]))} />
            <View>
              <Text>{`${t("detail.frontRow")}: ${t("table.zonePoints", { points: zones.frontRow.points, errors: zones.frontRow.errors })}`}</Text>
              <Text>{`${t("detail.backRow")}: ${t("table.zonePoints", { points: zones.backRow.points, errors: zones.backRow.errors })}`}</Text>
              {zones.unplaced > 0 ? <Text style={styles.muted}>{t("detail.unplaced", { count: zones.unplaced })}</Text> : null}
            </View>
          </View>
        </View>
      ) : null}

      {model.servers && model.servers.length > 0 ? (
        <View>
          <Text style={styles.h2}>{t("detail.servers")}</Text>
          <ServerTable model={model} servers={model.servers} t={t} />
        </View>
      ) : null}

      {model.matchEvents.length > 0 ? (
        <View>
          <Text style={styles.h2}>{t("detail.matchEvents")}</Text>
          {model.matchEvents.map((e) => (
            <Text key={e.eventId}>{`${t(`events.${e.type}`)}${e.team ? ` (${teamName(model, e.team)})` : ""}${e.text ? ` — ${e.text}` : ""}`}</Text>
          ))}
        </View>
      ) : null}
    </Page>
  );
}
```

`components/report-pdf/set-page.tsx`:

```tsx
import { Page, Text, View } from "@react-pdf/renderer";
import type { MatchReportModel, SetReport } from "@/lib/report/build";
import { ZONES } from "@/lib/report/metrics/zones";
import { commentNumbers } from "./charts/geometry";
import { Timeline } from "./charts/timeline";
import { Court } from "./court";
import { homeAway, playerLabel, teamName, type ReportT } from "./format";
import { Footer, Stat } from "./parts";
import { EventTable, PlayerTable, ServerTable } from "./tables";
import { styles } from "./theme";

export function SetPage({ model, set, t, locale }: { model: MatchReportModel; set: SetReport; t: ReportT; locale: string }) {
  const numbers = commentNumbers(set.events);
  const comments = set.events.filter((e) => e.type === "comment");
  const sides = `${model.us.name} / ${model.them.name}`;
  const status = [
    set.winner ? t("set.winner", { team: teamName(model, set.winner) }) : t("inProgress"),
    set.durationMinutes !== null ? t("minutes", { minutes: set.durationMinutes }) : null,
    t("set.firstServer", { team: teamName(model, set.firstServer) }),
  ].filter(Boolean);

  return (
    <Page size="A4" style={styles.page}>
      <Footer model={model} t={t} locale={locale} />
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" }}>
        <Text style={styles.h1}>{t("setLabel", { number: set.number })}</Text>
        <Text style={styles.bigNumber}>{homeAway(model, set.score)}</Text>
      </View>
      <Text style={styles.muted}>{status.join(" · ")}</Text>

      {model.format.sixPlayers ? (
        <View wrap={false}>
          <Text style={styles.h2}>{t("set.startingSix")}</Text>
          <Court cells={Object.fromEntries(ZONES.map((zone) => [zone, set.startingSix[zone] ? playerLabel(model, set.startingSix[zone], t) : ""]))} />
        </View>
      ) : null}

      <Text style={styles.h2}>{t("set.timeline")}</Text>
      {set.rallies.length === 0 ? (
        <Text>{t("noData")}</Text>
      ) : (
        <View wrap={false}>
          <Timeline set={set} />
          <Text style={styles.small}>{t("set.legend")}</Text>
        </View>
      )}

      <Text style={styles.h2}>{t("set.flow")}</Text>
      <View style={styles.row}>
        <Stat label={t("set.largestLead")} value={`${set.flow.largestLead.us} / ${set.flow.largestLead.them}`} hint={sides} />
        <Stat label={t("set.longestRun")} value={`${set.flow.longestRun.us} / ${set.flow.longestRun.them}`} hint={sides} />
        <Stat label={t("set.ties")} value={String(set.flow.ties)} />
        <Stat label={t("set.leadChanges")} value={String(set.flow.leadChanges)} />
        <Stat label={t("set.deficitOvercome")} value={String(set.flow.deficitOvercome)} />
      </View>
      <Text style={{ marginTop: 6 }}>
        <Text style={{ fontWeight: 700 }}>{`${t("set.ending")}: `}</Text>
        {set.ending.from
          ? t("set.endingFrom", { score: homeAway(model, set.ending.from), wonUs: set.ending.won.us, wonThem: set.ending.won.them })
          : t("set.endingNotReached", { threshold: set.ending.threshold })}
      </Text>

      <Text style={styles.h2}>{t("set.events")}</Text>
      {set.events.length === 0 ? <Text style={styles.muted}>{t("set.noEvents")}</Text> : <EventTable model={model} events={set.events} numbers={numbers} t={t} />}

      <Text style={styles.h2}>{t("detail.players")}</Text>
      <PlayerTable model={model} players={set.players} total={set.total} t={t} />

      {set.servers && set.servers.length > 0 ? (
        <View>
          <Text style={styles.h2}>{t("detail.servers")}</Text>
          <ServerTable model={model} servers={set.servers} t={t} />
        </View>
      ) : null}

      {comments.length > 0 ? (
        <View>
          <Text style={styles.h2}>{t("set.comments")}</Text>
          {comments.map((c) => (
            <Text key={c.eventId}>{`${numbers.get(c.eventId)}. ${homeAway(model, c.score)} — ${c.text ?? ""}`}</Text>
          ))}
        </View>
      ) : null}
    </Page>
  );
}
```

`components/report-pdf/match-report.tsx`:

```tsx
import { Document } from "@react-pdf/renderer";
import type { MatchReportModel } from "@/lib/report/build";
import { DetailPage } from "./detail-page";
import { awayTeam, homeTeam, type ReportT } from "./format";
import { SetPage } from "./set-page";
import { SummaryPage } from "./summary-page";

export function MatchReportDocument({ model, t, locale }: { model: MatchReportModel; t: ReportT; locale: string }) {
  return (
    <Document title={`${t("title")} – ${homeTeam(model).name} – ${awayTeam(model).name}`} language={locale} creator="VolleyStats" producer="VolleyStats">
      <SummaryPage model={model} t={t} locale={locale} />
      <DetailPage model={model} t={t} locale={locale} />
      {model.sets.map((set) => (
        <SetPage key={set.setId} model={model} set={set} t={t} locale={locale} />
      ))}
    </Document>
  );
}
```

`components/report-pdf/render.tsx`:

```tsx
import { renderToBuffer } from "@react-pdf/renderer";
import { createTranslator } from "next-intl";
import type { Locale } from "@/lib/i18n/config";
import type { MatchReportModel } from "@/lib/report/build";
import en from "@/messages/en";
import es from "@/messages/es";
import fr from "@/messages/fr";
import it from "@/messages/it";
import pt from "@/messages/pt";
import type { ReportT } from "./format";
import { MatchReportDocument } from "./match-report";
import { registerReportFonts } from "./theme";

const MESSAGES = { en, es, fr, it, pt };

/** Translator of the `report` namespace. `strict` throws on a missing key or bad argument (tests). */
export function reportTranslator(locale: Locale, options: { strict?: boolean } = {}): ReportT {
  const translate = createTranslator({
    locale,
    messages: MESSAGES[locale] as any,
    namespace: "report" as any,
    onError: options.strict
      ? (error) => {
          throw error;
        }
      : undefined,
  });
  return (key, values) => (translate as unknown as ReportT)(key, values);
}

export async function renderMatchReport(model: MatchReportModel, locale: Locale, options: { strict?: boolean } = {}): Promise<Buffer> {
  registerReportFonts();
  return renderToBuffer(<MatchReportDocument model={model} t={reportTranslator(locale, options)} locale={locale} />);
}
```

- [ ] **Step 10: Write the render test**

`tests/unit/report/render.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { renderMatchReport } from "@/components/report-pdf/render";
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
```

- [ ] **Step 11: Run all report tests**

Run: `pnpm vitest run tests/unit/report`
Expected: PASS. If Vitest fails to import `@react-pdf/renderer` with an ESM/CJS error, add `server: { deps: { inline: ["@react-pdf/renderer"] } }` to the `test` block of `vitest.config.ts` and rerun. If it reports `React is not defined`, add `esbuild: { jsx: "automatic" }` at the top level of `vitest.config.ts`.

- [ ] **Step 12: Look at the PDF once**

Create a throwaway `report-preview.ts` at the repo root:

```ts
import { writeFileSync } from "node:fs";
import { renderMatchReport } from "@/components/report-pdf/render";
import { buildMatchReport } from "@/lib/report/build";
import { P, US, makeData, rallies, stat } from "./tests/unit/report/fixtures";

const data = makeData(
  [{ rallies: rallies("WWLWWLWWWLLWWWWLWLWWWWWWW") }, { rallies: rallies("LLWLWWLWLWWWLWLWWLWWLWWWW") }],
  { stats: [stat(1, P.a, "serve", "success", "p1"), stat(1, P.d, "spike", "success", "p4")] }
);
renderMatchReport(buildMatchReport(data, US), "fr").then((pdf) => {
  writeFileSync("report-preview.pdf", pdf);
  console.log("report-preview.pdf written");
});
```

Run: `pnpm exec tsx report-preview.ts`, then open `report-preview.pdf` and check: summary on page 1, match detail on page 2, one page per set, accents render, the timeline letters fit their cells, nothing overflows the right margin. Fix spacing in the components if needed (rerun the tests after any change). Delete `report-preview.ts` and `report-preview.pdf`; do not commit them.

- [ ] **Step 13: Type check and lint**

Run: `pnpm exec tsc --noEmit -p tsconfig.json && pnpm lint`
Expected: no errors in `components/report-pdf/` or `lib/report/`.

- [ ] **Step 14: Commit**

```bash
git add package.json pnpm-lock.yaml lib/report/fonts components/report-pdf tests/unit/report/geometry.test.ts tests/unit/report/render.test.ts vitest.config.ts
git commit -m "feat(report): PDF document with @react-pdf/renderer and Noto Sans

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: Report route

**Files:**
- Create: `lib/report/http.ts`, `lib/report/caller.ts`, `lib/report/download.ts`, `app/api/v1/matches/[id]/report/route.ts`
- Modify: `lib/supabase/middleware.ts` (redirect condition, around line 73), `next.config.js`
- Test: `tests/unit/report/http.test.ts`

**Interfaces:**
- Consumes: `checkReportAccess`, `loadMatchReportData`, `ReportNotFoundError`, `rows` (Task 10); `buildMatchReport` (Task 9); `renderMatchReport` (Task 12); `SUPPORTED_LOCALES`, `DEFAULT_LOCALE`, `Locale` from `@/lib/i18n/config`.
- Produces: `REPORT_VERSION`; `isLocale(value)`; `resolveLocale(requested, profileLanguage): Locale`; `reportEtag({ lastModified, locale, teamId, version }): string`; `reportFileName(home, away, date): string`; `contentDisposition(fileName): string`; `fileNameFromDisposition(header): string | null`; `saveBlob(blob, fileName): void`; `getReportCaller(request): Promise<{ supabase; userId } | null>`; the route `GET /api/v1/matches/[id]/report`.

- [ ] **Step 1: Write the failing tests**

`tests/unit/report/http.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { fileNameFromDisposition } from "@/lib/report/download";
import { contentDisposition, reportEtag, reportFileName, resolveLocale } from "@/lib/report/http";

describe("resolveLocale", () => {
  it("prefers the requested locale, then the profile language, then English", () => {
    expect(resolveLocale("fr", "it")).toBe("fr");
    expect(resolveLocale("de", "it")).toBe("it");
    expect(resolveLocale(null, "xx")).toBe("en");
  });
});

describe("reportEtag", () => {
  const base = { lastModified: "2026-10-01T10:00:00.000000+00:00", locale: "fr" as const, teamId: "team-1", version: 1 };

  it("is stable and quoted", () => {
    expect(reportEtag(base)).toBe(reportEtag({ ...base }));
    expect(reportEtag(base)).toMatch(/^"[0-9a-f]{40}"$/);
  });

  it("changes with any part", () => {
    const etag = reportEtag(base);
    expect(reportEtag({ ...base, lastModified: "2026-10-02T10:00:00.000000+00:00" })).not.toBe(etag);
    expect(reportEtag({ ...base, locale: "en" })).not.toBe(etag);
    expect(reportEtag({ ...base, teamId: "team-2" })).not.toBe(etag);
    expect(reportEtag({ ...base, version: 2 })).not.toBe(etag);
  });
});

describe("file names", () => {
  it("builds an ASCII name and a UTF-8 name that round-trips", () => {
    const name = reportFileName("Volley Club", "Les Étoiles (B)", "2026-10-01T18:00:00.000Z");
    expect(name).toBe("Volley Club-vs-Les Étoiles (B)-2026-10-01.pdf");
    const header = contentDisposition(name);
    expect(header).toContain('filename="volley-club-vs-les-etoiles-b-2026-10-01.pdf"');
    expect(header).toContain("filename*=UTF-8''Volley%20Club-vs-Les%20%C3%89toiles%20%28B%29-2026-10-01.pdf");
    expect(fileNameFromDisposition(header)).toBe(name);
  });

  it("falls back to the plain name, or null", () => {
    expect(fileNameFromDisposition('attachment; filename="report.pdf"')).toBe("report.pdf");
    expect(fileNameFromDisposition(null)).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run tests/unit/report/http.test.ts`
Expected: FAIL, `Failed to resolve import "@/lib/report/download"`.

- [ ] **Step 3: Implement the HTTP helpers**

`lib/report/http.ts`:

```ts
import { createHash } from "node:crypto";
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, type Locale } from "@/lib/i18n/config";

/** Bump when the report's layout or metrics change, so earlier copies are not reused. */
export const REPORT_VERSION = 1;

export const isLocale = (value: string | null | undefined): value is Locale =>
  !!value && (SUPPORTED_LOCALES as readonly string[]).includes(value);

export function resolveLocale(requested: string | null, profileLanguage: string | null): Locale {
  if (isLocale(requested)) return requested;
  if (isLocale(profileLanguage)) return profileLanguage;
  return DEFAULT_LOCALE;
}

export function reportEtag(parts: { lastModified: string; locale: Locale; teamId: string; version: number }): string {
  const hash = createHash("sha1").update([parts.version, parts.lastModified, parts.locale, parts.teamId].join("|")).digest("hex");
  return `"${hash}"`;
}

export function reportFileName(home: string, away: string, date: string): string {
  return `${home}-vs-${away}-${date.slice(0, 10)}.pdf`;
}

/** Attachment header with an ASCII fallback name and the exact name in RFC 5987 form. */
export function contentDisposition(fileName: string): string {
  const ascii = fileName
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/-\./g, ".")
    .toLowerCase();
  const encoded = encodeURIComponent(fileName).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}
```

`lib/report/download.ts`:

```ts
/** File name from a Content-Disposition header, preferring the UTF-8 form. */
export function fileNameFromDisposition(header: string | null): string | null {
  if (!header) return null;
  const encoded = header.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  if (encoded) {
    try {
      return decodeURIComponent(encoded);
    } catch {
      // Malformed: fall back to the plain name.
    }
  }
  return header.match(/filename="([^"]+)"/i)?.[1] ?? null;
}

/** Saves a blob as a download in the browser. */
export function saveBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm vitest run tests/unit/report/http.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Implement the caller lookup**

`lib/report/caller.ts`:

```ts
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

export interface ReportCaller {
  supabase: SupabaseClient;
  userId: string;
}

/**
 * The signed-in caller, with a client that reads with their own rights: the anon key plus their
 * token, never the service role, so RLS applies. Bearer token (Capacitor app) or cookie session (web).
 */
export async function getReportCaller(request: Request): Promise<ReportCaller | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const token = request.headers.get("authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1];
  if (token) {
    const supabase = createClient(url, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { data, error } = await supabase.auth.getUser(token);
    return error || !data.user ? null : { supabase, userId: data.user.id };
  }
  const cookieStore = await cookies();
  // The proxy refreshes the session cookie on this request, so nothing needs to be written back here.
  const supabase = createServerClient(url, anonKey, { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } });
  const { data, error } = await supabase.auth.getUser();
  return error || !data.user ? null : { supabase: supabase as unknown as SupabaseClient, userId: data.user.id };
}
```

- [ ] **Step 6: Implement the route**

`app/api/v1/matches/[id]/report/route.ts`:

```ts
import type { NextRequest } from "next/server";
import { renderMatchReport } from "@/components/report-pdf/render";
import { checkReportAccess } from "@/lib/report/access";
import { buildMatchReport } from "@/lib/report/build";
import { getReportCaller } from "@/lib/report/caller";
import { contentDisposition, isLocale, REPORT_VERSION, reportEtag, reportFileName, resolveLocale } from "@/lib/report/http";
import { loadMatchReportData, ReportNotFoundError } from "@/lib/report/load";
import { rows } from "@/lib/report/query";

export const runtime = "nodejs";
export const maxDuration = 30;

const NO_STORE = { "Cache-Control": "private, no-store" };
const failure = (status: number, error: string) => Response.json({ error }, { status, headers: NO_STORE });

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: matchId } = await params;
  const teamId = request.nextUrl.searchParams.get("team");
  if (!teamId) return failure(400, "missingTeam");

  try {
    const caller = await getReportCaller(request);
    if (!caller) return failure(401, "unauthorized");

    const access = await checkReportAccess(caller.supabase, caller.userId, matchId, teamId);
    if (access === "match-not-found") return failure(404, "matchNotFound");
    if (access === "team-not-in-match") return failure(400, "teamNotInMatch");
    if (access === "forbidden") return failure(403, "forbidden");

    const { data, lastModified } = await loadMatchReportData(caller.supabase, matchId);
    const requested = request.nextUrl.searchParams.get("locale");
    const profileLanguage = isLocale(requested)
      ? null
      : ((await rows(caller.supabase.from("profiles").select("language").eq("id", caller.userId)))[0]?.language ?? null);
    const locale = resolveLocale(requested, profileLanguage);

    const etag = reportEtag({ lastModified, locale, teamId, version: REPORT_VERSION });
    const headers = { ...NO_STORE, ETag: etag };
    if (request.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers });

    const pdf = await renderMatchReport(buildMatchReport(data, teamId), locale);
    return new Response(new Uint8Array(pdf), {
      status: 200,
      headers: {
        ...headers,
        "Content-Type": "application/pdf",
        "Content-Disposition": contentDisposition(reportFileName(data.homeTeam.name, data.awayTeam.name, data.match.date)),
      },
    });
  } catch (error) {
    if (error instanceof ReportNotFoundError) return failure(404, "matchNotFound");
    console.error("Match report failed:", error);
    return failure(500, "reportFailed");
  }
}
```

- [ ] **Step 7: Let `/api/v1/` answer 401 itself**

In `lib/supabase/middleware.ts`, the redirect condition currently reads:

```ts
  if (
    !user &&
    !request.nextUrl.pathname.startsWith('/login') &&
    !request.nextUrl.pathname.startsWith('/auth') &&
    !request.nextUrl.pathname.startsWith('/auth') &&
    !request.nextUrl.pathname.endsWith('/stats') &&
    !(request.nextUrl.pathname === '/')
  ) {
```

Replace it with:

```ts
  if (
    !user &&
    !request.nextUrl.pathname.startsWith('/login') &&
    !request.nextUrl.pathname.startsWith('/auth') &&
    // Versioned API routes check the session themselves (cookie or Bearer token) and answer 401.
    // Other /api routes keep the redirect.
    !request.nextUrl.pathname.startsWith('/api/v1/') &&
    !request.nextUrl.pathname.endsWith('/stats') &&
    !(request.nextUrl.pathname === '/')
  ) {
```

- [ ] **Step 8: Bundle the renderer and the fonts with the route**

In `next.config.js`, add two keys to `nextConfig`:

```js
const nextConfig = {
  reactStrictMode: false,
  images: { unoptimized: true },
  // Pin the project root: without it Next infers the root from the nearest
  // lockfile, which breaks module resolution in nested git worktrees.
  outputFileTracingRoot: __dirname,
  turbopack: { root: __dirname },
  // @react-pdf/renderer runs in the report route from node_modules, with its fonts traced in.
  serverExternalPackages: ['@react-pdf/renderer'],
  outputFileTracingIncludes: { '/api/v1/matches/[id]/report': ['./lib/report/fonts/**'] },
};
```

- [ ] **Step 9: Build and try the route**

Run: `pnpm build`
Expected: build succeeds; the route list includes `ƒ /api/v1/matches/[id]/report`.

Then start the server and check the anonymous answers (any match id works for these):

```bash
pnpm start -p 3100 &
sleep 8
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3100/api/v1/matches/00000000-0000-4000-8000-000000000000/report"
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3100/api/v1/matches/00000000-0000-4000-8000-000000000000/report?team=x"
curl -s -o /dev/null -w "%{http_code}\n" -H "Authorization: Bearer not-a-token" "http://localhost:3100/api/v1/matches/00000000-0000-4000-8000-000000000000/report?team=x"
kill %1
```

Expected: `400`, `401`, `401` (no `307` redirect to `/auth`).

- [ ] **Step 10: Commit**

```bash
git add lib/report/http.ts lib/report/caller.ts lib/report/download.ts "app/api/v1/matches/[id]/report/route.ts" lib/supabase/middleware.ts next.config.js tests/unit/report/http.test.ts
git commit -m "feat(report): GET /api/v1/matches/[id]/report for team members

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 14: Stats page export and removal of the old export

**Files:**
- Modify: `app/matches/[id]/stats/page.tsx`
- Modify: `components/matches/stats/match-overview.tsx`, `score-progression.tsx`, `set-breakdown.tsx`, `player-performance.tsx`, `team-performance.tsx`, `mvp-analysis.tsx`, `components/matches/match-score-details.tsx`
- Modify: `app/matches/[id]/score/page.tsx:12` (unused `jsPDF` import), `app/globals.css` (PDF export block)
- Modify: `messages/{en,fr,es,it,pt}/matches.json`
- Modify: `package.json`, `pnpm-lock.yaml` (remove `jspdf`, `html2canvas-pro`)
- Delete: `lib/pdf/types.ts`, `components/ui/pdf-loading-overlay.tsx`
- Modify: `tests/e2e/06-match-stats.spec.ts`
- Modify: `.claude/docs/02-architecture.md`, `.claude/docs/07-features.md`, `.claude/docs/capacitor-integration.md`

**Interfaces:**
- Consumes: `canExportForTeam` (Task 10); `fileNameFromDisposition`, `saveBlob` (Task 13); `useAuth()` from `@/contexts/auth-context` (returns `{ user }` with `teamMembers`, `clubMembers`); `useSyncStatus()` from `@/hooks/use-sync-status` (returns `SyncStatus | null` with `matches: { matchId, pending, rejected, … }[]`); `useLocale` from `next-intl`.
- Produces: the stats page button; new `matches` keys `pdf.export`, `pdf.exporting`, `pdf.unavailableOffline`, `pdf.unavailableUnsent`, `pdf.unavailableNoRallies`.

- [ ] **Step 1: Update the `matches` translations**

Run this script once from the repo root. It adds the new keys and removes the keys of the old export in all five locales, keeping 2-space JSON:

```bash
node -e '
const fs = require("fs");
const added = {
  en: { export: "Export PDF", exporting: "Preparing PDF…", unavailableOffline: "The PDF needs a connection.", unavailableUnsent: "Some changes to this match are not uploaded yet. The PDF will be available once they are.", unavailableNoRallies: "No rallies recorded yet." },
  fr: { export: "Exporter en PDF", exporting: "Préparation du PDF…", unavailableOffline: "Le PDF nécessite une connexion.", unavailableUnsent: "Certaines modifications de ce match ne sont pas encore envoyées. Le PDF sera disponible ensuite.", unavailableNoRallies: "Aucun échange enregistré pour l’instant." },
  es: { export: "Exportar PDF", exporting: "Preparando el PDF…", unavailableOffline: "El PDF necesita conexión.", unavailableUnsent: "Algunos cambios de este partido aún no se han enviado. El PDF estará disponible cuando se envíen.", unavailableNoRallies: "Aún no hay puntos registrados." },
  it: { export: "Esporta PDF", exporting: "Preparazione del PDF…", unavailableOffline: "Il PDF richiede una connessione.", unavailableUnsent: "Alcune modifiche a questa partita non sono ancora state inviate. Il PDF sarà disponibile dopo l’invio.", unavailableNoRallies: "Nessuno scambio registrato finora." },
  pt: { export: "Exportar PDF", exporting: "Preparando o PDF…", unavailableOffline: "O PDF precisa de conexão.", unavailableUnsent: "Algumas alterações desta partida ainda não foram enviadas. O PDF ficará disponível depois disso.", unavailableNoRallies: "Nenhum ponto registrado ainda." },
};
for (const [locale, keys] of Object.entries(added)) {
  const file = `messages/${locale}/matches.json`;
  const json = JSON.parse(fs.readFileSync(file, "utf8"));
  delete json.pdf.steps;
  delete json.pdf.cancelled;
  delete json.stats.pdfGenerationCancelled;
  if (json.stats.errors) delete json.stats.errors.pdfCancelled;
  Object.assign(json.pdf, keys);
  fs.writeFileSync(file, JSON.stringify(json, null, 2) + "\n");
}
'
pnpm i18n:check
```

Expected: `i18n:check` reports no missing or invalid keys. Run `git diff --stat messages` and check only the five `matches.json` files changed. If a `delete` targeted a key at a different path (check with `rg -n "pdfGenerationCancelled|pdfCancelled|\"steps\"" messages/en/matches.json` before running), adjust the path in the script.

- [ ] **Step 2: Replace the export on the stats page**

In `app/matches/[id]/stats/page.tsx`:

1. Imports. Change `import { useEffect, useState, useRef } from "react";` to `import { useEffect, useState } from "react";` and `import { useTranslations } from "next-intl";` to `import { useLocale, useTranslations } from "next-intl";`. Delete the `PdfExportHandle` import and the `PdfLoadingOverlay, PdfGenerationStep` import. Add:

```ts
import { useAuth } from "@/contexts/auth-context";
import { useSyncStatus } from "@/hooks/use-sync-status";
import { canExportForTeam } from "@/lib/report/can-export";
import { fileNameFromDisposition, saveBlob } from "@/lib/report/download";
```

2. State. Delete `isPdfGenerating`, `pdfSteps`, `currentStepIndex`, `abortControllerRef` and the five `…Ref = useRef<PdfExportHandle>(null)` lines. Add after `const [activeTab, setActiveTab] = useState("overview");`:

```ts
  const [isExporting, setIsExporting] = useState(false);
  const locale = useLocale();
  const { user } = useAuth();
  const syncStatus = useSyncStatus();
```

3. Functions. Delete `updateStepStatus`, `resetSteps`, `cancelPdfGeneration` and `exportToPDF` entirely. Add in their place:

```ts
  const exportReport = async () => {
    if (!managedTeam || isExporting) return;
    setIsExporting(true);
    try {
      const response = await fetch(`/api/v1/matches/${matchId}/report?team=${encodeURIComponent(managedTeam.id)}&locale=${locale}`);
      if (!response.ok) throw new Error(`Report request failed with ${response.status}`);
      const fileName = fileNameFromDisposition(response.headers.get("content-disposition")) ?? `match-report-${matchId}.pdf`;
      saveBlob(await response.blob(), fileName);
      toast({ title: t("pdf.success"), description: t("pdf.successDesc") });
    } catch (error) {
      console.error("Error exporting the match report:", error);
      toast({ variant: "destructive", title: t("pdf.failed"), description: t("pdf.failedDesc") });
    } finally {
      setIsExporting(false);
    }
  };
```

4. Derived values. Right after the `if (!match) { return … }` block, add:

```ts
  const canExport = canExportForTeam(user, managedTeam);
  const matchSync = syncStatus?.matches.find((summary) => summary.matchId === matchId);
  const hasUnsent = !!matchSync && matchSync.pending + matchSync.rejected > 0;
  const exportBlockedReason = !isOnline
    ? t("pdf.unavailableOffline")
    : hasUnsent
      ? t("pdf.unavailableUnsent")
      : points.length === 0
        ? t("pdf.unavailableNoRallies")
        : null;
```

5. JSX. Delete the `<PdfLoadingOverlay … />` element. Replace the "Export PDF" `<Button>` and the Share `<Button>` with:

```tsx
          {canExport && (
            <span title={exportBlockedReason ?? undefined}>
              <Button variant="outline" onClick={exportReport} disabled={isExporting || exportBlockedReason !== null}>
                <Download className="h-4 w-4 mr-2" />
                {isExporting ? t("pdf.exporting") : t("pdf.export")}
              </Button>
            </span>
          )}
          <Button variant="outline" onClick={shareStats}>
            <Share2 className="h-4 w-4 mr-2" />
            Share
          </Button>
```

6. Remove the `ref={…}` and `isPdfGenerating={isPdfGenerating}` props from `MatchOverview`, `SetBreakdown`, `PlayerPerformance`, `ScoreProgression` and `TeamPerformance`.

- [ ] **Step 3: Remove the PDF hooks from the stats components**

Apply the same change to each of `components/matches/stats/match-overview.tsx`, `score-progression.tsx`, `set-breakdown.tsx`, `player-performance.tsx` and `team-performance.tsx`:

1. Turn the `React.forwardRef<PdfExportHandle, XProps>((props, ref) => { … })` component into a plain function. For example, in `score-progression.tsx`:

```tsx
// Before
const ScoreProgression = React.forwardRef<
  PdfExportHandle,
  ScoreProgressionProps
>(({ sets, points, isPdfGenerating }, ref) => {
  …
});

// After
function ScoreProgression({ sets, points }: ScoreProgressionProps) {
  …
}
```

Do the same for `MatchOverview` (`React.forwardRef<PdfExportHandle, MatchOverviewProps>`), `SetBreakdown`, `PlayerPerformance` and `TeamPerformance`. Keep their `export { … }` lines; `X.displayName = "X";` can stay.

2. Delete the whole `useImperativeHandle(ref, () => ({ generatePdfContent: … }));` call (it starts at `match-overview.tsx:46`, `player-performance.tsx:76`, `score-progression.tsx:41`, `set-breakdown.tsx:42`, `team-performance.tsx:101` and ends at its matching `}));`). Delete each `useRef<HTMLDivElement>` that only that call used, and the matching `ref={…}` attribute in the JSX.

3. Delete `isPdfGenerating?: boolean;` from each props interface and the `import { PdfExportHandle } from "@/lib/pdf/types";` line. Remove `useImperativeHandle` (and `useRef` if no longer used) from the `react` import.

4. Replace every expression that reads `isPdfGenerating` with its non-PDF branch:
   - `className={isPdfGenerating ? "h-[280px]" : "h-[400px]"}` → `className="h-[400px]"`
   - `className={isPdfGenerating ? "h-[200px]" : "h-[300px]"}` → `className="h-[300px]"`
   - ``className={`${isPdfGenerating ? "h-[400px]" : "h-[800px]"} grid grid-cols-3 gap-4`}`` → `className="h-[800px] grid grid-cols-3 gap-4"`
   - `isAnimationActive={!isPdfGenerating}` → delete the attribute
   - `isPdfGenerating={isPdfGenerating}` passed to `MVPAnalysis` / `MatchScoreDetails` in `match-overview.tsx` → delete the attribute

Then delete `isPdfGenerating?: boolean; …` from the props of `components/matches/stats/mvp-analysis.tsx` and `components/matches/match-score-details.tsx`.

Check: `rg -n "isPdfGenerating|PdfExportHandle|generatePdfContent|html2canvas|jspdf|jsPDF|data-pdf-export" app components lib`
Expected: no match except `app/globals.css` and `app/matches/[id]/score/page.tsx` (handled next).

- [ ] **Step 4: Remove the rest of the old export**

- In `app/matches/[id]/score/page.tsx`, delete line 12 `import { jsPDF } from "jspdf";`.
- In `app/globals.css`, delete from the comment `/* PDF Export Compatibility Styles */` through the last `[data-pdf-export="true"] …` rule block (all rules whose selector starts with `[data-pdf-export="true"]`).
- Delete the files and the dependencies:

```bash
git rm lib/pdf/types.ts components/ui/pdf-loading-overlay.tsx
pnpm remove jspdf html2canvas-pro
rg -n "html2canvas|jspdf|jsPDF|data-pdf-export|pdf-loading-overlay|lib/pdf" app components lib hooks contexts
```

Expected: the last command finds nothing.

- [ ] **Step 5: Type check, lint, unit tests**

Run: `pnpm exec tsc --noEmit -p tsconfig.json && pnpm lint && pnpm test`
Expected: all pass.

- [ ] **Step 6: Update the e2e test**

In `tests/e2e/06-match-stats.spec.ts`, replace the 7.5 block (from the comment `// 7.5 Verify the Export PDF button is attached to the DOM.` to the end of the first test, before its closing `});`) with:

```ts
    // 7.5 The test user created the team, so the report export is offered; it downloads a PDF.
    const exportPdfButton = page.getByRole('button', { name: /export pdf/i });
    await expect(exportPdfButton).toBeEnabled({ timeout: 15_000 });
    const [download] = await Promise.all([page.waitForEvent('download'), exportPdfButton.click()]);
    expect(download.suggestedFilename()).toMatch(/\.pdf$/);
    const downloaded = await download.path();
    expect(fs.readFileSync(downloaded!).subarray(0, 4).toString()).toBe('%PDF');

    // Also verify the Share button is visible
    await expect(page.getByRole('button', { name: /share/i })).toBeVisible();
  });

  test('signed-out visitors get no export, and the report route refuses them', async ({ browser, playwright, baseURL }) => {
    const { completedMatchStatsUrl } = loadFixture();
    expect(completedMatchStatsUrl).toBeTruthy();
    const statsUrl = new URL(completedMatchStatsUrl!, baseURL);
    const matchId = statsUrl.pathname.split('/')[2];
    const teamId = statsUrl.searchParams.get('team');

    // The stats page stays public, without the export button.
    const visitor = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const visitorPage = await visitor.newPage();
    await visitorPage.goto(statsUrl.toString());
    await expect(visitorPage.getByRole('heading', { name: 'Match Statistics', level: 1 })).toBeVisible({ timeout: 15_000 });
    await expect(visitorPage.getByRole('button', { name: /export pdf/i })).toHaveCount(0);
    await visitor.close();

    const anonymous = await playwright.request.newContext({ baseURL, storageState: { cookies: [], origins: [] } });
    const path = `/api/v1/matches/${matchId}/report?team=${teamId}`;
    expect((await anonymous.get(path, { maxRedirects: 0 })).status()).toBe(401);
    expect((await anonymous.get(path, { maxRedirects: 0, headers: { Authorization: 'Bearer not-a-token' } })).status()).toBe(401);
    await anonymous.dispose();
```

(The final `});` of the original test now closes the new test.) Update the file's header comment line `7.5  Verify Export PDF button is in the DOM (hidden at 768px by CSS)` to `7.5  Export the report PDF; the route refuses callers without a session`.

- [ ] **Step 7: Run the e2e suite**

```bash
pnpm build && pnpm start -p 3100 &
sleep 10
CI=1 BASE_URL=http://localhost:3100 pnpm test:e2e
kill %1
```

Expected: all specs pass, including both tests in `06-match-stats.spec.ts`.

- [ ] **Step 8: Update the documentation**

- `.claude/docs/07-features.md`: replace the line `- **PDF Export** (jsPDF + html2canvas-pro, which understands Tailwind 4 oklch/oklab colours)` with `- **PDF report** (server-side, see below)`, and replace the `**PDF Export**:` section (its heading and two bullets) with:

```markdown
**PDF Report**:
- Generated on the server by `GET /api/v1/matches/[id]/report?team=<teamId>&locale=<locale>` ([app/api/v1/matches/[id]/report/route.ts](app/api/v1/matches/[id]/report/route.ts)) with `@react-pdf/renderer`
- Only for signed-in members of the analysed team, its creator, and owners/admins of its club ([lib/report/access.ts](lib/report/access.ts)); the route reads with the caller's session (anon key), never the service role; `/api/v1/` is exempt from the proxy's sign-in redirect so it answers 401
- Metrics are pure functions in [lib/report/metrics/](lib/report/metrics/) assembled by `buildMatchReport` ([lib/report/build.ts](lib/report/build.ts)); the stats screen's MVP uses the same `mvp()`
- Pages: summary, match detail, one per set (timeline with events and their impact). Text in `messages/<locale>/report.json`
- The stats page button is shown to the same users ([lib/report/can-export.ts](lib/report/can-export.ts)) and disabled offline, without rallies, or while the match has unsent changes
- Design: [docs/superpowers/specs/2026-10-09-pdf-report-design.md](docs/superpowers/specs/2026-10-09-pdf-report-design.md)
```

- `.claude/docs/02-architecture.md`: in the directory tree, replace `│   ├── pdf/                      # PDF export types (jsPDF)` with `│   ├── report/                   # Match PDF report: metrics, model, loading, access`; under `├── app/` add `│   └── api/v1/matches/[id]/report/  # Match PDF report (server)` next to the existing `api/import/ffvb/` line; under `├── components/` add `│   ├── report-pdf/               # @react-pdf/renderer report document`.
- `.claude/docs/capacitor-integration.md`: replace the three bullets under `3. **Update PDF export**` with:

```markdown
   - The PDF is generated by the web deployment (`GET /api/v1/matches/[id]/report`, Bearer token)
   - On native: fetch it, save with `Filesystem.writeFile()`
   - Share with `Share.share()` plugin
```

- [ ] **Step 9: Commit**

```bash
git add -A app components lib hooks contexts messages tests/e2e package.json pnpm-lock.yaml .claude/docs
git status --short
git commit -m "feat(stats): download the server report; remove the screenshot PDF export

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Before committing, check `git status --short` lists only files this task changed (not `.claude/settings.local.json`, `.superpowers/` or other unrelated files); unstage anything else with `git restore --staged <path>`.
