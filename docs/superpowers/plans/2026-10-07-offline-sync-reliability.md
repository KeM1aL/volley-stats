# Offline Sync Reliability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every live-match change recorded on a device reaches Supabase exactly as recorded, through network drops and multi-day offline periods, and the user can always see whether their data is saved.

**Architecture:** Keep RxDB replication but align it with RxDB's Supabase conventions: a server-only `_modified` checkpoint column, a "scoring device wins" conflict handler, one pull+push replication per (table, tracked match) started at app launch on every screen, a local `pending_changes` collection that records unsent rows (feeding the UI badge), parent-first gating for foreign keys, per-row error classification, and a server-enforced scoring-device claim. Platform signals (connectivity, foreground, device id) go through a `SyncPlatform` adapter so a later Capacitor/Expo build reuses the sync core.

**Tech Stack:** Next.js 16, React 19, TypeScript 6, RxDB 17.6.0 (Dexie in the browser, memory storage in tests), supabase-js 2.117, Supabase Postgres, Vitest 5 (new), Playwright 1.63, next-intl 4, pnpm 12.9.1, Node 24.

**Spec:** [docs/superpowers/specs/2026-10-07-offline-sync-reliability-design.md](../specs/2026-10-07-offline-sync-reliability-design.md). Read it before starting; this plan implements it and cites its sections.

**Tracking:** Every task below has a matching Task Master task (tag `offline-sync`, same number) and a matching section in [.taskmaster/docs/prd-offline-sync.txt](../../../.taskmaster/docs/prd-offline-sync.txt). At the start of a task run `npx -y --package=task-master-ai task-master set-status --id=<N> --status=in-progress --tag=offline-sync`; after its commit run it again with `--status=done`. Tick the plan checkboxes as you go.

## Global Constraints

- Node 24, pnpm 12.9.1 (`packageManager`), `rxdb` 17.6.0 exactly, `@supabase/supabase-js` ^2.117.2, `vitest` 5.0.3 (dev only).
- Never bump `DB_GENERATION` and never change the version or properties of the 12 existing RxDB schemas. The only local schema addition is the new `pending_changes` collection.
- Server-only columns (`_modified`, `scorer_device_id`, `scorer_user_id`, `scorer_name`, `scorer_device_label`, `scorer_claimed_at`) never appear in local RxDB schemas.
- Sync requests send the header `x-device-id: <device id>`; API-layer requests (`lib/api`) never send it.
- Replication identifiers: `sync2_<table>_match_<matchId>` for match tables, `sync2_<table>_<userId>_<filterKey>` for reference tables.
- Constants: `MAX_TEMPORARY_ATTEMPTS = 20` (only `parent_missing` and `unknown` errors count), tracked-match TTL 14 days, `syncMatch` timeout 30 s, parent wait 5 s, `retryTime` 5 s in the app (50 ms in tests).
- `lib/rxdb/sync/**` must not touch `window`, `document`, `navigator` or `localStorage`, except `lib/rxdb/sync/platform/web.ts`.
- Every user-facing string lives in `messages/{en,fr,es,it,pt}/sync.json`; `pnpm i18n:check` must pass.
- Lucide 1.x icon names: `LoaderCircle` (not `Loader2`), `TriangleAlert` (not `AlertTriangle`).
- Nothing touches the production Supabase project (`gvtjccisbwrwpjtabnyd`) without the user's explicit confirmation in the conversation; Task 3 says exactly when to ask.
- One commit per task (more are fine). Commit messages follow the repo style (`feat(sync): …`, `test(sync): …`) and end with the line `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.
- Commands: unit tests `pnpm test`; lint `pnpm lint`; build `pnpm build`; e2e `pnpm build && pnpm start -p 3100` then `CI=1 BASE_URL=http://localhost:3100 pnpm test:e2e`.

## Review Focus

These five inputs aren't spelled out by the spec but are the most likely to hurt a real user. Each has a test in the task that owns the code:

