# Architecture Gate Result - Haircut Payment To F3 AR Allocation

**Date:** 2026-09-29
**Status:** PASS

## 1. Bella OS/Product Development Process Gate

Problem: confirmed Haircut booking payment must close the Finance Truth loop after AR is created by session completion.

Workflow:

```text
Session completion
-> Finance F3 receivable
-> Confirmed payment
-> Finance F1 cash receipt
-> Finance F2 cash movement projection
-> Finance F3 receivable allocation
-> AR ledger / position update
```

Non-goals: no Debt/Reconciliation feature, no schema/RPC migration, no COA change, no Product-owned AR table, no direct Product/Core writes to Finance cash or AR tables.

## 2. Product Manifest

Product: Bella Haircut.

Capabilities in scope:

- Record confirmed booking payment through existing Core booking payment action.
- Consume existing Finance OS confirmed-payment-to-AR allocation contract.
- Return bounded allocation evidence to caller.

Capabilities out of scope:

- Healthcare, Education, Logistics kernel changes.
- Finance schema or accounting policy changes.
- Debt/Reconciliation buildout.

## 3. Ownership Map

| Data / Capability | Owner | Access |
| --- | --- | --- |
| Booking payment persistence | Platform Core booking payment action | Existing action/RPC |
| Session receivable recognition | Finance OS via accounting worker | Finance service contract |
| Cash receipt transaction | Finance F1 | Finance service contract |
| Cash movement projection | Finance F2 | Finance gateway/worker contract |
| Receivable allocation / AR position | Finance F3 | `finance_allocate_payment` contract |

## 4. Contract Dependency Map

```text
Haircut booking payment UI
-> Core recordRemainingPayment
-> Finance confirmed-payment-to-AR allocation adapter
-> SemanticReceivableChargeService.allocateConfirmedPaymentToReceivables
-> F1/F2/F3 Finance contracts
```

## 5. Change Authority

Approved by `ACR-2026-010`.

Allowed Core file:

```text
src/core/services/order/payment-actions.ts
```

Allowed supporting tests/docs only. No schema, RPC, API, Product-owned AR, COA, Payroll, or Debt/Reconciliation changes authorized.

## 6. UI To Contract Reconciliation

No UI redesign. The action response may expose a bounded `finance_ar_allocation` outcome for evidence, but does not introduce new UI workflow or domain status.

## 7. Additive Migration Plan

None. Existing Finance OS F1/F2/F3 contracts are reused.

## 8. 11 Automated Verification Gates Plan

1. Architecture: ACR-approved Core file only.
2. Contract: payment action consumes Finance service contract, no direct Finance table writes.
3. Tenant isolation: payment lookup and allocation carry tenant id.
4. RLS/Auth: existing server/admin Finance boundary unchanged.
5. Migration safety: no migration.
6. Event-after-persistence: allocation runs only after confirmed payment fact exists.
7. Idempotency: existing payment retry reuses payment and allocation idempotency key.
8. Accounting evidence: action returns allocation outcome.
9. Regression: focused payment action test.
10. Diff hygiene: `git diff --check`.
11. Final E2E: run in controlled real DB queue after dependency/environment availability.
