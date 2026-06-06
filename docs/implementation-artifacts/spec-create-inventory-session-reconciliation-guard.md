---
title: 'Create Inventory Session Reconciliation Guard'
type: 'feature'
created: '2026-06-06'
status: 'done'
baseline_commit: 'f48892062f74f21495dd241a09526e649b80ade1'
context:
  - '{project-root}/AGENTS.md'
  - '{project-root}/docs/index.md'
  - '{project-root}/docs/implementation-artifacts/spec-harden-inventory-auto-consume-idempotency.md'
---

## Intent

**Problem:** Inventory consumption now avoids duplicate auto-consume, but operators still need a read-only guard to detect historical or runtime drift between completed sessions, inventory logs, and accounting outbox events.

**Approach:** Add `detectInventorySessionReconciliationIssues` as a read-only service helper. It compares completed `session_logs`, `inventory_logs` with `session_consumption`, referenced session status, and `accounting_outbox` rows for `INVENTORY_CONSUMED`.

## Boundaries & Constraints

**Always:** keep this guard read-only; return explicit failure if any query fails; summarize issue counts by type; keep issue payloads simple enough for dashboard or AI COO consumption.

**Ask First:** adding auto-repair, UI wiring, database constraints, or accounting outbox backfill.

**Never:** mutate inventory, sessions, or outbox from this detector; treat every missing inventory log as an automatic bug because auto-consume can be intentionally disabled.

## I/O & Edge-Case Matrix

| Scenario | Issue Type | Severity |
|----------|------------|----------|
| Completed session has no `session_consumption` inventory log | `missing_inventory_log` | warning |
| Inventory log references a missing/non-completed session | `orphan_inventory_log` | critical |
| Same session and item has multiple consumption logs | `duplicate_inventory_log` | critical |
| Completed session has consumption logs but no `INVENTORY_CONSUMED` outbox | `missing_inventory_outbox` | warning |
| Any query fails | explicit action failure | n/a |

## Code Map

- `src/services/inventory-actions.ts` -- detector and exported issue types.
- `src/__tests__/inventory-actions.test.ts` -- regression tests for detector issue types and query failure.

## Tasks & Acceptance

**Execution:**
- [x] Add read-only inventory/session reconciliation detector.
- [x] Add summary counts keyed by issue type.
- [x] Add Jest coverage for missing logs, orphan logs, duplicate logs, missing outbox, and query failure.

**Acceptance Criteria:**
- Given a completed session without consumption logs, the detector returns a warning issue.
- Given a consumption log references a session that is not completed, the detector returns a critical issue.
- Given duplicate same-session/same-item logs exist, the detector returns a critical duplicate issue.
- Given consumption logs exist without an inventory consumed outbox, the detector returns a warning issue.

## Verification

**Commands:**
- `npm.cmd test -- src/__tests__/inventory-actions.test.ts --runInBand` -- expected: inventory tests pass.
- `npm.cmd test -- src/__tests__/business-rule-engines.test.ts src/__tests__/session-completion-accounting.test.ts src/__tests__/inventory-actions.test.ts --runInBand` -- expected: related tests pass.
- `npm.cmd run lint` -- expected: no lint errors.
- `npm.cmd run build` -- expected: production build passes.
