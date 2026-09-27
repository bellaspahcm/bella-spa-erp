# ARCHITECTURE GATE RESULT - PRESCHOOL PARENT USER ROLE ENABLEMENT

> **Status:** PASS - minimum auth/profile contract amendment for legitimate parent accounts
> **Date:** 2026-09-27
> **Scope:** `public.users.users_role_check` only; prerequisite for Parent Daily browser field verification

---

## 1. Bella OS/Product Development Process Gate

The Parent Daily backend, canonical Guardian Party mapping, and focused access tests are implemented. Browser field verification is blocked because a real parent account cannot have a legitimate `public.users` profile:

```text
Supabase Auth user
        ↓
public.users profile
        ↓
users_role_check rejects 'parent'
```

Gate decision: `PASS` for the smallest database contract amendment that permits a `parent` actor without granting staff/admin authority.

## 2. Product Manifest

In scope:
- Preserve all currently accepted `public.users.role` values.
- Add exactly one canonical role: `parent`.
- Keep role validation bounded by `users_role_check`.

Out of scope:
- Auth redesign, invitation workflow, password management, RBAC framework.
- Staff/admin permission changes.
- Parent Daily business semantics, Attendance, Daily Care, Handover, Guardian Authorization, Enrollment, R3, Course RLS.

## 3. Ownership Map

| Artifact | Owner Context | Data Definition |
|---|---|---|
| `public.users.role` | Platform Auth/Profile | User profile role label used by app guards and tenant context |
| `parent` | Preschool Product consumer of Platform profile | External guardian/parent login actor; not staff/admin |

## 4. Contract Dependency Map

```text
Supabase Auth user
        ↓
public.users(role = parent, tenant_id, phone)
        ↓
Parent Daily access service
        ↓
party_identifiers(preschool_guardian_phone)
        ↓
Guardian Party
        ↓
party_relationships guardian_of
        ↓
Student Party
```

Pickup authorization remains excluded from parent data-access authority.

## 5. Change Authority

Authorized:
- One bounded migration changing only `public.users.users_role_check`.
- Focused static migration test and existing Parent Daily access tests.

Not authorized:
- Generic RBAC/permission engine.
- Staff/admin route permission expansion.
- Product workflow changes.

## 6. UI -> Contract Reconciliation

No UI change in this slice. This is a contract prerequisite for using a real parent browser session in the already implemented Parent Inbox.

## 7. Additive Migration Plan

One migration:

```sql
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users ADD CONSTRAINT users_role_check
CHECK (role IN (... existing roles ..., 'parent'));
```

No RLS, policy, grant, profile data, or auth-user mutation.

## 8. Verification Plan

- Focused migration static test:
  - existing roles remain valid
  - `parent` is accepted
  - arbitrary roles are not accepted
  - validation is not weakened
- Existing Parent Daily access tests still pass.
- Scoped ESLint/diff check.

Gate result: `PASS`.

---

# ARCHITECTURE GATE RESULT - PRESCHOOL PARENT DAILY EXPERIENCE

> **Status:** PASS - complete parent daily view from canonical Preschool operational truth
> **Date:** 2026-09-27
> **Scope:** Parent daily read model, canonical guardian access, Parent Digest `student_party_id` cutover, `/dashboard/education/parent-inbox`

---

## 1. Bella OS/Product Development Process Gate

The sealed Preschool operational chain is:

```text
New Student -> Enrollment -> Classroom Roster -> Daily Attendance
-> Daily Care -> Guardian Authorization -> Safe Pickup/Handover
= FIELD VERIFIED
```

The next proven product blocker is:

```text
Parent Daily Experience = PARTIAL
```

Operational truth exists for Attendance, Daily Care, and Handover, but Parent Digest and Parent Inbox still consume legacy/static paths. Gate decision: `PASS` for the minimum Preschool Product connection that exposes today's real child-day truth to an authenticated canonical Guardian Party.

## 2. Product Manifest (Capabilities & Scope)

In scope:
- Resolve authenticated user to Guardian Party using existing tenant-scoped guardian phone identifier.
- Validate `Guardian Party --guardian_of--> Student Party` before returning any child data.
- Cut Parent Digest operational key from legacy `student_id` to canonical `student_party_id`.
- Read today's Attendance, Daily Care, and Handover truth from existing FIELD VERIFIED sources.
- Replace operational Parent Inbox mock path with real backend read-back.

Out of scope:
- QR, SMS, push, mobile app, billing, medication workflow, temperature, staff scheduling, facilities.
- Generic parent authorization framework.
- Pickup authorization as parent data-access authority.
- Reopening R3, Enrollment, Roster, Attendance, Daily Care source semantics, Guardian Authorization, Safe Pickup/Handover, Course RLS.

## 3. Ownership Map ("WHO OWNS THIS DATA?")

| Artifact | Owner Context | Data Definition |
|---|---|---|
| `party_relationships guardian_of` | Platform Party | Family/guardian relationship between Guardian Party and Student Party |
| `edu_attendance_daily_state` | Education Attendance / Preschool consumer | Daily attendance state |
| `edu_daily_care_records.student_party_id` | Preschool Product | Daily care state for a canonical Student Party |
| `edu_preschool_pickup_handover_events` | Preschool Product | Immutable pickup handover event |
| `edu_daily_parent_digests.student_party_id` | Preschool Product | Parent digest projection keyed by canonical Student Party |
| `/dashboard/education/parent-inbox` | Preschool Product UI | Parent daily experience read surface |

## 4. Contract Dependency Map

