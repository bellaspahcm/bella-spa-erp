# Finance REVENUE_DEDUCTION / REFUND Audit — 2026-08-29

> Scope: Phase 2 Slice 1 audit only.
>
> Status: Audit complete. Runtime pilot implemented after audit; legacy template/sync/report cutover remains out of scope.

## Decision Boundary

`REVENUE_DEDUCTION` is the Finance semantic. Account codes such as `521`, `5113`, `5111`, or a tenant custom account are tenant accounting policy, not Bella platform truth.

Do not name the semantic `ACCOUNT_521`.

## Current Runtime Flow

```text
PATIENT_REFUND_ISSUED
        ↓
CASH_REFUND
        ↓
REVERSE_REVENUE + REDUCE_CASH
        ↓
DefaultCOAResolver
        ↓
REVERSE_REVENUE -> 4111 compatibility fallback
REDUCE_CASH -> 1111 compatibility fallback
        ↓
journal_entries / journal_lines
```

Findings:

- `PATIENT_REFUND_ISSUED` maps to `CASH_REFUND` in `src/platform/finance/resolvers/semantic-resolver.service.ts`.
- `CASH_REFUND` generates `REVERSE_REVENUE` debit and `REDUCE_CASH` credit in `src/platform/finance/resolvers/intent-generator.service.ts`.
- `DefaultCOAResolver` currently maps `REVERSE_REVENUE -> 4111` and `REDUCE_CASH -> 1111` as compatibility defaults.
- Before this slice, `FINANCE_ACCOUNTING_SEMANTIC_GL_MAP:v1` supported only `SERVICE_REVENUE`; `REVENUE_DEDUCTION` is now enabled through an additive contract migration.
- Additive migration `20260829101000_finance_revenue_deduction_semantic_mapping.sql` extends the same contract to support `REVENUE_DEDUCTION`.
- `DefaultCOAResolver` resolves `REVERSE_REVENUE` through tenant-configured `REVENUE_DEDUCTION` when configured.

## Current Legacy / Template Flow

```text
REFUND_TO_CUSTOMER
        ↓
accounting_event_templates
        ↓
DEBIT 5113 for revenue_reduction_amount
DEBIT 3387 for deferred_refund_amount
CREDIT 111_OR_112
```

Findings:

- `supabase/migrations/20260530050000_accounting_templates_and_readiness.sql` seeds `REFUND_TO_CUSTOMER` with debit-side `5113`.
- `supabase/migrations/20260603020000_tt133_refund_mapping.sql` explicitly states runtime refund posting should not use `521` for TT133 service revenue and updates refund template to debit `5113`.
- `supabase/migrations/20260603040000_branch_legacy_revenue_sync_by_type.sql` hardcodes refund sync as debit `5113`, credit payment account.
- Older report logic still treats `521%` as revenue deduction in P&L/reporting migrations.

## Current Reporting Flow

Reports still contain account-code assumptions:

- `521%` is treated as revenue deduction in older accounting/P&L report migrations.
- Dashboard sample/report display still contains fixed revenue account examples such as `5113`.

This means runtime/template/report semantics are not yet unified for tenant-configured `REVENUE_DEDUCTION`.

## Remote Configuration State

Official test/pre-production DB currently has no configured mappings for:

- `REVENUE_DEDUCTION`
- `REVENUE_DEDUCTION_REFUND`

Therefore, switching refunds to configuration-required behavior would be a breaking cutover right now.

Migration history now includes `20260829101000` for the additive runtime pilot contract extension.

## Classification

| Area | Current Behavior | Classification | Required Direction |
|---|---|---|---|
| Finance event runtime | `REVERSE_REVENUE -> 4111` | Compatibility fallback | Add tenant-configured `REVENUE_DEDUCTION` mapping before cutover. |
| Templates | `REFUND_TO_CUSTOMER -> debit 5113` | Hardcoded policy | Replace with semantic mapping during template cutover. |
| Legacy sync | Refund branch debits `5113` | Hardcoded policy | Resolve through semantic mapping or keep as explicit legacy compatibility until migrated. |
| Reports | `521%` revenue deduction grouping | Report dependency | Reports must resolve configured semantic groups before production compliance claim. |
| Outbox | `REFUND_ISSUED` / `REFUND` event categorization | Semantic carrier | No account-code issue found. |

## Recommended Implementation Slice

Reuse `FINANCE_ACCOUNTING_SEMANTIC_GL_MAP:v1`; do not create a new contract.

Add `REVENUE_DEDUCTION` as a supported semantic key:

```text
REVENUE_DEDUCTION
        ↓
Tenant Accounting Mapping
        ↓
Tenant A -> 521
Tenant B -> 5113 / 5111 debit-side
Tenant C -> custom account
```

Runtime pilot:

```text
CASH_REFUND
        ↓
REVERSE_REVENUE
        ↓
REVENUE_DEDUCTION mapping
        ↓
tenant-selected GL account
```

Compatibility rule:

```text
Unconfigured tenant
        ↓
legacy fallback
        ↓
4111
```

Keep fallback only during pilot/cutover. Do not describe it as Bella accounting policy.

## Minimum E2E Matrix

1. Tenant A maps `REVENUE_DEDUCTION -> 521`; refund posts debit to `521`.
2. Tenant B maps `REVENUE_DEDUCTION -> 5113`; refund posts debit to `5113`.
3. Unconfigured tenant uses compatibility fallback and still posts.
4. Same runtime path; only tenant mapping changes.

Implemented pilot evidence:

- Tenant A maps `REVENUE_DEDUCTION -> 521`; refund posts debit to `521`.
- Tenant B maps `REVENUE_DEDUCTION -> 5113`; refund posts debit to `5113`.
- Unconfigured tenant keeps legacy compatibility fallback.
- Verification: 3 suites / 14 tests PASS across contract, runtime resolver, and E2E.

## Stop Conditions

Stop before implementation if any of these require broader semantic decisions:

- Whether refund should reduce current-period revenue, contra-revenue, deferred revenue, or AR offset based on business lifecycle.
- Whether one refund event can split across `REVENUE_DEDUCTION`, `UNEARNED_REVENUE`, and `AR_OFFSET`.
- Whether report grouping should become semantic-driven in the same slice.

Those are separate policy/workflow decisions, not automatic consequences of this pilot.
