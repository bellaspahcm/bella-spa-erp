# Architecture Change Request (ACR)

**ACR ID:** ACR-2026-009
**Date Submitted:** 2026-09-29
**Submitted By:** AI Agent (Session Reversion Side Effects)
**Status:** APPROVED

<!-- APPROVED_CORE_CHANGE_V1
{
  "version": 1,
  "acrId": "ACR-2026-009",
  "status": "APPROVED",
  "pr": 172,
  "approvedCoreFiles": [
    "src/core/services/order/update-session-log-action.ts",
    "src/core/services/order/update-session-log-helpers.ts"
  ],
  "approver": "Human/ARB",
  "approvedDate": "2026-09-29",
  "purpose": "Allow the existing Core session update action to reverse completion-owned salary and unposted SESSION_DONE outbox side effects when a completed session is reverted to a non-completed lifecycle status.",
  "contractChange": false,
  "schemaChange": false,
  "rpcChange": false,
  "apiChange": false,
  "ownershipChange": false
}
-->

---

## Summary

This ACR approves the two Core order session files required by PR #172. The change preserves session lifecycle side-effect integrity when an existing completed session is reverted to a non-completed status.

---

## Affected Layer(s)

- [ ] E7.1 Domain Kernel
- [ ] E7.2 Operational Kernel
- [ ] E7.3 Rules & Traceability
- [x] Other: Bella Platform Core order/session lifecycle action

---

## Approved Core File Scope

```text
src/core/services/order/update-session-log-action.ts
src/core/services/order/update-session-log-helpers.ts
```

---

## Reason For Change

Production guard evidence identified a session lifecycle integrity gap: a completed session may be reverted to a non-completed status while completion-owned side effects remain active. Core owns the session update action and shared session update helpers, so the minimum sufficient change is to detect `completed -> non-completed` transitions and reverse only the side effects created by completion for the exact session.

---

## Explicit Non-Goals

- No production DB cleanup.
- No schema or migration change.
- No accounting mapping change.
- No payroll formula change.
- No Haircut Payment -> AR change.
- No Debt/Reconciliation work.
- No Healthcare, Education, or Logistics kernel change.
