# Architecture Gate Result: Hospital Reconciliation Read-Back Trace

Date: 2026-10-08

## Status

```text
HOSPITAL_GO_LIVE_BUSINESS_CHAIN = PROVEN_FOR_CODE_RUNTIME_SCOPE
HOSPITAL_REAL_DB_RLS_PROOF = PASS
HOSPITAL_BROWSER_E2E_PROOF = PASS_FOR_READ_ONLY_AUTHENTICATED_ROUTE_SCOPE
HOSPITAL_FINANCE_WORKER_EXECUTION_PROOF = PASS
HOSPITAL_RECONCILIATION_READ_BACK_PROOF = BLOCKED_NOT_VERIFIED
GO_LIVE_DECISION = NO
```

## Scope

This trace determines whether Hospital Finance worker output is visible through the existing F5 reconciliation read-back contract.

This is not a Hospital product runtime gap. It is a Finance OS / F5 persistence-alignment decision boundary.

## Root Cause

```text
Hospital Finance worker proof
  -> DefaultFinanceKernelClient
  -> journal_entries
  -> journal_lines
  -> finance_transaction_metadata

F5 read contract
  -> finance_journal_entries_as_of(...)
  -> finance_transactions
  -> finance_transaction_lines

Result:
  Hospital Finance worker postings are real ledger rows,
  but they are not proven visible to F5 reconciliation read-back.
```

## Evidence

```text
src/platform/finance/resolvers/kernel-client.service.ts
  contains .from('journal_entries')
  contains .from('journal_lines')
  contains finance_transaction_metadata

supabase/migrations/20261002030000_reapply_f5_f1_read_contract_source_id_cast.sql
  defines finance_journal_entries_as_of(...)
  reads FROM public.finance_transactions ft
  joins public.finance_transaction_lines ftl

docs/architecture/ARCHITECTURE_GATE_RESULT_HOSPITAL_FINANCE_WORKER_EXECUTION_PROOF_2026_10_08.md
  records finance worker persistence to journal_entries / journal_lines
  keeps RECONCILIATION_READ_BACK = NOT_PROVEN
```

## Classification

```text
FINANCE_WORKER_EXECUTION = PASS
REAL_DB_LEDGER_PERSISTENCE = PASS_FOR_HOSPITAL_CHARGE_AND_PAYMENT_SCOPE
F5_RECONCILIATION_READ_BACK = NOT_PROVEN

ROOT_CAUSE = FINANCE_LEDGER_PERSISTENCE_TARGET_MISMATCH
OWNER = FINANCE OS / F1-F5 ARCHITECTURE
HOSPITAL_CODE_FIX = NOT_INDICATED
SCHEMA_MUTATION = NOT_AUTHORIZED
F5_MUTATION = NOT_AUTHORIZED
```

## Boundary

Do not fix this by:

```text
Hospital -> direct finance_transactions write
Hospital -> direct F5 tables
Hospital -> custom reconciliation adapter
Hospital -> duplicate ledger posting
Hospital -> bypass Finance OS
```

Any implementation must be approved as a Finance/F5 architecture decision, because it touches the canonical ledger/read-back boundary.

## Verification Evidence

Focused trace:

```text
npx jest src/products/bella-hospital/__tests__/hospital-reconciliation-read-back-trace.test.ts --runInBand
= PASS
```

## Canonical Status

```text
HOSPITAL_RECONCILIATION_READ_BACK_TRACE = PASS
HOSPITAL_RECONCILIATION_READ_BACK_PROOF = BLOCKED_NOT_VERIFIED
HOSPITAL_GO_LIVE_BUSINESS_CHAIN = NOT_PROVEN_FOR_PRODUCTION
PRODUCTION_INTEGRITY = NOT_PROVEN
GO_LIVE_DECISION = NO
```

## Next Required Capability

```text
FINANCE_LEDGER_PERSISTENCE_TARGET_DECISION
```

Required human/architecture decision:

```text
Should FinanceEventHandler / DefaultFinanceKernelClient persist Hospital Finance events into the canonical F1 tables consumed by F5,
or should F5 read contracts be extended to consume the existing journal_entries / journal_lines path?
```

No Hospital-side workaround is authorized.
