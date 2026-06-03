# Investigation: Accounting Core Double Entry Logic

## Hand-off Brief

1. **What happened.** User suspects accounting core may record double-entry journals with incorrect business logic; source trace confirms several accounting integrity risks even though basic debit/credit balancing exists.
2. **Where the case stands.** Active; confirmed findings cover missing app-layer line validation, missing tenant/account validation for manual/service-role posting, non-idempotent worker retry after journal post, and partial DRAFT leftovers on post failure.
3. **What's needed next.** Harden `AccountingEngineService.postJournalEntry` and worker idempotency before changing business mappings.

## Case Info

| Field | Value |
| --- | --- |
| Ticket | N/A |
| Date opened | 2026-06-03 |
| Status | Active |
| System | Windows workspace, Next.js/Supabase app |
| Evidence sources | Source code, migrations, Jest tests, development docs |

## Problem Statement

User reported: "kiểm tra lại logic các hàm trong accounting core, tôi nghi ngờ có sai nghiệp vụ ghi nhận bút toán kép".

## Evidence Inventory

| Source | Status | Notes |
| --- | --- | --- |
| User hypothesis | Available | Suspected wrong double-entry business logic in accounting core. |
| `src/services/accounting-engine.ts` | Available | Primary journal posting engine. |
| `src/services/revenue-recognition.ts` | Available | Business event to journal line mapping. |
| `src/app/api/cron/accounting-worker/route.ts` | Available | Outbox worker dispatch path. |
| Accounting migrations | Available | Schema, constraints, reports, outbox, periods. |
| Accounting tests | Available | Existing regression surface. |
| `project-context.md` | Missing | No matching file found via `rg --files -g "project-context.md"`. |

## Investigation Backlog

| # | Path to Explore | Priority | Status | Notes |
| - | --- | --- | --- | --- |
| 1 | Validate `postJournalEntry` double-entry invariants | High | Done | Basic balance exists; line/account/tenant validation gaps confirmed. |
| 2 | Validate revenue-recognition business mappings | High | Done | Main mappings are balanced; no sign defect confirmed in this pass. |
| 3 | Validate worker/manual payload validation | Medium | Done | Worker/manual can feed untrusted account IDs into service-role engine. |
| 4 | Validate report sign logic | Medium | Done | Core reports consistently filter `POSTED` in inspected SQL. |
| 5 | Compare tests against invariants | Medium | Done | Existing tests pass but miss confirmed risk cases. |

## Timeline of Events

| Time | Event | Source | Confidence |
| --- | --- | --- | --- |
| 2026-06-03 | Investigation opened for accounting double-entry logic. | User request | Confirmed |
| 2026-06-03 | Accounting focused tests passed: 4 suites / 44 tests. | `npm.cmd test -- src/__tests__/accounting-engine.test.ts src/__tests__/accounting-outbox.test.ts src/__tests__/accounting-reports.test.ts src/__tests__/dual-mode-accounting.test.ts --runInBand` | Confirmed |

## Confirmed Findings

### Finding 1: Engine checks only total balance before DB writes

**Evidence:** `src/services/accounting-engine.ts:42-49`

**Detail:** `postJournalEntry` sums debit and credit and rejects unbalanced or zero-total entries, but it does not validate each line for non-negative finite amounts, exactly-one-side populated, minimum line count, account tenant ownership, leaf account posting, or dimension ownership.

### Finding 2: Database has line amount constraints, but account tenant ownership is not enforced by schema

**Evidence:** `supabase/migrations/20260524000000_accounting_core.sql:45-56`

**Detail:** `journal_lines.account_id` is a plain FK to `accounting_accounts(id)`. The DB checks non-negative amounts and debit-or-credit shape, but there is no composite constraint tying `journal_lines.account_id` to the `journal_entries.tenant_id`.

### Finding 3: Manual server action passes caller-provided account IDs directly to service-role engine

**Evidence:** `src/services/accounting/journals.ts:206-230`

**Detail:** `postManualJournalEntry` sets `tenant_id` from the current user, but maps `input.lines[].account_id` directly into `AccountingEngineService.postJournalEntry`. Because the engine uses service-role, RLS cannot protect this path.

