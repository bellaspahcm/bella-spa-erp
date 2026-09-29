---
title: 'Haircut AR payment allocation'
type: 'bugfix'
created: '2026-09-29'
status: 'done'
baseline_commit: 'b604c0a164431531e6383a955f4b603a4c34d0f9'
context:
  - '{project-root}/docs/governance/BELLA_AI_CODING_CONSTITUTION.md'
  - '{project-root}/docs/architecture/F3_ACCOUNTS_RECEIVABLE_CONSTITUTION.md'
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** Haircut Core, accounting, and AR creation are complete, but the final confirmed-payment path must allocate payment into Finance OS F3 AR using canonical F1 cash receipt, F2 cash movement, and F3 allocation semantics. The current Core consumer risks using request payload amount/status on idempotent retry instead of the persisted `revenue` fact.

**Approach:** Keep the Finance OS contract as the authority and harden the Core consumer to allocate from persisted confirmed revenue facts whenever they exist. Return bounded allocation evidence without creating a Haircut-owned AR workaround.

## Boundaries & Constraints

**Always:** Use Finance OS contract only; preserve tenant checks; keep idempotency stable; use persisted `revenue` amount/status/payment fact for retries; keep Haircut status `VERIFIED_WITH_REMAINING_FINANCIAL_INTEGRATION` until final E2E proves AR decrease.

**Ask First:** Any schema/RPC migration, direct writes to `finance_*` from Product/Core, new Debt/Reconciliation behavior, or changing payment/accounting policy.

**Never:** Do not audit Haircut again, do not touch BabyCare, do not implement Product-owned AR allocation, do not change Finance F1/F2/F3 invariants to satisfy a UI flow, and do not open Debt/Reconciliation in this PR.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| New confirmed payment | RPC returns confirmed revenue with amount/revenue id | Finance allocation receives persisted revenue id and amount, posts F1, projects F2, allocates F3 | Allocation failure is reported as bounded `finance_ar_allocation` status without rolling back persisted payment |
| Idempotent retry | Existing revenue found by idempotency key; request amount differs from persisted amount | Allocation uses persisted revenue amount, not request amount; duplicate Finance allocation is not created | If persisted revenue id is absent, return bounded allocation failure |
| Pending payment | Request or persisted revenue is not confirmed | Finance allocation is skipped | No Finance mutation |

</frozen-after-approval>

## Code Map

- `src/core/services/order/payment-actions.ts` -- Core payment action calls Finance allocation after payment persistence/idempotent lookup.
- `src/core/services/order/payment-helpers.ts` -- Defines payment params, idempotency key, existing revenue lookup, and RPC result shape.
- `src/services/finance-payment-allocation.ts` -- Server-side adapter into Finance OS semantic allocation service.
- `src/platform/finance/services/semantic-receivable-charge.service.ts` -- Canonical F1 cash receipt -> F2 cash movement -> F3 allocation orchestration.
- `src/platform/finance/gateways/supabase-receivable-charge.gateway.ts` -- Supabase implementation for invoice matching, cash receipt posting, cash movement projection, and allocation RPC.
- `src/__tests__/payment-actions-idempotency-order.test.ts` -- Focused Core regression for payment idempotency and Finance allocation call contract.
- `src/platform/finance/__tests__/semantic-receivable-charge.service.test.ts` -- Finance contract tests for confirmed payment allocation and retry.

## Tasks & Acceptance

**Execution:**
- [x] `src/core/services/order/payment-actions.ts` -- read persisted revenue fact from payment result and use it for allocation amount/status/source data -- prevents retry payload drift.
- [x] `src/__tests__/payment-actions-idempotency-order.test.ts` -- add regression where idempotent retry request amount differs from persisted revenue amount -- proves persisted revenue controls Finance allocation.
- [x] `ARCHITECTURE_GATE_RESULT.md` -- add narrow gate entry for this final allocation hardening -- documents scope and non-goals.

**Acceptance Criteria:**
- Given an idempotent retry with an existing confirmed revenue row, when the request amount differs, then Finance allocation uses the persisted revenue amount and revenue id.
- Given a newly persisted confirmed payment, when allocation is invoked, then the existing Finance contract receives tenant, booking, revenue id, amount, payment method, and idempotency key.
- Given a pending payment, when the payment action returns, then Finance allocation is skipped.
- Given Finance allocation fails after payment persistence, when the action returns, then payment success remains true and bounded allocation failure evidence is attached.

## Spec Change Log

## Verification

**Commands:**
- `npx.cmd jest --runInBand --testMatch "**/src/__tests__/payment-actions-idempotency-order.test.ts" "**/src/platform/finance/__tests__/semantic-receivable-charge.service.test.ts"` -- expected: focused Core/Finance allocation regressions pass.
- `git diff --check` -- expected: no whitespace errors.

## Suggested Review Order

**Consumer Boundary**

- Persisted revenue identity/status wins over retry payload drift.
  [`payment-actions.ts:57`](../../src/core/services/order/payment-actions.ts#L57)

- Persisted amount/method/date/notes become Finance allocation input.
  [`payment-actions.ts:73`](../../src/core/services/order/payment-actions.ts#L73)

- Finance OS contract call remains the only allocation bridge.
  [`payment-actions.ts:132`](../../src/core/services/order/payment-actions.ts#L132)

**Governance Scope**

- Gate records scope and explicit non-goals for the hardening.
  [`ARCHITECTURE_GATE_RESULT.md:1`](../../ARCHITECTURE_GATE_RESULT.md#L1)

**Regression Coverage**

- Retry amount drift now proves persisted revenue controls allocation.
  [`payment-actions-idempotency-order.test.ts:89`](../../src/__tests__/payment-actions-idempotency-order.test.ts#L89)

- Pending persisted payment skips Finance mutation.
  [`payment-actions-idempotency-order.test.ts:148`](../../src/__tests__/payment-actions-idempotency-order.test.ts#L148)
