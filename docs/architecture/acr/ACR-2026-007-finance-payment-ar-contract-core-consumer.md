# Architecture Change Request (ACR)

**ACR ID:** ACR-2026-007
**Date Submitted:** 2026-09-29
**Submitted By:** AI Agent (Finance OS Payment to AR Contract)
**Status:** APPROVED

<!-- APPROVED_CORE_CHANGE_V1
{
  "version": 1,
  "acrId": "ACR-2026-007",
  "status": "APPROVED",
  "pr": 168,
  "approvedCoreFiles": [
    "src/core/services/order/payment-actions.ts"
  ],
  "approver": "Human/ARB",
  "approvedDate": "2026-09-29",
  "purpose": "Allow the existing Core booking payment action to consume the Finance OS confirmed-payment-to-AR allocation contract after payment persistence, without creating a Product-owned AR workaround.",
  "contractChange": false,
  "schemaChange": false,
  "rpcChange": false,
  "apiChange": false,
  "ownershipChange": false
}
-->

---

## Summary

Finance OS now exposes the canonical confirmed-payment-to-AR allocation contract. This ACR approves the single Core booking payment action file needed to call that Finance OS contract after a confirmed booking payment is persisted or found idempotently.

---

## Affected Layer(s)

- [ ] E7.1 Domain Kernel
- [ ] E7.2 Operational Kernel
- [ ] E7.3 Rules & Traceability
- [x] Other: Bella Platform Core order payment action consumer

---

## Approved Core File Scope

```text
src/core/services/order/payment-actions.ts
```

---

## Reason For Change

### Business Context

Confirmed Haircut booking payments must settle the corresponding Finance OS receivable through the canonical Finance contract instead of leaving AR allocation as an unresolved downstream manual step.

### Technical Context

The Core payment action already owns the booking payment persistence workflow. After persistence, it has the tenant, booking, revenue, payment method, amount, and idempotency facts needed to call the Finance OS contract. The Finance layer owns F1 cash receipt, F2 cash movement projection, and F3 receivable allocation.

### Priority

- [x] P1 - High (financial truth closure for confirmed booking payments)

---

## Proposed Changes

1. Keep payment persistence and idempotency lookup in the existing Core action.
2. Call the Finance OS allocation service only after a confirmed payment fact exists.
3. Preserve payment success if Finance allocation is blocked, while returning bounded allocation status for evidence.
4. Do not write product-owned AR, cash movement, or Finance tables directly from Product/Core.

### API Impact

- [x] No - Internal implementation only

No public API, schema, RLS, RPC, UI, or ownership contract change is approved by this ACR.

---

## Impact Analysis

### Blast Radius

- **Direct consumers:** `recordRemainingPayment` in the shared order payment action.
- **Indirect consumers:** Haircut/Beauty booking payment workflows that already use the shared Core payment action.
- **Test impact:** focused Core payment idempotency tests and Finance OS allocation tests.

### Non-Goals

- No Haircut-owned AR workaround.
- No direct product writes to `finance_cash_movements`.
- No COA, Payroll, Debt/Reconciliation, Payment Engine redesign, schema migration, or RLS policy change.
- No Healthcare, Education, or Logistics kernel change.

---

## Verification Plan

1. Core Freeze Verification must match this ACR's approved Core file set exactly for PR #168.
2. Focused Jest for payment action idempotency and Finance allocation failure handling.
3. Focused Finance OS tests for allocation, retry, and over-allocation behavior.
4. `git diff --check`.
5. CI required checks remain the final merge gate.

---

## Approval

### Architecture Review

**Reviewed by:** Human/ARB
**Date:** 2026-09-29
**Decision:** APPROVED
**Comments:** Approval is limited to the exact Core file listed above. It does not authorize schema, Product-owned AR, direct Finance table writes, Payment Engine redesign, COA, Payroll, Debt/Reconciliation, or non-Finance kernel work.

---

## Implementation Tracking

**Branch:** `codex/finance-payment-ar-contract`
**Pull Request:** PR #168
