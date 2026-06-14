---
title: 'Student Training Class Schedule'
type: 'feature'
created: '2026-06-14'
status: 'done'
context:
  - docs/implementation-artifacts/spec-student-training-enrollment-admin.md
  - docs/implementation-artifacts/spec-student-training-lesson-progress.md
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** Training courses can be authored and students can learn through the portal, but admins cannot schedule live training sessions for theory, practice, orientation, or exams.

**Approach:** Add an admin class schedule manager that reads tenant courses/trainers/classes and allows admins to create or update `training_classes`. Attendance remains out of scope for this slice.

## Boundaries & Constraints

**Always:** Resolve tenant from authenticated admin, verify course and trainer belong to the same tenant, and keep UI reads/writes behind server actions.

**Ask First:** Student attendance writes, calendar reminders, Zalo notifications, payroll impact, tuition/accounting recognition, or recurring class generation.

**Never:** Do not accept `tenant_id` from the browser. Do not assign student users as trainers. Do not move an existing class to another course through update.

</frozen-after-approval>

## Code Map

- `src/types/training.ts` -- class schedule row/payload/detail types.
- `src/services/training-actions.ts` -- class overview/create/update actions with tenant guards.
- `src/app/dashboard/training/classes/page.tsx` -- admin route for schedule management.
- `src/app/dashboard/training/classes/TrainingClassesClient.tsx` -- form/list UI.
- `src/app/dashboard/training/page.tsx` -- CTA to class schedule page.
- `src/__tests__/training-actions.test.ts` -- tenant-scoped query and course guard tests.
- `src/__tests__/tenant-isolation-source-guards.test.ts` -- source guard for class route.

## Tasks & Acceptance

**Execution:**
- [x] `src/types/training.ts` -- add class schedule types.
- [x] `src/services/training-actions.ts` -- add overview/create/update class actions.
- [x] `src/app/dashboard/training/classes/*` -- add admin schedule UI.
- [x] Tests -- cover tenant scope and course guard.

**Acceptance Criteria:**
- Given admin opens `/dashboard/training/classes`, when courses/classes exist in the tenant, then they see class schedule rows with course/trainer details.
- Given admin creates a class for a course outside tenant, then no `training_classes` insert is attempted.
- Given source guards scan class route, then page/client do not query Supabase tables directly.

## Verification

**Commands:**
- `npm.cmd test -- src/__tests__/training-actions.test.ts src/__tests__/tenant-isolation-source-guards.test.ts --runInBand` -- expected: pass.
- `npm.cmd run lint` -- expected: pass.
- `npm.cmd run build` -- expected: pass.
- `git diff --check` -- expected: no whitespace errors.
