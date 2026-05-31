---
title: 'Harden Auto Consume Inventory'
type: 'refactor'
created: '2026-06-01'
status: 'done'
baseline_commit: '6d93f74324709dd1e6926a5d7a74a0f3cc7a30cb'
context:
  - '{project-root}/AGENTS.md'
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** The Services/package-materials configuration path is now hardened, but the runtime inventory consumption path used when a session completes still lacks focused tests for partial-consumption rollback and outbox failure rollback. This is the point where package material definitions become real stock deductions.

**Approach:** Keep `autoConsumeForSession` behavior and public return shape stable, but add direct side-effect tests around config handling, package material reads, sequential stock/log writes, rollback on mid-loop failure, and rollback on accounting outbox failure. Make only narrow implementation fixes if tests expose silent failure or unclear propagation.

## Boundaries & Constraints

**Always:** Preserve `autoConsumeForSession(packageId, sessionLogId)` and `rollbackInventoryConsumption(sessionLogId)` public APIs. Continue using `getPackageMaterials`, `consumeInventory`, `rollbackInventoryConsumption`, and `enqueueWithAutoClient`. If any material consumption fails after earlier materials were consumed, rollback session consumption logs before returning failure. If accounting outbox enqueue fails after stock was consumed, rollback and return failure.

**Ask First:** Stop before changing booking/session completion flow, inventory schema, accounting outbox schema, salary/session multiplier rules, or Services UI.

**Never:** Do not silently ignore tenant config, material read, consume, rollback, or outbox errors. Do not touch `supabase/.temp/*` or `.claude/settings.local.json`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Auto consume disabled | Tenant config `auto_consume_inventory` false | Returns `{ success: true, bypassed: true }` | No stock/log writes |
| Material consumption succeeds | Two material rows with stock | Updates stock, inserts consumption logs, enqueues accounting outbox | Returns processed count and total cost |
| Second material fails | First material consumed, second lacks stock | Rolls back first material's log/stock | Returns failure including rollback result if rollback fails |
| Material read fails | `getPackageMaterials` query fails | Rolls back any session consumption logs | Returns explicit material read error |
| Outbox fails | Stock/log writes succeed, accounting enqueue throws | Rolls back session consumption logs | Returns explicit outbox error plus rollback failure if any |

</frozen-after-approval>

## Code Map

- `src/services/inventory-actions.ts` -- contains `autoConsumeForSession`, `consumeInventory`, and rollback logic.
- `src/__tests__/inventory-actions.test.ts` -- existing inventory action side-effect tests and scripted Supabase mock.
- `src/services/session-completion-helpers.ts` -- caller context: session completion relies on `autoConsumeForSession` failure propagation.
- `src/lib/accounting-outbox.ts` -- outbox enqueue side effect called after inventory consumption.

## Tasks & Acceptance

**Execution:**
- [x] `src/__tests__/inventory-actions.test.ts` -- mock accounting outbox and add auto-consume success/disabled/failure tests with DB side-effect assertions.
- [x] `src/services/inventory-actions.ts` -- apply narrow fixes only if tests expose missing rollback/error propagation.
- [x] `docs/DEVELOPMENT_LOG.md` -- append concise entry with verification commands.

**Acceptance Criteria:**
- Given one material is consumed and a later material fails, when `autoConsumeForSession` returns, then rollback operations for the earlier session consumption are asserted.
- Given accounting outbox enqueue fails after stock/log writes, when `autoConsumeForSession` returns, then rollback operations are asserted.
- Given auto-consume is disabled, when called, then no material or inventory table writes are attempted.

## Spec Change Log

- 2026-06-01 -- Added side-effect tests for disabled auto consume, successful multi-material consumption with accounting outbox, mid-loop rollback, and outbox-failure rollback. No service implementation change was required.

## Verification

**Commands:**
- `npx.cmd tsc --noEmit` -- expected: TypeScript success.
- `npx.cmd eslint src/services/inventory-actions.ts src/__tests__/inventory-actions.test.ts` -- expected: no lint errors for touched files.
- `npm.cmd test -- src/__tests__/inventory-actions.test.ts --runInBand` -- pass.

## Suggested Review Order

1. `src/__tests__/inventory-actions.test.ts` -- review new `autoConsumeForSession` cases and asserted DB/outbox side effects.
2. `docs/DEVELOPMENT_LOG.md` -- confirm summary matches the behavior locked by tests.
