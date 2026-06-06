---
title: 'Harden Inventory Auto Consume Idempotency'
type: 'refactor'
created: '2026-06-06'
status: 'done'
baseline_commit: 'ee3601ebce1db59d81d324d8da74151dee314309'
context:
  - '{project-root}/AGENTS.md'
  - '{project-root}/docs/index.md'
  - '{project-root}/docs/implementation-artifacts/spec-harden-session-completion-rollback-idempotency.md'
---

## Intent

**Problem:** Automatic inventory consumption is triggered by session completion. If the same session completion is retried after inventory logs already exist, the old flow could consume stock again for the same `session_log_id`.

**Approach:** Before reading package materials or mutating stock, check `inventory_logs` for existing `session_consumption` rows for the same session and tenant. If rows exist, return a successful idempotent bypass with `alreadyConsumed: true`; because this call created no new side effect, callers should not roll back those existing logs on later failure.

## Boundaries & Constraints

**Always:** prevent duplicate stock deduction for the same completed session; fail explicitly if the preflight log check fails; preserve existing rollback semantics for logs created by the current flow.

**Ask First:** changing inventory valuation policy; adding an accounting outbox repair query; changing package material quantities; adding database unique constraints.

**Never:** consume package materials twice for the same `session_log_id`; rollback existing consumption logs when the current retry did not create them.

## I/O & Edge-Case Matrix

| Scenario | Expected Behavior |
|----------|-------------------|
| Auto-consume disabled | Return success with `bypassed: true`; do not query materials or outbox. |
| Session already has consumption logs | Return success with `bypassed: true`, `alreadyConsumed: true`; do not consume stock again and do not enqueue duplicate accounting outbox. |
| Existing-log preflight fails | Return explicit failure with the database error. |
| Rollback called after logs already deleted | Return success with `processed: 0`; do not update stock or delete logs again. |
| New consumption then outbox fails | Roll back stock and logs as before. |

## Code Map

- `src/services/inventory-actions.ts` -- auto-consume preflight and rollback no-op behavior.
- `src/__tests__/inventory-actions.test.ts` -- side-effect assertions for idempotency, rollback no-op, and outbox rollback.

## Tasks & Acceptance

**Execution:**
- [x] Add existing `inventory_logs` preflight for `autoConsumeForSession`.
- [x] Treat existing logs as an idempotent bypass that creates no new side effect.
- [x] Add tests for duplicate prevention, preflight failure, and repeated rollback no-op.

**Acceptance Criteria:**
- Given a session already has consumption logs, when auto-consume is retried, then no `inventory_items.update`, no `inventory_logs.insert`, and no accounting outbox call occurs.
- Given preflight log read fails, when auto-consume runs, then the action returns an explicit failure.
- Given rollback is called after logs are gone, then no stock update or log delete is attempted.

## Verification

**Commands:**
- `npm.cmd test -- src/__tests__/inventory-actions.test.ts --runInBand` -- expected: inventory tests pass.
- `npm.cmd test -- src/__tests__/business-rule-engines.test.ts src/__tests__/session-completion-accounting.test.ts src/__tests__/inventory-actions.test.ts --runInBand` -- expected: related business/session/inventory tests pass.
- `npm.cmd run lint` -- expected: no lint errors.
- `npm.cmd run build` -- expected: production build passes.
