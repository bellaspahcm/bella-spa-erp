# Architecture Gate Result - Beauty V2 Payroll Implementation Gate

Status: PROVEN
Date: 2026-10-04
Scope: Minimal Payroll implementation only; no Commission, no Finance, no Chain, no Attendance changes, no Real DB proof in this gate.

## Gate Result

```yaml
Chain: SEALED_UNCHANGED
Attendance: SEALED_PROVEN
Payroll_Mapping_Contract: SEALED
Payroll_Implementation_Authorized: true
Payroll_Implementation: UNIT_PROVEN
Payroll_Runtime_Mapping: REAL_DB_PROVEN
Payroll_Branch_Isolation: REAL_DB_PROVEN
Runtime_Target: salary_records.branch_id persisted from attendance.branch_id
Legacy_Backfill: FORBIDDEN
Multi_Branch_Period: REJECT_IN_V1
Commission: NOT_OPENED
Finance: NOT_OPENED
Real_DB_Proof: PASS
Cleanup: 0_CURRENT_PROOF_RESIDUAL
Beauty_V2_Go_Live: NOT_READY
```

## Truth And Contract

The sealed mapping contract is `docs/architecture/BEAUTY_V2_PAYROLL_MAPPING_CONTRACT_V1.md`.

```text
attendance.branch_id
  -> single branch payroll period
  -> salary_records.branch_id
```

The canonical branch truth for this slice is the sealed Attendance event branch, not current membership and not caller-provided branch.

## Ownership

| Fact | Owner | Change authority |
|---|---|---|
| Chain, Branch, Membership, Authorization | Platform Chain | Consume only |
| Attendance event branch | Attendance | Consume only |
| Salary record branch attribution | Payroll / HR Salary | Modify |
| Commission branch attribution | Commission | Not opened |
| Finance posting | Finance OS | Not opened |

## Minimal Implementation

Implemented:

1. Added nullable `public.salary_records.branch_id` with FK to `public.org_units(id)`.
2. Did not backfill legacy salary records.
3. Read `attendance.branch_id` during salary recalculation.
4. Required exactly one non-null attendance branch for branch-proven Payroll V1.
5. Persisted that branch on `salary_records.branch_id`.
6. Used optional context branch only as an assertion against attendance truth.
7. Rejected legacy/null attendance branch and multi-branch payroll periods before salary write.
8. Proved by unit test, TypeScript changed-file check, and diff check.

## Verification Evidence

```yaml
Unit_Proof:
  command: npx jest src/__tests__/salary-recalculation-lifecycle.test.ts --runInBand
  result: PASS
  tests: 8/8
  evidence:
    - new salary record persists salary_records.branch_id from attendance.branch_id
    - existing salary update persists salary_records.branch_id from attendance.branch_id
    - expected branch mismatch denies before salary write
    - null attendance branch denies before salary write
    - multi-branch attendance period denies before salary write

Static_Proof:
  typecheck_changed:
    command: npm run typecheck:changed
    result: PASS
    diagnostics: 0
  diff_check:
    command: git diff --check
    result: PASS

Real_DB_Proof:
  migration_apply:
    command: supabase db query --linked --project-ref bmnbqbcdbuklhopfbopv --file supabase/migrations/20261004020000_add_branch_id_to_salary_records.sql
    result: PASS
  schema_readback:
    salary_records.branch_id: PRESENT_NULLABLE_UUID
    salary_records_branch_id_fkey: PRESENT
  command: npx jest --config jest.real-db.config.ts src/__tests__/beauty-v2-payroll-branch-real-db.test.ts --runInBand
  env: canonical .env.e2e for project bmnbqbcdbuklhopfbopv
  result: PASS
  tests: 2/2
  evidence:
    - attendance Branch A -> payroll salary_records.branch_id Branch A
    - expected branch mismatch rejects before salary write
    - null attendance branch rejects before salary write
    - multi-branch payroll period rejects before salary write
    - read-back confirms salary branch identity
    - cleanup current proof residual = 0
```

## Stop Boundary

This implementation gate stops after Real DB proof. Do not open Commission, Finance, multi-branch payroll design, legacy backfill, or Payroll UI read-path expansion in this implementation slice.

```yaml
Payroll_Implementation: REAL_DB_PROVEN
Payroll_Gate: PROVEN
Beauty_V2_Go_Live: NOT_READY
```