### Finding 4: Worker manual-entry payload accepts arbitrary account IDs

**Evidence:** `src/app/api/cron/accounting-worker/route.ts:80-99`, `src/app/api/cron/accounting-worker/route.ts:240-247`

**Detail:** `readJournalLines` validates type shape only. It does not verify that accounts belong to the outbox tenant before passing the lines to the service-role engine.

### Finding 5: Outbox retry can duplicate posted journal entries if completion marking fails

**Evidence:** `src/app/api/cron/accounting-worker/route.ts:255-294`, `supabase/migrations/20260525130000_accounting_outbox.sql:149-161`, `supabase/migrations/20260525130000_accounting_outbox.sql:169-180`

**Detail:** The worker posts the journal first, then marks the outbox completed. If `mark_outbox_completed` fails after a journal was posted, the catch path marks the outbox failed. A later retry claims `FAILED` events and posts again. `journal_entries` has no unique constraint on `(tenant_id, reference_type, reference_id)`.

### Finding 6: Post-status failure leaves DRAFT journal header and lines behind

**Evidence:** `src/services/accounting-engine.ts:79-92`

**Detail:** The engine rolls back the header only when line insertion fails. If the final `journal_entries.update({ status: 'POSTED' })` fails, it throws without deleting/canceling the DRAFT entry and its lines.

### Finding 7: Report SQL inspected filters posted journals

**Evidence:** `supabase/migrations/20260525150000_accounting_reports.sql:154-160`, `supabase/migrations/20260525150000_accounting_reports.sql:320-325`

**Detail:** Income statement and balance sheet excerpts filter `e.status = 'POSTED'`. Additional grep found the same status filter in cash flow, consolidated P&L, and reconciliation migrations.

## Deduced Conclusions

### Deduction 1: The core is numerically balanced but not business-safe enough

**Based on:** Findings 1, 2, 3, and 4.

**Reasoning:** Debit/credit equality is necessary, but service-role posting with unverified `account_id` can create balanced entries using accounts from another tenant or non-posting parent accounts. Such entries pass numeric double-entry checks while violating accounting ownership semantics.

**Conclusion:** The user's suspicion is partly confirmed: not because normal mapped entries are obviously sign-wrong, but because accounting core accepts some balanced-but-invalid journals.

### Deduction 2: Outbox processing is not exactly-once at the ledger layer

**Based on:** Finding 5.

**Reasoning:** The outbox table deduplicates input events, but the ledger table does not deduplicate posted entries by business reference. The worker retry path can re-run journal creation after a post succeeded but completion marking failed.

**Conclusion:** Accounting automation can overstate revenue/expense/assets/liabilities through duplicate posted journals under retry failure conditions.

## Hypothesized Paths

### Hypothesis 1: Accounting core has incorrect double-entry business logic

**Status:** Confirmed

**Theory:** One or more accounting service functions may post journal entries that are numerically balanced but business-sign wrong, tenant/account mismatched, or too weakly validated.

**Supporting indicators:** User suspicion and broad accounting surface.

**Would confirm:** Source line evidence showing wrong debit/credit mapping, invalid balanced entries accepted, or reports consuming lines with wrong semantics.

**Would refute:** Source and test evidence showing correct invariants and business mappings for the current scope.

**Resolution:** Confirmed by source trace: engine balance checks exist, but tenant/account/idempotency safeguards are incomplete.

### Hypothesis 2: Revenue-recognition mappings are sign-wrong for standard events

**Status:** Open

**Theory:** Package sale, session done, expense, salary payment, inventory consumption, or refund may use reversed debit/credit business semantics.

**Supporting indicators:** User suspicion and broad event mapping surface.

**Would confirm:** Source or accounting example showing debit/credit mapping contradicts TT133/business intent.

**Would refute:** Domain approval plus tests asserting expected account-code lines for each event type.

**Resolution:** No sign defect confirmed in this pass; mappings are balanced and broadly conventional, but coverage is incomplete for every event.

## Missing Evidence

