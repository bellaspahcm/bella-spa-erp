# Beauty V2 Finance Real DB Proof - 2026-10-02

## Status

`PRE_FIX_DIAGNOSTIC_COMPLETE`

This document records the pre-fix Real DB diagnostic that proved the original
Beauty V2 Finance gap was `NOT_WIRED`.

For the post-fix evidence, see:

```text
docs/architecture/BEAUTY_V2_FINANCE_MINIMAL_WIRING_FIX_PROOF_2026_10_02.md
```

This proof follows the completed audit:

- Finance OS exists.
- A new Beauty-specific Finance subsystem is not required.
- The only open candidates were Beauty H8 completion to `accounting_outbox` and Beauty H8 completion to F3 receivable.

Runtime code change remains `DEFER`. This document is evidence only.

## Scope

Prove the two candidates with Real DB evidence:

1. Beauty H8 session `COMPLETED` to `accounting_outbox`.
2. Beauty H8 session `COMPLETED` to F3 receivable facts.

Non-goals:

- No new Finance tables.
- No new ledger.
- No new AR engine.
- No new reconciliation engine.
- No Beauty-specific Finance subsystem.
- No runtime code change.

## Real DB Preconditions

The proof used a real Supabase admin environment loaded from the existing local `.env.local` without printing secrets.

The clean worktree did not have `node_modules`, so a temporary local junction to the already-installed dependency directory was used only to run Jest. The junction was removed after proof capture.

## Baseline H8 Proof

Command:

```powershell
$env:NODE_OPTIONS='-r dotenv/config'
$env:DOTENV_CONFIG_PATH='D:\Antigravity\Projects\BELLA SPA ERP\.env.local'
.\node_modules\.bin\jest.cmd --config jest.real-db.config.ts src/products/beauty-spa-v2/__tests__/beauty-spa-v2-real-db.test.ts --runInBand
```

Result:

```text
Test Suites: 1 passed, 1 total
Tests:       3 passed, 3 total
```

This confirms the existing Beauty V2 Real DB path still persists H8 booking/session/rollback evidence.

## Finance Contract Diagnostic

A temporary diagnostic Jest test created a real Beauty tenant, customer, appointment, and H8 session, then completed the session through `BeautySpaV2Service.completeSession`.

The diagnostic immediately queried:

- `accounting_outbox`
- `finance_invoices`
- `finance_receivable_positions`
- `finance_receivable_ledger`
- `finance_receivable_allocations`

The temporary diagnostic test was removed after proof capture.

Command:

```powershell
$env:NODE_OPTIONS='-r dotenv/config'
$env:DOTENV_CONFIG_PATH='D:\Antigravity\Projects\BELLA SPA ERP\.env.local'
.\node_modules\.bin\jest.cmd --config jest.real-db.config.ts --runInBand --testMatch '**/beauty-v2-finance-contract-real-db.diagnostic.test.ts'
```

Result:

```text
Test Suites: 1 passed, 1 total
Tests:       1 passed, 1 total
```

Captured proof payload:

```json
{
  "tenantId": "ef3bf7c1-80a3-459f-9319-6603a776b335",
  "appointmentId": "82cfd4ab-743f-4a28-abca-c3c92d3009fc",
  "sessionId": "a6df4ad0-6b79-43f3-a943-b9ed5d09d386",
  "completedStatus": "COMPLETED",
  "outboxRowCount": 0,
  "sessionDoneOutboxRowCount": 0,
  "financeInvoiceCount": 0,
  "financeReceivablePositionCount": 0,
  "financeReceivableLedgerCount": 0,
  "financeReceivableAllocationCount": 0,
  "classification": {
    "h8ToAccountingOutbox": "OUTBOX_MISSING",
    "h8ToF3Receivable": "F3_MISSING"
  }
}
```

## Classification

| Candidate | Result | Evidence |
| --- | --- | --- |
| H8 `COMPLETED` to `accounting_outbox` | `NOT_WIRED` | Real DB session completed, same tenant had `outboxRowCount: 0`, `sessionDoneOutboxRowCount: 0`. |
| H8 `COMPLETED` to F3 receivable | `NOT_WIRED` | Same tenant had zero Finance invoice, receivable position, receivable ledger, and receivable allocation rows. |
| Beauty direct F3 write | `NOT_FOUND` | Focused source search found no Beauty runtime references to Finance F3 tables/services after removing the diagnostic file. |
| Beauty F5/control | `PROOF_GAP_BY_UPSTREAM_NOT_WIRED` | No Finance facts exist for Beauty H8 completion, so F5 has nothing Beauty-specific to reconcile yet. |

## Decision

Beauty V2 Finance integration is no longer merely `NOT_PROVEN`.

It is now Real DB-proven:

```text
H8 Session Completed -> accounting_outbox      NOT_WIRED
H8 Session Completed -> F3 receivable          NOT_WIRED
Beauty-specific Finance subsystem             NOT_REQUIRED
Runtime code change                            DEFER
```

The next implementation, if authorized, should be a minimal Beauty mapping/consumer wiring into the existing Finance OS contract. It should not create new Finance engines, tables, reconciliation logic, or Beauty-specific Finance subsystems.
