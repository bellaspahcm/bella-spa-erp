# Bella English Center E6-E10 Roadmap Reconciliation

**Date:** 2026-09-14
**Canonical main:** `af28f1a0`
**Status:** ROADMAP RECONCILED / E6 NOT OPENED

---

## Current Canonical Status

```text
E2 - Enrollment                    BOUNDED VERIFIED + SEALED
E3 - Program / Course / Class      BOUNDED VERIFIED + SEALED
E4 - Teacher / Academic Workforce  BOUNDED VERIFIED + SEALED
E5 - Timetable / Room Scheduling   BOUNDED VERIFIED + SEALED

E6+                                NOT OPENED
Reason: phase scope reconciled here, implementation branches not started
```

E2-E5 form the first complete operational chain:

```text
enroll student
  -> structure program/course/class
  -> assign teacher/workforce context
  -> schedule class sessions and rooms
```

---

## Reconciliation Principles

This roadmap is a scope and ownership freeze for the remaining English Center
phases. It is not implementation evidence.

1. Product phases must not create new Education Kernel engines.
2. If an Education OS public contract exists, English Center must consume it
   instead of writing a parallel kernel.
3. Preschool product capabilities may be used as implementation references, but
   must not become shared dependencies unless promoted through governance.
4. Finance mechanics and accounting policy remain Finance OS / enterprise
   finance responsibilities. English Center owns tuition business context only.
5. Platform owns tenant, branch/org context, Party identity, policy/rule
   governance, audit primitives, and analytics primitives where available.

---

## Capability Inventory

```text
Education OS public contracts found:
  course.contract.ts
  enrollment.contract.ts
  student.contract.ts
  attendance.contract.ts
  assessment.contract.ts
  teacher-assignment.contract.ts
  policy-registry.contract.ts
  workflow-registry.contract.ts
  extension.contract.ts

Education OS bounded contexts per Constitution:
  Course
  Enrollment
  Student
  Attendance
  Assessment

Explicitly excluded from Course Kernel:
  timetabling
  classroom layout planning
  school-specific semester setups

Preschool product capabilities found:
  scheduling / staff roster / ratio compliance / substitution
  parent engagement / consent / delivery / response / acknowledgements
  finance / tuition billing / invoice issuance / payment reconciliation
  analytics / preschool command-center style projections

Finance OS public contracts found:
  Ledger Engine
  Cash Reporting Engine

Platform capabilities found:
  Org Unit / branch hierarchy
  Rule Engine / Rule Governance
  Temporal Engine
  Analytics Engine
  Contract Registry
```

---

## E6 - Attendance & Learning Operations

**Canonical scope:** attendance capture per scheduled English Center class
session, plus lightweight learning progress views tied to enrollment/class
context.

```text
Reuse:
  Education Attendance Contract for canonical roll-call records.
  Education Assessment Contract for score/progress records when grading is used.
  E2 enrollment records for student-to-course/class context.
  E3 class/course structures.
  E5 class sessions for lesson occurrence context.
  Platform tenant/branch access.

English Center owns:
  Session-level attendance UX and workflow.
  Mapping an English Center class session to canonical attendance records.
  English-learning progress labels, classroom notes, and operational views.
  Branch-scoped filters and teacher-facing screens.

Out of scope:
  New attendance kernel.
  Direct mutation of academic history outside Education contracts.
  New grading engine or GPA logic.
  Billing and tuition consequences of attendance.
```

**E6 acceptance gates:**

```text
teacher marks attendance for a scheduled session
student attendance history is retrievable by enrollment
absent/excused/present status is branch and tenant isolated
learning progress records reuse Assessment contract where applicable
session cancellation/completion behavior is reconciled with attendance
no new Education Kernel scheduling or attendance engine
```

---

## E7 - Tuition & Billing

**Canonical scope:** English Center tuition packages, billing schedule, invoice
context, payment status, and receivable views for language-center operations.

```text
Reuse:
  Finance OS Ledger Contract for posting accounting transactions.
  Finance OS Cash Contract for cash movement/reporting reads where needed.
  E2 enrollment as tuition trigger context.
  E3 course/class price-bearing context.
  Platform tenant/branch/org context.

Reference, not dependency:
  Preschool tuition billing, invoice issuance, payment reconciliation services.

English Center owns:
  Tuition plan catalog specific to English programs/classes.
  Installment schedule and class/enrollment billing context.
  Student-facing balance view and operational collections workflow.
  Product-level invoice metadata before Finance posting.

Finance / Enterprise owns:
  Chart of accounts.
  Revenue recognition policy.
  Ledger posting mechanics.
  Cash reconciliation mechanics.
  Effective-dated accounting treatment.

Out of scope:
  Product-owned ledger.
  Product-owned accounting policy.
  Direct writes to Finance Kernel tables.
  Payroll or teacher compensation.
```