```text
Authenticated user
        ↓
public.users.phone
        ↓
party_identifiers(preschool_guardian_phone)
        ↓
Guardian Party
        ↓
party_relationships guardian_of
        ↓
Student Party
        ↓
Attendance + Daily Care + Handover read model
        ↓
Parent Inbox UI
```

Pickup authorization is not part of the parent data-access contract.

## 5. Change Authority

Authorized:
- Preschool Product service/API/UI for parent daily read model.
- Additive/cutover migration on Preschool-owned `edu_daily_parent_digests`.
- Focused tests for related child access, unrelated child denial, cross-tenant denial, pickup authorization not granting data access, and canonical sources.

Not authorized:
- Platform identity redesign.
- Education Kernel changes.
- Generic authorization framework.
- Notification delivery, QR, mobile app, or parent communication redesign.

## 6. UI -> Contract Reconciliation

| UI element | UI expectation | Canonical contract | Conclusion |
|---|---|---|---|
| Parent daily child card | Shows real child | `party_relationships guardian_of -> party_parties` | MATCH |
| Attendance | Present/absent/excused/unmarked | `edu_attendance_daily_state` through canonical enrollment | MATCH |
| Arrival/meal/hygiene/nap | Today's care state | `edu_daily_care_records.student_party_id` | MATCH |
| Handover | Pickup complete/time/guardian | `edu_preschool_pickup_handover_events` | MATCH |
| Static NOT-* notices | Mock operational data | No real parent daily contract | STALE UI |

## 7. Additive Migration Plan

One migration only:

```text
edu_daily_parent_digests
  ADD student_party_id UUID REFERENCES party_parties(id)
  ALTER student_id DROP NOT NULL
  ADD unique/indexes for session + student_party_id
```

No legacy cleanup/drop.

## 8. Verification Plan

- Focused parent daily service tests.
- Focused Parent Digest canonical tests where practical.
- Scoped ESLint.
- `git diff --check`.
- Typecheck changed once; if it stalls, report `NOT_VERIFIED_STALL`.

Gate result: `PASS`.

---

# ARCHITECTURE GATE RESULT - PRESCHOOL DAILY CARE CANONICAL CONNECTION

> **Status:** PASS - minimum Preschool-owned Daily Care connection to canonical enrolled students
> **Date:** 2026-09-27
> **Scope:** `/dashboard/education/care`, Daily Care product service/API, canonical `student_party_id` persistence

---

## 1. Bella OS/Product Development Process Gate

The verified Preschool chain has reached:

```text
New Student -> Enrollment -> Classroom Roster -> Daily Attendance -> Guardian Authorization -> Safe Pickup/Handover = FIELD VERIFIED
```

The next proven blocker is:

```text
Daily Care / Care & Wellbeing = PARTIAL
```

The existing Care UI is a real Preschool menu capability, but still uses hardcoded tenant/class/student/date/static students and writes care records through legacy `students.student_id`.

Gate decision: `PASS` for the minimum Preschool Product connection that lets the existing Care workspace operate on the same canonical enrolled students already proven by Enrollment/Roster/Attendance.

## 2. Product Manifest (Capabilities & Scope)

In scope:
- Load real active courses and enrolled students for the authenticated Preschool tenant.
- Persist Daily Care records by canonical `student_party_id`.
- Preserve existing Care semantics for arrival, meal, hygiene, and nap.
- Return DB read-back so browser refresh can show persisted truth.

Out of scope:
- Parent Digest publishing.
- QR, pickup, handover, Attendance changes, Guardian Authorization changes.
- Medication authorization redesign.
- Platform/Education-wide Care engine or generic workflow framework.

## 3. Ownership Map ("WHO OWNS THIS DATA?")

| Artifact | Owner Context | Data Definition |
|---|---|---|
| `edu_daily_care_sessions` | Preschool Product | Care session per course/date |
| `edu_daily_care_records` | Preschool Product | Care state for one canonical student/day |
| `edu_enrollments` | Education OS Enrollment | Canonical course membership |
| `students.party_id` / `party_parties.id` | Education Student / Platform Party | Canonical student identity |
| `/dashboard/education/care` | Preschool Product UI | Staff care action workspace |

## 4. Contract Dependency Map

```text
Care UI
        ↓
GET /api/education/courses
        ↓
GET /api/education/care/bulk?courseId&date
        ↓
DailyCareService
        ↓
edu_enrollments.student_party_id
        ↓
edu_daily_care_records.student_party_id
        ↓
Care UI DB read-back
```

## 5. Change Authority

Authorized:
- One bounded migration for canonical Daily Care identity on existing product-owned table.
- `DailyCareService` and its product-local contract.
- `/api/education/care/bulk` server boundary.
- Existing Care page operational data/action wiring.
- Focused tests for canonical student persistence and tenant/course denial.

Not authorized:
- R3, Enrollment, Attendance, Guardian Authorization, Safe Pickup/Handover.
- Parent Digest, Parent Engagement, QR, Haircut, BDGF, migration history.

## 6. UI -> Contract Reconciliation

| UI element | UI expectation | Canonical contract | Conclusion |
|---|---|---|---|
| Course selector | Real Preschool class/course | `GET /api/education/courses` | MATCH |
| Student roster | Real enrolled students | `edu_enrollments.student_party_id -> party_parties` | MATCH |
| Care action | Persist care for current student/day | `edu_daily_care_records.student_party_id` | CONTRACT CHANGE REQUIRED |
| Temperature | Health check input | No real current input in Care page | DEFER |
| Parent Digest | Publish parent-facing snapshot | Existing separate digest projection | DEFER |

## 7. Additive Migration Plan

