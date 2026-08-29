# TT99 / TT133 Accounting Configuration Decision Record — 2026-08-29

> Status: Draft / Awaiting Human Accounting Approval
>
> Scope: Define the tenant-configurable accounting semantic mappings Bella needs before changing runtime posting, event templates, legacy sync, or reports. This record does not implement code and does not create a new Finance module.

## Architecture Decision

Bella standardizes financial semantics and business operations. Tenants configure which GL account in their Chart of Accounts satisfies each semantic.

```text
Business Semantic
        ↓
Tenant Accounting Mapping
        ↓
GL Account in tenant COA
        ↓
Posting / Reporting / Reconciliation
```

Bella must not turn a single account code such as `521`, `5113`, `3387`, `131`, `642`, or `6421` into platform-wide truth when that account belongs to tenant accounting policy.

## Semantic Keys To Confirm

| Semantic Key | Purpose | Current Account-Code Debate Replaced |
|---|---|---|
| `REVENUE_DEDUCTION` | Refunds, discounts, and revenue reductions. | `521` vs debit-side `511` |
| `SERVICE_REVENUE` | Revenue recognized for services. | `5111` custom vs `5113` |
| `GOODS_REVENUE` | Revenue recognized for goods/products. | `5111` / `5112` / tenant-specific COA |
| `CUSTOMER_ADVANCE` | Customer money received before final delivery when treated as customer advance / liability or AR offset. | `131` vs tenant policy |
| `UNEARNED_REVENUE` | Revenue received before performance obligation is satisfied across service periods. | `3387` vs tenant policy |
| `AR_OFFSET` | Customer prepayment applied against receivable balance. | `131` handling |
| `SALARY_EXPENSE` | Salary/payroll expense classification. | `642` vs `6421` |
| `COGS` | Cost of goods/services sold where applicable. | `632` vs tenant-specific COA |
| `AR_CONTROL` | Accounts receivable control account. | Existing `131` fallback/policy |
| `AP_CONTROL` | Accounts payable control account. | Existing `331` fallback/policy |
| `CASH_CONTROL` / bank-account map | Cash/bank GL target. | Existing cash account assumptions |
| `PREPAYMENT_CONTROL` | Vendor prepayment GL target. | Already implemented as tenant-configured mapping |

## Immediate Gate

Before implementation, audit all hardcoded account usage in Finance OS and classify each usage:

| Classification | Meaning |
|---|---|
| 🔴 Must be configurable | Account represents tenant accounting policy. |
| 🟡 Default with override | A sensible country/profile default can exist, but tenant override is required. |
| 🟢 System invariant | Account behavior is a true platform invariant or regulatory invariant for the selected profile. |

Only production-critical mappings from this audit should be implemented first.

## Implementation Chain

Approved semantics must be applied as one chain:

```text
Accounting Configuration
        ↓
Tenant / COA Mapping
        ↓
Event Templates
        ↓
Runtime Posting
        ↓
Legacy Sync
        ↓
Reports
        ↓
Regression
```

## Non-Goals

- Do not open F6.
- Do not create a universal accounting rules engine.
- Do not hardcode account policy globally when tenant configuration is the correct boundary.
- Do not patch runtime, legacy sync, or reports independently with conflicting semantics.
- Do not claim TT99 / TT133 production compliance until configuration, implementation, and regression evidence are aligned.

## Approval Result

Pending.
