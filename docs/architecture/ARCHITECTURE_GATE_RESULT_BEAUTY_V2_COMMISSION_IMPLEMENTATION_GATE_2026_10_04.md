# Architecture Gate Result - Beauty V2 Commission Implementation Gate

Status: PASS_REAL_DB_PROVEN
Date: 2026-10-04
Scope: Minimal Commission source branch implementation; no Finance, no Chain, no Attendance, no Payroll contract changes, no UI workflow expansion.

## Gate Result

```yaml
Chain: SEALED_UNCHANGED
Attendance: SEALED_PROVEN_UNCHANGED
Payroll: SEALED_PROVEN_UNCHANGED
Commission_Mapping_Contract: SEALED
Commission_Implementation: REAL_DB_PROVEN
Commission_Runtime_Mapping: REAL_DB_PROVEN
Commission_Branch_Isolation: REAL_DB_PROVEN
Finance: NOT_OPENED
Beauty_V2_Go_Live: NOT_READY
```

## Problem

Commission source rows currently feed salary commission components by tenant, KTV, status, and period. They do not prove branch truth.

```text
session_logs / booking_service_items / product_sales
  -> salary_records commission components
  -> branch isolation NOT_PROVEN
```

## Truth and Source of Truth

| Truth | Source |
|---|---|
| Platform Branch identity | `org_units.id` proven by Platform Chain |
| Attendance branch | `attendance.branch_id` |
| Payroll result branch | `salary_records.branch_id` |
| Commission mapping contract | `docs/architecture/BEAUTY_V2_COMMISSION_MAPPING_CONTRACT_V1.md` |
| Existing commission sources | migrations, generated DB types, salary recalculation engine |

## Ownership

| Data / capability | Owner | Change authority |
|---|---|---|
| Chain / Branch / Membership / Authorization | Platform Chain | Consume only |
| Attendance branch | Attendance | Consume only |
| Payroll branch result | Payroll / HR Salary | Consume only |
| Commission source branch attribution | Commission / HR Salary | Minimal implementation authorized |
| Finance posting / outbox | Finance OS | Not opened |

## Canonical Contract

Commission V1 must consume branch-proven source rows:

```text
Commission source row
  -> tenant_id
  -> ktv_id
  -> period date
  -> branch_id
  -> calculated commission amount
```

Then:

```text
source.branch_id
  = salary_records.branch_id
  = Payroll branch from attendance.branch_id
```

## Minimal Implementation Plan

1. Add nullable `branch_id` to Commission source tables needed by the current salary engine:
   - `session_logs.branch_id`
   - `booking_service_items.branch_id`
   - `product_sales.branch_id`
2. Add FK to `org_units(id)` and branch indexes. No backfill.
3. Update generated DB types for the additive columns.
4. Update `recalculateAndSaveSalaryRecordEngine` to:
   - select source `branch_id`;
   - reject source rows with missing branch;
   - reject source rows with branch mismatching Payroll branch;
   - reject multi-branch source sets in V1;
   - deny before writing `salary_records`.
5. Add unit proof for allow/deny/null/multi-branch.
6. Add Real DB Commission proof only after unit/type evidence passes.

## Non-Goals

```text
No Chain changes.
No Attendance changes.
No Payroll contract changes.
No Finance changes.
No UI/Product Sales workflow expansion.
No historical source backfill.
No branch-split salary model.
No new commission subsystem.
No product-local permission subsystem.
```

## Verification Plan

```yaml
Unit_Proof:
  - branch-proven session/source rows write salary commission components
  - source branch mismatch rejects before salary write
  - missing source branch rejects before salary write
  - multi-branch source set rejects before salary write

TypeScript:
  - changed-file diagnostics = 0

Real_DB_Proof:
  - Branch A source -> salary commission Branch A PASS
  - Branch A source + Branch B context -> DENY / no write
  - Tenant A source + Tenant B branch -> DENY / no write
  - cleanup current proof residual = 0
```

## Verification Evidence

```yaml
Unit_Proof:
  command: npm test -- src/__tests__/salary-recalculation-lifecycle.test.ts --runInBand
  result: PASS
  tests: 12/12

TypeScript:
  command: npm run typecheck:changed
  result: PASS
  diagnostics: 0

Diff_Check:
  command: git diff --check
  result: PASS

Real_DB_Proof:
  command: npx jest --config jest.real-db.config.ts src/__tests__/beauty-v2-commission-branch-real-db.test.ts --runInBand
  result: PASS
  tests: 2/2
  evidence:
    - Branch A source persisted salary_records.branch_id = Branch A
    - source branch mismatch denied before salary write
    - null legacy source branch denied before salary write
    - multi-branch source set denied before salary write
    - current proof business rows cleaned to 0 residual

Historical_E2E_Tenant_Shells:
  count: 4
  source: earlier failed harness cleanup attempt before tenant-shell creation was removed from the Commission proof
  timeline_events: 0
  status: TRACKED_SEPARATELY_NOT_COMMISSION_RUNTIME_FAILURE
```

## Decision

```yaml
Architecture_Gate: PASS
Commission_Runtime_Implementation: REAL_DB_PROVEN
Commission_Gate_Final_Status: PROVEN
```
