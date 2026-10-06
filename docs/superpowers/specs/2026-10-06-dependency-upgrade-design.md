# Dependency Upgrade to Latest Stable — Design

**Date:** 2026-10-06
**Branch:** `chore/deps-upgrade` (worktree `.worktrees/chore-deps-upgrade`, created from `main` @ 4f8cf4b)

## Goal

The repository has been dormant since March 2026. Bring Next.js, the package
manager/toolchain and every dependency up to its latest stable version so the
project is supported and pleasant to work on again, without regressing the core
flows — in particular offline live match tracking.

## Decisions

| Topic | Decision |
|---|---|
| Scope | Everything to latest stable, in ordered phases (not core-only). |
| Production impact | Only the owner and a few testers use the app. Losing unsynced local RxDB data on upgrade is acceptable; wipe-and-resync from Supabase is the recovery path. |
| Verification | Restore and run the existing Playwright e2e suite (`tests/e2e`, 7 specs) as the gate for every phase. |
| Workspace | Dedicated worktree on `chore/deps-upgrade`. The main checkout at `C:\Development\GIT\volley-stats` is left untouched (it is a damaged copy: CRLF churn on ~200 files and 38 tracked files missing). |
| PWA | Replace unmaintained `next-pwa` 5.6.0 (webpack-only) with Serwist (`@serwist/turbopack`). |
| Package manager | Stay on pnpm (the `packageManager` field and `node_modules` layout already use it). The user's "update npm" means the toolchain. |

## Phase rule

Each phase ends with exactly one commit, and only when the phase is green
(see Verification). If the latest major of a package cannot be adopted —
an incompatible peer dependency, missing tooling support, or a removed feature
the app relies on that would require redesigning that feature — pin the highest
compatible version, record the package, pinned version and reason in the
**Pinned packages** section at the end of this document, and continue with the next phase. Do
not rewrite features to accommodate an upgrade.

## Phases

| # | Phase | Changes |
|---|---|---|
| 0 | Baseline | Copy `.env.local` and `.env.test.local` from the main checkout into the worktree (copy only, never read them). Set `packageManager` to pnpm 12.9.1. Delete stale `package-lock.json`. Add `engines.node` (`>=24`) and `.nvmrc` (`24`). `pnpm install`. Run build, lint and the e2e suite on the **current** versions; fix only test infrastructure if needed, never app code. Record the lint baseline (error count per rule). |
| 1 | Safe bumps | All minor/patch updates within existing ranges (Radix, `@supabase/supabase-js`, `next` 15.5.27, `react-hook-form`, `postcss`, etc.). No code changes expected. |
| 2 | Next 16 + React 19 | `next`, `react`, `react-dom`, `@types/react`, `@types/react-dom`, `eslint-config-next`, `@next/third-parties` to latest. Remove `@next/swc-wasm-nodejs`. Rename `middleware.ts` → `proxy.ts`. Remove the `eslint` key from `next.config.js`; replace the `next lint` script with the ESLint CLI and a flat config. Fix React 19 type/runtime breakages. Build scripts temporarily use `--webpack` so `next-pwa` keeps working and this phase is green on its own. |
| 3 | next-pwa → Serwist | Add `@serwist/turbopack` + `serwist`, write `app/sw.ts` using `defaultCache`, wire it into `next.config.js`, remove `next-pwa` and the `--webpack` flag. `.gitignore` keeps generated service-worker output out of git. `04-live-offline` must pass, including an offline reload of the live match page. |
| 4 | Tailwind 4 | Run `@tailwindcss/upgrade` to move to CSS-first config. `@tailwindcss/postcss` replaces `autoprefixer`; `tailwind-merge` 3; `tw-animate-css` replaces `tailwindcss-animate`. Before/after screenshot comparison. |
| 5 | Validation | `zod` 4 and `@hookform/resolvers` 5 (about 16 and 13 files respectively). |
| 6 | UI libraries | `lucide-react` 1.x, `react-day-picker` 10 (calendar component), `recharts` 3 (6 files), `framer-motion` 14, `react-dropzone` 20. The shadcn wrappers `components/ui/chart.tsx`, `resizable.tsx` and `sonner.tsx` are imported nowhere, so they are deleted instead of ported, and the then-unused `sonner` and `react-resizable-panels` packages are removed. Before/after screenshot comparison. |
| 7 | Utilities | `date-fns` 4, `uuid` 14 (+ `@types/uuid` if still needed), `jspdf` 4, `type-fest` 5, `dotenv` 18, `react-email` 6 + `@react-email/components` 1.x. |
| 8 | RxDB 17 | Upgrade following the RxDB 16→17 migration notes. The existing reset fallback in `lib/rxdb/database.ts` only runs in development or with `?remove-database=true`, so it cannot be relied on in production. Instead the local database name gets a generation suffix (`volleystats_db_v17`): v17 always starts from an empty database that `syncMatch` repopulates from Supabase, and IndexedDB databases left by v16 are deleted on startup. An e2e test restores a captured v16 IndexedDB and checks the live match still opens. |
| 9 | Tooling | `eslint` 10, then `typescript` 7 last. If Next's build-time type check or the ESLint TypeScript tooling does not support TS 7, pin TypeScript to the latest compatible version and record it in Pinned packages. |

The order runs from lowest to highest risk. Framework first, because most
libraries declare it as a peer dependency. RxDB and TypeScript last, because
they are the most likely to need a fallback.

## Verification

A phase is green when all of these pass in the worktree:

1. `pnpm exec tsc --noEmit`
2. `pnpm build`
3. Full Playwright suite against the local production server: run `pnpm start`
   (the service worker is disabled in dev), then
   `CI=1 BASE_URL=http://localhost:3000 pnpm test:e2e`. `BASE_URL` is set
   explicitly because `playwright.config.ts` has no `webServer` and the value in
   `.env.test.local` may point to a deployed site; dotenv does not override
   variables already set. `CI=1` runs headless. `07-team-detail-cleanup` stays
   last so test data created in the shared Supabase project is removed.
4. Lint reports no errors beyond the phase-0 baseline. Existing lint debt is
   recorded, not fixed.

Phases 4 and 6 additionally get before/after Playwright screenshots of the main
screens (home, teams, team detail, matches, live match, match stats,
championships, settings). Differences are reviewed and reported.

## Done

- Every dependency is on its latest stable version or listed under Pinned packages.
- One commit per phase on `chore/deps-upgrade`. The final commit is green.
- Docs reflect the new stack: `CLAUDE.md` tech stack line, and `.claude/docs/`
  references to versions, `next-pwa` and `middleware.ts`.
- Nothing is pushed or merged. The user receives a summary and decides how to integrate.

## Out of scope

- Fixing pre-existing lint debt or unrelated refactors.
- Repairing the damaged main checkout. Restore it later with `git checkout -- .`
  once nothing in it is needed.
- `feature/voice-stats` (21 unmerged commits, 86 files). It will need a rebase
  onto the upgraded `main` after this branch is merged. Expect conflicts in
  `package.json`, the lockfile and any shared files touched by phases 2–6.

## Pinned packages

_Filled in during execution. One row per package that could not reach latest._

| Package | Pinned at | Latest | Reason |
|---|---|---|---|
