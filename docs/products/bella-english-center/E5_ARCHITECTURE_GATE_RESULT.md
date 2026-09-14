# Bella English Center E5 Timetable & Room Scheduling Architecture Gate Result

**Date:** 2026-09-14
**Status:** APPROVED FOR PRODUCT-LAYER IMPLEMENTATION
**Scope:** E5 Timetable & Room Scheduling for Bella English Center.

---

## 1. Product Manifest

E5 provides English Center-specific timetable management:

- Branch-scoped classroom/room registry.
- Class session scheduling for English Center classes.
- Teacher, room, and class overlap conflict checks.
- Timetable lifecycle states: `scheduled`, `completed`, `cancelled`.
- Tenant and branch isolation through existing Platform and English Center scope fields.

Out of scope:

- No new Education Kernel scheduling engine.
- No modification to `src/platform/education/`.
- No Healthcare or Logistics kernel dependency.
- No accounting, billing, grading, attendance, or payroll policy changes.

## 2. Ownership Map

| Data / Capability | Owner | E5 Decision |
| --- | --- | --- |
| Branch / org context | Platform Org Unit | Reuse `org_units` through `branch_id`; no branch table duplication. |
| Course / class catalog | English Center Product E3 | Reuse `english_center_courses` and `english_center_classes`. |
| Teacher workforce | English Center Product E4 | Reuse `english_center_teachers` and `english_center_teacher_branches`. |
| Generic Education invariants | Education OS Kernel | Consume existing contracts only when needed; no scheduling kernel exists today. |
| Room registry | English Center Product E5 | Create product-owned `english_center_rooms`. |
| Timetable session | English Center Product E5 | Create product-owned `english_center_class_sessions`. |

## 3. Contract Dependency Map

```text
Bella English Center E5
  -> Platform Org Unit branch context:
       org_units
       user_org_unit_access
  -> English Center Product E3:
       english_center_classes
       english_center_courses
  -> English Center Product E4:
       english_center_teachers
       english_center_teacher_branches
  -> Product-owned E5:
       english_center_rooms
       english_center_class_sessions
```

No Education Kernel or Healthcare Kernel files are modified.

## 4. Additive Migration Plan

Add one product-layer migration:

- `english_center_rooms`: tenant and branch scoped room/facility primitive for the English Center product.
- `english_center_class_sessions`: tenant, branch, class, teacher, room, start/end lifecycle record.
- RLS policies reuse `user_org_unit_access` for branch visibility and writes.
- Indexes support tenant/branch lookup and overlap-window queries.
- Existing tables are referenced, not altered or dropped.

## 5. 11 Automated Verification Gates Plan

| Gate | Required E5 Evidence |
| --- | --- |
| 1. Architecture Compliance | No `src/platform/education/`, Healthcare, or Logistics frozen artifact modifications. |
| 2. Contract Boundary | Product tables only; Platform branch primitive reused; no Education scheduling kernel invented. |
| 3. Tenant Isolation | Service and repository filter all reads/writes by `tenant_id`. |
| 4. RLS & Authorization | Room/session RLS uses `user_org_unit_access` branch projection. |
| 5. Database Migration Safety | Additive `CREATE TABLE IF NOT EXISTS` and indexes only. |
| 6. Event-After-Persistence | No event publishing in E5 scope. |
| 7. Academic Safety Routing | No grading/enrollment eligibility changes in E5 scope. |
| 8. Temporal Provenance | No academic record history mutation in E5 scope. |
| 9. Rule Governance | No grading rule changes in E5 scope. |
| 10. Audit Evidence Integrity | No transcript/audit package behavior changed in E5 scope. |
| 11. Platform Regression | Run focused E5 tests, English Center typecheck, architecture guard, and education verify as feasible. |

## Gate Decision

`ARCHITECTURAL GAP DETECTED` is not triggered for E5 because the Education OS Constitution explicitly excludes timetabling/classroom layout from the Course Kernel bounded context, and the current Education Kernel contains no generic scheduling capability. E5 therefore proceeds as an English Center product extension.
