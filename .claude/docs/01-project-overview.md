# Project Technical Overview

## Application Purpose
**VolleyStats** is a comprehensive indoor volleyball statistics management application designed for real-time match tracking, team management, and performance analytics. The application emphasizes offline-first functionality, allowing coaches and staff to track live matches without internet connectivity, with automatic synchronization when connectivity is restored.

## Core Tech Stack
- **Frontend Framework**: Next.js 15.5.2 (App Router) + React 18.3.1 + TypeScript 5.2.2
- **Database & Backend**: Supabase (PostgreSQL + Auth + Realtime subscriptions)
- **Offline Storage**: RxDB 16.19.0 with Dexie (IndexedDB)
- **UI Framework**: Tailwind CSS 3.3.3 + Shadcn/ui + Radix UI (40+ components)
- **PWA Support**: next-pwa 5.6.0 (Progressive Web App with service worker)

## Project Statistics
- **Total Lines**: ~9,000 lines of core business logic
- **Components**: 50+ UI components, 14 custom hooks
- **Database Tables**: 13 tables (mirrored between Supabase and RxDB)
- **API Modules**: 5 domain APIs (teams, matches, championships, clubs, seasons)