| Gap | Impact | How to Obtain |
| --- | --- | --- |
| Real production accounting examples | Would confirm if observed balances/reports are wrong in data, not just code. | Query sample posted journal entries and related source transactions. |
| `project-context.md` | Could contain additional project-specific accounting constraints. | Add or locate project context file if it exists elsewhere. |
| Accounting business policy for refunds and salary accrual | Needed to decide whether current event mappings are sufficient under Bella's actual policy. | Confirm with product/accounting owner, then encode tests. |

## Source Code Trace

| Element | Detail |
| --- | --- |
| Error origin | `AccountingEngineService.postJournalEntry`; accounting worker post-then-complete flow |
| Trigger | Accounting outbox worker, manual entries, revenue recognition services |
| Condition | Balanced input with invalid account ownership/line shape, or worker failure after posted journal but before outbox completion |
| Related files | `src/services/accounting-engine.ts`, `src/services/revenue-recognition.ts`, `src/app/api/cron/accounting-worker/route.ts`, accounting migrations/tests |

## Conclusion

**Confidence:** Medium

The evidence confirms accounting core has integrity gaps. Basic double-entry balancing is present in app and DB, and inspected reports filter `POSTED` entries, but the engine is not a complete accounting boundary because it does not verify account ownership/leaf accounts and the outbox worker is not ledger-idempotent after partial failure.

## Recommended Next Steps

### Fix direction

1. Add app-layer validation inside `AccountingEngineService.postJournalEntry`: finite non-negative amounts, exactly one debit/credit per non-zero line, no zero lines, minimum two non-zero lines, all accounts active and owned by `entry.tenant_id`, and optionally leaf-account-only.
2. Add ledger idempotency: before posting automated references, check existing `journal_entries` for same tenant/reference/status, or add a DB unique index for non-manual business references and make worker resume completed journals.
3. Make post failure compensating: if status update to `POSTED` fails, delete/cancel the DRAFT header and lines or move posting into an atomic RPC.
4. Add tests for negative amounts, both-side lines, foreign-tenant account IDs, post-status rollback, and worker retry after `mark_outbox_completed` failure.

### Diagnostic

Read source and tests, then classify confirmed defects versus missing safeguards.

## Reproduction Plan

Focused accounting tests currently pass, but they do not reproduce the confirmed edge cases:

1. Unit test `postJournalEntry` rejects a balanced entry containing an account from another tenant.
2. Unit test `postManualJournalEntry` rejects a non-leaf or foreign account before service-role posting.
3. Worker test simulates `postJournalEntry` success then `mark_outbox_completed` failure, then retry; expected result should not create a second journal.
4. Engine test simulates `POSTED` status update failure and asserts DRAFT header/lines are cleaned up or transaction rolls back.

## Side Findings

- No `project-context.md` file was found in the workspace by `rg --files -g "project-context.md"`.

## Follow-up: 2026-06-03

### Scope

User asked to continue checking whether accounting calculation and double-entry recognition follow Vietnamese accounting practice under Circular 133/2016/TT-BTC.

### External Standards Checked

- Official Cong Bao page confirms Circular 133/2016/TT-BTC was issued on 2016-08-26 and effective from 2017-01-01: https://congbao.chinhphu.vn/van-ban/thong-tu-so-133-2016-tt-btc-21048/15520.htm
- Circular 133 account list includes 131, 3387, 511, 5111, 5112, 5113, 5118, 632, 642, 334, 911; the opened Appendix 1 account list did not show 521 in the TT133 account system: https://cdn.thuvienphapluat.vn/phap-luat/2022-2/NHPT/phu-luc-1-thong-tu-133.pdf
- Government policy Q&A cites Ministry of Finance guidance that customer advances before products/services are provided should be tracked in 131, while 3387 is for revenue received in advance for multiple accounting periods depending on the committed service period: https://chinhsachonline.chinhphu.vn/khoan-hoc-phi-thu-truoc-hach-toan-the-nao-23200.htm
- Article 57 guidance for account 511 says service revenue recognition requires the completed work portion to be determinable, and amounts collected before delivery/service completion should not be recorded to 511 yet: https://www.ketoanthue.vn/index.php/thong-tu-133-2016/3132-thong-tu-133-2016-dieu-57-tai-khoan-511-doanh-thu-ban-hang-va-cung-cap-dich-vu.html

