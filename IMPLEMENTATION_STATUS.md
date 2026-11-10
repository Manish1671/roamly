# Roamly — Implementation Status

**Last status review:** 2026-11-11 (M3 verification + test hardening)

**Last verified Git checkpoint:** unchanged — commit pending user action

---

## Milestone summary

| ID | Milestone | Status |
|----|-----------|--------|
| M1 | Product definition and architecture | **COMPLETE** |
| M2 | Project foundation | **COMPLETE** |
| M3 | Authentication and trip management | **COMPLETE** (3A + 3B verified locally) |
| M4–M12 | … | **NOT STARTED** |

---

## M3 — Authentication (3A)

**Status:** COMPLETE

**Delivered:**

- Prisma `User` + `Session` models; migration `20251110120000_auth_user_session`
- Nest `AuthModule`: Argon2id, hashed session tokens, HTTP-only cookies, CSRF + trusted origin
- API: `GET/POST` routes under `/api/v1/auth/*`
- Shared Zod schemas in `@roamly/shared`
- Web: `/login`, `/register`, `/dashboard`, auth header, React Hook Form
- Tests: `auth.service.spec.ts`, `auth.e2e-spec.ts`

**Limitations:**

- OAuth deferred
- Rate limiting not added yet
- CI runs Postgres 16 service + `prisma migrate deploy`; auth/trips e2e **fail fast** if the database is unreachable (no silent skip)

---

## M3 — Trip management, invitations, membership (3B)

**Status:** COMPLETE (implemented + tested locally with Postgres on `DATABASE_URL`)

**Delivered:**

- Prisma `Trip`, `TripMembership`, `TripInvitation`; enums `TripRole`, `InvitationStatus`
- Migration `20251110180000_trip_membership_invitations` (partial unique index: one `PENDING` invite per trip + invitee)
- Nest `TripsModule`: `TripAuthorizationService`, permission helpers, trip/member/invitation services
- Non-members receive **404** on trip-scoped routes (no membership enumeration via trip id)
- Archived trips: read-only; no new invitations
- Shared Zod schemas in `packages/shared/src/trips.ts`
- Web: dashboard buckets + pending invites, `/trips/new`, `/trips/[tripId]` workspace
- Tests: `trip-permissions.spec.ts`, `trips.e2e-spec.ts` (archived trip, editor RBAC, last owner, concurrent accept)

**Deferred (out of 3B scope):**

- Email delivery for invitations (in-app discovery only)
- Itinerary, maps, expenses, real-time, WebSockets
- Invite-by-email for users who are not yet registered

**Role naming note:** M3 uses `OWNER | EDITOR | MEMBER | VIEWER`. Older architecture prose may say “organizer”; see [docs/ENGINEERING_DECISIONS.md](docs/ENGINEERING_DECISIONS.md).

---

## Verification (2026-11-10, local)

| Command | Result |
|---------|--------|
| `pnpm lint` | Pass |
| `pnpm typecheck` | Pass |
| `pnpm test` | Pass (API: 21 Jest tests incl. auth + trips e2e) |
| `pnpm build` | Pass |

Requires Postgres for full API e2e (default test URL uses port **5434** when configured in `apps/api/test/set-env.ts`).

---

## How to update this file

Update checkpoint after commit; extend M4+ sections as milestones land.
