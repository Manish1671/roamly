# Roamly — Implementation Status

**Last status review:** 2026-11-10 (M3 / 3A authentication)

**Last verified Git checkpoint:** unchanged — commit pending user action

---

## Milestone summary

| ID | Milestone | Status |
|----|-----------|--------|
| M1 | Product definition and architecture | **COMPLETE** |
| M2 | Project foundation | **COMPLETE** |
| M3 | Authentication and trip management | **IN PROGRESS** — **3A auth COMPLETE**; trips/invitations **NOT STARTED** |
| M4–M12 | … | **NOT STARTED** |

---

## M3 — Authentication (3A)

**Status:** COMPLETE for secure authentication scope (register, login, logout, me, sessions)

**Delivered:**

- Prisma `User` + `Session` models; migration `20251110120000_auth_user_session`
- Nest `AuthModule`: Argon2id, hashed session tokens, HTTP-only cookies, CSRF + trusted origin
- API: `GET/POST` routes under `/api/v1/auth/*`
- Shared Zod schemas in `@roamly/shared`
- Web: `/login`, `/register`, `/dashboard`, auth header, React Hook Form
- Tests: `auth.service.spec.ts`, `auth.e2e-spec.ts` (requires Postgres on `DATABASE_URL`)

**Pending (M3 remainder):**

- Trips, invitations, membership guards, trip UI

**Limitations:**

- OAuth deferred
- Rate limiting not added yet
- CI auth e2e skipped without Postgres service (unit + mocked tests still run)

---

## How to update this file

Update checkpoint after commit; mark trip work when landing.
