# Project Technical Overview

## Application Purpose
**VolleyStats** is a comprehensive indoor volleyball statistics management application designed for real-time match tracking, team management, and performance analytics. Live match tracking works offline, so coaches and staff can track a match without internet connectivity and the data synchronizes to Supabase when connectivity is restored. The other screens read and write live Supabase data.

## Core Tech Stack
- **Frontend Framework**: Next.js 15 (App Router) + React 18 + TypeScript 5
- **Database & Backend**: Supabase (PostgreSQL + Auth + Realtime subscriptions)
- **Offline Storage (live match)**: RxDB 16 with Dexie (IndexedDB)
- **UI Framework**: Tailwind CSS 3 + Shadcn/ui + Radix UI
- **Internationalization**: next-intl, with translations in `messages/`
- **PWA Support**: next-pwa (Progressive Web App with service worker)
- **E2E Tests**: Playwright (`tests/e2e/`)