1. **Timestamps in different formats for the same instant** (Postgres `…:00.123456+00:00` vs the device's `…:00.123Z`, or `matches.date` as `timestamptz`) must compare as equal, so nothing triggers a phantom conflict. Covered by `docsEqual` tests in Task 5.
2. **A long offline match** (150 points over 3 sets) must upload completely and in order after reconnecting. Covered by the "uploads 150 points" test in Task 12.
3. **Closing the app in the middle of an upload** must not lose or duplicate anything when the app is reopened. Covered by the "closed in the middle of a push" test in Task 12.
4. **Two matches with unsent data at the same time** must each upload only their own rows, exactly once. Covered by the "two matches" test in Task 11.
5. **A point recorded and undone before its first upload** must never appear as a live (undeleted) row on the server. Covered by the "inserted and undone before its first upload" test in Task 12.

## Verification already done

The spec's pre-implementation database check ran on 2026-10-07; see the spec's "Verification findings". Consequences for this plan:
- There is no FK change, and `score_points.player_stat_id` isn't gated (it has no FK).
- `scorer_name` is stored on `matches`, because profiles are only readable by their owner.
- RLS lets only the owner of either team write match data.

## File Structure

| Path | Responsibility |
|---|---|
| `vitest.config.ts` | Vitest config (node environment, `@` alias) |
| `lib/rxdb/sync/helper.ts` | `pickSchemaFields` (drop columns unknown to the local schema), `addDocEqualityToQuery` |
| `lib/rxdb/sync/timestamps.ts` | `isoToMicros`: ISO timestamp → microseconds, keeping Postgres precision |
| `lib/rxdb/sync/types.ts` | Shared sync types: collection lists, `SyncUser`, replication options, `PushGate`, `PushReporter` |
| `lib/rxdb/sync/errors.ts` | `classifyPushError`, `countsTowardsAttemptLimit` |
| `lib/rxdb/sync/conflict-handler.ts` | `docsEqual`, `matchConflictHandler` |
| `lib/rxdb/sync/pending-changes.ts` | `pending_changes` schema, `PendingChanges` store, `installPendingHooks` |
| `lib/rxdb/collections.ts` | Plugins, `DatabaseCollections`, `setupCollections` (collections, conflict handlers, hooks) |
| `lib/rxdb/sync/platform/types.ts`, `web.ts` | `SyncPlatform` interface and browser implementation |
| `lib/rxdb/sync/tracked-matches.ts` | Persisted list of matches this device syncs, with claim state |
| `lib/rxdb/sync/sync-state.ts` | `sync-state-<matchId>` local doc used by `syncMatch` |
| `lib/rxdb/sync/scorer-claim.ts` | RPC client for `claim_match_scorer` / `get_match_scorer` |
| `lib/rxdb/sync/dependencies.ts` | Parent references and the push gate |
| `lib/rxdb/sync/replication.ts` | `replicateSupabase` adapter (replaces `index.ts`) |
| `lib/rxdb/sync/match-sync.ts` | Five replications of one match + their wiring to `pending_changes` |
| `lib/rxdb/sync/reference-sync.ts` | Pull-only replications of reference tables |
| `lib/rxdb/sync/upgrade.ts` | One-time seeding of tracked matches on upgraded devices |
| `lib/rxdb/sync/manager.ts` | `SyncManager`: user lifecycle, tracked matches, claims, resume |
| `lib/rxdb/sync/status.ts` | `deriveSyncStatus` (pure) for the badge |
| `lib/rxdb/pending-hint.ts` | Unsent-changes count mirrored in `localStorage` for the reset guard |
| `lib/rxdb/reset-policy.ts` | `decideDatabaseReset` (pure) |
| `lib/rxdb/database.ts` | Browser database creation (uses `setupCollections`, web platform) |
| `supabase/migrations/20261007000000_sync_reliability.sql` | Server changes (spec section 1) |
| `hooks/use-sync-status.ts`, `hooks/use-unsent-guard.ts` | React hooks over the sync state |
| `components/sync/*` | Badge, reason line, match flag, claim dialog, banner, formatting |
| `messages/*/sync.json` | Strings |
| `tests/unit/**` | Vitest tests, fake Supabase, helpers |
| `tests/e2e/04*.spec.ts`, `tests/helpers/server-data.ts`, `tests/helpers/sync.ts` | Playwright |

---

### Task 1: Vitest and a pull that tolerates new server columns

Ship this commit to production on its own, before Task 3 applies the migration. Today's app rejects any row that has a column its local schema doesn't know, and the migration adds such columns.

**Files:**
- Modify: `package.json` (scripts, devDependency)
- Create: `vitest.config.ts`
- Modify: `lib/rxdb/sync/helper.ts`
- Modify: `lib/rxdb/sync/index.ts` (`rowToDoc`)
- Test: `tests/unit/sync/helper.test.ts`

**Interfaces:**
- Produces: `pickSchemaFields<T extends Record<string, unknown>>(row: T, schemaProperties: Record<string, unknown>): Partial<T>` in `lib/rxdb/sync/helper.ts`; `pnpm test` runs Vitest.

- [ ] **Step 1: Install Vitest**

Run: `pnpm add -D vitest@5.0.3`
Expected: `package.json` devDependencies gains `"vitest": "5.0.3"`.

- [ ] **Step 2: Add the config and scripts**

Create `vitest.config.ts`:

```ts
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
    testTimeout: 20_000,
    hookTimeout: 20_000,
  },
});
```

In `package.json` `scripts`, after `"lint": "eslint .",` add:

```json
    "test": "vitest run",
    "test:watch": "vitest",
```

- [ ] **Step 3: Write the failing test**

Create `tests/unit/sync/helper.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { pickSchemaFields } from "@/lib/rxdb/sync/helper";

describe("pickSchemaFields", () => {
  it("drops columns the local schema does not define", () => {
    const row = {
      id: "a",
      home_score: 1,
      _deleted: false,
      _modified: "2026-10-07T10:00:00.000001+00:00",
      scorer_device_id: "device-b",
    };
    expect(pickSchemaFields(row, { id: {}, home_score: {}, _deleted: {} })).toEqual({
      id: "a",
      home_score: 1,
      _deleted: false,
    });
  });

  it("keeps _deleted even when the schema omits it", () => {
    expect(pickSchemaFields({ id: "a", _deleted: true }, { id: {} })).toEqual({ id: "a", _deleted: true });
  });
});
```

- [ ] **Step 4: Run it and see it fail**

Run: `pnpm test`
Expected: FAIL, `pickSchemaFields` is not exported from `@/lib/rxdb/sync/helper`.

- [ ] **Step 5: Implement `pickSchemaFields`**

Append to `lib/rxdb/sync/helper.ts`:

```ts
/**
 * Keeps only the fields the local RxDB schema defines (plus `_deleted`).
 * RxDB rejects documents with unknown fields, so a column added on the server
 * (or a server-only column such as `_modified`) must never reach the local
 * database.
 */
export function pickSchemaFields<T extends Record<string, unknown>>(
  row: T,
  schemaProperties: Record<string, unknown>
): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(row)) {
    if (key === "_deleted" || Object.hasOwn(schemaProperties, key)) out[key] = row[key];
  }
  return out as Partial<T>;
}
```

- [ ] **Step 6: Use it in today's adapter**

In `lib/rxdb/sync/index.ts`:
- Change the import from `./helper` to also import `pickSchemaFields`.
- At the end of `rowToDoc`, replace `return doc;` with:

```ts
        return pickSchemaFields(
            doc as Record<string, unknown>,
            collection.schema.jsonSchema.properties as Record<string, unknown>
        ) as WithDeleted<RxDocType>;
```

Also delete the unused `import { table } from 'console';` line at the top of the file.

- [ ] **Step 7: Run tests, lint and build**

Run: `pnpm test` → Expected: 2 passed.
Run: `pnpm lint` → Expected: no new errors compared with `main`.
Run: `pnpm build` → Expected: build succeeds.

- [ ] **Step 8: Commit**

```bash
git add package.json pnpm-lock.yaml vitest.config.ts lib/rxdb/sync/helper.ts lib/rxdb/sync/index.ts tests/unit/sync/helper.test.ts
git commit -m "fix(sync): ignore server columns the local schema doesn't know

Adds Vitest for the sync layer.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 9: Ask for the hotfix deploy**

Tell the user:
- This commit must reach production before Task 3 applies the migration.
- Suggested route: cherry-pick it onto `main` and deploy.
- Otherwise, devices still running the old version would fail to pull any row once the migration adds `_modified`.

Continue with Task 2 while waiting. Task 3 Step 3 checks that this deploy happened.

---

### Task 2: Microsecond timestamps and a fake Supabase server for tests

**Files:**
- Create: `lib/rxdb/sync/timestamps.ts`
- Test: `tests/unit/sync/timestamps.test.ts`
- Create: `tests/unit/fakes/fake-supabase.ts`
- Test: `tests/unit/fakes/fake-supabase.test.ts`
- Create: `tests/unit/helpers/server.ts`, `tests/unit/helpers/fixtures.ts`, `tests/unit/helpers/wait.ts`

**Interfaces:**
- Produces: `isoToMicros(value: unknown): number | null`.
- Produces: `FakeSupabaseServer` with:
  - `client(context?: { online?: () => boolean; userId?: string; userName?: string | null })`
  - `seed(table, row)`, `row(table, id)`, `rows(table, predicate?)`
  - `editAsWebsite(table, id, patch)`, `hardDelete(table, id)`, `setScorer(matchId, { deviceId, userId?, name?, label? })`
  - `failNext(...faults)`, `loseNextResponse(table)`, `denyWrites(table, predicate)`, `allowWrites(table)`, `dropColumn(table, column)`
  - `offline`, `latencyMs`, `log: LoggedRequest[]`, `responseCodes()`
- Produces: `createFakeServer()`, the `FOREIGN_KEYS` list, fixture builders `seedTeams`, `seedServerMatch`, `aSet`, `aPlayerStat`, `aScorePoint`, `anEvent`, and the constants `USER_ID`, `HOME_TEAM_ID`, `AWAY_TEAM_ID`, `PLAYER_ID`, `FORMAT_ID`.
- Produces: `waitFor(check, options?)` and `sleep(ms)`.

- [ ] **Step 1: Write the failing timestamp test**

Create `tests/unit/sync/timestamps.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { isoToMicros } from "@/lib/rxdb/sync/timestamps";

describe("isoToMicros", () => {
  it("treats Z and +00:00 as the same instant", () => {
    expect(isoToMicros("2026-10-07T10:00:00.123Z")).toBe(isoToMicros("2026-10-07T10:00:00.123000+00:00"));
  });

  it("keeps the microseconds Postgres returns", () => {
    const a = isoToMicros("2026-10-07T10:00:00.123456+00:00")!;
    const b = isoToMicros("2026-10-07T10:00:00.123457+00:00")!;
    expect(b - a).toBe(1);
  });

  it("applies offsets", () => {
    expect(isoToMicros("2026-10-07T12:00:00+02:00")).toBe(isoToMicros("2026-10-07T10:00:00Z"));
  });

  it("returns null for anything that is not a full ISO timestamp", () => {
    expect(isoToMicros("2026-10-07")).toBeNull();
    expect(isoToMicros("hello")).toBeNull();
    expect(isoToMicros(42)).toBeNull();
    expect(isoToMicros(null)).toBeNull();
  });
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `pnpm test tests/unit/sync/timestamps.test.ts`
Expected: FAIL, cannot resolve `@/lib/rxdb/sync/timestamps`.

- [ ] **Step 3: Implement `isoToMicros`**

Create `lib/rxdb/sync/timestamps.ts`:

```ts
const ISO_TIMESTAMP = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,9}))?(Z|[+-]\d{2}:?\d{2})$/;

/**
 * Microseconds since the epoch for a full ISO-8601 timestamp, or null if
 * `value` isn't one. Keeps the microseconds Postgres returns, which
 * `Date.parse` drops.
 */
export function isoToMicros(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const match = ISO_TIMESTAMP.exec(value);
  if (!match) return null;
  const [, seconds, fraction = "", zone] = match;
  const offset = zone === "Z" || zone.includes(":") ? zone : `${zone.slice(0, 3)}:${zone.slice(3)}`;
  const base = Date.parse(`${seconds}${offset}`);
  if (Number.isNaN(base)) return null;
  return base * 1000 + Number(fraction.slice(0, 6).padEnd(6, "0"));
}
```

- [ ] **Step 4: Run it and see it pass**

Run: `pnpm test tests/unit/sync/timestamps.test.ts`
Expected: 4 passed.

- [ ] **Step 5: Write the fake server**

Create `tests/unit/fakes/fake-supabase.ts`:

```ts
import { isoToMicros } from "@/lib/rxdb/sync/timestamps";

export type Row = Record<string, any>;
export interface FakeError {
  code: string;
  message: string;
  details: string | null;
  hint: string | null;
}
export interface FakeResponse {
  data: any;
  error: FakeError | null;
  status: number;
}
export interface ForeignKey {
  table: string;
  column: string;
  refTable: string;
}
export interface FakeServerOptions {
  /** Column names per table (local schema properties + server-only columns). */
  tables: Record<string, string[]>;
  foreignKeys?: ForeignKey[];
  /** Tables guarded by the scorer trigger (besides `matches`). */
  scorerTables?: string[];
}
export interface ClientContext {
  online?: () => boolean;
  userId?: string;
  userName?: string | null;
}
export type Fault = "network" | "timeout" | "jwt-expired" | "server-error";
export interface LoggedRequest {
  table: string;
  op: string;
  headers: Record<string, string>;
  ids: string[];
  status: number;
  code: string | null;
}

type Filter = (row: Row) => boolean;

function compare(a: unknown, b: unknown): number {
  if (a === null || a === undefined || b === null || b === undefined) {
    return (a ?? null) === (b ?? null) ? 0 : Number.NaN;
  }
  const am = isoToMicros(a);
  const bm = isoToMicros(b);
  if (am !== null && bm !== null) return am - bm;
  if (typeof a === "number" && typeof b === "number") return a - b;
  if (typeof a === "boolean" || typeof b === "boolean") return String(a) === String(b) ? 0 : Number.NaN;
  const as = String(a);
  const bs = String(b);
  return as === bs ? 0 : as < bs ? -1 : 1;
}

/** Parses the checkpoint filter `replication.ts` sends: `"m".gt.X,and("m".eq.X,"id".gt.Y)`. */
function parseCheckpointOr(expression: string): Filter {
  const match = /^"([^"]+)"\.gt\.([^,]+),and\("([^"]+)"\.eq\.([^,]+),"([^"]+)"\.gt\.([^)]+)\)$/.exec(expression);
  if (!match) throw new Error(`fake supabase: unsupported or() filter ${expression}`);
  const [, column, value, , , idColumn, id] = match;
  return (row) =>
    compare(row[column], value) > 0 || (compare(row[column], value) === 0 && compare(row[idColumn], id) > 0);
}

const ok = (data: unknown, status = 200): FakeResponse => ({ data, error: null, status });
const fail = (status: number, code: string, message: string, details: string | null = null): FakeResponse => ({
  data: null,
  error: { code, message, details, hint: null },
  status,
});
const networkError = (): FakeResponse => fail(0, "", "TypeError: Failed to fetch");

function faultResponse(fault: Fault): FakeResponse {
  switch (fault) {
    case "network":
      return networkError();
    case "timeout":
      return fail(0, "20", "AbortError: The operation was aborted.");
    case "jwt-expired":
      return fail(401, "PGRST303", "JWT expired");
    case "server-error":
      return fail(503, "", "Service Unavailable");
  }
}

export class FakeQuery implements PromiseLike<FakeResponse> {
  op: "select" | "insert" | "update" = "select";
  payload: Row | undefined;
  filters: Filter[] = [];
  orders: Array<{ column: string; ascending: boolean }> = [];
  max: number | undefined;
  returnRows = false;
  headers: Record<string, string> = {};
  private idFilters: string[] = [];

  constructor(
    private readonly server: FakeSupabaseServer,
    readonly table: string,
    readonly context: ClientContext
  ) {}

  select(_columns?: string): this {
    if (this.op !== "select") this.returnRows = true;
    return this;
  }
  insert(row: Row): this {
    this.op = "insert";
    this.payload = row;
    return this;
  }
  update(patch: Row): this {
    this.op = "update";
    this.payload = patch;
    return this;
  }
  eq(column: string, value: unknown): this {
    if (column === "id") this.idFilters.push(String(value));
    this.filters.push((row) => compare(row[column], value) === 0);
    return this;
  }
  is(column: string, value: unknown): this {
    this.filters.push((row) =>
      value === null ? row[column] === null || row[column] === undefined : row[column] === value
    );
    return this;
  }
  in(column: string, values: unknown[]): this {
    this.filters.push((row) => values.some((value) => compare(row[column], value) === 0));
    return this;
  }
  gt(column: string, value: unknown): this {
    this.filters.push((row) => compare(row[column], value) > 0);
    return this;
  }
  or(expression: string): this {
    this.filters.push(parseCheckpointOr(expression));
    return this;
  }
  order(column: string, options?: { ascending?: boolean }): this {
    this.orders.push({ column, ascending: options?.ascending !== false });
    return this;
  }
  limit(count: number): this {
    this.max = count;
    return this;
  }
  setHeader(name: string, value: string): this {
    this.headers[name.toLowerCase()] = value;
    return this;
  }
  ids(): string[] {
    return this.payload?.id ? [String(this.payload.id)] : this.idFilters;
  }
  then<A = FakeResponse, B = never>(
    onfulfilled?: ((value: FakeResponse) => A | PromiseLike<A>) | null,
    onrejected?: ((reason: unknown) => B | PromiseLike<B>) | null
  ): PromiseLike<A | B> {
    return this.server.delay().then(() => this.server.execute(this)).then(onfulfilled, onrejected);
  }
}

export class FakeRpc implements PromiseLike<FakeResponse> {
  headers: Record<string, string> = {};
  constructor(
    private readonly server: FakeSupabaseServer,
    readonly name: string,
    readonly params: Record<string, any>,
    readonly context: ClientContext
  ) {}
  setHeader(name: string, value: string): this {
    this.headers[name.toLowerCase()] = value;
    return this;
  }
  then<A = FakeResponse, B = never>(
    onfulfilled?: ((value: FakeResponse) => A | PromiseLike<A>) | null,
    onrejected?: ((reason: unknown) => B | PromiseLike<B>) | null
  ): PromiseLike<A | B> {
    return this.server.delay().then(() => this.server.executeRpc(this)).then(onfulfilled, onrejected);
  }
}

export class FakeSupabaseServer {
  readonly tables = new Map<string, Map<string, Row>>();
  readonly log: LoggedRequest[] = [];
  /** Whole server unreachable (every client). */
  offline = false;
  /** Delay before each request is processed. */
  latencyMs = 0;
  private readonly columns = new Map<string, Set<string>>();
  private readonly faults: Fault[] = [];
  private readonly lostResponses = new Set<string>();
  private readonly writeDenials = new Map<string, (row: Row) => boolean>();
  private lastMicros = 0;

  constructor(private readonly options: FakeServerOptions) {
    for (const [table, columns] of Object.entries(options.tables)) {
      this.tables.set(table, new Map());
      this.columns.set(table, new Set(columns));
    }
  }

  /** Strictly increasing server clock in Postgres' format (microseconds, +00:00). */
  now(): string {
    const micros = Math.max(Date.now() * 1000, this.lastMicros + 1);
    this.lastMicros = micros;
    const ms = Math.floor(micros / 1000);
    return `${new Date(ms).toISOString().slice(0, 23)}${String(micros % 1000).padStart(3, "0")}+00:00`;
  }

  client(context: ClientContext = {}): any {
    return {
      from: (table: string) => new FakeQuery(this, table, context),
      rpc: (name: string, params: Record<string, any>) => new FakeRpc(this, name, params, context),
    };
  }

  delay(): Promise<void> {
    return this.latencyMs > 0 ? new Promise((resolve) => setTimeout(resolve, this.latencyMs)) : Promise.resolve();
  }

  // ---- test controls ----
  failNext(...faults: Fault[]): void {
    this.faults.push(...faults);
  }
  loseNextResponse(table: string): void {
    this.lostResponses.add(table);
  }
  denyWrites(table: string, predicate: (row: Row) => boolean): void {
    this.writeDenials.set(table, predicate);
  }
  allowWrites(table: string): void {
    this.writeDenials.delete(table);
  }
  dropColumn(table: string, column: string): void {
    this.columns.get(table)!.delete(column);
  }
  row(table: string, id: string): Row | undefined {
    const row = this.tables.get(table)!.get(id);
    return row ? { ...row } : undefined;
  }
  rows(table: string, predicate: (row: Row) => boolean = () => true): Row[] {
    return [...this.tables.get(table)!.values()].filter(predicate).map((row) => ({ ...row }));
  }
  /** Inserts a row directly, as if it already existed on the server. */
  seed(table: string, row: Row): Row {
    const now = this.now();
    const full = { _deleted: false, created_at: now, updated_at: now, ...row, _modified: now };
    this.tables.get(table)!.set(full.id, full);
    return { ...full };
  }
  /** An edit made from another screen (API layer: no x-device-id header, so updated_at is bumped). */
  editAsWebsite(table: string, id: string, patch: Row): void {
    const row = this.tables.get(table)!.get(id);
    if (!row) throw new Error(`fake supabase: no ${table} row ${id}`);
    const now = this.now();
    Object.assign(row, patch, { updated_at: now, _modified: now });
  }
  hardDelete(table: string, id: string): void {
    this.tables.get(table)!.delete(id);
  }
  setScorer(matchId: string, scorer: { deviceId: string; userId?: string; name?: string | null; label?: string }): void {
    const match = this.tables.get("matches")!.get(matchId);
    if (!match) throw new Error(`fake supabase: no match ${matchId}`);
    const now = this.now();
    Object.assign(match, {
      scorer_device_id: scorer.deviceId,
      scorer_user_id: scorer.userId ?? "user-2",
      scorer_name: scorer.name ?? "Sam",
      scorer_device_label: scorer.label ?? "iPad",
      scorer_claimed_at: now,
      _modified: now,
    });
  }
  responseCodes(): string[] {
    return this.log.map((entry) => entry.code).filter((code): code is string => !!code);
  }

  // ---- request handling ----
  execute(query: FakeQuery): FakeResponse {
    const response = this.run(query);
    this.log.push({
      table: query.table,
      op: query.op,
      headers: { ...query.headers },
      ids: query.ids(),
      status: response.status,
      code: response.error?.code || null,
    });
    return response;
  }

  executeRpc(call: FakeRpc): FakeResponse {
    const response = this.runRpc(call);
    this.log.push({
      table: `rpc:${call.name}`,
      op: "rpc",
      headers: { ...call.headers },
      ids: [String(call.params.p_match_id ?? "")],
      status: response.status,
      code: response.error?.code || null,
    });
    return response;
  }

  private unreachable(context: ClientContext): FakeResponse | null {
    if (this.offline || context.online?.() === false) return networkError();
    const fault = this.faults.shift();
    return fault ? faultResponse(fault) : null;
  }

  private run(query: FakeQuery): FakeResponse {
    const blocked = this.unreachable(query.context);
    if (blocked) return blocked;
    const table = this.tables.get(query.table);
    if (!table) return fail(404, "42P01", `relation "public.${query.table}" does not exist`);
    if (query.op === "select") return this.select(query, table);
    if (query.op === "insert") return this.insert(query, table);
    return this.update(query, table);
  }

  private select(query: FakeQuery, table: Map<string, Row>): FakeResponse {
    let rows = [...table.values()].filter((row) => query.filters.every((filter) => filter(row)));
    for (const { column, ascending } of [...query.orders].reverse()) {
      rows.sort((a, b) => (ascending ? 1 : -1) * (compare(a[column], b[column]) || 0));
    }
    if (query.max !== undefined) rows = rows.slice(0, query.max);
    return ok(rows.map((row) => ({ ...row })));
  }

  private insert(query: FakeQuery, table: Map<string, Row>): FakeResponse {
    const deviceId = query.headers["x-device-id"] ?? null;
    const input = query.payload as Row;
    const unknown = this.unknownColumn(query.table, input);
    if (unknown) return fail(400, "PGRST204", `Could not find the '${unknown}' column of '${query.table}' in the schema cache`);
    if (table.has(input.id)) {
      return fail(409, "23505", "duplicate key value violates unique constraint", `Key (id)=(${input.id}) already exists.`);
    }
    if (this.writeDenials.get(query.table)?.(input)) {
      return fail(403, "42501", `new row violates row-level security policy for table "${query.table}"`);
    }
    const blocked = this.checkForeignKeys(query.table, input) ?? this.checkScorer(query.table, input, undefined, deviceId);
    if (blocked) return blocked;
    const now = this.now();
    const row: Row = { _deleted: false, created_at: now, updated_at: now, ...input, _modified: now };
    table.set(row.id, row);
    if (this.lostResponses.delete(query.table)) return networkError();
    return ok(query.returnRows ? [{ ...row }] : null, 201);
  }

  private update(query: FakeQuery, table: Map<string, Row>): FakeResponse {
    const deviceId = query.headers["x-device-id"] ?? null;
    const patch = query.payload as Row;
    const unknown = this.unknownColumn(query.table, patch);
    if (unknown) return fail(400, "PGRST204", `Could not find the '${unknown}' column of '${query.table}' in the schema cache`);
    const targets = [...table.values()].filter((row) => query.filters.every((filter) => filter(row)));
    const updated: Row[] = [];
    for (const previous of targets) {
      const next: Row = { ...previous, ...patch };
      if (this.writeDenials.get(query.table)?.(next)) {
        return fail(403, "42501", `new row violates row-level security policy for table "${query.table}"`);
      }
      const blocked = this.checkForeignKeys(query.table, next) ?? this.checkScorer(query.table, next, previous, deviceId);
      if (blocked) return blocked;
      const now = this.now();
      // update_updated_at_column(): only requests without x-device-id get the server time.
      if (!deviceId) next.updated_at = now;
      next._modified = now;
      table.set(next.id, next);
      updated.push({ ...next });
    }
    if (updated.length > 0 && this.lostResponses.delete(query.table)) return networkError();
    return ok(query.returnRows ? updated : null);
  }

  private runRpc(call: FakeRpc): FakeResponse {
    const blocked = this.unreachable(call.context);
    if (blocked) return blocked;
    const match = this.tables.get("matches")!.get(call.params.p_match_id);
    if (!match) return fail(400, "P0002", "match_not_found");
    if (call.name === "get_match_scorer") return ok(this.scorerInfo(match));
    if (call.name === "claim_match_scorer") {
      const free = !match.scorer_device_id || match.scorer_device_id === call.params.p_device_id;
      if (free || call.params.p_force) {
        const now = this.now();
        Object.assign(match, {
          scorer_device_id: call.params.p_device_id,
          scorer_user_id: call.context.userId ?? "user-1",
          scorer_name: call.context.userName === undefined ? "Alex" : call.context.userName,
          scorer_device_label: call.params.p_label,
          scorer_claimed_at: now,
          _modified: now,
        });
        return ok({ claimed: true, ...this.scorerInfo(match) });
      }
      return ok({ claimed: false, ...this.scorerInfo(match) });
    }
    return fail(404, "PGRST202", `Could not find the function public.${call.name}`);
  }

  private scorerInfo(match: Row): Row {
    const times = [
      match._modified,
      ...["sets", "score_points", "player_stats", "events"].flatMap((table) =>
        this.rows(table, (row) => row.match_id === match.id).map((row) => row._modified)
      ),
    ].filter(Boolean);
    times.sort((a, b) => compare(a, b));
    return {
      scorer_device_id: match.scorer_device_id ?? null,
      scorer_user_id: match.scorer_user_id ?? null,
      scorer_name: match.scorer_name ?? null,
      scorer_device_label: match.scorer_device_label ?? null,
      scorer_claimed_at: match.scorer_claimed_at ?? null,
      last_activity_at: times.at(-1) ?? null,
    };
  }

  private checkScorer(table: string, next: Row, previous: Row | undefined, deviceId: string | null): FakeResponse | null {
    if (!deviceId) return null;
    const mismatch = fail(400, "P0001", "scorer_mismatch");
    if (table === "matches") {
      if (!previous?.scorer_device_id) return null;
      if (next.scorer_device_id !== previous.scorer_device_id) return null; // a claim
      return previous.scorer_device_id !== deviceId ? mismatch : null;
    }
    if (!this.options.scorerTables?.includes(table)) return null;
    const scorer = this.tables.get("matches")?.get(next.match_id)?.scorer_device_id;
    return scorer && scorer !== deviceId ? mismatch : null;
  }

  private checkForeignKeys(table: string, row: Row): FakeResponse | null {
    for (const fk of this.options.foreignKeys ?? []) {
      if (fk.table !== table) continue;
      const value = row[fk.column];
      if (value === null || value === undefined) continue;
      if (!this.tables.get(fk.refTable)?.has(value)) {
        return fail(
          409,
          "23503",
          `insert or update on table "${table}" violates foreign key constraint "${table}_${fk.column}_fkey"`,
          `Key (${fk.column})=(${value}) is not present in table "${fk.refTable}".`
        );
      }
    }
    return null;
  }

  private unknownColumn(table: string, row: Row): string | null {
    const columns = this.columns.get(table)!;
    return Object.keys(row).find((key) => !columns.has(key)) ?? null;
  }
}
```

- [ ] **Step 6: Add the test helpers**

Create `tests/unit/helpers/server.ts`:

```ts
import {
  championshipSchema,
  clubMemberSchema,
  clubSchema,
  eventSchema,
  matchFormatSchema,
  matchSchema,
  playerSchema,
  playerStatSchema,
  scorePointSchema,
  seasonSchema,
  setSchema,
  teamSchema,
} from "@/lib/rxdb/schema";
import { FakeSupabaseServer, type ForeignKey } from "../fakes/fake-supabase";

const SCHEMAS: Record<string, { properties: Record<string, unknown> }> = {
  championships: championshipSchema,
  seasons: seasonSchema,
  match_formats: matchFormatSchema,
  clubs: clubSchema,
  club_members: clubMemberSchema,
  teams: teamSchema,
  team_members: playerSchema,
  matches: matchSchema,
  sets: setSchema,
  score_points: scorePointSchema,
  player_stats: playerStatSchema,
  events: eventSchema,
};

export const SCORER_COLUMNS = [
  "scorer_device_id",
  "scorer_user_id",
  "scorer_name",
  "scorer_device_label",
  "scorer_claimed_at",
];

/** The real foreign keys of the match tables (spec, "Verification findings"). */
export const FOREIGN_KEYS: ForeignKey[] = [
  { table: "sets", column: "match_id", refTable: "matches" },
  { table: "player_stats", column: "match_id", refTable: "matches" },
  { table: "player_stats", column: "set_id", refTable: "sets" },
  { table: "player_stats", column: "player_id", refTable: "team_members" },
  { table: "player_stats", column: "team_id", refTable: "teams" },
  { table: "score_points", column: "match_id", refTable: "matches" },
  { table: "score_points", column: "set_id", refTable: "sets" },
  { table: "score_points", column: "player_id", refTable: "team_members" },
  { table: "events", column: "match_id", refTable: "matches" },
  { table: "events", column: "set_id", refTable: "sets" },
  { table: "events", column: "player_id", refTable: "team_members" },
];

export function createFakeServer(): FakeSupabaseServer {
  const tables: Record<string, string[]> = {};
  for (const [name, schema] of Object.entries(SCHEMAS)) {
    tables[name] = [...Object.keys(schema.properties), "_modified", ...(name === "matches" ? SCORER_COLUMNS : [])];
  }
  return new FakeSupabaseServer({
    tables,
    foreignKeys: FOREIGN_KEYS,
    scorerTables: ["sets", "score_points", "player_stats", "events"],
  });
}
```

Create `tests/unit/helpers/fixtures.ts`:

```ts
import { randomUUID } from "node:crypto";
import type { FakeSupabaseServer } from "../fakes/fake-supabase";

export const USER_ID = "user-1";
export const HOME_TEAM_ID = "10000000-0000-4000-8000-000000000001";
export const AWAY_TEAM_ID = "10000000-0000-4000-8000-000000000002";
export const PLAYER_ID = "10000000-0000-4000-8000-000000000003";
export const FORMAT_ID = "10000000-0000-4000-8000-000000000004";

const nowIso = () => new Date().toISOString();

export function seedTeams(server: FakeSupabaseServer): void {
  server.seed("teams", { id: HOME_TEAM_ID, name: "Home", status: "active", user_id: USER_ID });
  server.seed("teams", { id: AWAY_TEAM_ID, name: "Away", status: "active", user_id: null });
  server.seed("team_members", { id: PLAYER_ID, team_id: HOME_TEAM_ID, name: "Player 7", number: 7, role: "player" });
}

export function seedServerMatch(server: FakeSupabaseServer, overrides: Record<string, unknown> = {}): string {
  const id = randomUUID();
  server.seed("matches", {
    id,
    date: nowIso(),
    home_team_id: HOME_TEAM_ID,
    away_team_id: AWAY_TEAM_ID,
    match_format_id: FORMAT_ID,
    status: "live",
    home_score: 0,
    away_score: 0,
    home_available_players: [PLAYER_ID],
    away_available_players: [],
    ...overrides,
  });
  return id;
}

export function aSet(matchId: string, overrides: Record<string, unknown> = {}) {
  const t = nowIso();
  return {
    id: randomUUID(),
    match_id: matchId,
    set_number: 1,
    home_score: 0,
    away_score: 0,
    status: "live",
    first_server_team_id: HOME_TEAM_ID,
    server_team_id: HOME_TEAM_ID,
    first_lineup: { p1: PLAYER_ID },
    current_lineup: { p1: PLAYER_ID },
    player_roles: {},
    created_at: t,
    updated_at: t,
    ...overrides,
  };
}

export function aPlayerStat(matchId: string, setId: string, overrides: Record<string, unknown> = {}) {
  const t = nowIso();
  return {
    id: randomUUID(),
    match_id: matchId,
    set_id: setId,
    team_id: HOME_TEAM_ID,
    player_id: PLAYER_ID,
    position: null,
    stat_type: "spike",
    result: "success",
    created_at: t,
    updated_at: t,
    ...overrides,
  };
}

export function aScorePoint(matchId: string, setId: string, pointNumber: number, overrides: Record<string, unknown> = {}) {
  const t = nowIso();
  return {
    id: randomUUID(),
    match_id: matchId,
    set_id: setId,
    point_number: pointNumber,
    player_stat_id: null,
    scoring_team_id: HOME_TEAM_ID,
    action_team_id: HOME_TEAM_ID,
    result: "success",
    point_type: "spike",
    player_id: PLAYER_ID,
    timestamp: t,
    home_score: pointNumber,
    away_score: 0,
    current_rotation: { p1: PLAYER_ID },
    created_at: t,
    updated_at: t,
    ...overrides,
  };
}

export function anEvent(matchId: string, setId: string | null, overrides: Record<string, unknown> = {}) {
  const t = nowIso();
  return {
    id: randomUUID(),
    match_id: matchId,
    set_id: setId,
    team_id: HOME_TEAM_ID,
    event_type: "comment",
    timestamp: t,
    team: "home",
    player_id: null,
    comment: "note",
    details: {},
    home_score: 0,
    away_score: 0,
    point_number: null,
    created_at: t,
    updated_at: t,
    ...overrides,
  };
}
```

Create `tests/unit/helpers/wait.ts`:

```ts
export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function waitFor(
  check: () => boolean | Promise<boolean>,
  { timeoutMs = 8000, intervalMs = 20, message = "condition" }: { timeoutMs?: number; intervalMs?: number; message?: string } = {}
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await check()) return;
    await sleep(intervalMs);
  }
  throw new Error(`Timed out after ${timeoutMs} ms waiting for ${message}`);
}
```

- [ ] **Step 7: Write the fake's own tests**

Create `tests/unit/fakes/fake-supabase.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createFakeServer } from "../helpers/server";
import { aSet, seedServerMatch, seedTeams } from "../helpers/fixtures";

describe("fake supabase server", () => {
  it("paginates with the _modified/id checkpoint filter", async () => {
    const server = createFakeServer();
    seedTeams(server);
    const matchId = seedServerMatch(server);
    for (let i = 0; i < 3; i++) server.seed("sets", aSet(matchId, { set_number: i + 1 }));
    const client = server.client();
    const first = await client.from("sets").select("*").order("_modified", { ascending: true }).order("id", { ascending: true }).limit(2);
    expect(first.data).toHaveLength(2);
    const last = first.data[1];
    const next = await client
      .from("sets")
      .select("*")
      .or(`"_modified".gt.${last._modified},and("_modified".eq.${last._modified},"id".gt.${last.id})`)
      .order("_modified", { ascending: true })
      .order("id", { ascending: true })
      .limit(2);
    expect(next.data.map((row: any) => row.set_number)).toEqual([3]);
  });

  it("keeps the device's updated_at when x-device-id is sent and bumps it otherwise", async () => {
    const server = createFakeServer();
    seedTeams(server);
    const matchId = seedServerMatch(server);
    const set = server.seed("sets", aSet(matchId, { updated_at: "2026-01-01T00:00:00.000Z" }));
    const client = server.client();
    await client.from("sets").update({ home_score: 1, updated_at: "2026-01-02T00:00:00.000Z" }).eq("id", set.id).setHeader("x-device-id", "d1");
    expect(server.row("sets", set.id)!.updated_at).toBe("2026-01-02T00:00:00.000Z");
    await client.from("sets").update({ home_score: 2 }).eq("id", set.id);
    expect(server.row("sets", set.id)!.updated_at).not.toBe("2026-01-02T00:00:00.000Z");
  });

  it("reports a missing parent as 23503 naming the referenced table", async () => {
    const server = createFakeServer();
    const response = await server.client().from("sets").insert(aSet("00000000-0000-4000-8000-00000000dead"));
    expect(response.error?.code).toBe("23503");
    expect(response.error?.details).toContain('table "matches"');
  });

  it("rejects writes from a device that is not the match's scorer", async () => {
    const server = createFakeServer();
    seedTeams(server);
    const matchId = seedServerMatch(server);
    server.setScorer(matchId, { deviceId: "device-b" });
    const response = await server.client().from("sets").insert(aSet(matchId)).setHeader("x-device-id", "device-a");
    expect(response.error).toMatchObject({ code: "P0001", message: "scorer_mismatch" });
  });

  it("commits a write whose response is lost", async () => {
    const server = createFakeServer();
    seedTeams(server);
    const matchId = seedServerMatch(server);
    const set = aSet(matchId);
    server.loseNextResponse("sets");
    const response = await server.client().from("sets").insert(set);
    expect(response.status).toBe(0);
    expect(server.row("sets", set.id)).toBeDefined();
  });
});
```

- [ ] **Step 8: Run all unit tests**

Run: `pnpm test`
Expected: all pass (helper 2, timestamps 4, fake 5).

- [ ] **Step 9: Commit**

```bash
git add lib/rxdb/sync/timestamps.ts tests/unit
git commit -m "test(sync): add a fake Supabase server and microsecond timestamps

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---
### Task 3: Server migration (checkpoint column, edit-time rule, scorer claim)

**Files:**
- Create: `supabase/migrations/20261007000000_sync_reliability.sql`
- Modify: `lib/supabase/database.types.ts` (regenerated)

**Interfaces:**
- Produces, on the server:
  - a `_modified` column on all 12 synced tables
  - `public.request_device_id()`
  - `public.get_match_scorer(p_match_id uuid) → jsonb` (keys `scorer_device_id`, `scorer_user_id`, `scorer_name`, `scorer_device_label`, `scorer_claimed_at`, `last_activity_at`)
  - `public.claim_match_scorer(p_match_id uuid, p_device_id text, p_label text, p_force boolean) → jsonb`, returning the same keys plus `claimed`
  - error `P0001 scorer_mismatch` from the scorer trigger

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20261007000000_sync_reliability.sql`:

```sql
-- Offline sync reliability (docs/superpowers/specs/2026-10-07-offline-sync-reliability-design.md, section 1).

-- The x-device-id header sent by the app's sync code; NULL for every other request.
CREATE OR REPLACE FUNCTION public.request_device_id()
RETURNS text
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT nullif(current_setting('request.headers', true)::json ->> 'x-device-id', '')
$$;

-- 1. _modified: server-clock replication checkpoint, set on every insert and update.
--    Not part of the app's local schemas.
CREATE OR REPLACE FUNCTION public.set_modified_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW._modified = now();
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'clubs', 'club_members', 'teams', 'team_members', 'championships', 'seasons',
    'match_formats', 'matches', 'sets', 'score_points', 'player_stats', 'events'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS _modified timestamptz NOT NULL DEFAULT now()', t);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I (_modified, id)', t || '_modified_id_idx', t);
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', 'set_' || t || '_modified', t);
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_modified_column()',
      'set_' || t || '_modified', t
    );
  END LOOP;
END $$;

-- 2. updated_at = time of the last edit. Sync requests (x-device-id) send the device's
--    edit time and the server keeps it; other requests (API layer) get the server time.
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF public.request_device_id() IS NULL THEN
    NEW.updated_at = now();
  END IF;
  RETURN NEW;
END;
$$;

-- 3. Scoring device per match.
ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS scorer_device_id text,
  ADD COLUMN IF NOT EXISTS scorer_user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS scorer_name text,
  ADD COLUMN IF NOT EXISTS scorer_device_label text,
  ADD COLUMN IF NOT EXISTS scorer_claimed_at timestamptz;

CREATE INDEX IF NOT EXISTS matches_scorer_user_id_idx ON public.matches (scorer_user_id);

CREATE OR REPLACE FUNCTION public.get_match_scorer(p_match_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT jsonb_build_object(
    'scorer_device_id', m.scorer_device_id,
    'scorer_user_id', m.scorer_user_id,
    'scorer_name', m.scorer_name,
    'scorer_device_label', m.scorer_device_label,
    'scorer_claimed_at', m.scorer_claimed_at,
    'last_activity_at', greatest(
      m._modified,
      (SELECT max(s._modified) FROM public.sets s WHERE s.match_id = m.id),
      (SELECT max(p._modified) FROM public.score_points p WHERE p.match_id = m.id),
      (SELECT max(ps._modified) FROM public.player_stats ps WHERE ps.match_id = m.id),
      (SELECT max(e._modified) FROM public.events e WHERE e.match_id = m.id)
    )
  )
  FROM public.matches m
  WHERE m.id = p_match_id
$$;

CREATE OR REPLACE FUNCTION public.claim_match_scorer(
  p_match_id uuid,
  p_device_id text,
  p_label text,
  p_force boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_current text;
  v_name text;
BEGIN
  SELECT m.scorer_device_id INTO v_current FROM public.matches m WHERE m.id = p_match_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'match_not_found';
  END IF;

  IF v_current IS NULL OR v_current = p_device_id OR p_force THEN
    -- Profiles are only readable by their owner, so the name is stored on the match.
    SELECT nullif(trim(concat_ws(' ', p.first_name, p.last_name)), '')
      INTO v_name
      FROM public.profiles p
     WHERE p.id = auth.uid();
    UPDATE public.matches
       SET scorer_device_id = p_device_id,
           scorer_user_id = auth.uid(),
           scorer_name = v_name,
           scorer_device_label = p_label,
           scorer_claimed_at = now()
     WHERE id = p_match_id;
    RETURN jsonb_build_object('claimed', true) || public.get_match_scorer(p_match_id);
  END IF;

  RETURN jsonb_build_object('claimed', false) || public.get_match_scorer(p_match_id);
END;
$$;

REVOKE ALL ON FUNCTION public.get_match_scorer(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.claim_match_scorer(uuid, text, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_match_scorer(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_match_scorer(uuid, text, text, boolean) TO authenticated;

-- 4. Only the scoring device may write a claimed match's data (sync requests only).
CREATE OR REPLACE FUNCTION public.enforce_match_scorer()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_device text := public.request_device_id();
  v_scorer text;
BEGIN
  IF v_device IS NULL THEN
    RETURN NEW;
  END IF;
  IF TG_TABLE_NAME = 'matches' THEN
    IF NEW.scorer_device_id IS DISTINCT FROM OLD.scorer_device_id THEN
      RETURN NEW; -- a claim (claim_match_scorer)
    END IF;
    v_scorer := OLD.scorer_device_id;
  ELSE
    SELECT m.scorer_device_id INTO v_scorer FROM public.matches m WHERE m.id = NEW.match_id;
  END IF;
  IF v_scorer IS NOT NULL AND v_scorer <> v_device THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'scorer_mismatch';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_matches_scorer ON public.matches;
CREATE TRIGGER enforce_matches_scorer
  BEFORE UPDATE ON public.matches
  FOR EACH ROW EXECUTE FUNCTION public.enforce_match_scorer();

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['sets', 'score_points', 'player_stats', 'events'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', 'enforce_' || t || '_scorer', t);
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.enforce_match_scorer()',
      'enforce_' || t || '_scorer', t
    );
  END LOOP;
END $$;
```

- [ ] **Step 2: Check the migration against the current app**

Go through this list and confirm each item before asking to apply:
- Old app versions send no `x-device-id` header, so `update_updated_at_column()` still bumps `updated_at` for them, the scorer triggers don't apply to them, and their behaviour is unchanged.
- `_modified` and the `scorer_*` columns are new columns in `select('*')` results. Old versions only tolerate them once Task 1 is deployed.
- `profiles` also uses `update_updated_at_column()`. Its requests have no header, so it keeps being bumped.

- [ ] **Step 3: Ask before touching production**

Ask the user in the conversation, and wait for an explicit yes:
> "Task 1 (ignore unknown server columns) has to be live in production before I apply the migration. Is it deployed? Then may I apply `supabase/migrations/20261007000000_sync_reliability.sql` to project `gvtjccisbwrwpjtabnyd`?"

Do not continue to Step 4 without a yes to both questions. While waiting, you may work on Tasks 4–12, which only use the fake server.

- [ ] **Step 4: Apply the migration**

Use the Supabase MCP tool `apply_migration`:
- `project_id`: `gvtjccisbwrwpjtabnyd`
- `name`: `sync_reliability`
- `query`: the file's full content

Expected: success.

- [ ] **Step 5: Verify the result**

Run each of these with the Supabase MCP tool `execute_sql` (project `gvtjccisbwrwpjtabnyd`):

```sql
SELECT count(*) AS tables_with_modified FROM information_schema.columns
WHERE table_schema = 'public' AND column_name = '_modified';
```
Expected: `12`.

```sql
SELECT count(DISTINCT trigger_name) AS triggers FROM information_schema.triggers
WHERE trigger_schema = 'public' AND (trigger_name LIKE 'set\_%\_modified' OR trigger_name LIKE 'enforce\_%\_scorer');
```
Expected: `17` (12 `set_*_modified` + 5 `enforce_*_scorer`).

```sql
SELECT proname FROM pg_proc
WHERE pronamespace = 'public'::regnamespace
  AND proname IN ('request_device_id', 'set_modified_column', 'get_match_scorer', 'claim_match_scorer', 'enforce_match_scorer')
ORDER BY 1;
```
Expected: 5 rows.

Then run the Supabase MCP tool `get_advisors` with `type: "security"`. Expected: no new warning about the five functions above. A "function search_path mutable" warning for `update_updated_at_column`, if present, predates this change (the function already had no `search_path`).

- [ ] **Step 6: Regenerate the database types**

Run the Supabase MCP tool `generate_typescript_types` for project `gvtjccisbwrwpjtabnyd`, and write its output to `lib/supabase/database.types.ts`. If the CLI is logged in, `pnpm supabase:types` does the same.
Expected: `matches` rows gain `_modified` and the `scorer_*` fields, and `Functions` gains `claim_match_scorer` and `get_match_scorer`.

Run: `pnpm build`
Expected: succeeds.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/20261007000000_sync_reliability.sql lib/supabase/database.types.ts
git commit -m "feat(db): add replication checkpoint column and scoring-device claim

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Classify push errors

**Files:**
- Create: `lib/rxdb/sync/errors.ts`
- Test: `tests/unit/sync/errors.test.ts`

**Interfaces:**
- Produces:

```ts
export type SyncErrorKind = "temporary" | "permanent" | "superseded";
export type SyncErrorCode =
  | "network" | "auth" | "server" | "parent_missing" | "unknown"
  | "scorer_mismatch"
  | "rls" | "invalid_data" | "schema_mismatch" | "duplicate" | "reference_missing"
  | "deleted_on_server" | "parent_rejected" | "too_many_attempts";
export interface ClassifiedError { kind: SyncErrorKind; code: SyncErrorCode; params?: Record<string, string> }
export interface PostgrestLikeError { code?: string; message?: string; details?: string | null }
export const MAX_TEMPORARY_ATTEMPTS = 20;
export function classifyPushError(error: PostgrestLikeError, status: number): ClassifiedError;
export function countsTowardsAttemptLimit(code: SyncErrorCode): boolean;
export function referencedTable(details: string | null | undefined): string | null;
```

- [ ] **Step 1: Write the failing test**

Create `tests/unit/sync/errors.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { classifyPushError, countsTowardsAttemptLimit, referencedTable } from "@/lib/rxdb/sync/errors";

describe("classifyPushError", () => {
  it.each([
    [{ code: "", message: "TypeError: Failed to fetch" }, 0, "temporary", "network"],
    [{ code: "20", message: "AbortError: The operation was aborted." }, 0, "temporary", "network"],
    [{ code: "", message: "Request Timeout" }, 408, "temporary", "network"],
    [{ code: "PGRST303", message: "JWT expired" }, 401, "temporary", "auth"],
    [{ code: "PGRST301", message: "JWSError" }, 401, "temporary", "auth"],
    [{ code: "", message: "Service Unavailable" }, 503, "temporary", "server"],
    [{ code: "", message: "Too Many Requests" }, 429, "temporary", "server"],
    [{ code: "23503", message: "fk", details: 'Key (set_id)=(x) is not present in table "sets".' }, 409, "temporary", "parent_missing"],
    [{ code: "23503", message: "fk", details: 'Key (match_id)=(x) is not present in table "matches".' }, 409, "temporary", "parent_missing"],
    [{ code: "23503", message: "fk", details: 'Key (player_id)=(x) is not present in table "team_members".' }, 409, "permanent", "reference_missing"],
    [{ code: "P0001", message: "scorer_mismatch" }, 400, "superseded", "scorer_mismatch"],
    [{ code: "42501", message: "rls" }, 403, "permanent", "rls"],
    [{ code: "PGRST204", message: "column" }, 400, "permanent", "schema_mismatch"],
    [{ code: "42703", message: "column" }, 400, "permanent", "schema_mismatch"],
    [{ code: "23514", message: "check" }, 400, "permanent", "invalid_data"],
    [{ code: "23502", message: "not null" }, 400, "permanent", "invalid_data"],
    [{ code: "22P02", message: "invalid uuid" }, 400, "permanent", "invalid_data"],
    [{ code: "23505", message: "duplicate" }, 409, "permanent", "duplicate"],
    [{ code: "row_missing", message: "row_missing" }, 404, "permanent", "deleted_on_server"],
    [{ code: "XX000", message: "internal" }, 400, "temporary", "unknown"],
  ] as const)("%o with status %i is %s/%s", (error, status, kind, code) => {
    expect(classifyPushError(error, status)).toMatchObject({ kind, code });
  });

  it("names the missing external table", () => {
    const result = classifyPushError(
      { code: "23503", message: "fk", details: 'Key (player_id)=(x) is not present in table "team_members".' },
      409
    );
    expect(result.params).toEqual({ table: "team_members" });
  });
});

describe("countsTowardsAttemptLimit", () => {
  it("only counts errors that connectivity can't explain", () => {
    expect(countsTowardsAttemptLimit("parent_missing")).toBe(true);
    expect(countsTowardsAttemptLimit("unknown")).toBe(true);
    expect(countsTowardsAttemptLimit("network")).toBe(false);
    expect(countsTowardsAttemptLimit("auth")).toBe(false);
    expect(countsTowardsAttemptLimit("server")).toBe(false);
  });
});

describe("referencedTable", () => {
  it("reads the table from Postgres' FK details", () => {
    expect(referencedTable('Key (set_id)=(1) is not present in table "sets".')).toBe("sets");
    expect(referencedTable(null)).toBeNull();
  });
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `pnpm test tests/unit/sync/errors.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement**

Create `lib/rxdb/sync/errors.ts`:

```ts
export type SyncErrorKind = "temporary" | "permanent" | "superseded";
export type SyncErrorCode =
  | "network"
  | "auth"
  | "server"
  | "parent_missing"
  | "unknown"
  | "scorer_mismatch"
  | "rls"
  | "invalid_data"
  | "schema_mismatch"
  | "duplicate"
  | "reference_missing"
  | "deleted_on_server"
  | "parent_rejected"
  | "too_many_attempts";

export interface ClassifiedError {
  kind: SyncErrorKind;
  code: SyncErrorCode;
  params?: Record<string, string>;
}

/** The error object supabase-js returns (PostgrestError), or the adapter's own `row_missing`. */
export interface PostgrestLikeError {
  code?: string;
  message?: string;
  details?: string | null;
}

/** After this many failures that connectivity can't explain, a row is rejected. */
export const MAX_TEMPORARY_ATTEMPTS = 20;

/** Tables of the same match: a missing parent there arrives through its own replication. */
const IN_MATCH_TABLES = new Set(["matches", "sets", "player_stats"]);

export function referencedTable(details: string | null | undefined): string | null {
  const match = /is not present in table "([^"]+)"/.exec(details ?? "");
  return match ? match[1] : null;
}

export function classifyPushError(error: PostgrestLikeError, status: number): ClassifiedError {
  const code = error.code ?? "";
  const message = error.message ?? "";

  if (code === "P0001" && message === "scorer_mismatch") return { kind: "superseded", code: "scorer_mismatch" };
  if (code === "row_missing") return { kind: "permanent", code: "deleted_on_server" };
  if (code === "23503") {
    const table = referencedTable(error.details);
    if (table && IN_MATCH_TABLES.has(table)) return { kind: "temporary", code: "parent_missing", params: { table } };
    return { kind: "permanent", code: "reference_missing", params: { table: table ?? "unknown" } };
  }
  if (code === "42501") return { kind: "permanent", code: "rls" };
  if (code === "23505") return { kind: "permanent", code: "duplicate" };
  if (code === "42703" || code === "PGRST204") return { kind: "permanent", code: "schema_mismatch" };
  if (code === "23514" || code === "23502" || code.startsWith("22")) return { kind: "permanent", code: "invalid_data" };
  if (status === 401 || code === "PGRST301" || code === "PGRST303" || /jwt expired/i.test(message)) {
    return { kind: "temporary", code: "auth" };
  }
  if (status === 0 || status === 408) return { kind: "temporary", code: "network" };
  if (status === 429 || status >= 500) return { kind: "temporary", code: "server" };
  return { kind: "temporary", code: "unknown" };
}

/** Network, auth and server outages never turn into rejections, however long they last. */
export function countsTowardsAttemptLimit(code: SyncErrorCode): boolean {
  return code === "parent_missing" || code === "unknown";
}
```

- [ ] **Step 4: Run it and see it pass**

Run: `pnpm test tests/unit/sync/errors.test.ts`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add lib/rxdb/sync/errors.ts tests/unit/sync/errors.test.ts
git commit -m "feat(sync): classify push errors as temporary, permanent or superseded

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Conflict handler (the scoring device wins)

**Files:**
- Create: `lib/rxdb/sync/conflict-handler.ts`
- Test: `tests/unit/sync/conflict-handler.test.ts`

**Interfaces:**
- Consumes: `isoToMicros` (Task 2).
- Produces: `docsEqual(a: unknown, b: unknown): boolean`, `updatedAtMicros(doc: { updated_at?: unknown }): number`, `matchConflictHandler: RxConflictHandler<any>`.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/sync/conflict-handler.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { docsEqual, matchConflictHandler } from "@/lib/rxdb/sync/conflict-handler";

const base = {
  id: "s1",
  home_score: 3,
  current_lineup: { p1: "a", p2: "b" },
  updated_at: "2026-10-07T10:00:00.123Z",
  _deleted: false,
};

describe("docsEqual", () => {
  it("treats Postgres and JavaScript timestamps of the same instant as equal", () => {
    expect(docsEqual(base, { ...base, updated_at: "2026-10-07T10:00:00.123+00:00" })).toBe(true);
    expect(docsEqual(base, { ...base, updated_at: "2026-10-07T10:00:00.123000+00:00" })).toBe(true);
  });

  it("sees a one-microsecond difference", () => {
    expect(
      docsEqual(
        { ...base, updated_at: "2026-10-07T10:00:00.123456+00:00" },
        { ...base, updated_at: "2026-10-07T10:00:00.123457+00:00" }
      )
    ).toBe(false);
  });

  it("compares a timestamptz column with its string copy as instants", () => {
    expect(docsEqual({ date: "2026-10-07T18:30:00+00:00" }, { date: "2026-10-07T18:30:00.000Z" })).toBe(true);
  });

  it("ignores _modified, _meta, _rev and _attachments", () => {
    expect(docsEqual(base, { ...base, _modified: "x", _meta: { lwt: 1 }, _rev: "1-a", _attachments: {} })).toBe(true);
  });

  it("treats a missing field and null as equal", () => {
    expect(docsEqual({ ...base, comment: null }, base)).toBe(true);
  });

  it("ignores key order inside nested objects", () => {
    expect(docsEqual(base, { ...base, current_lineup: { p2: "b", p1: "a" } })).toBe(true);
  });

  it("sees a changed score", () => {
    expect(docsEqual(base, { ...base, home_score: 4 })).toBe(false);
  });
});

describe("matchConflictHandler.resolve", () => {
  const server = { ...base, home_score: 1, updated_at: "2026-10-07T11:00:00.000000+00:00" };

  it("keeps the device's version when the device knew a previous server version", async () => {
    const local = { ...base, home_score: 5 };
    const resolved = await matchConflictHandler.resolve(
      { newDocumentState: local, assumedMasterState: { ...base }, realMasterState: server },
      "test"
    );
    expect(resolved).toEqual(local);
  });

  it("keeps the newer edit when the device has no record of the server version", async () => {
    const newerLocal = { ...base, home_score: 5, updated_at: "2026-10-07T12:00:00.000Z" };
    expect(await matchConflictHandler.resolve({ newDocumentState: newerLocal, realMasterState: server }, "test")).toEqual(newerLocal);
    const olderLocal = { ...base, home_score: 5, updated_at: "2026-10-07T09:00:00.000Z" };
    expect(await matchConflictHandler.resolve({ newDocumentState: olderLocal, realMasterState: server }, "test")).toEqual(server);
  });

  it("keeps the server version on a tie", async () => {
    const local = { ...server, home_score: 9, updated_at: "2026-10-07T11:00:00.000Z" };
    expect(await matchConflictHandler.resolve({ newDocumentState: local, realMasterState: server }, "test")).toEqual(server);
  });
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `pnpm test tests/unit/sync/conflict-handler.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement**

Create `lib/rxdb/sync/conflict-handler.ts`:

```ts
import type { RxConflictHandler } from "rxdb";
import { isoToMicros } from "./timestamps";

const IGNORED_FIELDS = new Set(["_meta", "_rev", "_attachments", "_modified"]);

function normalize(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  const micros = isoToMicros(value);
  if (micros !== null) return `ts:${micros}`;
  if (Array.isArray(value)) return value.map(normalize);
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      if (IGNORED_FIELDS.has(key)) continue;
      const normalized = normalize((value as Record<string, unknown>)[key]);
      if (normalized !== null) out[key] = normalized;
    }
    return out;
  }
  return value;
}

/**
 * Field-by-field equality of two row versions: timestamps compared as
 * instants (Postgres returns `+00:00` and microseconds, the device writes `Z`
 * and milliseconds), missing equals null, server-only and RxDB bookkeeping
 * fields ignored.
 */
export function docsEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(normalize(a)) === JSON.stringify(normalize(b));
}

export function updatedAtMicros(doc: { updated_at?: unknown }): number {
  return isoToMicros(doc.updated_at) ?? 0;
}

/**
 * One scoring device per match (spec section 3):
 * - the device knew a previous server version → the device's version wins;
 * - no record of the server version (retry after an interrupted push, first
 *   push after the upgrade) → the later `updated_at` wins, ties to the server.
 */
export const matchConflictHandler: RxConflictHandler<any> = {
  isEqual: (a, b) => docsEqual(a, b),
  resolve: async ({ newDocumentState, assumedMasterState, realMasterState }) => {
    if (assumedMasterState) return newDocumentState;
    return updatedAtMicros(newDocumentState) > updatedAtMicros(realMasterState) ? newDocumentState : realMasterState;
  },
};
```

- [ ] **Step 4: Run it and see it pass**

Run: `pnpm test tests/unit/sync/conflict-handler.test.ts`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add lib/rxdb/sync/conflict-handler.ts tests/unit/sync/conflict-handler.test.ts
git commit -m "feat(sync): resolve match data conflicts in favour of the scoring device

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Shared collection setup and the `pending_changes` store

**Files:**
- Modify: `lib/rxdb/sync/types.ts` (add the shared constants and `SyncUser`; keep the old exports until Task 12)
- Create: `lib/rxdb/sync/pending-changes.ts`
- Create: `lib/rxdb/collections.ts`
- Modify: `lib/rxdb/database.ts` (use `setupCollections`)
- Create: `tests/unit/helpers/test-db.ts`
- Test: `tests/unit/sync/pending-changes.test.ts`

**Interfaces:**
- Consumes: `matchConflictHandler` (Task 5), `isoToMicros` (Task 2), `ClassifiedError` (Task 4).
- Produces in `types.ts`: `MATCH_COLLECTIONS`, `MatchCollectionName`, `REFERENCE_COLLECTIONS`, `ReferenceCollectionName`, `SyncUser { id: string; teamIds: string[]; clubIds: string[] }`.
- Produces in `pending-changes.ts`:
  - types `PendingStatus`, `PendingChange`, `PendingDoc`, `PendingFilter`, and `pendingChangeSchema`
  - `pendingId(table, docId)`, `matchIdOf(table, doc)`, `installPendingHooks(db, pending)`
  - `class PendingChanges`:
    - `markPending(table, doc, opts?: { insert: boolean })`, `onSent(table, doc)`
    - `reject(table, doc, error, { neverUploaded })`
    - `supersede(table, doc)`, `supersedeMatch(matchId)`
    - `recordAttempt(table, doc): Promise<number>`
    - `isNeverUploaded(table, docId)`, `get(table, docId)`
    - `clearSettled(matchId, table, before)`
    - `count(filter?)`, `count$(filter?)`, `all$()`
    - `retryRejected(db, matchId?)`
    - `collection` (the RxCollection)
- Produces in `collections.ts`: `DatabaseCollections` (12 tables + `pending_changes`), `LocalDatabase = RxDatabase<DatabaseCollections>`, `setupCollections(db): Promise<PendingChanges>`.
- Produces in `tests/unit/helpers/test-db.ts`: `createTestDb(): Promise<{ db: LocalDatabase; pending: PendingChanges }>`.

- [ ] **Step 1: Add the shared types**

At the top of `lib/rxdb/sync/types.ts`, below the imports, add:

```ts
/** Tables replicated per match; pushes and pending changes only concern these. */
export const MATCH_COLLECTIONS = ["matches", "sets", "player_stats", "score_points", "events"] as const;
export type MatchCollectionName = (typeof MATCH_COLLECTIONS)[number];

/** Tables that are only pulled (edited online through the API layer). */
export const REFERENCE_COLLECTIONS = [
  "championships",
  "seasons",
  "match_formats",
  "clubs",
  "teams",
  "club_members",
  "team_members",
] as const;
export type ReferenceCollectionName = (typeof REFERENCE_COLLECTIONS)[number];

/** What the sync layer needs to know about the signed-in user. */
export interface SyncUser {
  id: string;
  teamIds: string[];
  clubIds: string[];
}
```

- [ ] **Step 2: Write the test database helper**

Create `tests/unit/helpers/test-db.ts`:

```ts
import { randomUUID } from "node:crypto";
import { createRxDatabase } from "rxdb";
import { getRxStorageMemory } from "rxdb/plugins/storage-memory";
import { wrappedValidateAjvStorage } from "rxdb/plugins/validate-ajv";
import { setupCollections, type DatabaseCollections } from "@/lib/rxdb/collections";

/** A fresh in-memory database with the app's collections, hooks and conflict handlers. */
export async function createTestDb() {
  const db = await createRxDatabase<DatabaseCollections>({
    name: `test_${randomUUID().replace(/-/g, "")}`,
    storage: wrappedValidateAjvStorage({ storage: getRxStorageMemory() }),
    multiInstance: false,
    localDocuments: true,
  });
  const pending = await setupCollections(db);
  return { db, pending };
}
```

- [ ] **Step 3: Write the failing tests**

Create `tests/unit/sync/pending-changes.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { LocalDatabase } from "@/lib/rxdb/collections";
import type { PendingChanges } from "@/lib/rxdb/sync/pending-changes";
import { createTestDb } from "../helpers/test-db";
import { aScorePoint, aSet, HOME_TEAM_ID } from "../helpers/fixtures";

const MATCH = "20000000-0000-4000-8000-000000000001";

describe("pending changes", () => {
  let db: LocalDatabase;
  let pending: PendingChanges;

  beforeEach(async () => {
    ({ db, pending } = await createTestDb());
  });
  afterEach(async () => {
    await db.remove();
  });

  it("marks a row pending when it is written on this device", async () => {
    const set = aSet(MATCH);
    await db.sets.insert(set as any);
    expect(await pending.get("sets", set.id)).toMatchObject({
      status: "pending",
      match_id: MATCH,
      table_name: "sets",
      attempts: 0,
      is_insert: true,
    });
  });

  it("remembers that a row is an unsent insert when it is edited before uploading", async () => {
    const set = aSet(MATCH);
    await db.sets.insert(set as any);
    await db.sets.findOne(set.id).update({ $set: { home_score: 1 } });
    expect((await pending.get("sets", set.id))?.is_insert).toBe(true);
  });

  it("marks an edit of an uploaded row as an update", async () => {
    const set = aSet(MATCH);
    await db.sets.insert(set as any);
    const inserted = (await db.sets.findOne(set.id).exec())!.toJSON() as any;
    await pending.onSent("sets", inserted);
    await db.sets.findOne(set.id).update({ $set: { home_score: 1 } });
    expect((await pending.get("sets", set.id))?.is_insert).toBe(false);
  });

  it("uses the match's own id as match_id for matches rows", async () => {
    const now = new Date().toISOString();
    await db.matches.insert({
      id: MATCH,
      date: now,
      home_team_id: HOME_TEAM_ID,
      away_team_id: HOME_TEAM_ID,
      status: "live",
      created_at: now,
      updated_at: now,
    } as any);
    expect((await pending.get("matches", MATCH))?.match_id).toBe(MATCH);
  });

  it("stamps updated_at on every edit of match data", async () => {
    const set = aSet(MATCH, { updated_at: "2020-01-01T00:00:00.000Z" });
    await db.sets.insert(set as any);
    await db.sets.findOne(set.id).update({ $set: { home_score: 1 } });
    const doc = await db.sets.findOne(set.id).exec();
    expect(doc!.updated_at > "2020-01-01T00:00:00.000Z").toBe(true);
  });

  it("keeps updated_at of reference rows that already have one", async () => {
    await db.teams.insert({
      id: HOME_TEAM_ID,
      name: "Home",
      status: "active",
      created_at: "2020-01-01T00:00:00.000Z",
      updated_at: "2020-01-01T00:00:00.000Z",
    } as any);
    await db.teams.findOne(HOME_TEAM_ID).update({ $set: { name: "Renamed" } });
    expect((await db.teams.findOne(HOME_TEAM_ID).exec())!.updated_at).toBe("2020-01-01T00:00:00.000Z");
    expect(await pending.count()).toBe(0);
  });

  it("marks a removal pending", async () => {
    const point = aScorePoint(MATCH, "set-1", 1);
    await db.score_points.insert(point as any);
    const inserted = (await db.score_points.findOne(point.id).exec())!.toJSON() as any;
    await pending.onSent("score_points", inserted);
    expect(await pending.get("score_points", point.id)).toBeNull();
    await db.score_points.findOne(point.id).remove();
    expect((await pending.get("score_points", point.id))?.status).toBe("pending");
  });

  it("clears an entry only when the uploaded version is at least as new as the marked one", async () => {
    const set = aSet(MATCH);
    await db.sets.insert(set as any);
    const marked = (await pending.get("sets", set.id))!;
    await pending.onSent("sets", { id: set.id, match_id: MATCH, updated_at: "2000-01-01T00:00:00.000Z" });
    expect(await pending.get("sets", set.id)).not.toBeNull();
    await pending.onSent("sets", { id: set.id, match_id: MATCH, updated_at: marked.doc_updated_at });
    expect(await pending.get("sets", set.id)).toBeNull();
  });

  it("keeps a rejection when the row is later reported as sent", async () => {
    const set = aSet(MATCH);
    await db.sets.insert(set as any);
    await pending.reject("sets", set, { kind: "permanent", code: "rls" }, { neverUploaded: true });
    await pending.onSent("sets", { ...set, updated_at: "2999-01-01T00:00:00.000Z" });
    expect(await pending.get("sets", set.id)).toMatchObject({ status: "rejected", error_code: "rls", never_uploaded: true });
  });

  it("makes a rejected row pending again on a new edit and keeps never_uploaded", async () => {
    const set = aSet(MATCH);
    await db.sets.insert(set as any);
    await pending.reject("sets", set, { kind: "permanent", code: "rls" }, { neverUploaded: true });
    await db.sets.findOne(set.id).update({ $set: { home_score: 2 } });
    expect(await pending.get("sets", set.id)).toMatchObject({ status: "pending", error_code: null, never_uploaded: true });
  });

  it("supersedes every unsent entry of a match and ignores later edits", async () => {
    const set = aSet(MATCH);
    await db.sets.insert(set as any);
    await pending.supersedeMatch(MATCH);
    await db.sets.findOne(set.id).update({ $set: { home_score: 3 } });
    expect((await pending.get("sets", set.id))?.status).toBe("superseded");
  });

  it("clears pending entries marked before a point in time", async () => {
    const set = aSet(MATCH);
    await db.sets.insert(set as any);
    await pending.clearSettled(MATCH, "sets", "2000-01-01T00:00:00.000Z");
    expect(await pending.get("sets", set.id)).not.toBeNull();
    await pending.clearSettled(MATCH, "sets", "2999-01-01T00:00:00.000Z");
    expect(await pending.get("sets", set.id)).toBeNull();
  });

  it("counts attempts", async () => {
    const set = aSet(MATCH);
    expect(await pending.recordAttempt("sets", set)).toBe(1);
    expect(await pending.recordAttempt("sets", set)).toBe(2);
  });

  it("retryRejected marks rejected rows pending again", async () => {
    const set = aSet(MATCH);
    await db.sets.insert(set as any);
    await pending.reject("sets", set, { kind: "permanent", code: "rls" }, { neverUploaded: true });
    expect(await pending.retryRejected(db)).toBe(1);
    expect((await pending.get("sets", set.id))?.status).toBe("pending");
  });

  it("counts entries by match, table and status", async () => {
    await db.sets.insert(aSet(MATCH) as any);
    await db.sets.insert(aSet("20000000-0000-4000-8000-000000000002") as any);
    expect(await pending.count({ matchId: MATCH })).toBe(1);
    expect(await pending.count({ tables: ["sets"] })).toBe(2);
    expect(await pending.count({ statuses: ["rejected"] })).toBe(0);
  });
});
```

- [ ] **Step 4: Run them and see them fail**

Run: `pnpm test tests/unit/sync/pending-changes.test.ts`
Expected: FAIL, cannot resolve `@/lib/rxdb/collections`.

- [ ] **Step 5: Implement the pending store**

Create `lib/rxdb/sync/pending-changes.ts`:

```ts
import { toTypedRxJsonSchema, type RxCollection, type RxDatabase } from "rxdb";
import { map, type Observable } from "rxjs";
import type { ClassifiedError } from "./errors";
import { isoToMicros } from "./timestamps";
import { MATCH_COLLECTIONS, type MatchCollectionName } from "./types";

export type PendingStatus = "pending" | "rejected" | "superseded";

/** One row changed on this device that the server doesn't have yet (or refused). */
export interface PendingChange {
  id: string;
  table_name: MatchCollectionName;
  doc_id: string;
  match_id: string;
  status: PendingStatus;
  attempts: number;
  error_code: string | null;
  error_params: Record<string, string> | null;
  /** The server never accepted this row, so a retry must insert it. */
  never_uploaded: boolean;
  /** Created on this device and not uploaded yet: rows that reference it must wait. */
  is_insert: boolean;
  /** `updated_at` of the row version that was marked. */
  doc_updated_at: string;
  created_at: string;
  updated_at: string;
}

export const pendingChangeSchema = toTypedRxJsonSchema({
  version: 0,
  primaryKey: "id",
  type: "object",
  properties: {
    id: { type: "string", maxLength: 100 },
    table_name: { type: "string", maxLength: 20 },
    doc_id: { type: "string", maxLength: 36 },
    match_id: { type: "string", maxLength: 36 },
    status: { type: "string", enum: ["pending", "rejected", "superseded"], maxLength: 10 },
    attempts: { type: "number", minimum: 0, maximum: 1000000, multipleOf: 1 },
    error_code: { type: ["string", "null"] },
    error_params: { type: ["object", "null"] },
    never_uploaded: { type: "boolean" },
    is_insert: { type: "boolean" },
    doc_updated_at: { type: "string", maxLength: 40 },
    created_at: { type: "string", maxLength: 40 },
    updated_at: { type: "string", maxLength: 40 },
  },
  required: [
    "id",
    "table_name",
    "doc_id",
    "match_id",
    "status",
    "attempts",
    "never_uploaded",
    "is_insert",
    "doc_updated_at",
    "created_at",
    "updated_at",
  ],
  indexes: ["match_id", "status"],
});

export type PendingDoc = { id: string; match_id?: string | null; updated_at?: string };

export interface PendingFilter {
  matchId?: string;
  tables?: readonly MatchCollectionName[];
  statuses?: readonly PendingStatus[];
}

export const pendingId = (table: MatchCollectionName, docId: string): string => `${table}:${docId}`;

export const matchIdOf = (table: MatchCollectionName, doc: PendingDoc): string =>
  table === "matches" ? doc.id : String(doc.match_id);

function toSelector({ matchId, tables, statuses }: PendingFilter): Record<string, unknown> {
  const selector: Record<string, unknown> = {};
  if (matchId) selector.match_id = matchId;
  if (tables) selector.table_name = { $in: [...tables] };
  if (statuses) selector.status = { $in: [...statuses] };
  return selector;
}

export class PendingChanges {
  constructor(
    readonly collection: RxCollection<PendingChange>,
    private readonly now: () => string = () => new Date().toISOString()
  ) {}

  /** Called by the collection hooks before a row is written on this device. */
  async markPending(table: MatchCollectionName, doc: PendingDoc, opts: { insert: boolean } = { insert: false }): Promise<void> {
    const existing = await this.get(table, doc.id);
    if (existing?.status === "superseded") return;
    await this.write(table, doc, {
      status: "pending",
      attempts: 0,
      error_code: null,
      error_params: null,
      // Still an insert until it uploads, even if it is edited or removed meanwhile.
      is_insert: opts.insert || existing?.is_insert === true || existing?.never_uploaded === true,
      doc_updated_at: doc.updated_at ?? this.now(),
    });
  }

  /** A replication reported the row as uploaded. */
  async onSent(table: MatchCollectionName, doc: PendingDoc): Promise<void> {
    const entry = await this.collection.findOne(pendingId(table, doc.id)).exec();
    if (!entry || entry.status !== "pending") return;
    if ((isoToMicros(doc.updated_at) ?? 0) >= (isoToMicros(entry.doc_updated_at) ?? 0)) await entry.remove();
  }

  async reject(
    table: MatchCollectionName,
    doc: PendingDoc,
    error: ClassifiedError,
    opts: { neverUploaded: boolean }
  ): Promise<void> {
    await this.write(table, doc, {
      status: "rejected",
      error_code: error.code,
      error_params: error.params ?? null,
      never_uploaded: opts.neverUploaded,
    });
  }

  async supersede(table: MatchCollectionName, doc: PendingDoc): Promise<void> {
    await this.write(table, doc, { status: "superseded", error_code: "scorer_mismatch", error_params: null });
  }

  /** Another device took over the match: nothing unsent from this device will upload. */
  async supersedeMatch(matchId: string): Promise<void> {
    const docs = await this.collection
      .find({ selector: { match_id: matchId, status: { $in: ["pending", "rejected"] } } })
      .exec();
    await Promise.all(
      docs.map((doc) =>
        doc.incrementalPatch({ status: "superseded", error_code: "scorer_mismatch", error_params: null, updated_at: this.now() })
      )
    );
  }

  /** Counts a failure that connectivity can't explain; returns the attempts so far. */
  async recordAttempt(table: MatchCollectionName, doc: PendingDoc): Promise<number> {
    const existing = await this.get(table, doc.id);
    const attempts = (existing?.attempts ?? 0) + 1;
    await this.write(table, doc, { status: existing?.status === "rejected" ? "rejected" : "pending", attempts });
    return attempts;
  }

  async isNeverUploaded(table: MatchCollectionName, docId: string): Promise<boolean> {
    return (await this.get(table, docId))?.never_uploaded === true;
  }

  async get(table: MatchCollectionName, docId: string): Promise<PendingChange | null> {
    const doc = await this.collection.findOne(pendingId(table, docId)).exec();
    return doc ? (doc.toJSON() as PendingChange) : null;
  }

  /**
   * Removes `pending` entries marked before `before`, once the table's
   * replication for the match is idle and in sync: they come from writes that
   * failed after the entry was created.
   */
  async clearSettled(matchId: string, table: MatchCollectionName, before: string): Promise<void> {
    await this.collection
      .find({ selector: { match_id: matchId, table_name: table, status: "pending", updated_at: { $lt: before } } })
      .remove();
  }

  count(filter: PendingFilter = {}): Promise<number> {
    return this.collection.count({ selector: toSelector(filter) }).exec();
  }

  count$(filter: PendingFilter = {}): Observable<number> {
    return this.collection.count({ selector: toSelector(filter) }).$;
  }

  all$(): Observable<PendingChange[]> {
    return this.collection.find().$.pipe(map((docs) => docs.map((doc) => doc.toJSON() as PendingChange)));
  }

  /** Re-queues rejected rows: bumping updated_at runs the hooks, which mark them pending. */
  async retryRejected(db: RxDatabase<any>, matchId?: string): Promise<number> {
    const entries = await this.collection.find({ selector: toSelector({ matchId, statuses: ["rejected"] }) }).exec();
    let retried = 0;
    for (const entry of entries) {
      const doc = await db.collections[entry.table_name].findOne(entry.doc_id).exec();
      if (!doc) {
        await entry.remove();
        continue;
      }
      await doc.incrementalPatch({ updated_at: this.now() });
      retried += 1;
    }
    return retried;
  }

  private async write(table: MatchCollectionName, doc: PendingDoc, patch: Partial<PendingChange>): Promise<void> {
    const id = pendingId(table, doc.id);
    const now = this.now();
    const existing = await this.collection.findOne(id).exec();
    if (existing) {
      await existing.incrementalPatch({ ...patch, updated_at: now });
      return;
    }
    const entry: PendingChange = {
      id,
      table_name: table,
      doc_id: doc.id,
      match_id: matchIdOf(table, doc),
      status: "pending",
      attempts: 0,
      error_code: null,
      error_params: null,
      never_uploaded: false,
      is_insert: false,
      doc_updated_at: doc.updated_at ?? now,
      created_at: now,
      updated_at: now,
      ...patch,
    };
    try {
      await this.collection.insert(entry);
    } catch (error) {
      // Written concurrently by another hook call: patch that entry instead.
      const again = await this.collection.findOne(id).exec();
      if (!again) throw error;
      await again.incrementalPatch({ ...patch, updated_at: now });
    }
  }
}

/** Marks every local write of match data as pending. Replication writes bypass hooks. */
export function installPendingHooks(db: RxDatabase<any>, pending: PendingChanges): void {
  for (const table of MATCH_COLLECTIONS) {
    const collection = db.collections[table];
    collection.preInsert((data: PendingDoc) => pending.markPending(table, data, { insert: true }), false);
    collection.preSave((data: PendingDoc) => pending.markPending(table, data), false);
    collection.preRemove((data: PendingDoc) => pending.markPending(table, data), false);
  }
}
```

- [ ] **Step 6: Implement the shared collection setup**

Create `lib/rxdb/collections.ts`:

```ts
import { addRxPlugin, type RxCollection, type RxDatabase } from "rxdb";
import { RxDBLocalDocumentsPlugin } from "rxdb/plugins/local-documents";
import { RxDBQueryBuilderPlugin } from "rxdb/plugins/query-builder";
import { RxDBUpdatePlugin } from "rxdb/plugins/update";
import type {
  Championship,
  Club,
  ClubMember,
  Event,
  Match,
  MatchFormat,
  PlayerStat,
  ScorePoint,
  Season,
  Set,
  Team,
  TeamMember,
} from "@/lib/types";
import {
  championshipSchema,
  clubMemberSchema,
  clubSchema,
  eventSchema,
  matchFormatSchema,
  matchSchema,
  playerSchema,
  playerStatSchema,
  scorePointSchema,
  seasonSchema,
  setSchema,
  teamSchema,
} from "./schema";
import { matchConflictHandler } from "./sync/conflict-handler";
import { installPendingHooks, pendingChangeSchema, PendingChanges, type PendingChange } from "./sync/pending-changes";
import { MATCH_COLLECTIONS } from "./sync/types";

addRxPlugin(RxDBQueryBuilderPlugin);
addRxPlugin(RxDBUpdatePlugin);
addRxPlugin(RxDBLocalDocumentsPlugin);

export type DatabaseCollections = {
  championships: RxCollection<Championship>;
  match_formats: RxCollection<MatchFormat>;
  clubs: RxCollection<Club>;
  club_members: RxCollection<ClubMember>;
  seasons: RxCollection<Season>;
  events: RxCollection<Event>;
  teams: RxCollection<Team>;
  team_members: RxCollection<TeamMember>;
  matches: RxCollection<Match>;
  sets: RxCollection<Set>;
  score_points: RxCollection<ScorePoint>;
  player_stats: RxCollection<PlayerStat>;
  pending_changes: RxCollection<PendingChange>;
};

export type LocalDatabase = RxDatabase<DatabaseCollections>;

const MATCH_TABLES = new Set<string>(MATCH_COLLECTIONS);

/**
 * created_at/updated_at for local writes. Match data gets a fresh updated_at
 * on every edit, which is the edit time the server keeps (spec section 3).
 */
function installTimestampHooks(db: LocalDatabase): void {
  for (const [name, collection] of Object.entries(db.collections)) {
    if (name === "pending_changes") continue;
    const isMatchData = MATCH_TABLES.has(name);
    collection.preInsert((data: any) => {
      const now = new Date().toISOString();
      if (!data.created_at) data.created_at = now;
      if (!data.updated_at) data.updated_at = now;
    }, false);
    collection.preSave((data: any) => {
      if (isMatchData || !data.updated_at) data.updated_at = new Date().toISOString();
    }, false);
    if (isMatchData) {
      collection.preRemove((data: any) => {
        data.updated_at = new Date().toISOString();
      }, false);
    }
  }
}

/** Adds the app's collections to `db`, with conflict handlers and hooks. */
export async function setupCollections(db: LocalDatabase): Promise<PendingChanges> {
  await db.addCollections({
    championships: { schema: championshipSchema },
    match_formats: { schema: matchFormatSchema },
    clubs: { schema: clubSchema },
    club_members: { schema: clubMemberSchema },
    seasons: { schema: seasonSchema },
    teams: { schema: teamSchema },
    team_members: { schema: playerSchema },
    matches: { schema: matchSchema, conflictHandler: matchConflictHandler },
    sets: { schema: setSchema, conflictHandler: matchConflictHandler },
    events: { schema: eventSchema, conflictHandler: matchConflictHandler },
    score_points: { schema: scorePointSchema, conflictHandler: matchConflictHandler },
    player_stats: { schema: playerStatSchema, conflictHandler: matchConflictHandler },
    pending_changes: { schema: pendingChangeSchema },
  });
  const pending = new PendingChanges(db.pending_changes);
  installTimestampHooks(db);
  installPendingHooks(db, pending);
  return pending;
}
```

If TypeScript rejects an `addCollections` entry because a schema's inferred type doesn't match the document type, cast only that entry's `schema` to `any`, and mention it in the commit message.

- [ ] **Step 7: Use it from `database.ts`**

Replace the whole of `lib/rxdb/database.ts` with the version below. It keeps every existing behaviour, but now builds its collections through `setupCollections`:

```ts
"use client";

import { addRxPlugin, createRxDatabase, removeRxDatabase, RxError, type RxStorage } from "rxdb";
import { getRxStorageDexie } from "rxdb/plugins/storage-dexie";
import { getRxStorageMemory } from "rxdb/plugins/storage-memory";
import { wrappedValidateAjvStorage } from "rxdb/plugins/validate-ajv";
import { setupCollections, type DatabaseCollections, type LocalDatabase } from "./collections";
import type { PendingChanges } from "./sync/pending-changes";
import { SyncManager } from "./sync/manager";
import { supabase } from "@/lib/supabase/client";

export type { DatabaseCollections } from "./collections";

const inDevEnvironment = !!process && process.env.NODE_ENV === "development";
const devModePluginPromise = inDevEnvironment
  ? import("rxdb/plugins/dev-mode").then(({ RxDBDevModePlugin }) => {
      console.debug("Enabling RxDB Dev Mode Plugin");
      addRxPlugin(RxDBDevModePlugin);
    })
  : Promise.resolve();

export type VolleyballDatabase = LocalDatabase & {
  syncManager: SyncManager;
  pendingChanges: PendingChanges;
};

let dbPromise: Promise<VolleyballDatabase> | null = null;

// RxDB major versions do not share an on-disk format. Bump DB_GENERATION when
// upgrading RxDB's major version: databases from older generations are deleted
// and the live match re-syncs from Supabase (syncMatch).
const DB_BASE_NAME = "volleystats_db";
const DB_GENERATION = "v17";
const DB_CURRENT_NAME = `${DB_BASE_NAME}_${DB_GENERATION}`;

async function deleteLegacyDatabases(): Promise<void> {
  if (typeof indexedDB === "undefined" || typeof indexedDB.databases !== "function") return;
  const legacyNames = (await indexedDB.databases())
    .map((info) => info.name)
    .filter((name): name is string => !!name && name.includes(DB_BASE_NAME) && !name.includes(DB_CURRENT_NAME));
  await Promise.all(
    legacyNames.map(
      (name) =>
        new Promise<void>((resolve) => {
          const request = indexedDB.deleteDatabase(name);
          request.onsuccess = request.onerror = request.onblocked = () => resolve();
        })
    )
  );
}

function getStorageKey(): string {
  const url = new URL(window.location.href);
  return url.searchParams.get("storage") || "dexie";
}

/**
 * Easy toggle of the storage engine via query parameter.
 */
export function getStorage(): RxStorage<any, any> {
  const storageKey = getStorageKey();
  if (storageKey === "memory") return getRxStorageMemory();
  if (storageKey === "dexie") return getRxStorageDexie();
  // Error identifier maps to translation key: errors.database.storageKeyNotDefined
  throw new Error("storageKeyNotDefined");
}

/**
 * In the e2e-test we get the database-name from the get-parameter
 * In normal mode, the database name is 'volleystats_db_v17' (DB_CURRENT_NAME)
 */
export function getDatabaseName() {
  const url = new URL(window.location.href);
  const dbNameFromUrl = url.searchParams.get("database");
  let ret = DB_CURRENT_NAME;
  if (dbNameFromUrl) {
    console.log("databaseName from url: " + dbNameFromUrl);
    ret += dbNameFromUrl;
  }
  return ret;
}

// The shared promise is assigned synchronously, before any await, so concurrent
// callers always get the same database instead of racing to create two.
export const getDatabase = (): Promise<VolleyballDatabase> => {
  if (!dbPromise) dbPromise = createDatabase();
  return dbPromise;
};

const createDatabase = async (): Promise<VolleyballDatabase> => {
  // Ensure dev mode plugin is loaded before creating database
  await devModePluginPromise;

  try {
    await deleteLegacyDatabases();
  } catch (error) {
    console.warn("Could not delete legacy local databases:", error);
  }

  return createRxDatabase<DatabaseCollections>({
    name: getDatabaseName(),
    storage: wrappedValidateAjvStorage({ storage: getStorage() }),
    multiInstance: true,
    ignoreDuplicate: false,
    localDocuments: true,
  }).then(async (db) => {
    try {
      const pendingChanges = await setupCollections(db);
      const syncManager = new SyncManager(db, supabase);
      await syncManager.initialize();
      Object.assign(db, { syncManager, pendingChanges });
    } catch (error) {
      console.error("Error creating RxDB collections:", error);

      if (error instanceof RxError) {
        const url = new URL(window.location.href);
        const removeDbFlag = url.searchParams.get("remove-database");

        // Check if it's a schema version conflict or database corruption
        const isSchemaError =
          error.code === "SC13" || // schema validation failed
          error.code === "DB1" || // database version mismatch
          (error as any).name === "OpenFailedError" ||
          error.message?.includes("schema") ||
          error.message?.includes("version");

        if (isSchemaError) {
          console.warn("Schema version conflict detected. Database needs to be reset.");

          // Auto-remove in development or if flag is set
          if (inDevEnvironment || removeDbFlag === "true") {
            console.log("Removing old database and reinitializing...");
            await removeRxDatabase(getDatabaseName(), getRxStorageDexie());

            // Reset the promise to allow recreation
            dbPromise = null;

            // Recursively retry database creation
            return getDatabase();
          }
        }
      }
      throw error;
    }

    return db as VolleyballDatabase;
  });
};
```

The old `SyncManager` keeps its `(db, client)` constructor until Task 12. Its `import { DatabaseCollections } from '../database'` still resolves through the re-export.

- [ ] **Step 8: Run tests, lint and build**

Run: `pnpm test` → Expected: all pass, including the 15 pending-changes tests.
Run: `pnpm lint` → Expected: no new errors.
Run: `pnpm build` → Expected: succeeds.

- [ ] **Step 9: Commit**

```bash
git add lib/rxdb/collections.ts lib/rxdb/database.ts lib/rxdb/sync/types.ts lib/rxdb/sync/pending-changes.ts tests/unit/helpers/test-db.ts tests/unit/sync/pending-changes.test.ts
git commit -m "feat(sync): record unsent match changes in a local pending_changes collection

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Platform adapter

**Files:**
- Create: `lib/rxdb/sync/platform/types.ts`
- Create: `lib/rxdb/sync/platform/web.ts`
- Create: `tests/unit/helpers/fake-platform.ts`
- Test: `tests/unit/sync/platform-web.test.ts`

**Interfaces:**
- Produces: the `SyncPlatform` interface, `createWebPlatform(): SyncPlatform`, `deviceLabelFromUserAgent(userAgent: string): string`.
- Produces for tests: `createFakePlatform(deviceId?, label?)`, returning `{ platform, setOnline(online), foreground(), wasPersistenceRequested() }`.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/sync/platform-web.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { deviceLabelFromUserAgent } from "@/lib/rxdb/sync/platform/web";

describe("deviceLabelFromUserAgent", () => {
  it.each([
    ["Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36", "Chrome · Android"],
    ["Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1", "Safari · iPhone"],
    ["Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1", "Safari · iPad"],
    ["Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36 Edg/129.0", "Edge · Windows"],
    ["Mozilla/5.0 (X11; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0", "Firefox · Linux"],
    ["Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15", "Safari · macOS"],
  ])("labels %s", (userAgent, label) => {
    expect(deviceLabelFromUserAgent(userAgent)).toBe(label);
  });
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `pnpm test tests/unit/sync/platform-web.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement**

Create `lib/rxdb/sync/platform/types.ts`:

```ts
import type { Observable } from "rxjs";

/**
 * Platform signals the sync core needs. The web implementation uses browser
 * events; a Capacitor or Expo build provides its own without touching the core.
 */
export interface SyncPlatform {
  /** Emits the current connectivity, then every change. */
  connectivity$: Observable<boolean>;
  /** Emits when the app comes back to the foreground. */
  foreground$: Observable<void>;
  /** Asks the platform not to evict local data during long offline periods. */
  requestPersistentStorage(): Promise<boolean>;
  /** A random id generated once per install and kept. */
  getDeviceId(): Promise<string>;
  /** A short readable label, e.g. "Chrome · Android". */
  getDeviceLabel(): string;
}
```

Create `lib/rxdb/sync/platform/web.ts`:

```ts
import { defer, distinctUntilChanged, filter, fromEvent, map, merge, startWith, type Observable } from "rxjs";
import type { SyncPlatform } from "./types";

const DEVICE_ID_KEY = "volleystats:device-id";
let memoryDeviceId: string | null = null;

export function deviceLabelFromUserAgent(userAgent: string): string {
  const browser = /Edg\//.test(userAgent)
    ? "Edge"
    : /OPR\//.test(userAgent)
      ? "Opera"
      : /Firefox\//.test(userAgent)
        ? "Firefox"
        : /Chrome\//.test(userAgent)
          ? "Chrome"
          : /Safari\//.test(userAgent)
            ? "Safari"
            : "Browser";
  const os = /Android/.test(userAgent)
    ? "Android"
    : /iPhone/.test(userAgent)
      ? "iPhone"
      : /iPad/.test(userAgent)
        ? "iPad"
        : /Windows/.test(userAgent)
          ? "Windows"
          : /Mac OS X/.test(userAgent)
            ? "macOS"
            : /Linux/.test(userAgent)
              ? "Linux"
              : "device";
  return `${browser} · ${os}`;
}

export function createWebPlatform(): SyncPlatform {
  const connectivity$: Observable<boolean> = defer(() =>
    merge(
      fromEvent(window, "online").pipe(map(() => true)),
      fromEvent(window, "offline").pipe(map(() => false))
    ).pipe(startWith(navigator.onLine), distinctUntilChanged())
  );
  const foreground$: Observable<void> = defer(() =>
    fromEvent(document, "visibilitychange").pipe(
      filter(() => document.visibilityState === "visible"),
      map(() => undefined)
    )
  );
  return {
    connectivity$,
    foreground$,
    async requestPersistentStorage() {
      try {
        return (await navigator.storage?.persist?.()) ?? false;
      } catch {
        return false;
      }
    },
    async getDeviceId() {
      try {
        const saved = localStorage.getItem(DEVICE_ID_KEY);
        if (saved) return saved;
        const id = crypto.randomUUID();
        localStorage.setItem(DEVICE_ID_KEY, id);
        return id;
      } catch {
        // Storage unavailable (private mode): one id for this page's lifetime.
        memoryDeviceId ??= crypto.randomUUID();
        return memoryDeviceId;
      }
    },
    getDeviceLabel: () => deviceLabelFromUserAgent(navigator.userAgent),
  };
}
```

Create `tests/unit/helpers/fake-platform.ts`:

```ts
import { BehaviorSubject, Subject } from "rxjs";
import type { SyncPlatform } from "@/lib/rxdb/sync/platform/types";

export function createFakePlatform(deviceId = "device-a", label = "Test · Device") {
  const connectivity = new BehaviorSubject(true);
  const foreground = new Subject<void>();
  let persistenceRequested = false;
  const platform: SyncPlatform = {
    connectivity$: connectivity.asObservable(),
    foreground$: foreground.asObservable(),
    requestPersistentStorage: async () => {
      persistenceRequested = true;
      return true;
    },
    getDeviceId: async () => deviceId,
    getDeviceLabel: () => label,
  };
  return {
    platform,
    setOnline: (online: boolean) => connectivity.next(online),
    foreground: () => foreground.next(),
    wasPersistenceRequested: () => persistenceRequested,
  };
}
```

- [ ] **Step 4: Run it and see it pass**

Run: `pnpm test tests/unit/sync/platform-web.test.ts`
Expected: 6 passed.

- [ ] **Step 5: Commit**

```bash
git add lib/rxdb/sync/platform tests/unit/helpers/fake-platform.ts tests/unit/sync/platform-web.test.ts
git commit -m "feat(sync): add a platform adapter for connectivity, foreground and device id

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Tracked matches, sync state and the scorer RPC client

**Files:**
- Create: `lib/rxdb/sync/scorer-claim.ts`
- Create: `lib/rxdb/sync/tracked-matches.ts`
- Create: `lib/rxdb/sync/sync-state.ts`
- Test: `tests/unit/sync/scorer-claim.test.ts`, `tests/unit/sync/tracked-matches.test.ts`, `tests/unit/sync/sync-state.test.ts`

**Interfaces:**
- Produces in `scorer-claim.ts`:
  - `interface ScorerInfo { deviceId; userId; name; deviceLabel; claimedAt; lastActivityAt }`. All are `string | null`.
  - `interface ClaimResult { claimed: boolean; holder: ScorerInfo }`
  - `class ScorerRpcError extends Error { code: string; status: number }`
  - `claimMatchScorer(client, { matchId, deviceId, label, force }): Promise<ClaimResult>`
  - `getMatchScorer(client, matchId, deviceId): Promise<ScorerInfo>`
- Produces in `tracked-matches.ts`:
  - `type ClaimState = "held" | "pending-force" | "lost"`
  - `interface TrackedMatch { userId: string; claim: ClaimState | null; lastOpenedAt: string; lostTo: ScorerInfo | null }`
  - `type TrackedMatchMap = Record<string, TrackedMatch>`
  - `TRACKED_MATCH_TTL_MS`
  - `class TrackedMatches` with `get()`, `get$()`, `entry(matchId)`, `track(matchId, userId, now?)`, `setClaim(matchId, claim, lostTo?)`, `remove(matchId)`
- Produces in `sync-state.ts`:
  - `interface MatchSyncState { matchId: string; status: "never-synced" | "syncing" | "synced" | "error"; lastSyncTime: number }`
  - `class SyncStates` with `get(matchId)`, `set(matchId, status)`, `waitForSynced(matchId, timeoutMs): Promise<boolean>`

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/sync/scorer-claim.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { claimMatchScorer, getMatchScorer } from "@/lib/rxdb/sync/scorer-claim";
import { createFakeServer } from "../helpers/server";
import { seedServerMatch, seedTeams } from "../helpers/fixtures";

function setup() {
  const server = createFakeServer();
  seedTeams(server);
  const matchId = seedServerMatch(server);
  return { server, matchId };
}

describe("scorer RPC client", () => {
  it("claims a free match", async () => {
    const { server, matchId } = setup();
    const result = await claimMatchScorer(server.client({ userName: "Alex" }), {
      matchId,
      deviceId: "device-a",
      label: "Chrome · Android",
      force: false,
    });
    expect(result.claimed).toBe(true);
    expect(result.holder).toMatchObject({ deviceId: "device-a", name: "Alex", deviceLabel: "Chrome · Android" });
  });

  it("reports the device that holds the match", async () => {
    const { server, matchId } = setup();
    server.setScorer(matchId, { deviceId: "device-b", name: "Sam", label: "iPad" });
    const result = await claimMatchScorer(server.client(), { matchId, deviceId: "device-a", label: "x", force: false });
    expect(result.claimed).toBe(false);
    expect(result.holder).toMatchObject({ deviceId: "device-b", name: "Sam", deviceLabel: "iPad" });
  });

  it("takes the match over when forced", async () => {
    const { server, matchId } = setup();
    server.setScorer(matchId, { deviceId: "device-b" });
    const result = await claimMatchScorer(server.client(), { matchId, deviceId: "device-a", label: "x", force: true });
    expect(result.claimed).toBe(true);
    expect(server.row("matches", matchId)!.scorer_device_id).toBe("device-a");
  });

  it("reads the holder and the last activity", async () => {
    const { server, matchId } = setup();
    server.setScorer(matchId, { deviceId: "device-b" });
    const holder = await getMatchScorer(server.client(), matchId, "device-a");
    expect(holder.deviceId).toBe("device-b");
    expect(holder.lastActivityAt).not.toBeNull();
  });

  it("throws a ScorerRpcError with status 0 when offline", async () => {
    const { server, matchId } = setup();
    server.offline = true;
    await expect(claimMatchScorer(server.client(), { matchId, deviceId: "d", label: "x", force: false })).rejects.toMatchObject({
      name: "ScorerRpcError",
      status: 0,
    });
  });
});
```

Create `tests/unit/sync/tracked-matches.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { filter, firstValueFrom } from "rxjs";
import type { LocalDatabase } from "@/lib/rxdb/collections";
import { TrackedMatches } from "@/lib/rxdb/sync/tracked-matches";
import { createTestDb } from "../helpers/test-db";

describe("tracked matches", () => {
  let db: LocalDatabase;
  let tracked: TrackedMatches;

  beforeEach(async () => {
    ({ db } = await createTestDb());
    tracked = new TrackedMatches(db);
  });
  afterEach(async () => {
    await db.remove();
  });

  it("tracks a match for a user", async () => {
    await tracked.track("m1", "user-1", "2026-10-07T10:00:00.000Z");
    expect(await tracked.entry("m1")).toEqual({ userId: "user-1", claim: null, lastOpenedAt: "2026-10-07T10:00:00.000Z", lostTo: null });
  });

  it("keeps the claim when the same user opens the match again", async () => {
    await tracked.track("m1", "user-1");
    await tracked.setClaim("m1", "held");
    await tracked.track("m1", "user-1", "2026-10-08T10:00:00.000Z");
    expect(await tracked.entry("m1")).toMatchObject({ claim: "held", lastOpenedAt: "2026-10-08T10:00:00.000Z" });
  });

  it("resets the claim when another user opens the match", async () => {
    await tracked.track("m1", "user-1");
    await tracked.setClaim("m1", "held");
    await tracked.track("m1", "user-2");
    expect(await tracked.entry("m1")).toMatchObject({ userId: "user-2", claim: null });
  });

  it("removes a match", async () => {
    await tracked.track("m1", "user-1");
    await tracked.remove("m1");
    expect(await tracked.entry("m1")).toBeNull();
  });

  it("emits changes", async () => {
    const next = firstValueFrom(tracked.get$().pipe(filter((map) => !!map.m2)));
    await tracked.track("m2", "user-1");
    expect((await next).m2.userId).toBe("user-1");
  });

  it("serializes concurrent changes", async () => {
    await Promise.all(["a", "b", "c", "d", "e"].map((id) => tracked.track(id, "user-1")));
    expect(Object.keys(await tracked.get()).sort()).toEqual(["a", "b", "c", "d", "e"]);
  });
});
```

Create `tests/unit/sync/sync-state.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { LocalDatabase } from "@/lib/rxdb/collections";
import { SyncStates } from "@/lib/rxdb/sync/sync-state";
import { createTestDb } from "../helpers/test-db";

describe("sync states", () => {
  let db: LocalDatabase;
  let states: SyncStates;

  beforeEach(async () => {
    ({ db } = await createTestDb());
    states = new SyncStates(db);
  });
  afterEach(async () => {
    await db.remove();
  });

  it("stores the status of a match", async () => {
    await states.set("m1", "syncing");
    expect((await states.get("m1"))?.status).toBe("syncing");
  });

  it("resolves true once the match is synced", async () => {
    const waiting = states.waitForSynced("m1", 2000);
    await states.set("m1", "synced");
    expect(await waiting).toBe(true);
  });

  it("resolves false after the timeout", async () => {
    expect(await states.waitForSynced("m1", 50)).toBe(false);
  });
});
```

- [ ] **Step 2: Run them and see them fail**

Run: `pnpm test tests/unit/sync/scorer-claim.test.ts tests/unit/sync/tracked-matches.test.ts tests/unit/sync/sync-state.test.ts`
Expected: FAIL, modules not found.

- [ ] **Step 3: Implement the scorer RPC client**

Create `lib/rxdb/sync/scorer-claim.ts`:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";

/** Who scores a match (server columns `scorer_*`, spec section 7). */
export interface ScorerInfo {
  deviceId: string | null;
  userId: string | null;
  name: string | null;
  deviceLabel: string | null;
  claimedAt: string | null;
  lastActivityAt: string | null;
}

export interface ClaimResult {
  claimed: boolean;
  holder: ScorerInfo;
}

export class ScorerRpcError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = "ScorerRpcError";
  }
}

type ScorerRow = {
  claimed?: boolean;
  scorer_device_id: string | null;
  scorer_user_id: string | null;
  scorer_name: string | null;
  scorer_device_label: string | null;
  scorer_claimed_at: string | null;
  last_activity_at: string | null;
};

function toScorerInfo(row: ScorerRow): ScorerInfo {
  return {
    deviceId: row.scorer_device_id ?? null,
    userId: row.scorer_user_id ?? null,
    name: row.scorer_name ?? null,
    deviceLabel: row.scorer_device_label ?? null,
    claimedAt: row.scorer_claimed_at ?? null,
    lastActivityAt: row.last_activity_at ?? null,
  };
}

async function callScorerRpc(
  client: SupabaseClient<any>,
  name: "claim_match_scorer" | "get_match_scorer",
  params: Record<string, unknown>,
  deviceId: string
): Promise<ScorerRow> {
  const { data, error, status } = await client.rpc(name, params).setHeader("x-device-id", deviceId);
  if (error) throw new ScorerRpcError(error.code ?? "", error.message, status);
  if (!data) throw new ScorerRpcError("P0002", "match_not_found", status);
  return data as ScorerRow;
}

export async function claimMatchScorer(
  client: SupabaseClient<any>,
  args: { matchId: string; deviceId: string; label: string; force: boolean }
): Promise<ClaimResult> {
  const row = await callScorerRpc(
    client,
    "claim_match_scorer",
    { p_match_id: args.matchId, p_device_id: args.deviceId, p_label: args.label, p_force: args.force },
    args.deviceId
  );
  return { claimed: row.claimed === true, holder: toScorerInfo(row) };
}

export async function getMatchScorer(client: SupabaseClient<any>, matchId: string, deviceId: string): Promise<ScorerInfo> {
  return toScorerInfo(await callScorerRpc(client, "get_match_scorer", { p_match_id: matchId }, deviceId));
}
```

- [ ] **Step 4: Implement tracked matches**

Create `lib/rxdb/sync/tracked-matches.ts`:

```ts
import type { RxDatabase } from "rxdb";
import { map, type Observable } from "rxjs";
import type { ScorerInfo } from "./scorer-claim";

export type ClaimState = "held" | "pending-force" | "lost";

/** A match this device syncs (it opened it), shared by every tab. */
export interface TrackedMatch {
  userId: string;
  /** null: never claimed (e.g. seeded by the upgrade); pushes are not gated. */
  claim: ClaimState | null;
  lastOpenedAt: string;
  lostTo: ScorerInfo | null;
}

export type TrackedMatchMap = Record<string, TrackedMatch>;

/** A match leaves the list this long after it was last opened, once nothing is unsent. */
export const TRACKED_MATCH_TTL_MS = 14 * 24 * 60 * 60 * 1000;

const DOC_ID = "tracked-matches";
type TrackedDoc = { matches: TrackedMatchMap };

export class TrackedMatches {
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private readonly db: RxDatabase<any>) {}

  async get(): Promise<TrackedMatchMap> {
    const doc = await this.db.getLocal<TrackedDoc>(DOC_ID);
    return doc ? { ...doc.toJSON().data.matches } : {};
  }

  get$(): Observable<TrackedMatchMap> {
    return this.db.getLocal$<TrackedDoc>(DOC_ID).pipe(map((doc) => (doc ? { ...doc.toJSON().data.matches } : {})));
  }

  async entry(matchId: string): Promise<TrackedMatch | null> {
    return (await this.get())[matchId] ?? null;
  }

  track(matchId: string, userId: string, now: string = new Date().toISOString()): Promise<void> {
    return this.modify((matches) => {
      const previous = matches[matchId];
      const sameUser = previous?.userId === userId;
      return {
        ...matches,
        [matchId]: {
          userId,
          claim: sameUser ? previous.claim : null,
          lostTo: sameUser ? previous.lostTo : null,
          lastOpenedAt: now,
        },
      };
    });
  }

  setClaim(matchId: string, claim: ClaimState, lostTo: ScorerInfo | null = null): Promise<void> {
    return this.modify((matches) =>
      matches[matchId] ? { ...matches, [matchId]: { ...matches[matchId], claim, lostTo } } : matches
    );
  }

  remove(matchId: string): Promise<void> {
    return this.modify((matches) => {
      const { [matchId]: _removed, ...rest } = matches;
      return rest;
    });
  }

  /** Read-modify-write, serialized within this tab. */
  private modify(change: (matches: TrackedMatchMap) => TrackedMatchMap): Promise<void> {
    const run = async () => {
      const doc = await this.db.getLocal<TrackedDoc>(DOC_ID);
      if (!doc) {
        await this.db.upsertLocal<TrackedDoc>(DOC_ID, { matches: change({}) });
        return;
      }
      await doc.incrementalModify((data: TrackedDoc) => ({ ...data, matches: change({ ...data.matches }) }));
    };
    const next = this.queue.then(run, run);
    this.queue = next.catch(() => undefined);
    return next;
  }
}
```

- [ ] **Step 5: Implement sync states**

Create `lib/rxdb/sync/sync-state.ts`:

```ts
import type { RxDatabase } from "rxdb";
import { filter, firstValueFrom, map, of, timeout } from "rxjs";

/** Local doc `sync-state-<matchId>`: has this match's first pull completed on this device? */
export interface MatchSyncState {
  matchId: string;
  status: "never-synced" | "syncing" | "synced" | "error";
  lastSyncTime: number;
}

const docId = (matchId: string) => `sync-state-${matchId}`;

export class SyncStates {
  constructor(private readonly db: RxDatabase<any>) {}

  async get(matchId: string): Promise<MatchSyncState | null> {
    const doc = await this.db.getLocal<MatchSyncState>(docId(matchId));
    return doc ? (doc.toJSON().data as MatchSyncState) : null;
  }

  async set(matchId: string, status: MatchSyncState["status"]): Promise<void> {
    await this.db.upsertLocal<MatchSyncState>(docId(matchId), { matchId, status, lastSyncTime: Date.now() });
  }

  waitForSynced(matchId: string, timeoutMs: number): Promise<boolean> {
    return firstValueFrom(
      this.db.getLocal$<MatchSyncState>(docId(matchId)).pipe(
        map((doc) => (doc ? (doc.toJSON().data as MatchSyncState).status : null)),
        filter((status) => status === "synced"),
        map(() => true),
        timeout({ first: timeoutMs, with: () => of(false) })
      )
    );
  }
}
```

- [ ] **Step 6: Run them and see them pass**

Run: `pnpm test tests/unit/sync/scorer-claim.test.ts tests/unit/sync/tracked-matches.test.ts tests/unit/sync/sync-state.test.ts`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add lib/rxdb/sync/scorer-claim.ts lib/rxdb/sync/tracked-matches.ts lib/rxdb/sync/sync-state.ts tests/unit/sync/scorer-claim.test.ts tests/unit/sync/tracked-matches.test.ts tests/unit/sync/sync-state.test.ts
git commit -m "feat(sync): persist tracked matches and add the scorer claim client

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: Parent-first gate (foreign keys)

**Files:**
- Modify: `lib/rxdb/sync/types.ts` (add `GateDecision`, `PushGate`)
- Modify: `lib/rxdb/sync/pending-changes.ts` (add `ParentRef`, `ParentStatus`, `parentStatus`, `waitUntilSettled`)
- Create: `lib/rxdb/sync/dependencies.ts`
- Test: `tests/unit/sync/dependencies.test.ts`

**Interfaces:**
- Consumes: `PendingChanges` (Task 6).
- Produces in `types.ts`:

```ts
export type GateDecision =
  | { kind: "send" }
  | { kind: "wait"; reason: "claim" | "parents" }
  | { kind: "reject"; error: ClassifiedError }
  | { kind: "supersede" };
export interface PushGate { check(doc: WithDeleted<any>): Promise<GateDecision> }
```

- Produces in `pending-changes.ts`:
  - `ParentRef { table: MatchCollectionName; docId: string }`
  - `ParentStatus`: `{ kind: "none" } | { kind: "pending"; refs } | { kind: "rejected" | "superseded"; ref }`
  - `PendingChanges.parentStatus(refs): Promise<ParentStatus>`
  - `PendingChanges.waitUntilSettled(refs, timeoutMs): Promise<boolean>`
- Produces in `dependencies.ts`: `PARENT_FIELDS`, `PARENT_WAIT_MS = 5000`, `parentRefs(table, doc): ParentRef[]`, `type ClaimCheck = (matchId: string) => Promise<"ok" | "lost" | "unavailable">`, `createPushGate({ table, matchId, pending, claim, waitMs? }): PushGate`.

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/sync/dependencies.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { LocalDatabase } from "@/lib/rxdb/collections";
import { createPushGate, parentRefs, type ClaimCheck } from "@/lib/rxdb/sync/dependencies";
import type { PendingChanges } from "@/lib/rxdb/sync/pending-changes";
import { createTestDb } from "../helpers/test-db";
import { aScorePoint, aSet } from "../helpers/fixtures";

const MATCH = "20000000-0000-4000-8000-000000000001";
const ok: ClaimCheck = async () => "ok";

describe("parentRefs", () => {
  it("lists the in-match parents of a point, not its stat (no foreign key there)", () => {
    expect(parentRefs("score_points", { match_id: "m", set_id: "s", player_stat_id: "p" })).toEqual([
      { table: "matches", docId: "m" },
      { table: "sets", docId: "s" },
    ]);
  });

  it("skips parents that are not set", () => {
    expect(parentRefs("events", { match_id: "m", set_id: null })).toEqual([{ table: "matches", docId: "m" }]);
  });
});

describe("push gate", () => {
  let db: LocalDatabase;
  let pending: PendingChanges;

  beforeEach(async () => {
    ({ db, pending } = await createTestDb());
  });
  afterEach(async () => {
    await db.remove();
  });

  it("sends a row whose parents are on the server", async () => {
    const gate = createPushGate({ table: "sets", matchId: MATCH, pending, claim: ok });
    expect(await gate.check(aSet(MATCH) as any)).toEqual({ kind: "send" });
  });

  it("does not wait for a parent whose pending change is only an update", async () => {
    const set = aSet(MATCH);
    await db.sets.insert(set as any);
    await pending.onSent("sets", (await db.sets.findOne(set.id).exec())!.toJSON() as any);
    await db.sets.findOne(set.id).update({ $set: { home_score: 1 } });
    const gate = createPushGate({ table: "score_points", matchId: MATCH, pending, claim: ok, waitMs: 50 });
    expect(await gate.check(aScorePoint(MATCH, set.id, 1) as any)).toEqual({ kind: "send" });
  });

  it("waits for a parent insert that uploads in the meantime", async () => {
    const set = aSet(MATCH);
    await db.sets.insert(set as any);
    const gate = createPushGate({ table: "score_points", matchId: MATCH, pending, claim: ok, waitMs: 2000 });
    setTimeout(() => void pending.onSent("sets", { ...set, updated_at: "2999-01-01T00:00:00.000Z" }), 50);
    expect(await gate.check(aScorePoint(MATCH, set.id, 1) as any)).toEqual({ kind: "send" });
  });

  it("asks for a retry while the parent insert is still pending", async () => {
    const set = aSet(MATCH);
    await db.sets.insert(set as any);
    const gate = createPushGate({ table: "score_points", matchId: MATCH, pending, claim: ok, waitMs: 50 });
    expect(await gate.check(aScorePoint(MATCH, set.id, 1) as any)).toEqual({ kind: "wait", reason: "parents" });
  });

  it("rejects a row whose parent was rejected before reaching the server", async () => {
    const set = aSet(MATCH);
    await db.sets.insert(set as any);
    await pending.reject("sets", set, { kind: "permanent", code: "rls" }, { neverUploaded: true });
    const gate = createPushGate({ table: "score_points", matchId: MATCH, pending, claim: ok });
    expect(await gate.check(aScorePoint(MATCH, set.id, 1) as any)).toEqual({
      kind: "reject",
      error: { kind: "permanent", code: "parent_rejected", params: { table: "sets" } },
    });
  });

  it("supersedes a row whose parent was superseded", async () => {
    const set = aSet(MATCH);
    await db.sets.insert(set as any);
    await pending.supersedeMatch(MATCH);
    const gate = createPushGate({ table: "score_points", matchId: MATCH, pending, claim: ok });
    expect(await gate.check(aScorePoint(MATCH, set.id, 1) as any)).toEqual({ kind: "supersede" });
  });

  it("supersedes every row once the claim is lost", async () => {
    const gate = createPushGate({ table: "sets", matchId: MATCH, pending, claim: async () => "lost" });
    expect(await gate.check(aSet(MATCH) as any)).toEqual({ kind: "supersede" });
  });

  it("waits while an offline claim can't be confirmed", async () => {
    const gate = createPushGate({ table: "sets", matchId: MATCH, pending, claim: async () => "unavailable" });
    expect(await gate.check(aSet(MATCH) as any)).toEqual({ kind: "wait", reason: "claim" });
  });
});
```

- [ ] **Step 2: Run them and see them fail**

Run: `pnpm test tests/unit/sync/dependencies.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Add the gate types**

In `lib/rxdb/sync/types.ts`, add these imports at the top: `import type { WithDeleted } from "rxdb";` and `import type { ClassifiedError } from "./errors";`. Then append:

```ts
/** What the push handler does with one row before sending it. */
export type GateDecision =
  | { kind: "send" }
  | { kind: "wait"; reason: "claim" | "parents" }
  | { kind: "reject"; error: ClassifiedError }
  | { kind: "supersede" };

export interface PushGate {
  check(doc: WithDeleted<any>): Promise<GateDecision>;
}
```

- [ ] **Step 4: Add parent lookups to the pending store**

In `lib/rxdb/sync/pending-changes.ts`, change the rxjs import to:

```ts
import { filter, firstValueFrom, map, of, timeout, type Observable } from "rxjs";
```

Add below `PendingFilter`:

```ts
export interface ParentRef {
  table: MatchCollectionName;
  docId: string;
}

export type ParentStatus =
  | { kind: "none" }
  | { kind: "pending"; refs: ParentRef[] }
  | { kind: "rejected" | "superseded"; ref: ParentRef };
```

Add these methods to `PendingChanges`, after `get`:

```ts
  /**
   * Whether these parents block a child row. Only rows the server doesn't have
   * yet block: an unsent insert, or a rejected insert. A pending update of an
   * uploaded parent doesn't.
   */
  async parentStatus(refs: ParentRef[]): Promise<ParentStatus> {
    if (refs.length === 0) return { kind: "none" };
    const found = await this.collection.findByIds(refs.map((ref) => pendingId(ref.table, ref.docId))).exec();
    const entries = [...found.values()].map((doc) => doc.toJSON() as PendingChange);
    const toRef = (entry: PendingChange): ParentRef => ({ table: entry.table_name, docId: entry.doc_id });
    const superseded = entries.find((entry) => entry.status === "superseded");
    if (superseded) return { kind: "superseded", ref: toRef(superseded) };
    const rejected = entries.find((entry) => entry.status === "rejected" && (entry.is_insert || entry.never_uploaded));
    if (rejected) return { kind: "rejected", ref: toRef(rejected) };
    const inserts = entries.filter((entry) => entry.status === "pending" && entry.is_insert);
    return inserts.length > 0 ? { kind: "pending", refs: inserts.map(toRef) } : { kind: "none" };
  }

  /** Resolves true once none of these entries is pending, false after `timeoutMs`. */
  waitUntilSettled(refs: ParentRef[], timeoutMs: number): Promise<boolean> {
    const ids = refs.map((ref) => pendingId(ref.table, ref.docId));
    return firstValueFrom(
      this.collection.find({ selector: { id: { $in: ids }, status: "pending" } }).$.pipe(
        filter((docs) => docs.length === 0),
        map(() => true),
        timeout({ first: timeoutMs, with: () => of(false) })
      )
    );
  }
```

- [ ] **Step 5: Implement the gate**

Create `lib/rxdb/sync/dependencies.ts`:

```ts
import type { WithDeleted } from "rxdb";
import type { ParentRef, PendingChanges } from "./pending-changes";
import type { GateDecision, MatchCollectionName, PushGate } from "./types";

/**
 * Foreign keys between match tables (spec, "Verification findings").
 * `score_points.player_stat_id` has no foreign key, so a point never waits for its stat.
 */
export const PARENT_FIELDS: Record<MatchCollectionName, ReadonlyArray<{ field: string; table: MatchCollectionName }>> = {
  matches: [],
  sets: [{ field: "match_id", table: "matches" }],
  player_stats: [
    { field: "match_id", table: "matches" },
    { field: "set_id", table: "sets" },
  ],
  score_points: [
    { field: "match_id", table: "matches" },
    { field: "set_id", table: "sets" },
  ],
  events: [
    { field: "match_id", table: "matches" },
    { field: "set_id", table: "sets" },
  ],
};

/** How long a row waits in the handler for a parent uploading through another replication. */
export const PARENT_WAIT_MS = 5000;

export function parentRefs(table: MatchCollectionName, doc: Record<string, unknown>): ParentRef[] {
  return PARENT_FIELDS[table]
    .map(({ field, table: parentTable }) => ({ table: parentTable, docId: doc[field] }))
    .filter((ref): ref is ParentRef => typeof ref.docId === "string" && ref.docId.length > 0);
}

/**
 * The device's right to push this match: "ok" (claimed, or never claimed),
 * "lost" (another device took over), "unavailable" (an offline claim that
 * can't be confirmed yet).
 */
export type ClaimCheck = (matchId: string) => Promise<"ok" | "lost" | "unavailable">;

export interface PushGateOptions {
  table: MatchCollectionName;
  matchId: string;
  pending: PendingChanges;
  claim: ClaimCheck;
  waitMs?: number;
}

export function createPushGate({ table, matchId, pending, claim, waitMs = PARENT_WAIT_MS }: PushGateOptions): PushGate {
  return {
    async check(doc: WithDeleted<any>): Promise<GateDecision> {
      const claimState = await claim(matchId);
      if (claimState === "lost") return { kind: "supersede" };
      if (claimState === "unavailable") return { kind: "wait", reason: "claim" };

      const refs = parentRefs(table, doc);
      let status = await pending.parentStatus(refs);
      if (status.kind === "pending") {
        await pending.waitUntilSettled(status.refs, waitMs);
        status = await pending.parentStatus(refs);
      }
      switch (status.kind) {
        case "none":
          return { kind: "send" };
        case "pending":
          return { kind: "wait", reason: "parents" };
        case "superseded":
          return { kind: "supersede" };
        case "rejected":
          return {
            kind: "reject",
            error: { kind: "permanent", code: "parent_rejected", params: { table: status.ref.table } },
          };
      }
    },
  };
}
```

- [ ] **Step 6: Run them and see them pass**

Run: `pnpm test tests/unit/sync/dependencies.test.ts tests/unit/sync/pending-changes.test.ts`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add lib/rxdb/sync/types.ts lib/rxdb/sync/pending-changes.ts lib/rxdb/sync/dependencies.ts tests/unit/sync/dependencies.test.ts
git commit -m "feat(sync): upload parents before the rows that reference them

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 10: Replication adapter

**Files:**
- Modify: `lib/rxdb/sync/types.ts` (add `PushReporter`, `SupabaseReplicationOptions`)
- Create: `lib/rxdb/sync/replication.ts` (the old `index.ts` stays until Task 12 removes it)
- Test: `tests/unit/sync/replication.test.ts`

**Interfaces:**
- Consumes:
  - `pickSchemaFields` and `addDocEqualityToQuery` (from `helper.ts`)
  - `docsEqual` (Task 5)
  - `classifyPushError`, `countsTowardsAttemptLimit`, `MAX_TEMPORARY_ATTEMPTS` (Task 4)
  - `PushGate` (Task 9)
  - `SupabaseCheckpoint` (already in `types.ts`)
- Produces in `types.ts`:

```ts
export interface PushReporter {
  rejected(doc: WithDeleted<any>, error: ClassifiedError, opts: { neverUploaded: boolean }): Promise<void>;
  superseded(doc: WithDeleted<any>): Promise<void>;
  /** Called for failures that count towards MAX_TEMPORARY_ATTEMPTS; returns the attempts so far. */
  temporaryFailure(doc: WithDeleted<any>, error: ClassifiedError): Promise<number>;
  neverUploaded(docId: string): Promise<boolean>;
}
export interface SupabaseReplicationOptions {
  replicationIdentifier: string;
  collection: RxCollection<any>;
  client: SupabaseClient<any>;
  tableName: string;
  deviceId?: string;
  live?: boolean;
  retryTime?: number;
  waitForLeadership?: boolean;
  autoStart?: boolean;
  pull?: { batchSize?: number; queryBuilder?: (query: any) => any };
  push?: {
    batchSize?: number;
    modifier?: (doc: WithDeleted<any>) => WithDeleted<any> | null;
    gate?: PushGate;
    reporter?: PushReporter;
  };
}
```

- Produces in `replication.ts`: `replicateSupabase(options: SupabaseReplicationOptions): RxReplicationState<any, SupabaseCheckpoint>`, `PushRetryError`, `MODIFIED_FIELD = "_modified"`, `DELETED_FIELD = "_deleted"`.

- [ ] **Step 1: Add the option types**

In `lib/rxdb/sync/types.ts`:
- Extend the `rxdb` type import to `import type { RxCollection, WithDeleted } from "rxdb";`.
- Make sure `import type { SupabaseClient } from "@supabase/supabase-js";` is present (it already is).
- Append the `PushReporter` and `SupabaseReplicationOptions` declarations shown under **Interfaces** above.

- [ ] **Step 2: Write the failing tests**

Create `tests/unit/sync/replication.test.ts`:

```ts
import { afterEach, describe, expect, it } from "vitest";
import type { RxReplicationState } from "rxdb/plugins/replication";
import type { LocalDatabase } from "@/lib/rxdb/collections";
import { replicateSupabase } from "@/lib/rxdb/sync/replication";
import type { PushGate, PushReporter } from "@/lib/rxdb/sync/types";
import type { FakeSupabaseServer } from "../fakes/fake-supabase";
import { createTestDb } from "../helpers/test-db";
import { createFakeServer } from "../helpers/server";
import { aSet, seedServerMatch, seedTeams } from "../helpers/fixtures";
import { sleep, waitFor } from "../helpers/wait";

function recordingReporter(neverUploaded = new Set<string>()) {
  const calls = {
    rejected: [] as Array<{ id: string; code: string; neverUploaded: boolean }>,
    superseded: [] as string[],
    attempts: [] as string[],
  };
  const reporter: PushReporter = {
    rejected: async (doc, error, opts) => {
      calls.rejected.push({ id: doc.id, code: error.code, neverUploaded: opts.neverUploaded });
    },
    superseded: async (doc) => {
      calls.superseded.push(doc.id);
    },
    temporaryFailure: async (doc) => {
      calls.attempts.push(doc.id);
      return calls.attempts.filter((id) => id === doc.id).length;
    },
    neverUploaded: async (id) => neverUploaded.has(id),
  };
  return { reporter, calls };
}

describe("replicateSupabase", () => {
  let db: LocalDatabase;
  let server: FakeSupabaseServer;
  let matchId: string;
  const states: RxReplicationState<any, any>[] = [];

  async function setup() {
    server = createFakeServer();
    seedTeams(server);
    matchId = seedServerMatch(server);
    ({ db } = await createTestDb());
  }

  function replicate(
    table: "matches" | "sets",
    extra: { identifier?: string; gate?: PushGate; reporter?: PushReporter } = {}
  ) {
    const state = replicateSupabase({
      replicationIdentifier: extra.identifier ?? `test_${table}`,
      collection: db[table] as any,
      client: server.client(),
      tableName: table,
      deviceId: "device-a",
      live: true,
      retryTime: 50,
      waitForLeadership: false,
      pull: { queryBuilder: (query) => (table === "matches" ? query.eq("id", matchId) : query.eq("match_id", matchId)) },
      push: { gate: extra.gate, reporter: extra.reporter },
    });
    states.push(state);
    return state;
  }

  afterEach(async () => {
    await Promise.all(states.splice(0).map((state) => state.cancel()));
    await db?.remove();
  });

  it("keeps every update of a set (updates used to be discarded as conflicts)", async () => {
    await setup();
    const state = replicate("sets");
    await state.awaitInitialReplication();
    const set = aSet(matchId);
    await db.sets.insert(set as any);
    for (let score = 1; score <= 5; score++) {
      await db.sets.findOne(set.id).update({ $set: { home_score: score } });
      await waitFor(() => server.row("sets", set.id)?.home_score === score, { message: `score ${score} uploaded` });
    }
    for (let score = 6; score <= 10; score++) await db.sets.findOne(set.id).update({ $set: { home_score: score } });
    await waitFor(() => server.row("sets", set.id)?.home_score === 10, { message: "score 10 uploaded" });
    await state.awaitInSync();
    expect((await db.sets.findOne(set.id).exec())!.home_score).toBe(10);
  });

  it("keeps the device's version when the server row changed under it", async () => {
    await setup();
    const state = replicate("sets");
    await state.awaitInitialReplication();
    const set = aSet(matchId);
    await db.sets.insert(set as any);
    await waitFor(() => !!server.row("sets", set.id), { message: "set uploaded" });
    server.editAsWebsite("sets", set.id, { home_score: 99 });
    await db.sets.findOne(set.id).update({ $set: { home_score: 3 } });
    await waitFor(() => server.row("sets", set.id)?.home_score === 3, { message: "device version on the server" });
    await state.awaitInSync();
    expect((await db.sets.findOne(set.id).exec())!.home_score).toBe(3);
  });

  it("drops server-only columns when pulling", async () => {
    await setup();
    server.setScorer(matchId, { deviceId: "device-b" });
    const state = replicate("matches");
    await state.awaitInitialReplication();
    const local = (await db.matches.findOne(matchId).exec())!.toJSON() as Record<string, unknown>;
    expect(local.id).toBe(matchId);
    expect(local).not.toHaveProperty("scorer_device_id");
    expect(local).not.toHaveProperty("_modified");
  });

  it("pulls new rows with the _modified checkpoint", async () => {
    await setup();
    server.seed("sets", aSet(matchId, { set_number: 1 }));
    const state = replicate("sets");
    await state.awaitInitialReplication();
    server.seed("sets", aSet(matchId, { set_number: 2 }));
    state.reSync();
    await waitFor(async () => (await db.sets.find().exec()).length === 2, { message: "second set pulled" });
  });

  it("does not raise a conflict when an insert's response was lost", async () => {
    await setup();
    const state = replicate("sets");
    await state.awaitInitialReplication();
    const conflicts: unknown[] = [];
    state.conflict$.subscribe((conflict) => conflicts.push(conflict));
    server.loseNextResponse("sets");
    const set = aSet(matchId);
    await db.sets.insert(set as any);
    await waitFor(
      () => server.log.filter((entry) => entry.table === "sets" && entry.op === "insert" && entry.ids.includes(set.id)).length >= 2,
      { message: "insert retried" }
    );
    await state.awaitInSync();
    expect(conflicts).toHaveLength(0);
  });

  it("keeps an edit made after an interrupted insert", async () => {
    await setup();
    const state = replicate("sets");
    await state.awaitInitialReplication();
    server.loseNextResponse("sets");
    const set = aSet(matchId);
    await db.sets.insert(set as any);
    await waitFor(() => !!server.row("sets", set.id), { message: "insert committed" });
    await db.sets.findOne(set.id).update({ $set: { home_score: 4 } });
    await waitFor(() => server.row("sets", set.id)?.home_score === 4, { message: "edit uploaded" });
  });

  it("does not let a stale local copy overwrite a later website correction", async () => {
    await setup();
    const set = aSet(matchId, { home_score: 7, updated_at: "2026-01-01T00:00:00.000Z" });
    server.seed("sets", { ...set });
    server.editAsWebsite("sets", set.id, { home_score: 10 });
    await db.sets.insert(set as any); // the copy an older app version left on the device
    const state = replicate("sets", { identifier: "fresh_after_upgrade" });
    await waitFor(async () => (await db.sets.findOne(set.id).exec())?.home_score === 10, { message: "device takes the correction" });
    await state.awaitInSync();
    expect(server.row("sets", set.id)!.home_score).toBe(10);
  });

  it("keeps sending the other rows when one is rejected", async () => {
    await setup();
    const { reporter, calls } = recordingReporter();
    server.denyWrites("sets", (row) => row.set_number === 1);
    const state = replicate("sets", { reporter });
    await state.awaitInitialReplication();
    const first = aSet(matchId, { set_number: 1 });
    const second = aSet(matchId, { set_number: 2 });
    await db.sets.insert(first as any);
    await db.sets.insert(second as any);
    await waitFor(() => !!server.row("sets", second.id), { message: "second set uploaded" });
    expect(server.row("sets", first.id)).toBeUndefined();
    expect(calls.rejected).toEqual([{ id: first.id, code: "rls", neverUploaded: true }]);
  });

  it("holds back rows the gate says must wait, without sending them", async () => {
    await setup();
    let ready = false;
    const gate: PushGate = { check: async () => (ready ? { kind: "send" } : { kind: "wait", reason: "parents" }) };
    const state = replicate("sets", { gate });
    await state.awaitInitialReplication();
    const set = aSet(matchId);
    await db.sets.insert(set as any);
    await sleep(200);
    expect(server.log.some((entry) => entry.table === "sets" && entry.op === "insert")).toBe(false);
    ready = true;
    await waitFor(() => !!server.row("sets", set.id), { message: "set uploaded once the gate opened" });
  });

  it("reports rows refused because another device scores the match", async () => {
    await setup();
    server.setScorer(matchId, { deviceId: "device-b" });
    const { reporter, calls } = recordingReporter();
    const state = replicate("sets", { reporter });
    await state.awaitInitialReplication();
    const set = aSet(matchId);
    await db.sets.insert(set as any);
    await waitFor(() => calls.superseded.includes(set.id), { message: "superseded reported" });
    expect(server.row("sets", set.id)).toBeUndefined();
  });

  it("retries through a network outage without counting attempts", async () => {
    await setup();
    const { reporter, calls } = recordingReporter();
    const state = replicate("sets", { reporter });
    await state.awaitInitialReplication();
    server.offline = true;
    const set = aSet(matchId);
    await db.sets.insert(set as any);
    await sleep(300);
    expect(server.row("sets", set.id)).toBeUndefined();
    server.offline = false;
    await waitFor(() => !!server.row("sets", set.id), { message: "uploaded after the outage" });
    expect(calls.attempts).toEqual([]);
    expect(calls.rejected).toEqual([]);
  });

  it("rejects a row whose parent never arrives after 20 attempts", async () => {
    await setup();
    const { reporter, calls } = recordingReporter();
    const state = replicate("sets", { reporter });
    await state.awaitInitialReplication();
    const orphan = aSet("20000000-0000-4000-8000-0000000000ff");
    await db.sets.insert(orphan as any);
    await waitFor(() => calls.rejected.some((call) => call.id === orphan.id), { message: "orphan rejected", timeoutMs: 15_000 });
    expect(calls.rejected.find((call) => call.id === orphan.id)!.code).toBe("too_many_attempts");
  });

  it("rejects, instead of re-creating, an update of a row deleted on the server", async () => {
    await setup();
    const { reporter, calls } = recordingReporter();
    const state = replicate("sets", { reporter });
    await state.awaitInitialReplication();
    const set = aSet(matchId);
    await db.sets.insert(set as any);
    await waitFor(() => !!server.row("sets", set.id), { message: "set uploaded" });
    server.hardDelete("sets", set.id);
    await db.sets.findOne(set.id).update({ $set: { home_score: 2 } });
    await waitFor(() => calls.rejected.some((call) => call.id === set.id), { message: "update rejected" });
    expect(calls.rejected[0].code).toBe("deleted_on_server");
    expect(server.row("sets", set.id)).toBeUndefined();
  });

  it("inserts a row the server never accepted when it is retried", async () => {
    await setup();
    const neverUploaded = new Set<string>();
    const { reporter } = recordingReporter(neverUploaded);
    const state = replicate("sets", { reporter });
    await state.awaitInitialReplication();
    server.denyWrites("sets", () => true);
    const set = aSet(matchId);
    neverUploaded.add(set.id);
    await db.sets.insert(set as any);
    await sleep(200);
    server.allowWrites("sets");
    await db.sets.findOne(set.id).update({ $set: { home_score: 1 } });
    await waitFor(() => server.row("sets", set.id)?.home_score === 1, { message: "row inserted on retry" });
  });

  it("sends x-device-id with every request", async () => {
    await setup();
    const state = replicate("sets");
    await state.awaitInitialReplication();
    const set = aSet(matchId);
    await db.sets.insert(set as any);
    await waitFor(() => !!server.row("sets", set.id), { message: "set uploaded" });
    const requests = server.log.filter((entry) => entry.table === "sets");
    expect(requests.length).toBeGreaterThan(0);
    expect(requests.every((entry) => entry.headers["x-device-id"] === "device-a")).toBe(true);
  });
});
```

- [ ] **Step 3: Run them and see them fail**

Run: `pnpm test tests/unit/sync/replication.test.ts`
Expected: FAIL, cannot resolve `@/lib/rxdb/sync/replication`.

- [ ] **Step 4: Implement the adapter**

Create `lib/rxdb/sync/replication.ts`:

```ts
import {
  addRxPlugin,
  flatClone,
  lastOfArray,
  type ReplicationPullOptions,
  type ReplicationPushOptions,
  type RxReplicationWriteToMasterRow,
  type WithDeleted,
} from "rxdb";
import { RxDBLeaderElectionPlugin } from "rxdb/plugins/leader-election";
import { RxReplicationState, startReplicationOnLeaderShip } from "rxdb/plugins/replication";
import { docsEqual } from "./conflict-handler";
import { classifyPushError, countsTowardsAttemptLimit, MAX_TEMPORARY_ATTEMPTS, type PostgrestLikeError } from "./errors";
import { addDocEqualityToQuery, pickSchemaFields, POSTGRES_INSERT_CONFLICT_CODE } from "./helper";
import type { SupabaseCheckpoint, SupabaseReplicationOptions } from "./types";

/** Server-only checkpoint column, set by a trigger (spec section 1). */
export const MODIFIED_FIELD = "_modified";
export const DELETED_FIELD = "_deleted";

/** Thrown by the push handler so RxDB retries the batch after `retryTime`. */
export class PushRetryError extends Error {
  constructor(readonly reasons: string[]) {
    super(`push retry: ${reasons.join(", ")}`);
    this.name = "PushRetryError";
  }
}

type WriteOutcome =
  | { kind: "ok" }
  | { kind: "conflict"; master: WithDeleted<any> }
  | { kind: "error"; error: PostgrestLikeError; status: number; phase: "insert" | "update" };

type FetchOutcome = { doc: WithDeleted<any> | null } | { error: PostgrestLikeError; status: number };

/**
 * RxDB replication with Supabase, based on rxdb/plugins/replication-supabase
 * 17.6.0. Differences: the `_modified` checkpoint column is server-only,
 * unknown server columns are dropped, rows are pushed one at a time through a
 * gate (parents first, scorer claim) with per-row error classification, and
 * sync requests carry `x-device-id`.
 */
export function replicateSupabase(options: SupabaseReplicationOptions): RxReplicationState<any, SupabaseCheckpoint> {
  addRxPlugin(RxDBLeaderElectionPlugin);
  const { collection, client, tableName, deviceId } = options;
  const primaryPath = collection.schema.primaryPath as string;
  const schemaProperties = collection.schema.jsonSchema.properties as Record<string, unknown>;

  function withDevice<Q>(query: Q): Q {
    return deviceId ? (query as any).setHeader("x-device-id", deviceId) : query;
  }

  function rowToDoc(row: Record<string, unknown>): WithDeleted<any> {
    const doc = pickSchemaFields(row, schemaProperties) as Record<string, unknown>;
    doc._deleted = !!row[DELETED_FIELD];
    return doc as WithDeleted<any>;
  }

  async function fetchById(id: string): Promise<FetchOutcome> {
    const { data, error, status } = await withDevice(client.from(tableName).select("*").eq(primaryPath, id).limit(1));
    if (error) return { error, status };
    return { doc: data && data.length === 1 ? rowToDoc(data[0]) : null };
  }

  async function insert(doc: WithDeleted<any>): Promise<WriteOutcome> {
    const { error, status } = await withDevice(client.from(tableName).insert(doc));
    if (!error) return { kind: "ok" };
    if (error.code !== POSTGRES_INSERT_CONFLICT_CODE) return { kind: "error", error, status, phase: "insert" };
    const found = await fetchById(doc[primaryPath]);
    if ("error" in found) return { kind: "error", error: found.error, status: found.status, phase: "insert" };
    // Duplicate on another unique constraint, or a row this user can't read.
    if (!found.doc) return { kind: "error", error, status, phase: "insert" };
    // An earlier attempt was committed but its response was lost.
    return docsEqual(found.doc, doc) ? { kind: "ok" } : { kind: "conflict", master: found.doc };
  }

  async function update(doc: WithDeleted<any>, assumed: WithDeleted<any>): Promise<WriteOutcome> {
    const id = doc[primaryPath] as string;
    const row: Record<string, unknown> = flatClone(doc);
    delete row[MODIFIED_FIELD];
    const query = addDocEqualityToQuery(
      collection.schema.jsonSchema,
      DELETED_FIELD,
      MODIFIED_FIELD,
      assumed,
      client.from(tableName).update(row)
    );
    const { data, error, status } = await withDevice(query.select());
    if (error) return { kind: "error", error, status, phase: "update" };
    if (data && data.length > 0) return { kind: "ok" };
    const found = await fetchById(id);
    if ("error" in found) return { kind: "error", error: found.error, status: found.status, phase: "update" };
    if (!found.doc) {
      // Never accepted by the server (rejected insert being retried): insert it.
      if (await options.push?.reporter?.neverUploaded(id)) return insert(doc);
      // Deleted on the server: never re-create it silently.
      return { kind: "error", error: { code: "row_missing", message: "row_missing" }, status: 404, phase: "update" };
    }
    return docsEqual(found.doc, doc) ? { kind: "ok" } : { kind: "conflict", master: found.doc };
  }

  const pull: ReplicationPullOptions<any, SupabaseCheckpoint> | undefined = options.pull
    ? {
        batchSize: options.pull.batchSize ?? 100,
        async handler(lastCheckpoint, batchSize) {
          let query = client.from(tableName).select("*");
          if (options.pull?.queryBuilder) query = options.pull.queryBuilder(query) ?? query;
          if (lastCheckpoint) {
            const { modified, id } = lastCheckpoint;
            query = query.or(
              `"${MODIFIED_FIELD}".gt.${modified},and("${MODIFIED_FIELD}".eq.${modified},"${primaryPath}".gt.${id})`
            );
          }
          query = query
            .order(MODIFIED_FIELD, { ascending: true })
            .order(primaryPath, { ascending: true })
            .limit(batchSize);
          const { data, error } = await withDevice(query);
          if (error) throw error;
          const rows = (data ?? []) as Record<string, any>[];
          const last = lastOfArray(rows);
          return {
            documents: rows.map(rowToDoc),
            checkpoint: last ? { id: last[primaryPath], modified: last[MODIFIED_FIELD] } : lastCheckpoint,
          };
        },
      }
    : undefined;

  // Rows accepted during a batch that is then retried: not sent again.
  const accepted = new Map<string, string>();

  const push: ReplicationPushOptions<any> | undefined = options.push
    ? {
        batchSize: options.push.batchSize ?? 50,
        modifier: options.push.modifier,
        async handler(rows: RxReplicationWriteToMasterRow<any>[]) {
          const { gate, reporter } = options.push!;
          const conflicts: WithDeleted<any>[] = [];
          const retryReasons: string[] = [];

          for (const row of rows) {
            const doc = row.newDocumentState as WithDeleted<any>;
            const id = doc[primaryPath] as string;
            if (accepted.get(id) === JSON.stringify(doc)) continue;

            const decision = gate ? await gate.check(doc) : ({ kind: "send" } as const);
            if (decision.kind === "wait") {
              retryReasons.push(`${id}: waiting for ${decision.reason}`);
              if (decision.reason === "claim") break; // every row of the match waits for the claim
              continue;
            }
            if (decision.kind === "supersede") {
              await reporter?.superseded(doc);
              continue;
            }
            if (decision.kind === "reject") {
              await reporter?.rejected(doc, decision.error, { neverUploaded: !row.assumedMasterState });
              continue;
            }

            const outcome = row.assumedMasterState
              ? await update(doc, row.assumedMasterState as WithDeleted<any>)
              : await insert(doc);
            if (outcome.kind === "ok") {
              accepted.set(id, JSON.stringify(doc));
              continue;
            }
            if (outcome.kind === "conflict") {
              conflicts.push(outcome.master);
              continue;
            }

            const classified = classifyPushError(outcome.error, outcome.status);
            if (classified.kind === "superseded") {
              await reporter?.superseded(doc);
              continue;
            }
            if (classified.kind === "permanent") {
              await reporter?.rejected(doc, classified, { neverUploaded: outcome.phase === "insert" });
              continue;
            }
            if (reporter && countsTowardsAttemptLimit(classified.code)) {
              const attempts = await reporter.temporaryFailure(doc, classified);
              if (attempts >= MAX_TEMPORARY_ATTEMPTS) {
                await reporter.rejected(
                  doc,
                  { kind: "permanent", code: "too_many_attempts", params: { last: classified.code } },
                  { neverUploaded: outcome.phase === "insert" }
                );
                continue;
              }
            }
            retryReasons.push(`${id}: ${classified.code}`);
            if (classified.code === "network" || classified.code === "auth") break; // the next rows would fail too
          }

          if (retryReasons.length > 0) throw new PushRetryError(retryReasons);
          for (const row of rows) accepted.delete((row.newDocumentState as any)[primaryPath]);
          return conflicts;
        },
      }
    : undefined;

  const state = new RxReplicationState<any, SupabaseCheckpoint>(
    options.replicationIdentifier,
    collection,
    DELETED_FIELD,
    pull,
    push,
    options.live ?? true,
    options.retryTime ?? 5000,
    options.autoStart ?? true,
    false // keep replicating in the background tab that holds leadership
  );
  startReplicationOnLeaderShip(options.waitForLeadership ?? true, state);
  return state;
}
```

- [ ] **Step 5: Run them and see them pass**

Run: `pnpm test tests/unit/sync/replication.test.ts`
Expected: all 15 pass. If one fails, read RxDB's `replication-protocol/upstream.js` before changing the adapter. Change the test only if it asserts something the spec doesn't require, and say so in the commit.

- [ ] **Step 6: Commit**

```bash
git add lib/rxdb/sync/types.ts lib/rxdb/sync/replication.ts tests/unit/sync/replication.test.ts
git commit -m "feat(sync): add a Supabase replication adapter that never discards local edits

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 11: Per-match and reference replications

**Files:**
- Create: `lib/rxdb/sync/match-sync.ts`
- Create: `lib/rxdb/sync/reference-sync.ts`
- Test: `tests/unit/sync/match-sync.test.ts`

**Interfaces:**
- Consumes: `replicateSupabase` (Task 10), `createPushGate` and `ClaimCheck` (Task 9), `PendingChanges` and `matchIdOf` (Task 6), `MATCH_COLLECTIONS` and `SyncUser` (Task 6).
- Produces in `match-sync.ts`:
  - `interface MatchSyncDeps { db; client; pending; deviceId; claim: ClaimCheck; onSuperseded(matchId): Promise<void>; onSynced(matchId): Promise<void>; waitForLeadership: boolean; retryTime: number }`
  - `matchReplicationIdentifier(table, matchId)`
  - `class MatchSync` with `constructor(matchId, deps)`, `start()`, `reSync()`, `awaitInSync()`, `cancel()`
- Produces in `reference-sync.ts`:
  - `interface ReferenceSyncDeps { db; client; waitForLeadership; retryTime }`
  - `filterKey(values): string`
  - `class ReferenceSync` with `start(user)`, `reSync()`, `stop()`

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/sync/match-sync.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { LocalDatabase } from "@/lib/rxdb/collections";
import { MatchSync, type MatchSyncDeps } from "@/lib/rxdb/sync/match-sync";
import type { PendingChanges } from "@/lib/rxdb/sync/pending-changes";
import { ReferenceSync } from "@/lib/rxdb/sync/reference-sync";
import type { FakeSupabaseServer } from "../fakes/fake-supabase";
import { createTestDb } from "../helpers/test-db";
import { createFakeServer } from "../helpers/server";
import {
  AWAY_TEAM_ID,
  HOME_TEAM_ID,
  PLAYER_ID,
  USER_ID,
  aPlayerStat,
  aScorePoint,
  aSet,
  anEvent,
  seedServerMatch,
  seedTeams,
} from "../helpers/fixtures";
import { sleep, waitFor } from "../helpers/wait";

describe("MatchSync", () => {
  let db: LocalDatabase;
  let pending: PendingChanges;
  let server: FakeSupabaseServer;
  let matchId: string;
  const syncs: MatchSync[] = [];

  beforeEach(async () => {
    server = createFakeServer();
    seedTeams(server);
    matchId = seedServerMatch(server);
    ({ db, pending } = await createTestDb());
  });
  afterEach(async () => {
    await Promise.all(syncs.splice(0).map((sync) => sync.cancel()));
    await db.remove();
  });

  function startMatchSync(id: string, overrides: Partial<MatchSyncDeps> = {}) {
    const synced: string[] = [];
    const sync = new MatchSync(id, {
      db,
      client: server.client(),
      pending,
      deviceId: "device-a",
      claim: async () => "ok",
      onSuperseded: async () => {},
      onSynced: async (synchronized) => {
        synced.push(synchronized);
      },
      waitForLeadership: false,
      retryTime: 50,
      ...overrides,
    });
    sync.start();
    syncs.push(sync);
    return { sync, synced };
  }

  it("pulls the match with its rows and reports it synced", async () => {
    const set = server.seed("sets", aSet(matchId));
    const { synced } = startMatchSync(matchId);
    await waitFor(() => synced.includes(matchId), { message: "match synced" });
    expect(await db.matches.findOne(matchId).exec()).not.toBeNull();
    expect(await db.sets.findOne(set.id).exec()).not.toBeNull();
  });

  it("clears pending entries once the rows are uploaded", async () => {
    const { sync } = startMatchSync(matchId);
    const set = aSet(matchId);
    await db.sets.insert(set as any);
    await waitFor(async () => (await pending.count({ matchId })) === 0, { message: "pending cleared" });
    expect(server.row("sets", set.id)).toBeDefined();
    await sync.awaitInSync();
  });

  it("uploads the rows of two matches once each, through their own replications", async () => {
    const otherMatchId = seedServerMatch(server);
    startMatchSync(matchId);
    startMatchSync(otherMatchId);
    const a = aSet(matchId);
    const b = aSet(otherMatchId);
    await db.sets.insert(a as any);
    await db.sets.insert(b as any);
    await waitFor(() => !!server.row("sets", a.id) && !!server.row("sets", b.id), { message: "both sets uploaded" });
    await sleep(200);
    const inserts = (id: string) =>
      server.log.filter((entry) => entry.table === "sets" && entry.op === "insert" && entry.ids.includes(id)).length;
    expect(inserts(a.id)).toBe(1);
    expect(inserts(b.id)).toBe(1);
  });

  it("records a rejected row without blocking the rest", async () => {
    server.denyWrites("events", () => true);
    startMatchSync(matchId);
    const set = aSet(matchId);
    const event = anEvent(matchId, null);
    await db.events.insert(event as any);
    await db.sets.insert(set as any);
    await waitFor(() => !!server.row("sets", set.id), { message: "set uploaded" });
    await waitFor(async () => (await pending.get("events", event.id))?.status === "rejected", { message: "event rejected" });
    expect((await pending.get("events", event.id))?.error_code).toBe("rls");
  });

  it("uploads a point recorded together with its set without a foreign-key error", async () => {
    startMatchSync(matchId);
    const set = aSet(matchId);
    const stat = aPlayerStat(matchId, set.id);
    const point = aScorePoint(matchId, set.id, 1, { player_stat_id: stat.id });
    await db.sets.insert(set as any);
    await db.player_stats.insert(stat as any);
    await db.score_points.insert(point as any);
    await waitFor(() => !!server.row("score_points", point.id) && !!server.row("player_stats", stat.id), {
      message: "point and stat uploaded",
    });
    expect(server.responseCodes()).not.toContain("23503");
  });
});

describe("ReferenceSync", () => {
  it("pulls teams and only the members of the user's teams", async () => {
    const server = createFakeServer();
    seedTeams(server);
    server.seed("team_members", {
      id: "30000000-0000-4000-8000-000000000009",
      team_id: AWAY_TEAM_ID,
      name: "Other",
      number: 9,
      role: "player",
    });
    const { db } = await createTestDb();
    const reference = new ReferenceSync({ db, client: server.client(), waitForLeadership: false, retryTime: 50 });
    reference.start({ id: USER_ID, teamIds: [HOME_TEAM_ID], clubIds: [] });
    await waitFor(
      async () => (await db.teams.find().exec()).length === 2 && (await db.team_members.find().exec()).length === 1,
      { message: "reference data pulled" }
    );
    expect((await db.team_members.find().exec())[0].id).toBe(PLAYER_ID);
    await reference.stop();
    await db.remove();
  });
});
```

- [ ] **Step 2: Run them and see them fail**

Run: `pnpm test tests/unit/sync/match-sync.test.ts`
Expected: FAIL, modules not found.

- [ ] **Step 3: Implement `MatchSync`**

Create `lib/rxdb/sync/match-sync.ts`:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { RxReplicationState } from "rxdb/plugins/replication";
import { filter, from, switchMap, type Subscription } from "rxjs";
import type { LocalDatabase } from "../collections";
import { createPushGate, type ClaimCheck } from "./dependencies";
import { matchIdOf, type PendingChanges } from "./pending-changes";
import { replicateSupabase } from "./replication";
import { MATCH_COLLECTIONS, type MatchCollectionName, type PushReporter, type SupabaseCheckpoint } from "./types";

export interface MatchSyncDeps {
  db: LocalDatabase;
  client: SupabaseClient<any>;
  pending: PendingChanges;
  deviceId: string;
  claim: ClaimCheck;
  onSuperseded(matchId: string): Promise<void>;
  onSynced(matchId: string): Promise<void>;
  waitForLeadership: boolean;
  retryTime: number;
}

export const matchReplicationIdentifier = (table: MatchCollectionName, matchId: string): string =>
  `sync2_${table}_match_${matchId}`;

/** The five replications of one match (pull its rows, push this device's changes to them). */
export class MatchSync {
  private readonly states = new Map<MatchCollectionName, RxReplicationState<any, SupabaseCheckpoint>>();
  private subscriptions: Subscription[] = [];

  constructor(
    readonly matchId: string,
    private readonly deps: MatchSyncDeps
  ) {}

  start(): void {
    for (const table of MATCH_COLLECTIONS) {
      const field = table === "matches" ? "id" : "match_id";
      const state = replicateSupabase({
        replicationIdentifier: matchReplicationIdentifier(table, this.matchId),
        collection: this.deps.db[table] as any,
        client: this.deps.client,
        tableName: table,
        deviceId: this.deps.deviceId,
        live: true,
        retryTime: this.deps.retryTime,
        waitForLeadership: this.deps.waitForLeadership,
        pull: { queryBuilder: (query) => query.eq(field, this.matchId) },
        push: {
          // Each match's replication only pushes that match's rows.
          modifier: (doc) => (matchIdOf(table, doc) === this.matchId ? doc : null),
          gate: createPushGate({ table, matchId: this.matchId, pending: this.deps.pending, claim: this.deps.claim }),
          reporter: this.reporter(table),
        },
      });
      this.states.set(table, state);
      this.subscriptions.push(
        state.sent$.subscribe((doc) => void this.deps.pending.onSent(table, doc as any)),
        state.active$
          .pipe(
            filter((active) => !active),
            switchMap(() => {
              const before = new Date().toISOString();
              return from(state.awaitInSync().then(() => this.deps.pending.clearSettled(this.matchId, table, before)));
            })
          )
          .subscribe({ error: (error) => console.warn(`[sync] ${table} ${this.matchId}: settle check failed`, error) }),
        state.error$.subscribe((error) => console.debug(`[sync] ${table} ${this.matchId}:`, error))
      );
    }
    void Promise.all([...this.states.values()].map((state) => state.awaitInitialReplication())).then(
      () => this.deps.onSynced(this.matchId),
      () => undefined
    );
  }

  reSync(): void {
    for (const state of this.states.values()) state.reSync();
  }

  async awaitInSync(): Promise<void> {
    await Promise.all([...this.states.values()].map((state) => state.awaitInSync()));
  }

  async cancel(): Promise<void> {
    this.subscriptions.forEach((subscription) => subscription.unsubscribe());
    this.subscriptions = [];
    const states = [...this.states.values()];
    this.states.clear();
    await Promise.all(states.map((state) => state.cancel()));
  }

  private reporter(table: MatchCollectionName): PushReporter {
    const { pending, onSuperseded } = this.deps;
    return {
      rejected: (doc, error, opts) => pending.reject(table, doc, error, opts),
      superseded: async (doc) => {
        await pending.supersede(table, doc);
        await onSuperseded(this.matchId);
      },
      temporaryFailure: (doc) => pending.recordAttempt(table, doc),
      neverUploaded: (docId) => pending.isNeverUploaded(table, docId),
    };
  }
}
```

- [ ] **Step 4: Implement `ReferenceSync`**

Create `lib/rxdb/sync/reference-sync.ts`:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { RxReplicationState } from "rxdb/plugins/replication";
import type { LocalDatabase } from "../collections";
import { replicateSupabase } from "./replication";
import type { ReferenceCollectionName, SupabaseCheckpoint, SyncUser } from "./types";

export interface ReferenceSyncDeps {
  db: LocalDatabase;
  client: SupabaseClient<any>;
  waitForLeadership: boolean;
  retryTime: number;
}

/** Short stable key of a filter, so a different filter starts from a fresh checkpoint. */
export function filterKey(values: readonly string[]): string {
  let hash = 5381;
  for (const char of [...values].sort().join(",")) hash = ((hash << 5) + hash + char.charCodeAt(0)) | 0;
  return (hash >>> 0).toString(36);
}

/** Pull-only replications of the reference tables (edited online through the API layer). */
export class ReferenceSync {
  private states: RxReplicationState<any, SupabaseCheckpoint>[] = [];

  constructor(private readonly deps: ReferenceSyncDeps) {}

  start(user: SyncUser): void {
    const plan: Array<{ table: ReferenceCollectionName; values: string[]; filter?: (query: any) => any }> = [
      { table: "championships", values: [] },
      { table: "seasons", values: [] },
      { table: "match_formats", values: [] },
      { table: "clubs", values: [] },
      { table: "teams", values: [] },
    ];
    if (user.clubIds.length > 0) {
      plan.push({ table: "club_members", values: user.clubIds, filter: (query) => query.in("club_id", user.clubIds) });
    }
    if (user.teamIds.length > 0) {
      plan.push({ table: "team_members", values: user.teamIds, filter: (query) => query.in("team_id", user.teamIds) });
    }
    this.states = plan.map(({ table, values, filter }) =>
      replicateSupabase({
        replicationIdentifier: `sync2_${table}_${user.id}_${filterKey(values)}`,
        collection: this.deps.db[table] as any,
        client: this.deps.client,
        tableName: table,
        live: true,
        retryTime: this.deps.retryTime,
        waitForLeadership: this.deps.waitForLeadership,
        pull: { queryBuilder: filter },
      })
    );
  }

  reSync(): void {
    for (const state of this.states) state.reSync();
  }

  async stop(): Promise<void> {
    const states = this.states;
    this.states = [];
    await Promise.all(states.map((state) => state.cancel()));
  }
}
```

- [ ] **Step 5: Run them and see them pass**

Run: `pnpm test tests/unit/sync/match-sync.test.ts`
Expected: 6 passed.

- [ ] **Step 6: Commit**

```bash
git add lib/rxdb/sync/match-sync.ts lib/rxdb/sync/reference-sync.ts tests/unit/sync/match-sync.test.ts
git commit -m "feat(sync): replicate each tracked match and pull reference tables

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 12: SyncManager rewrite, upgrade seeding and provider wiring

This task replaces the old manager and adapter, which removes root causes 2, 3, 4 and 6.

**Files:**
- Modify (rewrite): `lib/rxdb/sync/manager.ts`
- Create: `lib/rxdb/sync/upgrade.ts`
- Modify (rewrite): `lib/rxdb/sync/types.ts` (drop the old exports)
- Delete: `lib/rxdb/sync/index.ts`
- Modify: `lib/rxdb/database.ts` (construct the new manager)
- Modify: `components/providers/local-database-provider.tsx`
- Create: `tests/unit/helpers/test-device.ts`
- Test: `tests/unit/sync/manager.test.ts`

**Interfaces:**
- Consumes everything from Tasks 6–11.
- Produces in `manager.ts`:
  - `SYNC_TIMEOUT_MS`
  - `interface SyncManagerOptions { db; client; platform; pending; waitForLeadership?; retryTime? }`
  - `toSyncUser(user: User): SyncUser`, `sameSyncUser(a, b): boolean`
  - `class SyncManager` with:
    - `tracked`, `syncStates`, `pendingChanges`, `userId`
    - `isTracking(matchId)`, `setUser(user | null)`
    - `syncMatch(matchId, timeoutMs?): Promise<boolean>`
    - `retryRejected(matchId?)`, `awaitMatchInSync(matchId)`, `destroy()`
- Produces in `upgrade.ts`: `runSyncUpgrade(db, tracked, userId): Promise<number>`.
- Produces for tests:
  - `TestDevice` with `create`, `signIn`, `restart`, `goOffline`, `goOnline`, `openMatch`, `startSet`, `recordPoint`, `settle`, `dispose`, `manager`, `db`, `pending`, `platform`, `server`, `deviceId`
  - `testUser(id?)`, `expectServerEqualsDevice(device, matchId)`

- [ ] **Step 1: Write the test device helper**

Create `tests/unit/helpers/test-device.ts`:

```ts
import { expect } from "vitest";
import type { LocalDatabase } from "@/lib/rxdb/collections";
import { docsEqual } from "@/lib/rxdb/sync/conflict-handler";
import { pickSchemaFields } from "@/lib/rxdb/sync/helper";
import { SyncManager } from "@/lib/rxdb/sync/manager";
import type { PendingChanges } from "@/lib/rxdb/sync/pending-changes";
import { MATCH_COLLECTIONS, type SyncUser } from "@/lib/rxdb/sync/types";
import type { FakeSupabaseServer } from "../fakes/fake-supabase";
import { createFakePlatform } from "./fake-platform";
import { aPlayerStat, aScorePoint, aSet, HOME_TEAM_ID, USER_ID } from "./fixtures";
import { createTestDb } from "./test-db";
import { waitFor } from "./wait";

export const testUser = (id = USER_ID): SyncUser => ({ id, teamIds: [HOME_TEAM_ID], clubIds: [] });

/** One device: its own local database, platform and sync manager, talking to the shared fake server. */
export class TestDevice {
  online = true;
  manager: SyncManager;
  readonly platform: ReturnType<typeof createFakePlatform>;

  private constructor(
    readonly server: FakeSupabaseServer,
    readonly db: LocalDatabase,
    readonly pending: PendingChanges,
    readonly deviceId: string,
    private readonly userName: string
  ) {
    this.platform = createFakePlatform(deviceId);
    this.manager = this.createManager();
  }

  static async create(server: FakeSupabaseServer, options: { deviceId?: string; userName?: string } = {}): Promise<TestDevice> {
    const { db, pending } = await createTestDb();
    return new TestDevice(server, db, pending, options.deviceId ?? "device-a", options.userName ?? "Alex");
  }

  private createManager(): SyncManager {
    return new SyncManager({
      db: this.db,
      client: this.server.client({ online: () => this.online, userName: this.userName }),
      platform: this.platform.platform,
      pending: this.pending,
      waitForLeadership: false,
      retryTime: 50,
    });
  }

  signIn(user: SyncUser = testUser()): Promise<void> {
    return this.manager.setUser(user);
  }

  /** Closing the app and opening it again: the manager goes away, the local database stays. */
  async restart(): Promise<void> {
    await this.manager.destroy();
    this.manager = this.createManager();
  }

  goOffline(): void {
    this.online = false;
    this.platform.setOnline(false);
  }

  goOnline(): void {
    this.online = true;
    this.platform.setOnline(true);
  }

  openMatch(matchId: string): Promise<boolean> {
    return this.manager.syncMatch(matchId, 5000);
  }

  async startSet(matchId: string, overrides: Record<string, unknown> = {}) {
    const set = aSet(matchId, overrides);
    await this.db.sets.insert(set as any);
    return set;
  }

  /** What PlayerStatCommand + ScorePointCommand write for one point. */
  async recordPoint(matchId: string, setId: string, pointNumber: number) {
    const stat = aPlayerStat(matchId, setId);
    await this.db.player_stats.insert(stat as any);
    const point = aScorePoint(matchId, setId, pointNumber, { player_stat_id: stat.id });
    await this.db.score_points.insert(point as any);
    await this.db.sets.findOne(setId).update({ $set: { home_score: pointNumber } });
    return { stat, point };
  }

  /** Waits until nothing of the match is pending and its replications are in sync. */
  async settle(matchId: string, timeoutMs = 10_000): Promise<void> {
    await waitFor(async () => (await this.pending.count({ matchId, statuses: ["pending"] })) === 0, {
      timeoutMs,
      message: `match ${matchId} uploaded`,
    });
    await Promise.race([
      this.manager.awaitMatchInSync(matchId),
      new Promise((_, reject) => setTimeout(() => reject(new Error("replications not in sync")), timeoutMs)),
    ]);
  }

  async dispose(): Promise<void> {
    await this.manager.destroy();
    await this.db.remove();
  }
}

/** The server's rows of the match equal the device's, field by field (deleted rows excluded). */
export async function expectServerEqualsDevice(device: TestDevice, matchId: string): Promise<void> {
  for (const table of MATCH_COLLECTIONS) {
    const collection = device.db[table] as any;
    const selector = table === "matches" ? { id: matchId } : { match_id: matchId };
    const local = (await collection.find({ selector }).exec()).map((doc: any) => ({ ...doc.toJSON(), _deleted: false }));
    const properties = collection.schema.jsonSchema.properties as Record<string, unknown>;
    const remote = device.server
      .rows(table, (row) => (table === "matches" ? row.id === matchId : row.match_id === matchId) && !row._deleted)
      .map((row) => pickSchemaFields(row, properties));
    expect(remote.map((row) => row.id).sort(), `${table}: same rows`).toEqual(local.map((doc: any) => doc.id).sort());
    for (const doc of local) {
      const row = remote.find((candidate) => candidate.id === doc.id);
      expect(docsEqual(row, doc), `${table} ${doc.id}: same values`).toBe(true);
    }
  }
}
```

- [ ] **Step 2: Write the failing scenario tests**

Create `tests/unit/sync/manager.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { pickSchemaFields } from "@/lib/rxdb/sync/helper";
import { TrackedMatches } from "@/lib/rxdb/sync/tracked-matches";
import type { FakeSupabaseServer } from "../fakes/fake-supabase";
import { createFakeServer } from "../helpers/server";
import { PLAYER_ID, USER_ID, aScorePoint, aSet, seedServerMatch, seedTeams } from "../helpers/fixtures";
import { TestDevice, expectServerEqualsDevice, testUser } from "../helpers/test-device";
import { sleep, waitFor } from "../helpers/wait";

describe("SyncManager", () => {
  let server: FakeSupabaseServer;
  let matchId: string;
  const devices: TestDevice[] = [];

  beforeEach(() => {
    server = createFakeServer();
    seedTeams(server);
    matchId = seedServerMatch(server);
  });
  afterEach(async () => {
    await Promise.all(devices.splice(0).map((device) => device.dispose()));
  });

  async function device(options: { deviceId?: string; userName?: string } = {}) {
    const created = await TestDevice.create(server, options);
    devices.push(created);
    return created;
  }

  const serverPoints = () => server.rows("score_points", (row) => row.match_id === matchId && !row._deleted);

  it("keeps every score update of a set, online and offline (root cause 1)", async () => {
    const d = await device();
    await d.signIn();
    expect(await d.openMatch(matchId)).toBe(true);
    const set = await d.startSet(matchId);
    for (let n = 1; n <= 5; n++) await d.recordPoint(matchId, set.id, n);
    d.goOffline();
    for (let n = 6; n <= 10; n++) await d.recordPoint(matchId, set.id, n);
    d.goOnline();
    await d.settle(matchId);
    expect(server.row("sets", set.id)!.home_score).toBe(10);
    await expectServerEqualsDevice(d, matchId);
  });

  it("keeps uploading after the profile is refreshed for the same user (root cause 2)", async () => {
    const d = await device();
    await d.signIn();
    await d.openMatch(matchId);
    d.goOffline();
    const set = await d.startSet(matchId);
    await d.recordPoint(matchId, set.id, 1);
    await d.manager.setUser({ ...testUser() });
    d.goOnline();
    await d.settle(matchId);
    await expectServerEqualsDevice(d, matchId);
  });

  it("uploads data recorded before the app was closed, without reopening the match (root cause 3)", async () => {
    const d = await device();
    await d.signIn();
    await d.openMatch(matchId);
    d.goOffline();
    const set = await d.startSet(matchId);
    for (let n = 1; n <= 3; n++) await d.recordPoint(matchId, set.id, n);
    await d.restart();
    d.goOnline();
    await d.signIn(); // the home screen: syncMatch is never called
    await d.settle(matchId);
    await expectServerEqualsDevice(d, matchId);
  });

  it("survives repeated connection drops while scoring (root cause 4)", async () => {
    const d = await device();
    await d.signIn();
    await d.openMatch(matchId);
    const set = await d.startSet(matchId);
    for (let n = 1; n <= 6; n++) {
      if (n % 2 === 1) d.goOffline();
      else d.goOnline();
      await d.recordPoint(matchId, set.id, n);
      await sleep(30);
    }
    d.goOnline();
    await d.settle(matchId);
    await expectServerEqualsDevice(d, matchId);
  });

  it("uploads a match that another tab opened (root cause 6)", async () => {
    const d = await device();
    await d.signIn();
    const otherTab = new TrackedMatches(d.db); // another tab shares the device database
    await otherTab.track(matchId, USER_ID);
    await waitFor(() => d.manager.isTracking(matchId), { message: "the leader tracks the match" });
    const set = await d.startSet(matchId);
    await d.recordPoint(matchId, set.id, 1);
    await d.settle(matchId);
    await expectServerEqualsDevice(d, matchId);
  });

  it("uploads 150 points (3 sets) recorded offline", async () => {
    const d = await device();
    await d.signIn();
    await d.openMatch(matchId);
    d.goOffline();
    for (let setNumber = 1; setNumber <= 3; setNumber++) {
      const set = await d.startSet(matchId, { set_number: setNumber });
      for (let n = 1; n <= 50; n++) await d.recordPoint(matchId, set.id, n);
    }
    d.goOnline();
    await d.settle(matchId, 60_000);
    expect(serverPoints()).toHaveLength(150);
    await expectServerEqualsDevice(d, matchId);
  }, 90_000);

  it("finishes uploading after the app is closed in the middle of a push", async () => {
    const d = await device();
    await d.signIn();
    await d.openMatch(matchId);
    d.goOffline();
    const set = await d.startSet(matchId);
    for (let n = 1; n <= 30; n++) await d.recordPoint(matchId, set.id, n);
    server.latencyMs = 20;
    d.goOnline();
    await waitFor(() => serverPoints().length >= 3, { message: "upload under way" });
    await d.restart();
    server.latencyMs = 0;
    await d.signIn();
    await d.settle(matchId, 20_000);
    await expectServerEqualsDevice(d, matchId);
    expect(await d.pending.count({ matchId, statuses: ["rejected"] })).toBe(0);
  }, 40_000);

  it("keeps the data after sign-out and uploads it when the same user signs back in", async () => {
    const d = await device();
    await d.signIn();
    await d.openMatch(matchId);
    d.goOffline();
    const set = await d.startSet(matchId);
    await d.recordPoint(matchId, set.id, 1);
    await d.manager.setUser(null);
    d.goOnline();
    await sleep(300);
    expect(serverPoints()).toHaveLength(0);
    expect(await d.pending.count({ matchId })).toBeGreaterThan(0);
    await d.signIn();
    await d.settle(matchId);
    await expectServerEqualsDevice(d, matchId);
  });

  it("does not upload another account's data", async () => {
    const d = await device();
    await d.signIn();
    await d.openMatch(matchId);
    d.goOffline();
    const set = await d.startSet(matchId);
    await d.recordPoint(matchId, set.id, 1);
    await d.manager.setUser(null);
    d.goOnline();
    await d.signIn(testUser("user-2"));
    await sleep(300);
    expect(serverPoints()).toHaveLength(0);
    expect(await d.pending.count({ matchId, statuses: ["pending"] })).toBeGreaterThan(0);
  });

  it("continues after the access token expired during a long offline period", async () => {
    const d = await device();
    await d.signIn();
    await d.openMatch(matchId);
    d.goOffline();
    const set = await d.startSet(matchId);
    await d.recordPoint(matchId, set.id, 1);
    await d.recordPoint(matchId, set.id, 2);
    server.failNext("jwt-expired", "jwt-expired", "jwt-expired");
    d.goOnline();
    await d.settle(matchId);
    await expectServerEqualsDevice(d, matchId);
    expect(await d.pending.count({ matchId, statuses: ["rejected"] })).toBe(0);
  });

  it("names a player deleted on the server and uploads the rest", async () => {
    const d = await device();
    await d.signIn();
    await d.openMatch(matchId);
    d.goOffline();
    const set = await d.startSet(matchId);
    await d.recordPoint(matchId, set.id, 1);
    server.hardDelete("team_members", PLAYER_ID);
    d.goOnline();
    await waitFor(async () => (await d.pending.count({ matchId, statuses: ["rejected"] })) === 2, {
      message: "stat and point rejected",
    });
    const rejected = (await d.pending.collection.find({ selector: { status: "rejected" } }).exec()).map((doc) => doc.toJSON());
    expect(rejected.map((entry) => entry.error_code)).toEqual(["reference_missing", "reference_missing"]);
    expect(rejected[0].error_params).toEqual({ table: "team_members" });
    await waitFor(() => server.row("sets", set.id)?.home_score === 1, { message: "set uploaded" });
  });

  it("rejects the rows of a rejected set with a reason, and retry uploads all of them", async () => {
    const d = await device();
    await d.signIn();
    await d.openMatch(matchId);
    server.denyWrites("sets", () => true);
    const set = await d.startSet(matchId);
    await d.recordPoint(matchId, set.id, 1);
    await waitFor(async () => (await d.pending.count({ matchId, statuses: ["rejected"] })) === 3, {
      message: "set, stat and point rejected",
      timeoutMs: 15_000,
    });
    const codes = Object.fromEntries(
      (await d.pending.collection.find({ selector: { status: "rejected" } }).exec()).map((doc) => [doc.table_name, doc.error_code])
    );
    expect(codes).toEqual({ sets: "rls", player_stats: "parent_rejected", score_points: "parent_rejected" });
    server.allowWrites("sets");
    await d.manager.retryRejected(matchId);
    await d.settle(matchId, 20_000);
    await expectServerEqualsDevice(d, matchId);
  }, 40_000);

  it("ends undo and redo made offline with the right server state", async () => {
    const d = await device();
    await d.signIn();
    await d.openMatch(matchId);
    d.goOffline();
    const set = await d.startSet(matchId);
    const { point } = await d.recordPoint(matchId, set.id, 1);
    await d.db.score_points.findOne(point.id).remove(); // undo
    await d.db.score_points.insert({ ...point } as any); // redo
    d.goOnline();
    await d.settle(matchId);
    expect(server.row("score_points", point.id)!._deleted).toBe(false);
    await d.db.score_points.findOne(point.id).remove();
    await d.settle(matchId);
    expect(server.row("score_points", point.id)!._deleted).toBe(true);
  });

  it("never shows a point inserted and undone before its first upload as live on the server", async () => {
    const d = await device();
    await d.signIn();
    await d.openMatch(matchId);
    d.goOffline();
    const set = await d.startSet(matchId);
    const { point } = await d.recordPoint(matchId, set.id, 1);
    await d.db.score_points.findOne(point.id).remove();
    d.goOnline();
    await d.settle(matchId);
    const row = server.row("score_points", point.id);
    expect(row === undefined || row._deleted === true).toBe(true);
  });

  it("upgrade: rescues rows missing on the server without overwriting later corrections", async () => {
    const d = await device();
    // What an older app version left on this device: the match, a set and two points never uploaded.
    const { _deleted, ...matchDoc } = pickSchemaFields(
      server.row("matches", matchId)!,
      d.db.matches.schema.jsonSchema.properties as Record<string, unknown>
    ) as Record<string, unknown>;
    await d.db.matches.insert(matchDoc as any);
    const set = aSet(matchId, { home_score: 7, updated_at: "2026-01-01T00:00:00.000Z" });
    await d.db.sets.insert(set as any);
    const points = [aScorePoint(matchId, set.id, 1), aScorePoint(matchId, set.id, 2)];
    for (const point of points) await d.db.score_points.insert(point as any);
    await d.pending.collection.find().remove(); // the old version had no pending_changes
    server.seed("sets", { ...set });
    server.editAsWebsite("sets", set.id, { home_score: 10 });

    await d.signIn();

    await waitFor(() => points.every((point) => !!server.row("score_points", point.id)), { message: "points rescued" });
    await waitFor(async () => (await d.db.sets.findOne(set.id).exec())?.home_score === 10, {
      message: "device takes the correction",
    });
    expect(server.row("sets", set.id)!.home_score).toBe(10);
  });

  it("forgets matches unopened for 14 days once nothing is unsent", async () => {
    const d = await device();
    const tracked = new TrackedMatches(d.db);
    const longAgo = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString();
    const otherMatchId = seedServerMatch(server);
    await tracked.track(matchId, USER_ID, longAgo);
    await tracked.track(otherMatchId, USER_ID, longAgo);
    await d.db.sets.insert(aSet(otherMatchId) as any); // unsent: this match must stay tracked
    d.goOffline();
    await d.signIn();
    expect(await tracked.entry(matchId)).toBeNull();
    expect(await tracked.entry(otherMatchId)).not.toBeNull();
  });

  it("asks the platform to keep local data", async () => {
    const d = await device();
    await d.signIn();
    await waitFor(() => d.platform.wasPersistenceRequested(), { message: "persistent storage requested" });
  });
});
```

- [ ] **Step 3: Run them and see them fail**

Run: `pnpm test tests/unit/sync/manager.test.ts`
Expected: FAIL. The test helper constructs `SyncManager` with an options object, which the old manager doesn't accept; the TypeScript/runtime error points at `SyncManager`.

- [ ] **Step 4: Rewrite the shared types**

Replace the whole of `lib/rxdb/sync/types.ts` with:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { RxCollection, WithDeleted } from "rxdb";
import type { ClassifiedError } from "./errors";

/** Tables replicated per match; pushes and pending changes only concern these. */
export const MATCH_COLLECTIONS = ["matches", "sets", "player_stats", "score_points", "events"] as const;
export type MatchCollectionName = (typeof MATCH_COLLECTIONS)[number];

/** Tables that are only pulled (edited online through the API layer). */
export const REFERENCE_COLLECTIONS = [
  "championships",
  "seasons",
  "match_formats",
  "clubs",
  "teams",
  "club_members",
  "team_members",
] as const;
export type ReferenceCollectionName = (typeof REFERENCE_COLLECTIONS)[number];

/** Pull checkpoint: the server-only `_modified` column, then the id. */
export type SupabaseCheckpoint = { id: string; modified: string };

/** What the sync layer needs to know about the signed-in user. */
export interface SyncUser {
  id: string;
  teamIds: string[];
  clubIds: string[];
}

/** What the push handler does with one row before sending it. */
export type GateDecision =
  | { kind: "send" }
  | { kind: "wait"; reason: "claim" | "parents" }
  | { kind: "reject"; error: ClassifiedError }
  | { kind: "supersede" };

export interface PushGate {
  check(doc: WithDeleted<any>): Promise<GateDecision>;
}

export interface PushReporter {
  rejected(doc: WithDeleted<any>, error: ClassifiedError, opts: { neverUploaded: boolean }): Promise<void>;
  superseded(doc: WithDeleted<any>): Promise<void>;
  /** Called for failures that count towards MAX_TEMPORARY_ATTEMPTS; returns the attempts so far. */
  temporaryFailure(doc: WithDeleted<any>, error: ClassifiedError): Promise<number>;
  neverUploaded(docId: string): Promise<boolean>;
}

export interface SupabaseReplicationOptions {
  replicationIdentifier: string;
  collection: RxCollection<any>;
  client: SupabaseClient<any>;
  tableName: string;
  /** Sent as x-device-id on every request (match tables). */
  deviceId?: string;
  live?: boolean;
  retryTime?: number;
  waitForLeadership?: boolean;
  autoStart?: boolean;
  pull?: { batchSize?: number; queryBuilder?: (query: any) => any };
  push?: {
    batchSize?: number;
    modifier?: (doc: WithDeleted<any>) => WithDeleted<any> | null;
    gate?: PushGate;
    reporter?: PushReporter;
  };
}
```

- [ ] **Step 5: Implement the upgrade seeding**

Create `lib/rxdb/sync/upgrade.ts`:

```ts
import type { LocalDatabase } from "../collections";
import type { TrackedMatches } from "./tracked-matches";

const UPGRADE_DOC = "sync-upgrade";

/**
 * First start after the sync rework (spec section 9): every match stored on
 * this device becomes a tracked match, so rows an older version never
 * uploaded are offered to the server once. Returns how many were added.
 */
export async function runSyncUpgrade(db: LocalDatabase, tracked: TrackedMatches, userId: string): Promise<number> {
  if (await db.getLocal(UPGRADE_DOC)) return 0;
  const existing = await tracked.get();
  const matchIds = (await db.matches.find().exec()).map((doc) => doc.id).filter((id) => !existing[id]);
  for (const matchId of matchIds) await tracked.track(matchId, userId);
  await db.upsertLocal(UPGRADE_DOC, { version: 2, ranAt: new Date().toISOString() });
  return matchIds.length;
}
```

- [ ] **Step 6: Rewrite the manager**

Replace the whole of `lib/rxdb/sync/manager.ts` with:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import { distinctUntilChanged, filter, type Subscription } from "rxjs";
import type { User } from "@/lib/types";
import type { LocalDatabase } from "../collections";
import type { ClaimCheck } from "./dependencies";
import { MatchSync } from "./match-sync";
import type { PendingChanges } from "./pending-changes";
import type { SyncPlatform } from "./platform/types";
import { ReferenceSync } from "./reference-sync";
import type { ScorerInfo } from "./scorer-claim";
import { SyncStates } from "./sync-state";
import { TRACKED_MATCH_TTL_MS, TrackedMatches, type TrackedMatchMap } from "./tracked-matches";
import type { SyncUser } from "./types";
import { runSyncUpgrade } from "./upgrade";

/** How long the live page waits for a match's first pull. */
export const SYNC_TIMEOUT_MS = 30_000;
const DEFAULT_RETRY_MS = 5_000;

export interface SyncManagerOptions {
  db: LocalDatabase;
  client: SupabaseClient<any>;
  platform: SyncPlatform;
  pending: PendingChanges;
  /** Only the leader tab replicates (default true; tests use false). */
  waitForLeadership?: boolean;
  retryTime?: number;
}

export function toSyncUser(user: User): SyncUser {
  return {
    id: user.id,
    teamIds: (user.teamMembers ?? []).map((member) => member.team_id),
    clubIds: (user.clubMembers ?? []).map((member) => member.club_id),
  };
}

function sameIds(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sorted = [...b].sort();
  return [...a].sort().every((value, index) => value === sorted[index]);
}

export function sameSyncUser(a: SyncUser | null, b: SyncUser | null): boolean {
  if (!a || !b) return a === b;
  return a.id === b.id && sameIds(a.teamIds, b.teamIds) && sameIds(a.clubIds, b.clubIds);
}

/**
 * Decides what this device replicates (spec section 2): reference tables for
 * the signed-in user, and every tracked match from app start, on any screen.
 */
export class SyncManager {
  readonly tracked: TrackedMatches;
  readonly syncStates: SyncStates;
  readonly pendingChanges: PendingChanges;
  private user: SyncUser | null = null;
  private readonly reference: ReferenceSync;
  private readonly matches = new Map<string, MatchSync>();
  private trackedSubscription: Subscription | null = null;
  private readonly platformSubscriptions: Subscription[];
  private queue: Promise<unknown> = Promise.resolve();
  private readonly deviceId: Promise<string>;

  constructor(private readonly options: SyncManagerOptions) {
    this.tracked = new TrackedMatches(options.db);
    this.syncStates = new SyncStates(options.db);
    this.pendingChanges = options.pending;
    this.reference = new ReferenceSync({
      db: options.db,
      client: options.client,
      waitForLeadership: options.waitForLeadership ?? true,
      retryTime: options.retryTime ?? DEFAULT_RETRY_MS,
    });
    this.deviceId = options.platform.getDeviceId();
    // Never paused: RxDB's own retry waits for the connection. Coming back only re-syncs.
    this.platformSubscriptions = [
      options.platform.connectivity$
        .pipe(
          distinctUntilChanged(),
          filter((online) => online)
        )
        .subscribe(() => this.resume()),
      options.platform.foreground$.subscribe(() => this.resume()),
    ];
  }

  get userId(): string | null {
    return this.user?.id ?? null;
  }

  isTracking(matchId: string): boolean {
    return this.matches.has(matchId);
  }

  /** A refreshed profile for the same user (same memberships) changes nothing. */
  setUser(user: SyncUser | null): Promise<void> {
    return this.enqueue(async () => {
      if (sameSyncUser(user, this.user)) {
        this.user = user;
        return;
      }
      if (user && this.user && user.id === this.user.id) {
        this.user = user;
        await this.reference.stop();
        this.reference.start(user);
        return;
      }
      await this.stopAll();
      this.user = user;
      if (user) await this.startAll(user);
    });
  }

  /**
   * Tracks the match on this device and waits for its first pull. Resolves
   * true at once if the match was already synced here, false after `timeoutMs`.
   */
  async syncMatch(matchId: string, timeoutMs: number = SYNC_TIMEOUT_MS): Promise<boolean> {
    const user = this.user;
    if (!user) return false;
    const alreadySynced = (await this.syncStates.get(matchId))?.status === "synced";
    if (!alreadySynced) await this.syncStates.set(matchId, "syncing");
    await this.tracked.track(matchId, user.id);
    await this.enqueue(async () => this.reconcile(await this.tracked.get()));
    if (alreadySynced) {
      this.matches.get(matchId)?.reSync();
      return true;
    }
    return this.syncStates.waitForSynced(matchId, timeoutMs);
  }

  retryRejected(matchId?: string): Promise<number> {
    return this.pendingChanges.retryRejected(this.options.db, matchId);
  }

  async awaitMatchInSync(matchId: string): Promise<void> {
    await this.matches.get(matchId)?.awaitInSync();
  }

  async destroy(): Promise<void> {
    this.platformSubscriptions.forEach((subscription) => subscription.unsubscribe());
    await this.enqueue(() => this.stopAll());
  }

  private async startAll(user: SyncUser): Promise<void> {
    this.reference.start(user);
    await runSyncUpgrade(this.options.db, this.tracked, user.id);
    await this.pruneTracked(user.id);
    this.trackedSubscription = this.tracked.get$().subscribe((matches) => {
      void this.enqueue(() => this.reconcile(matches));
    });
    void this.options.platform.requestPersistentStorage();
  }

  private async stopAll(): Promise<void> {
    this.trackedSubscription?.unsubscribe();
    this.trackedSubscription = null;
    const syncs = [...this.matches.values()];
    this.matches.clear();
    await Promise.all(syncs.map((sync) => sync.cancel()));
    await this.reference.stop();
  }

  /** Starts replications for the user's tracked matches and stops the others. */
  private async reconcile(matches: TrackedMatchMap): Promise<void> {
    const user = this.user;
    if (!user) return;
    const wanted = new Set(
      Object.entries(matches)
        .filter(([, entry]) => entry.userId === user.id && entry.claim !== "lost")
        .map(([matchId]) => matchId)
    );
    for (const [matchId, sync] of [...this.matches]) {
      if (wanted.has(matchId)) continue;
      this.matches.delete(matchId);
      await sync.cancel();
    }
    const deviceId = await this.deviceId;
    for (const matchId of wanted) {
      if (this.matches.has(matchId)) continue;
      const sync = new MatchSync(matchId, {
        db: this.options.db,
        client: this.options.client,
        pending: this.pendingChanges,
        deviceId,
        claim: this.claimCheck,
        onSuperseded: (id) => this.onSuperseded(id),
        onSynced: (id) => this.syncStates.set(id, "synced"),
        waitForLeadership: this.options.waitForLeadership ?? true,
        retryTime: this.options.retryTime ?? DEFAULT_RETRY_MS,
      });
      this.matches.set(matchId, sync);
      sync.start();
    }
  }

  /** Drops matches unopened for TRACKED_MATCH_TTL_MS once nothing of theirs is unsent. */
  private async pruneTracked(userId: string): Promise<void> {
    const cutoff = Date.now() - TRACKED_MATCH_TTL_MS;
    for (const [matchId, entry] of Object.entries(await this.tracked.get())) {
      if (entry.userId !== userId || Date.parse(entry.lastOpenedAt) >= cutoff) continue;
      if ((await this.pendingChanges.count({ matchId, statuses: ["pending", "rejected"] })) === 0) {
        await this.tracked.remove(matchId);
      }
    }
  }

  private resume(): void {
    this.reference.reSync();
    for (const sync of this.matches.values()) sync.reSync();
  }

  private readonly claimCheck: ClaimCheck = async (matchId) =>
    (await this.tracked.entry(matchId))?.claim === "lost" ? "lost" : "ok";

  private async onSuperseded(matchId: string): Promise<void> {
    await this.markLost(matchId, null);
  }

  private async markLost(matchId: string, holder: ScorerInfo | null): Promise<void> {
    if ((await this.tracked.entry(matchId))?.claim === "lost") return;
    await this.pendingChanges.supersedeMatch(matchId);
    await this.tracked.setClaim(matchId, "lost", holder);
  }

  /** Serializes lifecycle changes within this tab. */
  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const run = this.queue.then(task, task);
    this.queue = run.catch(() => undefined);
    return run;
  }
}
```

- [ ] **Step 7: Remove the old adapter and wire the new manager**

Run: `git rm lib/rxdb/sync/index.ts`

In `lib/rxdb/database.ts`:
- Add `import { createWebPlatform } from "./sync/platform/web";`.
- Replace these three lines:

```ts
      const syncManager = new SyncManager(db, supabase);
      await syncManager.initialize();
      Object.assign(db, { syncManager, pendingChanges });
```

with:

```ts
      const syncManager = new SyncManager({ db, client: supabase, platform: createWebPlatform(), pending: pendingChanges });
      Object.assign(db, { syncManager, pendingChanges });
```

In `components/providers/local-database-provider.tsx`:
- Delete the commented-out `SyncHandler` block (the `// useEffect(() => {` … `// }, [database.localDb, user]);` lines).
- Replace the two effects that call `syncManager.setUser(user)` / `cleanup()` and `syncManager.setOnlineStatus(isOnline)` with:

```tsx
  useEffect(() => {
    const manager = database.localDb?.syncManager;
    if (!manager) return;
    // A refreshed profile for the same user is a no-op; signing out keeps local data.
    void manager.setUser(user ? toSyncUser(user) : null);
  }, [database.localDb, user]);
```

- Delete `import { useOnlineStatus } from "@/hooks/use-online-status";` and the `const { isOnline } = useOnlineStatus();` line.
- Add `import { toSyncUser } from "@/lib/rxdb/sync/manager";`.

Run: `git grep -n "setOnlineStatus\|syncManager.cleanup\|syncManager.initialize\|rxdb/sync/index\|DynamicCollectionName\|SyncStateDocument" -- app components lib hooks contexts`
Expected: no output. If something matches, update it to the new API (`syncMatch`, `setUser`).

- [ ] **Step 8: Run all unit tests, lint and build**

Run: `pnpm test` → Expected: all pass (manager: 18 tests).
Run: `pnpm lint` → Expected: no new errors.
Run: `pnpm build` → Expected: succeeds.

- [ ] **Step 9: Commit**

```bash
git add -A lib/rxdb components/providers/local-database-provider.tsx tests/unit
git commit -m "feat(sync): replicate tracked matches from app start and keep them through profile refreshes

Replaces the per-session SyncManager: uploads no longer depend on the live
page being open, a refreshed profile no longer cancels match replications,
and tabs share one list of matches to replicate.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 13: Scoring-device claim in the manager

**Files:**
- Modify: `lib/rxdb/sync/manager.ts`
- Test: `tests/unit/sync/scorer-claim-flow.test.ts`

**Interfaces:**
- Consumes: `claimMatchScorer`, `getMatchScorer`, `ClaimResult` (Task 8).
- Produces on `SyncManager`:
  - `claimMatch(matchId: string, force?: boolean): Promise<ClaimResult>`. Throws `ScorerRpcError` when the server can't be reached.
  - `claimMatchOffline(matchId: string): Promise<void>`
  - `checkClaims(): Promise<void>`
- Changes: the claim check now handles a `pending-force` claim, `resume()` also checks claims, and a superseded push records the new holder.

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/sync/scorer-claim-flow.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { FakeSupabaseServer } from "../fakes/fake-supabase";
import { createFakeServer } from "../helpers/server";
import { seedServerMatch, seedTeams } from "../helpers/fixtures";
import { TestDevice, expectServerEqualsDevice } from "../helpers/test-device";
import { waitFor } from "../helpers/wait";

describe("scoring device claim", () => {
  let server: FakeSupabaseServer;
  let matchId: string;
  const devices: TestDevice[] = [];

  beforeEach(() => {
    server = createFakeServer();
    seedTeams(server);
    matchId = seedServerMatch(server);
  });
  afterEach(async () => {
    await Promise.all(devices.splice(0).map((device) => device.dispose()));
  });

  async function device(options: { deviceId?: string; userName?: string } = {}) {
    const created = await TestDevice.create(server, options);
    devices.push(created);
    await created.signIn();
    return created;
  }

  it("claims a free match silently", async () => {
    const a = await device();
    await a.openMatch(matchId);
    expect((await a.manager.claimMatch(matchId)).claimed).toBe(true);
    expect((await a.manager.tracked.entry(matchId))?.claim).toBe("held");
    expect(server.row("matches", matchId)!.scorer_device_id).toBe("device-a");
  });

  it("reports the device holding the match and takes over when forced", async () => {
    server.setScorer(matchId, { deviceId: "device-b", name: "Sam", label: "iPad" });
    const a = await device();
    await a.openMatch(matchId);
    expect(await a.manager.claimMatch(matchId)).toMatchObject({
      claimed: false,
      holder: { deviceId: "device-b", name: "Sam", deviceLabel: "iPad" },
    });
    expect((await a.manager.claimMatch(matchId, true)).claimed).toBe(true);
  });

  it("confirms an offline claim before any row of the match uploads", async () => {
    server.setScorer(matchId, { deviceId: "device-b" });
    const a = await device();
    await a.openMatch(matchId);
    a.goOffline();
    await a.manager.claimMatchOffline(matchId);
    const set = await a.startSet(matchId);
    await a.recordPoint(matchId, set.id, 1);
    a.goOnline();
    await a.settle(matchId);
    expect(server.row("matches", matchId)!.scorer_device_id).toBe("device-a");
    const claimIndex = server.log.findIndex((entry) => entry.table === "rpc:claim_match_scorer" && entry.status === 200);
    const firstSetWrite = server.log.findIndex((entry) => entry.table === "sets" && entry.op !== "select" && entry.status < 300);
    expect(claimIndex).toBeGreaterThanOrEqual(0);
    expect(claimIndex).toBeLessThan(firstSetWrite);
    await expectServerEqualsDevice(a, matchId);
  });

  it("keeps the previous device's unsent changes on that device after a takeover", async () => {
    const a = await device({ deviceId: "device-a", userName: "Alex" });
    await a.openMatch(matchId);
    await a.manager.claimMatch(matchId);
    a.goOffline();
    const setA = await a.startSet(matchId);
    await a.recordPoint(matchId, setA.id, 1);

    const b = await device({ deviceId: "device-b", userName: "Sam" });
    await b.openMatch(matchId);
    expect((await b.manager.claimMatch(matchId, true)).claimed).toBe(true);
    const setB = await b.startSet(matchId);
    await b.recordPoint(matchId, setB.id, 1);
    await b.settle(matchId);

    a.goOnline();
    await waitFor(async () => (await a.manager.tracked.entry(matchId))?.claim === "lost", { message: "A sees the takeover" });
    await waitFor(async () => (await a.pending.count({ matchId, statuses: ["pending"] })) === 0, { message: "nothing pending on A" });
    expect(await a.pending.count({ matchId, statuses: ["rejected"] })).toBe(0);
    expect(await a.pending.count({ matchId, statuses: ["superseded"] })).toBeGreaterThan(0);
    expect((await a.manager.tracked.entry(matchId))?.lostTo).toMatchObject({ deviceId: "device-b", name: "Sam" });
    expect(server.row("sets", setA.id)).toBeUndefined();
    await expectServerEqualsDevice(b, matchId);
  });

  it("notices a takeover when the app comes back to the foreground", async () => {
    const a = await device();
    await a.openMatch(matchId);
    await a.manager.claimMatch(matchId);
    server.setScorer(matchId, { deviceId: "device-b", name: "Sam" });
    a.platform.foreground();
    await waitFor(async () => (await a.manager.tracked.entry(matchId))?.claim === "lost", { message: "takeover noticed" });
    await waitFor(() => !a.manager.isTracking(matchId), { message: "replication stopped" });
  });
});
```

- [ ] **Step 2: Run them and see them fail**

Run: `pnpm test tests/unit/sync/scorer-claim-flow.test.ts`
Expected: FAIL, `a.manager.claimMatch is not a function`.

- [ ] **Step 3: Add the claim API to the manager**

In `lib/rxdb/sync/manager.ts`, replace `import type { ScorerInfo } from "./scorer-claim";` with:

```ts
import { claimMatchScorer, getMatchScorer, type ClaimResult, type ScorerInfo } from "./scorer-claim";
```

Add these public methods after `retryRejected`:

```ts
  /** Claims the match for this device (spec section 7). Throws ScorerRpcError when the server can't be reached. */
  async claimMatch(matchId: string, force = false): Promise<ClaimResult> {
    if (this.user) await this.tracked.track(matchId, this.user.id);
    const result = await claimMatchScorer(this.options.client, {
      matchId,
      deviceId: await this.deviceId,
      label: this.options.platform.getDeviceLabel(),
      force,
    });
    if (result.claimed) await this.tracked.setClaim(matchId, "held");
    return result;
  }

  /** Scoring offline without being able to check: the claim is forced before the match's first upload. */
  async claimMatchOffline(matchId: string): Promise<void> {
    if (this.user) await this.tracked.track(matchId, this.user.id);
    await this.tracked.setClaim(matchId, "pending-force");
  }

  /** Has another device taken over a match this device holds? */
  async checkClaims(): Promise<void> {
    const user = this.user;
    if (!user) return;
    const deviceId = await this.deviceId;
    for (const [matchId, entry] of Object.entries(await this.tracked.get())) {
      if (entry.userId !== user.id || entry.claim !== "held") continue;
      try {
        const holder = await getMatchScorer(this.options.client, matchId, deviceId);
        if (holder.deviceId && holder.deviceId !== deviceId) await this.markLost(matchId, holder);
      } catch {
        // Offline: checked again on the next resume.
      }
    }
  }
```

Replace `resume`, `claimCheck` and `onSuperseded` with:

```ts
  private resume(): void {
    this.reference.reSync();
    for (const sync of this.matches.values()) sync.reSync();
    void this.checkClaims();
  }

  private readonly claiming = new Map<string, Promise<"ok" | "unavailable">>();

  private readonly claimCheck: ClaimCheck = async (matchId) => {
    const entry = await this.tracked.entry(matchId);
    if (!entry || entry.claim === null || entry.claim === "held") return "ok";
    if (entry.claim === "lost") return "lost";
    // pending-force: one RPC at a time per match, shared by the five replications.
    let inFlight = this.claiming.get(matchId);
    if (!inFlight) {
      inFlight = this.claimMatch(matchId, true)
        .then(
          (result): "ok" | "unavailable" => (result.claimed ? "ok" : "unavailable"),
          (): "unavailable" => "unavailable"
        )
        .finally(() => this.claiming.delete(matchId));
      this.claiming.set(matchId, inFlight);
    }
    return inFlight;
  };

  private async onSuperseded(matchId: string): Promise<void> {
    let holder: ScorerInfo | null = null;
    try {
      holder = await getMatchScorer(this.options.client, matchId, await this.deviceId);
    } catch {
      // Offline: the banner shows "another scorer" without a name.
    }
    await this.markLost(matchId, holder);
  }
```

- [ ] **Step 4: Run all unit tests**

Run: `pnpm test`
Expected: all pass (claim flow: 5 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/rxdb/sync/manager.ts tests/unit/sync/scorer-claim-flow.test.ts
git commit -m "feat(sync): claim the scoring device per match and stop a device that lost it

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 14: Sync status, strings and the sync badge

**Files:**
- Create: `lib/rxdb/sync/status.ts`, `lib/rxdb/pending-hint.ts`
- Test: `tests/unit/sync/status.test.ts`, `tests/unit/sync/pending-hint.test.ts`
- Create: `messages/en/sync.json`, `messages/fr/sync.json`, `messages/es/sync.json`, `messages/it/sync.json`, `messages/pt/sync.json`
- Modify: `messages/{en,fr,es,it,pt}/index.ts`
- Create: `hooks/use-sync-status.ts`
- Create: `components/sync/format.ts`, `components/sync/sync-reason.tsx`, `components/sync/use-match-labels.ts`, `components/sync/sync-badge.tsx`

**Interfaces:**
- Consumes: `PendingChange` (Task 6), `TrackedMatchMap` (Task 8), `ScorerInfo` (Task 8), `SyncManager.pendingChanges` and `SyncManager.tracked` (Task 12).
- Produces in `status.ts`:
  - `type SyncBadgeState = "saved" | "uploading" | "waiting" | "problem" | "other-account"`
  - `SyncReasonInfo { code; params }`
  - `MatchSyncSummary { matchId; pending; rejected; superseded; otherAccount; reasons; lostTo }`
  - `SyncStatus { state; pendingCount; rejectedCount; supersededCount; otherAccountCount; matches }`
  - `deriveSyncStatus(input: { entries; tracked; userId; online }): SyncStatus`
- Produces in `pending-hint.ts`: `writeUnsentHint(count, storage?)`, `readUnsentHint(storage?): number`.
- Produces in the UI layer:
  - `useSyncStatus(): SyncStatus | null`
  - `formatTime(iso): string | null`
  - `<SyncReason reason />`, `useMatchLabels(matchIds): Map<string, string>`
  - `<SyncBadge compact? />`, rendering `data-testid="sync-badge"` with `data-state={state}`, and `data-testid="sync-details"` for the popover

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/sync/status.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { PendingChange } from "@/lib/rxdb/sync/pending-changes";
import { deriveSyncStatus } from "@/lib/rxdb/sync/status";
import type { TrackedMatchMap } from "@/lib/rxdb/sync/tracked-matches";

let counter = 0;
const entry = (overrides: Partial<PendingChange> = {}): PendingChange => ({
  id: `sets:${++counter}`,
  table_name: "sets",
  doc_id: `doc-${counter}`,
  match_id: "m1",
  status: "pending",
  attempts: 0,
  error_code: null,
  error_params: null,
  never_uploaded: false,
  is_insert: true,
  doc_updated_at: "2026-10-07T10:00:00.000Z",
  created_at: "2026-10-07T10:00:00.000Z",
  updated_at: "2026-10-07T10:00:00.000Z",
  ...overrides,
});

const tracked: TrackedMatchMap = {
  m1: { userId: "u1", claim: "held", lastOpenedAt: "2026-10-07T10:00:00.000Z", lostTo: null },
  m2: { userId: "u2", claim: null, lastOpenedAt: "2026-10-07T10:00:00.000Z", lostTo: null },
};

describe("deriveSyncStatus", () => {
  it("is saved when nothing is unsent", () => {
    expect(deriveSyncStatus({ entries: [], tracked, userId: "u1", online: true })).toMatchObject({
      state: "saved",
      pendingCount: 0,
      matches: [],
    });
  });

  it("is uploading online and waiting offline while changes are pending", () => {
    const entries = [entry(), entry()];
    expect(deriveSyncStatus({ entries, tracked, userId: "u1", online: true })).toMatchObject({ state: "uploading", pendingCount: 2 });
    expect(deriveSyncStatus({ entries, tracked, userId: "u1", online: false })).toMatchObject({ state: "waiting", pendingCount: 2 });
  });

  it("is a problem when a change was rejected, and lists each reason once", () => {
    const rejected = { status: "rejected" as const, error_code: "rls" };
    const status = deriveSyncStatus({
      entries: [entry(rejected), entry(rejected), entry()],
      tracked,
      userId: "u1",
      online: true,
    });
    expect(status).toMatchObject({ state: "problem", rejectedCount: 2, pendingCount: 1 });
    expect(status.matches[0].reasons).toEqual([{ code: "rls", params: {} }]);
  });

  it("never turns superseded changes into a problem", () => {
    const status = deriveSyncStatus({
      entries: [entry({ status: "superseded", error_code: "scorer_mismatch" })],
      tracked,
      userId: "u1",
      online: true,
    });
    expect(status).toMatchObject({ state: "saved", supersededCount: 1 });
    expect(status.matches[0].superseded).toBe(1);
  });

  it("flags changes recorded by another account", () => {
    const status = deriveSyncStatus({ entries: [entry({ match_id: "m2" })], tracked, userId: "u1", online: true });
    expect(status).toMatchObject({ state: "other-account", otherAccountCount: 1, pendingCount: 0 });
    expect(status.matches[0].otherAccount).toBe(true);
  });

  it("counts a signed-out device's changes as its own", () => {
    expect(deriveSyncStatus({ entries: [entry({ match_id: "m2" })], tracked, userId: null, online: true })).toMatchObject({
      state: "uploading",
      pendingCount: 1,
    });
  });
});
```

Create `tests/unit/sync/pending-hint.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { readUnsentHint, writeUnsentHint } from "@/lib/rxdb/pending-hint";

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
  };
}

describe("unsent changes hint", () => {
  it("round-trips the count", () => {
    const storage = memoryStorage();
    writeUnsentHint(4, storage);
    expect(readUnsentHint(storage)).toBe(4);
  });

  it("reads 0 when nothing was written or storage is unavailable", () => {
    expect(readUnsentHint(memoryStorage())).toBe(0);
    expect(readUnsentHint(null)).toBe(0);
  });
});
```

- [ ] **Step 2: Run them and see them fail**

Run: `pnpm test tests/unit/sync/status.test.ts tests/unit/sync/pending-hint.test.ts`
Expected: FAIL, modules not found.

- [ ] **Step 3: Implement the status derivation and the hint**

Create `lib/rxdb/sync/status.ts`:

```ts
import type { PendingChange } from "./pending-changes";
import type { ScorerInfo } from "./scorer-claim";
import type { TrackedMatchMap } from "./tracked-matches";

export type SyncBadgeState = "saved" | "uploading" | "waiting" | "problem" | "other-account";

export interface SyncReasonInfo {
  code: string;
  params: Record<string, string>;
}

export interface MatchSyncSummary {
  matchId: string;
  pending: number;
  rejected: number;
  superseded: number;
  otherAccount: boolean;
  reasons: SyncReasonInfo[];
  lostTo: ScorerInfo | null;
}

export interface SyncStatus {
  state: SyncBadgeState;
  pendingCount: number;
  rejectedCount: number;
  supersededCount: number;
  otherAccountCount: number;
  matches: MatchSyncSummary[];
}

export interface SyncStatusInput {
  entries: PendingChange[];
  tracked: TrackedMatchMap;
  /** null when signed out: everything on the device counts as the device's own. */
  userId: string | null;
  online: boolean;
}

/** The badge state (spec section 8). Superseded changes are information, never a problem. */
export function deriveSyncStatus({ entries, tracked, userId, online }: SyncStatusInput): SyncStatus {
  const summaries = new Map<string, MatchSyncSummary>();
  const counts = { pending: 0, rejected: 0, superseded: 0, otherAccount: 0 };

  for (const entry of entries) {
    let summary = summaries.get(entry.match_id);
    if (!summary) {
      summary = {
        matchId: entry.match_id,
        pending: 0,
        rejected: 0,
        superseded: 0,
        otherAccount: false,
        reasons: [],
        lostTo: tracked[entry.match_id]?.lostTo ?? null,
      };
      summaries.set(entry.match_id, summary);
    }
    if (entry.status === "superseded") {
      counts.superseded += 1;
      summary.superseded += 1;
      continue;
    }
    const owner = tracked[entry.match_id]?.userId;
    if (userId !== null && owner !== undefined && owner !== userId) {
      counts.otherAccount += 1;
      summary.otherAccount = true;
      continue;
    }
    if (entry.status === "pending") {
      counts.pending += 1;
      summary.pending += 1;
      continue;
    }
    counts.rejected += 1;
    summary.rejected += 1;
    const reason = { code: entry.error_code ?? "unknown", params: entry.error_params ?? {} };
    const known = summary.reasons.some(
      (existing) => existing.code === reason.code && JSON.stringify(existing.params) === JSON.stringify(reason.params)
    );
    if (!known) summary.reasons.push(reason);
  }

  const state: SyncBadgeState =
    counts.rejected > 0
      ? "problem"
      : counts.otherAccount > 0
        ? "other-account"
        : counts.pending > 0
          ? online
            ? "uploading"
            : "waiting"
          : "saved";

  return {
    state,
    pendingCount: counts.pending,
    rejectedCount: counts.rejected,
    supersededCount: counts.superseded,
    otherAccountCount: counts.otherAccount,
    matches: [...summaries.values()],
  };
}
```

Create `lib/rxdb/pending-hint.ts`:

```ts
// The number of unsent changes, mirrored in localStorage so the database reset
// guard (lib/rxdb/database.ts) can read it even when the database can't open.
const HINT_KEY = "volleystats:unsent-changes";

type HintStorage = { getItem(key: string): string | null; setItem(key: string, value: string): void };

function browserStorage(): HintStorage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

export function writeUnsentHint(count: number, storage: HintStorage | null = browserStorage()): void {
  try {
    storage?.setItem(HINT_KEY, String(count));
  } catch {
    // Storage full or unavailable: the reset guard then falls back to 0.
  }
}

export function readUnsentHint(storage: HintStorage | null = browserStorage()): number {
  try {
    const value = Number(storage?.getItem(HINT_KEY) ?? 0);
    return Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
}
```

- [ ] **Step 4: Run them and see them pass**

Run: `pnpm test tests/unit/sync/status.test.ts tests/unit/sync/pending-hint.test.ts`
Expected: all pass.

- [ ] **Step 5: Add the strings**

Create `messages/en/sync.json`:

```json
{
  "badge": {
    "saved": "All saved",
    "uploading": "Saving {count, plural, one {# change} other {# changes}}…",
    "waiting": "{count, plural, one {# change} other {# changes}} saved on this device, will upload when online",
    "problem": "{count, plural, one {# change} other {# changes}} couldn't be saved",
    "otherAccount": "Changes from another account are waiting on this device",
    "retry": "Retry",
    "matchLine": "{pending} waiting · {rejected} not saved",
    "superseded": "Not uploaded: {name} took over scoring at {time}",
    "unknownScorer": "another scorer",
    "allSavedToast": "All your match data is saved to the server",
    "noIssues": "Everything recorded on this device is on the server."
  },
  "flag": {
    "pending": "Not uploaded yet",
    "problem": "Some changes couldn't be saved"
  },
  "errors": {
    "rls": "The server refused this change (no permission).",
    "invalid_data": "The server rejected invalid data.",
    "schema_mismatch": "The app needs an update to save this change.",
    "duplicate": "A conflicting record already exists on the server.",
    "reference_missing": "Something it refers to ({table}) was deleted on the server.",
    "deleted_on_server": "This record was deleted on the server.",
    "parent_rejected": "It depends on a {table} that couldn't be saved.",
    "too_many_attempts": "It couldn't be saved after repeated attempts.",
    "scorer_mismatch": "Another device took over scoring.",
    "unknown": "Unknown server error."
  },
  "tables": {
    "matches": "match",
    "sets": "set",
    "player_stats": "stat",
    "score_points": "point",
    "events": "event",
    "team_members": "player",
    "teams": "team",
    "match_formats": "match format",
    "championships": "championship",
    "seasons": "season",
    "unknown": "record"
  },
  "claim": {
    "takenTitle": "Someone else is scoring this match",
    "takenBody": "{name} is scoring this match on {device} (last data received at {time}).",
    "takenWarning": "If you take over, changes that device hasn't uploaded yet won't be saved.",
    "takeOver": "Take over scoring",
    "cancel": "Cancel",
    "offlineTitle": "Can't check who's scoring",
    "offlineBody": "You're offline, so the app can't check whether someone else is scoring this match. Score on this device?",
    "offlineConfirm": "Score on this device",
    "takenOverBanner": "Scoring was taken over by {name} on {device} at {time}.",
    "never": "never"
  },
  "guards": {
    "signOutTitle": "Changes not uploaded yet",
    "signOutBody": "{count, plural, one {# change} other {# changes}} from this device haven't been uploaded. They stay on this device and upload when you sign back in.",
    "signOutConfirm": "Sign out anyway",
    "clearBlocked": "Some of this data hasn't been uploaded yet. Wait until the sync badge shows “All saved”.",
    "resetBlocked": "The local database still has changes that haven't been uploaded, so it wasn't reset. Go back online and wait until everything is saved."
  }
}
```

Create `messages/fr/sync.json`:

```json
{
  "badge": {
    "saved": "Tout est enregistré",
    "uploading": "Envoi de {count, plural, one {# modification} other {# modifications}}…",
    "waiting": "{count, plural, one {# modification enregistrée} other {# modifications enregistrées}} sur cet appareil, envoi dès le retour en ligne",
    "problem": "{count, plural, one {# modification n'a pas pu être enregistrée} other {# modifications n'ont pas pu être enregistrées}}",
    "otherAccount": "Des modifications d'un autre compte attendent sur cet appareil",
    "retry": "Réessayer",
    "matchLine": "{pending} en attente · {rejected} non enregistrées",
    "superseded": "Non envoyé : {name} a repris la saisie à {time}",
    "unknownScorer": "un autre marqueur",
    "allSavedToast": "Toutes vos données de match sont enregistrées sur le serveur",
    "noIssues": "Tout ce qui a été saisi sur cet appareil est sur le serveur."
  },
  "flag": {
    "pending": "Pas encore envoyé",
    "problem": "Certaines modifications n'ont pas pu être enregistrées"
  },
  "errors": {
    "rls": "Le serveur a refusé cette modification (droits insuffisants).",
    "invalid_data": "Le serveur a refusé des données invalides.",
    "schema_mismatch": "L'application doit être mise à jour pour enregistrer cette modification.",
    "duplicate": "Un enregistrement en conflit existe déjà sur le serveur.",
    "reference_missing": "Un élément référencé ({table}) a été supprimé sur le serveur.",
    "deleted_on_server": "Cet élément a été supprimé sur le serveur.",
    "parent_rejected": "Dépend d'un élément ({table}) qui n'a pas pu être enregistré.",
    "too_many_attempts": "Impossible d'enregistrer après plusieurs tentatives.",
    "scorer_mismatch": "Un autre appareil a repris la saisie.",
    "unknown": "Erreur inconnue du serveur."
  },
  "tables": {
    "matches": "match",
    "sets": "set",
    "player_stats": "statistique",
    "score_points": "point",
    "events": "événement",
    "team_members": "joueur",
    "teams": "équipe",
    "match_formats": "format de match",
    "championships": "championnat",
    "seasons": "saison",
    "unknown": "élément"
  },
  "claim": {
    "takenTitle": "Quelqu'un d'autre saisit ce match",
    "takenBody": "{name} saisit ce match sur {device} (dernières données reçues à {time}).",
    "takenWarning": "Si vous reprenez la saisie, les modifications que cet appareil n'a pas encore envoyées ne seront pas enregistrées.",
    "takeOver": "Reprendre la saisie",
    "cancel": "Annuler",
    "offlineTitle": "Impossible de vérifier qui saisit",
    "offlineBody": "Vous êtes hors ligne : l'application ne peut pas vérifier si quelqu'un d'autre saisit ce match. Saisir sur cet appareil ?",
    "offlineConfirm": "Saisir sur cet appareil",
    "takenOverBanner": "La saisie a été reprise par {name} sur {device} à {time}.",
    "never": "jamais"
  },
  "guards": {
    "signOutTitle": "Modifications pas encore envoyées",
    "signOutBody": "{count, plural, one {# modification de cet appareil n'a pas été envoyée} other {# modifications de cet appareil n'ont pas été envoyées}}. Elles restent sur cet appareil et seront envoyées quand vous vous reconnecterez.",
    "signOutConfirm": "Se déconnecter quand même",
    "clearBlocked": "Une partie de ces données n'a pas encore été envoyée. Attendez que l'indicateur de synchronisation affiche « Tout est enregistré ».",
    "resetBlocked": "La base locale contient encore des modifications non envoyées : elle n'a pas été réinitialisée. Reconnectez-vous et attendez que tout soit enregistré."
  }
}
```

Create `messages/es/sync.json`:

```json
{
  "badge": {
    "saved": "Todo guardado",
    "uploading": "Guardando {count, plural, one {# cambio} other {# cambios}}…",
    "waiting": "{count, plural, one {# cambio guardado} other {# cambios guardados}} en este dispositivo, se enviarán al volver la conexión",
    "problem": "{count, plural, one {# cambio no se pudo guardar} other {# cambios no se pudieron guardar}}",
    "otherAccount": "Hay cambios de otra cuenta esperando en este dispositivo",
    "retry": "Reintentar",
    "matchLine": "{pending} pendientes · {rejected} sin guardar",
    "superseded": "No enviado: {name} tomó el control del registro a las {time}",
    "unknownScorer": "otro anotador",
    "allSavedToast": "Todos los datos del partido están guardados en el servidor",
    "noIssues": "Todo lo registrado en este dispositivo está en el servidor."
  },
  "flag": {
    "pending": "Aún no enviado",
    "problem": "Algunos cambios no se pudieron guardar"
  },
  "errors": {
    "rls": "El servidor rechazó este cambio (sin permiso).",
    "invalid_data": "El servidor rechazó datos no válidos.",
    "schema_mismatch": "La aplicación necesita actualizarse para guardar este cambio.",
    "duplicate": "Ya existe un registro en conflicto en el servidor.",
    "reference_missing": "Algo a lo que hace referencia ({table}) se eliminó en el servidor.",
    "deleted_on_server": "Este registro se eliminó en el servidor.",
    "parent_rejected": "Depende de un registro ({table}) que no se pudo guardar.",
    "too_many_attempts": "No se pudo guardar tras varios intentos.",
    "scorer_mismatch": "Otro dispositivo tomó el control del registro.",
    "unknown": "Error desconocido del servidor."
  },
  "tables": {
    "matches": "partido",
    "sets": "set",
    "player_stats": "estadística",
    "score_points": "punto",
    "events": "evento",
    "team_members": "jugador",
    "teams": "equipo",
    "match_formats": "formato de partido",
    "championships": "campeonato",
    "seasons": "temporada",
    "unknown": "registro"
  },
  "claim": {
    "takenTitle": "Otra persona está registrando este partido",
    "takenBody": "{name} está registrando este partido en {device} (últimos datos recibidos a las {time}).",
    "takenWarning": "Si tomas el control, los cambios que ese dispositivo aún no ha enviado no se guardarán.",
    "takeOver": "Tomar el control del registro",
    "cancel": "Cancelar",
    "offlineTitle": "No se puede comprobar quién registra",
    "offlineBody": "Estás sin conexión, así que la aplicación no puede comprobar si otra persona está registrando este partido. ¿Registrar en este dispositivo?",
    "offlineConfirm": "Registrar en este dispositivo",
    "takenOverBanner": "{name} tomó el control del registro en {device} a las {time}.",
    "never": "nunca"
  },
  "guards": {
    "signOutTitle": "Cambios aún no enviados",
    "signOutBody": "{count, plural, one {# cambio de este dispositivo no se ha enviado} other {# cambios de este dispositivo no se han enviado}}. Se quedan en este dispositivo y se enviarán cuando vuelvas a iniciar sesión.",
    "signOutConfirm": "Cerrar sesión de todos modos",
    "clearBlocked": "Parte de estos datos aún no se ha enviado. Espera a que el indicador de sincronización muestre «Todo guardado».",
    "resetBlocked": "La base de datos local aún tiene cambios sin enviar, así que no se restableció. Vuelve a conectarte y espera a que todo esté guardado."
  }
}
```

Create `messages/it/sync.json`:

```json
{
  "badge": {
    "saved": "Tutto salvato",
    "uploading": "Salvataggio di {count, plural, one {# modifica} other {# modifiche}}…",
    "waiting": "{count, plural, one {# modifica salvata} other {# modifiche salvate}} su questo dispositivo, verranno inviate al ritorno della connessione",
    "problem": "{count, plural, one {# modifica non è stata salvata} other {# modifiche non sono state salvate}}",
    "otherAccount": "Su questo dispositivo ci sono modifiche di un altro account in attesa",
    "retry": "Riprova",
    "matchLine": "{pending} in attesa · {rejected} non salvate",
    "superseded": "Non inviato: {name} ha preso in carico il punteggio alle {time}",
    "unknownScorer": "un altro segnapunti",
    "allSavedToast": "Tutti i dati della partita sono salvati sul server",
    "noIssues": "Tutto ciò che è stato registrato su questo dispositivo è sul server."
  },
  "flag": {
    "pending": "Non ancora inviato",
    "problem": "Alcune modifiche non sono state salvate"
  },
  "errors": {
    "rls": "Il server ha rifiutato questa modifica (permessi insufficienti).",
    "invalid_data": "Il server ha rifiutato dati non validi.",
    "schema_mismatch": "L'app deve essere aggiornata per salvare questa modifica.",
    "duplicate": "Sul server esiste già un record in conflitto.",
    "reference_missing": "Un elemento collegato ({table}) è stato eliminato sul server.",
    "deleted_on_server": "Questo record è stato eliminato sul server.",
    "parent_rejected": "Dipende da un elemento ({table}) che non è stato possibile salvare.",
    "too_many_attempts": "Impossibile salvare dopo vari tentativi.",
    "scorer_mismatch": "Un altro dispositivo ha preso in carico il punteggio.",
    "unknown": "Errore sconosciuto del server."
  },
  "tables": {
    "matches": "partita",
    "sets": "set",
    "player_stats": "statistica",
    "score_points": "punto",
    "events": "evento",
    "team_members": "giocatore",
    "teams": "squadra",
    "match_formats": "formato partita",
    "championships": "campionato",
    "seasons": "stagione",
    "unknown": "record"
  },
  "claim": {
    "takenTitle": "Qualcun altro sta segnando questa partita",
    "takenBody": "{name} sta segnando questa partita su {device} (ultimi dati ricevuti alle {time}).",
    "takenWarning": "Se prendi il controllo, le modifiche non ancora inviate da quel dispositivo non verranno salvate.",
    "takeOver": "Prendi il controllo del punteggio",
    "cancel": "Annulla",
    "offlineTitle": "Impossibile verificare chi sta segnando",
    "offlineBody": "Sei offline, quindi l'app non può verificare se qualcun altro sta segnando questa partita. Segnare su questo dispositivo?",
    "offlineConfirm": "Segna su questo dispositivo",
    "takenOverBanner": "Il punteggio è stato preso in carico da {name} su {device} alle {time}.",
    "never": "mai"
  },
  "guards": {
    "signOutTitle": "Modifiche non ancora inviate",
    "signOutBody": "{count, plural, one {# modifica di questo dispositivo non è stata inviata} other {# modifiche di questo dispositivo non sono state inviate}}. Restano su questo dispositivo e verranno inviate quando accederai di nuovo.",
    "signOutConfirm": "Esci comunque",
    "clearBlocked": "Alcuni di questi dati non sono ancora stati inviati. Attendi che l'indicatore di sincronizzazione mostri «Tutto salvato».",
    "resetBlocked": "Il database locale contiene ancora modifiche non inviate, quindi non è stato reimpostato. Torna online e attendi che tutto sia salvato."
  }
}
```

Create `messages/pt/sync.json` (European Portuguese, like the existing files):

```json
{
  "badge": {
    "saved": "Tudo guardado",
    "uploading": "A guardar {count, plural, one {# alteração} other {# alterações}}…",
    "waiting": "{count, plural, one {# alteração guardada} other {# alterações guardadas}} neste dispositivo, serão enviadas quando voltar a ligação",
    "problem": "{count, plural, one {# alteração não pôde ser guardada} other {# alterações não puderam ser guardadas}}",
    "otherAccount": "Há alterações de outra conta à espera neste dispositivo",
    "retry": "Tentar novamente",
    "matchLine": "{pending} pendentes · {rejected} não guardadas",
    "superseded": "Não enviado: {name} assumiu o registo às {time}",
    "unknownScorer": "outro marcador",
    "allSavedToast": "Todos os dados do jogo estão guardados no servidor",
    "noIssues": "Tudo o que foi registado neste dispositivo está no servidor."
  },
  "flag": {
    "pending": "Ainda não enviado",
    "problem": "Algumas alterações não puderam ser guardadas"
  },
  "errors": {
    "rls": "O servidor recusou esta alteração (sem permissão).",
    "invalid_data": "O servidor recusou dados inválidos.",
    "schema_mismatch": "A aplicação precisa de ser atualizada para guardar esta alteração.",
    "duplicate": "Já existe um registo em conflito no servidor.",
    "reference_missing": "Algo a que se refere ({table}) foi eliminado no servidor.",
    "deleted_on_server": "Este registo foi eliminado no servidor.",
    "parent_rejected": "Depende de um registo ({table}) que não pôde ser guardado.",
    "too_many_attempts": "Não foi possível guardar após várias tentativas.",
    "scorer_mismatch": "Outro dispositivo assumiu o registo.",
    "unknown": "Erro desconhecido do servidor."
  },
  "tables": {
    "matches": "jogo",
    "sets": "set",
    "player_stats": "estatística",
    "score_points": "ponto",
    "events": "evento",
    "team_members": "jogador",
    "teams": "equipa",
    "match_formats": "formato de jogo",
    "championships": "campeonato",
    "seasons": "época",
    "unknown": "registo"
  },
  "claim": {
    "takenTitle": "Outra pessoa está a registar este jogo",
    "takenBody": "{name} está a registar este jogo em {device} (últimos dados recebidos às {time}).",
    "takenWarning": "Se assumir o registo, as alterações que esse dispositivo ainda não enviou não serão guardadas.",
    "takeOver": "Assumir o registo",
    "cancel": "Cancelar",
    "offlineTitle": "Não é possível verificar quem regista",
    "offlineBody": "Está offline, por isso a aplicação não consegue verificar se outra pessoa está a registar este jogo. Registar neste dispositivo?",
    "offlineConfirm": "Registar neste dispositivo",
    "takenOverBanner": "O registo foi assumido por {name} em {device} às {time}.",
    "never": "nunca"
  },
  "guards": {
    "signOutTitle": "Alterações ainda não enviadas",
    "signOutBody": "{count, plural, one {# alteração deste dispositivo não foi enviada} other {# alterações deste dispositivo não foram enviadas}}. Ficam neste dispositivo e serão enviadas quando voltar a iniciar sessão.",
    "signOutConfirm": "Terminar sessão mesmo assim",
    "clearBlocked": "Parte destes dados ainda não foi enviada. Aguarde até o indicador de sincronização mostrar «Tudo guardado».",
    "resetBlocked": "A base de dados local ainda tem alterações não enviadas, por isso não foi reposta. Volte a ligar-se e aguarde até tudo estar guardado."
  }
}
```

In each of `messages/en/index.ts`, `messages/fr/index.ts`, `messages/es/index.ts`, `messages/it/index.ts` and `messages/pt/index.ts`:
- Add `import sync from './sync.json';` after `import errors from './errors.json';`.
- Add `sync,` after `errors,` in the exported object.

Run: `pnpm i18n:check`
Expected: no missing or invalid keys.

- [ ] **Step 6: Add the hook and the badge**

Create `hooks/use-sync-status.ts`:

```ts
"use client";

import { useEffect, useState } from "react";
import { combineLatest } from "rxjs";
import { useLocalDb } from "@/components/providers/local-database-provider";
import { useAuth } from "@/contexts/auth-context";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { writeUnsentHint } from "@/lib/rxdb/pending-hint";
import { deriveSyncStatus, type SyncStatus } from "@/lib/rxdb/sync/status";

/** Live sync status of this device (null until the local database is ready). */
export function useSyncStatus(): SyncStatus | null {
  const { localDb } = useLocalDb();
  const { user } = useAuth();
  const { isOnline } = useOnlineStatus();
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const userId = user?.id ?? null;

  useEffect(() => {
    const manager = localDb?.syncManager;
    if (!manager) {
      setStatus(null);
      return;
    }
    const subscription = combineLatest([manager.pendingChanges.all$(), manager.tracked.get$()]).subscribe(
      ([entries, tracked]) => {
        const next = deriveSyncStatus({ entries, tracked, userId, online: isOnline });
        writeUnsentHint(next.pendingCount + next.rejectedCount + next.otherAccountCount);
        setStatus(next);
      }
    );
    return () => subscription.unsubscribe();
  }, [localDb, userId, isOnline]);

  return status;
}
```

Create `components/sync/format.ts`:

```ts
/** "14:32" in the user's locale, or null for a missing or invalid timestamp. */
export function formatTime(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
```

Create `components/sync/sync-reason.tsx`:

```tsx
"use client";

import { useTranslations } from "next-intl";
import type { SyncReasonInfo } from "@/lib/rxdb/sync/status";

/** One line explaining why changes couldn't be saved. */
export function SyncReason({ reason }: { reason: SyncReasonInfo }) {
  const t = useTranslations("sync");
  const table = t(`tables.${reason.params.table ?? "unknown"}`);
  return <p className="text-destructive">{t(`errors.${reason.code}`, { table })}</p>;
}
```

Create `components/sync/use-match-labels.ts`:

```ts
"use client";

import { useEffect, useState } from "react";
import { useLocalDb } from "@/components/providers/local-database-provider";

/** "Home – Away · 07/10/2026" for each match id, read from the local database. */
export function useMatchLabels(matchIds: string[]): Map<string, string> {
  const { localDb } = useLocalDb();
  const [labels, setLabels] = useState<Map<string, string>>(new Map());
  const key = matchIds.join(",");

  useEffect(() => {
    const ids = key ? key.split(",") : [];
    if (!localDb || ids.length === 0) return;
    let cancelled = false;
    void (async () => {
      const matches = await localDb.matches.findByIds(ids).exec();
      const teamIds = [...matches.values()].flatMap((match) => [match.home_team_id, match.away_team_id]);
      const teams = await localDb.teams.findByIds(teamIds).exec();
      const next = new Map<string, string>();
      for (const [id, match] of matches) {
        const home = teams.get(match.home_team_id)?.name ?? "?";
        const away = teams.get(match.away_team_id)?.name ?? "?";
        next.set(id, `${home} – ${away} · ${new Date(match.date).toLocaleDateString()}`);
      }
      if (!cancelled) setLabels(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [localDb, key]);

  return labels;
}
```

Create `components/sync/sync-badge.tsx`:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Check, CloudOff, LoaderCircle, TriangleAlert, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useLocalDb } from "@/components/providers/local-database-provider";
import { useSyncStatus } from "@/hooks/use-sync-status";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { ScorerInfo } from "@/lib/rxdb/sync/scorer-claim";
import type { SyncBadgeState } from "@/lib/rxdb/sync/status";
import { formatTime } from "./format";
import { SyncReason } from "./sync-reason";
import { useMatchLabels } from "./use-match-labels";

const ICONS: Record<SyncBadgeState, typeof Check> = {
  saved: Check,
  uploading: LoaderCircle,
  waiting: CloudOff,
  problem: TriangleAlert,
  "other-account": UserX,
};

function SupersededLine({ holder }: { holder: ScorerInfo | null }) {
  const t = useTranslations("sync");
  return (
    <p className="text-muted-foreground">
      {t("badge.superseded", {
        name: holder?.name ?? t("badge.unknownScorer"),
        time: formatTime(holder?.claimedAt) ?? "—",
      })}
    </p>
  );
}

/**
 * Whether this device's match data is on the server (spec section 8).
 * `compact` (live match header) shows the icon only and never toasts.
 */
export function SyncBadge({ compact = false }: { compact?: boolean }) {
  const t = useTranslations("sync");
  const { toast } = useToast();
  const { localDb } = useLocalDb();
  const status = useSyncStatus();
  const [showSavedLabel, setShowSavedLabel] = useState(false);
  const previousState = useRef<SyncBadgeState | null>(null);
  const sawWaiting = useRef(false);
  const state = status?.state ?? null;

  useEffect(() => {
    if (!state) return;
    if (state === "waiting") sawWaiting.current = true;
    const previous = previousState.current;
    previousState.current = state;
    if (state !== "saved" || !previous || previous === "saved") return;
    if (sawWaiting.current && !compact) {
      sawWaiting.current = false;
      toast({ title: t("badge.allSavedToast") });
    }
    setShowSavedLabel(true);
    const timer = setTimeout(() => setShowSavedLabel(false), 3000);
    return () => clearTimeout(timer);
  }, [state, compact, t, toast]);

  const labels = useMatchLabels(status?.matches.map((match) => match.matchId) ?? []);
  if (!status || !localDb) return null;

  const Icon = ICONS[status.state];
  const label = {
    saved: t("badge.saved"),
    uploading: t("badge.uploading", { count: status.pendingCount }),
    waiting: t("badge.waiting", { count: status.pendingCount }),
    problem: t("badge.problem", { count: status.rejectedCount }),
    "other-account": t("badge.otherAccount"),
  }[status.state];
  const showLabel = !compact && (status.state !== "saved" || showSavedLabel);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          data-testid="sync-badge"
          data-state={status.state}
          aria-label={label}
          className={cn(
            "gap-1.5 px-2 text-xs",
            status.state === "problem" && "text-destructive",
            status.state === "other-account" && "text-amber-600",
            status.state === "waiting" && "text-muted-foreground"
          )}
        >
          <Icon className={cn("h-4 w-4", status.state === "uploading" && "animate-spin")} />
          {showLabel && <span className="hidden sm:inline max-w-56 truncate">{label}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 space-y-3" data-testid="sync-details">
        <p className="text-sm font-medium">{label}</p>
        {status.matches.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("badge.noIssues")}</p>
        ) : (
          <ul className="space-y-2">
            {status.matches.map((match) => (
              <li key={match.matchId} className="space-y-1 text-sm">
                <p className="truncate font-medium">{labels.get(match.matchId) ?? match.matchId}</p>
                {(match.pending > 0 || match.rejected > 0) && (
                  <p className="text-muted-foreground">
                    {t("badge.matchLine", { pending: match.pending, rejected: match.rejected })}
                  </p>
                )}
                {match.reasons.map((reason) => (
                  <SyncReason key={`${reason.code}:${JSON.stringify(reason.params)}`} reason={reason} />
                ))}
                {match.superseded > 0 && <SupersededLine holder={match.lostTo} />}
              </li>
            ))}
          </ul>
        )}
        {status.rejectedCount > 0 && (
          <Button size="sm" className="w-full" onClick={() => void localDb.syncManager.retryRejected()}>
            {t("badge.retry")}
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
}
```

- [ ] **Step 7: Run tests, i18n check, lint and build**

Run: `pnpm test` → Expected: all pass.
Run: `pnpm i18n:check` → Expected: passes.
Run: `pnpm lint` → Expected: no new errors.
Run: `pnpm build` → Expected: succeeds.

- [ ] **Step 8: Commit**

```bash
git add lib/rxdb/sync/status.ts lib/rxdb/pending-hint.ts tests/unit/sync/status.test.ts tests/unit/sync/pending-hint.test.ts messages hooks/use-sync-status.ts components/sync
git commit -m "feat(sync): show whether match data is saved with a sync badge

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 15: Live match page (claim dialogs, read-only mode, leave warning)

**Files:**
- Create: `hooks/use-unsent-guard.ts`
- Create: `components/sync/scorer-claim-dialog.tsx`, `components/sync/taken-over-banner.tsx`
- Modify: `app/matches/[id]/live/page.tsx`

**Interfaces:**
- Consumes: `SyncManager.claimMatch`, `claimMatchOffline`, `tracked` (Task 13); `ScorerInfo` (Task 8); `SyncBadge`, `formatTime` (Task 14); `PendingChanges.count$` (Task 6).
- Produces:
  - `useMatchUnsentCount(matchId): number`
  - `useUnsentCountFor(tables): number`
  - `useBeforeUnloadWhenUnsent(active): void`
  - `type ClaimPrompt = { kind: "taken"; holder: ScorerInfo } | { kind: "offline" }`
  - `<ScorerClaimDialog prompt busy onCancel onConfirm />` (`data-testid="scorer-claim-dialog"`)
  - `<TakenOverBanner holder />` (`data-testid="taken-over-banner"`)
  - on the live page, a hidden element `data-testid="live-score"` with `data-set-id`, `data-home` and `data-away`, used by Task 18

- [ ] **Step 1: Add the unsent-changes hooks**

Create `hooks/use-unsent-guard.ts`:

```ts
"use client";

import { useEffect, useState } from "react";
import { useLocalDb } from "@/components/providers/local-database-provider";
import type { MatchCollectionName } from "@/lib/rxdb/sync/types";

/** Changes of this match not uploaded yet (pending only). */
export function useMatchUnsentCount(matchId: string): number {
  const { localDb } = useLocalDb();
  const [count, setCount] = useState(0);
  useEffect(() => {
    const pending = localDb?.pendingChanges;
    if (!pending) return;
    const subscription = pending.count$({ matchId, statuses: ["pending"] }).subscribe(setCount);
    return () => subscription.unsubscribe();
  }, [localDb, matchId]);
  return count;
}

/** Unsent (pending or rejected) changes in these tables, all matches. */
export function useUnsentCountFor(tables: readonly MatchCollectionName[]): number {
  const { localDb } = useLocalDb();
  const [count, setCount] = useState(0);
  const key = tables.join(",");
  useEffect(() => {
    const pending = localDb?.pendingChanges;
    if (!pending) return;
    const subscription = pending
      .count$({ tables: key.split(",") as MatchCollectionName[], statuses: ["pending", "rejected"] })
      .subscribe(setCount);
    return () => subscription.unsubscribe();
  }, [localDb, key]);
  return count;
}

/** Asks the browser to confirm before the tab is closed or reloaded. */
export function useBeforeUnloadWhenUnsent(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [active]);
}
```

- [ ] **Step 2: Add the dialog and the banner**

Create `components/sync/scorer-claim-dialog.tsx`:

```tsx
"use client";

import { useTranslations } from "next-intl";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { ScorerInfo } from "@/lib/rxdb/sync/scorer-claim";
import { formatTime } from "./format";

export type ClaimPrompt = { kind: "taken"; holder: ScorerInfo } | { kind: "offline" };

/** Asks before scoring a match another device holds, or one whose holder can't be checked offline. */
export function ScorerClaimDialog({
  prompt,
  busy,
  onCancel,
  onConfirm,
}: {
  prompt: ClaimPrompt | null;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const t = useTranslations("sync");
  if (!prompt) return null;
  const taken = prompt.kind === "taken";
  return (
    <AlertDialog open>
      <AlertDialogContent data-testid="scorer-claim-dialog">
        <AlertDialogHeader>
          <AlertDialogTitle>{taken ? t("claim.takenTitle") : t("claim.offlineTitle")}</AlertDialogTitle>
          <AlertDialogDescription>
            {taken
              ? t("claim.takenBody", {
                  name: prompt.holder.name ?? t("badge.unknownScorer"),
                  device: prompt.holder.deviceLabel ?? "—",
                  time: formatTime(prompt.holder.lastActivityAt) ?? t("claim.never"),
                })
              : t("claim.offlineBody")}
          </AlertDialogDescription>
          {taken && <p className="text-sm text-muted-foreground">{t("claim.takenWarning")}</p>}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel} disabled={busy}>
            {t("claim.cancel")}
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={busy}
            onClick={(event) => {
              event.preventDefault();
              onConfirm();
            }}
          >
            {taken ? t("claim.takeOver") : t("claim.offlineConfirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

Create `components/sync/taken-over-banner.tsx`:

```tsx
"use client";

import { useTranslations } from "next-intl";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { ScorerInfo } from "@/lib/rxdb/sync/scorer-claim";
import { formatTime } from "./format";

/** Shown instead of the scoring controls once another device took the match over. */
export function TakenOverBanner({ holder }: { holder: ScorerInfo | null }) {
  const t = useTranslations("sync");
  return (
    <Alert data-testid="taken-over-banner" className="m-2 w-auto">
      <AlertDescription>
        {t("claim.takenOverBanner", {
          name: holder?.name ?? t("badge.unknownScorer"),
          device: holder?.deviceLabel ?? "—",
          time: formatTime(holder?.claimedAt) ?? "—",
        })}
      </AlertDescription>
    </Alert>
  );
}
```

- [ ] **Step 3: Wire the live page**

In `app/matches/[id]/live/page.tsx`, make these edits.

**Imports.** Add:

```tsx
import { SyncBadge } from "@/components/sync/sync-badge";
import { ScorerClaimDialog, type ClaimPrompt } from "@/components/sync/scorer-claim-dialog";
import { TakenOverBanner } from "@/components/sync/taken-over-banner";
import { useBeforeUnloadWhenUnsent, useMatchUnsentCount } from "@/hooks/use-unsent-guard";
import type { ScorerInfo } from "@/lib/rxdb/sync/scorer-claim";
```

**State.** After `const { history, canUndo, canRedo } = useCommandHistory();`, add:

```tsx
  // Scoring device (spec section 7): a prompt blocks scoring until answered; a lost claim makes the page read-only.
  const [claimPrompt, setClaimPrompt] = useState<ClaimPrompt | null>(null);
  const [claimBusy, setClaimBusy] = useState(false);
  const [lostClaim, setLostClaim] = useState<{ holder: ScorerInfo | null } | null>(null);
  const unsentCount = useMatchUnsentCount(matchId);
  useBeforeUnloadWhenUnsent(unsentCount > 0);
```

**Claim check.** Directly above `const loadMatchData = useCallback(`, add:

```tsx
  const ensureScorerClaim = useCallback(async () => {
    if (!db) return;
    const entry = await db.syncManager.tracked.entry(matchId);
    if (entry?.claim === "lost") return; // read-only, see the effect below
    if (navigator.onLine) {
      try {
        const result = await db.syncManager.claimMatch(matchId);
        if (!result.claimed) setClaimPrompt({ kind: "taken", holder: result.holder });
        return;
      } catch (error) {
        console.warn("Could not check who scores this match, continuing as offline:", error);
      }
    }
    if (entry?.claim !== "held" && entry?.claim !== "pending-force") setClaimPrompt({ kind: "offline" });
  }, [db, matchId]);
```

**Call it from `loadMatchData`.** After `match.match_formats = format as MatchFormat;`, add:

```tsx
      if (match.status !== "completed") await ensureScorerClaim();
```

Add `ensureScorerClaim` to `loadMatchData`'s dependency array.

**Watch for a takeover.** Add this effect after the effect that calls `loadMatchData`:

```tsx
  useEffect(() => {
    if (!db) return;
    const subscription = db.syncManager.tracked.get$().subscribe((matches) => {
      const entry = matches[matchId];
      setLostClaim(entry?.claim === "lost" ? { holder: entry.lostTo } : null);
    });
    return () => subscription.unsubscribe();
  }, [db, matchId]);

  const handleClaimConfirm = async () => {
    if (!db || !claimPrompt) return;
    setClaimBusy(true);
    try {
      if (claimPrompt.kind === "taken") {
        const result = await db.syncManager.claimMatch(matchId, true);
        if (result.claimed) setClaimPrompt(null);
      } else {
        await db.syncManager.claimMatchOffline(matchId);
        setClaimPrompt(null);
      }
    } catch (error) {
      console.warn("Takeover failed, the server can't be reached:", error);
      setClaimPrompt({ kind: "offline" });
    } finally {
      setClaimBusy(false);
    }
  };
```

**Read-only main content.** At the top of `renderMainContent`, after `if (!matchState.match) return null;`, add:

```tsx
    if (lostClaim) return <TakenOverBanner holder={lostClaim.holder} />;
    if (claimPrompt) return null;
```

**Header row.** In the final `return`, replace the "Row 1: Header" block:

```tsx
      <div className="w-full shrink-0">
        <MatchScoreDetails
          match={matchState.match}
          sets={matchState.sets}
          homeTeam={homeTeam}
          awayTeam={awayTeam}
        />
      </div>
```

with:

```tsx
      <div className="w-full shrink-0 flex items-start gap-1">
        <div className="flex-1 min-w-0">
          <MatchScoreDetails
            match={matchState.match}
            sets={matchState.sets}
            homeTeam={homeTeam}
            awayTeam={awayTeam}
          />
        </div>
        <SyncBadge compact />
        {matchState.currentSet && (
          <span
            hidden
            data-testid="live-score"
            data-set-id={matchState.currentSet.id}
            data-home={matchState.score.home}
            data-away={matchState.score.away}
          />
        )}
      </div>
```

**Dialog.** Just before the final closing `</div>` of that `return`, add:

```tsx
      <ScorerClaimDialog
        prompt={claimPrompt}
        busy={claimBusy}
        onCancel={() => router.push("/matches")}
        onConfirm={() => void handleClaimConfirm()}
      />
```

- [ ] **Step 4: Check by hand**

Run: `pnpm build && pnpm start -p 3100`, sign in, and open a live match. Expected:
- No dialog (the match is free, so it's claimed silently).
- The compact badge next to the score.
- In DevTools → Application → Local Storage, `volleystats:device-id` is set.

In Supabase, the match row now has `scorer_device_id` set. Stop the server afterwards.

- [ ] **Step 5: Lint, build, commit**

Run: `pnpm lint` → Expected: no new errors.
Run: `pnpm build` → Expected: succeeds.

```bash
git add hooks/use-unsent-guard.ts components/sync app/matches/[id]/live/page.tsx
git commit -m "feat(live): claim the scoring device and warn before leaving with unsent changes

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 16: Navigation badge, sign-out warning and match-list flags

**Files:**
- Create: `components/sync/sync-flag.tsx`
- Modify: `components/navigation.tsx`
- Modify: `components/matches/history/match-history-table.tsx`

**Interfaces:**
- Consumes: `SyncBadge` and `useSyncStatus` (Task 14), `MatchSyncSummary` (Task 14).
- Produces:
  - `<SyncFlag summary? />`, rendering `data-testid="match-sync-flag"` with `data-state="pending" | "problem"`
  - the sign-out dialog `data-testid="sign-out-warning"`

- [ ] **Step 1: Add the flag**

Create `components/sync/sync-flag.tsx`:

```tsx
"use client";

import { useTranslations } from "next-intl";
import { CloudUpload, TriangleAlert } from "lucide-react";
import type { MatchSyncSummary } from "@/lib/rxdb/sync/status";

/** Small marker on a match whose changes aren't on the server yet. */
export function SyncFlag({ summary }: { summary?: MatchSyncSummary }) {
  const t = useTranslations("sync");
  if (!summary) return null;
  if (summary.rejected > 0) {
    return (
      <span title={t("flag.problem")} data-testid="match-sync-flag" data-state="problem" className="inline-flex">
        <TriangleAlert className="h-4 w-4 text-destructive" aria-label={t("flag.problem")} />
      </span>
    );
  }
  if (summary.pending > 0) {
    return (
      <span title={t("flag.pending")} data-testid="match-sync-flag" data-state="pending" className="inline-flex">
        <CloudUpload className="h-4 w-4 text-muted-foreground" aria-label={t("flag.pending")} />
      </span>
    );
  }
  return null;
}
```

- [ ] **Step 2: Navigation**

In `components/navigation.tsx`, add these imports:

```tsx
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { SyncBadge } from "@/components/sync/sync-badge";
import { useSyncStatus } from "@/hooks/use-sync-status";
```

Inside the `Navigation` component, after `const { user, signOut } = useAuth();`, add:

```tsx
  const tSync = useTranslations("sync");
  const syncStatus = useSyncStatus();
  const unsentCount = (syncStatus?.pendingCount ?? 0) + (syncStatus?.rejectedCount ?? 0);
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const handleSignOut = () => {
    if (unsentCount > 0) setConfirmSignOut(true);
    else void signOut();
  };
```

In the right-hand action group, replace:

```tsx
        <div className="flex items-center">
          <FullScreenToggle />
```

with:

```tsx
        <div className="flex items-center">
          {user && <SyncBadge />}
          <FullScreenToggle />
```

and change the sign-out button's `onClick={signOut}` to `onClick={handleSignOut}`.

Just before the closing `</header>`, add:

```tsx
      <AlertDialog open={confirmSignOut} onOpenChange={setConfirmSignOut}>
        <AlertDialogContent data-testid="sign-out-warning">
          <AlertDialogHeader>
            <AlertDialogTitle>{tSync("guards.signOutTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{tSync("guards.signOutBody", { count: unsentCount })}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tSync("claim.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmSignOut(false);
                void signOut();
              }}
            >
              {tSync("guards.signOutConfirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
```

If `Navigation` has an early `return` for a different layout (the landscape branch around line 59), add `{user && <SyncBadge compact />}` next to that branch's sign-out control as well, and route its sign-out through `handleSignOut`.

- [ ] **Step 3: Match list flags**

In `components/matches/history/match-history-table.tsx`, add these imports:

```tsx
import { SyncFlag } from "@/components/sync/sync-flag";
import { useSyncStatus } from "@/hooks/use-sync-status";
```

At the top of the component body (next to the other hooks), add:

```tsx
  const syncStatus = useSyncStatus();
  const syncByMatch = useMemo(
    () => new Map((syncStatus?.matches ?? []).map((summary) => [summary.matchId, summary])),
    [syncStatus]
  );
```

In the mobile card view, replace:

```tsx
              <span className="text-sm capitalize px-2 py-0.5 bg-muted rounded">
                {te(`matchStatus.${match.status}`)}
              </span>
```

with:

```tsx
              <span className="flex items-center gap-1.5">
                <SyncFlag summary={syncByMatch.get(match.id)} />
                <span className="text-sm capitalize px-2 py-0.5 bg-muted rounded">
                  {te(`matchStatus.${match.status}`)}
                </span>
              </span>
```

In the table view, replace:

```tsx
                <TableCell>
                  <span className="capitalize">{te(`matchStatus.${match.status}`)}</span>
                </TableCell>
```

with:

```tsx
                <TableCell>
                  <span className="flex items-center gap-1.5">
                    <span className="capitalize">{te(`matchStatus.${match.status}`)}</span>
                    <SyncFlag summary={syncByMatch.get(match.id)} />
                  </span>
                </TableCell>
```

- [ ] **Step 4: Lint, build, commit**

Run: `pnpm lint` → Expected: no new errors.
Run: `pnpm build` → Expected: succeeds.

```bash
git add components/sync/sync-flag.tsx components/navigation.tsx components/matches/history/match-history-table.tsx
git commit -m "feat(sync): sync badge in the header, sign-out warning and unsent flags on matches

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 17: Guards against deleting unsent data, and removal of the manual sync tool

**Files:**
- Create: `lib/rxdb/reset-policy.ts`
- Test: `tests/unit/sync/reset-policy.test.ts`
- Modify: `lib/rxdb/database.ts`
- Modify: `components/providers/local-database-provider.tsx`
- Modify: `app/settings/page.tsx`

**Interfaces:**
- Consumes: `readUnsentHint` (Task 14), `useUnsentCountFor` (Task 15), `MATCH_COLLECTIONS` (Task 6).
- Produces:
  - `decideDatabaseReset({ isSchemaError, devEnvironment, removeFlag, unsentCount }): "reset" | "blocked" | "keep"`
  - the error message `unsentChangesBlockReset`, thrown by `createDatabase` when a reset is refused

- [ ] **Step 1: Write the failing test**

Create `tests/unit/sync/reset-policy.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { decideDatabaseReset } from "@/lib/rxdb/reset-policy";

describe("decideDatabaseReset", () => {
  it("resets an incompatible database when asked and nothing is unsent", () => {
    expect(decideDatabaseReset({ isSchemaError: true, devEnvironment: false, removeFlag: true, unsentCount: 0 })).toBe("reset");
    expect(decideDatabaseReset({ isSchemaError: true, devEnvironment: true, removeFlag: false, unsentCount: 0 })).toBe("reset");
  });

  it("refuses to reset while changes are unsent", () => {
    expect(decideDatabaseReset({ isSchemaError: true, devEnvironment: false, removeFlag: true, unsentCount: 3 })).toBe("blocked");
    expect(decideDatabaseReset({ isSchemaError: true, devEnvironment: true, removeFlag: false, unsentCount: 1 })).toBe("blocked");
  });

  it("keeps the database for other errors or without a request", () => {
    expect(decideDatabaseReset({ isSchemaError: false, devEnvironment: true, removeFlag: true, unsentCount: 0 })).toBe("keep");
    expect(decideDatabaseReset({ isSchemaError: true, devEnvironment: false, removeFlag: false, unsentCount: 0 })).toBe("keep");
  });
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `pnpm test tests/unit/sync/reset-policy.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement the policy and use it**

Create `lib/rxdb/reset-policy.ts`:

```ts
export type DatabaseResetDecision = "reset" | "blocked" | "keep";

/** Whether a local database that failed to open may be deleted (spec section 8). */
export function decideDatabaseReset({
  isSchemaError,
  devEnvironment,
  removeFlag,
  unsentCount,
}: {
  isSchemaError: boolean;
  devEnvironment: boolean;
  removeFlag: boolean;
  unsentCount: number;
}): DatabaseResetDecision {
  if (!isSchemaError || !(devEnvironment || removeFlag)) return "keep";
  return unsentCount > 0 ? "blocked" : "reset";
}
```

In `lib/rxdb/database.ts`:
- Add these imports: `import { readUnsentHint } from "./pending-hint";` and `import { decideDatabaseReset } from "./reset-policy";`.
- Replace the block starting at `if (isSchemaError) {` and ending at its closing brace with:

```ts
        const decision = decideDatabaseReset({
          isSchemaError,
          devEnvironment: inDevEnvironment,
          removeFlag: removeDbFlag === "true",
          unsentCount: readUnsentHint(),
        });
        if (decision === "blocked") {
          // Error identifier maps to translation key: sync.guards.resetBlocked
          throw new Error("unsentChangesBlockReset");
        }
        if (decision === "reset") {
          console.warn("Schema version conflict detected. Removing the local database and reinitializing...");
          await removeRxDatabase(getDatabaseName(), getRxStorageDexie());
          dbPromise = null;
          return getDatabase();
        }
```

In `components/providers/local-database-provider.tsx`:
- Add `const tSync = useTranslations("sync");` next to the other `useTranslations` calls.
- In the `if (database.error)` branch, directly after the `<p className="text-destructive font-semibold">…</p>` element, add:

```tsx
        {database.error.message === "unsentChangesBlockReset" && (
          <p className="text-sm text-muted-foreground max-w-md text-center">{tSync("guards.resetBlocked")}</p>
        )}
```

- [ ] **Step 4: Settings: guards and removal of the manual sync tool**

In `app/settings/page.tsx`:
1. Delete the `performMatchSync` function and the state it uses: the `matchId`/`setMatchId` and `isSyncing`/`setIsSyncing` `useState` lines.
2. Delete the JSX block that renders the "Synchronize Match" row (the `div` containing `{t('localData.syncMatch')}`, the `<Input … placeholder={t('localData.matchId')} />` and the `{t('localData.synchronize')}` button).
3. Remove the imports that are now unused: `createClient`, `TablesUpdate`, `chunk`, `delay`, `RxCollection` and `CollectionName`. Keep `Input` (the password and email fields use it) and `removeRxDatabase`.
4. Add these imports:

```tsx
import { useUnsentCountFor } from "@/hooks/use-unsent-guard";
import { MATCH_COLLECTIONS } from "@/lib/rxdb/sync/types";
```

5. At module level, below the imports, add:

```tsx
const STATS_TABLES = ["events", "score_points", "player_stats"] as const;
```

6. Inside the component, next to the other hooks, add:

```tsx
  const tSync = useTranslations("sync");
  const unsentStats = useUnsentCountFor(STATS_TABLES);
  const unsentMatchData = useUnsentCountFor(MATCH_COLLECTIONS);
```

7. Directly under `<Label>{t('localData.title')}</Label>`, add:

```tsx
              {unsentMatchData > 0 && (
                <p className="text-sm text-destructive" data-testid="clear-blocked">
                  {tSync("guards.clearBlocked")}
                </p>
              )}
```

8. Disable the destructive buttons while data is unsent:
   - The "Clear Local Stats" button: add `disabled={unsentStats > 0}`.
   - The "Clear Local Matches" and "Clear Local Teams" buttons: add `disabled={unsentMatchData > 0}`.
   - The "Clear All" button: change its `disabled={isDeletingCache}` to `disabled={isDeletingCache || unsentMatchData > 0}`.

Run: `git grep -n "performMatchSync\|localData.syncMatch\|TablesUpdate" -- app/settings/page.tsx`
Expected: no output.

- [ ] **Step 5: Run tests, lint, build**

Run: `pnpm test` → Expected: all pass.
Run: `pnpm lint` → Expected: no new errors and no unused-import warnings in `app/settings/page.tsx`.
Run: `pnpm build` → Expected: succeeds.

- [ ] **Step 6: Commit**

```bash
git add lib/rxdb/reset-policy.ts tests/unit/sync/reset-policy.test.ts lib/rxdb/database.ts components/providers/local-database-provider.tsx app/settings/page.tsx
git commit -m "feat(sync): refuse to delete unsent match data and drop the manual sync tool

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 18: End-to-end tests (server = device)

Requires the Task 3 migration to be applied. The e2e suite runs against the real Supabase project.

**Files:**
- Create: `tests/helpers/server-data.ts`, `tests/helpers/sync.ts`
- Modify: `tests/e2e/04-live-offline.spec.ts`
- Create: `tests/e2e/04d-sync-reopen.spec.ts`, `tests/e2e/04e-scorer-takeover.spec.ts`, `tests/e2e/04f-sign-out-warning.spec.ts`
- Modify: `tests/e2e/04c-rxdb-legacy.spec.ts`, `tests/e2e/06z-screenshots.spec.ts` (accept the scorer dialog)

**Interfaces:**
- Consumes these test hooks from Tasks 14–16: `data-testid="sync-badge"` (`data-state`), `live-score`, `scorer-claim-dialog`, `taken-over-banner`, `sign-out-warning`.
- Produces:
  - `fetchServerMatch(matchId)`
  - `waitForAllSaved(page, timeout?)`, `readLiveScore(page)`
  - `expectServerMatchesLiveScore(matchId, score, timeout?)`
  - `takeOverScoringIfAsked(page)`, `acceptBeforeUnload(page)`

- [ ] **Step 1: Add the helpers**

Create `tests/helpers/server-data.ts`:

```ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;

/** Supabase as the e2e account (TEST_EMAIL / TEST_PASSWORD), to read what reached the server. */
export async function serverClient(): Promise<SupabaseClient> {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const email = process.env.TEST_EMAIL;
  const password = process.env.TEST_PASSWORD;
  if (!url || !anonKey || !email || !password) {
    throw new Error('server-data needs NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, TEST_EMAIL and TEST_PASSWORD');
  }
  const created = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await created.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`server-data sign-in: ${error.message}`);
  client = created;
  return created;
}

type Row = Record<string, any>;

export interface ServerMatchState {
  match: Row;
  sets: Row[];
  points: Row[];
  stats: Row[];
  events: Row[];
}

/** The match's rows on the server, soft-deleted rows excluded. */
export async function fetchServerMatch(matchId: string): Promise<ServerMatchState> {
  const supabase = await serverClient();
  const live = (rows: Row[] | null) => (rows ?? []).filter((row) => !row._deleted);
  const [match, sets, points, stats, events] = await Promise.all([
    supabase.from('matches').select('*').eq('id', matchId).single(),
    supabase.from('sets').select('*').eq('match_id', matchId),
    supabase.from('score_points').select('*').eq('match_id', matchId),
    supabase.from('player_stats').select('*').eq('match_id', matchId),
    supabase.from('events').select('*').eq('match_id', matchId),
  ]);
  for (const response of [match, sets, points, stats, events]) {
    if (response.error) throw new Error(response.error.message);
  }
  return { match: match.data!, sets: live(sets.data), points: live(points.data), stats: live(stats.data), events: live(events.data) };
}
```

Create `tests/helpers/sync.ts`:

```ts
import { expect, type Page } from '@playwright/test';
import { fetchServerMatch } from './server-data';

export interface LiveScore {
  setId: string;
  home: number;
  away: number;
}

/** The score the live page shows for its current set. */
export async function readLiveScore(page: Page): Promise<LiveScore> {
  const element = page.getByTestId('live-score');
  return {
    setId: (await element.getAttribute('data-set-id'))!,
    home: Number(await element.getAttribute('data-home')),
    away: Number(await element.getAttribute('data-away')),
  };
}

export async function waitForAllSaved(page: Page, timeout = 60_000): Promise<void> {
  await expect(page.getByTestId('sync-badge').first()).toHaveAttribute('data-state', 'saved', { timeout });
}

/** The server's set has the score the device shows, and exactly that many live points. */
export async function expectServerMatchesLiveScore(matchId: string, score: LiveScore, timeout = 60_000): Promise<void> {
  await expect
    .poll(
      async () => {
        const server = await fetchServerMatch(matchId);
        const set = server.sets.find((row) => row.id === score.setId);
        return {
          home: set?.home_score ?? null,
          away: set?.away_score ?? null,
          points: server.points.filter((row) => row.set_id === score.setId).length,
        };
      },
      { timeout, intervals: [1000, 2000, 5000] }
    )
    .toEqual({ home: score.home, away: score.away, points: score.home + score.away });
}

/** A live page opened in another browser context asks before taking over scoring. */
export async function takeOverScoringIfAsked(page: Page): Promise<void> {
  const dialog = page.getByTestId('scorer-claim-dialog');
  const asked = await dialog.waitFor({ state: 'visible', timeout: 5_000 }).then(
    () => true,
    () => false
  );
  if (asked) await dialog.getByRole('button', { name: /take over scoring|score on this device/i }).click();
}

/** Reloads with unsent changes trigger the leave-page prompt: accept it. */
export function acceptBeforeUnload(page: Page): void {
  page.on('dialog', (dialog) => {
    if (dialog.type() === 'beforeunload') void dialog.accept();
  });
}
```

- [ ] **Step 2: Assert server = device in the offline spec**

In `tests/e2e/04-live-offline.spec.ts`:
- Add `import { acceptBeforeUnload, expectServerMatchesLiveScore, readLiveScore, waitForAllSaved } from '../helpers/sync';`.
- Add `acceptBeforeUnload(page);` as the first line of the test body, after `test.setTimeout(...)`.
- After the "page reloaded when the connection came back" assertion (the end of step 5.6), add:

```ts
    // 5.6b Everything recorded offline reaches the server exactly as the device shows it.
    await waitForAllSaved(page);
    const score = await readLiveScore(page);
    await expectServerMatchesLiveScore(matchId, score);
```

- Update the comment block at the top of the file: add `5.6b  Wait for "All saved" and compare the server with the device`.

- [ ] **Step 3: Reopen and multi-tab spec**

Create `tests/e2e/04d-sync-reopen.spec.ts`:

```ts
/**
 * Sync — data recorded offline reaches the server
 *
 * 1. Score offline, close the page, reopen the app on the home page online:
 *    the points upload without opening the match again.
 * 2. Score in a live page that is not the leading tab: the leader uploads it.
 */

import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { createAndStartMatch } from '../helpers/match-setup';
import { setupCourtPositions } from '../helpers/court';
import { goOffline, waitForServiceWorker } from '../helpers/network';
import { acceptBeforeUnload, expectServerMatchesLiveScore, readLiveScore, waitForAllSaved } from '../helpers/sync';

const FIXTURE_PATH = path.join(__dirname, '../fixtures/test-data.json');

function loadFixture(): { teamName: string; playerNames: string[] } {
  return JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf-8'));
}

test.describe('Sync — data recorded offline reaches the server', () => {
  test('uploads after the app is closed offline and reopened on the home page', async ({ page, context }) => {
    test.setTimeout(6 * 60_000);
    acceptBeforeUnload(page);
    const { teamName, playerNames } = loadFixture();
    expect(teamName, 'Team fixture not found — run 01-teams.spec.ts first').toBeTruthy();

    const { matchId } = await createAndStartMatch(page, { teamName, playerNames });
    await setupCourtPositions(page, playerNames.slice(0, 6), { selectServingTeam: teamName });
    const pointButton = page.getByTestId('point-btn-managed-point').first();
    await pointButton.waitFor({ state: 'visible', timeout: 10_000 });
    await waitForServiceWorker(page);

    await goOffline(page);
    for (let i = 0; i < 3; i++) {
      await pointButton.click();
      await page.waitForTimeout(200);
    }
    const score = await readLiveScore(page);
    await page.close(); // closing doesn't run beforeunload

    await context.setOffline(false);
    const home = await context.newPage();
    await home.goto('/');
    await waitForAllSaved(home);
    await expectServerMatchesLiveScore(matchId, score);
  });

  test('uploads from a live page that is not the leading tab', async ({ context }) => {
    test.setTimeout(6 * 60_000);
    const homeTab = await context.newPage(); // opened first: this tab becomes the RxDB leader
    await homeTab.goto('/');
    await expect(homeTab.getByTestId('sync-badge').first()).toBeVisible({ timeout: 30_000 });

    const page = await context.newPage();
    acceptBeforeUnload(page);
    const { teamName, playerNames } = loadFixture();
    const { matchId } = await createAndStartMatch(page, { teamName, playerNames });
    await setupCourtPositions(page, playerNames.slice(0, 6), { selectServingTeam: teamName });
    const pointButton = page.getByTestId('point-btn-managed-point').first();
    await pointButton.waitFor({ state: 'visible', timeout: 10_000 });
    for (let i = 0; i < 3; i++) {
      await pointButton.click();
      await page.waitForTimeout(200);
    }
    const score = await readLiveScore(page);
    await waitForAllSaved(page);
    await expectServerMatchesLiveScore(matchId, score);
  });
});
```

- [ ] **Step 4: Takeover spec**

Create `tests/e2e/04e-scorer-takeover.spec.ts`:

```ts
/**
 * Scoring device — a second device takes over a match.
 * The first device's later point never reaches the server and its page becomes read-only.
 */

import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { createAndStartMatch } from '../helpers/match-setup';
import { setupCourtPositions } from '../helpers/court';
import { acceptBeforeUnload, expectServerMatchesLiveScore, readLiveScore, waitForAllSaved } from '../helpers/sync';

const FIXTURE_PATH = path.join(__dirname, '../fixtures/test-data.json');

test('a second device takes over scoring and the first becomes read-only', async ({ page, browser }) => {
  test.setTimeout(6 * 60_000);
  acceptBeforeUnload(page);
  const { teamName, playerNames } = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf-8'));

  const { matchId } = await createAndStartMatch(page, { teamName, playerNames });
  await setupCourtPositions(page, playerNames.slice(0, 6), { selectServingTeam: teamName });
  const pointA = page.getByTestId('point-btn-managed-point').first();
  await pointA.waitFor({ state: 'visible', timeout: 10_000 });
  await pointA.click();
  await page.waitForTimeout(200);
  await pointA.click();
  await waitForAllSaved(page);
  await expectServerMatchesLiveScore(matchId, await readLiveScore(page));

  // Device B: same account, another browser context (its own device id).
  const contextB = await browser.newContext({
    storageState: 'playwright/.auth/user.json',
    viewport: { width: 768, height: 1024 },
  });
  const pageB = await contextB.newPage();
  acceptBeforeUnload(pageB);
  await pageB.goto(page.url());
  const dialog = pageB.getByTestId('scorer-claim-dialog');
  await expect(dialog).toBeVisible({ timeout: 60_000 });
  await dialog.getByRole('button', { name: /take over scoring/i }).click();
  await expect(dialog).toBeHidden();
  const pointB = pageB.getByTestId('point-btn-managed-point').first();
  await pointB.waitFor({ state: 'visible', timeout: 20_000 });
  await pointB.click();
  await waitForAllSaved(pageB);
  const scoreB = await readLiveScore(pageB);
  await expectServerMatchesLiveScore(matchId, scoreB);

  // Device A scores again: the server refuses it and A becomes read-only, without an error state.
  await pointA.click();
  await expect(page.getByTestId('taken-over-banner')).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId('sync-badge').first()).not.toHaveAttribute('data-state', 'problem');
  await expectServerMatchesLiveScore(matchId, scoreB);

  await contextB.close();
});
```

- [ ] **Step 5: Sign-out warning spec**

Create `tests/e2e/04f-sign-out-warning.spec.ts`. It never actually signs out, because that would revoke the shared session the other specs use:

```ts
/**
 * Signing out with changes not uploaded yet asks first. Cancelling keeps the session.
 */

import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { createAndStartMatch } from '../helpers/match-setup';
import { setupCourtPositions } from '../helpers/court';
import { goOffline, goOnline, waitForServiceWorker } from '../helpers/network';
import { acceptBeforeUnload, waitForAllSaved } from '../helpers/sync';

const FIXTURE_PATH = path.join(__dirname, '../fixtures/test-data.json');

test('warns before signing out with unsent changes', async ({ page }) => {
  test.setTimeout(5 * 60_000);
  acceptBeforeUnload(page);
  const { teamName, playerNames } = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf-8'));
  await createAndStartMatch(page, { teamName, playerNames });
  await setupCourtPositions(page, playerNames.slice(0, 6), { selectServingTeam: teamName });
  const pointButton = page.getByTestId('point-btn-managed-point').first();
  await pointButton.waitFor({ state: 'visible', timeout: 10_000 });
  await waitForServiceWorker(page);

  await goOffline(page);
  await pointButton.click();
  await expect(page.getByTestId('sync-badge').first()).toHaveAttribute('data-state', 'waiting', { timeout: 10_000 });

  await page.getByRole('button', { name: /sign out/i }).click();
  const warning = page.getByTestId('sign-out-warning');
  await expect(warning).toBeVisible();
  await warning.getByRole('button', { name: /cancel/i }).click();
  await expect(warning).toBeHidden();
  await expect(page.getByRole('button', { name: /sign out/i })).toBeVisible();

  await goOnline(page);
  await waitForAllSaved(page);
});
```

- [ ] **Step 6: Let existing specs take over the match they reopen**

In `tests/e2e/04c-rxdb-legacy.spec.ts`:
- Add `import { takeOverScoringIfAsked } from '../helpers/sync';`.
- After `await page.goto(offlineMatchLiveUrl);`, add `await takeOverScoringIfAsked(page);`.

In `tests/e2e/06z-screenshots.spec.ts`:
- Add the same import.
- After `await page.goto(url);`, add `if (url.includes('/live')) await takeOverScoringIfAsked(page);`.

- [ ] **Step 7: Run the suite**

Run: `pnpm build && pnpm start -p 3100` (in a second terminal or in the background), then:
`CI=1 BASE_URL=http://localhost:3100 pnpm test:e2e`
Expected: all specs pass. The global teardown deletes the E2E data afterwards.

If a spec fails, read its trace (`playwright-report/`) before changing code. A failing server = device assertion is a real sync bug; fix it in the sync code, not the test.

- [ ] **Step 8: Commit**

```bash
git add tests/helpers/server-data.ts tests/helpers/sync.ts tests/e2e/04-live-offline.spec.ts tests/e2e/04c-rxdb-legacy.spec.ts tests/e2e/04d-sync-reopen.spec.ts tests/e2e/04e-scorer-takeover.spec.ts tests/e2e/04f-sign-out-warning.spec.ts tests/e2e/06z-screenshots.spec.ts
git commit -m "test(e2e): check that the server ends up with exactly what the device recorded

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 19: Documentation, full verification and release

**Files:**
- Modify: `.claude/docs/04-offline-sync.md`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Rewrite the offline sync doc**

In `.claude/docs/04-offline-sync.md`, replace everything from `## Synchronization Mechanism` up to (but not including) `## What Works Offline` with:

````markdown
## Synchronization Mechanism

Design: [docs/superpowers/specs/2026-10-07-offline-sync-reliability-design.md](../../docs/superpowers/specs/2026-10-07-offline-sync-reliability-design.md).

**Location**: [lib/rxdb/sync/](lib/rxdb/sync/)

| File | Role |
|---|---|
| `manager.ts` | `SyncManager`: signed-in user, tracked matches, scorer claim, resume on reconnect/foreground |
| `match-sync.ts` | The five replications of one match (`matches`, `sets`, `player_stats`, `score_points`, `events`) |
| `reference-sync.ts` | Pull-only replications of reference tables |
| `replication.ts` | `replicateSupabase()`: RxDB ↔ Supabase adapter (pull by `_modified` checkpoint, push row by row) |
| `pending-changes.ts` | `pending_changes` local collection: every unsent row, filled by collection hooks |
| `dependencies.ts` | Parent-first gate (foreign keys) and claim gate |
| `errors.ts` | Push error classification (temporary / permanent / superseded) |
| `conflict-handler.ts` | The scoring device wins conflicts on match data |
| `tracked-matches.ts`, `sync-state.ts` | Local documents shared by every tab |
| `scorer-claim.ts` | `claim_match_scorer` / `get_match_scorer` RPCs |
| `platform/` | `SyncPlatform` (connectivity, foreground, device id); `web.ts` for the browser |
| `status.ts` | Sync badge state |

### What gets synced

- **Reference tables** (`championships`, `seasons`, `match_formats`, `clubs`, `teams`, and `club_members`/`team_members` of the user's clubs/teams): pull-only, from sign-in.
- **Match data**: one pull+push replication per (table, tracked match), identifier `sync2_<table>_match_<matchId>`, filtered to the match; a push modifier drops other matches' rows. A match is tracked once the live page calls `syncMatch(matchId)`. Tracked matches live in the `tracked-matches` local document and are replicated **from app start on every screen**, by the leader tab only. A match leaves the list 14 days after it was last opened, once nothing of it is unsent.

### Server columns and triggers

- `_modified` (all 12 tables): server-clock checkpoint, set on every insert/update. Not in local schemas; `pickSchemaFields` drops it and any other column the local schema doesn't know.
- `updated_at`: time of the last edit. Requests with `x-device-id` (sync) keep the device's value; other requests (API layer) get `now()`.
- `matches.scorer_*` + `claim_match_scorer` / `get_match_scorer`: one scoring device per match. A trigger refuses sync writes from another device (`P0001 scorer_mismatch`).

### Push rules

- Rows are sent one at a time. A row waits (up to 5 s, then retried) while a parent insert of the same match is unsent (`sets → matches`, `player_stats/score_points/events → sets`).
- Conflicts on match data: if the device knew a previous server version, the device wins; otherwise the later `updated_at` wins.
- Errors: network/auth/server errors retry forever without counting; `parent_missing`/unknown errors count, and are rejected after 20 attempts; RLS, invalid data, schema mismatch, a missing external reference or a row deleted on the server are rejected at once and never block later rows. `scorer_mismatch` marks the match's unsent rows `superseded`.
- Rejected rows stay in `pending_changes` with a reason; the badge's **Retry** re-queues them.

### Not paused offline

Replications are never paused: RxDB's retry waits for the `online` event. Reconnecting or coming back to the foreground calls `reSync()` and re-checks scorer claims.

### Data-loss guards

- Settings "clear local data" buttons are disabled while their tables have unsent rows.
- A schema-error database reset (`?remove-database=true` or dev auto-reset) is refused while the unsent hint (`volleystats:unsent-changes` in localStorage) is non-zero.
- **A future `DB_GENERATION` bump must not delete a database that still has unsent rows**: keep the old database until its `pending_changes` is empty (open it with the old schema, let its replications finish, then delete it).
- Sign-out with unsent changes asks first; local data is kept and uploads when the same user signs back in.
````

In the same file:
- Under `## What Works Offline` → `**User Experience**`, replace the two bullets with:
  - The sync badge (header and live page) shows "All saved", "Saving N changes…", "N changes saved on this device", "N changes couldn't be saved" (with **Retry**), or "changes from another account".
  - Matches with unsent changes are flagged in the match list.
  - Opening a match another device scores asks before taking over; the previous device becomes read-only and keeps its unsent changes as "not uploaded".
- In the `**Database generation**` bullet of `## RxDB Configuration`, add: "Never bump it while devices may hold unsent rows; see Data-loss guards."

- [ ] **Step 2: Update CLAUDE.md**

In `CLAUDE.md`, under **Essential Patterns**, replace item 2 with:

```markdown
2. **Offline live match**: Live match tracking must work offline, so it writes to RxDB (`useLocalDb` + `lib/commands`) and `SyncManager` replicates to Supabase. A match is replicated once opened (`syncMatch(matchId)` tracks it) and from then on at every app start, on every screen, until it is fully uploaded; don't add whole-table syncs of match data. Unsent rows are listed in the `pending_changes` collection, which drives the sync badge. See [.claude/docs/04-offline-sync.md](.claude/docs/04-offline-sync.md).
```

Under **Common Commands**, add `pnpm test           # Unit tests (Vitest; sync layer)` after `pnpm lint`.

- [ ] **Step 3: Full verification**

Run each, and paste the summary lines into the task notes:
- `pnpm test` → Expected: all unit tests pass.
- `pnpm i18n:check` → Expected: passes.
- `pnpm lint` → Expected: no new errors compared with `main`.
- `pnpm build` → Expected: succeeds.
- The e2e suite as in Task 18 Step 7 → Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add .claude/docs/04-offline-sync.md CLAUDE.md
git commit -m "docs: describe the reworked offline sync

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 5: Review and release**

Use superpowers:requesting-code-review for the whole branch, then superpowers:finishing-a-development-branch.

Release order:
1. Task 1's commit is live in production. Task 3 already checked this.
2. The migration is applied. Task 3 already did this.
3. Deploy this branch.

Tell the user that existing devices upgrade on their next online start. Each device then offers the server, once, any rows an old version never uploaded, without overwriting later corrections.

---

## Spec coverage

| Spec section | Tasks |
|---|---|
| Root causes 1–9 | 5, 10 (1); 12 (2, 3, 4, 6); 10 (5); 9 (7); 17 (8); 14–16, 18 (9) |
| 1. Server changes | 3 |
| 2. Replication topology, platform adapter | 7, 10, 11, 12 |
| 3. Conflicts | 5, 6 (edit-time hook) |
| 4. Pending changes | 6, 9 |
| 5. Push errors and foreign keys | 4, 9, 10 |
| 6. Auth over long offline periods | 12 (tests), 4 (`auth` never counts) |
| 7. Scoring device per match | 3, 8, 13, 15 |
| 8. User interface | 14, 15, 16, 17 |
| 9. Upgrade of existing devices | 1 (deploy first), 12 (`runSyncUpgrade`) |
| 10. Testing | every task; 18 for Playwright |
