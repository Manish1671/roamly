# Roamly

Collaborative travel intelligence and planning for groups—shared preferences, explainable destination fit, constraint-aware itineraries, real-time collaboration, shared expenses, and human-approved replanning when plans change.

Roamly is **not** a booking marketplace or payment processor. Members record bookings and settle expenses in the product; external reservations stay manual in early releases.

## Documentation

| Document | Description |
|----------|-------------|
| [docs/PRODUCT_SPEC.md](docs/PRODUCT_SPEC.md) | Product vision, domains, glossary |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Modular monolith, data model, concurrency, security |
| [docs/ENGINEERING_DECISIONS.md](docs/ENGINEERING_DECISIONS.md) | Stack and finalized technical choices |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Milestones M1–M12 with acceptance criteria |
| [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md) | Milestone progress and blockers |

## Planned stack

- **Monorepo:** pnpm workspaces (`apps/web`, `apps/api`, shared packages)
- **Frontend:** Next.js, TypeScript, Tailwind, shadcn/ui, TanStack Query, MapLibre
- **Backend:** NestJS REST + WebSockets, Prisma, PostgreSQL
- **Algorithms:** `@roamly/itinerary-engine` (pure TypeScript)
- **Geo:** `@roamly/geo-contracts` + pluggable provider (Geoapify candidate; stub for tests)
- **Async (when justified):** Redis + BullMQ
- **Local data:** Docker Compose for PostgreSQL

Implementation has **not** started beyond architecture documentation. The next milestone is **M2 — Project foundation** (see roadmap).

## Repository status

See [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md) for milestone tracking and last verified Git checkpoint.
