# Architecture Change Request (ACR)

**ACR ID:** ACR-2026-016
**Date Submitted:** 2026-10-05
**Submitted By:** AI Agent (Beauty V2 branch-aware writer paths)
**Status:** APPROVED

<!-- APPROVED_CORE_CHANGE_V1
{
  "version": 1,
  "acrId": "ACR-2026-016",
  "status": "APPROVED",
  "pr": 225,
  "approvedCoreFiles": [
    "src/core/services/accounting/business-health.ts",
    "src/core/services/finance/transaction-mutations.ts",
    "src/core/services/order/complete-session-action.ts",
    "src/core/services/order/create-booking-service-items-helper.ts",
    "src/core/services/order/update-session-log-helpers.ts"
  ],
  "approver": "Human/ARB",
  "approvedDate": "2026-10-05",
  "purpose": "Allow the existing Core order/session and finance writer paths to consume already-proven Beauty V2 Platform Branch context, persist branch_id on completion and commission source records, and propagate salary_records.branch_id into SALARY_PAID Finance journal lines without creating a product-local Chain subsystem.",
  "contractChange": false,
  "schemaChange": false,
  "rpcChange": false,
  "apiChange": false,
  "ownershipChange": false
}
-->

---

## Summary

This ACR approves the Core writer files required by PR #225 to propagate the existing Platform Branch context through Beauty V2 branch-aware writer paths and the SALARY_PAID Finance handoff.

---

## Affected Layer(s)

- [ ] E7.1 Domain Kernel
- [ ] E7.2 Operational Kernel
- [ ] E7.3 Rules & Traceability
- [x] Other: Bella Platform Core order/session and Finance writer paths

---

## Approved Core File Scope

```text
src/core/services/accounting/business-health.ts
src/core/services/finance/transaction-mutations.ts
src/core/services/order/complete-session-action.ts
src/core/services/order/create-booking-service-items-helper.ts
src/core/services/order/update-session-log-helpers.ts
```

---

## Reason For Change

Beauty V2 branch-aware readiness requires production writer paths to persist branch identity that has already been authorized by the Platform Chain context. It also requires SALARY_PAID Finance posting to use the canonical salary record branch instead of tenant/request context. The approved Core files are the minimum scope that owns session completion, session log update helpers, booking service item writes, and the Finance transaction mutation/health checks used by the current branch-aware readiness proof.

---

## Explicit Non-Goals

- No new Chain architecture.
- No Beauty-local branch or permission subsystem.
- No Healthcare, Education, or Logistics kernel change.
- No Finance architecture change.
- No production mutation.
- No historical branch backfill.