Minimum table correction:

```text
edu_daily_care_records.student_party_id -> party_parties.id
student_id DROP NOT NULL for canonical rows
unique session + student_party_id
index tenant + student_party_id
```

No parent digest migration, attendance change, guardian change, or R3 change.

## 8. 11 Automated Verification Gates Plan

- Gate 1 Architecture Compliance: Product-owned service/API/UI; no Education Kernel modification.
- Gate 2 Contract Boundary: Product consumes canonical enrollment/party identity only.
- Gate 3 Tenant Isolation: API derives tenant server-side and service validates tenant/course membership.
- Gate 4 RLS/Auth: no RLS weakening; server-side route owns mutation.
- Gate 5 Migration Safety: bounded product table identity correction only.
- Gate 6 Event-After-Persistence: not applicable; success after DB update/read-back.
- Gate 7 Academic Safety Routing: not applicable.
- Gate 8 Temporal Provenance: daily record update semantics preserved.
- Gate 9 Rule Governance: not applicable.
- Gate 10 Audit Evidence: focused tests prove DB-shaped persistence and denial.
- Gate 11 Regression: focused Daily Care tests, scoped lint, diff check.

---

# ARCHITECTURE GATE RESULT - PRESCHOOL SAFE PICKUP HANDOVER EVENT

> **Status:** PASS - minimum Preschool-owned handover event truth
> **Date:** 2026-09-27
> **Scope:** Safe Pickup handover event persistence, API action, Attendance/Safe Pickup UI connection

---

## 1. Bella OS/Product Development Process Gate

The verified Preschool operational chain has reached:

```text
New Student -> Enrollment -> Classroom Roster -> Daily Attendance -> Guardian Authorization = FIELD VERIFIED
```

Discovery proved:

```text
Safe Pickup authorization != handover event
Existing canonical handover capability = NONE
Owner = Preschool Product
```

Gate decision: `PASS` for one minimum product-owned event record proving that an authorized guardian received a specific student from an authenticated operator at a specific time.

## 2. Product Manifest (Capabilities & Scope)

In scope:
- Create one Preschool-owned handover event table.
- Validate the active pickup authorization before recording handover.
- Derive tenant, operator, and timestamp server-side.
- Add one minimal API action for the existing Safe Pickup panel.
- Show persisted handover read-back in the existing Attendance/Safe Pickup UI.

Out of scope:
- QR, scanner/camera, pickup token, biometrics, signature capture.
- Notifications, pickup schedules, custody rules, effective authorization windows.
- Guardian Authorization semantic changes.
- Enrollment, Student/R3, Attendance status semantics, Course RLS, BDGF, migration history.

## 3. Ownership Map ("WHO OWNS THIS DATA?")

| Artifact | Owner Context | Data Definition |
|---|---|---|
| `edu_preschool_pickup_handover_events` | Preschool Product | Immutable handover business event |
| `edu_preschool_pickup_authorizations` | Preschool Product | Active authorization prerequisite |
| `party_parties` | Platform Party | Canonical Student and Guardian identities |
| Safe Pickup UI | Preschool Product UI | Action surface and truthful read-back |

## 4. Contract Dependency Map

```text
Safe Pickup UI
        ↓
POST /api/education/attendance/handover
        ↓
PreschoolSafePickupHandoverService
        ↓
Validate active authorization
        ↓
Insert edu_preschool_pickup_handover_events
        ↓
GET /api/education/attendance read-back
        ↓
Safe Pickup panel shows "Đã bàn giao"
```

## 5. Change Authority

Authorized:
- One additive Preschool Product migration.
- Product-owned service for handover event.
- Attendance API route read-back and one new handover endpoint.
- Existing Attendance/Safe Pickup UI action wiring.
- Focused tests for handover validation and failure paths.

Not authorized:
- Education Kernel handover engine.
- Guardian Authorization redesign.
- QR/custody/notification/Parent Engagement.
- Broad regression repair or migration history work.

## 6. UI -> Contract Reconciliation

| UI element | UI expectation | Canonical contract | Conclusion |
|---|---|---|---|
| Authorized guardian display | Existing active authorization shown | `edu_preschool_pickup_authorizations` | MATCH |
| Bàn giao action | Persist real handover event | New `edu_preschool_pickup_handover_events` | CONTRACT CHANGE REQUIRED |
| QR copy/status | QR verification | No canonical capability in this slice | DEFER |
| Handover success message | Only after persisted event read-back | Handover API + roster refresh | MATCH after slice |

## 7. Additive Migration Plan

Create one table only:

```text
edu_preschool_pickup_handover_events
tenant_id
student_party_id
guardian_party_id
pickup_authorization_id
handed_over_at
handed_over_by
created_at
```

No mutation of authorization, enrollment, student identity, attendance, QR, Parent Engagement, or legacy tables.

## 8. 11 Automated Verification Gates Plan

- Gate 1 Architecture Compliance: Product-owned service/API/UI only.
- Gate 2 Contract Boundary: No Education Kernel modification.
- Gate 3 Tenant Isolation: tenant derived server-side; service validates same tenant.
- Gate 4 RLS/Auth: new table has tenant RLS policy.
- Gate 5 Migration Safety: additive table/index/policy only.
- Gate 6 Event-After-Persistence: success only after insert/read-back.
- Gate 7 Academic Safety Routing: not applicable.
- Gate 8 Temporal Provenance: immutable event record.
- Gate 9 Rule Governance: not applicable.
- Gate 10 Audit Evidence: focused test/read-back proves event truth.
- Gate 11 Regression: focused handover test, scoped lint, diff check.