### Additional Confirmed Findings

#### Finding 8: TT133 COA seed creates a 521 account and reports depend on it

**Evidence:** `supabase/migrations/20260525110000_seed_default_coa.sql:69-75`, `supabase/migrations/20260525150000_accounting_reports.sql:153-171`

**Detail:** The seeded TT133 chart includes account `521` for refunds/vouchers. The income statement separately reads 511 gross revenue and 521 deductions. The external TT133 account list inspected shows 511 subaccounts but not 521, and 511 guidance records revenue deductions on the debit side of 511.

**Impact:** Refunds and P&L are using a TT200-like deduction account model inside a TT133 profile. This can make reports inconsistent with the stated accounting standard.

#### Finding 9: Refund logic posts to 521 under TT133 profile

**Evidence:** `src/services/revenue-recognition.ts:249-273`, `supabase/migrations/20260530050000_accounting_templates_and_readiness.sql:222-228`

**Detail:** `handleRefundIssued` posts Dr 521 / Cr cash or bank, and the system template for `REFUND_TO_CUSTOMER` also uses Dr 521 / Cr 111_OR_112. Under the inspected TT133 guidance, refunds/discounts should be modeled as reductions to 511 unless accountant policy intentionally keeps an internal analytical account.

**Impact:** The entry is balanced, but likely not TT133-correct as implemented.

#### Finding 10: Service package revenue deferral is partly correct, but the account and policy need tightening

**Evidence:** `src/services/revenue-recognition.ts:48-72`, `src/services/revenue-recognition.ts:90-120`, `src/modules/booking/actions/session-completion-helpers.ts:408-433`, `supabase/migrations/20260530050000_accounting_templates_and_readiness.sql:191-220`

**Detail:** Runtime package payment posts Dr 111 / Cr 3387, and session completion posts Dr 3387 / Cr 5111. This matches the broad idea of deferring unearned package/service revenue and recognizing it as sessions are completed. However, external guidance distinguishes between 131 customer advances and 3387 revenue received in advance across multiple periods, so Bella must define when a prepaid package is 131 versus 3387. Also, the runtime recognizes service revenue to `5111`, while TT133 standard subaccount `5113` is service revenue.

**Impact:** The recognition direction is reasonable for multi-session service packages, but the code is not yet a clean TT133 policy implementation.

#### Finding 11: Legacy ledger sync recognizes every confirmed revenue directly to 5111

**Evidence:** `supabase/migrations/20260531010000_atomic_legacy_ledger_sync.sql:176-214`

**Detail:** The legacy sync loops all confirmed `revenue` rows and posts Dr cash/bank / Cr 5111, regardless of `revenue_type`. This conflicts with runtime package/deposit payment handling, which posts those amounts to 3387 first and only recognizes 511 when sessions complete.

**Impact:** Backfilled or synced historical deposits/package payments can overstate revenue in the payment period and bypass deferred revenue.

#### Finding 12: Salary payment can be posted without a matching runtime salary accrual

**Evidence:** `src/services/finance/transaction-mutations.ts:227-314`, `src/app/api/cron/accounting-worker/route.ts:207-216`, `src/services/revenue-recognition.ts:179-213`, `supabase/migrations/20260531010000_atomic_legacy_ledger_sync.sql:317-380`

**Detail:** Confirming a salary expense with a linked salary record enqueues `SALARY_PAID`, and the worker posts Dr 334 / Cr cash or bank. Runtime code in this path does not enqueue `SALARY_ACCRUAL`; accrual is present in templates and legacy sync. If the salary record was not already accrued, the liability is reduced without the corresponding salary expense.

**Impact:** Salary payment entries are TT133-conventional only when accrual exists first. The workflow currently needs an invariant: salary payment must require, create, or verify a posted accrual for the same salary record.

