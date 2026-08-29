# Finance OS Compliance + Production Validation Review — 2026-08-29

> Status: Review checkpoint after Finance lifecycle E2E `1da4fce4`.
>
> Scope: Identify the next TT99 / TT133 and production-validation gaps without opening F6, adding new engines, or hardcoding tenant accounting policy into Bella Platform Core.

## Current Proven Baseline

| Area | Status | Evidence |
|---|---|---|
| F1 Ledger + Outbox | Green | Ledger verification, concurrency, JSONB outbox dispatcher fix |
| F2 Cash + Bank to GL | Green / frozen | Temporal cash foundation, `effective_date = F1.posted_at`, `F2_BANK_ACCOUNT_GL_MAP:v1` |
| F4 AP + Prepayment | Green | Prepayment facts, `F4_PREPAYMENT_GL_MAP:v1`, `F4_PREPAYMENT_POSITION:v1` |
| F5 / F5.5 / F5.6 | Green | AP, AR, cash, and prepayment reconciliation verified |
| Accounting Semantic Mapping | Green | `SERVICE_REVENUE`, `REVENUE_DEDUCTION`, `GOODS_REVENUE` |
| Accounting Configuration UI | Green | Accountant selects only tenant COA accounts, with effective date |
| Finance Lifecycle E2E | Green | `Business event -> tenant mapping -> GL/F1 -> F2/F4 -> F5.6 reconciliation` |

## Architecture Rule

Accounting account codes are tenant policy, not Bella financial semantics.

Bella should standardize:

```text
Business semantic
        ->
Tenant accounting configuration
        ->
Tenant COA account
        ->
Posting / reporting / reconciliation
```

Bella should not globally hardcode account codes such as `5113`, `521`, `3387`, `6421`, `331`, or `242` unless the code is explicitly part of a selected regulatory/reporting profile and remains tenant-overridable where business policy requires it.

## TT99 / TT133 Gap Inventory

| Gap | Current observation | Classification | Next action |
|---|---|---|---|
| Revenue mapping | `SERVICE_REVENUE`, `REVENUE_DEDUCTION`, and `GOODS_REVENUE` are proven through tenant semantic mapping. | Green | Keep as baseline; do not add more revenue semantics until required. |
| Legacy revenue fallback | `DefaultCOAResolver` still falls back to `4111` for unconfigured revenue intents. | Yellow / compatibility | Keep during cutover; do not treat as Bella accounting policy. Later add onboarding guard for new tenants. |
| AR / cash / AP default intents | Resolver still has fallback accounts such as `1311`, `1111`, `3311`. Cash and prepayment reconciliation now use dedicated contracts/mappings, but event posting still has compatibility defaults. | Yellow | Audit per intent before changing. Prefer extending semantic mapping only where production correctness requires tenant choice. |
| Inventory / COGS | Resolver defaults include `1521` and `6211`; older report/templates use `632`/inventory prefixes. | Yellow / policy gap | Defer until inventory/goods-cost production scenario is required. Do not mix `6211` and `632` silently. |
| Salary expense | Accounting templates contain salary/commission postings with `6421`/`334`; payroll workflow exists outside the proven accounting semantic mapping foundation. | Yellow / correctness risk | Handle after revenue foundation: model `SALARY_EXPENSE` and salary liability/payment workflow as tenant-configured semantics before runtime/report changes. |
| Customer advance / unearned revenue | Template history includes `3387`; policy record lists `CUSTOMER_ADVANCE`, `UNEARNED_REVENUE`, and `AR_OFFSET` as separate semantic questions. | Yellow / semantic gate | Do not collapse `131` and `3387`. Require business-policy gate before implementation. |
| Reports | Legacy SQL reports classify by account-code prefixes (`511%`, `521%`, `632%`, `642%`, `3387`, etc.). | Yellow / reporting-profile gap | Treat these as report presentation rules, not posting semantics. Later align reports with selected regulatory profile plus tenant mapping. |
| Document date provenance | TT99 matrix defines `document_date`; Phase 4 investigations found many legacy/test records are `UNKNOWABLE`, with explicit recommendation not to use `posted_at` or `created_at` as fake document date. | Yellow / production data quality | Create a cleanup/provenance gate before production validation; preserve unknowns honestly. |
| Full type-check | `npm run type-check` has not completed in prior runs. | Yellow / quality gate | Diagnose runtime duration and errors in production hardening. Do not mark type safety green yet. |

## Production Validation Gates

### Gate 1 — Compliance Mapping

- Confirm which additional semantic mappings are production-critical.
- Extend `FINANCE_ACCOUNTING_SEMANTIC_GL_MAP:v1` only for those semantics.
- Keep compatibility fallbacks only as explicit migration/cutover paths.

### Gate 2 — Document Date Provenance

- Separate real data from synthetic/test artifacts.
- Backfill only `PROVABLE` source dates.
- Preserve `UNKNOWABLE` records with explicit classification.
- Do not substitute `posted_at` or `created_at` for source document date.

### Gate 3 — Reporting Alignment

- Decide whether existing prefix-based SQL reports represent TT99/TT133 profile presentation rules.
- Ensure posting semantics remain tenant-configured even if report rows are grouped by regulatory account class.
- Add tests only for production-critical statements.

### Gate 4 — Type-check + Build

- Diagnose why full `npm run type-check` takes longer than the working timeout.
- Produce either `PASS` evidence or a concrete failure list and patch.
- Run production build after type-check status is known.

### Gate 5 — Full Finance Regression

Run the Finance boundary as one final production-candidate gate:

```text
F1 -> F2 -> F3 -> F4 -> F5 -> F5.5 -> F5.6
        +
Accounting Configuration
        +
Finance Lifecycle E2E
        +
Architecture Guard
```

## Recommended Next Commit

The next code-bearing commit should be one of:

1. A narrow TT99 production-critical semantic mapping, if the business requirement is clear.
2. A document-date provenance cleanup/proof gate, if production validation is blocked by legacy/test artifacts.
3. A type-check diagnosis/fix, if the team wants to clear the quality gate before further compliance work.

Do not open F6, add a universal accounting engine, or broaden Finance feature scope before these validation gates are closed.
