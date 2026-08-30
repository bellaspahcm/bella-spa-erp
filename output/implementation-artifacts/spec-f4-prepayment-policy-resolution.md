---
title: 'F4 Prepayment Policy Resolution Closure'
type: 'feature'
created: '2026-08-30'
status: 'done'
baseline_commit: '82f0d5a778e80a4d05e458fb7ca642ac690635f4'
context:
  - 'docs/architecture/frozen/F4_CONTRACT.md'
  - 'docs/architecture/F5_6_DOMAIN_BOUNDARY_VERIFICATION.md'
  - 'docs/architecture/F5_6_SEMANTIC_CORRECTION_2026_08_23.md'
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** F4 vendor prepayment lifecycle posting still emits hardcoded/symbolic account codes (`PREPAYMENT_ASSET`, `331`) in the active AP/prepayment RPC path. That violates the target Finance OS boundary: F4 owns financial lifecycle mechanics, while enterprise accounting policy owns account treatment.

**Approach:** Add a minimal tenant + event + effective-date policy-resolution boundary for F4 prepayment postings, then replace only the lifecycle posting account literals with resolved accounts before calling F1. Keep F4 facts, locks, idempotency, same-vendor validation, F1 posting authority, and F5.6 reconciliation contracts intact.

## Boundaries & Constraints

**Always:** F4 must own event type, amount, lifecycle, application/refund semantics, invariants, idempotency, and append-only facts. Account codes in F4 lifecycle posting must be outputs of policy resolution, not Finance Kernel invariants. Resolution must depend at minimum on `tenant_id`, `event_type`, and `effective_date`. F1 remains the immutable ledger posting authority. Additive migrations only.

**Ask First:** Ask before changing F5.6 reconciliation logic, replacing F1 posting APIs, introducing multi-book accounting, changing frozen F4 public RPC signatures, or making a regulatory accounting decision not already represented in policy/config.

**Never:** Do not hardcode `331`, `242`, `331P`, `PREPAYMENT_ASSET`, or similar codes as Bella Kernel truth in the lifecycle posting path. Do not build a generic accounting rules engine. Do not rewrite F5.6 Cash + Prepayment reconciliation. Do not touch unrelated Spa, Babycare, Healthcare, Logistics, or diagnostic harness files.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Record vendor prepayment | Tenant has active policy mapping for `VENDOR_PREPAYMENT_RECORDED` at effective date | F4 posts debit to resolved prepayment/AP advance account and credit to supplied bank account id, then appends `PREPAYMENT_RECORDED` | Existing amount, auth, idempotency, and bank validation errors remain unchanged |
| Apply vendor prepayment | Tenant has active policy mapping for `VENDOR_PREPAYMENT_APPLIED` at effective date | F4 posts debit/credit to resolved accounts, preserves same-vendor and available-balance guards, then appends `PREPAYMENT_APPLIED` | Missing mapping or inactive account raises explicit policy-resolution error before F1 posting |
| Missing policy mapping | No active mapping for tenant + event + effective date | No F1 transaction or F4 fact is created | Raise deterministic `F4_PREPAYMENT_POLICY_MAPPING_NOT_FOUND` |
| Effective-date rollover | Two mappings exist for different date windows | F4 resolves the mapping whose validity contains `effective_date` | Overlap or inactive account fails deterministically |

</frozen-after-approval>

## Code Map

- `supabase/migrations/20260818000000_finance_ap_engine_v1.sql` -- Active F4 AP/prepayment RPC path; currently emits `PREPAYMENT_ASSET` and `331`.
- `supabase/migrations/20260820010000_f5_prepayment_reconciliation.sql` -- F5.6 prepayment reconciliation; must remain unchanged.
- `supabase/migrations/20260819030000_f5_registry_and_contracts.sql` -- Existing coarse control-account mapping, not sufficient for event-specific lifecycle posting.
- `src/platform/finance/__tests__/f4-proof-runner.test.ts` -- Existing F4 proof harness uses temp tables and hand-posted F1 transactions; add real RPC evidence rather than relying only on fixture postings.

## Tasks & Acceptance

**Execution:**
- [x] `supabase/migrations/20260818000000_finance_ap_engine_v1.sql` -- Add minimal `finance_prepayment_posting_policy_mappings` table and `finance_resolve_prepayment_posting_accounts` resolver -- Provides tenant/effective-date/event mapping without a generic rules engine.
- [x] `supabase/migrations/20260818000000_finance_ap_engine_v1.sql` -- Patch `finance_record_prepayment` and `finance_apply_prepayment` to resolve account codes before F1 posting -- Removes account-code literals from lifecycle posting mechanics.
- [x] `src/platform/finance/__tests__/f4-prepayment-policy-resolution.test.ts` -- Add static boundary verification for record/apply policy resolution and missing F5.6 rewrite -- Locks the architecture boundary while DB runtime evidence remains environment-blocked.

