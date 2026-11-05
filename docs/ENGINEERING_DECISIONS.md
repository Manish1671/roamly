# Roamly — Engineering Decisions

This document records **final or provisional** technical choices for Roamly. Provisional items are marked **DECISION NEEDED** and listed in the completion review.

## Monorepo and package management

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Repository layout | **pnpm workspace monorepo** | Shared types, test utilities, and optional `@roamly/itinerary-engine` package without publishing |
| Package manager | **pnpm** | Efficient disk use, strict dependency graph, common in TS monorepos |

**Proposed workspace packages (names provisional):**

- `apps/web` — Next.js App Router frontend
- `apps/api` — NestJS REST (+ WebSocket gateway later)
- `packages/shared` — Zod schemas, DTO types, constants shared by web and api
- `packages/itinerary-engine` — Pure TS: scoring helpers, conflict detection, route-order heuristics (no Nest imports)
- `packages/geo-contracts` — Provider interfaces + DTOs for geocode/places/routing (implementations in api)

No packages installed in the architecture phase; structure applied in **M2 Project foundation**.

## Frontend stack

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Framework | **Next.js App Router** | SSR/SSG where useful, colocated routes, industry standard |
| Language | **TypeScript** | End-to-end typing with shared package |
| Styling | **Tailwind CSS** | Utility-first, fast iteration |
| Components | **shadcn/ui** | Accessible primitives, owned source in repo |
| Server state | **TanStack Query** | Cache, retries, optimistic patterns with revision headers |
| Forms | **React Hook Form + Zod** | Shared schemas with backend validation |
| Maps | **MapLibre GL JS** | Open renderer; tiles/sources configured per environment |

## Backend stack

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Framework | **NestJS** | Modular monolith, DI, guards, WebSocket support |
| API style | **REST** first | Predictable CRUD and command endpoints; OpenAPI later optional |
| Real-time | **WebSockets** (Nest gateway) | Trip rooms; events reflect **after** DB persistence |
| Language | **TypeScript** | Shared types with frontend |
| ORM | **Prisma** | PostgreSQL-first, migrations, type-safe client |
| Database | **PostgreSQL** | Source of truth, JSONB for provider payloads where needed |

## Maps and geo providers

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Initial provider candidate | **Geoapify** | Geocoding, places, routing in one vendor; free tier for development |
| Integration pattern | **Provider abstraction** in `packages/geo-contracts`; implementation `GeoapifyGeoProvider` in api | Business logic depends on interfaces only |
| Failure mode | **Null/stub provider** + cached results | Trips remain accessible; map features degrade gracefully |
| Paid API assumption | **None** | Development and CI use mocks, recorded fixtures, or stub provider |

**Abstraction surface (conceptual):**

- `geocode(query, bounds?) → GeoPoint[]`
- `reverseGeocode(point) → Address`
- `searchPlaces(query, near, categories?) → PlaceResult[]`
- `route(waypoints, profile) → RouteLeg[]` (duration, distance, polyline optional)

Credentials via environment variables only; never committed.

## Async processing and cache

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Redis | **Introduce only when justified** | e.g. BullMQ job queue for bulk routing matrix, email digests, heavy replan jobs |
| BullMQ | **Same gate as Redis** | Not in M2–M3; evaluate at M6 (matrix prefetch) or M11 (replan batch) |
| In-process first | **Default** | Nest `@nestjs/schedule` or synchronous request for small groups |

## Testing

| Layer | Tool | Scope |
|-------|------|--------|
| Unit | **Jest** | Domain services, itinerary-engine, expense math |
| API integration | **Jest + Supertest** | Auth, membership guards, REST contracts |
| E2E | **Playwright** | Critical flows per roadmap milestone |

CI: **GitHub Actions** — lint, typecheck, unit/integration on PR; Playwright on main or nightly initially.

## Infrastructure (development)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Local dependencies | **Docker Compose** | PostgreSQL; Redis added when BullMQ adopted |
| Production hosting | **DECISION NEEDED** | Vercel (web) + fly/railway/render (api) vs. single VPS — cost and ops tradeoff |

## Architecture style

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Service topology | **Modular monolith** | One deployable API; clear module boundaries |
| Business logic location | **Domain services** | Not in controllers; controllers validate + delegate |
| Algorithms | **`packages/itinerary-engine` + unit tests** | Independent of HTTP and Prisma where possible |
| AI in core rules | **Excluded** | Destination ranking and replan suggestions use deterministic rules + heuristics; optional AI summaries are out of initial scope |
| Microservices | **Excluded** | Complexity not justified for initial product |

## Security and auth (provisional)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Session model | **Server-side sessions or JWT with refresh** | **DECISION NEEDED** — see unresolved list |
| Password storage | **bcrypt or argon2** | Standard practice when email/password used |
| OAuth | **Optional post-M3** | Google/Apple as convenience |
| Authorization | **Trip membership + role guards** | Every mutating trip route checks `TripMember` |

## Money

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Storage | **Integer minor units** (e.g. cents) + ISO 4217 currency code per expense/trip default | Avoid float errors |
| FX | **Out of scope initially** | Single currency per trip default |

## Files and uploads

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Storage | **Local disk dev; S3-compatible prod** | **DECISION NEEDED** on provider |
| Metadata | **FileAsset in PostgreSQL** | Path/key, mime, size, uploader, tripId |

## WebSockets

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Event payload | **Entity id + revision + change type** | Clients refetch or merge via Query invalidation |
| Source of truth | **PostgreSQL** | WS never sole persistence |
| Scale | **Single API instance sticky sessions or Redis adapter later** | **DECISION NEEDED** before multi-instance prod |

## Versioning and concurrency

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Itinerary versioning | **TripRevision** rows with monotonic `revisionNumber` | Audit + collaboration |
| Optimistic concurrency | **`If-Match: revision` or body `expectedRevision`** | 409 on conflict |

## External API cost control

- Rate limit and cache geocode/route responses (trip-scoped TTL).
- Batch routing matrix only for days being edited.
- Feature flags to disable live routing in CI and demo mode.

## Documentation and API contracts

- Shared Zod schemas in `packages/shared` as contract source.
- OpenAPI generation from Nest **optional** in M3+.

---

*Related documents: [ARCHITECTURE.md](./ARCHITECTURE.md), [ROADMAP.md](./ROADMAP.md), [PRODUCT_SPEC.md](./PRODUCT_SPEC.md)*
