# Architecture Change Request (ACR)

**ACR ID:** ACR-2026-008
**Date Submitted:** 2026-09-29
**Submitted By:** AI Agent (Haircut AR Payment Allocation)
**Status:** APPROVED

<!-- APPROVED_CORE_CHANGE_V1
{
  "version": 1,
  "acrId": "ACR-2026-008",
  "status": "APPROVED",
  "pr": 169,
  "approvedCoreFiles": [
    "src/core/services/order/payment-actions.ts"
  ],
  "approver": "Human/ARB",
  "approvedDate": "2026-09-29",
  "purpose": "Allow the existing Core booking payment action to use persisted revenue facts when consuming the Finance OS confirmed-payment-to-AR allocation contract, preventing idempotent retry payload drift from changing AR allocation inputs.",
  "contractChange": false,
  "schemaChange": false,
  "rpcChange": false,
  "apiChange": false,
  "ownershipChange": false
}
-->

---

## Summary

This ACR approves the single Core payment action file required to harden the Finance OS payment-to-AR allocation consumer. The change ensures idempotent retries allocate from the persisted `revenue` fact rather than a potentially drifted retry request payload.

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

Haircut confirmed payments must settle the matching Finance OS receivable through the canonical Finance path. A retry with the same payment idempotency key must not be able to change Finance allocation amount, status, method, date, or description by sending a different request payload after the original payment fact already exists.

### Technical Context

The existing Core payment action already calls the Finance OS allocation adapter after payment persistence or idempotent lookup. The idempotent lookup returns the persisted `revenue` row. This ACR approves using that persisted row as the allocation source fact before falling back to request payload fields for newly persisted results that do not return a full row.

### Priority

- [x] P1 - High (financial truth closure for confirmed booking payments)

---

## Proposed Changes

1. Prefer persisted `revenue.id` and `revenue.status` over direct result fields when present.
2. Prefer persisted `revenue.amount`, `payment_method`, `received_date`, and `notes` for Finance allocation inputs.
3. Preserve the Finance OS contract as the only allocation authority.
4. Add focused regression coverage for retry amount drift and pending persisted payment skip.

### API Impact

- [x] No - Internal implementation only

No public API, schema, RLS, RPC, UI, or ownership contract change is approved by this ACR.

---

## Impact Analysis

### Blast Radius

- **Direct consumers:** `recordRemainingPayment` in the shared order payment action.
- **Indirect consumers:** Haircut/Beauty booking payment workflows that already use the shared Core payment action.
- **Test impact:** focused Core payment idempotency test and Finance OS allocation tests.

### Non-Goals

- No Haircut-owned AR workaround.
- No direct product writes to `finance_*`.
- No schema, RPC, RLS, COA, Payroll, Payment Engine, or Debt/Reconciliation implementation.
- No BabyCare, Healthcare, Education, or Logistics kernel change.
- No reopening completed Haircut audit areas.

---

## Verification Plan

1. Core Freeze Verification must match this ACR's approved Core file set exactly for PR #169.
2. Focused Jest for payment action idempotency and Finance allocation call contract.
3. Focused Finance OS semantic receivable allocation tests.
4. `git diff --check`.
5. CI required checks remain the final merge gate.

---

## Approval

### Architecture Review

**Reviewed by:** Human/ARB
**Date:** 2026-09-29
**Decision:** APPROVED
**Comments:** Approval is limited to the exact Core file listed above. It does not authorize schema/RPC changes, Product-owned AR allocation, direct Finance table writes, Debt/Reconciliation, BabyCare, or unrelated Core files.

---

## Implementation Tracking

**Branch:** `codex/haircut-ar-payment-allocation`
**Pull Request:** PR #169