---

# ARCHITECTURE GATE RESULT - PRESCHOOL DAILY ATTENDANCE STATE

> **Status:** PASS - canonical Education daily attendance state projection for Preschool roll call
> **Date:** 2026-09-26
> **Scope:** Education Attendance public contract extension, additive daily-state projection, Preschool Attendance UI wiring

---

## 1. Bella OS/Product Development Process Gate

The verified Preschool workflow has reached:

```text
New Student → Enrollment → Classroom Roster = FIELD VERIFIED
```

The next blocker is daily roll call. Discovery proved two distinct semantics:

```text
edu_attendance = event history
Preschool roll call = current daily state
```

Gate decision: `PASS` for the minimum canonical Education Attendance contract extension that preserves event history and adds a bounded daily-state projection.

## 2. Product Manifest (Capabilities & Scope)

In scope:
- Add an Education-owned daily attendance state projection.
- Preserve `edu_attendance` append-only event semantics.
- Add atomic write boundary: append event + upsert daily state.
- Add canonical read path for course/date roster attendance.
- Wire Preschool Attendance UI to the canonical Education Attendance service/API.

Out of scope:
- Pickup, temperature, Care, Parent notification, Billing, Reporting.
- R3, BDGF, migration history, credential debugging.
- Legacy `attendances` cleanup or dual-write.
- Generic timezone framework or event-sourcing framework.

## 3. Ownership Map ("WHO OWNS THIS DATA?")

| Artifact | Owner Context | Data Definition |
|---|---|---|
| `public.edu_attendance` | Education OS Attendance | Append-only attendance event history |
| Daily attendance state projection | Education OS Attendance | Effective state for tenant + enrollment + school_day |
| `public.edu_enrollments` | Education OS Enrollment | Canonical roster membership by course |
| `public.students` / `public.party_parties` | Education Student / Platform Party | Canonical student identity for roster display |
| Preschool Attendance page | Preschool Product UI | Presentation and user action surface only |

## 4. Contract Dependency Map

```text
Preschool Attendance UI
        ↓
Education Attendance API
        ↓
AttendanceProductService
        ↓
IEducationAttendanceContract
        ↓
AttendanceContractImpl
        ↓
Education DB boundary
        ├── edu_attendance event append
        └── daily attendance state upsert
```

Read path:

```text
course + school_day
        ↓
edu_enrollments
        ↓
students.party_id
        ↓
party_parties
        ↓
daily attendance state (nullable/unmarked)
```

## 5. Change Authority

Authorized:
- One additive Education attendance migration.
- `src/platform/education/contracts/attendance.contract.ts`
- `src/platform/education/contracts/attendance.contract.impl.ts`
- `src/products/bella-education/services/attendance.service.ts`
- Minimal Attendance API route(s).
- `src/app/dashboard/education/attendance/page.tsx`
- Focused tests for daily-state semantics and UI/API mapping.

Not authorized:
- Healthcare, Logistics, R3, BDGF, legacy cleanup.
- Legacy `attendances` dual-write.
- Product-specific attendance engine separate from Education.

## 6. UI → Contract Reconciliation

| UI element | UI expectation | Canonical contract | Conclusion |
|---|---|---|---|
| Class/course selector | Real course list | Existing Education courses API | MATCH |
| Roster rows | Enrolled students for selected course | `edu_enrollments.student_party_id → students.party_id → party_parties` | MATCH |
| Present/Absent/Excused action | One effective state for school day | New Education daily-state projection | CONTRACT CHANGE REQUIRED |
| History/correction evidence | Correction preserves history | Existing `edu_attendance` event log | MATCH |
| Pickup/temperature panels | Not proven for attendance mutation | Out of scope | DEFER |

## 7. Additive Migration Plan

Create only a new Education daily attendance state projection with:

```text
tenant_id
enrollment_id
school_day
status present|absent|excused
created_at
updated_at
UNIQUE (tenant_id, enrollment_id, school_day)
RLS tenant isolation consistent with Education tables
```

No modification to `edu_attendance`, `attendances`, `persons`, identity mappings, or enrollment tables.

## 8. 11 Automated Verification Gates Plan

- Gate 1 Architecture Compliance: Education contract and Product UI only; no cross-industry imports.
- Gate 2 Contract Boundary: Product calls public Education Attendance service/contract.
- Gate 3 Tenant Isolation: mutation/read validates tenant owns enrollment/course.
- Gate 4 RLS/Auth: new table has RLS and tenant policy.
- Gate 5 Migration Safety: additive table only.
- Gate 6 Event-After-Persistence: event + state mutation must be transactional/atomic.
- Gate 7 Academic Safety Routing: not applicable.
- Gate 8 Temporal Provenance: event history remains append-only.
- Gate 9 Rule Governance: not applicable.
- Gate 10 Audit Evidence: correction test proves two history events and one effective state.
- Gate 11 Regression: focused attendance tests, scoped lint, diff check.

---

# ARCHITECTURE GATE RESULT - PRESCHOOL GUARDIAN AUTHORIZATION

> **Status:** PASS - minimal Preschool-owned guardian pickup authorization truth
> **Date:** 2026-09-27
> **Scope:** New Enrollment guardian identity/relationship/authorization; Safe Pickup panel read-only truth display

---

## 1. Bella OS/Product Development Process Gate

The verified Preschool operational chain has reached:

```text
New Student -> Enrollment -> Classroom Roster -> Daily Attendance = FIELD VERIFIED
```

The next blocker is not QR or pickup event execution. Discovery proved the first missing truth is:

