# Roamly

Collaborative travel intelligence and planning for groups—shared preferences, explainable destination fit, constraint-aware itineraries, real-time collaboration, shared expenses, and human-approved replanning when plans change.

## Documentation

| Document | Description |
|----------|-------------|
| [docs/PRODUCT_SPEC.md](docs/PRODUCT_SPEC.md) | Product vision, domains, glossary |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Modular monolith, data model, concurrency, security |
| [docs/ENGINEERING_DECISIONS.md](docs/ENGINEERING_DECISIONS.md) | Stack and finalized technical choices |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Milestones M1–M12 |
| [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md) | Milestone progress |

## Architecture summary

- **Monorepo:** pnpm workspaces — `apps/web` (Next.js), `apps/api` (NestJS), shared packages
- **Data:** PostgreSQL + Prisma (source of truth)
- **API:** REST under `/api/v1` (WebSockets in a later milestone)
- **Packages:** `@roamly/shared`, `@roamly/geo-contracts`, `@roamly/itinerary-engine` (pure TS)

## Repository structure

```text
apps/
  web/          Next.js App Router frontend
  api/          NestJS API (health + config in M2)
packages/
  shared/       Shared constants and contracts
  geo-contracts/ Provider-neutral geo interfaces
  itinerary-engine/ Pure itinerary/scoring utilities
docs/           Product and architecture documentation
docker-compose.yml   Local PostgreSQL
```

## Prerequisites

- **Node.js** ≥ 20.11
- **pnpm** 9.15 (`corepack enable` recommended)
- **Docker Desktop** (or compatible engine) for local PostgreSQL

## Installation

```bash
git clone <repository-url>
cd Roamly
pnpm install
```

## Environment setup

1. Copy the example environment file:

   ```bash
   cp .env.example .env
   cp .env.example apps/api/.env
   ```

   (`apps/api/.env` is required for Prisma CLI; keep the same `DATABASE_URL` as the root `.env`.)

2. Adjust values if needed. Defaults match Docker Compose credentials.

   Local development maps PostgreSQL to **host port `5434`** (container port `5432`) so Roamly does not conflict with other PostgreSQL stacks on this machine (e.g. Sentinel on `5432`, Outbox on `5433`). Set `POSTGRES_PORT` and use that port in `DATABASE_URL` on the host (Prisma, NestJS). Services inside Compose would use hostname `postgres` and port `5432`.

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Prisma / PostgreSQL connection string |
| `POSTGRES_*` | Docker Compose PostgreSQL settings (`POSTGRES_PORT` = host port) |
| `API_PORT` | NestJS listen port (default `3001`) |
| `CORS_ORIGINS` | Allowed browser origins (comma-separated) |
| `NEXT_PUBLIC_API_URL` | Web app API base URL |
| `SESSION_SECRET` | ≥32 chars; hashes session tokens server-side |
| `SESSION_TTL_HOURS` | Session lifetime (default `168`) |
| `COOKIE_SECURE` | Set `true` in production behind HTTPS |

## Start PostgreSQL

```bash
docker compose up -d
docker compose ps
```

Wait until the `postgres` service is **healthy**.

## Database commands

Prisma lives in `apps/api/prisma/`. Run from the repository root:

```bash
# Generate Prisma client (also runs on pnpm install via apps/api postinstall)
pnpm db:generate

# Apply migrations (M2 init migration; domain tables in M3+)
pnpm db:migrate

# Optional: open Prisma Studio
pnpm db:studio
```

**Migration workflow:** schema changes go in `apps/api/prisma/schema.prisma` → `pnpm db:migrate` (creates migration SQL) → commit migration folder → CI/production uses `prisma migrate deploy`.

## Run frontend and backend

```bash
# Both apps (ports 3000 and 3001)
pnpm dev

# Or individually
pnpm --filter @roamly/web dev
pnpm --filter @roamly/api dev
```

- **Web:** [http://localhost:3000](http://localhost:3000)
- **API health:** [http://localhost:3001/api/v1/health](http://localhost:3001/api/v1/health)

The API starts even if PostgreSQL is down; health reports `degraded` until the database is reachable.

## Quality checks

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Optional formatting:

```bash
pnpm format:check
pnpm format
```

## CI

GitHub Actions workflow (`.github/workflows/ci.yml`) runs on pushes and PRs to `main`: install, Prisma generate, **migrate deploy**, lint, typecheck, test, and build. A **PostgreSQL 16** service container backs auth and trip integration tests. Health e2e still mocks Prisma when checking liveness only.

## Authentication (M3 / 3A)

Session-based auth is implemented: register, login, logout, and `GET /auth/me`. The API sets an HTTP-only `roamly_session` cookie; mutating routes require a CSRF token from `GET /auth/csrf` plus a trusted `Origin`.

Web routes: `/register`, `/login`, `/dashboard`.

## Trip management (M3 / 3B)

Collaborative trips, membership roles, and in-app invitations (registered users only; no outbound email).

All routes are under `/api/v1`, session-authenticated. Mutations also require CSRF + trusted `Origin` (same as auth).

| Area | Method | Path |
|------|--------|------|
| Trips | `POST` | `/trips` |
| | `GET` | `/trips` |
| | `GET` | `/trips/:tripId` |
| | `PATCH` | `/trips/:tripId` |
| | `POST` | `/trips/:tripId/archive` |
| Members | `GET` | `/trips/:tripId/members` |
| | `PATCH` | `/trips/:tripId/members/:userId` |
| | `DELETE` | `/trips/:tripId/members/:userId` |
| Invitations | `POST` | `/trips/:tripId/invitations` |
| | `GET` | `/trips/:tripId/invitations` |
| | `GET` | `/invitations` (current user’s inbox) |
| | `POST` | `/invitations/:invitationId/accept` |
| | `POST` | `/invitations/:invitationId/decline` |
| | `POST` | `/trips/:tripId/invitations/:invitationId/revoke` |

Web routes: `/dashboard` (trip buckets + pending invites), `/trips/new`, `/trips/[tripId]`.

Apply migration `20251110180000_trip_membership_invitations` after pulling (`pnpm --filter @roamly/api exec prisma migrate deploy`).

## Current milestone

**M3 — Authentication and trip management** is implemented (3A + 3B).

See [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md) for detailed progress.
