# Roamly — Implementation Status

Tracks milestone progress against [docs/ROADMAP.md](docs/ROADMAP.md). Application implementation milestones **M2–M12** are **NOT STARTED** until explicitly updated here.

**Last verified Git checkpoint:** `9d3b4750b6449696baf69e1c3253e30b3c3e3f22` — `chore: initialise Roamly project documentation`

**Last status review:** 2026-11-05 (documentation blueprint finalisation)

---

## Milestone summary

| ID | Milestone | Status |
|----|-----------|--------|
| M1 | Product definition and architecture | **COMPLETE** |
| M2 | Project foundation | **NOT STARTED** |
| M3 | Authentication and trip management | **NOT STARTED** |
| M4 | Group intelligence | **NOT STARTED** |
| M5 | Maps and location discovery | **NOT STARTED** |
| M6 | Itinerary engine | **NOT STARTED** |
| M7 | Collaboration | **NOT STARTED** |
| M8 | Wallet | **NOT STARTED** |
| M9 | Bookings and documents | **NOT STARTED** |
| M10 | Live trip | **NOT STARTED** |
| M11 | Adaptive replanning | **NOT STARTED** |
| M12 | Memories and production release | **NOT STARTED** |

---

## M1 — Product definition and architecture

**Status:** COMPLETE

**Completed work:**

- Product spec, architecture, engineering decisions, and roadmap authored.
- Blueprint finalised: server-side sessions, trip itinerary revision concurrency, recommendation snapshots, storage abstraction, geo stub, single-instance WS, deferred production hosting.
- Root `README.md` and this status file added.

**Pending work:** None for M1.

**Blockers:** None.

---

## M2 — Project foundation

**Status:** NOT STARTED

**Completed work:** None.

**Pending work:**

- pnpm workspace (`apps/web`, `apps/api`, `packages/shared`, `packages/geo-contracts`, `packages/itinerary-engine`).
- Docker Compose PostgreSQL; README run instructions.
- NestJS health + Config; Next.js shell; GitHub Actions CI skeleton.
- No feature modules beyond health/config.

**Blockers:** None.

---

## M3 — Authentication and trip management

**Status:** NOT STARTED

**Completed work:** None.

**Pending work:** Session auth, trips, invitations, membership guards, Prisma models for User/Session/Trip/TripMember/TripInvitation, web auth and trip CRUD UI.

**Blockers:** Depends on M2.

---

## M4 — Group intelligence

**Status:** NOT STARTED

**Completed work:** None.

**Pending work:** Preferences, destinations, polls/votes, itinerary-engine scoring, **RecommendationSnapshot** persistence, explainable ranking UI.

**Blockers:** Depends on M3.

---

## M5 — Maps and location discovery

**Status:** NOT STARTED

**Completed work:** None.

**Pending work:** geo-contracts, Geoapify adapter + stub, MapLibre UI, Place/SavedPlace.

**Blockers:** Depends on M3.

---

## M6 — Itinerary engine

**Status:** NOT STARTED

**Completed work:** None.

**Pending work:** TripDay/Item/Revision, `expectedRevision` / 409, optimisation heuristics, optional BullMQ for matrix jobs.

**Blockers:** Depends on M3, M5.

---

## M7 — Collaboration

**Status:** NOT STARTED

**Completed work:** None.

**Pending work:** WebSocket gateway, post-commit broadcast, client invalidation, 409 UX.

**Blockers:** Depends on M6.

---

## M8 — Wallet

**Status:** NOT STARTED

**Completed work:** None.

**Pending work:** Expenses, splits, settlements (minor units).

**Blockers:** Depends on M3.

---

## M9 — Bookings and documents

**Status:** NOT STARTED

**Completed work:** None.

**Pending work:** Booking CRUD with confirmed flag, FileAsset + local StorageAdapter.

**Blockers:** Depends on M3; M6 for item linking.

---

## M10 — Live trip

**Status:** NOT STARTED

**Completed work:** None.

**Pending work:** Active trip “today” command center, status transitions.

**Blockers:** Depends on M6, M9 recommended.

---

## M11 — Adaptive replanning

**Status:** NOT STARTED

**Completed work:** None.

**Pending work:** ReplanningProposal workflow, booking/lock preservation, organizer approval.

**Blockers:** Depends on M6, M9; M5 for alternatives when geo available.

---

## M12 — Memories and production release

**Status:** NOT STARTED

**Completed work:** None.

**Pending work:** TripMemory, templates, **`docs/DEPLOY.md`**, production hardening, regression E2E.

**Blockers:** Depends on prior milestones; production storage/hosting choices deferred until this phase.

---

## Cross-cutting blockers

| Blocker | Impact | Resolution phase |
|---------|--------|------------------|
| Production hosting not selected | No prod deploy | M12 |
| Production object storage not selected | No prod uploads | M12 |
| Redis/BullMQ not provisioned | Async jobs run sync or skip | M6+ when enabled |
| Geoapify API key not configured | Live geo in dev only | M5 (optional env) |

---

## How to update this file

When a milestone is completed, set status to **COMPLETE**, list delivered artifacts (paths/modules), update **Last verified Git checkpoint** after commit, and clear pending work for that milestone.
