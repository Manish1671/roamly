# Roamly — Implementation Status

**Last status review:** 2026-11-11 (M4 / 4B destination voting)

**Last verified Git checkpoint:** unchanged — commit pending user action

---

## Milestone summary

| ID | Milestone | Status |
|----|-----------|--------|
| M1 | Product definition and architecture | **COMPLETE** |
| M2 | Project foundation | **COMPLETE** |
| M3 | Authentication and trip management | **COMPLETE** |
| M4 | Group intelligence & decisions | **COMPLETE** — **4A** preferences/recommendations; **4B** voting & finalization |
| M5–M12 | … | **NOT STARTED** |

---

## M4 / 4A — Group preferences, catalog & recommendations

**Status:** COMPLETE (implemented + tested locally with Postgres)

**Delivered:**

- Prisma: `CatalogDestination`, `MemberPreference`, `RecommendationSnapshot`; migration `20251111120000_group_intelligence`
- Pure package `@roamly/group-intelligence` (deterministic scoring, hard constraints, fairness)
- Curated **15** India destinations (`india-curated-v1`); idempotent DB seed on first catalog access
- `GroupIntelligenceModule`: preferences, catalog, recommendation snapshots
- Shared Zod/types in `packages/shared/src/preferences.ts`
- Web: `/trips/[tripId]/preferences`, `/trips/[tripId]/recommendations`
- Tests: engine unit tests, `group-intelligence.e2e-spec.ts`

**Deferred (post-M4):**

- External destination API providers (boundary ready via `DestinationCatalogProvider`)
- Playwright UI tests
- Email, maps, itinerary

---

## M4 / 4B — Destination voting & finalization

**Status:** COMPLETE (implemented + tested locally with Postgres)

**Delivered:**

- Prisma: `DestinationPoll`, `DestinationPollVote`, `TripDestinationDecision`; enum `PollStatus`; migration `20251111180000_destination_polls_voting` (partial unique index: one **OPEN** poll per trip)
- Shared types/Zod in `packages/shared/src/voting.ts` (`DEFAULT_MIN_PARTICIPATION_RATIO = 0.5`)
- API: `DestinationPollsService` + controller under `/trips/:tripId/polls` (create, list, vote, close, results, finalize, latest decision)
- Pure tally rules in `poll-results.ts` (participation, tie detection, finalization gates)
- Permissions: `VOTE_ON_POLL` (all accepted roles incl. **VIEWER**); `MANAGE_POLL` (owner/editor)
- Web: poll from recommendations snapshot, `/trips/[tripId]/polls/[pollId]`, finalized destination on trip workspace
- Tests: `poll-results.spec.ts` (4 unit), `destination-polls.e2e-spec.ts` (3 integration flows), permission spec updates

**Voting rules (product):**

- **Eligibility:** every accepted `TripMembership` row (owner, editor, member, viewer); one vote per poll (`@@unique([pollId, userId])`).
- **Poll lifecycle:** `OPEN` → `CLOSED` (owner/editor) → `FINALIZED` (explicit finalize after close).
- **Participation for finalize:** at least **50%** of eligible members voted (`DEFAULT_MIN_PARTICIPATION_RATIO`), **>0** votes, single leader (no tie).
- **Ties / no votes / low participation:** finalize rejected with `finalizeBlockReason`; no silent winner.
- **History:** `TripDestinationDecision` immutable per poll; re-finalize same poll returns **409**; new decisions require a new poll workflow.

---

## M3 — Trip management

**Status:** COMPLETE (see prior sections in git history / README)

---

## Verification (2026-11-11, local)

| Command | Result |
|---------|--------|
| `pnpm lint` | Pass |
| `pnpm typecheck` | Pass |
| `pnpm test` | Pass (API **38** Jest tests; `@roamly/group-intelligence` **8** unit tests; workspace total **50**) |
| `pnpm build` | Pass |

PostgreSQL required for API integration tests (CI uses service container + `prisma migrate deploy`).

---

## How to update this file

Update after commits; mark M5+ when next milestone lands.