#### Finding 13: KTV commission accrual can overlap with salary record accrual

**Evidence:** `src/services/revenue-recognition.ts:107-111`, `supabase/migrations/20260530050000_accounting_templates_and_readiness.sql:278-298`, `supabase/migrations/20260531010000_atomic_legacy_ledger_sync.sql:317-341`

**Detail:** Session completion accrues commission Dr 6421 / Cr 334. Salary accrual also uses Dr 6421 / Cr 334 for the full salary amount. If salary total includes the same commission amounts, posting both can double-count labor cost and payable.

**Impact:** Need a single source of truth: either session-level commission accrual is later offset/excluded from monthly salary accrual, or monthly salary accrual posts only the remaining salary components.

#### Finding 14: Expense salary account mapping is inconsistent

**Evidence:** `src/services/revenue-recognition.ts:143-156`, `supabase/migrations/20260530060000_add_expense_salary_accounting_template.sql:10-20`, `supabase/migrations/20260531010000_atomic_legacy_ledger_sync.sql:239-245`

**Detail:** Runtime `handleExpenseRecorded` maps category `salary` to `642`, while template and legacy sync use `6421`. Under TT133, 6421/6422 are standard subaccounts for selling/admin business management costs; the project has also chosen 6421 for salary/KTV.

**Impact:** Same business event can land on different expense accounts depending on path.

### Updated Conclusion

**Confidence:** Medium-high

The accounting core is not ready to claim full TT133 correctness. Numeric double-entry balancing exists, and several entries are directionally correct, but TT133 mapping and workflow sequencing have material gaps: 521 usage, 5111 vs 5113 service revenue, 131 vs 3387 policy for prepaid packages, legacy sync posting confirmed revenue directly to 5111, and salary/commission accrual/payment sequencing.

### Dual-Mode Constraint

Bella accounting has two modes, so fixes must preserve both:

- SIMPLE remains the operational source tables and forms (`revenue`, `expenses`, `salary_records`, session/inventory flows).
- PROFESSIONAL is the journal ledger generated from SIMPLE through accounting metadata, templates, outbox events, and legacy sync.
- Evidence: `supabase/migrations/20260526050000_dual_mode_accounting.sql:1-4` adds `tenants.accounting_mode` with `SIMPLE`/`PROFESSIONAL`; `supabase/migrations/20260530050000_accounting_templates_and_readiness.sql:2-8` says SIMPLE data entry stays friendly while metadata enables safe upgrade to PROFESSIONAL; `supabase/migrations/20260531010000_atomic_legacy_ledger_sync.sql:1-4` makes SIMPLE -> PROFESSIONAL sync atomic and `supabase/migrations/20260531010000_atomic_legacy_ledger_sync.sql:389-390` switches the tenant to PROFESSIONAL after sync.
- Therefore, TT133 fixes must update the full translation layer, not only one side: source event classification, event templates, runtime outbox posting, legacy sync/backfill, readiness preview, and reports.
- Do not make SIMPLE forms more complex for accountants/admins just to satisfy professional ledger detail. Keep SIMPLE input stable and derive ledger-safe entries behind the scenes.
- Avoid bidirectional mutation from PROFESSIONAL ledger back into SIMPLE source records except explicit review/resolution workflows. Otherwise journal corrections can corrupt operational booking/payment/salary history.

### Recommended Fix Direction

1. Define Bella accounting policy for prepaid package money: when to use 131 and when to use 3387.
2. Replace or isolate 521 for TT133: refund/reduction should debit the correct 511 account, and reports should not double-count reductions.
3. Seed/use `5113` for service revenue, or explicitly document why Bella's custom `5111` subaccount is acceptable under its internal chart.
4. Change legacy sync to branch by `revenue_type`: package/deposit/remaining payments to deferred/advance account, session-completed revenue to 511.
5. Enforce salary invariant: no salary payment posting unless matching salary accrual exists or is atomically created first.
6. Prevent commission double count by deciding whether commission is accrued per session or as part of salary month-end, not both.
7. Align runtime expense category `salary` with the selected salary expense account.

