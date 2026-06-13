---
title: 'Student Training Admin CRUD'
type: 'feature'
created: '2026-06-14'
status: 'done'
context:
  - docs/implementation-artifacts/spec-student-training-foundation.md
  - docs/plans/student-training-expansion-plan.html
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** The training foundation has schema, route isolation, and an admin shell, but admins still cannot create real courses, modules, or lessons. Without tenant-scoped server actions, any UI work would risk direct client database reads or cross-tenant writes.

**Approach:** Add Phase 1 admin CRUD for training courses, course modules, and lessons through server actions only. Keep student enrollment, tuition collection, and lesson progress heartbeat out of scope for the next slice.

## Boundaries & Constraints

**Always:** All reads/writes must resolve the current tenant from the authenticated user and filter parent records by tenant before inserting/updating child records. Training UI must call server actions and must not query Supabase tables directly from the browser.

**Ask First:** Creating student accounts, collecting tuition, recognizing tuition revenue, adding accounting outbox events, or applying schema changes beyond the foundation migration.

**Never:** Do not allow `student_training` to become a service package module. Do not let admin-supplied `tenant_id` decide write scope. Do not swallow database errors.

</frozen-after-approval>

## Code Map

- `src/services/training-actions.ts` -- tenant-scoped server actions for training courses, modules, and lessons.
- `src/types/training.ts` -- strict training row/input/payload types until generated Supabase types include the new tables.
- `src/app/dashboard/training/courses/page.tsx` -- admin route for training course management.
- `src/app/dashboard/training/courses/TrainingCoursesClient.tsx` -- form/list UI that invokes server actions.
- `src/__tests__/training-actions.test.ts` -- action regression tests for tenant scope, validation, and DB error propagation.
- `src/__tests__/tenant-isolation-source-guards.test.ts` -- source guard preventing direct client training table queries.

## Tasks & Acceptance

**Execution:**
- [x] `src/types/training.ts` -- define course/module/lesson types and inputs.
- [x] `src/services/training-actions.ts` -- add read/create/update/archive actions with tenant/parent guards.
- [x] `src/app/dashboard/training/courses/page.tsx` -- add admin page and data loading.
- [x] `src/app/dashboard/training/courses/TrainingCoursesClient.tsx` -- add CRUD UI for course/module/lesson authoring.
- [x] `src/app/dashboard/training/page.tsx` -- link shell CTA to the new course manager.
- [x] Tests -- cover tenant-scoped actions and no client direct queries.

**Acceptance Criteria:**
- Given an admin opens `/dashboard/training/courses`, when courses exist for their tenant, then the page lists courses, modules, and lessons from server actions.
- Given an admin creates a course, when the DB insert fails, then the action returns `{ success: false, error }` and does not report success.
- Given an admin adds a module, when the course is outside the tenant, then no module insert is attempted.
- Given source guards scan training pages, when client/page code is inspected, then there is no direct `.from('courses'|'course_modules'|'lessons'|'students')` query outside server actions.

## Verification

**Commands:**
- `npm.cmd test -- src/__tests__/training-actions.test.ts src/__tests__/tenant-isolation-source-guards.test.ts --runInBand` -- expected: pass.
- `npm.cmd run lint` -- expected: pass.
- `npm.cmd run build` -- expected: pass.
- `git diff --check` -- expected: no whitespace errors.
