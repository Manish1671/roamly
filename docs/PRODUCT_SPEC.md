# Roamly — Product Specification

## Overview

**Roamly** is a collaborative group travel planning and management platform. Groups use a single shared workspace to plan, coordinate, manage, and adapt trips together—from early preference gathering through travel day and post-trip memories.

Roamly is **not** an airline booking marketplace or payment processor. Reservations and payments are tracked and managed in the product; actual booking with external merchants is initially **manual entry** by trip members.

## Product vision

Help groups of people plan, coordinate, manage, and adapt their trips through one shared workspace, with transparency in group decisions, practical itineraries grounded in time and geography, and graceful handling of change during the trip.

## End-to-end product journey

| Step | Stage | User outcome |
|------|--------|--------------|
| 1 | Create & invite | A trip exists; members join with clear roles |
| 2 | Preferences & constraints | Group availability, budgets, and travel preferences are visible |
| 3 | Destination decisions | Compare options with explainable group compatibility |
| 4 | Discovery | Find places via maps and location search |
| 5 | Itinerary construction | Day plans respect travel time and schedule constraints |
| 6 | Collaboration | Multiple members edit and discuss the same trip safely |
| 7 | Wallet | Budgets, expenses, and settlements stay fair and auditable |
| 8 | Bookings & documents | Confirmations and files are stored per trip |
| 9 | Travel day | A command center for “today” on the trip |
| 10 | Disruptions | Alternative plans suggested; humans approve changes |
| 11 | Closure | Memories and reusable templates from completed trips |

## Signature capabilities

These three capabilities differentiate Roamly and drive core product and engineering investment.

### 1. Explainable group destination compatibility

- Combine **hard constraints** (must avoid, budget caps, date windows) with **soft preferences** (climate, pace, interests).
- Score each member’s fit to a destination candidate and aggregate into **group satisfaction** with attention to **fairness** (no single member always overridden).
- Present **ranked results with explanations** (which constraints matched, who is least satisfied and why)—not opaque scores.

### 2. Constraint-aware itinerary planning and route optimisation

- Plan visits with **duration**, **inter-travel time**, **opening hours** when data exists, **time conflicts**, and **locked** activities.
- Suggest **visit order** within a day or across stops using heuristics; document limitations vs. true global optimisation.
- Keep saved itineraries usable when map/routing providers fail.

### 3. Adaptive itinerary replanning with human approval

- On disruption (delay, closure, weather signal entered by users), **identify affected items**, **preserve confirmed bookings**, propose **alternatives**, and store **versioned proposals**.
- **No automatic overwrite** of the live itinerary without explicit approval.

## Personas (initial)

- **Organizer** — Creates trip, invites members, may lock decisions and manage roles.
- **Member** — Contributes preferences, votes, edits itinerary, logs expenses.
- **Viewer** (optional role) — Read-only access for stakeholders who should not edit.

Exact role names and permissions are defined in architecture; initial release focuses on organizer vs. member with viewer as a later refinement if needed.

## Domain areas and responsibilities

Each domain maps to a bounded area of product behavior and (later) a NestJS module. Domains marked **foundational** are required before meaningful trip planning; **later** domains can ship in subsequent milestones.

### Authentication and users — **foundational**

- Registration, login, session management, profile basics (display name, avatar optional).
- Password or OAuth strategy deferred to engineering decisions; users are global, not trip-scoped.

### Trips and memberships — **foundational**

- Trip lifecycle (draft → planning → active → completed → archived).
- Trip metadata: title, date range, default timezone, description.
- **TripMember**: user ↔ trip with role; all trip resources scoped by membership.

### Invitations — **foundational**

- Invite by email or link; pending → accepted / declined / expired.
- Idempotent acceptance; one membership per user per trip.

### Group preferences — **foundational (M4+)**

- Per-member availability windows, budget intent, travel style tags, hard/soft destination constraints.
- Aggregated views for organizers; feeds destination scoring.

### Destination discovery and scoring — **later (M4)**

- **DestinationCandidate** records options under consideration; polls and votes.
- Compatibility engine: individual scores, group aggregate, explainable ranking.

### Places and maps — **later (M5)**

- Search/geocode via provider abstraction; **Place** and **SavedPlace** on trips.
- Map display (MapLibre); no business logic tied to Geoapify directly.

### Itinerary management — **later (M6)**

- **TripDay**, **ItineraryItem**, participants on items, manual ordering, locks, revisions.

### Itinerary optimisation — **later (M6)**

- Travel-time matrix (cached), ordering suggestions, conflict detection; heuristic optimiser as separate testable package/module logic.

### Collaboration — **later (M7)**

- Real-time presence and change notifications via WebSockets after DB commit; optimistic UI with revision checks.

### Expenses and settlements — **later (M8)**

- Expenses in minor currency units; splits; net balances; suggested settlements (informative, not payment execution).

### Bookings and files — **later (M9)**

- **Booking** records (manual); **FileAsset** storage metadata and trip-scoped access.

### Live trip — **later (M10)**

- “Today” view: current day itinerary, quick links, optional check-off; read-heavy with same auth rules.

### Adaptive replanning — **later (M11)**

- **ReplanningProposal** with diff against current revision; approval workflow.

### Memories and trip history — **later (M12)**

- **TripMemory** (notes, highlights); export/template from completed trips.

### Notifications — **cross-cutting, incremental**

- In-app first; email optional later. Driven by invitation, mention, proposal ready, etc. Not blocking M3.

## Out of scope (initial releases)

- Processing card payments or issuing payouts.
- Automated booking with airlines/hotels via GDS or OTA APIs.
- AI-generated itineraries replacing deterministic rules (see architecture: no AI in core business rules).
- Microservices or multi-region deployment.
- Native mobile apps (responsive web first).

## Non-functional expectations

- **Availability**: Saved trip data readable even when external map/routing APIs are down (degraded discovery/optimisation only).
- **Security**: Every trip API enforces membership and role on the server.
- **Auditability**: Material itinerary changes versioned; expense and settlement calculations reproducible from stored splits.
- **Performance**: Interactive planning targets sub-second reads for trip workspace; routing/geocoding may be slower and cacheable.

## Success metrics (product, post-launch orientation)

- Time from trip creation to agreed destination (for groups using scoring).
- Percentage of itinerary items with resolved time conflicts before trip start.
- Expense settlement agreement (members mark balances settled) without leaving the app for calculation disputes.

These metrics inform later iterations; they do not block milestone acceptance in the roadmap.

## Glossary

| Term | Meaning |
|------|---------|
| Trip workspace | All trip-scoped data and UI for one trip |
| Revision | Monotonic version of itinerary (and related) state |
| Locked item | Itinerary item excluded from automatic reorder/replan |
| Proposal | Suggested itinerary change set awaiting approval |
| Provider abstraction | Interface for geocode, places, routing with swappable implementation |

---

*Related documents: [ARCHITECTURE.md](./ARCHITECTURE.md), [ROADMAP.md](./ROADMAP.md), [ENGINEERING_DECISIONS.md](./ENGINEERING_DECISIONS.md)*