```text
Student Party
      ↓
Guardian Party
      ↓
Guardian identity relationship
      ↓
Preschool pickup authorization
```

Gate decision: `PASS` for the minimum product-owned model answering only which Guardian Party is currently authorized to pick up which Student Party.

## 2. Product Manifest (Capabilities & Scope)

In scope:
- Resolve/create a tenant-scoped Guardian Party from required enrollment guardian input.
- Store a bounded tenant-scoped guardian phone identifier for this Preschool flow.
- Link Guardian Party to Student Party through `guardian_of` identity relationship.
- Create/read a separate Preschool pickup authorization.
- Extend the existing enrollment response and Safe Pickup panel to display real authorized guardian truth.

Out of scope:
- QR token/scanner.
- Pickup/handover/release event.
- Temperature or Daily Care changes.
- Parent Engagement refactor.
- Generic identity, phone, or authorization framework.

## 3. Ownership Map ("WHO OWNS THIS DATA?")

| Artifact | Owner Context | Data Definition |
|---|---|---|
| `party_parties` | Platform Party | Canonical Guardian and Student identity |
| `party_identifiers` | Platform Party | Tenant-scoped Preschool guardian phone resolution key |
| `party_relationships` | Platform Party | Guardian -> Student identity/family relationship |
| `edu_preschool_pickup_authorizations` | Preschool Product | Operational truth that a guardian is currently authorized for pickup |
| Attendance Safe Pickup panel | Preschool Product UI | Read-only display of authorization truth; no pickup event/QR claim |

## 4. Contract Dependency Map

```text
Preschool Enrollment API
        ↓
Student Party
        ↓
Guardian Party resolve/create
        ↓
party_relationships guardian_of
        ↓
edu_preschool_pickup_authorizations
        ↓
Student + Enrollment
```

Read path:

```text
Attendance roster
        ↓
student_party_id
        ↓
edu_preschool_pickup_authorizations
        ↓
guardian party display + phone identifier
        ↓
Safe Pickup panel
```

## 5. Change Authority

Authorized:
- One additive Preschool-owned authorization migration.
- Product service for guardian authorization.
- Enrollment API integration.
- Attendance API/UI read-only display of authorized guardian.
- Focused tests for identity, duplicate boundaries, and false-success prevention.

Not authorized:
- Education Attendance engine redesign.
- Parent Engagement refactor.
- QR, pickup event, custody scheduling, temperature, or Daily Care.
- BDGF/R3/migration-history work.

## 6. UI -> Contract Reconciliation

| UI element | UI expectation | Canonical contract | Conclusion |
|---|---|---|---|
| Enrollment guardian fields | Required guardian info becomes operational truth | Guardian Party + relationship + pickup authorization | CONTRACT CHANGE REQUIRED |
| Safe Pickup guardian display | Show who is authorized | `edu_preschool_pickup_authorizations` + Party identity | MATCH after slice |
| QR action | Verify pickup via QR | No canonical capability yet | DEFER |
| Pickup completion | Child released/handover event | No canonical capability yet | DEFER |
| Temperature | Care/health check | Daily Care capability, not Attendance | DEFER |

## 7. Additive Migration Plan

Create one table only:

```text
edu_preschool_pickup_authorizations
tenant_id
student_party_id
guardian_party_id
status authorized|revoked
created_at
updated_at
```

Add a partial unique boundary for active authorization:

```text
tenant_id + student_party_id + guardian_party_id WHERE status = authorized
```

No pickup event, QR token, schedule, custody, photo, signature, or geolocation fields.

## 8. 11 Automated Verification Gates Plan

- Gate 1 Architecture Compliance: Product-owned service/API/UI; Platform Party tables only for identity.
- Gate 2 Contract Boundary: Education attendance/enrollment contracts remain unchanged.
- Gate 3 Tenant Isolation: guardian phone resolution and authorization are tenant scoped.
- Gate 4 RLS/Auth: new table has RLS tenant policy.
- Gate 5 Migration Safety: additive table/index/policy only.
- Gate 6 Event-After-Persistence: no event behavior added.
- Gate 7 Academic Safety Routing: not applicable.
- Gate 8 Temporal Provenance: not applicable.
- Gate 9 Rule Governance: not applicable.
- Gate 10 Audit Evidence: read-back proves authorization truth.
- Gate 11 Regression: enrollment and attendance focused tests, scoped lint, diff check.

---

# ARCHITECTURE GATE RESULT - PRESCHOOL NEW STUDENT ENROLLMENT PATH

> **Status:** PASS - minimal Product UI to canonical Education enrollment wiring
> **Date:** 2026-09-26
> **Scope:** Preschool New Student modal, product-owned API boundary, canonical Party/Student/Enrollment chain

---

## 1. Bella OS/Product Development Process Gate

Request targets the proven Preschool blocker:

```text
Enrollment UI
        ↓
static/local completion
        ↓
no canonical Party
no Student contract call
no edu_enrollments persistence/read-back
```

R3 Student identity is sealed; new canonical Student creation now supports:

```text
party_id = public.party_parties.id
person_id = NULL
```

Gate decision: `PASS` for a minimal Product-layer server boundary plus UI submit wiring.

## 2. Product Manifest (Capabilities & Scope)

In scope:
- Use the existing Preschool Enrollment UI/modal.
- Create one product-owned API route for the admission operation.
- Create a canonical person Party in `public.party_parties`.
- Register the Student through `StudentContractImpl`.
- Enroll through `EnrollmentProductService` and `EnrollmentContractImpl`.
- Report success only after Student and Enrollment read-back.

