# Roamly — Engineering Decisions

Authoritative technical choices for implementation. Items marked **deferred** are intentionally unset until a later milestone.

## Monorepo and package management

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Repository layout | **pnpm workspace monorepo** | Shared types, pure algorithms, geo contracts without publishing |
| Package manager | **pnpm** | Strict dependency graph, efficient installs |

**Workspace packages:**

| Package | Purpose |
|---------|---------|
| `apps/web` | Next.js App Router frontend |
| `apps/api` | NestJS modular monolith (REST + WebSocket gateway) |
| `packages/shared` | Zod schemas, DTO types, enums, API error codes |
| `packages/itinerary-engine` | Pure TS: destination scoring, conflicts, route heuristics, settlement math |
| `packages/geo-contracts` | Provider-neutral interfaces and DTOs (implementations live in `apps/api`) |

## Frontend stack

| Decision | Choice |
|----------|--------|
| Framework | Next.js App Router |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Components | shadcn/ui |
| Server state | TanStack Query |
| Forms | React Hook Form + Zod (shared with API) |
| Maps | MapLibre GL JS |

## Backend stack

| Decision | Choice |
|----------|--------|
| Framework | NestJS modular monolith |
| API | REST initially |
| Real-time | WebSockets (trip rooms); events **after** DB commit |
| Language | TypeScript |
| ORM | Prisma |
| Database | PostgreSQL (source of truth) |

## Authentication (final)

| Decision | Choice |
|----------|--------|
| Model | **Server-side sessions** |
| Session token | Cryptographically random; sent to client once |
| Persistence | **Hashed token only** in PostgreSQL (`Session.tokenHash`) |
| Transport | **HTTP-only, Secure** cookie (SameSite=Lax or Strict per CSRF strategy) |
| Lifetime | Configurable expiration; **revocation** via session delete / logout-all |
| Passwords | **Argon2id** (or bcrypt) — never store plaintext |
| CSRF | Required for cookie-based mutating requests (double-submit or synchronizer token) |
| Origin | Trusted-origin validation on auth and mutation endpoints |
| OAuth | **Deferred** post-M3 |

**Authentication vs authorization:** Authentication establishes *who* the user is (session → `User`). Authorization decides *what* they may do (trip **TripMember** role, route-level `@Roles()`). Never infer trip access from client-supplied `userId`.

## Authorization and RBAC (final)

| Role | Typical permissions |
|------|---------------------|
| **organizer** | Trip settings, invitations, role changes, replan approval, status transitions, all member capabilities |
| **member** | Preferences, votes, itinerary edit (if trip policy allows), expenses, bookings, files |
| **viewer** | Read-only trip workspace |

Enforcement: Nest guards — `SessionAuthGuard` → `TripMembershipGuard` → `TripRolesGuard` where needed. **Every** trip-scoped route loads membership from DB; no trip id-only trust.

## Itinerary consistency (final)

| Decision | Choice |
|----------|--------|
| Current revision | **`Trip.itineraryRevisionNumber`** (integer, monotonic) |
| Mutations | Require **`expectedRevision`** matching `Trip.itineraryRevisionNumber` |
| Stale client | **HTTP 409 Conflict** with server revision in body |
| History | **`TripRevision`** row created in the **same transaction** as mutation + bump |
| Real-time | WebSocket broadcast **only after** transaction commits |

Material itinerary changes increment revision and append audit row. Read-only conflict checks do not bump revision.

## Maps and geo providers (final)

| Decision | Choice |
|----------|--------|
| Rendering | MapLibre GL JS |
| Contracts | `@roamly/geo-contracts` — no Nest/Prisma in package |
| Initial provider | **Geoapify** (candidate) in `GeoProvider` adapter inside api |
| Replaceability | Business modules depend on `GeoService` interface only |
| Tests / CI | **Stub provider** + fixtures |
| Degradation | Saved trips readable; search/routing/live matrix optional when provider down |

Credentials: environment variables only.

## Recommendation intelligence (final)

| Decision | Choice |
|----------|--------|
| Algorithm | **Deterministic, explainable** scoring in `@roamly/itinerary-engine` |
| Versioning | **`algorithmVersion`** string constant in engine; stored on each snapshot |
| Persistence | **`RecommendationSnapshot`** per compute run (not ephemeral-only) |
| Snapshot contents | `tripId`, `algorithmVersion`, `preferenceSnapshotJson`, candidate ids, `scoreBreakdownJson`, ranked order, `createdAt`, `createdById` (optional) |
| Audit | Users can compare rankings over time as preferences change |

