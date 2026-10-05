# ACR-2026-014 - Haircut Branch Chain Adoption

Status: APPROVED
Date: 2026-10-05
Scope: Haircut (`bella_haircut`) branch-chain adoption.

## APPROVED_CORE_CHANGE_V1

reason: Haircut Branch Chain was verified as NOT_IMPLEMENTED. The fix must adopt existing Platform Org Unit / Branch context into the current Core order operational chain.

authorized_files:
- `src/core/services/order/haircut-branch-context.ts`
- `src/core/services/order/create-booking-action.ts`
- `src/core/services/order/create-booking-helpers.ts`
- `src/core/services/order/create-session-log-action.ts`
- `src/core/services/order/complete-session-action.ts`
- `src/core/services/order/update-session-log-helpers.ts`
- `src/core/services/order/session-completion-helpers.ts`
- `src/core/services/order/payment-actions.ts`
- `src/core/services/order/payment-helpers.ts`
- `src/lib/business-rules/accounting-outbox.ts`
- `src/modules/hr-salary/actions/admin-salary-actions.ts`
- `src/modules/hr-salary/actions/salary-recalculation-engine.ts`
- `src/__tests__/haircut-branch-chain.test.ts`
- `supabase/migrations/20261005090000_haircut_branch_chain_adoption.sql`
- `docs/architecture/ARCHITECTURE_GATE_RESULT_HAIRCUT_BRANCH_CHAIN_2026_10_05.md`
- `docs/architecture/acr/ACR-2026-014-haircut-branch-chain-adoption.md`

constraints:
- Reuse Platform `org_units` and `user_org_unit_access`.
- No Beauty OS fork.
- No Finance or Payroll redesign.
- No unrelated RLS cleanup.
- No backfill for branch ownership without evidence.

## Root Cause

Haircut booking/session/payment/payroll paths used tenant context but did not resolve, persist, or enforce Platform branch context.

## Minimal Fix

Add branch context resolution at Haircut booking entry, persist branch ownership on operational records, pass branch through payment/completion outbox payloads where supported, and add Haircut-scoped restrictive RLS guards.

## Verification Plan

- Focused unit tests for branch context resolution and payment branch propagation.
- Typecheck affected code.
- No mutating Real DB proof in this task.
