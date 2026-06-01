---
title: 'Clean Salary Page ESLint Warnings'
type: 'chore'
created: '2026-06-01'
status: 'done'
baseline_commit: 'ea3253339d5810f19e001b43d2ea6bfd8a025539'
context:
  - '{project-root}/AGENTS.md'
  - '{project-root}/node_modules/next/dist/docs/01-app/01-getting-started/07-mutating-data.md'
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** `src/app/dashboard/salary/page.tsx` currently has ESLint warnings for unused imports and an unused handler. The previous salary hardening slice passed lint with warnings, which leaves avoidable noise in future verification.

**Approach:** Remove only the unused imports and unused `handleApproveAll` function from the salary dashboard page. Do not change behavior, UI layout, salary actions, or data fetching.

## Boundaries & Constraints

**Always:** Keep this as a cleanup-only slice. Preserve all active handlers, props, imports that are still used, and current UI behavior. Re-run focused lint and type checks.

**Ask First:** Any change to salary workflow behavior, component structure, page layout, or button visibility.

**Never:** Do not refactor salary business logic, do not change server actions, and do not remove state that is still passed to child components.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|----------------------------|----------------|
| Salary page lint | Existing page has unused import/function warnings | ESLint reports no warnings for `page.tsx` caused by the removed symbols | N/A |
| Runtime behavior | User opens salary page | Existing active handlers and child props still compile and render | TypeScript compile catches missing references |

</frozen-after-approval>

## Code Map

- `src/app/dashboard/salary/page.tsx` -- Salary dashboard client page; remove unused `motion`, icon imports, and `handleApproveAll`.
- `docs/DEVELOPMENT_LOG.md` -- Add dated maintenance entry for this cleanup slice.

## Tasks & Acceptance

**Execution:**
- [x] `src/app/dashboard/salary/page.tsx` -- Remove unused imports reported by ESLint -- eliminates warning noise without behavior change.
- [x] `src/app/dashboard/salary/page.tsx` -- Remove unused `handleApproveAll` function -- eliminates warning noise without changing rendered controls.
- [x] `docs/DEVELOPMENT_LOG.md` -- Record objective, change, and verification -- keeps maintenance trail searchable.

**Acceptance Criteria:**
- Given the salary page is linted, when ESLint runs against `src/app/dashboard/salary/page.tsx`, then it reports no unused-symbol warnings for `motion`, `ShieldCheck`, `Search`, `Filter`, or `handleApproveAll`.
- Given TypeScript compiles, when `npx.cmd tsc --noEmit` runs, then no missing reference or type errors are introduced.

## Spec Change Log

## Verification

**Commands:**
- `npx.cmd eslint src/app/dashboard/salary/page.tsx` -- pass.
- `npx.cmd tsc --noEmit` -- pass.

**Suggested Review Order:**
- `src/app/dashboard/salary/page.tsx:3` -- import cleanup.
- `src/app/dashboard/salary/page.tsx:225` -- removed unused approve-all handler area.
