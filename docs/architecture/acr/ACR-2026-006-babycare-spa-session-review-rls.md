# Architecture Change Request (ACR)

**ACR ID:** ACR-2026-006
**Date Submitted:** 2026-09-29
**Submitted By:** AI Agent (Babycare/Spa Session Review RLS Fix)
**Status:** APPROVED

<!-- APPROVED_CORE_CHANGE_V1
{
  "version": 1,
  "acrId": "ACR-2026-006",
  "status": "APPROVED",
  "pr": 167,
  "approvedCoreFiles": [
    "src/core/services/order/session-completion-helpers.ts"
  ],
  "approver": "Human/ARB",
  "approvedDate": "2026-09-29",
  "purpose": "Allow the shared completion helper to write the system-owned Babycare/Spa session_reviews placeholder through a server-side operation client after existing tenant and role checks have passed.",
  "contractChange": false,
  "schemaChange": false,
  "rpcChange": false,
  "apiChange": false,
  "ownershipChange": false
}
-->

---

## Summary

Babycare/Spa session completion can fail after the session update succeeds because the system-created `session_reviews` placeholder is written through the current user-session client and may be blocked by deployed row-level security. This ACR approves the single Core helper file needed to use the existing Supabase admin env pattern for that backend-owned side effect only.

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

Babycare/Spa operators need to complete or update service sessions without a customer-review placeholder RLS failure rolling back the completion workflow.

### Technical Context

The existing server action already verifies current user tenant and role before invoking completion side effects. The review placeholder is system-owned data derived from the tenant-scoped booking and session. Writing that placeholder through an operation client preserves the existing tenant checks while avoiding user-session RLS drift for a backend-created record.

### Priority

- [x] P1 - High (operating Babycare/Spa completion workflow blocked by RLS)

---

## Proposed Changes

1. Add a narrow session-review operation client helper using configured Supabase admin credentials when available.
2. Keep existing tenant equality checks before review lookup or insert.
3. Preserve existing review-placeholder rollback behavior by returning the created review id.

### API Impact

- [x] No - Internal implementation only

No public API, RPC, schema, UI, or ownership contract changes.

---

## Impact Analysis

### Blast Radius

- **Direct consumers:** shared session completion review-placeholder path.
- **Indirect consumers:** Babycare and Beauty Spa products using the shared completion engine.
- **Test impact:** focused session completion accounting/helper tests.

### Non-Goals

- No RLS policy migration.
- No production data update.
- No Healthcare, Education, or Logistics kernel change.
- No customer portal contract change.

---

## Verification Plan

1. Core Freeze Verification must match this ACR's approved Core file set exactly.
2. Focused Jest for `session-completion-accounting.test.ts`.
3. `git diff --check`.
4. CI required checks remain the final merge gate.