Out of scope:
- Attendance, Care, Parent Inbox, Pickup, Finance, Reporting.
- R3, BDGF, migration history, credential/debug work.
- New identity framework, fake `persons`, fake `identity_migration_mapping`, or compatibility layer.
- Broad Preschool redesign.

## 3. Ownership Map ("WHO OWNS THIS DATA?")

| Artifact | Owner Context | Data Definition |
|---|---|---|
| `public.party_parties` | Platform Party identity | Canonical person identity for the new student |
| `public.students` | Education OS Student | Student role bound to canonical Party |
| `public.edu_enrollments` | Education OS Enrollment | Canonical enrollment persistence/read-back |
| Enrollment modal state | Preschool Product UI | User input only; not source of operational truth |

## 4. Contract Dependency Map

```text
Preschool Enrollment UI
        ↓
POST /api/education/enrollments
        ↓
party_parties insert
        ↓
StudentContractImpl.registerStudent()
        ↓
EnrollmentProductService.enrollStudent()
        ↓
EnrollmentContractImpl
        ↓
EducationEngineService
        ↓
SupabaseEducationRepository
        ↓
edu_enrollments
        ↓
getStudent() + getEnrollment() read-back
```

## 5. Change Authority

Authorized:
- `src/app/dashboard/education/enrollments/page.tsx`
- `src/app/api/education/enrollments/route.ts`
- Focused tests for the new product API boundary.
- This architecture gate artifact.

Not authorized:
- Education Kernel schema changes.
- Attendance/Care/Parent/Finance/Reporting.
- Migration deployment, BDGF, or production credential work.

## 6. UI → Contract Reconciliation

The previous button only closed the modal. The new path must submit the UI payload to the product API and display failure if the server chain fails. Course/class identity must come from the existing `GET /api/education/courses` source, not from a hardcoded ID.

Browser smoke discovered a direct mapping bug in that existing course source:

```text
Enrollment modal
        ↓
GET /api/education/courses
        ↓
hardcoded tenant fallback
        ↓
classrooms: []
        ↓
submit blocked before canonical enrollment request
```

Authorized minimal correction: the course API must prefer the authenticated
user's tenant context before legacy fallback so the Enrollment UI can submit a
canonical course/class ID for the current Preschool tenant.

## 7. Additive Migration Plan

No migration in this task.

## 8. 11 Automated Verification Gates Plan

- Gate 1 Architecture Compliance: product API uses public Education contracts.
- Gate 2 Contract Boundary: Student registration uses `partyId`; enrollment uses `studentPartyId`.
- Gate 3 Tenant Isolation: API resolves tenant from authenticated user context before writes.
- Gate 4 RLS/Auth: no RLS/grant changes.
- Gate 5 Migration Safety: no schema change.
- Gate 6 Event-After-Persistence: Enrollment engine remains responsible.
- Gate 7 Academic Safety Routing: course validation remains in Education engine.
- Gate 8 Temporal Provenance: not changed.
- Gate 9 Rule Governance: not changed.
- Gate 10 Audit Evidence: API response includes persisted/read-back IDs.
- Gate 11 Regression: focused route tests, existing R3 Student tests, scoped lint/diff checks.

---

# ARCHITECTURE GATE RESULT - R3 STUDENT CREATE-SIDE COMPLETION

> **Status:** PASS - minimal R3 create-side cutover for canonical Party-backed Students
> **Date:** 2026-09-26
> **Scope:** Education Student create path only; prerequisite for Preschool New Student enrollment

---

## 1. Product Manifest (Capabilities & Scope)

This change completes the proven R3 create-side gap:

```text
New canonical Party
        ↓
Student role creation
        ↓
students.party_id = party_parties.id
students.person_id = NULL
```

Included:
- Relax the transitional `students.person_id` NOT NULL requirement.
- Preserve `students.person_id` column, FK, index, and legacy read path.
- Preserve canonical `partyId` requirement at the Student application/contract boundary.
- Stop requiring `identity_migration_mapping` for brand-new canonical Student creation.
- Fix the proven semantic bug where `studentPartyId` was queried against `students.person_id`.

Excluded:
- No Preschool Enrollment implementation in this task.
- No `persons` creation for new Students.
- No fake `identity_migration_mapping` rows.
- No `students.party_id NOT NULL` schema hardening.
- No legacy cleanup, mapping removal, BDGF, migration history, or production deployment.

## 2. Ownership Map ("WHO OWNS THIS DATA?")

| Artifact | Owner Context | Data Definition |
|---|---|---|
| `public.students` | Education OS Student bounded context | Student role state for canonical Party identity |
| `public.party_parties` | Platform Party identity | Canonical person Party identity |
| `public.persons` | Legacy Platform Host Person | Transitional legacy identity retained for existing rows |
| `public.identity_migration_mapping` | R3 migration bridge | Legacy mapping for migrated rows only |

## 3. Contract Dependency Map

```text
Preschool Product
        ↓
Education Student Contract
        ↓
StudentService
        ↓
StudentAggregate
        ↓
StudentRepository
        ↓
public.students
        ↓
party_id → public.party_parties(id)
```

Legacy compatibility remains:

```text
Existing legacy consumers
        ↓
StudentRepository.findByPersonId()
        ↓
students.person_id → public.persons(id)
```

## 4. Change Authority

Authorized by owner prompt:
- Education Student create path.
- One additive/transitional schema migration: `ALTER COLUMN person_id DROP NOT NULL`.
- Generated DB type refresh/update for `students.person_id` nullability.
- Focused tests for Student create/read-back/legacy compatibility.

