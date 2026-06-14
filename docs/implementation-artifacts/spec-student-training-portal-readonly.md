---
title: 'Student Training Portal Readonly'
type: 'feature'
created: '2026-06-14'
status: 'done'
context:
  - docs/implementation-artifacts/spec-student-training-foundation.md
  - docs/implementation-artifacts/spec-student-training-admin-crud.md
  - docs/implementation-artifacts/spec-student-training-enrollment-admin.md
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** Student users can be routed to `/student/dashboard`, and admins can enroll them into courses, but the student portal still shows placeholder copy. Students need a safe read-only view of their own enrolled courses before progress tracking is added.

**Approach:** Add a student-only server action that loads the current user's enrollment rows, course tree, modules, and lessons. Replace the placeholder dashboard with a read-only portal that shows courses, tuition summary, modules, and lessons for the authenticated student only.

## Boundaries & Constraints

**Always:** Authorize role `student`, derive tenant and user id from the authenticated session, and filter enrollment rows by both `tenant_id` and `user_id`. Keep `/student/dashboard` free of direct browser Supabase queries.

**Ask First:** Writing `student_lesson_progress`, unlocking/sequencing rules, lesson playback, quiz submission, tuition payment collection, or accounting recognition.

**Never:** Do not accept student id from the client. Do not expose operational dashboard data, customer data, staff data, or other students' enrollments.

</frozen-after-approval>

## Code Map

- `src/types/training.ts` -- student portal overview/enrollment types.
- `src/services/training-actions.ts` -- `getStudentTrainingPortalOverview` student-only read action.
- `src/app/student/dashboard/page.tsx` -- read-only student course dashboard.
- `src/__tests__/training-actions.test.ts` -- confirms current-user enrollment filter.
- `src/__tests__/tenant-isolation-source-guards.test.ts` -- confirms route isolation and no direct client queries.

## Tasks & Acceptance

**Execution:**
- [x] `src/types/training.ts` -- add portal overview types.
- [x] `src/services/training-actions.ts` -- add student-only overview action.
- [x] `src/app/student/dashboard/page.tsx` -- render enrolled courses/modules/lessons and tuition summary.
- [x] Tests -- cover current user filter and source isolation.

**Acceptance Criteria:**
- Given a student opens `/student/dashboard`, when they have enrollments, then they see only their enrolled course trees and tuition summary.
- Given a student has no enrollments, when they open the portal, then they see an empty state without operational data.
- Given source guards scan `/student/dashboard`, then the page contains no direct Supabase `.from(...)` client query.

## Verification

**Commands:**
- `npm.cmd test -- src/__tests__/training-actions.test.ts src/__tests__/tenant-isolation-source-guards.test.ts --runInBand` -- expected: pass.
- `npm.cmd run lint` -- expected: pass.
- `npm.cmd run build` -- expected: pass.
- `git diff --check` -- expected: no whitespace errors.