**Acceptance Criteria:**
- Given a tenant policy mapping for `VENDOR_PREPAYMENT_RECORDED`, when `finance_record_prepayment` runs, then the F1 transaction uses the resolved debit account and the supplied bank account while appending a `PREPAYMENT_RECORDED` fact.
- Given a tenant policy mapping for `VENDOR_PREPAYMENT_APPLIED`, when `finance_apply_prepayment` runs, then the F1 transaction uses resolved debit/credit accounts and preserves all F4 prepayment balance and same-vendor guards.
- Given no active mapping for a lifecycle event/date, when the RPC is called, then no F1 posting/fact is created and a deterministic policy mapping error is raised.
- Given the implementation diff, when F5.6 files are reviewed, then `20260820010000_f5_prepayment_reconciliation.sql` is unchanged.

## Design Notes

The minimal mapping table is scoped to F4 vendor prepayment lifecycle events only. It is not a global accounting rule engine; it is the first concrete policy-resolution boundary proving that account treatment is external to F4 mechanics.

## Verification

**Commands:**
- `npm test -- src/platform/finance/__tests__/f4-proof-runner.test.ts --runInBand` -- expected: F4 proof runner passes with real RPC policy-resolution cases.
- `git diff -- supabase/migrations/20260820010000_f5_prepayment_reconciliation.sql` -- expected: no diff.
- `npm run healthcare:guard` -- expected: Architecture Guard passes.
- `npm run healthcare:verify` -- expected: Platform verification passes, if environment dependencies are available.

**Observed 2026-08-30:**
- Static PowerShell boundary check for `finance_record_prepayment` and `finance_apply_prepayment`: PASS.
- `git diff -- supabase/migrations/20260820010000_f5_prepayment_reconciliation.sql`: PASS, no diff.
- `npm run healthcare:guard`: PASS.
- `npm test -- src/platform/finance/__tests__/f4-prepayment-policy-resolution.test.ts --runInBand`: BLOCKED, local `node_modules` missing and `jest` not available.
- `npx jest src/platform/finance/__tests__/f4-prepayment-policy-resolution.test.ts --runInBand`: BLOCKED, `jest.config.ts` imports `next`, but `next` is not installed in this worktree.
- Real DB/RPC verification: BLOCKED, no `.env` and no `psql` on PATH in this worktree.

**Review disposition 2026-08-31:**
- Fixed: new policy mapping RLS no longer allows null tenant context to broaden access.
- Fixed: active overlapping policy windows are rejected at write time by `trg_prevent_prepayment_policy_overlap`.
- Fixed: `VENDOR_PREPAYMENT_RECORDED` rejects configured `credit_account_code` instead of silently ignoring it; bank credit remains the supplied F4 input account.
- Confirmed: `finance_accounts.type` is the active F1 schema column; helper functions were aligned with that schema.
- Deferred evidence: real DB/RPC lifecycle proof remains required before F4 freeze because this worktree lacks database/runtime dependencies.
- Residual design risk: F4 public RPCs do not accept a separate business effective date; current policy resolution uses posting execution time (`NOW()`). Changing the frozen public RPC signature requires Human Architect approval.

**Observed 2026-08-31:**
- Static PowerShell boundary check for `finance_record_prepayment` and `finance_apply_prepayment`: PASS.
- `git diff -- supabase/migrations/20260820010000_f5_prepayment_reconciliation.sql`: PASS, no diff.
- `git diff --check`: PASS, no whitespace errors.
- `npm run healthcare:guard`: PASS.

## Suggested Review Order

**Policy Boundary**

- Start here: F4 policy table proves treatment is external to lifecycle mechanics.
  [`20260818000000_finance_ap_engine_v1.sql:338`](../../supabase/migrations/20260818000000_finance_ap_engine_v1.sql#L338)

- Null-tenant RLS bypass is closed for the new mapping table.
  [`20260818000000_finance_ap_engine_v1.sql:365`](../../supabase/migrations/20260818000000_finance_ap_engine_v1.sql#L365)

- Overlapping effective-date windows fail before runtime posting.
  [`20260818000000_finance_ap_engine_v1.sql:371`](../../supabase/migrations/20260818000000_finance_ap_engine_v1.sql#L371)

**Resolver**

- Resolver enforces tenant, event type, and effective date.
  [`20260818000000_finance_ap_engine_v1.sql:967`](../../supabase/migrations/20260818000000_finance_ap_engine_v1.sql#L967)

- Missing or ambiguous policy mappings raise deterministic F4 errors.
  [`20260818000000_finance_ap_engine_v1.sql:1003`](../../supabase/migrations/20260818000000_finance_ap_engine_v1.sql#L1003)

**Lifecycle Posting**

- Record prepayment resolves debit account before F1 posting.
  [`20260818000000_finance_ap_engine_v1.sql:1095`](../../supabase/migrations/20260818000000_finance_ap_engine_v1.sql#L1095)

- Record prepayment rejects unused configured credit treatment.
  [`20260818000000_finance_ap_engine_v1.sql:1102`](../../supabase/migrations/20260818000000_finance_ap_engine_v1.sql#L1102)

- Apply prepayment resolves both debit and credit accounts.
  [`20260818000000_finance_ap_engine_v1.sql:1240`](../../supabase/migrations/20260818000000_finance_ap_engine_v1.sql#L1240)

**Tests**

- Static guard locks lifecycle resolver usage and F5.6 no-rewrite.
  [`f4-prepayment-policy-resolution.test.ts:38`](../../src/platform/finance/__tests__/f4-prepayment-policy-resolution.test.ts#L38)