Not authorized:
- Preschool UI/backend wiring.
- BDGF/governance changes.
- Production migration execution.
- Broad Education architecture refactor.

## 5. UI → Contract Reconciliation

No UI changes in this task. Preschool UI remains out of scope until R3 create-side is reviewed and deployed.

## 6. Additive Migration Plan

One migration only:

```sql
ALTER TABLE public.students
ALTER COLUMN person_id DROP NOT NULL;
```

No data mutation, backfill, FK/index removal, Party hardening, or legacy cleanup.

## 7. Verification Gates Plan

- Gate 1 Architecture Compliance: scoped Education changes only; no cross-industry imports.
- Gate 2 Contract Boundary: Student public contract remains Party-based.
- Gate 3 Tenant Isolation: preserve tenant filters in StudentRepository/Service.
- Gate 4 RLS/Auth: no RLS or grant changes.
- Gate 5 Migration Safety: transitional nullable change only; no destructive column/FK removal.
- Gate 6 Event-After-Persistence: not applicable; no event behavior changed.
- Gate 7 Academic Safety Routing: not applicable.
- Gate 8 Temporal Provenance: not applicable.
- Gate 9 Rule Governance: not applicable.
- Gate 10 Audit Evidence: not applicable.
- Gate 11 Regression: focused Student tests, affected Education tests where available, scoped TypeScript/lint.

---

# ARCHITECTURE GATE RESULT - BELLA ENGLISH CENTER POST-RC ENVIRONMENT CLOSURE

> **Status:** PASS - dev-only API auth-context repair for Post-RC runtime validation
> **Date:** 2026-09-15
> **Canonical base:** `origin/main@fbff36721c3f53067cbd3992157dbb3ba04e634a`
> **Scope:** English Center API runtime validation path only

---

## 1. Product Manifest (Capabilities & Scope)

This closure does not add a new English Center business capability. It fixes the local Post-RC browser validation path where development mock authentication resolves a tenant/user but the API repository Supabase client remains anonymous, causing RLS-backed Command Center reads to fail against `public.user_org_unit_access`.

Included:
- Keep E6-E9 product surfaces unchanged.
- Keep canonical Education OS contracts unchanged.
- Use a service-role Supabase client only for the existing development mock-user branch.
- Preserve production cookie/JWT Supabase client behavior.

Excluded:
- No Education Kernel modification.
- No Healthcare, Logistics, Finance, or cross-industry dependency.
- No `anon` database grant expansion to make tests pass.
- No new database table, policy, or migration in code.

## 2. Ownership Map ("WHO OWNS THIS DATA?")

| Artifact | Owner Context | Data Definition |
|---|---|---|
| `src/app/api/english-center/_shared.ts` | Bella English Center API boundary | API context resolution only |
| `public.user_org_unit_access` | Platform Authorization projection | Existing branch/org-unit access read model |
| English Center E2-E8 tables | Bella English Center Product | Existing product-owned projections and runtime data |

## 3. Contract Dependency Map

```
Post-RC browser gate
        |
        v
English Center API context
        |
        +-- production auth: SSR Supabase client with user JWT
        |
        +-- development mock auth: service-role Supabase client
        |
        v
English Center repositories
        |
        v
Platform Authorization projection (user_org_unit_access)
        |
        v
Product RLS / tenant / branch scope
```

No Product -> Education Kernel bypass is introduced.

## 4. Additive Migration Plan

No code migration is added. Environment closure applied canonical existing migrations/grants to the linked Supabase project and refreshed PostgREST schema cache separately from this source patch.

## 5. 11 Automated Verification Gates Plan

- Gate 1 Architecture Compliance: no `src/platform/education/` change; no cross-industry import.
- Gate 2 Contract Boundary: no Education contract bypass change.
- Gate 3 Tenant Isolation: preserve tenant lookup and RLS-backed branch filtering.
- Gate 4 RLS & Authorization: do not grant `anon`; development mock uses controlled admin client.
- Gate 5 Database Migration Safety: no new migration.
- Gate 6 Event-After-Persistence: not applicable; read-only API context path.
- Gate 7 Academic Safety Routing: not applicable; no assessment calculation change.
- Gate 8 Temporal Provenance: not applicable; no temporal write.
- Gate 9 Rule Governance: not applicable; no grading rule change.
- Gate 10 Audit Evidence Integrity: not applicable; no transcript/export change.
- Gate 11 Platform Regression: run Post-RC browser gate and targeted English Center API tests.

---

# ARCHITECTURE GATE RESULT — PR82 CI REMEDIATION

> **Status:** PASS — CI-only remediation, no Product Vertical or Kernel impact
> **Date:** 2026-09-13
> **Scope:** GitHub Actions checks for PR #82 (`infra/git-workflow-constitution-install`)

---

## 1. Product Manifest (Capabilities & Scope)

This change is limited to CI workflow execution policy:
- Bound API documentation checks to API/API-documentation changes.
- Bound live Supabase/DB checks to database, application, or DB-check changes.
- Remove unsafe direct GitHub context interpolation from shell `run:` blocks.
- Pin the branch-cleanup GitHub Action to an immutable commit SHA.

No Healthcare, Education, Logistics, Finance, or Product Vertical runtime capability is added or changed.

## 2. Ownership Map ("WHO OWNS THIS DATA?")

No business data or domain entity is owned or modified by this change.

| Artifact | Owner Context | Data Definition |
|---|---|---|
| `.github/workflows/*` | Repository CI Governance | Automation policy only |
| `docs/api-reference.md` | API Documentation Governance | Referenced deliverable, not created in this change |

## 3. Contract Dependency Map

