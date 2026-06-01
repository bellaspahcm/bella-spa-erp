---
title: 'Harden Auto Confirm Salary RPC Error Handling'
type: 'refactor'
created: '2026-06-01'
status: 'done'
baseline_commit: 'fbfb64e9'
context:
  - '{project-root}/AGENTS.md'
  - '{project-root}/node_modules/next/dist/docs/01-app/01-getting-started/07-mutating-data.md'
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** `checkAndAutoConfirm` calls `auto_confirm_stale_salary_records` but ignores the Supabase RPC `error` field. A failed database operation can currently look like `{ count: 0 }`, hiding auto-confirm failures from callers and tests.

**Approach:** Keep the existing tenant guard and RPC contract, but return an explicit failure when the RPC reports an error. Revalidate only after a successful RPC with a positive count.

## Boundaries & Constraints

**Always:** Preserve current user tenant scoping. Surface RPC errors explicitly. Do not revalidate on missing tenant, RPC failure, or zero count. Keep the action response simple enough for existing callers.

**Ask First:** Any database function rewrite, salary lifecycle redesign, or UI behavior change beyond consuming `success/error/count`.

**Never:** Do not swallow RPC errors, do not fabricate count values on failure, and do not alter publish/confirm/finalize/approve flows in this slice.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|----------------------------|----------------|
| Missing tenant | `getCurrentUser` has no `tenant_id` | Return `{ success: false, count: 0, error }` | No RPC call, no revalidation |
| RPC succeeds with count > 0 | RPC returns numeric count | Return `{ success: true, count }` and revalidate salary page | N/A |
| RPC succeeds with count 0/null | RPC returns `0` or `null` | Return `{ success: true, count: 0 }` | No revalidation |
| RPC fails | RPC returns `error` | Return `{ success: false, count: 0, error }` | No revalidation |

</frozen-after-approval>

## Code Map

- `src/modules/hr-salary/actions/admin-salary-actions.ts` -- Contains `checkAndAutoConfirm`; add explicit RPC error handling and stable response shape.
- `src/__tests__/admin-salary-actions.test.ts` -- Add RPC mock and tests for success, zero count, missing tenant, and RPC failure.
- `docs/DEVELOPMENT_LOG.md` -- Record the hardening slice and verification.

## Tasks & Acceptance

**Execution:**
- [x] `src/modules/hr-salary/actions/admin-salary-actions.ts` -- Return explicit `{ success, count, error? }` for auto-confirm outcomes.
- [x] `src/__tests__/admin-salary-actions.test.ts` -- Mock Supabase `rpc` and assert no silent RPC failure.
- [x] `docs/DEVELOPMENT_LOG.md` -- Add dated development log entry.

**Acceptance Criteria:**
- Given missing tenant, when `checkAndAutoConfirm` runs, then it returns failure without calling RPC or revalidating.
- Given RPC count is positive, when the action runs, then it returns success with count and revalidates salary page.
- Given RPC count is zero/null, when the action runs, then it returns success with count `0` and does not revalidate.
- Given RPC returns an error, when the action runs, then it returns failure with the RPC error and does not revalidate.

## Spec Change Log

## Verification

**Commands:**
- `npm.cmd test -- src/__tests__/admin-salary-actions.test.ts --runInBand` -- pass.
- `npm.cmd test -- src/__tests__/state-machine.test.ts --runInBand` -- pass.
- `npm.cmd test -- src/__tests__/security-hardening.test.ts --runInBand` -- pass.
- `npx.cmd tsc --noEmit` -- pass.
- `npx.cmd eslint src/modules/hr-salary/actions/admin-salary-actions.ts src/__tests__/admin-salary-actions.test.ts` -- pass.

**Suggested Review Order:**
- `src/modules/hr-salary/actions/admin-salary-actions.ts:652` -- hardened auto-confirm RPC response handling.
- `src/__tests__/admin-salary-actions.test.ts:1111` -- RPC success/failure coverage for `checkAndAutoConfirm`.
