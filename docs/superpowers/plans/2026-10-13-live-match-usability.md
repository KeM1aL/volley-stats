# Live Match Usability (archive players, leave guard, late players) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Players are archived instead of deleted, leaving a live match asks first (with an offline page instead of the browser's error page), and a team member who arrives late can join the roster of a match in progress, offline included.

**Architecture:** B adds `team_members.archived_at` on the server and in the RxDB player schema (version 1, migrated in place), filters archived members out of every "pick players for a future match" list and out of the app-level team access. C adds a small leave guard (React context + `GuardedLink`) used by the header and sign out, and a static `public/offline.html` served by the Serwist service worker when a page can't load. D appends a player id to the match's `*_available_players` through RxDB, so the existing match replication uploads it.

**Tech Stack:** Next.js 16.3 (App Router), React 19, TypeScript 6, next-intl, RxDB 17.6 (Dexie, memory storage in tests), Supabase, Serwist (`@serwist/turbopack`), Vitest 5, Playwright, pnpm.

**Specs:**
- B: [docs/superpowers/specs/2026-10-13-archive-players-design.md](../specs/2026-10-13-archive-players-design.md)
- C: [docs/superpowers/specs/2026-10-13-leave-live-match-design.md](../specs/2026-10-13-leave-live-match-design.md)
- D: approved in chat on 2026-10-13, summarised here:
  - A late player is an **existing** team member who wasn't ticked in the start dialog. Adding them appends their id to the match's `home_available_players` / `away_available_players` (the managed team's side) with an RxDB update; the match replication uploads it, so it works offline.
  - Candidates: the managed team's members from RxDB `team_members`, not archived, not already in the roster.
  - Entry points: an **Add late player** button in the Events panel; a "Player not listed? Add from team…" link under the substitution "player in" select (the added player is pre-selected) and under the player picker of the set lineup setup (the added player is selected).
  - Blocked while `scoringBlocked` (claim lost, prompt open, refreshing). Not on the undo stack.
  - `PlayerReplacementDialog` (`components/matches/live/player-replacement-dialog.tsx`) is only used by `ScoreBoard`, which no screen renders, so it gets no entry point.

Item A (sidebar caret) is already done on this branch (`5daab28`).

## Global Constraints

- Branch: `fix/live-match-usability`. Commit after every task; end every commit message with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Every new UI string exists in `messages/en`, `fr`, `es`, `it` and `pt` with the same keys (guarded by `tests/unit/i18n/locale-parity.test.ts` from Task 5 on).
- No `DB_GENERATION` bump. The local player schema goes to `version: 1` with a migration strategy.
- Live match writes go to RxDB only (`useLocalDb`); never call the API layer from the live page.
- No hard delete of team members from the UI.
- Browser/Android Back is **not** intercepted.
- The Supabase project `gvtjccisbwrwpjtabnyd` is shared with production: apply the migration only after the user says yes.
- Unit tests: `pnpm test` (Vitest, `tests/unit/**/*.test.ts`, node environment).
- E2E: `pnpm build && pnpm start -p 3100` (in the background), then `CI=1 BASE_URL=http://localhost:3100 pnpm test:e2e <specs>`. Specs depend on `01-teams.spec.ts` (fixture team), so always run `tests/e2e/01-teams.spec.ts` first in the same command. After a run, `git checkout -- tests/fixtures/test-data.json` (the specs rewrite it). On Windows, stopping the background `pnpm start` can leave the Node process holding port 3100: before each restart run `netstat -ano | grep ":3100 " | grep LISTEN` and `taskkill //PID <pid> //F //T` if needed. Rebuild after every source change before an e2e run.
- Lint: the repo has pre-existing lint errors. Run `npx eslint <files you touched>` and add no new errors or warnings compared with `git stash`ed code.

## Review Focus

1. **A player tapped twice in the late-player picker** (double tap on a phone): the roster holds the id once. Pinned by `withLatePlayer` unit tests (Task 9).
2. **Every team member already in the roster** when the late-player picker opens: it says so instead of showing an empty grid or crashing. Pinned by `latePlayerCandidates` unit tests (Task 9) and the "nobody left" step of `04h-late-player.spec.ts` (Task 10).
3. **An archived player who played in past matches**: still in the report and stats of those matches. Pinned by the `loadMatchReportData` test added in Task 4.
4. **After leaving the live match, other screens navigate freely**: the guard must not stick. Pinned by the "Teams after Leave" step of `04g-leave-live-match.spec.ts` (Task 7).
5. **Offline page opened in a tab with no saved live match**: the button goes back in history, never to `/matches` (which would fail again offline). Pinned by the last step of `04g-leave-live-match.spec.ts` (Task 8).

---

## File Structure

| File | Responsibility | Task |
|---|---|---|
| `supabase/migrations/20261013000000_team_members_archived_at.sql` | Server column | 1 |
| `lib/supabase/database.types.ts`, `lib/types.ts` | `archived_at` types | 1 |
| `lib/rxdb/schema.ts`, `lib/rxdb/collections.ts` | Player schema v1 + migration | 2 |
| `lib/rxdb/sync/reference-sync.ts` | Versioned reference replication identifiers | 3 |
| `lib/api/users.ts`, `lib/report/access.ts`, `lib/report/can-export.ts` | App-level access ignores archived memberships | 4 |
| `components/players/player-table.tsx` | Archive / restore / show archived | 5 |
| `app/teams/[id]/page.tsx`, `components/matches/match-start-dialog.tsx`, `components/matches/match-lineup-setup.tsx` | Hide archived; selected count | 6 |
| `components/providers/leave-guard-provider.tsx` | Guard state, shared dialog, hooks | 7 |
| `components/guarded-link.tsx` | `next/link` that asks first | 7 |
| `components/navigation.tsx`, `app/layout.tsx`, `app/matches/[id]/live/page.tsx` | Use the guard | 7, 8, 10 |
| `public/offline.html`, `app/sw.ts` | Offline fallback page | 8 |
| `lib/matches/late-players.ts` | Pure roster helpers | 9 |
| `components/matches/live/late-player-dialog.tsx` | Picker | 10 |
| `components/matches/live/panels/events-panel.tsx`, `components/matches/live/events/event-form.tsx`, `components/sets/set-setup.tsx` | Entry points | 10 |
| `tests/unit/...`, `tests/e2e/...`, `tests/helpers/match-setup.ts` | Tests | all |

---

## Part B: Archive players

### Task 1: `archived_at` column and types

**Files:**
- Create: `supabase/migrations/20261013000000_team_members_archived_at.sql`
- Modify: `lib/supabase/database.types.ts` (the `team_members` Row/Insert/Update blocks)
- Modify: `lib/types.ts:93-104` (`TeamMember`)
- Modify: `.claude/docs/05-database-schema.md:21`

**Interfaces:**
- Produces: `TeamMember.archived_at?: string | null` (null or absent = active; ISO timestamp = archived). Server column `team_members.archived_at timestamptz NULL`.

- [ ] **Step 1: Write the migration**

```sql
-- Archived members are hidden from rosters and match setup and lose app-level team access,
-- but stay referenced by past matches (player_stats, events, score_points, match rosters).
ALTER TABLE team_members ADD COLUMN archived_at timestamptz NULL;

COMMENT ON COLUMN team_members.archived_at IS
  'When the member was archived: hidden from rosters and match setup, kept in past matches, no team access in the app. NULL = active.';
```

- [ ] **Step 2: Ask the user, then apply it**

Ask: "Task 1 adds a nullable `team_members.archived_at` column to the shared Supabase project (production). Old app versions ignore unknown columns. Apply now?" Only after a yes, apply it with the Supabase MCP tool `apply_migration` (project `gvtjccisbwrwpjtabnyd`, name `team_members_archived_at`, the SQL above).

Verify with `execute_sql`:
```sql
SELECT column_name, data_type, is_nullable FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'team_members' AND column_name = 'archived_at';
```
Expected: one row, `timestamp with time zone`, `YES`.

- [ ] **Step 3: Update the generated types**

Run: `pnpm supabase:types`. If the CLI isn't logged in, use the Supabase MCP tool `generate_typescript_types` and write its output to `lib/supabase/database.types.ts`, or add the field by hand in the three `team_members` blocks (alphabetical order, after `_modified`/before `avatar_url`):
- `Row`: `archived_at: string | null`
- `Insert`: `archived_at?: string | null`
- `Update`: `archived_at?: string | null`

Check the diff: only `archived_at` lines may change (a full regeneration on this branch must not drop `voice_vocabulary` or other tables other branches rely on; if it does, keep only the `archived_at` lines).

- [ ] **Step 4: Add the field to `TeamMember`**

In `lib/types.ts`, inside `export type TeamMember = { ... }`, after `comments?: string | null;`:
```ts
  /** When the member was archived (hidden from rosters and match setup); null or absent when active. */
  archived_at?: string | null;
```

- [ ] **Step 5: Document the column**

In `.claude/docs/05-database-schema.md`, replace the `team_members` row of the table with:
```markdown
| `team_members` | Players and staff (`role`: owner, coach, staff, player; jersey `number`, `position`, `avatar_url`; `archived_at`: archived members are hidden from rosters and match setup and lose team access in the app, null when active) | `team_id` → teams, `user_id` → auth user (optional) |
```

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit -p .`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/20261013000000_team_members_archived_at.sql lib/supabase/database.types.ts lib/types.ts .claude/docs/05-database-schema.md
git commit -m "feat(players): team_members.archived_at column"
```

---

### Task 2: Player schema version 1, migrated in place

**Files:**
- Modify: `lib/rxdb/schema.ts:189-224` (`playerSchema`)
- Modify: `lib/rxdb/collections.ts` (plugin + migration strategy)
- Test: `tests/unit/sync/player-schema-migration.test.ts` (create)

**Interfaces:**
- Consumes: `TeamMember.archived_at` (Task 1).
- Produces: `playerSchema.version === 1` with property `archived_at`; `team_members` documents always carry `archived_at` (`null` when active).

- [ ] **Step 1: Write the failing test**

Create `tests/unit/sync/player-schema-migration.test.ts`:
```ts
import { randomUUID } from "node:crypto";
import { createRxDatabase } from "rxdb";
import { getRxStorageMemory } from "rxdb/plugins/storage-memory";
import { wrappedValidateAjvStorage } from "rxdb/plugins/validate-ajv";
import { describe, expect, it } from "vitest";
import { setupCollections, type DatabaseCollections } from "@/lib/rxdb/collections";
import { playerSchema } from "@/lib/rxdb/schema";

// One storage object for both opens: memory storage keeps a database's data per storage object.
const storage = getRxStorageMemory();
const open = (name: string) =>
  createRxDatabase<DatabaseCollections>({
    name,
    storage: wrappedValidateAjvStorage({ storage }),
    multiInstance: false,
    localDocuments: true,
    allowSlowCount: true,
  });

// The player schema as devices have it before this change.
const { archived_at: _archived, ...legacyProperties } = playerSchema.properties;
const LEGACY_PLAYER_SCHEMA = { ...playerSchema, version: 0, properties: legacyProperties };

const NOW = "2026-10-13T10:00:00.000Z";
const PLAYER_ID = "10000000-0000-4000-8000-000000000003";
const TEAM_ID = "10000000-0000-4000-8000-000000000001";

describe("player schema migration", () => {
  it("keeps the players of a version-0 database, with archived_at null", async () => {
    const name = `migration_${randomUUID().replace(/-/g, "")}`;
    const before = await open(name);
    await before.addCollections({ team_members: { schema: LEGACY_PLAYER_SCHEMA as any } });
    await before.team_members.insert({
      id: PLAYER_ID,
      team_id: TEAM_ID,
      user_id: null,
      name: "Player 7",
      number: 7,
      role: "player",
      position: null,
      comments: null,
      avatar_url: null,
      voice_aliases: [],
      created_at: NOW,
      updated_at: NOW,
    } as any);
    await before.close();

    const after = await open(name);
    await setupCollections(after);
    const doc = await after.team_members.findOne(PLAYER_ID).exec();
    expect(doc?.toJSON()).toMatchObject({ id: PLAYER_ID, name: "Player 7", number: 7, archived_at: null });
    await after.close();
  });

  it("stores archived_at on new players", async () => {
    const db = await open(`fresh_${randomUUID().replace(/-/g, "")}`);
    await setupCollections(db);
    await db.team_members.insert({
      id: PLAYER_ID, team_id: TEAM_ID, user_id: null, name: "Player 7", number: 7, role: "player",
      position: null, comments: null, avatar_url: null, voice_aliases: [], archived_at: NOW,
      created_at: NOW, updated_at: NOW,
    } as any);
    expect((await db.team_members.findOne(PLAYER_ID).exec())?.toJSON().archived_at).toBe(NOW);
    await db.close();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm test tests/unit/sync/player-schema-migration.test.ts`
Expected: FAIL. The second test fails schema validation (`archived_at` is not an allowed property); the first fails because `archived_at` is missing (or with an RxDB schema error once the property exists without a version bump).

- [ ] **Step 3: Bump the player schema**

In `lib/rxdb/schema.ts`, in `playerSchema`: change `version: 0,` to
```ts
  version: 1, // 1: archived_at (migrationStrategies in collections.ts)
```
and add, after the `voice_aliases` property:
```ts
    archived_at: { type: ["string", "null"] },
```
(`archived_at` is not added to `required`.)

- [ ] **Step 4: Register the migration**

In `lib/rxdb/collections.ts`:
- add `import { RxDBMigrationSchemaPlugin } from "rxdb/plugins/migration-schema";` with the other plugin imports, and `addRxPlugin(RxDBMigrationSchemaPlugin);` after `addRxPlugin(RxDBLocalDocumentsPlugin);`
- replace `team_members: { schema: playerSchema },` in `setupCollections` with:
```ts
    team_members: {
      schema: playerSchema,
      // Devices that pulled players before archived_at existed: active until the re-pull says otherwise.
      migrationStrategies: { 1: (doc: any) => ({ ...doc, archived_at: null }) },
    },
```

- [ ] **Step 5: Run the tests**

Run: `pnpm test tests/unit/sync/player-schema-migration.test.ts`
Expected: PASS (2 tests).

Run: `pnpm test`
Expected: all unit tests PASS (the fake server's `team_members` columns now include `archived_at`, which is harmless).

- [ ] **Step 6: Commit**

```bash
git add lib/rxdb/schema.ts lib/rxdb/collections.ts tests/unit/sync/player-schema-migration.test.ts
git commit -m "feat(rxdb): player schema v1 with archived_at, migrated in place"
```

---

### Task 3: Reference replications restart after a schema change

**Files:**
- Modify: `lib/rxdb/sync/reference-sync.ts:18-28` (new exported function) and `:74` (use it)
- Test: `tests/unit/sync/reference-sync.test.ts` (create)
- Modify: `.claude/docs/04-offline-sync.md` ("What gets synced" section)

**Interfaces:**
- Produces: `referenceReplicationIdentifier(table: string, schemaVersion: number, userId: string, values: readonly string[]): string`.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/sync/reference-sync.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { filterKey, referenceReplicationIdentifier } from "@/lib/rxdb/sync/reference-sync";
import { createTestDb } from "../helpers/test-db";

describe("referenceReplicationIdentifier", () => {
  it("names the table, the schema version, the user and the filter", () => {
    expect(referenceReplicationIdentifier("team_members", 1, "user-1", ["b", "a"])).toBe(
      `sync2_team_members_v1_user-1_${filterKey(["a", "b"])}`
    );
  });

  it("changes when the collection's schema version changes, so the table is pulled again in full", () => {
    const before = referenceReplicationIdentifier("team_members", 0, "user-1", ["team"]);
    const after = referenceReplicationIdentifier("team_members", 1, "user-1", ["team"]);
    expect(after).not.toBe(before);
  });

  it("uses the version of the collection's schema", async () => {
    const { db } = await createTestDb();
    expect(db.team_members.schema.version).toBe(1);
    await db.close();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm test tests/unit/sync/reference-sync.test.ts`
Expected: FAIL with `referenceReplicationIdentifier is not a function` (or an import error).

- [ ] **Step 3: Implement**

In `lib/rxdb/sync/reference-sync.ts`, after `filterKey`:
```ts
/**
 * Replication identifier of a reference table. It contains the collection's schema version: after a schema
 * bump the old checkpoint would skip rows changed before the device knew the new columns, so a new
 * identifier makes the table pull again in full once.
 */
export function referenceReplicationIdentifier(
  table: string,
  schemaVersion: number,
  userId: string,
  values: readonly string[]
): string {
  return `sync2_${table}_v${schemaVersion}_${userId}_${filterKey(values)}`;
}
```
and in `startStates`, replace
```ts
        replicationIdentifier: `sync2_${table}_${user.id}_${filterKey(values)}`,
```
with
```ts
        replicationIdentifier: referenceReplicationIdentifier(table, this.deps.db[table].schema.version, user.id, values),
```

- [ ] **Step 4: Run the tests**

Run: `pnpm test`
Expected: all PASS.

- [ ] **Step 5: Document the rule**

In `.claude/docs/04-offline-sync.md`, under "### What gets synced", after the "Reference tables" bullet, add:
```markdown
- Reference replication identifiers are `sync2_<table>_v<schema version>_<user>_<filter>`. A schema bump of a reference collection therefore starts a fresh checkpoint and pulls the table again in full once, so rows changed on the server before the device knew the new columns are not missed. A schema change of any synced collection needs a `version` bump with a `migrationStrategies` entry (`collections.ts`, `RxDBMigrationSchemaPlugin`), never a `DB_GENERATION` bump.
```

- [ ] **Step 6: Commit**

```bash
git add lib/rxdb/sync/reference-sync.ts tests/unit/sync/reference-sync.test.ts .claude/docs/04-offline-sync.md
git commit -m "feat(sync): reference replication identifiers carry the schema version"
```

---

### Task 4: Archived memberships give no team access in the app

**Files:**
- Modify: `lib/api/users.ts:150-163` (`getTeamMembers`)
- Modify: `lib/report/access.ts:15-16`
- Modify: `lib/report/can-export.ts:20-23`
- Test: `tests/unit/report/load-access.test.ts`

**Interfaces:**
- Consumes: `TeamMember.archived_at` (Task 1), fake server column `archived_at` (Task 2).

- [ ] **Step 1: Write the failing tests**

In `tests/unit/report/load-access.test.ts`:

In `describe("loadMatchReportData", ...)` add:
```ts
  it("keeps archived members: past matches still show who played", async () => {
    server.editAsWebsite("team_members", "player-1", { archived_at: NEW });
    const { data } = await loadMatchReportData(server.client(), MATCH);
    expect(data.members.map((m) => m.id)).toContain("player-1");
  });
```

In `describe("checkReportAccess", ...)` add:
```ts
  it("refuses archived members, unless they created the team or run its club", async () => {
    server.seedAt("team_members", { id: "member-archived", team_id: HOME, name: "Archived", number: 6, role: "coach", user_id: "archived", archived_at: NEW }, OLD);
    server.seedAt("team_members", { id: "creator-archived", team_id: HOME, name: "Creator", number: 5, role: "owner", user_id: "creator", archived_at: NEW }, OLD);
    expect(await check("archived")).toBe("forbidden");
    expect(await check("creator")).toBe("allowed");
  });
```

In `describe("canExportForTeam", ...)`, in `it("mirrors the server rule ...")` add:
```ts
    expect(canExportForTeam({ id: "member", teamMembers: [membership({ archived_at: NEW })] }, team)).toBe(false);
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm test tests/unit/report/load-access.test.ts`
Expected: the `checkReportAccess` archived test FAILS (`allowed` instead of `forbidden`) and the `canExportForTeam` assertion FAILS (`true`). The `loadMatchReportData` test already passes (it pins current behaviour).

- [ ] **Step 3: Implement**

`lib/report/access.ts`, replace the memberships lines with:
```ts
  const memberships = live(
    await rows(supabase.from("team_members").select("id, _deleted, archived_at").eq("team_id", teamId).eq("user_id", userId))
  ).filter((member) => !member.archived_at);
  if (memberships.length > 0) return "allowed";
```
and update the doc comment's first sentence to: `a member of the team (not archived), its creator, or an owner/admin of its club.`

`lib/report/can-export.ts`, replace the `isMember` expression with:
```ts
  const isMember = (user.teamMembers ?? []).some(
    (m) =>
      m.team_id === team.id &&
      m.id !== m.team_id &&
      (m as { _deleted?: boolean })._deleted !== true &&
      !m.archived_at
  );
```

`lib/api/users.ts`, in `getTeamMembers`, replace
```ts
    .select('*, teams(*)')
    .eq('user_id', userId);
```
with
```ts
    .select('*, teams(*)')
    .eq('user_id', userId)
    // Archived memberships give no access: the team drops out of the user's teams (and of their sync).
    .is('archived_at', null);
```

- [ ] **Step 4: Run the tests**

Run: `pnpm test`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/api/users.ts lib/report/access.ts lib/report/can-export.ts tests/unit/report/load-access.test.ts
git commit -m "feat(players): archived memberships give no team access in the app"
```

---

### Task 5: Archive and restore on the players page

**Files:**
- Modify: `components/players/player-table.tsx` (whole component)
- Modify: `messages/{en,fr,es,it,pt}/players.json`
- Test: `tests/unit/i18n/locale-parity.test.ts` (create)
- Test: `tests/e2e/01b-player-archive.spec.ts` (create)

**Interfaces:**
- Consumes: `TeamMember.archived_at` (Task 1), `useTeamMembersApi().updateTeamMember(id, updates)` (existing), `useAuth().user?.id` (existing).
- Produces: test ids `player-row`, `archived-player-row`; buttons with aria-labels `Archive {name}` / `Restore {name}`; fixture field `archivedPlayerName` (`"Player 9"`), used by Tasks 6 and 11.

- [ ] **Step 1: Write the failing translation test**

Create `tests/unit/i18n/locale-parity.test.ts`:
```ts
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(process.cwd(), "messages");
const LOCALES = ["en", "fr", "es", "it", "pt"];

/** Keys this branch adds; every language must have them. */
const REQUIRED_KEYS: Record<string, string[]> = {
  "players.json": [
    "archive.action",
    "archive.ariaLabel",
    "archive.confirmTitle",
    "archive.confirmDesc",
    "archive.loseAccess",
    "archive.restoreAriaLabel",
    "archive.showArchived",
    "archive.hideArchived",
    "archive.badge",
    "toast.archived",
    "toast.archivedDesc",
    "toast.restored",
    "toast.restoredDesc",
    "toast.archiveError",
    "toast.restoreError",
  ],
};

const flatten = (value: unknown, prefix = ""): string[] =>
  value && typeof value === "object"
    ? Object.entries(value as Record<string, unknown>).flatMap(([key, child]) => flatten(child, `${prefix}${key}.`))
    : [prefix.slice(0, -1)];

const keysOf = (locale: string, file: string) =>
  flatten(JSON.parse(fs.readFileSync(path.join(ROOT, locale, file), "utf-8"))).sort();

describe("translations", () => {
  const files = fs.readdirSync(path.join(ROOT, "en")).filter((file) => file.endsWith(".json"));

  for (const file of files) {
    it(`${file} has the same keys in every language`, () => {
      const english = keysOf("en", file);
      for (const locale of LOCALES.slice(1)) expect(keysOf(locale, file), locale).toEqual(english);
    });
  }

  for (const [file, keys] of Object.entries(REQUIRED_KEYS)) {
    it(`${file} has this branch's keys`, () => {
      const english = new Set(keysOf("en", file));
      expect(keys.filter((key) => !english.has(key))).toEqual([]);
    });
  }
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm test tests/unit/i18n/locale-parity.test.ts`
Expected: the parity tests PASS, `players.json has this branch's keys` FAILS listing the 15 keys.

- [ ] **Step 3: Add the translations**

In each `messages/<lang>/players.json`, add a top-level `"archive"` object and the new `"toast"` keys (keep every existing key):

`en`:
```json
"archive": {
  "action": "Archive",
  "ariaLabel": "Archive {name}",
  "confirmTitle": "Archive {name}?",
  "confirmDesc": "They'll be hidden from rosters and match setup, but kept in past stats and reports. You can restore them later.",
  "loseAccess": "They'll also lose access to this team.",
  "restoreAriaLabel": "Restore {name}",
  "showArchived": "Show archived ({count})",
  "hideArchived": "Hide archived",
  "badge": "Archived"
}
```
toast: `"archived": "Player archived"`, `"archivedDesc": "{name} is hidden from rosters."`, `"restored": "Player restored"`, `"restoredDesc": "{name} is back in the roster."`, `"archiveError": "Failed to archive player. Please try again."`, `"restoreError": "Failed to restore player. Please try again."`

`fr`:
```json
"archive": {
  "action": "Archiver",
  "ariaLabel": "Archiver {name}",
  "confirmTitle": "Archiver {name} ?",
  "confirmDesc": "Ce membre sera masqué des effectifs et de la préparation des matchs, mais conservé dans les statistiques et rapports passés. Vous pourrez le restaurer plus tard.",
  "loseAccess": "Ce membre perdra aussi l'accès à cette équipe.",
  "restoreAriaLabel": "Restaurer {name}",
  "showArchived": "Afficher les archivés ({count})",
  "hideArchived": "Masquer les archivés",
  "badge": "Archivé"
}
```
toast: `"archived": "Joueur archivé"`, `"archivedDesc": "{name} est masqué des effectifs."`, `"restored": "Joueur restauré"`, `"restoredDesc": "{name} est de retour dans l'effectif."`, `"archiveError": "Échec de l'archivage du joueur. Veuillez réessayer."`, `"restoreError": "Échec de la restauration du joueur. Veuillez réessayer."`

`es`:
```json
"archive": {
  "action": "Archivar",
  "ariaLabel": "Archivar a {name}",
  "confirmTitle": "¿Archivar a {name}?",
  "confirmDesc": "Se ocultará de las plantillas y de la preparación de partidos, pero se conservará en las estadísticas e informes anteriores. Podrás restaurarlo más tarde.",
  "loseAccess": "También perderá el acceso a este equipo.",
  "restoreAriaLabel": "Restaurar a {name}",
  "showArchived": "Mostrar archivados ({count})",
  "hideArchived": "Ocultar archivados",
  "badge": "Archivado"
}
```
toast: `"archived": "Jugador archivado"`, `"archivedDesc": "{name} está oculto en las plantillas."`, `"restored": "Jugador restaurado"`, `"restoredDesc": "{name} vuelve a la plantilla."`, `"archiveError": "No se pudo archivar al jugador. Inténtalo de nuevo."`, `"restoreError": "No se pudo restaurar al jugador. Inténtalo de nuevo."`

`it`:
```json
"archive": {
  "action": "Archivia",
  "ariaLabel": "Archivia {name}",
  "confirmTitle": "Archiviare {name}?",
  "confirmDesc": "Verrà nascosto dalle rose e dalla preparazione delle partite, ma resterà nelle statistiche e nei report passati. Potrai ripristinarlo in seguito.",
  "loseAccess": "Perderà anche l'accesso a questa squadra.",
  "restoreAriaLabel": "Ripristina {name}",
  "showArchived": "Mostra archiviati ({count})",
  "hideArchived": "Nascondi archiviati",
  "badge": "Archiviato"
}
```
toast: `"archived": "Giocatore archiviato"`, `"archivedDesc": "{name} è nascosto dalle rose."`, `"restored": "Giocatore ripristinato"`, `"restoredDesc": "{name} è di nuovo in rosa."`, `"archiveError": "Impossibile archiviare il giocatore. Riprova."`, `"restoreError": "Impossibile ripristinare il giocatore. Riprova."`

`pt`:
```json
"archive": {
  "action": "Arquivar",
  "ariaLabel": "Arquivar {name}",
  "confirmTitle": "Arquivar {name}?",
  "confirmDesc": "Será ocultado dos plantéis e da preparação de jogos, mas mantido nas estatísticas e relatórios anteriores. Poderá restaurá-lo mais tarde.",
  "loseAccess": "Também perderá o acesso a esta equipa.",
  "restoreAriaLabel": "Restaurar {name}",
  "showArchived": "Mostrar arquivados ({count})",
  "hideArchived": "Ocultar arquivados",
  "badge": "Arquivado"
}
```
toast: `"archived": "Jogador arquivado"`, `"archivedDesc": "{name} está oculto dos plantéis."`, `"restored": "Jogador restaurado"`, `"restoredDesc": "{name} está de volta ao plantel."`, `"archiveError": "Não foi possível arquivar o jogador. Tente novamente."`, `"restoreError": "Não foi possível restaurar o jogador. Tente novamente."`

Run: `pnpm test tests/unit/i18n/locale-parity.test.ts`
Expected: PASS.

- [ ] **Step 4: Write the failing e2e spec**

Create `tests/e2e/01b-player-archive.spec.ts`:
```ts
/**
 * Archiving a player hides them from the roster; "Show archived" lists them; restoring brings them back.
 * Leaves "Player 9" archived for the specs that follow (02 checks the start dialog, 04h the late-player picker).
 */
import { test, expect, type Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const FIXTURE_PATH = path.join(__dirname, '../fixtures/test-data.json');
const ARCHIVED = 'Player 9';

function loadFixture(): { teamName: string; [key: string]: unknown } {
  return JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf-8'));
}

function saveFixture(data: Record<string, unknown>): void {
  fs.writeFileSync(FIXTURE_PATH, JSON.stringify({ ...loadFixture(), ...data }, null, 2));
}

async function openPlayersPage(page: Page, teamName: string): Promise<string> {
  await page.goto('/teams');
  await page.getByRole('button', { name: 'New Team' }).waitFor({ state: 'visible', timeout: 30_000 });
  const searchBox = page.getByPlaceholder('Search by team name...');
  if (!(await searchBox.isVisible().catch(() => false))) {
    await page.getByRole('button', { name: 'Filters' }).click();
    await searchBox.waitFor({ state: 'visible', timeout: 10_000 });
  }
  await searchBox.fill(teamName);
  await page.waitForTimeout(600); // 500 ms search debounce
  // Desktop table buttons: 0=Eye, 1=Players, 2=Edit, 3=Delete
  await page.getByRole('row').filter({ hasText: teamName }).getByRole('button').nth(1).click();
  await page.waitForURL(/\/teams\/.+\/players/, { timeout: 10_000 });
  return page.url().match(/\/teams\/([^/]+)\/players/)![1];
}

test('archive and restore a player', async ({ page }) => {
  const { teamName } = loadFixture();
  expect(teamName, 'Team fixture not found — run 01-teams.spec.ts first').toBeTruthy();
  const teamId = await openPlayersPage(page, teamName);

  // A ninth player
  await page.getByRole('button', { name: 'New Player' }).click();
  await page.getByLabel('Name').fill(ARCHIVED);
  await page.getByLabel('Number').fill('9');
  await page.getByRole('button', { name: 'Create Player' }).click();
  await expect(page.getByText('Player created').first()).toBeVisible({ timeout: 5_000 });
  const activeRow = page.getByTestId('player-row').filter({ hasText: ARCHIVED });
  await expect(activeRow).toBeVisible();

  // The creator's own membership row (role Owner) can't be archived
  for (const ownRow of await page.getByTestId('player-row').filter({ hasText: 'Owner' }).all()) {
    await expect(ownRow.getByRole('button', { name: /^Archive / })).toHaveCount(0);
  }

  // Archive: gone from the active list
  await page.getByRole('button', { name: `Archive ${ARCHIVED}` }).click();
  const confirm = page.getByRole('alertdialog');
  await expect(confirm).toContainText(`Archive ${ARCHIVED}?`);
  await confirm.getByRole('button', { name: 'Archive' }).click();
  await expect(page.getByText('Player archived').first()).toBeVisible({ timeout: 5_000 });
  await expect(activeRow).toHaveCount(0);

  // Show archived: listed with the badge and a Restore button
  await page.getByRole('button', { name: 'Show archived (1)' }).click();
  const archivedRow = page.getByTestId('archived-player-row').filter({ hasText: ARCHIVED });
  await expect(archivedRow).toContainText('Archived');

  // Restore: back in the active list
  await page.getByRole('button', { name: `Restore ${ARCHIVED}` }).click();
  await expect(page.getByText('Player restored').first()).toBeVisible({ timeout: 5_000 });
  await expect(activeRow).toBeVisible();

  // Archive again for the next specs, and check the team page count leaves them out
  await page.getByRole('button', { name: `Archive ${ARCHIVED}` }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Archive' }).click();
  await expect(activeRow).toHaveCount(0);
  const activeCount = await page.getByTestId('player-row').count();
  await page.goto(`/teams/${teamId}`);
  await expect(page.getByText(`Team Members (${activeCount})`)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('cell', { name: ARCHIVED, exact: true })).toHaveCount(0);

  saveFixture({ archivedPlayerName: ARCHIVED });
});
```

- [ ] **Step 5: Run it to verify it fails**

Build and start the server (Global Constraints), then:
Run: `CI=1 BASE_URL=http://localhost:3100 pnpm test:e2e tests/e2e/01-teams.spec.ts tests/e2e/01b-player-archive.spec.ts`
Expected: 01b FAILS at `getByTestId('player-row')` (no such test id yet).

- [ ] **Step 6: Implement the players table**

Replace `components/players/player-table.tsx` with:
```tsx
"use client";

import { useState } from "react";
import { Archive, ArchiveRestore, Pencil } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { TeamMember } from "@/lib/types";
import { useTranslations } from "next-intl";
import { useTeamMembersApi } from "@/hooks/use-team-members-api";
import { useAuth } from "@/contexts/auth-context";
import { cn } from "@/lib/utils";

type PlayerTableProps = {
  players: TeamMember[];
  onEdit: (player: TeamMember) => void;
  onPlayersChange: (players: TeamMember[]) => void;
};

/**
 * Members of a team. Members are archived, never deleted: past matches reference them. Archived members
 * are listed on demand and can be restored. Nobody can archive their own membership.
 */
export function PlayerTable({ players, onEdit, onPlayersChange }: PlayerTableProps) {
  const t = useTranslations("players");
  const tc = useTranslations("common");
  const te = useTranslations("enums");
  const teamMemberApi = useTeamMembersApi();
  const { toast } = useToast();
  const { user } = useAuth();
  const [archivePlayer, setArchivePlayer] = useState<TeamMember | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  const activePlayers = players.filter((player) => !player.archived_at);
  const archivedPlayers = players.filter((player) => !!player.archived_at);

  const setArchivedAt = async (player: TeamMember, archivedAt: string | null) => {
    const updated = await teamMemberApi.updateTeamMember(player.id, { archived_at: archivedAt });
    onPlayersChange(players.map((p) => (p.id === player.id ? { ...p, ...updated } : p)));
  };

  const handleArchive = async () => {
    if (!archivePlayer) return;
    setIsSaving(true);
    try {
      await setArchivedAt(archivePlayer, new Date().toISOString());
      toast({ title: t("toast.archived"), description: t("toast.archivedDesc", { name: archivePlayer.name }) });
    } catch (error) {
      console.error("Failed to archive player:", error);
      toast({ variant: "destructive", title: t("toast.error"), description: t("toast.archiveError") });
    } finally {
      setIsSaving(false);
      setArchivePlayer(null);
    }
  };

  const handleRestore = async (player: TeamMember) => {
    setIsSaving(true);
    try {
      await setArchivedAt(player, null);
      toast({ title: t("toast.restored"), description: t("toast.restoredDesc", { name: player.name }) });
    } catch (error) {
      console.error("Failed to restore player:", error);
      toast({ variant: "destructive", title: t("toast.error"), description: t("toast.restoreError") });
    } finally {
      setIsSaving(false);
    }
  };

  const isOwnMembership = (player: TeamMember) => !!player.user_id && player.user_id === user?.id;

  const renderRow = (player: TeamMember, archived: boolean) => (
    <TableRow
      key={player.id}
      data-testid={archived ? "archived-player-row" : "player-row"}
      className={cn(archived && "opacity-60")}
    >
      <TableCell>
        <Avatar>
          {player.avatar_url ? (
            <AvatarImage src={player.avatar_url} alt={player.name} />
          ) : (
            <AvatarFallback>{player.name.substring(0, 2).toUpperCase()}</AvatarFallback>
          )}
        </Avatar>
      </TableCell>
      <TableCell>{player.number}</TableCell>
      <TableCell className="font-medium">
        {player.name}
        {archived && (
          <Badge variant="outline" className="ml-2">
            {t("archive.badge")}
          </Badge>
        )}
      </TableCell>
      <TableCell>{player.position ? te(`playerRole.${player.position}`) : ""}</TableCell>
      <TableCell className="capitalize">{te(`teamMemberRole.${player.role}`)}</TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          {archived ? (
            <Button
              variant="ghost"
              size="sm"
              disabled={isSaving}
              onClick={() => void handleRestore(player)}
              aria-label={t("archive.restoreAriaLabel", { name: player.name })}
            >
              <ArchiveRestore className="h-4 w-4" />
            </Button>
          ) : (
            <>
              <Button variant="ghost" size="sm" onClick={() => onEdit(player)} aria-label={`Edit ${player.name}`}>
                <Pencil className="h-4 w-4" />
              </Button>
              {!isOwnMembership(player) && (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={isSaving}
                  onClick={() => setArchivePlayer(player)}
                  aria-label={t("archive.ariaLabel", { name: player.name })}
                >
                  <Archive className="h-4 w-4" />
                </Button>
              )}
            </>
          )}
        </div>
      </TableCell>
    </TableRow>
  );

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("table.avatar")}</TableHead>
            <TableHead>#</TableHead>
            <TableHead>{t("table.name")}</TableHead>
            <TableHead>{t("table.position")}</TableHead>
            <TableHead>{t("table.role")}</TableHead>
            <TableHead className="w-[100px]">{t("table.actions")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {activePlayers.map((player) => renderRow(player, false))}
          {showArchived && archivedPlayers.map((player) => renderRow(player, true))}
        </TableBody>
      </Table>

      {archivedPlayers.length > 0 && (
        <Button variant="ghost" size="sm" className="mt-2" onClick={() => setShowArchived(!showArchived)}>
          {showArchived ? t("archive.hideArchived") : t("archive.showArchived", { count: archivedPlayers.length })}
        </Button>
      )}

      <AlertDialog open={!!archivePlayer} onOpenChange={(open) => !open && setArchivePlayer(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("archive.confirmTitle", { name: archivePlayer?.name ?? "" })}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("archive.confirmDesc")}
              {archivePlayer?.user_id && <> {t("archive.loseAccess")}</>}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tc("actions.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleArchive()} disabled={isSaving}>
              {t("archive.action")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
```

The players page (`app/teams/[id]/players/page.tsx`) keeps loading every member of the team: the table splits active and archived itself.

- [ ] **Step 7: Run the tests**

Run: `npx tsc --noEmit -p .` → no errors. `npx eslint components/players/player-table.tsx` → no new problems.
Rebuild, restart the server, then:
Run: `CI=1 BASE_URL=http://localhost:3100 pnpm test:e2e tests/e2e/01-teams.spec.ts tests/e2e/01b-player-archive.spec.ts`
Expected: PASS. Then `git checkout -- tests/fixtures/test-data.json`.

- [ ] **Step 8: Commit**

```bash
git add components/players/player-table.tsx messages tests/unit/i18n/locale-parity.test.ts tests/e2e/01b-player-archive.spec.ts
git commit -m "feat(players): archive and restore players instead of deleting them"
```

---

### Task 6: Hide archived members from the team page and the start dialog; selected count

**Files:**
- Modify: `app/teams/[id]/page.tsx:98-100` (`memberFilters`)
- Modify: `components/matches/match-start-dialog.tsx:69-75` (`loadTeamPlayers`) and `:183-188` (props)
- Modify: `components/matches/match-lineup-setup.tsx`
- Modify: `messages/{en,fr,es,it,pt}/matches.json` (`matchLineup.selectedCount`)
- Modify: `tests/unit/i18n/locale-parity.test.ts` (`REQUIRED_KEYS`)
- Modify: `tests/helpers/match-setup.ts`, `tests/e2e/02-matches.spec.ts`

**Interfaces:**
- Consumes: fixture `archivedPlayerName` (Task 5).
- Produces: `MatchLineupSetup` prop `minPlayers: number`; test id `lineup-selected-count`; `createAndStartMatch` options `excludePlayers?: string[]`, `absentPlayers?: string[]` and result field `selectedPlayers: number` (used by Task 10).

- [ ] **Step 1: Write the failing tests**

In `tests/unit/i18n/locale-parity.test.ts`, add to `REQUIRED_KEYS`:
```ts
  "matches.json": ["matchLineup.selectedCount"],
```

In `tests/helpers/match-setup.ts`:
- change the import to `import { expect, Page } from '@playwright/test';`
- extend the options and result:
```ts
export interface CreateAndStartMatchOptions {
  teamName: string;
  playerNames: string[];
  awayTeamName?: string;  // defaults to 'Team 1'
  formatName?: string;    // defaults to 'Test (6x6)'
  /** Players left unticked in the start dialog (e.g. a player who arrives late). */
  excludePlayers?: string[];
  /** Players the start dialog must not offer (archived). */
  absentPlayers?: string[];
}

export interface CreateAndStartMatchResult {
  matchId: string;
  /** How many players were ticked: the roster size. */
  selectedPlayers: number;
}
```
- destructure `excludePlayers = []` and `absentPlayers = []` with the other options;
- replace the "Select all players from the lineup toggles" block with:
```ts
  // Tick every offered player except the excluded ones
  const playerToggles = page.getByTestId('lineup-player-toggle');
  await playerToggles.first().waitFor({ state: 'visible', timeout: 10_000 });
  for (const name of absentPlayers) {
    await expect(page.locator(`[data-testid="lineup-player-toggle"][data-player-name="${name}"]`)).toHaveCount(0);
  }
  const toggleCount = await playerToggles.count();
  let selectedPlayers = 0;
  for (let i = 0; i < toggleCount; i++) {
    const toggle = playerToggles.nth(i);
    if (excludePlayers.includes((await toggle.getAttribute('data-player-name')) ?? '')) continue;
    await toggle.click();
    selectedPlayers++;
    await page.waitForTimeout(100);
  }
  await expect(page.getByTestId('lineup-selected-count')).toContainText(`${selectedPlayers} selected`);
```
- return `{ matchId, selectedPlayers }`.

In `tests/e2e/02-matches.spec.ts`, in the main test, replace
```ts
    await createAndStartMatch(page, { teamName, playerNames });
```
with
```ts
    const { archivedPlayerName } = loadFixture() as { archivedPlayerName?: string };
    await createAndStartMatch(page, {
      teamName,
      playerNames,
      absentPlayers: archivedPlayerName ? [archivedPlayerName] : [],
    });
```

Run: `pnpm test tests/unit/i18n/locale-parity.test.ts` → FAILS (`matchLineup.selectedCount` missing).

- [ ] **Step 2: Add the translations**

In `messages/<lang>/matches.json`, inside `"matchLineup"`, add `"selectedCount"`:
- en: `"{count} selected (min {min})"`
- fr: `"{count} sélectionné(s) (min. {min})"`
- es: `"{count} seleccionados (mín. {min})"`
- it: `"{count} selezionati (min. {min})"`
- pt: `"{count} selecionados (mín. {min})"`

Run: `pnpm test tests/unit/i18n/locale-parity.test.ts` → PASS.

- [ ] **Step 3: Implement**

`app/teams/[id]/page.tsx`, replace the `memberFilters` declaration with:
```ts
        const memberFilters: Filter[] = [
          { field: "team_id", operator: "eq", value: id },
          { field: "archived_at", operator: "is", value: null },
        ];
```

`components/matches/match-start-dialog.tsx`, in `loadTeamPlayers`, after `playerFilters.push({ field: "team_id", ... });` add:
```ts
      playerFilters.push({ field: "archived_at", operator: "is", value: null });
```
and pass the minimum to the lineup setup:
```tsx
              <MatchLineupSetup
                match={match}
                players={players}
                availablePlayers={availablePlayers}
                setAvailablePlayers={setAvailablePlayers}
                minPlayers={minPlayers}
              />
```

`components/matches/match-lineup-setup.tsx`:
- add `minPlayers: number` to `MatchSetupProps` and to the destructured props;
- add `import { cn } from "@/lib/utils";`
- replace the description paragraph
```tsx
        <p className="text-sm text-muted-foreground mb-4">{t("matchLineup.description")}</p>
```
with
```tsx
        <div className="flex items-baseline justify-between gap-4 mb-4">
          <p className="text-sm text-muted-foreground">{t("matchLineup.description")}</p>
          <p
            data-testid="lineup-selected-count"
            className={cn(
              "text-sm font-medium shrink-0",
              availablePlayers.length < minPlayers ? "text-destructive" : "text-muted-foreground"
            )}
          >
            {t("matchLineup.selectedCount", { count: availablePlayers.length, min: minPlayers })}
          </p>
        </div>
```

- [ ] **Step 4: Run the tests**

Run: `npx tsc --noEmit -p .` and `pnpm test` → PASS.
Rebuild, restart, then:
Run: `CI=1 BASE_URL=http://localhost:3100 pnpm test:e2e tests/e2e/01-teams.spec.ts tests/e2e/01b-player-archive.spec.ts tests/e2e/02-matches.spec.ts`
Expected: PASS (02 checks Player 9 isn't offered and the count line). Then `git checkout -- tests/fixtures/test-data.json`.

- [ ] **Step 5: Commit**

```bash
git add "app/teams/[id]/page.tsx" components/matches/match-start-dialog.tsx components/matches/match-lineup-setup.tsx messages tests/unit/i18n/locale-parity.test.ts tests/helpers/match-setup.ts tests/e2e/02-matches.spec.ts
git commit -m "feat(players): archived members leave the team page and match setup; show the selected count"
```

---

## Part C: Leaving the live match

### Task 7: Leave guard for the header and sign out

**Files:**
- Create: `components/providers/leave-guard-provider.tsx`
- Create: `components/guarded-link.tsx`
- Modify: `app/layout.tsx` (mount the provider)
- Modify: `components/navigation.tsx` (links, logo, sign out)
- Modify: `app/matches/[id]/live/page.tsx` (turn the guard on)
- Modify: `messages/{en,fr,es,it,pt}/matches.json` (`liveGuard`)
- Modify: `tests/unit/i18n/locale-parity.test.ts`
- Test: `tests/e2e/04g-leave-live-match.spec.ts` (create)
- Test: `tests/e2e/04f-sign-out-warning.spec.ts`

**Interfaces:**
- Produces (from `components/providers/leave-guard-provider.tsx`):
  - `type LeaveDecision = "free" | "leave" | "stay"`
  - `LeaveGuardProvider({ children })`
  - `useLeaveGuard(options: { active: boolean; unsentCount: number }): void`
  - `useConfirmLeave(): { isActive: () => boolean; confirmLeave: () => Promise<LeaveDecision> }`
  - `LAST_LIVE_MATCH_KEY = "volleystats:last-live-match"` (used in Task 8)
- Produces: `GuardedLink` (same props as `next/link`, `href: string`). Test id `leave-live-dialog`.

- [ ] **Step 1: Write the failing tests**

In `tests/unit/i18n/locale-parity.test.ts`, extend the `"matches.json"` entry of `REQUIRED_KEYS`:
```ts
  "matches.json": [
    "matchLineup.selectedCount",
    "liveGuard.title",
    "liveGuard.body",
    "liveGuard.unsent",
    "liveGuard.stay",
    "liveGuard.leave",
  ],
```

Create `tests/e2e/04g-leave-live-match.spec.ts`:
```ts
/**
 * Leaving a live match through the app asks first. Offline, a screen that can't load shows the
 * app's offline page instead of the browser's error page (Task 8 adds those steps).
 */
import { test, expect, type Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { createAndStartMatch } from '../helpers/match-setup';
import { setupCourtPositions } from '../helpers/court';
import { goOffline, goOnline, waitForServiceWorker } from '../helpers/network';
import { acceptBeforeUnload, readLiveScore, waitForAllSaved } from '../helpers/sync';

const FIXTURE_PATH = path.join(__dirname, '../fixtures/test-data.json');
const loadFixture = () => JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf-8'));
const headerLink = (page: Page, name: string) => page.getByRole('link', { name, exact: true }).first();

test('asks before leaving a live match', async ({ page }) => {
  test.setTimeout(6 * 60_000);
  acceptBeforeUnload(page);
  const { teamName, playerNames } = loadFixture();
  await createAndStartMatch(page, { teamName, playerNames });
  await setupCourtPositions(page, playerNames.slice(0, 6), { selectServingTeam: teamName });
  const pointButton = page.getByTestId('point-btn-managed-point').first();
  await pointButton.waitFor({ state: 'visible', timeout: 10_000 });
  await waitForServiceWorker(page);
  const liveUrl = page.url();
  const dialog = page.getByTestId('leave-live-dialog');

  // Stay: still on the match, and scoring still works
  await headerLink(page, 'Teams').click();
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Stay' }).click();
  await expect(dialog).toBeHidden();
  expect(page.url()).toBe(liveUrl);
  const before = await readLiveScore(page);
  await pointButton.click();
  await expect
    .poll(async () => {
      const now = await readLiveScore(page);
      return now.home + now.away;
    })
    .toBe(before.home + before.away + 1);

  // Leave: the matches page; afterwards other screens navigate without asking
  await headerLink(page, 'Matches').click();
  await dialog.getByRole('button', { name: 'Leave' }).click();
  await page.waitForURL(/\/matches$/, { timeout: 15_000 });
  await headerLink(page, 'Teams').click();
  await page.waitForURL(/\/teams$/, { timeout: 15_000 });
  await expect(dialog).toBeHidden();

  // Offline with an unsent change: the dialog says so
  await page.goto(liveUrl);
  await pointButton.waitFor({ state: 'visible', timeout: 30_000 });
  await goOffline(page);
  await pointButton.click();
  await headerLink(page, 'Teams').click();
  await expect(dialog).toContainText("1 change hasn't been uploaded yet");
  await dialog.getByRole('button', { name: 'Stay' }).click();
  await expect(dialog).toBeHidden();

  await goOnline(page);
  await waitForAllSaved(page);
});

test('leaves a finished match without asking', async ({ page }) => {
  const { completedMatchStatsUrl } = loadFixture() as { completedMatchStatsUrl?: string };
  test.skip(!completedMatchStatsUrl, 'run 02-matches.spec.ts first');
  await page.goto(completedMatchStatsUrl!.replace('/stats', '/live'));
  await expect(page.getByRole('button', { name: 'Match Statistics' })).toBeVisible({ timeout: 30_000 });
  await headerLink(page, 'Teams').click();
  await page.waitForURL(/\/teams$/, { timeout: 15_000 });
  await expect(page.getByTestId('leave-live-dialog')).toBeHidden();
});
```

In `tests/e2e/04f-sign-out-warning.spec.ts`, replace the block from `await page.getByRole('button', { name: /sign out/i }).click();` to the line before `await goOnline(page);` with:
```ts
  // On the live page, leaving and the unsent changes are covered by one dialog
  await page.getByRole('button', { name: /sign out/i }).click();
  const leaveDialog = page.getByTestId('leave-live-dialog');
  await expect(leaveDialog).toContainText("1 change hasn't been uploaded yet");
  await expect(page.getByTestId('sign-out-warning')).toHaveCount(0);
  await leaveDialog.getByRole('button', { name: 'Stay' }).click();
  await expect(leaveDialog).toBeHidden();
  await expect(page.getByRole('button', { name: /sign out/i })).toBeVisible();
```
and update the file comment to: `Signing out with changes not uploaded yet asks first. On the live page that is the leave dialog, which shows the unsent count; staying keeps the session.`

Run: `pnpm test tests/unit/i18n/locale-parity.test.ts` → FAILS (`liveGuard.*` missing).

- [ ] **Step 2: Add the translations**

In `messages/<lang>/matches.json`, add a top-level `"liveGuard"` object:

`en`:
```json
"liveGuard": {
  "title": "Leave the live match?",
  "body": "Everything recorded so far is saved on this device. You can come back to this match from Matches.",
  "unsent": "{count, plural, one {# change hasn't} other {# changes haven't}} been uploaded yet. They'll upload automatically once you're back online.",
  "stay": "Stay",
  "leave": "Leave"
}
```
`fr`:
```json
"liveGuard": {
  "title": "Quitter le match en direct ?",
  "body": "Tout ce qui a été saisi est enregistré sur cet appareil. Vous pourrez revenir à ce match depuis Matchs.",
  "unsent": "{count, plural, one {# modification n'a pas encore été envoyée} other {# modifications n'ont pas encore été envoyées}}. Elles seront envoyées automatiquement dès le retour de la connexion.",
  "stay": "Rester",
  "leave": "Quitter"
}
```
`es`:
```json
"liveGuard": {
  "title": "¿Salir del partido en directo?",
  "body": "Todo lo registrado hasta ahora está guardado en este dispositivo. Puedes volver a este partido desde Partidos.",
  "unsent": "{count, plural, one {# cambio aún no se ha subido} other {# cambios aún no se han subido}}. Se subirán automáticamente cuando vuelvas a tener conexión.",
  "stay": "Quedarse",
  "leave": "Salir"
}
```
`it`:
```json
"liveGuard": {
  "title": "Uscire dalla partita in diretta?",
  "body": "Tutto ciò che è stato registrato finora è salvato su questo dispositivo. Puoi tornare a questa partita da Partite.",
  "unsent": "{count, plural, one {# modifica non è ancora stata caricata} other {# modifiche non sono ancora state caricate}}. Verranno caricate automaticamente quando tornerai online.",
  "stay": "Resta",
  "leave": "Esci"
}
```
`pt`:
```json
"liveGuard": {
  "title": "Sair do jogo ao vivo?",
  "body": "Tudo o que foi registado até agora está guardado neste dispositivo. Pode voltar a este jogo a partir de Jogos.",
  "unsent": "{count, plural, one {# alteração ainda não foi enviada} other {# alterações ainda não foram enviadas}}. Serão enviadas automaticamente quando voltar a estar online.",
  "stay": "Ficar",
  "leave": "Sair"
}
```
Run: `pnpm test tests/unit/i18n/locale-parity.test.ts` → PASS.

Build, start, then run `CI=1 BASE_URL=http://localhost:3100 pnpm test:e2e tests/e2e/01-teams.spec.ts tests/e2e/04g-leave-live-match.spec.ts`
Expected: the first 04g test FAILS (`leave-live-dialog` never appears; the click navigates away).

- [ ] **Step 3: Create the provider**

Create `components/providers/leave-guard-provider.tsx`:
```tsx
"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
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

/** `free`: nothing to confirm (no live match open); otherwise the user's answer. */
export type LeaveDecision = "free" | "leave" | "stay";

/** sessionStorage key of the last live match URL, read by public/offline.html. */
export const LAST_LIVE_MATCH_KEY = "volleystats:last-live-match";

interface GuardState {
  active: boolean;
  unsentCount: number;
}

interface LeaveGuardContextValue {
  setGuard: (state: GuardState) => void;
  isActive: () => boolean;
  confirmLeave: () => Promise<LeaveDecision>;
}

const LeaveGuardContext = createContext<LeaveGuardContextValue | null>(null);

/**
 * Asks before an in-app action leaves a live match (header links, logo, sign out). The live page turns
 * the guard on with `useLeaveGuard`; links and buttons ask through `useConfirmLeave`. Browser Back is
 * not intercepted.
 */
export function LeaveGuardProvider({ children }: { children: ReactNode }) {
  const t = useTranslations("matches.liveGuard");
  const [guard, setGuardState] = useState<GuardState>({ active: false, unsentCount: 0 });
  const guardRef = useRef(guard);
  const [open, setOpen] = useState(false);
  const pending = useRef<((decision: LeaveDecision) => void) | null>(null);

  const setGuard = useCallback((state: GuardState) => {
    guardRef.current = state;
    setGuardState(state);
  }, []);

  const isActive = useCallback(() => guardRef.current.active, []);

  const confirmLeave = useCallback((): Promise<LeaveDecision> => {
    if (!guardRef.current.active) return Promise.resolve("free");
    // A second request while the dialog is open answers the first one with "stay".
    pending.current?.("stay");
    return new Promise<LeaveDecision>((resolve) => {
      pending.current = resolve;
      setOpen(true);
    });
  }, []);

  const settle = useCallback((decision: "leave" | "stay") => {
    const resolve = pending.current;
    pending.current = null;
    setOpen(false);
    resolve?.(decision);
  }, []);

  const value = useMemo(() => ({ setGuard, isActive, confirmLeave }), [setGuard, isActive, confirmLeave]);

  return (
    <LeaveGuardContext.Provider value={value}>
      {children}
      <AlertDialog open={open} onOpenChange={(next) => !next && settle("stay")}>
        <AlertDialogContent data-testid="leave-live-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("title")}</AlertDialogTitle>
            <AlertDialogDescription>{t("body")}</AlertDialogDescription>
          </AlertDialogHeader>
          {guard.unsentCount > 0 && (
            <p className="text-sm font-medium">{t("unsent", { count: guard.unsentCount })}</p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => settle("stay")}>{t("stay")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => settle("leave")}>{t("leave")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </LeaveGuardContext.Provider>
  );
}

/** Turns the guard on while `active`; off again when the caller unmounts. */
export function useLeaveGuard({ active, unsentCount }: GuardState): void {
  const setGuard = useContext(LeaveGuardContext)?.setGuard;
  useEffect(() => {
    setGuard?.({ active, unsentCount });
  }, [setGuard, active, unsentCount]);
  useEffect(() => () => setGuard?.({ active: false, unsentCount: 0 }), [setGuard]);
}

const UNGUARDED = { isActive: () => false, confirmLeave: () => Promise.resolve<LeaveDecision>("free") };

export function useConfirmLeave(): Pick<LeaveGuardContextValue, "isActive" | "confirmLeave"> {
  const context = useContext(LeaveGuardContext);
  return context ?? UNGUARDED;
}
```
Radix focuses `AlertDialogCancel` (Stay) when the dialog opens, and Escape closes it through `onOpenChange`, so Enter and Escape both keep the user on the match.

- [ ] **Step 4: Create the link**

Create `components/guarded-link.tsx`:
```tsx
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ComponentProps, MouseEvent } from "react";
import { useConfirmLeave } from "@/components/providers/leave-guard-provider";

type GuardedLinkProps = Omit<ComponentProps<typeof Link>, "href"> & { href: string };

/** A `next/link` that asks before leaving a live match. New-tab clicks pass through: they don't leave. */
export function GuardedLink({ href, onClick, ...props }: GuardedLinkProps) {
  const router = useRouter();
  const { isActive, confirmLeave } = useConfirmLeave();

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    if (event.defaultPrevented || !isActive()) return;
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    void confirmLeave().then((decision) => {
      if (decision !== "stay") router.push(href);
    });
  };

  return <Link href={href} onClick={handleClick} {...props} />;
}
```

- [ ] **Step 5: Mount the provider and use it**

`app/layout.tsx`:
- add `import { LeaveGuardProvider } from '@/components/providers/leave-guard-provider';`
- wrap the content of `<SyncStatusProvider>` (from `<LoadingBar />` to `<Toaster />`) in `<LeaveGuardProvider> … </LeaveGuardProvider>`.

`components/navigation.tsx`:
- add `import { GuardedLink } from "@/components/guarded-link";` and `import { useConfirmLeave } from "@/components/providers/leave-guard-provider";`; remove `import Link from "next/link";` once no `Link` is left.
- replace every `<Link` / `</Link>` with `<GuardedLink` / `</GuardedLink>` (the route links of the three layouts and both logo links). The mobile sheet links keep `onClick={() => setMobileMenuOpen(false)}`: `GuardedLink` calls it first, so the sheet closes before the dialog opens.
- replace `handleSignOut` with:
```ts
  const { confirmLeave } = useConfirmLeave();
  const handleSignOut = async () => {
    const decision = await confirmLeave();
    if (decision === "stay") return;
    // The leave dialog already showed this match's unsent changes: no second prompt.
    if (decision === "free" && unsentCount > 0) setConfirmSignOut(true);
    else void signOut();
  };
```
and the button's handler to `onClick={() => void handleSignOut()}`.

`app/matches/[id]/live/page.tsx`:
- add `import { useLeaveGuard } from "@/components/providers/leave-guard-provider";`
- after `useBeforeUnloadWhenUnsent(unsentCount > 0);` add:
```ts
  // In-app navigation asks first while a match in progress is on screen (finished matches leave freely).
  const guardActive = !isLoading && !!matchState.match && matchState.match.status !== "completed";
  useLeaveGuard({ active: guardActive, unsentCount });
```
(`isLoading` and `matchState` are declared above that line.)

- [ ] **Step 6: Run the tests**

Run: `npx tsc --noEmit -p .` → no errors; `npx eslint components/providers/leave-guard-provider.tsx components/guarded-link.tsx components/navigation.tsx app/layout.tsx "app/matches/[id]/live/page.tsx"` → no new problems.
Rebuild, restart, then:
Run: `CI=1 BASE_URL=http://localhost:3100 pnpm test:e2e tests/e2e/01-teams.spec.ts tests/e2e/02-matches.spec.ts tests/e2e/04f-sign-out-warning.spec.ts tests/e2e/04g-leave-live-match.spec.ts`
Expected: PASS. Then `git checkout -- tests/fixtures/test-data.json`.

- [ ] **Step 7: Commit**

```bash
git add components/providers/leave-guard-provider.tsx components/guarded-link.tsx app/layout.tsx components/navigation.tsx "app/matches/[id]/live/page.tsx" messages tests/unit/i18n/locale-parity.test.ts tests/e2e/04g-leave-live-match.spec.ts tests/e2e/04f-sign-out-warning.spec.ts
git commit -m "feat(live): ask before leaving a live match through the app"
```

---

### Task 8: Offline fallback page

**Files:**
- Create: `public/offline.html`
- Modify: `app/sw.ts` (`fallbacks`)
- Modify: `app/matches/[id]/live/page.tsx` (store the URL)
- Modify: `tests/e2e/04g-leave-live-match.spec.ts`
- Modify: `.claude/docs/04-offline-sync.md`

**Interfaces:**
- Consumes: `LAST_LIVE_MATCH_KEY` (Task 7; the HTML uses the literal `"volleystats:last-live-match"`).
- Produces: test id `offline-page`; button "Back to the live match".

- [ ] **Step 1: Write the failing test**

In `tests/e2e/04g-leave-live-match.spec.ts`, in the first test, replace
```ts
  await dialog.getByRole('button', { name: 'Stay' }).click();
  await expect(dialog).toBeHidden();

  await goOnline(page);
```
(the offline block's ending) with:
```ts
  await dialog.getByRole('button', { name: 'Stay' }).click();
  await expect(dialog).toBeHidden();

  // Leave anyway: the app's offline page, not the browser's error page
  await headerLink(page, 'Teams').click();
  await dialog.getByRole('button', { name: 'Leave' }).click();
  await expect(page.getByTestId('offline-page')).toBeVisible({ timeout: 15_000 });
  expect(page.url()).not.toContain('chrome-error');

  // Back to the live match, served from the cache
  await page.getByRole('button', { name: 'Back to the live match' }).click();
  await page.waitForURL((url) => url.href === liveUrl, { timeout: 15_000 });
  await pointButton.waitFor({ state: 'visible', timeout: 30_000 });

  // Without a saved live match the offline page goes back in history (never to /matches)
  await page.goto('/championships');
  await expect(page.getByTestId('offline-page')).toBeVisible({ timeout: 15_000 });
  await page.evaluate(() => sessionStorage.removeItem('volleystats:last-live-match'));
  await page.getByRole('button', { name: 'Back to the live match' }).click();
  await page.waitForURL((url) => url.href === liveUrl, { timeout: 15_000 });
  await pointButton.waitFor({ state: 'visible', timeout: 30_000 });

  await goOnline(page);
```

Build, start, run `CI=1 BASE_URL=http://localhost:3100 pnpm test:e2e tests/e2e/01-teams.spec.ts tests/e2e/04g-leave-live-match.spec.ts`
Expected: FAILS at `offline-page` (the tab shows `chrome-error://chromewebdata/`).

- [ ] **Step 2: Create the page**

Create `public/offline.html`:
```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <title>VolleyStats</title>
  <style>
    :root { color-scheme: light dark; --bg: #ffffff; --fg: #0a0a0a; --muted: #737373; --primary: #171717; --primary-fg: #fafafa; --border: #e5e5e5; }
    @media (prefers-color-scheme: dark) {
      :root { --bg: #0a0a0a; --fg: #fafafa; --muted: #a3a3a3; --primary: #fafafa; --primary-fg: #171717; --border: #262626; }
    }
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px;
      font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; background: var(--bg); color: var(--fg); }
    main { max-width: 360px; text-align: center; }
    img { width: 64px; height: 64px; border-radius: 12px; }
    h1 { font-size: 1.25rem; margin: 16px 0 8px; }
    p { color: var(--muted); margin: 0 0 24px; line-height: 1.5; }
    button { display: block; width: 100%; padding: 12px 16px; margin-top: 8px; border-radius: 8px; font: inherit; font-weight: 600; cursor: pointer; }
    .primary { background: var(--primary); color: var(--primary-fg); border: 1px solid var(--primary); }
    .secondary { background: transparent; color: var(--fg); border: 1px solid var(--border); }
  </style>
</head>
<body>
  <main data-testid="offline-page">
    <img src="/logo.png" alt="VolleyStats" />
    <h1 id="title">You're offline</h1>
    <p id="body">This screen needs a connection.</p>
    <button id="back" class="primary" type="button">Back to the live match</button>
    <button id="retry" class="secondary" type="button">Retry</button>
  </main>
  <script>
    (function () {
      var TEXTS = {
        en: ["You're offline", "This screen needs a connection.", "Back to the live match", "Retry"],
        fr: ["Vous êtes hors ligne", "Cet écran nécessite une connexion.", "Retour au match en direct", "Réessayer"],
        es: ["Sin conexión", "Esta pantalla necesita conexión.", "Volver al partido en directo", "Reintentar"],
        it: ["Sei offline", "Questa schermata richiede una connessione.", "Torna alla partita in diretta", "Riprova"],
        pt: ["Está offline", "Este ecrã precisa de ligação.", "Voltar ao jogo ao vivo", "Tentar novamente"]
      };
      var cookie = document.cookie.match(/(?:^|;\s*)NEXT_LOCALE=([a-z]{2})/);
      var browser = (navigator.language || "en").slice(0, 2).toLowerCase();
      var locale = cookie && TEXTS[cookie[1]] ? cookie[1] : TEXTS[browser] ? browser : "en";
      var text = TEXTS[locale];
      document.documentElement.lang = locale;
      document.getElementById("title").textContent = text[0];
      document.getElementById("body").textContent = text[1];
      document.getElementById("back").textContent = text[2];
      document.getElementById("retry").textContent = text[3];

      document.getElementById("back").addEventListener("click", function () {
        var liveMatch = null;
        try { liveMatch = sessionStorage.getItem("volleystats:last-live-match"); } catch (e) {}
        // Never /matches: it needs a connection too.
        if (liveMatch) location.href = liveMatch;
        else history.back();
      });
      document.getElementById("retry").addEventListener("click", function () { location.reload(); });
    })();
  </script>
</body>
</html>
```
Serwist's default precache glob includes `public/**/*`, so the page and `/logo.png` are precached with no route change.

- [ ] **Step 3: Serve it from the service worker**

In `app/sw.ts`, add to the `new Serwist({ ... })` options, after `runtimeCaching: [ ... ],`:
```ts
  // A page that can't load (offline, weak signal) shows the app's offline page instead of the
  // browser's error page. Client-side navigations whose data fetch fails fall back to a full page
  // load, so they end up here too.
  fallbacks: {
    entries: [{ url: '/offline.html', matcher: ({ request }) => request.destination === 'document' }],
  },
```

- [ ] **Step 4: Save the live match URL**

In `app/matches/[id]/live/page.tsx`:
- extend the provider import: `import { LAST_LIVE_MATCH_KEY, useLeaveGuard } from "@/components/providers/leave-guard-provider";`
- after the `useLeaveGuard(...)` line add:
```ts
  // The offline page's "Back to the live match" button reads it (public/offline.html).
  const matchLoaded = !!matchState.match;
  useEffect(() => {
    if (!matchLoaded) return;
    try {
      sessionStorage.setItem(LAST_LIVE_MATCH_KEY, window.location.pathname + window.location.search);
    } catch (error) {
      console.warn("Could not save the live match URL:", error);
    }
  }, [matchLoaded]);
```

- [ ] **Step 5: Document it**

In `.claude/docs/04-offline-sync.md`:
- under "**Service worker**", add the bullet:
```markdown
- A page that can't load (offline or a weak signal) gets `public/offline.html` (Serwist `fallbacks`, document requests only; precached through the default `public/**/*` glob). It is static (inline CSS and texts in five languages, picked from the `NEXT_LOCALE` cookie or the browser language) and its **Back to the live match** button opens the URL the live page saves in `sessionStorage` (`volleystats:last-live-match`), or goes back in history when there is none.
```
- under "**User Experience**", add the bullet:
```markdown
- Leaving a match in progress through the app (header links, logo, sign out) asks first, with the match's unsent count (`LeaveGuardProvider`, `useLeaveGuard`, `GuardedLink`). Browser Back is not intercepted. Finished matches leave freely.
```

- [ ] **Step 6: Run the tests**

Run: `npx tsc --noEmit -p .` → no errors.
Rebuild, restart, then:
Run: `CI=1 BASE_URL=http://localhost:3100 pnpm test:e2e tests/e2e/01-teams.spec.ts tests/e2e/04g-leave-live-match.spec.ts tests/e2e/05b-sw-cache.spec.ts`
Expected: PASS. Then `git checkout -- tests/fixtures/test-data.json`.

Manual: with the `NEXT_LOCALE` cookie set to `fr`, open `/offline.html`: French texts. At 390×844, open the mobile menu on a live match and tap Teams: the sheet closes and the dialog is usable.

- [ ] **Step 7: Commit**

```bash
git add public/offline.html app/sw.ts "app/matches/[id]/live/page.tsx" tests/e2e/04g-leave-live-match.spec.ts .claude/docs/04-offline-sync.md
git commit -m "feat(pwa): offline page instead of the browser's error page"
```

---

## Part D: Late players

### Task 9: Roster helpers

**Files:**
- Create: `lib/matches/late-players.ts`
- Test: `tests/unit/matches/late-players.test.ts` (create)

**Interfaces:**
- Consumes: `TeamMember.archived_at` (Task 1).
- Produces:
  - `latePlayerCandidates(members: readonly TeamMember[], rosterIds: readonly string[]): TeamMember[]`
  - `withLatePlayer(roster: readonly string[] | null | undefined, playerId: string): string[]`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/matches/late-players.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { latePlayerCandidates, withLatePlayer } from "@/lib/matches/late-players";
import type { TeamMember } from "@/lib/types";

const member = (id: string, number: number, fields: Partial<TeamMember> = {}): TeamMember => ({
  id,
  team_id: "team",
  name: `Player ${number}`,
  number,
  position: null,
  role: "player",
  ...fields,
});

describe("latePlayerCandidates", () => {
  it("offers active members who aren't in the roster, by jersey number", () => {
    const members = [member("c", 9), member("a", 3), member("b", 7), member("in", 1)];
    expect(latePlayerCandidates(members, ["in"]).map((m) => m.id)).toEqual(["a", "b", "c"]);
  });

  it("leaves archived members out", () => {
    const members = [member("a", 3, { archived_at: "2026-10-13T10:00:00.000Z" }), member("b", 7, { archived_at: null })];
    expect(latePlayerCandidates(members, []).map((m) => m.id)).toEqual(["b"]);
  });

  it("is empty when everyone is already in the roster", () => {
    expect(latePlayerCandidates([member("a", 3)], ["a"])).toEqual([]);
    expect(latePlayerCandidates([], [])).toEqual([]);
  });
});

describe("withLatePlayer", () => {
  it("appends the player", () => {
    expect(withLatePlayer(["a"], "b")).toEqual(["a", "b"]);
  });

  it("adds a player once, however often it is called", () => {
    expect(withLatePlayer(withLatePlayer(["a"], "b"), "b")).toEqual(["a", "b"]);
  });

  it("starts a roster that doesn't exist yet", () => {
    expect(withLatePlayer(null, "b")).toEqual(["b"]);
    expect(withLatePlayer(undefined, "b")).toEqual(["b"]);
  });

  it("doesn't change the roster it was given", () => {
    const roster = ["a"];
    withLatePlayer(roster, "b");
    expect(roster).toEqual(["a"]);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm test tests/unit/matches/late-players.test.ts`
Expected: FAIL (cannot resolve `@/lib/matches/late-players`).

- [ ] **Step 3: Implement**

Create `lib/matches/late-players.ts`:
```ts
import type { TeamMember } from "@/lib/types";

/** Team members who can join a match in progress: not archived and not in the roster yet, by jersey number. */
export function latePlayerCandidates(members: readonly TeamMember[], rosterIds: readonly string[]): TeamMember[] {
  const roster = new Set(rosterIds);
  return members
    .filter((member) => !member.archived_at && !roster.has(member.id))
    .sort((a, b) => a.number - b.number || a.name.localeCompare(b.name));
}

/** The roster with `playerId` in it once (a new array). */
export function withLatePlayer(roster: readonly string[] | null | undefined, playerId: string): string[] {
  const current = [...(roster ?? [])];
  return current.includes(playerId) ? current : [...current, playerId];
}
```

- [ ] **Step 4: Run the tests**

Run: `pnpm test tests/unit/matches/late-players.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/matches/late-players.ts tests/unit/matches/late-players.test.ts
git commit -m "feat(live): roster helpers for late players"
```

---

### Task 10: Add a late player during the match

**Files:**
- Create: `components/matches/live/late-player-dialog.tsx`
- Modify: `app/matches/[id]/live/page.tsx` (state, `addLatePlayer`, dialog, props)
- Modify: `components/matches/live/panels/events-panel.tsx` (button, prop pass-through)
- Modify: `components/matches/live/events/event-form.tsx` (link under "player in")
- Modify: `components/sets/set-setup.tsx` (link under the player picker)
- Modify: `messages/{en,fr,es,it,pt}/matches.json` (`live.latePlayer`)
- Modify: `tests/unit/i18n/locale-parity.test.ts`
- Test: `tests/e2e/04h-late-player.spec.ts` (create)

**Interfaces:**
- Consumes: `latePlayerCandidates`, `withLatePlayer` (Task 9); `createAndStartMatch({ excludePlayers })` and `selectedPlayers` (Task 6); fixture `archivedPlayerName` (Task 5); `fetchServerMatch` (`tests/helpers/server-data.ts`).
- Produces: `LatePlayerDialog` props `{ open: boolean; onOpenChange: (open: boolean) => void; teamId: string; rosterIds: string[]; onAdd: (player: TeamMember) => Promise<void> }`; optional prop `onAddLatePlayer?: () => Promise<TeamMember | null>` on `EventsPanel`, `EventForm` and `SetSetup`; test ids `add-late-player`, `late-player-link`, `late-player-dialog`, `late-player-option`.

- [ ] **Step 1: Write the failing tests**

In `tests/unit/i18n/locale-parity.test.ts`, add to the `"matches.json"` list:
```ts
    "live.latePlayer.button",
    "live.latePlayer.link",
    "live.latePlayer.title",
    "live.latePlayer.description",
    "live.latePlayer.none",
    "live.latePlayer.added",
    "live.latePlayer.addError",
```

Create `tests/e2e/04h-late-player.spec.ts`:
```ts
/**
 * A team member who wasn't ticked in the start dialog joins the match in progress, offline, and the
 * roster change reaches the server. Archived players are never offered.
 */
import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { createAndStartMatch } from '../helpers/match-setup';
import { setupCourtPositions } from '../helpers/court';
import { goOffline, goOnline, waitForServiceWorker } from '../helpers/network';
import { fetchServerMatch } from '../helpers/server-data';
import { acceptBeforeUnload, waitForAllSaved } from '../helpers/sync';

const FIXTURE_PATH = path.join(__dirname, '../fixtures/test-data.json');

test('adds a late player to the roster offline', async ({ page }) => {
  test.setTimeout(6 * 60_000);
  acceptBeforeUnload(page);
  const { teamName, playerNames, archivedPlayerName } = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf-8'));
  const late = playerNames[7]; // not needed on court in set 1
  const { matchId, selectedPlayers } = await createAndStartMatch(page, { teamName, playerNames, excludePlayers: [late] });
  await setupCourtPositions(page, playerNames.slice(0, 6), { selectServingTeam: teamName });
  await page.getByTestId('point-btn-managed-point').first().waitFor({ state: 'visible', timeout: 10_000 });
  await waitForServiceWorker(page);
  await goOffline(page);

  // Events panel → Add late player
  await page.getByTestId('sidebar-btn-events').first().click();
  await page.getByTestId('add-late-player').first().click();
  const picker = page.getByTestId('late-player-dialog');
  await expect(picker).toBeVisible();
  if (archivedPlayerName) {
    await expect(picker.locator(`[data-player-name="${archivedPlayerName}"]`)).toHaveCount(0);
  }
  await picker.locator(`[data-testid="late-player-option"][data-player-name="${late}"]`).click();
  await expect(picker).toBeHidden();
  await expect(page.getByText(`${late} added to the roster`).first()).toBeVisible();

  // The late player is on the bench: offered as the player coming in
  await page.getByRole('button', { name: 'Substitution', exact: true }).click();
  await page.getByLabel('Player In (on the bench)').click();
  await expect(page.getByRole('option', { name: new RegExp(late) })).toBeVisible();
  await page.keyboard.press('Escape'); // closes the select
  await page.keyboard.press('Escape'); // closes the substitution dialog

  // Nobody left to add
  await page.getByTestId('add-late-player').first().click();
  await expect(picker).toContainText('Every active team member is already in the roster.');
  await page.keyboard.press('Escape');

  // The roster change uploads with the match
  await goOnline(page);
  await waitForAllSaved(page);
  const server = await fetchServerMatch(matchId);
  expect(server.match.home_available_players).toHaveLength(selectedPlayers + 1);
});
```

Run: `pnpm test tests/unit/i18n/locale-parity.test.ts` → FAILS (`live.latePlayer.*` missing).

- [ ] **Step 2: Add the translations**

In `messages/<lang>/matches.json`, inside `"live"`, add `"latePlayer"`:

`en`:
```json
"latePlayer": {
  "button": "Add late player",
  "link": "Player not listed? Add from team…",
  "title": "Add a late player",
  "description": "Team members who aren't in this match's roster. The player you pick joins the roster.",
  "none": "Every active team member is already in the roster.",
  "added": "{name} added to the roster",
  "addError": "Couldn't add the player. Please try again."
}
```
`fr`:
```json
"latePlayer": {
  "button": "Ajouter un retardataire",
  "link": "Joueur absent de la liste ? Ajouter depuis l'équipe…",
  "title": "Ajouter un joueur retardataire",
  "description": "Membres de l'équipe absents de la feuille de ce match. Le joueur choisi rejoint la feuille de match.",
  "none": "Tous les membres actifs de l'équipe sont déjà sur la feuille de match.",
  "added": "{name} ajouté à la feuille de match",
  "addError": "Impossible d'ajouter le joueur. Veuillez réessayer."
}
```
`es`:
```json
"latePlayer": {
  "button": "Añadir jugador tardío",
  "link": "¿No aparece el jugador? Añadir desde el equipo…",
  "title": "Añadir un jugador que llegó tarde",
  "description": "Miembros del equipo que no están en la alineación de este partido. El jugador elegido se une a la alineación.",
  "none": "Todos los miembros activos del equipo ya están en la alineación.",
  "added": "{name} añadido a la alineación",
  "addError": "No se pudo añadir al jugador. Inténtalo de nuevo."
}
```
`it`:
```json
"latePlayer": {
  "button": "Aggiungi ritardatario",
  "link": "Giocatore non in elenco? Aggiungi dalla squadra…",
  "title": "Aggiungi un giocatore in ritardo",
  "description": "Membri della squadra non presenti nella formazione di questa partita. Il giocatore scelto entra in formazione.",
  "none": "Tutti i membri attivi della squadra sono già in formazione.",
  "added": "{name} aggiunto alla formazione",
  "addError": "Impossibile aggiungere il giocatore. Riprova."
}
```
`pt`:
```json
"latePlayer": {
  "button": "Adicionar jogador atrasado",
  "link": "Jogador não está na lista? Adicionar da equipa…",
  "title": "Adicionar um jogador atrasado",
  "description": "Membros da equipa que não estão na escalação deste jogo. O jogador escolhido entra na escalação.",
  "none": "Todos os membros ativos da equipa já estão na escalação.",
  "added": "{name} adicionado à escalação",
  "addError": "Não foi possível adicionar o jogador. Tente novamente."
}
```
Run: `pnpm test tests/unit/i18n/locale-parity.test.ts` → PASS.

Build, start, run `CI=1 BASE_URL=http://localhost:3100 pnpm test:e2e tests/e2e/01-teams.spec.ts tests/e2e/01b-player-archive.spec.ts tests/e2e/04h-late-player.spec.ts`
Expected: 04h FAILS (`add-late-player` not found).

- [ ] **Step 3: Create the picker**

Create `components/matches/live/late-player-dialog.tsx`:
```tsx
"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useLocalDb } from "@/components/providers/local-database-provider";
import { latePlayerCandidates } from "@/lib/matches/late-players";
import type { TeamMember } from "@/lib/types";

type LatePlayerDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamId: string;
  /** Players already in the match's roster. */
  rosterIds: string[];
  onAdd: (player: TeamMember) => Promise<void>;
};

/** Picks a team member who isn't in the match's roster yet. Reads the local database, so it works offline. */
export function LatePlayerDialog({ open, onOpenChange, teamId, rosterIds, onAdd }: LatePlayerDialogProps) {
  const t = useTranslations("matches");
  const { localDb } = useLocalDb();
  const [candidates, setCandidates] = useState<TeamMember[] | null>(null);
  const [busy, setBusy] = useState(false);
  // The roster as a string, so a new array with the same ids doesn't reload the list.
  const rosterKey = rosterIds.join(",");

  useEffect(() => {
    if (!open || !localDb) return;
    let cancelled = false;
    setCandidates(null);
    localDb.team_members
      .find({ selector: { team_id: teamId } })
      .exec()
      .then((docs) => {
        if (cancelled) return;
        const members = docs.map((doc) => doc.toJSON() as TeamMember);
        setCandidates(latePlayerCandidates(members, rosterKey ? rosterKey.split(",") : []));
      })
      .catch((error) => {
        console.error("Failed to load the team members:", error);
        if (!cancelled) setCandidates([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open, localDb, teamId, rosterKey]);

  const add = async (player: TeamMember) => {
    setBusy(true);
    try {
      await onAdd(player);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="late-player-dialog" className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("live.latePlayer.title")}</DialogTitle>
          <DialogDescription>{t("live.latePlayer.description")}</DialogDescription>
        </DialogHeader>
        {candidates === null ? (
          <div className="flex justify-center py-6" role="status" aria-busy="true">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
          </div>
        ) : candidates.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">{t("live.latePlayer.none")}</p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {candidates.map((player) => (
              <Button
                key={player.id}
                variant="outline"
                disabled={busy}
                data-testid="late-player-option"
                data-player-name={player.name}
                onClick={() => void add(player)}
              >
                #{player.number} {player.name}
              </Button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 4: Add the write to the live page**

In `app/matches/[id]/live/page.tsx`:
- add imports:
```ts
import { LatePlayerDialog } from "@/components/matches/live/late-player-dialog";
import { withLatePlayer } from "@/lib/matches/late-players";
```
- right after the `onSubstitutionRecorded` `useCallback` (it ends with its dependency array, before the early returns), add:
```ts
  // Late players (an existing team member joins the match in progress). `requestLatePlayer` opens the
  // picker and resolves with the player added, or null when it is closed without adding anyone.
  const [latePlayerOpen, setLatePlayerOpen] = useState(false);
  const latePlayerRequest = useRef<((player: TeamMember | null) => void) | null>(null);

  const closeLatePlayer = useCallback((player: TeamMember | null) => {
    setLatePlayerOpen(false);
    const resolve = latePlayerRequest.current;
    latePlayerRequest.current = null;
    resolve?.(player);
  }, []);

  const requestLatePlayer = useCallback((): Promise<TeamMember | null> => {
    latePlayerRequest.current?.(null);
    setLatePlayerOpen(true);
    return new Promise((resolve) => {
      latePlayerRequest.current = resolve;
    });
  }, []);

  /** Adds the player to the managed team's roster of this match (RxDB; the match replication uploads it). Not undoable. */
  const addLatePlayer = useCallback(
    async (player: TeamMember) => {
      if (!db || scoringBlocked || !matchState.match || !managedTeam) return;
      const field =
        managedTeam.id === matchState.match.home_team_id ? "home_available_players" : "away_available_players";
      try {
        const doc = await db.matches.findOne(matchId).exec();
        if (!doc) throw new Error(t("live.matchNotFound"));
        await doc.incrementalModify((data) => ({ ...data, [field]: withLatePlayer(data[field], player.id) }));
        setTeamPlayers((players) => (players.some((p) => p.id === player.id) ? players : [...players, player]));
        setTeamPlayerById((byId) => new Map(byId).set(player.id, player));
        toast({ title: t("live.latePlayer.added", { name: player.name }) });
        closeLatePlayer(player);
      } catch (error) {
        console.error("Failed to add a late player:", error);
        toast({ variant: "destructive", title: t("live.latePlayer.addError") });
      }
    },
    [db, scoringBlocked, matchState.match, managedTeam, matchId, t, closeLatePlayer]
  );
  const onAddLatePlayer = scoringBlocked ? undefined : requestLatePlayer;
```
- pass `onAddLatePlayer={onAddLatePlayer}` to `<EventsPanel ... />` (in `renderPanelContent`) and to `<SetSetup ... />` (in `renderMainContent`);
- render the picker next to `<ScorerClaimDialog ... />` at the end of the main return:
```tsx
      {managedTeam && (
        <LatePlayerDialog
          open={latePlayerOpen}
          onOpenChange={(open) => !open && closeLatePlayer(null)}
          teamId={managedTeam.id}
          rosterIds={teamPlayers.map((player) => player.id)}
          onAdd={addLatePlayer}
        />
      )}
```

- [ ] **Step 5: Add the entry points**

`components/matches/live/panels/events-panel.tsx`:
- add `onAddLatePlayer?: () => Promise<TeamMember | null>;` to `EventsPanelProps` and to the destructured props;
- add `UserPlus` to the `lucide-react` import;
- in "Row 2: quick action buttons", after the Timeout button, add:
```tsx
          {onAddLatePlayer && (
            <Button
              size="sm"
              variant="outline"
              data-testid="add-late-player"
              onClick={() => void onAddLatePlayer()}
              className="flex-1 h-7 sm:h-8 px-2 sm:px-3 text-[10px] sm:text-xs"
            >
              <UserPlus className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
              {t("live.latePlayer.button")}
            </Button>
          )}
```
- pass `onAddLatePlayer={onAddLatePlayer}` to `<EventForm ... />`.

`components/matches/live/events/event-form.tsx`:
- add `onAddLatePlayer?: () => Promise<TeamMember | null>;` to `EventFormProps` and to the destructured props (`TeamMember` is already imported for `players`; add it to the `@/lib/types` import if not);
- in the `player_in_id` field, after `<FormDescription>{t("events.form.onlyPlayersNotInLineup")}</FormDescription>`, add:
```tsx
                  {onAddLatePlayer && (
                    <Button
                      type="button"
                      variant="link"
                      size="sm"
                      className="h-auto p-0"
                      data-testid="late-player-link"
                      onClick={async () => {
                        const player = await onAddLatePlayer();
                        if (player) form.setValue("player_in_id", player.id, { shouldValidate: true });
                      }}
                    >
                      {t("live.latePlayer.link")}
                    </Button>
                  )}
```
(`Button` is imported in this file; if not, add `import { Button } from "@/components/ui/button";`.)

`components/sets/set-setup.tsx`:
- add `onAddLatePlayer?: () => Promise<TeamMember | null>;` to `SetSetupProps` and to the destructured props; add `import { Button } from "@/components/ui/button";` if it isn't imported;
- right after the `<PlayerSelector ... />` element inside the position card, add:
```tsx
                {onAddLatePlayer && (
                  <div className="flex justify-center">
                    <Button
                      type="button"
                      variant="link"
                      size="sm"
                      data-testid="late-player-link"
                      onClick={async () => {
                        const player = await onAddLatePlayer();
                        if (player) void handleSelectPlayer(player);
                      }}
                    >
                      {t("live.latePlayer.link")}
                    </Button>
                  </div>
                )}
```

- [ ] **Step 6: Run the tests**

Run: `npx tsc --noEmit -p .` → no errors. If `form.setValue("player_in_id", …)` is rejected because of the form's union type, write `form.setValue("player_in_id" as never, player.id as never, { shouldValidate: true })`.
Run: `npx eslint components/matches/live/late-player-dialog.tsx components/matches/live/panels/events-panel.tsx components/matches/live/events/event-form.tsx components/sets/set-setup.tsx "app/matches/[id]/live/page.tsx"` → no new problems.
Run: `pnpm test` → PASS.
Rebuild, restart, then:
Run: `CI=1 BASE_URL=http://localhost:3100 pnpm test:e2e tests/e2e/01-teams.spec.ts tests/e2e/01b-player-archive.spec.ts tests/e2e/02-matches.spec.ts tests/e2e/04h-late-player.spec.ts`
Expected: PASS. Then `git checkout -- tests/fixtures/test-data.json`.

Manual: on the set setup screen, tap a court position, then "Player not listed? Add from team…", add a player: they are selected for that position. In the substitution form, the same link pre-selects the added player as "Player In".

- [ ] **Step 7: Commit**

```bash
git add components/matches/live/late-player-dialog.tsx "app/matches/[id]/live/page.tsx" components/matches/live/panels/events-panel.tsx components/matches/live/events/event-form.tsx components/sets/set-setup.tsx messages tests/unit/i18n/locale-parity.test.ts tests/e2e/04h-late-player.spec.ts
git commit -m "feat(live): add a late player to the roster of a match in progress"
```

---

### Task 11: Whole-branch verification

- [ ] **Step 1: Static checks**

Run: `npx tsc --noEmit -p .` → no errors.
Run: `npx eslint $(git diff --name-only main...HEAD -- '*.ts' '*.tsx')` and compare with the same files on `main`: no new errors or warnings.
Run: `pnpm test` → all PASS.

- [ ] **Step 2: Full e2e suite**

Rebuild, restart, then:
Run: `CI=1 BASE_URL=http://localhost:3100 pnpm test:e2e`
Expected: all PASS (the suite runs in file order: 01, 01b, 02, …, 04g, 04h, …, 07). Then `git checkout -- tests/fixtures/test-data.json`.

- [ ] **Step 3: Manual upgrade check**

On a browser profile that already has the app's local database from `main` (schema version 0) and a tracked match: open the new build. Expected: no "Clear local database" screen; the match opens offline; after going online, a player archived on the server shows as archived in the late-player picker (not offered).

- [ ] **Step 4: Report**

Summarise for the user what passed, what was checked by hand, and anything skipped, with the output of failing commands if any.