```
GitHub PR event
        │
        ▼
GitHub Actions workflow checks
        │
        ├── Repo scripts (`npm run docs:api:*`)
        └── GitHub Advanced Security Semgrep OSS
```

No Product -> Contract -> Kernel dependency exists in this remediation.

## 4. Additive Migration Plan

No database migration. No schema change. No RLS policy change.

## 5. 11 Automated Verification Gates Plan

The Healthcare/Education 11-gate product-vertical suite is not applicable because no vertical or kernel code is touched.

Targeted verification for this CI remediation:
- YAML parse / workflow syntax validation.
- Semgrep OSS annotations addressed without disabling scanner.
- API docs check remains enforced for API/API-doc changes and is skipped for infra-only PRs.
- Live DB checks remain enforced for DB/application/DB-check changes and are skipped for infra-only PRs.
- GitHub Actions status rechecked after commit/push.

---

# ARCHITECTURE GATE RESULT — BELLA FINANCE OS KERNEL F1

> **Status:** APPROVED BY HUMAN ARCHITECT  
> **Milestone:** Phase F1.1 & F1.2 Initialization  
> **Author:** Architecture Review AI (Antigravity)  
> **Date:** 2026-08-15  

---

## 1. Product Manifest (Capabilities & Scope)

Finance OS Kernel F1 Ledger Engine provides core double-entry bookkeeping and accounting capabilities to the Bella Platform. It handles the financial truth layer without any business vertical dependencies.

### Capabilities Exposed:
- **COA Management**: Chart of accounts definition with strict normal balances (Debit/Credit).
- **Accounting Periods**: Open, close, and lock periods. Prevent posting to closed/locked periods.
- **Double-Entry Posting**: Balanced journal entry transactions.
- **Traceable Sourcing**: Map financial records back to vertical business events via opaque `source_type`/`source_id` references.
- **Immutability Enforcement**: Voiding and reversing transactions. No direct updates to posted entries.
- **Idempotent Dispatch**: Prevent duplicate posting using client-provided unique idempotency keys.
- **Decimal Precision**: Represent money in string-based minor units (`amount_minor`) to avoid floating-point math errors.
- **Reporting Dimensions**: Support cost center, BU, location, and department dimensions natively.

---

## 2. Ownership Map ("WHO OWNS THIS DATA?")

| Table Name | Owner Context | Data Definition |
|---|---|---|
| `finance_accounts` | F1 Ledger | Chart of accounts list |
| `finance_accounting_periods` | F1 Ledger | Accounting periods & locks |
| `finance_transactions` | F1 Ledger | Transaction headers, idempotency keys, source mapping |
| `finance_transaction_lines` | F1 Ledger | Double-entry line items, debit/credit string amounts, dimensions |
| `finance_outbox_events` | F1 Ledger | Transactional outbox records for event publishing |
| `finance_audit_trail` | F1 Ledger | Immutable log of all updates to financial state |

---

## 3. Contract Dependency Map

```
Vertical Layer (Spa, Hospital, etc.)
               │
               ▼
Vertical Finance Bridge (ACL)
               │
               ▼ (Calls via Public Contracts only)
ILedgerEngine Contract (F1)
               │
               ▼
LedgerEngineService (F1 Implementation)
               │
               ├── Updates database (finance_*)
               └── Writes to transactional outbox (finance_outbox_events)
```

---

## 4. Additive Migration Plan

No existing accounting or business tables will be deleted or modified. The migration strictly creates new tables.

### SQL Migrations Proposed:
- `CREATE TABLE finance_accounting_periods` with columns for period range and status.
- `CREATE TABLE finance_accounts` with code, normal balance, and status.
- `CREATE TABLE finance_transactions` with status, functional/transaction currency, source type/id, and idempotency key.
- `CREATE TABLE finance_transaction_lines` with debit/credit string representation and dimensions.
- `CREATE TABLE finance_outbox_events` with payload and status.
- `CREATE TABLE finance_audit_trail` for immutable history tracking.
- Enable RLS on all tables with policies asserting `tenant_id = auth.jwt()->>'tenant_id'`.

---

## 5. 10 Automated Verification Gates Plan

| Gate | Verification Target | Test Method |
|---|---|---|
| **Gate F-1** | Architecture Compliance | Static analysis to ensure no vertical imports in F1, and strict typing (no `any` type). |
| **Gate F-2** | Contract Boundary | Verify vertical layers cannot query `finance_*` tables directly, only via contracts. |
| **Gate F-3** | Tenant Isolation (P0) | Assert that data from Tenant A is never visible/accessible to Tenant B across all F1 methods. |
| **Gate F-4** | Double-Entry Invariant | Assert that trying to post an imbalanced entry (Σ debit ≠ Σ credit) throws `DOUBLE_ENTRY_IMBALANCE`. |
| **Gate F-5** | Transaction Immutability | Assert that updating a transaction with status `POSTED` throws an exception, and that reversing creates mirror lines. |
| **Gate F-6** | Idempotency | Assert that two consecutive `postTransaction` calls with the same key return the same transaction ID without duplication. |
| **Gate F-7** | Period Control | Assert that posting to a `CLOSED` or `LOCKED` period is blocked with `PERIOD_NOT_OPEN`. |
| **Gate F-8** | Event-After-Persistence | Verify that `finance_outbox_events` has the event record committed in the same transaction, and the dispatcher publishes it successfully. |
| **Gate F-9** | Full Regression | Run all Finance OS test suites to ensure 100% test coverage. |
| **Gate F-10** | Financial State Reconstruction | Rebuild materialized state from authoritative records and verify equality. |
