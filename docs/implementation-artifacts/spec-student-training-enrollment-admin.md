---
title: 'Student Training Enrollment Admin'
type: 'feature'
created: '2026-06-14'
status: 'done'
context:
  - docs/implementation-artifacts/spec-student-training-foundation.md
  - docs/implementation-artifacts/spec-student-training-admin-crud.md
  - docs/plans/student-training-expansion-plan.html
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** Admins can create training courses and lessons, but cannot assign real student users to a course. Without enrollment management, `/student/dashboard` has no concrete course relationship to show in the next slice.

**Approach:** Add a tenant-scoped admin enrollment page that lists existing `student` users, active/draft courses, and existing enrollment rows from `students`. Allow admins to create and update enrollment status and tuition fields through server actions only.

## Boundaries & Constraints

**Always:** Resolve tenant and role from the authenticated admin. Verify both course and student user belong to the current tenant before inserting/updating `students`. Return explicit `{ success: false, error }` on validation or database failures. Keep client code free of direct Supabase `.from(...)` calls.

**Ask First:** Creating auth accounts, sending invites, collecting payments, recognizing tuition as revenue, or writing accounting/outbox events.

**Never:** Do not accept admin-supplied `tenant_id`. Do not enroll staff users as students. Do not allow moving an enrollment row to another user or course through update. Do not swallow database errors.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Create enrollment | Admin selects a tenant student user and course with tuition total | Insert one `students` row with tenant, user, course, status, tuition fields | If duplicate or DB failure, return explicit failure |
| Wrong tenant course | Course id is outside current tenant | No `students` insert is attempted | Return course-not-found/DB error |
| Wrong role user | Selected user is not role `student` or not same tenant | No `students` insert is attempted | Return student-user-not-found error |
| Update enrollment | Admin changes status/tuition on existing row | Update only mutable enrollment fields | If row belongs outside tenant, return not found |

</frozen-after-approval>

## Code Map

- `src/types/training.ts` -- add student enrollment and student user types.
- `src/services/training-actions.ts` -- tenant-scoped enrollment overview/create/update actions.
- `src/app/dashboard/training/enrollments/page.tsx` -- enrollment management route.
- `src/app/dashboard/training/enrollments/TrainingEnrollmentsClient.tsx` -- enrollment form/list UI.
- `src/app/dashboard/training/page.tsx` -- link admin shell to enrollment manager.
- `src/__tests__/training-actions.test.ts` -- enrollment action tests for tenant/user/course guards.
- `src/__tests__/tenant-isolation-source-guards.test.ts` -- source guard for no direct client training queries.

## Tasks & Acceptance

**Execution:**
- [x] `src/types/training.ts` -- add typed enrollment/user rows and inputs.
- [x] `src/services/training-actions.ts` -- add overview/create/update enrollment actions with tenant guards.
- [x] `src/app/dashboard/training/enrollments/*` -- add admin UI for enrollment operations.
- [x] `src/app/dashboard/training/page.tsx` -- add CTA to enrollment manager.
- [x] Tests -- cover validation, wrong tenant, wrong user role, and client source isolation.

**Acceptance Criteria:**
- Given an admin opens `/dashboard/training/enrollments`, when tenant courses/student users exist, then the page lists selectable students/courses and current enrollments.
- Given a course is outside the tenant, when admin attempts enrollment, then no enrollment insert is attempted.
- Given a selected user is not a tenant student, when admin attempts enrollment, then no enrollment insert is attempted.
- Given source guards scan the enrollment route, then no browser component directly queries training/user tables.

## Verification

**Commands:**
- `npm.cmd test -- src/__tests__/training-actions.test.ts src/__tests__/tenant-isolation-source-guards.test.ts --runInBand` -- expected: pass.
- `npm.cmd run lint` -- expected: pass.
- `npm.cmd run build` -- expected: pass.
- `git diff --check` -- expected: no whitespace errors.
