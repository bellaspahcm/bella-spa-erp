# Broader Any Gate Inventory

Ngay 2026-09-30

## Muc tieu

Inventory phan con lai cua `check:any-types` sau khi production-runtime residual da duoc seal theo governance boundary.

Khong sua 34 residual da classified:

- Logistics frozen / domain-contract.
- Real Estate contract drift.
- Finance/Core governance.

## Gate Snapshot

```text
npm run check:any-types
FAIL

Files scanned          2,785
Lines scanned        837,122
Total violations         606
Files with violations    144
```

## Boundary Math

```text
Total gate violations                  606
Production-runtime invariant residual  34
──────────────────────────────────────────
Outside production-runtime inventory    572
```

Note:

- `check:any-types` counts by regex pattern.
- A single source line can match more than one pattern.
- Production-runtime invariant residual remains the 34-line governance checkpoint already sealed.

## Classification

| Scope | Violations | Files | Classification | Action |
|---|---:|---:|---|---|
| tests/mock | 473 | 101 | Test/mock debt | Candidate in small batches if type-local |
| product-education | 40 | 11 | Education product/runtime | Requires Education constitution and product contract triage |
| services-healthcare | 16 | 4 | Healthcare service boundary | DEFER unless Healthcare contract evidence is opened |
| product-healthcare | 12 | 3 | Healthcare product boundary | DEFER unless Healthcare contract evidence is opened |
| module-real-estate | 9 | 7 | Real Estate module/UI/application | Candidate only for type-local UI; defer contract/data mismatches |
| services-intelligence | 8 | 2 | Intelligence services | Contract triage before fixing |
| app-education | 4 | 2 | Education app/UI | Requires Education constitution and product UI contract triage |
| components | 3 | 3 | Shared/customer intelligence UI tooltip | Candidate: type-local tooltip props |
| product-other | 1 | 1 | English Center repository | Contract triage before fixing |

Out-of-scope residual retained:

| Scope | Checker violations | Files | Status |
|---|---:|---:|---|
| production-residual-logistics | 34 | 7 | FROZEN / DEFER |
| production-residual-finance-core | 3 | 1 | GOVERNANCE / DEFER |
| production-residual-real-estate | 3 | 2 | CONTRACT DRIFT / DEFER |

## First Fixable Group

Selected batch:

```text
BROADER_ANY_BATCH_C1
components/customer-intelligence-tooltips
3 violations / 3 files
```

Reason:

- Same pattern: `CustomTooltip` props typed as `any`.
- Type-local UI payload shape is already derived from local chart data.
- No DB/RPC/generated contract.
- No Logistics frozen.
- No Finance/Core.
- No `next.config.ts`.
- No product domain semantics change.
