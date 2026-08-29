# Finance OS Completion Review — 2026-08-29

> Scope: Capability-level review after F5.6 Cash + Prepayment reconciliation. This is not a new Finance module spec.

## Current Status

| Capability | Status | Evidence / Note |
|---|---:|---|
| F1 Financial Ledger | 🟢 Done | Ledger verification and concurrency boundary previously green. |
| F1 Outbox | 🟢 Done | JSONB payload dispatcher fixed and verified. |
| F2 Cash Temporal Foundation | 🟢 Done / Frozen | `effective_date = F1.posted_at`; runtime tests green. |
| F2 Bank → GL Map | 🟢 Done | `F2_BANK_ACCOUNT_GL_MAP:v1` verified. |
| F3 AR Foundation | 🟢 Done | AR lifecycle and F5.5 reconciliation verified. |
| F4 AP Foundation | 🟢 Done | AP facts and baseline regression verified. |
| F4 Prepayment Facts | 🟢 Done | Fact stream exists; position contract now wraps aggregate reads. |
| F4 Prepayment GL Map | 🟢 Done | Tenant-configured `PREPAYMENT_CONTROL`; no platform fallback to `331P`/`242`. |
| F4 Prepayment Position | 🟢 Done | `F4_PREPAYMENT_POSITION:v1`; aggregate tenant/currency/as-of. |
| F5 AP Reconciliation | 🟢 Done | AP baseline verified. |
| F5.5 AR Reconciliation | 🟢 Done | AR regression verified. |
| F5.6 Cash Reconciliation | 🟢 Done | Cash + GL comparison via F2 contracts. |
| F5.6 Prepayment Reconciliation | 🟢 Done | Position + GL map + F1 GL comparison; zero/match/variance/config quarantine covered. |
| TT99 / TT133 Compliance | 🟡 Partial | Mapping and workflow policy gaps remain; see below. |
| Production Hardening | 🟡 Partial | Needs focused validation after TT99 gap decisions. |
| Full Finance E2E Scenario | 🔴 Missing | No single business journey proves AP + prepayment + payment + cash + GL + reconciliation end to end. |

## TT99 / TT133 Gap Triage

| Gap | Status | Classification | Next Action |
|---|---:|---|---|
| Refund/revenue deduction account policy (`521` vs debit-side `511`) | 🟡 Partial | Must-have before TT133 production claim | Confirm Bella accounting policy, then update event template, runtime posting, legacy sync, and reports consistently. |
| Service revenue account (`5111` vs TT133 service revenue `5113`) | 🟡 Partial | Must-have before TT133 production claim | Decide whether `5111` is Bella custom COA policy or migrate service revenue to `5113`. |
| Prepaid customer package policy (`131` vs `3387`) | 🟡 Partial | Must-have before production compliance claim | Define when customer money is advance receivable/customer advance vs unearned revenue across accounting periods. |
| Legacy sync posts confirmed revenue directly to `5111` | 🟡 Partial | Must-have if legacy sync remains active | Either disable/retire for production or align with runtime accounting policy. |
| Salary payment without matched salary accrual | 🟡 Partial | Must-have for payroll production scope | Enforce salary payment requires existing accrual or creates accrual atomically. |
| Commission accrual double-count risk | 🟡 Partial | Must-have for payroll production scope | Define one source of truth between session-level commission accrual and monthly salary accrual. |
| Expense salary account inconsistency (`642` vs `6421`) | 🟡 Partial | Must-have for TT133 clean COA | Normalize runtime/template/legacy mapping or document tenant-specific policy. |
| F1 `document_date` provenance for non-provable historical rows | 🟡 Partial | Production hardening / auditability | Keep non-provable rows out of temporal claims; add forward-only source document date capture for new postings. |
| 17 legacy/orphan prepayment facts in official test/pre-production DB | 🟡 Partial | Data-quality defect, not runner regression | Quarantine/cleanup policy needed before broad production validation; current contract correctly refuses to infer currency. |

## Minimum Production Candidate Path

1. **TT99 / TT133 policy decisions**
   - Resolve the must-have mapping/workflow decisions above.
   - Avoid global account hardcoding where tenant policy belongs in configuration.

2. **Single Finance E2E scenario**
   - Run one real journey: purchase/AP → prepayment → application/payment → cash movement → F1 GL → F5 reconciliation.
   - Expected evidence: AP, Cash, AR if involved, and Prepayment controls remain green or produce intentional variance/quarantine.

3. **Production hardening**
   - RLS / tenant isolation spot checks for F1–F5 contracts.
   - Migration provenance and rollback evidence.
   - Orphan data policy for official test/pre-production DB.
   - Build gate and targeted performance smoke for reconciliation functions.

4. **Full Finance regression**
   - F1 ledger + outbox.
   - F2 cash temporal/runtime.
   - F3 AR.
   - F4 AP/prepayment contracts.
   - F5 AP + F5.5 AR + F5.6 Cash/Prepayment.

## Recommendation

Do not open another Finance module yet. The next implementation should be selected from TT99 / TT133 must-have gaps, starting with the accounting policy decision that has the highest production impact for Bella's first target market.