## Follow-up: 2026-06-03 #2

### Scope

User reported the current balance sheet shows `Doanh thu chua thuc hien (3387)` as `-180,000d`, with `334` showing `150,000d`.

### Production Data Trace

Queried production Supabase using the service-role key from `mcp-server/.env`. No secrets were printed.

### Finding 15: The negative 3387 balance comes from one orphan `SESSION_DONE` journal

**Evidence:** Production query on `accounting_accounts.account_code = '3387'`, `journal_lines`, and `journal_entries`.

**Detail:** Tenant `Bella Spa Headquarter` has exactly one posted 3387 line:

- Entry `626a19e4-72f1-4254-9e51-c18d9e30f471`
- Date `2026-05-29`
- Reference `SESSION_DONE / 06776bb3-53b6-48d2-be74-eb09d7e3719d`
- Description `Ket chuyen dich vu hoan thanh: Hoan thanh buoi 3/30 - Tam Be Chuan Y Khoa Tai Nha`
- Lines:
  - Dr `3387` `180,000`
  - Cr `5111` `180,000`
  - Dr `6421` `150,000`
  - Cr `334` `150,000`

The `3387` balance is therefore `0 credit - 180,000 debit = -180,000`.

### Finding 16: The source session/booking no longer exists, but the outbox was still completed

**Evidence:** Production query returned no current rows in `session_logs`, `bookings`, `revenue`, `expenses`, `salary_records`, or `inventory_logs` for reference id `06776bb3-53b6-48d2-be74-eb09d7e3719d`. The `accounting_outbox` row `1f940c26-53f6-47be-b8d1-f3480ae2fd67` is `COMPLETED` and points to journal entry `626a19e4-72f1-4254-9e51-c18d9e30f471`.

**Detail:** Audit log shows the session was changed `scheduled -> completed` at `2026-05-28T07:07:17Z`, creating the outbox event, then changed back `completed -> scheduled` around `2026-05-28T07:07:45Z`. The worker processed the stale outbox later at `2026-05-29T02:26:23Z`.

**Impact:** Professional ledger posted revenue recognition and KTV commission for a business event that had already been reverted in SIMPLE. This explains both the `3387 -180,000d` and the `334 150,000d` visible in the balance sheet.

### Finding 17: Existing reversal action is risky for this case

**Evidence:** `src/services/accounting/journals.ts:99-124`, report SQL filters `e.status = 'POSTED'`.

**Detail:** `reverseJournalEntry` creates a reversed POSTED journal, then marks the original as `CANCELED`. Since reports exclude `CANCELED`, the report would include only the reversal, not the original plus reversal. For this orphan-entry cleanup, that would overcorrect instead of zeroing the effect.

### Corrective Direction

1. Immediate production cleanup should not use the current reversal action as-is.
2. For this exact orphan journal, either cancel the original entry only, or fix reversal semantics first.
3. Runtime must cancel/dead-letter stale outbox events when the source SIMPLE record no longer exists or no longer satisfies the trigger condition before posting.
4. When a session is reverted from `completed` back to `scheduled`, any pending `SESSION_DONE` outbox must be canceled/dead-lettered, and any already posted professional entry must be reversed with correct report semantics.

### Resolution: 2026-06-03

- Code changed so `SESSION_DONE` worker processing validates the source `session_logs` row still exists and has `status = completed` before posting a journal.
- Stale `SESSION_DONE` outbox events are now marked `DEAD` instead of retried into the ledger.
- `reverseJournalEntry` now keeps the original journal `POSTED` and posts a separate reversal entry, preventing reports from counting only the reversal.
- Production cleanup was applied while the May 2026 accounting period was `OPEN`:
  - Journal `626a19e4-72f1-4254-9e51-c18d9e30f471` marked `CANCELED`.
  - Outbox `1f940c26-53f6-47be-b8d1-f3480ae2fd67` marked `DEAD`.
  - Audit log inserted for the cleanup.
- Verification query after cleanup returned `3387 = 0`, `334 = 0`, and balance sheet `total_liabilities = 0` for tenant `Bella Spa Headquarter`.
