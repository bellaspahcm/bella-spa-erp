---
status: done
created: 2026-06-03
owner: Codex
---

# TT133 Service Revenue Mapping

## Problem

Bella ERP has SIMPLE and PROFESSIONAL accounting modes. SIMPLE booking/session/payment forms must stay operationally simple, but the PROFESSIONAL ledger must recognize service revenue under TT133 more accurately.

Current session completion posts all earned service revenue as `Dr 3387 / Cr 5111`. This is only valid for the portion already collected and deferred. If Bella completed a session before collecting enough money, the unpaid portion should be `Dr 131 / Cr 5113`. TT133 service revenue should also use service revenue account `5113`, not the current custom `5111` default.

## Scope

- Add/standardize `5113` in the default chart and templates.
- Allocate session revenue between deferred revenue (`3387`) and customer receivable (`131`).
- Keep SIMPLE forms unchanged; only enrich accounting outbox payload.
- Keep runtime safe if older payloads do not yet contain split amounts.
- Update focused accounting tests.

## Acceptance Criteria

1. Given a prepaid package session, when `SESSION_DONE` posts, then the earned amount posts `Dr 3387 / Cr 5113`.
2. Given a partially paid or unpaid session, when `SESSION_DONE` posts, then the unpaid portion posts `Dr 131 / Cr 5113`.
3. Given old outbox payload without split amounts, when the worker posts, then behavior remains backward compatible.
4. Given default COA/template setup, when a tenant is initialized, then `5113` exists under `511` and session revenue templates credit `5113`.

## Verification

- `npm.cmd test -- src/__tests__/accounting-engine.test.ts src/__tests__/accounting-outbox.test.ts --runInBand` -- passed, 2 suites / 24 tests.
- `npm.cmd run build` -- passed.

## Production Update

- Added `5113 - Doanh thu cung cap dich vu` to Bella Spa Headquarter COA.
- Updated TT133 `SESSION_REVENUE_RECOGNIZED` template credit account to `5113`.

## Remaining Work

- Refund still needs an explicit before-earned vs after-earned split before removing every `521` path.
- Legacy SIMPLE -> PROFESSIONAL sync still needs a dedicated pass to branch historical `revenue_type` into `3387`, `131`, or `5113`.
