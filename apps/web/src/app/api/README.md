# Database Security Model: RLS + API Gate + Edge Grants

> **Doc note:** Canonical context lives in `/README.md`. When you update this area of the app, update the relevant README section in the same PR.

This doc describes the **Row Level Security (RLS)** protocol and the **API “gate” conventions** currently wired into the database for the roster + onboarding flows.

The intent is:

- **One-stop shop** for the app: the client calls `api.*` functions (and selected read-only RLS tables).
- **RLS stays the source of truth** for “what rows can I see?”
- **Writes are routed through RPCs** (hardened functions) to prevent bypassing business rules.
- **Edge grants** allow “extra capabilities” inside an org without promoting someone to admin/owner.
- **Leadership oversight** is handled as a separate access path (director/executive scope).

---

## 1) Concepts and Layers

### Layer A — Auth Context
- Primary identity is `auth.uid()` (Supabase JWT subject).
- In the SQL editor, `auth.uid()` only works if you set:
  - `set local role authenticated;`
  - `set_config('request.jwt.claim.role', 'authenticated', true);`
  - `set_config('request.jwt.claim.sub',  '<uuid>', true);`

### Layer B — Org Access Gate (visibility)
Defines **whether a user can access a specific `pc_org_id`**.

- **Gate function:** `api.can_access_pc_org(pc_org_id uuid) -> boolean`
- **Gate assert:** `api.assert_pc_org_access(pc_org_id uuid) -> void` (raises `Forbidden`)

This is used by:
- RLS policies for org-scoped tables/views
- `api.*` endpoints
- org write RPCs (`public.org_*`)

### Layer C — Edge Grants (capabilities inside an org)
Defines **what privileged actions** a user can take **within** an org they can access.

- **Permission check:** `api.has_pc_org_permission(pc_org_id, permission_key) -> boolean`
- **Permission assert:** `api.assert_pc_org_permission(pc_org_id, permission_key) -> void`

This allows patterns like:
- “Supervisor can manage roster within Org 410”
- without making them app owner/admin

### Layer D — Write Path (RPC-only)
Write operations that must enforce business rules are done via **SECURITY DEFINER** functions.
Direct table DML is revoked for `authenticated` / `anon` on core transactional tables.

---

## 2) Scope Types: Global vs Org-Scoped

### Org-Scoped (most of the app)
Data that must be restricted to the user’s org access:
- `pc_org`
- roster reads (via `api.roster_current`, etc.)
- org event feed
- assignments and membership are managed through gated flows

### Global (onboarding + directory)
Data meant to be visible to “Manager+” users across the whole system:
- `person` directory read/search
- person create/edit (wizard intake)

We still keep this **behind the API** so it’s auditable and permissioned.

---

## 3) Org Access Gate: How `api.can_access_pc_org` Works

`api.can_access_pc_org(pc_org_id)` returns `true` if **any** of these is true:

1) **App Owner**
   - `api.is_app_owner()` is true  
   - (implemented as SECURITY DEFINER with `row_security=off` to avoid recursion)

2) **Explicit eligibility**
   - `public.user_pc_org_eligibility(auth_user_id, pc_org_id)` contains a row for the user

3) **Executive/Leadership access**
   - `public.exec_pc_org_access(auth_user_id, pc_org_id)` contains a row for the user  
   - (used for directors/executives overseeing multiple orgs)

**Important:** `pc_org_id = NULL` always returns `false`.

### Why the “app_owners recursion fix” matters
If RLS on `public.app_owners` calls `api.is_app_owner()` and `api.is_app_owner()` queries `public.app_owners`, you get infinite recursion (stack depth exceeded).

Current protocol:
- `api.is_app_owner()` is SECURITY DEFINER and runs with `row_security=off`
- RLS on `public.app_owners` is **non-recursive**:
  - authenticated users can only select their own row: `auth_user_id = auth.uid()`

---

## 4) Manager+ Protocol (Global People Directory)

### Definition
`api.is_manager_plus()` is true if:
- user is `api.is_app_owner()` OR
- user has a qualifying `user_roles.role_key` in the allowlist (e.g. `manager`, `app_admin`, etc.)

