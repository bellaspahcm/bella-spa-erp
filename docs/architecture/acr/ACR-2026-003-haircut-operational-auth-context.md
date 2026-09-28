# Architecture Change Request (ACR)

**ACR ID:** ACR-2026-003  
**Date Submitted:** 2026-09-28  
**Submitted By:** AI Agent (Bella Haircut Operational Verification)  
**Status:** APPROVED

<!-- APPROVED_CORE_CHANGE_V1
{
  "version": 1,
  "acrId": "ACR-2026-003",
  "status": "APPROVED",
  "pr": 159,
  "approvedCoreFiles": [
    "src/core/services/finance/transaction-mutations.ts",
    "src/core/services/finance/transaction-overview.ts",
    "src/core/services/finance/transactions.ts",
    "src/core/services/order/complete-session-action.ts",
    "src/core/services/order/create-booking-action.ts",
    "src/core/services/order/payment-actions.ts",
    "src/core/services/order/update-booking-action.ts",
    "src/core/services/order/update-session-log-action.ts"
  ],
  "approver": "Human/ARB",
  "approvedDate": "2026-09-28",
  "purpose": "Correct proven Haircut operational auth-context and Finance salary payment boundaries without changing Core contracts.",
  "contractChange": false,
  "schemaChange": false,
  "rpcChange": false,
  "apiChange": false,
  "ownershipChange": false
}
-->

---

## Summary

Haircut field verification exposed repeated server-action auth-context defects at the existing Order/Booking and Finance boundaries. The affected operations already owned the correct business predicates, tenant predicates, and lifecycle semantics, but selected a raw/no-session Supabase execution context that could not see tenant-scoped rows under the current authenticated/dev runtime.

This ACR approves only the exact Core files modified in PR #159 to reuse the already-proven authenticated/dev server context and preserve existing tenant and business invariants.

---

## Affected Layer(s)

- [ ] E7.1 Domain Kernel
- [ ] E7.2 Operational Kernel
- [ ] E7.3 Rules & Traceability
- [x] Other: Bella Platform Core service actions used by Haircut operational workflows

---

## Approved Core File Scope

```
src/core/services/finance/transaction-mutations.ts
src/core/services/finance/transaction-overview.ts
src/core/services/finance/transactions.ts
src/core/services/order/complete-session-action.ts
src/core/services/order/create-booking-action.ts
src/core/services/order/payment-actions.ts
src/core/services/order/update-booking-action.ts
src/core/services/order/update-session-log-action.ts
```

---

## Reason For Change

The changes are backed by Haircut field evidence:

- booking/package/session reads failed under raw clients and passed after using the authenticated/dev context.
- Finance transaction listing and confirmation reached real persisted state only after the same context mismatch was corrected.
- Salary payment then field-verified through UI and DB read-back without broad Core refactoring.

---

## Non-Goals

- No new Core contract.
- No service-role bypass.
- No RLS weakening.
- No global client replacement.
- No Finance OS redesign.
- No Payroll calculation rewrite.
