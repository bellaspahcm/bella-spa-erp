# Bella English Center - RC Closure Architecture Gate

Canonical base: `origin/main@4b213e74`

Status: PASS FOR IMPLEMENTATION

## 1. Product Manifest

RC Closure is a bounded product-hardening workstream for E6-E9 consumption evidence. It adds thin API and dashboard surfaces for already sealed Bella English Center capabilities:

- E6 Attendance & Learning Operations
- E7 Tuition / Billing
- E8 Parent / Student Engagement
- E9 Chain Command Center

This workstream does not introduce a new roadmap capability, Education Kernel capability, Healthcare Kernel capability, or cross-product feature. It closes the E10 RC blockers for missing consumption surfaces and UI-to-API-to-service smokeability.

## 2. Ownership Map

| Data / Behavior | Owner | RC Closure action |
| --- | --- | --- |
| Class session attendance and learning progress | Bella English Center product | Expose product API and dashboard calls through `LearningOperationsService`. |
| Canonical attendance / assessment records | Education OS contracts | Reuse attendance and assessment contracts; no kernel edits. |
| Tuition plans, assignments, invoices, payments, allocations | Bella English Center product | Expose product API and dashboard calls through `TuitionBillingService`. |
| Finance ledger and cash movements | Finance / platform contracts | Remain optional contract dependencies; no direct table access. |
| Engagement templates, messages, recipients, responses | Bella English Center product | Expose product API and dashboard calls through `EngagementService`. |
| Student and party identity | Education OS / Party platform contracts | Reuse public contracts only; no direct kernel table access. |
| Chain command projections and work queue | Bella English Center product | Expose command center dashboard through existing service and repository. |
| Org-unit hierarchy | Platform org-unit contract | Reuse public org-unit engine; no platform edits. |

## 3. Contract Dependency Map

```text
Dashboard UI
  -> /api/english-center/learning/*
  -> LearningOperationsService
  -> IEducationAttendanceContract / IEducationAssessmentContract
  -> Bella English Center product tables + canonical Education records

Dashboard UI
  -> /api/english-center/tuition/*
  -> TuitionBillingService
  -> optional Finance ledger / cash contracts
  -> Bella English Center product tuition tables

Dashboard UI
  -> /api/english-center/engagement/*
  -> EngagementService
  -> IEducationStudentContract + Party contract
  -> Bella English Center product engagement tables

Dashboard UI
  -> /api/english-center/command-center
  -> ChainCommandCenterService
  -> OrgUnit contract
  -> E2-E8 Bella English Center projections
```

## 4. Additive Migration Plan

No migration is required.

The workstream consumes tables, services, and contracts already created by E6-E9. If a missing database primitive is discovered, RC Closure must stop and record a reconciliation gap instead of adding schema opportunistically.

## 5. Automated Verification Gates Plan

1. Route smoke tests prove E6-E9 APIs authenticate tenant scope and dispatch to the sealed product services.
2. UI surface tests prove dashboard pages are wired to the new API endpoints.
3. English Center targeted regression remains green.
4. Scoped TypeScript check remains green.
5. Migration zero-downtime check remains green.
6. Migration changed-check remains green or records the known drift-skip limitation.
7. Architecture Guard remains green.
8. Education conformance remains green.
9. `git diff --check` remains green.
10. After merge, canonical-main smoke must rerun from `origin/main`.
11. RC status may change only after canonical-main smoke and evidence update pass.