No ML/LLM in ranking or replan core rules.

## File storage (final)

| Decision | Choice |
|----------|--------|
| Abstraction | **`StorageAdapter`** interface (put, get stream, delete, exists) |
| Development | **Local filesystem** under configurable base path |
| PostgreSQL | **Metadata only** (`FileAsset`); no large binaries in DB |
| Production provider | **Deferred** until M12 release planning (`docs/DEPLOY.md`) |

Downloads via authenticated API proxy or short-lived signed URLs — never public guessable paths.

## Async processing: Redis and BullMQ (final)

| Decision | Choice |
|----------|--------|
| Redis | Introduced when async work justifies it (M6+ matrix prefetch, M11 replan batch, M12 digests) |
| Queue | **BullMQ** on Redis |
| Default | Synchronous request path until latency/cost requires queue |

**Job failure and retry (when BullMQ is adopted):**

- Default: **3 attempts**, exponential backoff (e.g. 1s, 4s, 16s).
- **Idempotent job handlers** keyed by `jobId` or business idempotency key stored in PostgreSQL.
- Permanent failure → `failed` state + structured log; optional dead-letter queue table for admin replay.
- Jobs must not partially apply itinerary changes outside a DB transaction; prefer job output → user-triggered apply or single transactional apply step.

## Real-time architecture (final)

| Decision | Choice |
|----------|--------|
| Initial deploy | **Single API instance** |
| WS auth | Same session as HTTP; trip room join verifies membership |
| Events | Payload: `tripId`, `type`, `itineraryRevisionNumber` (if relevant), entity hints |
| Scale-out | **Redis WebSocket adapter deferred** until horizontal scaling required |

## Deployment (final)

| Decision | Choice |
|----------|--------|
| Hosting selection | **Not chosen** before release phase |
| Release artifact | **`docs/DEPLOY.md`** created in **M12** with environment, migrations, secrets, TLS |

## Algorithms package (final)

| Decision | Choice |
|----------|--------|
| Package | `@roamly/itinerary-engine` |
| Purity | No NestJS, Prisma, HTTP, or geo provider imports |
| Inputs/outputs | Plain objects; geo durations passed in as numbers |
| Optimisation | Practical heuristics; limitations documented in product UI and tests |

## Money

| Decision | Choice |
|----------|--------|
| Amounts | Integer **minor units** + ISO 4217 currency |
| FX | Deferred — one default currency per trip |

## Testing and CI

| Layer | Tool |
|-------|------|
| Unit | Jest — engine, settlement, guards helpers |
| API | Jest + Supertest — auth, membership, 409 revision, idempotency |
| E2E | Playwright — milestone acceptance flows |
| CI | GitHub Actions — lint, typecheck, unit/integration; Playwright on main or nightly |

**Security test boundaries:** Supertest suites use test DB; never hit real Geoapify in CI (stub). Session cookies tested for httpOnly flags in integration tests where feasible.

## Idempotency (final pattern)

| Operation | Mechanism |
|-----------|-----------|
| Accept invitation | Unique `(tripId, userId)` membership; accept token single-use |
| Vote | Unique `(pollId, userId)` |
| Retryable POST | Optional `Idempotency-Key` header → store hash + response in `IdempotencyRecord` (TTL) for expenses/uploads |
| Itinerary mutate | **`expectedRevision`** — not idempotent across versions; retries must refresh revision |

## Documentation and API contracts

- Shared Zod in `packages/shared`.
- OpenAPI from Nest: optional M3+.

## Deferred decisions (do not assume)

| Topic | Status |
|-------|--------|
| Production file storage vendor (S3, R2, etc.) | Deferred to M12 |
| Production hosting (web + api topology) | Deferred to M12 |
| Redis WS adapter | Deferred until multi-instance |
| OAuth providers | Deferred post-M3 |
| Email notifications provider | Deferred |
| OpenAPI publish pipeline | Optional |

---

*Related: [ARCHITECTURE.md](./ARCHITECTURE.md), [ROADMAP.md](./ROADMAP.md), [PRODUCT_SPEC.md](./PRODUCT_SPEC.md), [../IMPLEMENTATION_STATUS.md](../IMPLEMENTATION_STATUS.md)*
