# ADR-021: F1 Additive Tenant Uniqueness Constraint (F2 Integration Compatibility)

## Status
PROPOSED (Pending Approval alongside F2.1 Gate)

## Context
The F1 Ledger Engine core tables (`finance_transactions` and `finance_accounts`) currently use globally unique UUIDs as primary keys.
F2 Cash & Treasury Engine requires database-level verification of tenant consistency: F2 cash movements must belong to the exact same `tenant_id` as the bank account and the F1 transaction.
To enforce this tenant isolation invariant at the PostgreSQL relational schema layer, composite foreign keys are required:
- `finance_cash_movements(tenant_id, f1_transaction_id)` references `finance_transactions(tenant_id, id)`.

However, PostgreSQL requires a unique constraint on the target columns of a foreign key reference. Therefore, a unique constraint `UNIQUE(tenant_id, id)` is required on `finance_transactions` and `finance_accounts`.

Since F1 is FROZEN, any modification to F1 tables must be treated as an exception under strict Change Control rules.

## Decision
We will apply an **F1 Freeze-preserving additive schema change** to add composite uniqueness constraints:
1. `ALTER TABLE public.finance_transactions ADD CONSTRAINT finance_tx_tenant_id_unique UNIQUE (tenant_id, id);`
2. `ALTER TABLE public.finance_accounts ADD CONSTRAINT finance_accounts_tenant_id_unique UNIQUE (tenant_id, id);`

## Consequences
- **Backward Compatibility:** 100% backward compatible. No existing columns are renamed, dropped, or modified.
- **Ledger Invariants:** Existing accounting invariants (e.g. double-entry, immutability) and RPC signatures are completely unaffected.
- **F2 Integrity:** F2 can now enforce database-level tenant consistency composite constraints.
- **Regression Testing:** Full F1 ledger verification tests and concurrency tests must be run immediately after applying this constraint to ensure zero impact.