### Enforcement
- `api.assert_manager_plus()` raises `Forbidden` if user is not manager+

### People directory endpoints (global)
These are **SECURITY DEFINER** + `row_security=off`, but still gated by `api.assert_manager_plus()`:

- `api.people_all(query text, limit int) -> setof public.person`
  - global search/list
- `api.person_get(person_id uuid) -> public.person`
  - load person for edit
- `api.person_upsert(...) -> public.person`
  - create/edit person  
  - **VOLATILE** (writes are not allowed in STABLE functions)

**Direct DML** on `public.person` is revoked for app roles, so UI must use `api.person_upsert`.

---

## 5) “Roster Presence” Definition (Workflow Chain)

A person being “on the roster” is not just an assignment row.

**Roster presence and schedule-ready is the chain:**
1) Person exists (`public.person`)
2) Affiliation / membership exists:
   - `public.person_pc_org` has an active membership row for `(person_id, pc_org_id)`
3) Assignment exists:
   - `public.assignment` active + `end_date is null`
4) (Later) Leadership / other overlays for scheduling readiness

**Important:** Our roster reads (via `pc_org_roster_drilldown_for_pc_org`) are built to reflect that chain.

---

## 6) Roster Read API Surface (Org-Scoped)

These are the primary read endpoints your UI should use:

- `api.pc_org_choices()`
  - returns orgs the current user can access (dropdown/context)

- `api.roster_current(pc_org_id uuid)`
  - **current-only roster**
  - filters `active=true` and `end_date is null`

- `api.roster_drilldown(pc_org_id uuid)`
  - history-capable roster (current + ended), same schema as drilldown function

- `api.roster_master(pc_org_id uuid)`
  - returns rows from `public.master_roster_v` for that org (richer export shape)

- `api.org_event_feed(pc_org_id uuid, limit int)`
  - returns rows from `public.org_event_feed_v`

- `api.roster_current_has_assignment(pc_org_id uuid, assignment_id uuid) -> boolean`
  - helper for UI verification flows

All org-scoped endpoints call:
- `api.assert_pc_org_access(pc_org_id)` (hard `Forbidden` if not allowed)

---

## 7) Write Path RPCs (Org Scoped)

### Hardened org write functions (public schema)
These are **SECURITY DEFINER** and enforce business rules + write the wire event:

- `public.org_assign_person(...) -> public.assignment`
  - enforces “globally unassigned”: person cannot have an active assignment anywhere
  - inserts assignment
  - inserts `public.org_event` with `payload jsonb` capturing notes/reason/metadata

- `public.org_end_assignment(assignment_id, actor_user_id, notes) -> public.assignment`
  - ends assignment (sets end_date, active=false)
  - writes `org_event` payload

- `public.org_transfer_person(...) -> public.assignment`
  - ends old assignment
  - creates new assignment
  - writes transfer event payload

### Wizard write wrapper (API schema)
Wizard processing requires both:
- **Manager+** role gate
- **Edge permission** gate inside the org

- `api.wizard_process_to_roster(pc_org_id, person_id, position_title, start_date, notes) -> assignment`
  - requires: `api.assert_manager_plus()`
  - requires: `api.assert_pc_org_permission(pc_org_id, 'roster_manage')`
  - ensures `person_pc_org` active membership exists (roster presence prerequisite)
  - calls `public.org_assign_person` to create the assignment

---

## 8) Edge Grants (Per-Org Permissions Console)

### Data model
- `public.permission_def(permission_key, description)`
  - the catalog of possible permissions (global list)

- `public.pc_org_permission_grant(pc_org_id, auth_user_id, permission_key, expires_at?, notes?)`
  - the per-org “edge grant” table

### Permission checks
- `api.has_pc_org_permission(pc_org_id, permission_key)`
- `api.assert_pc_org_permission(pc_org_id, permission_key)`

These checks enforce:
- user must be able to access the org via `api.can_access_pc_org`
- and either:
  - user is app owner, OR
  - user has a grant row for the permission in that org (and not expired)

