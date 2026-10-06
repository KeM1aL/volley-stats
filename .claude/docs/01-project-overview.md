# Project Technical Overview

## Application Purpose
**VolleyStats** is a comprehensive indoor volleyball statistics management application designed for real-time match tracking, team management, and performance analytics. Live match tracking works offline, so coaches and staff can track a match without internet connectivity and the data synchronizes to Supabase when connectivity is restored. The other screens read and write live Supabase data.

## Core Tech Stack
- **Frontend Framework**: Next.js 16 (App Router, Turbopack) + React 19 + TypeScript 6
- **Database & Backend**: Supabase (PostgreSQL + Auth + Realtime subscriptions)
- **Offline Storage (live match)**: RxDB 17 with Dexie (IndexedDB)
- **UI Framework**: Tailwind CSS 4 (CSS-first config in app/globals.css) + Shadcn/ui + Radix UI
- **Internationalization**: next-intl, with translations in `messages/`
- **PWA Support**: Serwist (`app/sw.ts`, served by `app/serwist/[path]/route.ts`)
- **E2E Tests**: Playwright (`tests/e2e/`)
