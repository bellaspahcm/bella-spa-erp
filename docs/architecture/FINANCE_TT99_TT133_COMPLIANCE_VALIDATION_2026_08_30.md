# Finance OS TT99 / TT133 Compliance Validation — 2026-08-30

> Status: Compliance validation checkpoint
>
> Scope: Validate the current Finance OS implementation against the approved architecture boundary after Core Functional Validation. This record does not open F6, does not create a new accounting engine, and does not claim full production compliance.

## Executive Result

Finance OS has completed core functional validation for the current boundary. TT99 / TT133 compliance is **partial but controlled**: the core ledger, date provenance, reconciliation, and tenant accounting configuration foundations are proven, while several production compliance gaps remain intentionally outside the current implementation claim.

```text
Functional Finance Core        GREEN
Architecture / Contract Core   GREEN
Full Finance Regression        GREEN
TT99 / TT133 Compliance        PARTIAL / CONTROLLED
Production Candidate           NOT YET
```

## Current Evidence

| Gate | Evidence | Status |
|---|---:|---|
| Full Finance Regression | 52 suites / 466 tests: 464 passed, 2 skipped | PASS |
| Architecture Guard | `npm run arch:guard` | PASS |
| Document-date provenance | Integration test verifies LedgerService -> RPC -> `finance_transactions.document_date` -> outbox v1/v2 | PASS |
| Accounting semantic mapping | `SERVICE_REVENUE`, `REVENUE_DEDUCTION`, `GOODS_REVENUE` through tenant COA mapping | PASS |
| Accounting configuration hardening | permissions, tenant isolation, effective dating, atomic save | PASS |
| Missing-mapping onboarding policy | strict resolver mode returns `CONFIGURATION_REQUIRED`; legacy fallback remains compatibility-only | PASS |
| Finance lifecycle E2E | Business operation -> accounting config -> F1/F2/F4 -> reconciliation | PASS |
| Full repository type-check | compiler graph still does not finish in the current time budget | NOT VERIFIED |

## Validated Capabilities

### 1. Ledger And Double Entry

F1 Financial Ledger enforces the core accounting properties required by the current Finance OS boundary:

- posted transaction immutability;
- balanced debit / credit lines;
- tenant-scoped ledger operations;
- transactional outbox emission;
- idempotency and request-hash protection;
- document-date propagation for new transactions.

Status: **Validated for current scope**.

### 2. Document Date Provenance

New F1 transactions can carry explicit `document_date` and propagate it through:

```text
LedgerService
  -> finance_post_transaction
  -> finance_transactions.document_date
  -> finance_outbox_events payload v1/v2
```

Historical rows without authoritative source evidence must remain honest:

- do not backfill from `posted_at`;
- do not backfill from `created_at`;
- do not invent document dates to satisfy a reporting percentage;
- preserve `NULL` where provenance is unknowable.

Status: **Validated for new transactions; historical provenance cleanup remains separate data governance work**.

### 3. Temporal Accounting Foundation

F2 cash projection is runtime-verified with `effective_date` populated from the approved F2 temporal contract. F5.6 reconciliation consumes contract surfaces rather than direct internal table access.

Status: **Validated for current reconciliation boundary**.

### 4. Tenant Accounting Configuration

Bella now treats account codes as tenant accounting policy rather than platform financial semantics.

Validated semantic mappings:

| Semantic | Configurable Accounts Proven | Status |
|---|---|---|
| `SERVICE_REVENUE` | e.g. tenant A -> `5113`, tenant B -> `5111` | PROVEN |
| `REVENUE_DEDUCTION` | e.g. tenant A -> `521`, tenant B -> debit-side revenue account | PROVEN |
| `GOODS_REVENUE` | e.g. tenant A -> `5112`, tenant B -> `5111` | PROVEN |
| `PREPAYMENT_CONTROL` | tenant-configured control account with effective dating | PROVEN |

