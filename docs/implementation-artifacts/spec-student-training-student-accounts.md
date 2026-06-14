---
title: 'Student Training Student Accounts'
type: 'feature'
created: '2026-06-14'
status: 'done'
context:
  - docs/implementation-artifacts/spec-student-training-enrollment-admin.md
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** Admins currently must create users in Settings and manually assign `role = student` before enrollment, which is easy to miss and does not match the training workflow.

**Approach:** Add a training-owned student account page that creates Supabase Auth + `public.users` accounts through the existing central `createUser` action, but forces `role = student` and exposes the temporary password to the admin.

## Boundaries & Constraints

**Always:** Use the existing central user creation path for auth/profile creation, rollback, and audit behavior. Enforce admin/super_admin in the training action and force `role = student`.

**Ask First:** Bulk import, SMS/Zalo invite, password reset flow, automatic enrollment after account creation, or changing `createUser` schema behavior.

**Never:** Do not let the browser choose arbitrary roles or tenant ids. Do not duplicate Supabase Auth account creation logic in the training module.

</frozen-after-approval>

## Code Map

- `src/types/training.ts` -- student account input/overview types.
- `src/services/training-actions.ts` -- student account overview and create action.
- `src/app/dashboard/training/students/page.tsx` -- student account route.
- `src/app/dashboard/training/students/TrainingStudentsClient.tsx` -- create/list UI with temporary password display.
- `src/app/dashboard/training/page.tsx` -- CTA to student account page.
- `src/__tests__/training-actions.test.ts` -- validates forced student role and no auth creation on invalid input.
- `src/__tests__/tenant-isolation-source-guards.test.ts` -- source guard for no direct client queries.

## Tasks & Acceptance

**Execution:**
- [x] `src/types/training.ts` -- add student account types.
- [x] `src/services/training-actions.ts` -- add account overview/create actions.
- [x] `src/app/dashboard/training/students/*` -- add UI.
- [x] Tests -- assert forced role and source isolation.

**Acceptance Criteria:**
- Given admin creates a training student account, then the central user action is called with `role = student`.
- Given invalid form input, then no auth/user creation action runs.
- Given source guards scan the student account UI, then no client direct Supabase query exists.

## Verification

**Commands:**
- `npm.cmd test -- src/__tests__/training-actions.test.ts src/__tests__/tenant-isolation-source-guards.test.ts --runInBand` -- expected: pass.
- `npm.cmd run lint` -- expected: pass.
- `npm.cmd run build` -- expected: pass.
- `git diff --check` -- expected: no whitespace errors.