### Permissions console endpoints (owner-only for now)
- `api.permissions_for_org(pc_org_id) -> rows`
- `api.permission_grant(pc_org_id, auth_user_id, permission_key, expires_at?, notes?) -> grant row`
- `api.permission_revoke(pc_org_id, auth_user_id, permission_key) -> boolean`

Protocol:
- UI console should call these endpoints
- Console is owner-only today; we can expand to “app_admin” later if desired

---

## 9) Leadership / Executive Oversight

Some users (directors/executives) oversee multiple orgs without being owners.

- `public.exec_pc_org_access(auth_user_id, pc_org_id)`
- Included in `api.can_access_pc_org` as a third access path.

This supports:
- “Director can see Org A and Org B rosters”
- “Exec can oversee many orgs”
- Later: we can extend this concept to division/region/route hierarchy once those tables are formalized.

---

## 10) Conventions for UI Wiring

### Do
- Use `api.*` endpoints for:
  - roster reads
  - people directory reads/edits
  - onboarding “process into roster”
  - permissions console
- Expect hard errors:
  - `Forbidden` when gate/permission fails
  - `Unauthorized` when user is missing JWT context

### Do Not
- Do not write directly to:
  - `assignment`, `org_event`, `schedule`, `shift_validation`, `person` (DML revoked)
- Do not rely on “0 rows” to imply security success
  - most API endpoints use asserts and should **hard fail** when unauthorized

### Practical note (SQL Editor)
When testing permissions:
- Always set role + claims, otherwise `auth.uid()` may be null and gates will fail:
  - `set local role authenticated;`
  - `set_config('request.jwt.claim.role','authenticated',true)`
  - `set_config('request.jwt.claim.sub','<user_uuid>',true)`

---

## 11) Quick Endpoint Map

### Roster page
- `api.pc_org_choices()`
- `api.roster_current(pc_org_id)`
- `api.org_event_feed(pc_org_id, limit)`

### Onboarding wizard
- `api.people_all(query, limit)`
- `api.person_get(person_id)`
- `api.person_upsert(...)`
- `api.wizard_process_to_roster(pc_org_id, person_id, position_title, start_date, notes)`

### Permissions console
- `api.permissions_for_org(pc_org_id)`
- `api.permission_grant(...)`
- `api.permission_revoke(...)`

---

## 12) Permission Keys in Use (initial)
- `roster_manage`
  - required for “Process into Roster”
  - intended for assign/end/transfer tasks (edge privileges)

- `people_manage`
  - reserved for fine-grained people ops (if you want to split global people ops from manager+)
  - currently global people ops is manager+ gated; we can evolve to “people_manage per org” later if desired

---

## 13) Future Extensions (planned)
- Division/Region/Route hierarchy tables and leadership grants at those levels
- Additional edge permissions:
  - `roster_end_assignment`
  - `roster_transfer`
  - `schedule_publish`
  - `schedule_validate`
- “Console roles” so `app_admin` can manage grants without being owner
- Auditing: write org_event entries for permission changes (grant/revoke)

---

# API Rebuild Roadmap

The API layer is being rebuilt into a strict boundary-driven architecture.

This is not a cleanup effort.  
This is a structural rewrite of how the application communicates with domain logic and data access.

The goal is to make every route:
- predictable
- auditable
- testable
- replaceable
- readable in one glance

The route is no longer the kitchen.

The route is the front desk.

---

# Core Rebuild Contract

Every API route must follow this shape:

```txt
route.ts
  → schema/parser
  → access guard
  → service/action
  → repository/data access
  → mapper/presenter
  → standard response envelope
```

## Route Responsibilities ONLY

A route may:
1. Parse request input
2. Validate payload/query params
3. Resolve auth/session/access
4. Call exactly one service/action
5. Return a standardized response

## A Route May NOT

A route must not contain:
- business workflow
- reconciliation logic
- upload normalization
- scoring engines
- metrics computation
- Supabase query chains
- orchestration logic
- sweep logic
- response shaping
- branching domain rules
- inline access logic duplication

If those exist inside `route.ts`, the boundary has failed.

---

# Working Rule

When rebuilding an API route:

DO NOT:
- patch the fat route
- improve the fat route
- reorganize the fat route

Instead:
1. Identify the workflow hidden inside the route
2. Extract the workflow into proper layers
3. Leave the route thin and obvious

