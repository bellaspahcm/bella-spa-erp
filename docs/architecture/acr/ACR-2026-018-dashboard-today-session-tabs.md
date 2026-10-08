# Architecture Change Request (ACR)

**ACR ID:** ACR-2026-018
**Date Submitted:** 2026-10-08
**Submitted By:** AI Agent (BabyCare / Beauty V2 dashboard today tabs)
**Status:** APPROVED

<!-- APPROVED_CORE_CHANGE_V1
{
  "version": 1,
  "acrId": "ACR-2026-018",
  "status": "APPROVED",
  "pr": 252,
  "approvedCoreFiles": [
    "src/core/services/analytics/dashboard-actions.ts"
  ],
  "approver": "Human/ARB",
  "approvedDate": "2026-10-08",
  "purpose": "Allow the shared dashboard read action to return completed same-day session_logs so BabyCare and Beauty V2 status tabs can render the Hoan thanh tab from canonical session status data. No contract, schema, RPC, API, or ownership change.",
  "contractChange": false,
  "schemaChange": false,
  "rpcChange": false,
  "apiChange": false,
  "ownershipChange": false
}
-->

---

## Summary

This ACR approves the single Core analytics read-model file required by PR #252.

The approved change removes the stale `status != completed` filter from the dashboard today-session query. The UI already exposes a completed tab, so completed same-day `session_logs` must reach the product dashboard consumer before the UI applies its status-specific tab filters.

---

## Affected Layer(s)

- [ ] E7.1 Domain Kernel
- [ ] E7.2 Operational Kernel
- [ ] E7.3 Rules & Traceability
- [x] Other: Bella Platform Core analytics dashboard read action

---

## Approved Core File Scope

```text
src/core/services/analytics/dashboard-actions.ts
```

---

## Reason For Change

The BabyCare and Beauty V2 dashboard widget uses `getDashboardPrimaryData -> getUpcomingSessions(todayDate)` as its read model for the "Lịch hẹn hôm nay" status tabs.

The UI had a "Hoàn thành" tab, but the Core read query removed completed rows before the product UI could filter them. That made the completed tab show `0` even when a same-day session had already been completed.

---

## Explicit Non-Goals

- No session completion engine change.
- No booking/package progress change.
- No schema or migration change.
- No RPC change.
- No product identity or tenant onboarding change.
- No Healthcare, Education, or Logistics kernel change.
- No Finance or accounting behavior change.

---

## Approved Runtime Shape

```text
getDashboardPrimaryData(...)
  -> getUpcomingSessions(todayDate)
  -> select tenant-scoped session_logs for assigned_date = today
  -> return scheduled / serving / completed rows
  -> product dashboard UI classifies rows into tabs
```

The query remains tenant-scoped and date-scoped.

---

## Verification Plan

1. Core Freeze Verification must match this ACR's approved Core file set exactly for PR #252.
2. Focused Jest:
   - `npm test -- --runTestsByPath src/__tests__/dashboard-actions.test.ts --runInBand`
3. Changed-file lint:
   - `npx eslint src/core/services/analytics/dashboard-actions.ts src/app/dashboard/components/BeautySpaV2DashboardView.tsx src/__tests__/dashboard-actions.test.ts`
4. Changed typecheck:
   - `npm run typecheck:changed`
5. Diff hygiene:
   - `git diff --check`
