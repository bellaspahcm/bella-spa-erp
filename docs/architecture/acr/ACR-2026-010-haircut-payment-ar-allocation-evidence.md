# Architecture Change Request (ACR)

**ACR ID:** ACR-2026-010
**Date Submitted:** 2026-09-29
**Submitted By:** AI Agent (Haircut Payment AR Allocation Evidence)
**Status:** APPROVED

<!-- APPROVED_CORE_CHANGE_V1
{
  "version": 1,
  "acrId": "ACR-2026-010",
  "status": "APPROVED",
  "pr": 170,
  "approvedCoreFiles": [
    "src/core/services/order/payment-actions.ts"
  ],
  "approver": "Human/ARB",
  "approvedDate": "2026-09-29",
  "purpose": "Allow the existing Core booking payment action to return bounded Finance AR allocation evidence after consuming the existing approved Finance allocation contract.",
  "contractChange": false,
  "schemaChange": false,
  "rpcChange": false,
  "apiChange": false,
  "ownershipChange": false
}
-->

---

## Summary

This ACR approves the single Core payment action file required by PR #170 to return bounded Finance AR allocation evidence from the existing Finance allocation contract.

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

Haircut confirmed payments must expose enough bounded evidence for callers and gates to verify the Finance AR allocation outcome without creating a Product-owned AR path or widening ownership.

### Technical Context

The existing Core payment action already consumes the approved Finance OS confirmed-payment-to-AR allocation contract. PR #170 is limited to surfacing bounded allocation evidence from that existing contract outcome.

### Priority

- [x] P1 - High (financial closure evidence for confirmed booking payments)

---

## Proposed Changes

1. Preserve the existing Finance OS allocation contract as the only allocation authority.
2. Return bounded allocation outcome evidence from the Core payment action.
3. Keep Finance ownership, persistence, schema, RPC, and API boundaries unchanged.

### API Impact

- [x] No - Existing internal action response evidence only

No public API, schema, RLS, RPC, UI, or ownership contract change is approved by this ACR.

---

## Impact Analysis

### Blast Radius

- **Direct consumers:** `recordRemainingPayment` in the shared order payment action.
- **Indirect consumers:** Haircut/Beauty booking payment workflows that already use the shared Core payment action.
- **Test impact:** focused payment action and Finance allocation evidence tests already present in PR #170.

### Non-Goals

- No schema, RPC, API, RLS, or ownership change.
- No Product-owned AR allocation.
- No direct Product/Core writes to Finance AR tables outside the existing Finance contract.
- No Debt/Reconciliation, BabyCare, Healthcare, Education, Logistics, Payroll, or unrelated Core change.
- No additional Core files beyond the exact approved file listed above.

---

## Verification Plan

1. Core Freeze Verification must match this ACR's approved Core file set exactly for PR #170.
2. Local approved Core change guard must pass for PR #170.
3. CI Architecture Guard must pass.
4. Real Database Business E2E remains a separate technical gate.
5. CI required checks remain the final merge gate.

---

## Approval

### Architecture Review

**Reviewed by:** Human/ARB
**Date:** 2026-09-29
**Decision:** APPROVED
**Comments:** Approval is limited to returning bounded Finance AR allocation evidence from the existing approved Finance allocation contract. It does not authorize schema, RPC, API, ownership, Product-owned AR, Debt/Reconciliation, BabyCare, Healthcare, Education, Logistics, unrelated Core changes, or any additional Core file.

---

## Implementation Tracking

**Branch:** `codex/haircut-payment-ar-allocation`
**Pull Request:** PR #170
