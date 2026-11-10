# BLO-11 Initial data load — mini plan (small ticket)

## Changes
The live page waits, when online, for the match's format and both teams to reach the local database before it gives up with `dataMissing`. A new `SyncManager.awaitReferenceRows(rows, timeoutMs)` resolves at once when the rows are local; otherwise it re-syncs the reference replications (rows created on the server after the last pull) and waits for the rows, bounded by `timeoutMs`. `referenceDataWaitMs(online)` gives that bound: `SYNC_TIMEOUT_MS` (30 s) online, 0 offline. The loading screen stays on its "Loading match format" step meanwhile.

## Files
- `lib/rxdb/sync/manager.ts`: `awaitReferenceRows`.
- `lib/matches/live-load-failure.ts`: `referenceDataWaitMs`.
- `app/matches/live/page.tsx`: call both before reading the format and teams.
- Tests: `tests/unit/sync/manager-reference-rows.test.ts` (new), `tests/unit/matches/live-load-failure.test.ts` (new describe), `tests/e2e/19-live-reference-data.spec.ts` (new).

## Existing features touched
Live page loading (`loadMatchData`), also used by the refresh after a claim; reference replications get one extra `reSync()` when a row is missing. Failure reasons and texts are unchanged.

## Alternatives
Fetch the missing rows with the API layer and insert them locally: rejected, it writes pull-only tables outside their replication. Wait for the whole reference replication to be in sync: rejected, it never resolves in a non-leader tab.

## Tests per criterion
- C1: unit (format/teams pull hung after sign-in, then released) + e2e (fresh device, first reference pulls delayed, scoring screen on the first attempt).
- C2: unit (team created on the server after the last pull).
- C3: the C1 e2e asserts the loading screen during the delay.
- C4: unit (rows already local: true at once).
- C5: unit (missing row, unreachable server: false after the limit) + `referenceDataWaitMs(true)` is 30 s.
- C6: `referenceDataWaitMs(false)` is 0.

## Snapshots
None.

## Configuration, dependencies and schema
None.

## Machine capabilities
code, tests, browser-headless (e2e).

## Blocking decisions
None.