**E7 acceptance gates:**

```text
tuition plan can be assigned to an enrollment/class
invoice/payment lifecycle is tenant and branch isolated
ledger/cash interactions go through Finance public contracts
duplicate payment/idempotency behavior is verified
accounting policy is not hard-coded in English Center
```

---

## E8 - Parent / Student Engagement

**Canonical scope:** communications, notifications, consent-aware messages,
student/parent snapshots, and response tracking for English Center operations.

```text
Reuse:
  Education Student Contract for student identity.
  Platform Party identity for parent/guardian/person context.
  E2-E7 product projections for enrollment, class, session, attendance,
  progress, and billing snapshots.
  Platform policy/rule/audit primitives where required.

Reference, not dependency:
  Preschool parent-engagement consent/delivery/response/acknowledgement services.

English Center owns:
  English Center message templates and communication workflows.
  Parent/student portal views for language-center context.
  Attendance/progress/payment notification triggers.
  Branch-scoped engagement dashboard.

Out of scope:
  Cross-product parent engagement kernel without governance promotion.
  Healthcare-style consent or medical communication coupling.
  Direct Preschool service dependency.
```

**E8 acceptance gates:**

```text
guardian/student recipient resolution respects tenant and branch scope
communication snapshot is immutable enough for audit/replay
delivery and acknowledgement states are tracked
Preschool code is not imported directly
engagement events cannot leak across tenants or branches
```

---

## E9 - Chain Command Center

**Canonical scope:** multi-branch operations dashboard for English Center chain
leadership.

```text
Reuse:
  Platform Org Unit hierarchy for branch/region/company rollups.
  Platform Analytics Engine where practical.
  Read-only projections from E2-E8.
  Finance read contracts for allowed financial summaries.

English Center owns:
  Product-specific KPIs and dashboard composition.
  Branch comparison views.
  Class utilization, teacher load, attendance risk, engagement, tuition status,
  and schedule health read models.

Out of scope:
  Writing operational records from dashboard read models.
  Direct cross-product analytics dependency.
  Direct Finance Kernel table queries.
  Whole-company ERP command center outside English Center.
```

**E9 acceptance gates:**

```text
branch rollups use Platform org hierarchy
read models are tenant isolated
dashboard reads do not mutate source records
financial numbers are sourced through approved Finance boundaries
E2-E8 metrics reconcile to underlying product records
```

---

## E10 - Full Product Reconciliation + Release Candidate

**Canonical scope:** end-to-end reconciliation, release-candidate evidence, and
bounded product sealing.

```text
Reuse:
  All accepted evidence from E2-E9.
  Dependency-aware CI gates.
  Education architecture baseline policy.
  Migration and smoke verification tooling.

English Center owns:
  Full product readiness evidence.
  End-to-end workflow reconciliation.
  Release candidate documentation.
  Residual-risk register for product-specific items.

Out of scope:
  Broad Education/Preschool debt remediation.
  Root TypeScript cleanup outside changed English Center scope.
  Finance policy remediation unrelated to English Center.
  Infrastructure claims not backed by fresh evidence.
```

**E10 acceptance gates:**

```text
E2-E9 bounded seals remain valid on canonical main
end-to-end workflow smoke passes
tenant and branch isolation are reverified across the full product chain
CI has zero unknown attribution
introduced-by-English-Center release violations = 0
release candidate record is updated after canonical main smoke
```

---

## Frozen Roadmap Decision

```text
E6  Attendance & Learning Operations
E7  Tuition & Billing
E8  Parent / Student Engagement
E9  Chain Command Center
E10 Full Product Reconciliation + Release Candidate
```

This roadmap is now the canonical planning baseline for Bella English Center
E6-E10. It authorizes opening E6 planning/architecture-gate work next, but does
not authorize writing E6 implementation code without the E6-specific capability
reconciliation and architecture gate result.

---

## E6 Opening Rule

E6 may open only from canonical main after this roadmap is merged and after an
E6 architecture gate result confirms:

```text
Education Attendance Contract reuse
Assessment Contract reuse or explicit out-of-scope decision
E5 scheduled session mapping
E2 enrollment mapping
tenant isolation
branch isolation
no Education Kernel modification
no Preschool direct dependency
no Finance/billing scope
```
