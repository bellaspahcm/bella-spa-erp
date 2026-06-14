---
title: 'Student Training Lesson Progress'
type: 'feature'
created: '2026-06-14'
status: 'done'
context:
  - docs/implementation-artifacts/spec-student-training-portal-readonly.md
  - docs/implementation-artifacts/spec-student-training-enrollment-admin.md
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** Student users can see enrolled courses and lessons, but every lesson remains static with no personal completion state. The portal needs a minimal progress loop before adding video heartbeat, quizzes, or sequential unlock rules.

**Approach:** Add a student-only server action that marks one lesson completed after verifying the lesson belongs to a course where the current student has an active enrollment. Read `student_lesson_progress` into the portal overview and show per-course progress plus per-lesson completion controls.

## Boundaries & Constraints

**Always:** Derive tenant/user from the authenticated student session. Verify lesson -> module -> course -> active enrollment before writing progress. Assert side effects in tests by checking `student_lesson_progress` insert/update payloads.

**Ask First:** Video heartbeat, time tracking accuracy, quiz completion, mandatory sequential unlock, certificates, tuition collection, or accounting events.

**Never:** Do not accept student id or enrollment id from the browser. Do not mark progress for paused/withdrawn enrollments. Do not let client code write Supabase tables directly.

</frozen-after-approval>

## Code Map

- `src/types/training.ts` -- lesson progress row/payload types and portal course types with progress.
- `src/services/training-actions.ts` -- reads progress in portal overview and adds `markStudentLessonComplete`.
- `src/app/student/dashboard/page.tsx` -- renders progress totals, progress bars, and per-lesson state.
- `src/app/student/dashboard/StudentLessonCompleteButton.tsx` -- client button invoking the server action.
- `src/__tests__/training-actions.test.ts` -- side-effect tests for insert and active enrollment guard.
- `src/__tests__/tenant-isolation-source-guards.test.ts` -- source guard for student client components.

## Tasks & Acceptance

**Execution:**
- [x] `src/types/training.ts` -- add progress types.
- [x] `src/services/training-actions.ts` -- add progress read and mark-complete action.
- [x] `src/app/student/dashboard/*` -- display progress and completion button.
- [x] Tests -- assert ownership checks and progress side effects.

**Acceptance Criteria:**
- Given an active enrolled student clicks complete on a lesson in their course, when the action runs, then `student_lesson_progress` is inserted or updated for that enrollment and lesson.
- Given a lesson belongs outside the student's active enrollment, when the action runs, then no progress row is written.
- Given the student dashboard loads, when progress rows exist, then completed lessons and course percentages reflect those rows.

## Verification

**Commands:**
- `npm.cmd test -- src/__tests__/training-actions.test.ts src/__tests__/tenant-isolation-source-guards.test.ts --runInBand` -- expected: pass.
- `npm.cmd run lint` -- expected: pass.
- `npm.cmd run build` -- expected: pass.
- `git diff --check` -- expected: no whitespace errors.
