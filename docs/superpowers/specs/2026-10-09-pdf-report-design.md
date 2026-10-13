# Match PDF Report — Design Spec

**Date:** 2026-10-09
**Status:** Draft, awaiting review
**Parent:** [Mobile app decision record](2026-10-09-mobile-app-decision.md), sub-project 3 (built first)

## Goal

Replace the client-side PDF export (tab switching + html2canvas screenshots packed into jsPDF)
with a report generated on the server with `@react-pdf/renderer`, designed from the data rather
than from the screens. One endpoint serves the web app now and the Capacitor app later (where
`jsPDF.save()` cannot download).

Readers: page 1 is a summary players, parents and the club can be sent; the rest is the coach's
debrief. The file is downloaded by a team member and shared as a file; nothing is published.

## Decisions

| Topic | Decision |
|---|---|
| Renderer | `@react-pdf/renderer` 4.x in a Node.js route handler. No headless browser. |
| Structure | Match summary (page 1), match detail (page 2), then one or two pages per set. No tactical insights, no per-rotation tables, no opponent player stats. |
| Events | Placed on each set's timeline; each one gets an impact line (5 rallies before / after). |
| Metrics | Built on what users reliably type: rally-ending actions (`success` / `error`) and the rally-by-rally score. `good` / `bad` are rarely typed, so no metric depends on them. |
| Access | Signed-in members of the analysed team, its creator, and owners/admins of its club. The stats page stays publicly readable as today. |
| MVP | One shared formula fixes the current bug (`bad` scored like `good`); the stats screen uses it too, so screen and PDF agree. |

## Data semantics