The rebuild is complete only when the route becomes boring.

---

# Layer Definitions

## 1) `route.ts`

Purpose:
- HTTP boundary only

Responsibilities:
- parse request
- call schema validation
- resolve authenticated context
- invoke service/action
- return response envelope

A route should be understandable top-to-bottom in under one minute.

---

## 2) Schema / Parser Layer

Purpose:
- explicit request contracts

Responsibilities:
- validate body/query/params
- normalize primitive input shapes
- reject malformed requests early

Examples:

```txt
schemas/
  createMetricUpload.schema.ts
  updateRosterAssignment.schema.ts
```

Preferred tooling:
- zod
- typed parser helpers
- shared DTO contracts

---

## 3) Access Guard Layer

Purpose:
- centralized authorization

Responsibilities:
- org access verification
- permission enforcement
- ownership/admin checks
- reusable gate policies

Examples:

```txt
guards/
  requirePcOrgAccess.ts
  requireRosterManage.ts
  requireMetricsManage.ts
```

Rules:
- access logic should never be duplicated across routes
- routes should not inline grant checks

---

## 4) Service / Action Layer

Purpose:
- own business workflow

This is the domain orchestration layer.

Responsibilities:
- execute business operations
- coordinate repositories
- enforce workflow rules
- manage transactions/orchestration
- invoke engines/processors

Examples:

```txt
services/
  processMetricsUpload.service.ts
  rebuildScheduleMonth.service.ts
  assignPersonToRoster.service.ts
```

This layer owns:
- reconciliation
- scoring
- ingestion workflow
- domain decisions
- state transitions

---

## 5) Repository Layer

Purpose:
- isolate database access

Responsibilities:
- Supabase queries
- SQL execution
- persistence operations
- data retrieval

Rules:
- repositories do not own business rules
- repositories do not shape UI payloads
- repositories should be composable and predictable

Examples:

```txt
repositories/
  metrics.repository.ts
  roster.repository.ts
  workforce.repository.ts
```

---

## 6) Mapper / Presenter Layer

Purpose:
- shape stable response contracts

Responsibilities:
- convert domain output into API-safe payloads
- normalize naming/typing
- provide UI-stable contracts

Examples:

```txt
mappers/
  metricsUpload.mapper.ts
  workforceSurface.mapper.ts
```

Rules:
- UI should not depend on raw database structures
- response shaping belongs here, not in routes

---

## 7) Standard Response Envelope

All APIs should return predictable envelopes.

Preferred shape:

```ts
type ApiSuccess<T> = {
  ok: true;
  data: T;
};

type ApiError = {
  ok: false;
  error: {
    code: string;
    message: string;
  };
};
```

Goals:
- predictable frontend handling
- centralized error behavior
- stable contracts across the platform

---

# Error Handling Standard

Routes should not contain custom error trees.

Use:
- centralized error mapping
- domain error classes
- standard response envelopes

Examples:

```txt
errors/
  ForbiddenError.ts
  ValidationError.ts
  NotFoundError.ts
```

The route catches once.  
The domain defines the meaning.

---

# Definition of Done

An API route is considered rebuilt only when:

- `route.ts` contains no business workflow
- request validation is explicit
- access is centralized
- database calls are outside the route
- business logic lives in services/actions
- repositories isolate persistence
- response shaping is extracted
- responses use the standard envelope
- errors use the standard error handler
- the route can be read top-to-bottom in under one minute

---

# Rebuild Priorities

Priority order for rebuild candidates:

1. Metrics ingestion routes
2. Route-lock workflows
3. Dispatch workflows
4. Workforce write flows
5. Roster onboarding/process flows
6. Metrics reporting routes
7. Executive aggregation routes
8. Remaining legacy admin routes

Focus first on:
- highest complexity
- most duplicated logic
- most dangerous business coupling
- routes currently acting as orchestration engines

---

# Architectural North Star

The API layer becomes a stable contract between:
- UI
- domain engine
- persistence layer

The route receives the request.

The service owns the workflow.

The repository talks to the database.

The mapper shapes the response.

The UI receives a predictable contract.

That is the rebuild standard.