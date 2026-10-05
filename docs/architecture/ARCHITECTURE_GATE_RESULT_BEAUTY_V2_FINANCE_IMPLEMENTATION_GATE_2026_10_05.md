# Architecture Gate Result - Beauty V2 Finance Implementation Gate

Status: PASS_REAL_DB_PROVEN
Date: 2026-10-05
Scope: Minimal `SALARY_PAID` branch propagation only; no Finance OS architecture change, no migration, no F5/control expansion, no Chain, Attendance, Payroll, Commission, Governance, or H8 session changes.

## Gate Result

```yaml
Chain: SEALED_UNCHANGED
Attendance: SEALED_PROVEN_UNCHANGED
Payroll: SEALED_PROVEN_UNCHANGED
Commission: SEALED_PROVEN_UNCHANGED
Finance_Mapping_Contract: SEALED
Finance_Runtime_Implementation: REAL_DB_PROVEN
Finance_Runtime_Mapping: REAL_DB_PROVEN
Finance_Branch_Propagation: REAL_DB_PROVEN
Finance_Tenant_Boundary: REAL_DB_PROVEN
Finance_Real_DB_Proof: PASS
Current_Proof_Cleanup: 0_RESIDUAL
Beauty_V2_Go_Live: NOT_READY
```

## Problem

`salary_records.branch_id` is proven upstream, but the current salary payment Finance producer does not propagate it into `SALARY_PAID`.

```text
salary_records.branch_id
        X
SALARY_PAID.payload.branchId
```

Current gap:

```text
buildSalaryPaidOutboxEvent(...)
        -> payload.branchId = tenantId
```

## Truth and Source of Truth

| Truth | Source |
|---|---|
| Platform Branch identity | `org_units.id` proven by Platform Chain |
| Payroll salary branch | `salary_records.branch_id` |
| Finance mapping contract | `docs/architecture/BEAUTY_V2_FINANCE_MAPPING_CONTRACT_V1.md` |
| Finance receiver branch support | `RevenueRecognitionService.handleSalaryPaid(branchId)` and `journal_lines.branch_id` |

## Ownership

| Data / capability | Owner | Change authority |
|---|---|---|
| Chain / Branch / Membership / Authorization | Platform Chain | Consume only |
| Salary result branch | Payroll / HR Salary | Consume only |
| Accounting outbox producer payload | Beauty-to-Finance producer boundary | Minimal implementation authorized |
| Accounting worker and journal persistence | Finance OS | Consume existing branch payload only |

## Canonical Contract

Finance V1 must consume the branch-proven salary record:

```text
salary_records.branch_id
        -> accounting_outbox.payload.branchId
        -> RevenueRecognitionService.handleSalaryPaid(branchId)
        -> journal_lines.branch_id
```

Invalid branch sources:

```text
tenantId
current membership
request context
ktv_id
salary record id alone
```

## Minimal Implementation Plan

1. Select `branch_id` when loading `salary_records` during salary expense confirmation.
2. Reject `salary_records.branch_id = NULL` before `SALARY_PAID` outbox enqueue.
3. Add required `branchId` input to `buildSalaryPaidOutboxEvent`.
4. Set `SALARY_PAID.payload.branchId = salary_records.branch_id`.
5. Add focused unit proof for allow/null/cross-tenant producer behavior and worker branch pass-through if needed.
6. Run focused tests, changed TypeScript, diff check.
7. Run Real DB proof only after unit/static proof passes.

## Non-Goals

```text
No Finance OS redesign.
No new accounting legal mapping.
No F5/control proof.
No migration.
No Payroll recalculation change.
No Commission change.
No Chain/Attendance change.
No H8 session Finance change.
No historical backfill.
```

## Verification Plan

```yaml
Unit_Proof:
  - salary record Branch A enqueues SALARY_PAID payload.branchId = Branch A
  - payload.branchId does not fall back to tenantId
  - null salary_records.branch_id rejects before outbox
  - missing/cross-tenant salary record rejects before outbox
  - worker passes payload.branchId to handleSalaryPaid

TypeScript:
  - changed-file diagnostics = 0

Diff_Check:
  - git diff --check = PASS

Real_DB_Proof:
  - Branch A salary record -> outbox payload.branchId Branch A
  - worker -> journal_lines.branch_id Branch A
  - null branch salary record denied with no outbox/journal side-effect
  - cross-tenant denied with no outbox/journal side-effect
  - cleanup current proof residual = 0
```

## Evidence

```yaml
Focused_Unit_Proof:
  command: npm test -- src/__tests__/finance-transaction-mutations.test.ts src/__tests__/accounting-outbox.test.ts src/__tests__/business-health.test.ts --runInBand
  result: PASS
  suites: 3
  tests: 71

Changed_TypeScript:
  command: npm run typecheck:changed
  result: PASS
  diagnostics: 0

Real_DB_Finance_Proof:
  command: npx jest --config jest.real-db.config.ts src/__tests__/beauty-v2-finance-branch-real-db.test.ts --runInBand
  env: canonical E2E Supabase env loaded from workspace .env.e2e without printing secrets
  result: PASS
  suites: 1
  tests: 3

Diff_Check:
  command: git diff --check
  result: PASS
  notes: line-ending warnings only
```

Real DB behavior proven:

```text
salary_records.branch_id = Platform Branch A
        -> SALARY_PAID.payload.branchId = Branch A
        -> accounting worker
        -> journal_entries.reference_type = SALARY_PAYMENT
        -> journal_lines.branch_id = Branch A
        -> journal_lines.ktv_id = salary KTV
```

Negative proof:

```text
salary_records.branch_id = NULL
        -> reject before SALARY_PAID outbox
        -> no journal side-effect

tenant A expense references tenant B salary record
        -> reject before SALARY_PAID outbox
        -> tenant B salary unchanged
        -> no journal side-effect
```

Cleanup proof:

```text
Current proof outbox rows       = 0
Current proof journal rows      = 0
Current proof expense rows      = 0
Current proof salary rows       = 0
Current proof account rows      = 0
Current proof user/org/tenant   = 0
```

## Decision

```text
Finance SALARY_PAID Branch Propagation
        = PROVEN / SEALED

Finance Gate
        = PROVEN_FOR_SALARY_PAID_BRANCH_MAPPING

Beauty V2 Go-Live
        = NOT_READY
```

Do not reopen Chain, Attendance, Payroll, or Commission for this result. Further Beauty V2 go-live work must move to the next unproven gate.