Important rule:

```text
Accounting account codes are tenant policy,
not Bella financial semantics.
```

New production onboarding can require explicit semantic-to-GL configuration. In that mode, a tenant missing `SERVICE_REVENUE`, `REVENUE_DEDUCTION`, or `GOODS_REVENUE` mapping receives `CONFIGURATION_REQUIRED` instead of silently using the legacy fallback. Legacy fallback remains available only as a cutover compatibility path for existing tenants.

Status: **Backend contract, runtime resolver, E2E, MVP UI, and missing-mapping onboarding policy are proven for the current semantic set**.

### 5. Reconciliation

F5/F5.5/F5.6 now validates:

- AP GL balance;
- AR GL balance;
- Cash GL balance through F2 contracts;
- Vendor prepayment GL balance through F4 contracts and tenant-configured control mapping.

Current skipped/future controls must not be treated as implemented:

- `PERIOD_INTEGRITY`;
- duplicate-effect taxonomy beyond current AP balance variance detection.

Status: **Validated for implemented reconciliation controls only**.

## Compliance Gap Register

| Gap | Current Status | Production Decision |
|---|---|---|
| Full TT99 / TT133 production claim | Not complete | Do not claim until compliance hardening and production validation pass |
| `PERIOD_INTEGRITY` control | Registered/future scope, not implemented | Keep out of current claim; implement only if production requirement |
| Source-currency / FX integrity for AP balance | AP balance currently compares functional payable balance | Validate under FX / TT99 hardening, not AP_GL_BALANCE |
| Orphan GL-without-subledger detection | Not claimed by current AP_GL_BALANCE | Treat as separate hardening/data-quality control |
| Duplicate authoritative-effect taxonomy | Current AP balance detects variance, not dedicated duplicate taxonomy | Separate hardening control if needed |
| Salary accounting policy | `6421` exists in current TT133-style path, but not yet tenant-configurable semantic | Candidate next production-critical semantic |
| COGS / materials policy | Existing runtime has `632` / COGS-like paths, not yet in semantic mapping UI | Candidate after salary or when product/inventory production requires it |
| Customer advance vs unearned revenue | Current runtime uses `3387` for package/unearned revenue and supports receivable split | Needs tenant-policy validation before broader production claim |
| Legacy compatibility fallback | Resolver keeps compatibility fallback for unconfigured legacy tenants, but strict onboarding mode returns `CONFIGURATION_REQUIRED` | Accept during migration; use explicit-config mode for new production onboarding |
| Full repository type-check | Not verified | Separate TypeScript compiler graph optimization task |

## TT99 / TT133 Interpretation Boundary

This checkpoint validates that Bella can support TT99 / TT133-style policies through tenant configuration. It does **not** mean Bella hardcodes one universal Vietnamese chart of accounts into Platform Core.

Correct model:

```text
Business Semantic
  -> Tenant Accounting Configuration
  -> Tenant Chart of Accounts
  -> Runtime Posting
  -> Reports / Reconciliation
```

Incorrect model:

```text
Bella Platform Core
  -> universal account code for every tenant
```

## Immediate Next Work

No new Finance module should be opened. The next compliance work should be selected from production-significant gaps only:

1. Validate whether `SALARY_EXPENSE` must become tenant-configurable before production.
2. Validate whether `COGS` / materials expense must become tenant-configurable before production.
3. Decide whether `PERIOD_INTEGRITY`, orphan GL detection, FX/source-currency integrity, and duplicate-effect taxonomy are required for the first production candidate.
4. Keep full repository type-check as a separate technical gate; do not solve it by excluding more production code.

## Checkpoint Statement

Finance OS has completed **Core Functional Validation** and has a controlled TT99 / TT133 compliance path. The system is ready to continue into production hardening, but it is not yet a Finance OS Production Candidate until compliance gap decisions, production validation, and full hardening evidence are complete.
