# Beauty V2 Finance Minimal Wiring Fix Proof - 2026-10-02

## Status

`IMPLEMENTED_WITH_REAL_DB_PROOF`

The pre-fix diagnostic proved:

```text
H8 Session Completed -> accounting_outbox      NOT_WIRED
H8 Session Completed -> F3 receivable          NOT_WIRED
```

This proof records the minimal wiring fix and fresh verification.

## Scope

Implemented only the integration boundary:

```text
BeautySpaV2Service.completeSession
      ↓
Beauty SESSION_DONE outbox producer
      ↓
accounting_outbox(reference_type = BEAUTY_SESSION)
      ↓
Accounting worker Beauty H8 route
      ↓
SemanticReceivableChargeService
      ↓
existing F1 journal + F3 receivable facts
```

Non-goals preserved:

- No Finance tables.
- No Finance engine.
- No AR engine.
- No reconciliation engine.
- No Beauty-specific Finance subsystem.
- No Beauty H8 core/repository/migration change.

## Code Boundary

Runtime changes are limited to:

- `src/products/beauty-spa-v2/service.ts`
- `src/products/beauty-spa-v2/finance-outbox.ts`
- `src/lib/accounting-outbox.ts`
- `src/app/api/cron/accounting-worker/route.ts`

Focused test changes are limited to existing Beauty V2 and accounting worker tests.

## Real DB Proof

Command:

```powershell
$env:NODE_OPTIONS='-r dotenv/config'
$env:DOTENV_CONFIG_PATH='D:\Antigravity\Projects\BELLA SPA ERP\.env.local'
.\node_modules\.bin\jest.cmd --config jest.real-db.config.ts --runInBand --testMatch '**/beauty-spa-v2-real-db.test.ts'
```

Result:

```text
Test Suites: 1 passed, 1 total
Tests:       4 passed, 4 total
```

Runtime evidence from the final run:

```text
[BeautySpaV2Finance] Enqueued/reused SESSION_DONE for BEAUTY_SESSION:e73d9b75-d4a0-4eac-ba3a-bee503362101
[Accounting Worker] Claimed 1 events for processing.
[Accounting Worker] Processing event 78e23299-25f8-40d5-b634-afaa66ad84ce | Type: SESSION_DONE | Tenant: 0d921336-1520-415f-b749-cc5ea6adcf79
[Accounting Worker] Event 78e23299-25f8-40d5-b634-afaa66ad84ce processed successfully. Entry: 73ee3c1b-1378-4c7d-b7ef-8edb4d106665
[Accounting Worker] Finished batch. Success: 1, Dead-lettered: 0, Failures: 0
```

The Real DB test asserts:

- H8 session completes with status `COMPLETED`.
- `accounting_outbox` has `SESSION_DONE`, `reference_type = BEAUTY_SESSION`, `reference_id = beauty_sessions.id`, status `PENDING` before worker.
- Worker completes the outbox row and writes a journal id.
- `journal_entries` has `reference_type = SESSION_DONE`, `reference_id = beauty_sessions.id`, status `POSTED`.
- `finance_invoices` has metadata `business_source_type = BEAUTY_SESSION_DONE`, `business_source_id = beauty_sessions.id`, status `FINALIZED`.
- `finance_receivable_positions` has the expected customer, original amount, and outstanding amount.
- `finance_receivable_ledger` has at least one ledger fact for the invoice.

## Focused Unit Proof

Beauty workflow:

```powershell
.\node_modules\.bin\jest.cmd --config jest.config.ts --runInBand --testMatch '**/beauty-spa-v2.workflow.test.ts'
```

Result:

```text
Test Suites: 1 passed, 1 total
Tests:       23 passed, 23 total
```

This includes the failure-safe edge case that a Finance outbox enqueue failure
does not roll back the already-completed H8 session.

Accounting worker:

```powershell
.\node_modules\.bin\jest.cmd --config jest.config.ts --runInBand --testMatch '**/accounting-outbox.test.ts'
```

Result:

```text
Test Suites: 1 passed, 1 total
Tests:       21 passed, 21 total
```

## Static Checks

```powershell
git diff --check
```

Result: `PASS`

Focused changed-file search found no new `any`, `@ts-ignore`, `@ts-expect-error`, or `as unknown as` in the Beauty Finance wiring scope.

Note: `src/app/api/cron/accounting-worker/route.ts` already contains a
pre-existing `mark_outbox_completed` RPC nullable-argument cast outside this
Beauty wiring change.

## Typecheck Status

```powershell
npm run typecheck:changed
```

Status: `TIMEOUT / NOT_VERIFIED`

The command invoked the repo CI wrapper, which started:

```text
node node_modules/typescript/bin/tsc --noEmit --strict --pretty false --incremental --tsBuildInfoFile .cache/tsbuildinfo/full.tsbuildinfo
```

After 120 seconds it had produced no diagnostics and no terminal result, so it was interrupted. This is not closure evidence.

## Classification After Fix

| Candidate | Result | Evidence |
| --- | --- | --- |
| H8 `COMPLETED` to `accounting_outbox` | `PASS` | Real DB outbox row created with `SESSION_DONE` and `BEAUTY_SESSION`. |
| H8 `COMPLETED` to F1 journal | `PASS` | Worker posted `journal_entries` row for the Beauty session id. |
| H8 `COMPLETED` to F3 receivable | `PASS` | Real DB invoice, receivable position, and receivable ledger read-back passed. |
| Beauty direct F3 write | `NOT_FOUND` | Product emits outbox only; F3 write is through `SemanticReceivableChargeService`. |
| F5/control | `DEFERRED_PROOF` | Finance facts now exist; dedicated F5/control assertion remains separate from this minimal wiring proof. |

F5 note:

`docs/architecture/ARCHITECTURE_GATE_RESULT_F5.md` marks the implemented F5
domain as AP and marks `AR_GL_BALANCE` as planned/F5.5. Since this Beauty flow
produces AR/F3 facts, forcing an F5 PASS here would require opening Finance F5
AR control scope. That is outside the authorized minimal wiring fix.

## Decision

The Beauty V2 Finance integration boundary is now minimally wired to the existing Finance OS.

Do not expand this into a Finance subsystem workstream.