| Source | Meaning used by the report |
|---|---|
| `player_stats` | Managed team only. `success` = the action won the rally, `error` = it lost the rally, `good` / `bad` = the rally went on (rare). `position` = court position (p1–p6) at the time, may be null. |
| `score_points` | One row per rally: `point_number`, `home_score` / `away_score` after the rally, `scoring_team_id`, `point_type` (`unknown` when not typed), `action_team_id`, `player_id`, `result`, `timestamp`, `current_rotation` (managed team's positions → player ids before the rally). |
| `sets` | `set_number`, final score, `first_lineup`, `first_server_team_id`, `player_roles` (player id → role), `status`. |
| `events` | `event_type`, `set_id`, `point_number`, `home_score` / `away_score`, `team`, `player_id`, `details`, `timestamp`. |
| `match_formats` | `point_by_set`, `point_final_set`, `sets_to_win`, `rotation`, `format` (`2x2` … `6x6`). |
| `team_members` | `name`, `number`, `role`. |

Rows with `_deleted = true` are ignored, except `team_members` rows referenced by the match's
stats, points, lineups or events (a player removed from the team later still appears by name).

## Metric definitions (`lib/report/metrics/`)

All functions are pure and covered by Vitest. A ratio with a zero denominator is `null` and
prints as "–".

**Rally model** (`rallies.ts`): rallies of a set sorted by `point_number`. For each rally:
- *serving team*: rally 1 → `sets.first_server_team_id`; rally n → scoring team of rally n−1.
- *server* (only when `match_formats.rotation`): the player in `p1` of `current_rotation` when the managed team serves.
- *on court*: the player ids in `current_rotation`.
- *origin*: when the managed team scores — acted by the managed team: ace (`serve`), kill (`spike`), block (`block`), other winner (`reception`/`defense`), unspecified (`unknown`); acted by the opponent: opponent error. When the opponent scores — acted by the managed team: own error (by `point_type`, or unspecified); acted by the opponent: opponent winner.

**Per team, match and set:**
- *Points origin*: counts of each origin above.
- *Side-out %*: rallies won when receiving / rallies received. *Break-point %*: rallies won when serving / rallies served.
- *Data coverage*: rallies whose `point_type` is not `unknown` / all rallies.

**Per player** (match and each set), from `player_stats`:
- Serve aces / errors, kills / attack errors, block points / errors, reception errors (aces conceded), defense errors.
- *Points* = aces + kills + block points. *Errors* = all `error` results. *Net* = points − errors.
- *+/−*: over rallies where the player is in `current_rotation`, rallies won − rallies lost.

**By role**: points and errors summed by `sets.player_roles` role (outside, opposite, middle, setter, libero), with the top scorer of each role. A player without a role in a set counts as "no role".

**By court zone** (6×6 only): points and errors by `player_stats.position`; when null, the player's position in `current_rotation` of the matching rally (`score_points.player_stat_id`); otherwise not counted. Front row = p2, p3, p4; back row = p1, p5, p6.

**Servers** (formats with rotation): per server, rallies served, rallies won on serve, break %, longest serving run, aces, serve errors.

**Score flow** (per set): largest lead each way, ties (after rally 1), lead changes, longest run each way, biggest deficit overcome by the set winner.

**Set ending**: rallies won by each team from the first rally after which either team has `target − 5` points, where `target` = `point_final_set` for the deciding set (`set_number` = `2 × sets_to_win − 1`), else `point_by_set` (20 in a 25-point set, 10 in a 15-point set).

**Event impact** (per event with a set): the rally index of the event is its `point_number` (the event happened after that rally; 0 = before the first rally); when null, the last rally whose `timestamp` is before the event's `timestamp`. *Before* = score of the up to 5 rallies ending at that index; *after* = score of the up to 5 rallies after it; *next rally won* = whether the managed team won rally index + 1. Windows stop at set boundaries. Substitutions add the incoming player's +/− over the rest of the set while on court.

**MVP**: per stat, base score success +1, good +0.5, bad 0, error −1, times the existing weight (serve 1, spike 1.2, block 1.5, reception 1, defense 1.2). Set MVP = highest set total; match MVP = highest match total; no MVP when nobody has a positive total.

**Leaders** (summary): top 3 by points; best server (longest serving run, then break %); best +/−.

## Report layout (A4 portrait)

**Page 1 — Summary**
- Header: home vs away (managed team highlighted), date, location, championship, sets won, each set's score, duration (first to last rally timestamp), "in progress" when the match is not `completed`.
- Points origin, managed team vs opponent: two stacked bars (won / lost).
- Side-out % and break-point %.
- Leaders and MVPs (match and each set).
- Momentum strip: one small score-difference chart per set, side by side.
- Data coverage line.

**Page 2 — Match detail**
- Player table: number, name, the per-player columns above, +/−, team total row.
- Points by role.
- Court zones diagram (6×6 only).
- Servers table (formats with rotation).
- Events without a set, in time order.

**Per set (one or two pages)**
- Header: set number, score, winner, duration, first server, starting six on a court diagram (6×6 only).
- Timeline: score difference (managed − opponent) as a step line per rally, shaded above / below zero; under it a strip with one cell per rally (won / lost colour, origin letter: A ace, K kill, B block, E opponent error, e own error, · unspecified; serving team dot); event markers on the same axis (T timeout with team, S substitution #in ↔ #out, + injury, card for sanctions, ! technical, numbered notes for comments).
- Score flow and set ending.
- Event impact table: rally, score, event, before, after, next rally won, +/− for substitutions.
- Set player table and set servers table.
- Comments in order, with their score.

## Architecture

```
lib/report/
  types.ts            MatchReportData (raw inputs), MatchReportModel (computed, no text)
  metrics/            rallies, origin, players, roles, zones, servers, score-flow,
                      set-ending, event-impact, coverage, mvp  (pure, Vitest)
  build.ts            buildMatchReport(data, managedTeamId): MatchReportModel
  load.ts             loadMatchReportData(supabase, matchId): { data: MatchReportData, lastModified }
  access.ts           checkReportAccess(supabase, userId, matchId, teamId):
                      "allowed" | "match-not-found" | "team-not-in-match" | "forbidden"
  fonts/              Noto Sans regular + bold (TTF)
components/report-pdf/  (server-only)
  match-report.tsx    <Document>: SummaryPage, MatchDetailPage, SetPages
  charts/             MomentumStrip, TimelineChart, PointsOriginBars, CourtZones, StartingSix
  tables/             PlayerTable, ServerTable, EventImpactTable
app/api/v1/matches/[id]/report/route.ts
messages/<locale>/report.json   (en, es, fr, it, pt)
```

- `lib/report/` imports nothing from React, Next or Supabase except `load.ts` and `access.ts`, which take a `SupabaseClient` argument. `metrics/` and `build.ts` are pure.
- `components/report-pdf/` receives a `MatchReportModel` and a translator; it computes nothing.
- The stats screen's MVP uses `lib/report/metrics/mvp.ts`; `calculateMVPScore` is removed from `lib/stats/calculations.ts`.

### Route `GET /api/v1/matches/[id]/report?team=<teamId>&locale=<locale>`

- `runtime = "nodejs"`, `maxDuration = 30`. Fonts included in the function with `outputFileTracingIncludes`.
- **Session**: from `Authorization: Bearer <access token>` (Capacitor app, later) or the cookie session (web). The Supabase client is created with the **anon key** and the caller's token, never the service role. No session → `401`.
- **Access** (`access.ts`), checked before any match data is read. The caller may export when `team` is the match's home or away team and one of:
  - a `team_members` row for `team` with `user_id` = caller, not deleted;
  - `teams.user_id` = caller (team creator);
  - a `club_members` row for the team's `club_id` with `user_id` = caller and `role` in (`owner`, `admin`), not deleted.

  Otherwise `403`. Match not found → `404`. `team` missing or not in the match → `400`.
- **Locale**: `locale` parameter if supported, else the caller's profile language, else the default. Translations via next-intl `getTranslations({ locale, namespace: "report" })`.
- **Response**: `200 application/pdf`, `Content-Disposition: attachment; filename="<home>-vs-<away>-<yyyy-mm-dd>.pdf"` (ASCII-safe, RFC 5987 `filename*` for accents), `Cache-Control: private, no-store`, `ETag` = hash of (latest `_modified` across the match's rows **including soft-deleted ones**, so a deletion changes it; locale; team; `REPORT_VERSION`). A matching `If-None-Match` returns `304` without rendering.
- **Proxy**: `proxy.ts` redirects signed-out requests to `/auth`; `/api/v1/` is exempted from that redirect so the route answers `401` itself (Bearer callers have no cookie). Other `/api` routes keep the redirect.
- **Origin of a rally**: derived from `scoring_team_id` and `action_team_id` only. For points entered without a player, the app stores `result` from the managed team's point of view (an opponent error is `action_team_id` = opponent, `result` = `success`), so `result` is never used to classify a rally.
- **Errors**: render or load failure → `500` JSON `{ error }` with a server log; the client shows a translated toast.

### Stats page changes

- "Export PDF" shows only when the signed-in user may export for the analysed team, using `user.teamMembers`, `user.clubMembers` and the loaded team's `club_id` / `user_id` (same rule as `access.ts`, which remains the authority).
- It is disabled, with a tooltip, when offline, when the match has no rallies, or when `useSyncStatus().matches` lists unsent changes for this match.
- Click: `fetch` the route, save the blob as the file name from `Content-Disposition`, spinner while waiting.
- Removed: `jspdf`, `html2canvas-pro`, `lib/pdf/types.ts`, the `generatePdfContent` handles in `match-overview`, `score-progression`, `set-breakdown` and `player-performance`, the progress-step UI and its state, the `data-pdf-export` CSS in `app/globals.css`, the unused `jsPDF` import in `app/matches/[id]/score/page.tsx`.

## Edge cases

| Case | Behaviour |
|---|---|
| Match without rallies | Export disabled; the route still returns a summary with "no data". |
| Match not `completed` | "In progress" on the header; the current set is reported as played so far. |
| Event without `point_number` | Placed by `timestamp`; without a set → listed on page 2. |
| Player without number or name | Name only / "Unknown player". |
| Player in stats but deleted from the team | Shown by name (see Data semantics). |
| Format without rotation | No servers table, no server in the rally model. |
| Format other than 6×6 | No court zones, no starting six diagram. |
| Many players (14+) | Player tables continue on the next page with repeated header. |
| Unknown locale | Profile language, then default. |

## Testing

- **Vitest, metrics**: serving team chain; server from p1; side-out / break %; +/−; runs, ties, lead changes, deficit overcome; set ending in a 25-point and a 15-point deciding set; event windows at set start / end and by timestamp; coverage; MVP (including the `bad` fix and no-MVP case); `null` ratios.
- **Vitest, access**: member, creator, club owner / admin, club member without role, other team's member, deleted membership, team not in match.
- **Vitest, rendering**: `renderToBuffer` on a 3-set and a 5-set fixture in each of the 5 locales returns a non-empty buffer starting with `%PDF`.
- **Playwright**: on the stats page as a team member, export downloads an `application/pdf` file; signed out, the button is absent and the route returns `401`.
- `pnpm i18n:check` covers the new `report` namespace.

## Out of scope

Tactical insights, per-rotation side-out tables, opponent player stats, club or team logos,
making the stats page private, the Capacitor download / share flow (sub-project 2), changes
to how users type actions.
