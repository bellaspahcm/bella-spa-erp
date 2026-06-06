---
title: 'Harden Session Completion Rollback Idempotency'
type: 'refactor'
created: '2026-06-06'
status: 'done'
baseline_commit: 'e5fea65021b2d3cb81e15add214a2d1645c8cb10'
context:
  - '{project-root}/AGENTS.md'
  - '{project-root}/docs/index.md'
  - '{project-root}/docs/implementation-artifacts/spec-standardize-revenue-ledger-rules.md'
---

## Intent

**Problem:** The shared session completion flow can create multiple side effects: inventory consumption, booking progress, single-session revenue, salary recalculation, review placeholders, and accounting outbox events. Rollback paths existed, but some of them did not report rollback failures and single-session revenue rollback could fall back to matching by booking, amount, and notes instead of the exact revenue row that was just created.

**Approach:** Carry the created revenue id through later side-effect steps, delete that exact row during rollback, and surface rollback failures in returned errors. Treat "revenue created but id missing" as a critical failure and rollback immediately.

## Boundaries & Constraints

**Always:** return explicit errors for critical side-effect failures; use the central session completion engine for shared checkout behavior; rollback inventory, booking progress, and revenue consistently when later completion steps fail; assert side-effect rollback tables in tests.

**Ask First:** replacing the multi-step action with a database transaction/RPC; changing revenue recognition amounts; changing salary calculation rules; changing booking status transitions.

**Never:** silently ignore rollback failures; delete revenue rollback candidates by broad business fields when the exact revenue id is known; continue completion if a newly inserted revenue row cannot be identified.

## I/O & Edge-Case Matrix

| Scenario | Expected Behavior |
|----------|-------------------|
| Single-session revenue created, later SESSION_DONE outbox fails | Delete the exact created revenue row by id, restore booking progress, rollback inventory if consumed, and return a failure. |
| Review placeholder insert fails after revenue creation | Delete the exact created revenue row by id, restore booking progress, rollback inventory if consumed, and return review failure plus rollback failure details if any. |
| Inventory rollback fails during compensation | Preserve revenue and booking rollback attempts, then include inventory rollback failure in the returned error. |
| Revenue insert succeeds but id is missing | Stop the flow, run compensation, and return a critical error instead of letting later rollback rely on broad matching. |

## Code Map

- `src/modules/booking/actions/session-completion-engine.ts` -- carries `createdRevenueId` across salary, review, and outbox steps.
- `src/modules/booking/actions/session-completion-helpers.ts` -- centralized rollback helpers for revenue, booking progress, and inventory.
- `src/__tests__/session-completion-accounting.test.ts` -- side-effect assertions for revenue deletion by id and rollback failure reporting.

## Tasks & Acceptance

**Execution:**
- [x] Track `createdRevenueId` from single-session revenue creation through the rest of completion.
- [x] Prefer exact revenue deletion by `id` in compensation paths.
- [x] Return rollback failure details when inventory, booking, or revenue rollback cannot be completed.
- [x] Add Jest coverage for exact revenue rollback and inventory rollback failure reporting.

**Acceptance Criteria:**
- Given a single-session revenue row is created, when a later accounting event cannot be queued, then rollback deletes that revenue by id.
- Given rollback inventory fails, when completion returns failure, then the error includes rollback failure context.
- Given revenue insert does not return an id, when completion continues, then the flow stops and compensates instead.

## Verification

**Commands:**
- `npm.cmd test -- src/__tests__/session-completion-accounting.test.ts --runInBand` -- expected: session completion side-effect tests pass.
- `npm.cmd run lint` -- expected: no new lint errors.
- `npm.cmd run build` -- expected: production build passes.
