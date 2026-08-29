# TT99 / TT133 Accounting Policy Decision Record — 2026-08-29

> Status: Draft / Awaiting Human Accounting Approval
>
> Scope: Four accounting policy mappings required before changing runtime posting, event templates, legacy sync, or reports. This record does not implement code and does not create a new Finance module.

## Decisions Required

| Policy Area | Decision To Approve | Current Risk |
|---|---|---|
| Refund / revenue deduction | Use `521`, debit-side `511`, or tenant-configured revenue deduction account. | Runtime/templates/reports can disagree on TT133 treatment of refunds and discounts. |
| Service revenue | Keep Bella custom `5111`, standardize service revenue to `5113`, or make service revenue account tenant-configured. | Service revenue recognition may be correct operationally but not consistently tied to TT133 account policy. |
| Customer prepaid service package | Use `131`, `3387`, or tenant-configured mapping by business event and service period. | Prepaid package money can represent different accounting meanings depending on whether it is customer advance, receivable offset, or unearned revenue across periods. |
| Salary expense | Use `642`, `6421`, or tenant-configured salary expense account. | Runtime posting, templates, and legacy sync can produce inconsistent salary expense classification. |

## Implementation Gate

No implementation should start until this record is approved.

Approved policy must be applied as one semantic chain:

```text
Accounting Policy
        ↓
Tenant / COA Configuration
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
- Do not claim TT99 / TT133 production compliance until policy, implementation, and regression evidence are aligned.

## Approval Result

Pending.
