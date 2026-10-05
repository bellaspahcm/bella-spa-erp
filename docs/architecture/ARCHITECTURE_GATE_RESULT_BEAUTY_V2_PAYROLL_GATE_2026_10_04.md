# Architecture Gate Result - Beauty V2 Payroll Gate

Status: PAYROLL_GATE_PROVEN
Date: 2026-10-04
Scope: Payroll gate audit only; no Payroll implementation, no Commission, no Finance, no Chain, no Attendance changes

Attendance is sealed and proven. This gate asks a smaller question: does Payroll already consume the branch-aware Attendance contract?

## Gate Result

```yaml
Chain: SEALED_UNCHANGED
Attendance: SEALED_PROVEN
Payroll_Audit: COMPLETE
Payroll_Mapping_Contract: DEFINED
Payroll_Implementation: REAL_DB_PROVEN
Payroll_Runtime_Mapping: REAL_DB_PROVEN
Payroll_Branch_Isolation: REAL_DB_PROVEN
Payroll_Tenant_Isolation: REAL_DB_PROVEN_FOR_PROOF_BOUNDARY
Existing_Payroll_Real_DB_Proof: TENANT_SCOPED_ONLY
Real_DB_Payroll_Proof: PASS
Cleanup: 0_CURRENT_PROOF_RESIDUAL
Commission: NOT_OPENED
Finance: NOT_OPENED
Beauty_V2_Go_Live: NOT_READY
```

## Problem

Beauty V2 now has branch-aware Attendance:

```text
Platform Branch
  -> authorization
  -> attendance.branch_id
  -> write/read/update
```

Payroll must not be treated as ready until it proves how it consumes that branch-aware attendance fact.

## Ownership Map

| Fact | Owner | Gate result |
|---|---|---|
| Chain, Branch, Membership, Authorization | Platform Chain | SEALED / consume only |
| Attendance event with branch_id | Workforce / Attendance | SEALED / proven |
| Salary records and payroll calculation | Payroll / HR Salary | Audit target |
| Session completion operational fact | Beauty OS / shared order completion | Existing consumer |
| Commission and Finance posting | Downstream owners | Not opened |

## Historical Audit Evidence Before Implementation

### Payroll recalculation previously read Attendance without branch

Before the implementation gate, `src/modules/hr-salary/actions/salary-recalculation-engine.ts` read attendance by KTV, tenant, and date range:

```text
attendance
  -> select status, date
  -> ktv_id
  -> tenant_id
  -> month range
```

Evidence:

- `src/modules/hr-salary/actions/salary-recalculation-engine.ts:296-302`

Result:

```yaml
attendance.branch_id_consumed_by_recalculation_before_implementation: false
```

### Payroll dashboard/read path remains tenant/KTV/month scoped

`src/modules/hr-salary/actions/query-salary-actions.ts` fetches tenant-month attendance and filters by KTV in memory.

Evidence:

- `src/modules/hr-salary/actions/query-salary-actions.ts:352-363`
- `src/modules/hr-salary/actions/query-salary-actions.ts:460-469`

Result:

```yaml
branch_filtered_payroll_read: NOT_PRESENT
```

### Payroll persistence previously had no branch identity

Before the implementation gate, `salary_records` stored KTV, month, tenant, and salary components. It had no `branch_id` or branch breakdown.

Evidence:

- `supabase/migrations/20260511000000_initial_schema.sql:171-184`
- `src/types/database.types.ts:30456-30558`

Result:

```yaml
salary_record_branch_identity_before_implementation: NOT_PRESENT
```

### Existing Beauty payroll proof is tenant scoped

The existing Beauty V2 Payroll/Commission Real DB proof inserts `attendance` directly without `branch_id`, then reads back `salary_records` without branch context.

Evidence:

- `src/__tests__/beauty-v2-go-live-payroll-commission-real-db.test.ts:231-239`
- `src/__tests__/beauty-v2-go-live-payroll-commission-real-db.test.ts:292-306`

