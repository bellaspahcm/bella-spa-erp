# Architecture Change Request (ACR)

**ACR ID:** ACR-2026-005
**Date Submitted:** 2026-09-29
**Submitted By:** AI Agent (Bella Haircut Service Completion Rollback)
**Status:** APPROVED

<!-- APPROVED_CORE_CHANGE_V1
{
  "version": 1,
  "acrId": "ACR-2026-005",
  "status": "APPROVED",
  "pr": 163,
  "approvedCoreFiles": [
    "src/core/services/order/session-completion-engine.ts",
    "src/core/services/order/session-completion-helpers.ts"
  ],
  "approver": "Human/ARB",
  "approvedDate": "2026-09-29",
  "purpose": "Rollback only completion-created review and pending or failed PACKAGE_SALE outbox side effects when shared service completion fails downstream.",
  "contractChange": false,
  "schemaChange": false,
  "rpcChange": false,
  "apiChange": false,
  "ownershipChange": false
}
-->

---

## Summary

Bella Haircut service completion had a confirmed rollback integrity gap: after the shared completion flow created a review placeholder or a single-session `PACKAGE_SALE` side effect, a downstream failure could leave those completion-created records behind. This ACR approves a minimal Core rollback fix for the existing session completion engine and helper only.

---

## Affected Layer(s)

- [ ] E7.1 Domain Kernel
- [ ] E7.2 Operational Kernel
- [ ] E7.3 Rules & Traceability
- [x] Other: Bella Platform Core order/session completion rollback path

---

## Approved Core File Scope

```text
src/core/services/order/session-completion-engine.ts
src/core/services/order/session-completion-helpers.ts
```

---

## Reason For Change

### Business Context

Bella Haircut service completion is an operating workflow. If completion fails after creating rollback-sensitive side effects, the user-visible booking/session state can be restored while review and accounting side effects remain inconsistent.

### Technical Context

The existing completion rollback path already handles booking progress, inventory, and single-session revenue. It did not track the newly-created review placeholder id, and it did not clean up the single-session `PACKAGE_SALE` outbox event tied to the newly-created revenue when a later completion step failed.

### Priority

- [x] P1 - High (shared completion rollback integrity for operating product)

---

## Proposed Changes

1. Track the `session_reviews.id` created during this completion attempt.
2. Roll back only that newly-created review when a later completion step fails.
3. Delete only the completion-created `PACKAGE_SALE` outbox event for the `createdRevenueId`, same tenant, `reference_type = REVENUE`, and `status IN (PENDING, FAILED)`.

### API Impact

- [x] No - Internal implementation only

No public API, RPC, schema, product ownership, or Finance/F3 contract change.

---

## Impact Analysis

### Blast Radius

- **Direct consumers:** shared service completion rollback path.
- **Indirect consumers:** Bella Haircut and any product using the same completion engine for session completion.
- **Test impact:** focused accounting/session completion tests only.

### Risk Assessment

**Risk Level:** LOW

The change is limited to rollback bookkeeping and cleanup for records created by the current completion attempt. It does not change the success transaction design, completion engine orchestration, Finance/F3 behavior, Payroll, Preschool, schema, or RPC contracts.

---

## Alternatives Considered

### Alternative 1: General compensation framework

**Why not chosen:** Over-engineered for the proven gap and would expand transaction design beyond the approved scope.

### Alternative 2: Delete all related outbox records for the booking/session

**Why not chosen:** Too broad. It could affect events already processed or created outside the current completion attempt.

### Alternative 3: Do nothing

**Impact:** Downstream completion failure can leave a review placeholder or pending/failed accounting side effect inconsistent with the rolled-back completion state.

---

## Testing Strategy

- Existing completion/accounting tests remain passing.
- Added focused tests for:
  - cleanup of completion-created `PACKAGE_SALE` outbox on downstream salary failure.
  - cleanup of completion-created review when `SESSION_DONE` enqueue fails.
  - preservation of successful completion semantics.

---

## Approval

### Architecture Review

**Reviewed by:** Human/ARB
**Date:** 2026-09-29
**Decision:** APPROVED
**Comments:** Approval is limited to the exact Core files listed above. It does not authorize Finance/F3, Payroll, Preschool, schema, RPC, API, Product UI, or general compensation redesign.

---

## Implementation Tracking

**Branch:** `codex/haircut-booking-service-completion`
**PR:** #163
**Merged:** Pending
**Released:** Pending
