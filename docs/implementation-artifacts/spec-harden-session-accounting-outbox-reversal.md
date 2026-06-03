---
status: done
created: 2026-06-03
owner: Codex
---

# Harden Session Accounting Outbox Reversal

## Problem

Production balance sheet showed `3387 = -180,000d` and `334 = 150,000d` from one orphan `SESSION_DONE` journal. The SIMPLE session was reverted from `completed` back to `scheduled`, but the pending accounting outbox event was still processed later into the PROFESSIONAL ledger.

The existing `reverseJournalEntry` action also created a reversed journal and then marked the original as `CANCELED`. Because reports only include `POSTED` entries, that can overcorrect by reporting only the reversal.

## Scope

- Guard `SESSION_DONE` processing in the accounting worker.
- Dead-letter stale `SESSION_DONE` outbox rows instead of posting journals.
- Change reversal semantics so the original journal stays `POSTED` and the reversal entry is also `POSTED`.
- Update focused Jest tests.

## Acceptance Criteria

1. Given a `SESSION_DONE` outbox event whose `session_logs` source is missing, when the worker runs, then no journal is posted and the outbox is marked `DEAD`.
2. Given a `SESSION_DONE` outbox event whose source session is no longer `completed`, when the worker runs, then no journal is posted and the outbox is marked `DEAD`.
3. Given a valid completed session, when the worker processes `SESSION_DONE`, then existing journal posting behavior remains unchanged.
4. Given a posted journal reversal, when `reverseJournalEntry` runs, then it posts swapped debit/credit lines without changing the original entry status.

## Verification

- `npm.cmd test -- src/__tests__/accounting-outbox.test.ts src/__tests__/accounting-reports.test.ts --runInBand` -- passed, 2 suites / 22 tests.
- `npm.cmd run build` -- passed.

## Production Cleanup

- Canceled orphan journal `626a19e4-72f1-4254-9e51-c18d9e30f471`.
- Marked stale outbox `1f940c26-53f6-47be-b8d1-f3480ae2fd67` as `DEAD`.
- Added audit log for the cleanup.
- Rechecked tenant `Bella Spa Headquarter`: `3387 = 0`, `334 = 0`, `total_liabilities = 0`.
