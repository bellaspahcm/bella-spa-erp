---
title: 'Harden Accounting Worker Idempotency'
type: 'bugfix'
created: '2026-06-03'
status: 'done'
baseline_commit: '99e220c7fcbce9db5890aa73eb0e8acf6dd2d2ab'
context:
  - 'D:/Antigravity/Projects/BELLA SPA ERP/docs/implementation-artifacts/investigations/accounting-core-double-entry-investigation.md'
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** The accounting worker posts a journal entry before marking the outbox row completed. If journal posting succeeds but `mark_outbox_completed` fails, a retry can post a second active journal for the same business reference.

**Approach:** Make worker retries idempotent by checking for an existing active journal reference before posting, completing the outbox with the existing posted journal when found, and adding a database unique partial index for worker-generated journal reference types.

## Boundaries & Constraints

**Always:** Keep the worker fail-closed for malformed payloads and source validation errors. Preserve stale `SESSION_DONE` dead-letter behavior before any idempotent completion. Do not silently ignore mark-completed failures.

**Ask First:** If existing production duplicate active journal references are found, stop and ask before auto-canceling or merging accounting entries.

**Never:** Do not change journal business mappings, accounting reports, outbox event contracts, or manual period-closing/reversal behavior in this slice.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Retry after posted journal but failed completion | Outbox `FAILED/PENDING`; existing `POSTED` journal for mapped reference | Worker skips handler and calls `mark_outbox_completed` with existing journal id | If mark completed fails, mark outbox failed as before |
| First attempt succeeds fully | No existing active journal | Existing handler posts journal and worker completes outbox | Existing failure path unchanged |
| Existing DRAFT journal for reference | Outbox retry sees active non-posted journal | Worker fails event with explicit error rather than posting duplicate | Admin can inspect DRAFT |
| Stale session retry | `SESSION_DONE` source no longer completed | Dead-letter stale outbox before journal idempotency completion | Existing stale behavior preserved |

</frozen-after-approval>

## Code Map

- `src/app/api/cron/accounting-worker/route.ts` -- Add event-to-journal reference mapping and existing journal guard.
- `supabase/migrations/20260603050000_unique_active_journal_reference.sql` -- Add DB duplicate audit and partial unique index for worker-generated active references.
- `src/__tests__/accounting-outbox.test.ts` -- Add retry/idempotency and stale-session regression coverage.
- `docs/DEVELOPMENT_LOG.md` -- Record implementation and verification.

## Tasks & Acceptance

**Execution:**
- [x] `src/app/api/cron/accounting-worker/route.ts` -- Check existing active journal before posting and complete outbox with existing posted journal.
- [x] `src/app/api/cron/accounting-worker/route.ts` -- Preserve stale `SESSION_DONE` dead-letter ordering.
- [x] `supabase/migrations/20260603050000_unique_active_journal_reference.sql` -- Add duplicate audit and partial unique index for worker-generated journal references.
- [x] `src/__tests__/accounting-outbox.test.ts` -- Simulate post success then completed-mark failure, retry, and assert no second handler call.
- [x] `docs/DEVELOPMENT_LOG.md` -- Add concise handoff entry.

**Acceptance Criteria:**
- Given a retry after `mark_outbox_completed` failed, when a posted journal already exists for the outbox reference, then the worker must not call the posting handler again.
- Given the retry marks completed successfully, then the outbox must complete with the existing journal id.
- Given a stale `SESSION_DONE` outbox, when the source session is no longer completed, then it must still dead-letter instead of idempotently completing.
- Given duplicate active worker journal references exist, when the DB migration runs, then it must fail explicitly instead of installing an unsafe uniqueness constraint.

## Spec Change Log

## Verification

**Commands:**
- `npm.cmd test -- src/__tests__/accounting-outbox.test.ts --runInBand` -- pass, 1 suite / 14 tests.
- `npm.cmd run build` -- pass.
- Supabase duplicate audit query -- pass, 0 duplicate active worker journal references.
- `npx.cmd supabase db push --linked --dry-run` -- pass, only `20260603050000_unique_active_journal_reference.sql`.
- `npx.cmd supabase db push --linked --yes` -- pass, migration applied.
- Supabase verification query -- pass, migration version `20260603050000` and `idx_journal_entries_worker_reference_unique` exist.

## Suggested Review Order

**Worker Idempotency**

- Event mapping keeps worker references aligned with posted journals.
  [`route.ts:128`](../../src/app/api/cron/accounting-worker/route.ts#L128)

- Existing journal lookup fails closed on query errors.
  [`route.ts:149`](../../src/app/api/cron/accounting-worker/route.ts#L149)

- Per-event guard runs before any posting handler.
  [`route.ts:250`](../../src/app/api/cron/accounting-worker/route.ts#L250)

- Stale sessions still dead-letter before idempotent completion.
  [`route.ts:260`](../../src/app/api/cron/accounting-worker/route.ts#L260)

- Posted journal retries complete outbox without duplicate posting.
  [`route.ts:282`](../../src/app/api/cron/accounting-worker/route.ts#L282)

**Database Invariant**

- Migration aborts on existing duplicates before adding uniqueness.
  [`20260603050000_unique_active_journal_reference.sql:3`](../../supabase/migrations/20260603050000_unique_active_journal_reference.sql#L3)

- Partial unique index protects active worker references.
  [`20260603050000_unique_active_journal_reference.sql:26`](../../supabase/migrations/20260603050000_unique_active_journal_reference.sql#L26)

**Regression Coverage**

- Retry after completion-write failure skips second handler call.
  [`accounting-outbox.test.ts:598`](../../src/__tests__/accounting-outbox.test.ts#L598)

- Existing DRAFT journal fails explicitly.
  [`accounting-outbox.test.ts:695`](../../src/__tests__/accounting-outbox.test.ts#L695)

**Handoff**

- Development log captures intent, migration, and verification.
  [`DEVELOPMENT_LOG.md:8`](../DEVELOPMENT_LOG.md#L8)
