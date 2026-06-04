# Investigation: Accounting Server Action Generic Error

## Hand-off Brief

1. **What happened.** Production accounting tabs repeatedly showed Next.js' generic `An error occurred in the Server Components render` message.
2. **Root cause confirmed.** The visible message was production masking. Vercel logs showed two real errors behind it: `get_reconciliation_report` overflowed `diff_percent`, and Professional Core activation threw a readiness-gate business error when the score was `0/100`.
3. **Fix applied.** Widened reconciliation `diff_percent`, made readiness-gate failures return structured action results, and added a shared accounting UI helper that hides masked Next.js messages behind safe domain fallbacks.

## Case Info

| Field | Value |
| --- | --- |
| Ticket | N/A |
| Date opened | 2026-06-04 |
| Status | Fixed |
| System | Windows workspace, Next.js 16 App Router, Vercel production |
| Evidence sources | User screenshot, Next.js local docs, source code, development log, Vercel logs |

## Problem Statement

User asked why the same red production error appeared across many accounting tabs. The screenshot was from `/dashboard/accounting/reconciliation` with the Professional Accounting activation modal open.

## Confirmed Findings

### Finding 1: The visible message is Next.js production masking

**Evidence:** `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/error.md`.

Next.js masks Server Component/Server Action error messages in production and sends a generic message plus a digest to the client. The real error must be correlated in server logs.

### Finding 2: Production logs identified the underlying errors

**Evidence:** Vercel production logs for `/dashboard/accounting/reconciliation`.

1. `getReconciliationReport` failed with Postgres `22003 numeric field overflow`: `A field with precision 7, scale 2 must round to an absolute value less than 10^5.`
2. `syncLegacyToLedger` threw a readiness-gate business error: `Chưa thể bật Professional Core: Điểm sẵn sàng mới đạt 0/100, cần tối thiểu 95/100. Còn 4 dòng chưa phân loại nghiệp vụ kế toán.`

### Finding 3: Accounting client pages surfaced masked server messages directly

**Evidence:** multiple accounting tabs had local `getErrorMessage` helpers returning `error.message` from caught Server Action errors.

When the caught `Error.message` was the masked Next.js production string, the UI displayed that technical red message instead of a domain fallback.

## Fix Summary

| Area | Change |
| --- | --- |
| Reconciliation RPC | Added `supabase/migrations/20260604143000_widen_reconciliation_diff_percent.sql` to recreate `get_reconciliation_report` with `diff_percent NUMERIC` and rounded values. |
| Salary source in reconciliation | Reconciliation now uses saved `salary_records.total_salary` as the source of truth and falls back to the full central salary component formula only when `total_salary` is null. |
| Professional Core readiness | `updateAccountingMode('PROFESSIONAL')` and `syncLegacyToLedger()` now return `{ success: false, error, blockingReasons, readinessScore }` for readiness failures instead of throwing. Database/RPC errors still throw. |
| Accounting UI errors | Added `src/lib/accounting-error-message.ts` and wired accounting tabs/settings to replace masked Next.js production messages with safe tab-specific fallbacks. |
| Regression tests | Added/updated Jest tests for readiness structured failures, migration overflow guard, and masked-message detection. |

## Verification

| Check | Result |
| --- | --- |
| `npm.cmd test -- src/__tests__/accounting-error-message.test.ts src/__tests__/reconciliation.test.ts src/__tests__/dual-mode-accounting.test.ts --runInBand` | Passed, 28 tests |
| `npm.cmd run lint -- ...changed files...` | Passed |
| `npm.cmd run build` | Passed |
| `git diff --check` | Passed; Windows LF-to-CRLF warnings only |

## Follow-up Watch

1. Apply the Supabase migration to production before relying on the fixed RPC.
2. After deployment, check Vercel logs for new `/dashboard/accounting/reconciliation` errors.
3. If other accounting Server Actions have expected business blockers, convert those blockers to structured results too; keep database/query failures explicit.
