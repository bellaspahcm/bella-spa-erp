# Architecture Change Request (ACR)

**ACR ID:** ACR-2026-004
**Date Submitted:** 2026-09-29
**Submitted By:** AI Agent (Bella Spa Completion Rollback Fix)
**Status:** APPROVED

<!-- APPROVED_CORE_CHANGE_V1
{
  "version": 1,
  "acrId": "ACR-2026-004",
  "status": "APPROVED",
  "pr": 162,
  "approvedCoreFiles": [
    "src/core/services/order/session-completion-helpers.ts"
  ],
  "approver": "Human/ARB",
  "approvedDate": "2026-09-29",
  "purpose": "Restore the pre-completion bookings.is_in_care value during shared completion rollback without changing completion semantics.",
  "contractChange": false,
  "schemaChange": false,
  "rpcChange": false,
  "apiChange": false,
  "ownershipChange": false
}
-->

---

## Summary

Bella Spa completion rollback had a confirmed integrity gap: package completion can set `bookings.is_in_care = false`, but a downstream failure rolled back only `completed_sessions` and `status`. This ACR approves the single Core service-helper file needed to include `is_in_care` in the existing pre-completion snapshot and rollback payload.

---

## Affected Layer(s)

- [ ] E7.1 Domain Kernel
- [ ] E7.2 Operational Kernel
- [ ] E7.3 Rules & Traceability
- [x] Other: Bella Platform Core order/session completion helper

---

## Approved Core File Scope

```text
src/core/services/order/session-completion-helpers.ts
```

---

## Reason For Change

### Business Context

Bella Spa is an operating product, and a failed completion after the booking progress mutation can leave an active-care booking incorrectly marked as no longer in care.

### Technical Context

`calculateBookingCompletionUpdate()` correctly clears `is_in_care` on successful package completion. The rollback path receives a pre-completion booking snapshot, but the Core helper did not select `is_in_care`, so rollback could not restore that field after downstream completion side-effect failure.

### Priority

- [x] P1 - High (shared completion rollback integrity for operating product)

---

## Proposed Changes

1. Extend the pre-completion booking select in `session-completion-helpers.ts` to include `is_in_care`.
2. Preserve completion semantics: successful package completion still sets `is_in_care = false`.
3. Restore `is_in_care` only from the pre-completion snapshot during rollback.

### API Impact

- [x] No - Internal implementation only

No public API, RPC, schema, or ownership contract changes.

---

## Impact Analysis

### Blast Radius

- **Direct consumers:** shared session completion rollback path.
- **Indirect consumers:** Bella Spa and any product using the same completion engine.
- **Test impact:** focused rollback and completion business-rule tests.

### Risk Assessment

**Risk Level:** LOW

The approved change is a one-field snapshot restoration in an existing rollback path. It does not change success semantics, public contracts, schema, RPCs, or tenant predicates.

---

## Alternatives Considered

### Alternative 1: Infer `is_in_care` from rollback status

**Why not chosen:** `is_in_care` is a persisted workflow state and must be restored from the pre-completion snapshot, not inferred from status.

### Alternative 2: Redesign completion transaction handling

**Why not chosen:** Out of scope and unnecessary for the confirmed gap.

### Alternative 3: Do nothing

**Impact:** A downstream failure after completion mutation can leave `bookings.is_in_care` inconsistent with pre-transaction state.

---

## Testing Strategy

- Focused reproduction: package completion clears `is_in_care`, forced downstream failure rolls back `completed_sessions`, `status`, and `is_in_care`.
- Happy path: successful package completion still sets `is_in_care = false`.
- Existing nearby completion/accounting tests remain passing.

---

## Approval

### Architecture Review

**Reviewed by:** Human/ARB
**Date:** 2026-09-29
**Decision:** APPROVED
**Comments:** Approval is limited to the exact Core file listed above and does not authorize Payroll, Finance, Accounting, Haircut-specific code, schema, RPC, API, UI, or completion semantics redesign.

---

## Implementation Tracking

**Branch:** `codex/spa-completion-rollback-is-in-care`
**PR:** #162
**Merged:** Pending
**Released:** Pending