It also proves cross-tenant denial around salary records:

- `src/__tests__/beauty-v2-go-live-payroll-commission-real-db.test.ts:337-369`

Result:

```yaml
existing_real_db_payroll_proof:
  payroll_recalculation: PROVEN_TENANT_SCOPED
  tenant_isolation: PROVEN_EXISTING_PATH
  branch_isolation: NOT_PROVEN
```

## Root Cause Identified By Audit

Before the implementation gate, Payroll consumed Attendance as a tenant/KTV/month aggregate:

```text
attendance
  -> ktv_id
  -> tenant_id
  -> month
  -> salary_records
```

The missing path was:

```text
attendance.branch_id
  -> branch-scoped payroll calculation / attribution
  -> branch-isolated salary read-back
```

This was not a Chain gap and not an Attendance gap. Chain and Attendance remain sealed.

## Contract Decision Boundary

This audit has now been paired with `docs/architecture/BEAUTY_V2_PAYROLL_MAPPING_CONTRACT_V1.md`.

That contract decides:

```yaml
salary_record_semantics: KTV_PERIOD_RESULT
branch_source: attendance.branch_id
single_branch_period: persist branch_id on salary_records
legacy_or_null_attendance_branch: do not backfill or guess
multi_branch_period: out of V1, do not choose implicitly
```

It does not authorize runtime implementation in this artifact.

Implementation was later authorized and proven in `docs/architecture/ARCHITECTURE_GATE_RESULT_BEAUTY_V2_PAYROLL_IMPLEMENTATION_GATE_2026_10_04.md`.

Current implementation evidence:

```yaml
Payroll_Implementation: REAL_DB_PROVEN
Payroll_Runtime_Mapping: REAL_DB_PROVEN
Payroll_Branch_Isolation: REAL_DB_PROVEN
Real_DB_Payroll_Proof: PASS
Cleanup: 0_CURRENT_PROOF_RESIDUAL
```

Superseded open question:

1. Persist branch identity directly on `salary_records`.
2. Persist a branch breakdown table/component.
3. Keep `salary_records` tenant/KTV/month scoped and calculate branch-attributed payroll views from branch-aware attendance events.

The explicit V1 answer is option 1 for a single-branch payroll period only. Options 2 and 3 remain out of scope for V1 and must not be implemented implicitly.

## Verification Performed

```yaml
Static_Audit:
  result: PASS
  evidence_files:
    - src/modules/hr-salary/actions/salary-recalculation-engine.ts
    - src/modules/hr-salary/actions/query-salary-actions.ts
    - src/__tests__/beauty-v2-go-live-payroll-commission-real-db.test.ts
    - src/types/database.types.ts
    - supabase/migrations/20260511000000_initial_schema.sql
    - supabase/migrations/20261004010000_add_branch_id_to_attendance.sql

Runtime_Code_Changed_During_Audit: false
Migration_Changed_During_Audit: false
Real_DB_Proof_Run_During_Audit: false
reason: Running the existing proof would not prove branch Payroll because runtime does not enforce branch consumption.
```

## Gate Decision

```yaml
Beauty_V2_Payroll_Gate: PROVEN
Payroll_Mapping_Contract: DEFINED
Payroll_Implementation: REAL_DB_PROVEN
Payroll_Runtime_Mapping: REAL_DB_PROVEN
Payroll_Branch_Isolation: REAL_DB_PROVEN
Payroll_Tenant_Isolation: REAL_DB_PROVEN_FOR_PROOF_BOUNDARY
Real_DB_Payroll_Proof: PASS
Cleanup: 0_CURRENT_PROOF_RESIDUAL
Next_Allowed_Work: Payroll Gate sealed; open Commission only if separately authorized
```

After Real DB Payroll proof:

```text
Beauty V2 Payroll = PROVEN
Beauty V2 Go-Live = NOT_READY
```
