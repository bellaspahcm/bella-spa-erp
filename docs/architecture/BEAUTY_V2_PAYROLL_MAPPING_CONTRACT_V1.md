# Beauty V2 Payroll Mapping Contract V1

Status: DEFINED_PENDING_IMPLEMENTATION_GATE
Date: 2026-10-04
Scope: Payroll mapping contract only; no Payroll runtime change, no migration, no Commission, no Finance, no Chain, no Attendance changes.

## Decision

```yaml
Payroll_Mapping_Contract: DEFINED
Payroll_Record_Semantics: KTV_PERIOD_RESULT
Branch_Decision: PERSIST_BRANCH_ID_ON_SALARY_RECORD_FOR_SINGLE_BRANCH_PERIOD
Branch_Source: ATTENDANCE_BRANCH_ID
Legacy_Backfill: NOT_ALLOWED_WITHOUT_CANONICAL_SOURCE
Multi_Branch_Period: NOT_SUPPORTED_IN_V1
Payroll_Runtime_Implementation: NOT_STARTED
Payroll_Implementation_Authorized_By_This_Artifact: false
Payroll_Gate: DEFER_PENDING_IMPLEMENTATION_PROOF
```

## Boundary

Chain and Attendance are sealed. Payroll must consume their proven facts instead of creating a local branch, chain, or permission subsystem.

```text
Platform Branch
  -> Attendance branch authorization
  -> attendance.branch_id
  -> Payroll branch mapping
  -> salary_records.branch_id
```

This contract does not authorize Payroll code or schema changes. It defines the mapping that a later minimal implementation gate must follow.

## Salary Record Semantics

Current Payroll treats `salary_records` as one saved payroll result for a KTV in a payroll month within a tenant:

```text
salary_records
  -> tenant_id
  -> ktv_id
  -> month_year
  -> payroll components
  -> total_salary
```

Evidence:

- `supabase/migrations/20260511000000_initial_schema.sql:171-185`
- `src/modules/hr-salary/actions/admin-salary-actions.ts:131-137`
- `src/modules/hr-salary/actions/salary-recalculation-engine.ts:626-629`
- `src/modules/hr-salary/actions/query-salary-actions.ts:291-295`

Result:

```yaml
salary_record_represents: one KTV payroll result for one tenant month
salary_record_is_not: attendance event
salary_record_is_not: branch breakdown row
```

## Branch Ownership Rule

For Beauty V2 Payroll V1, a salary record belongs to the Platform Branch proven by the branch-aware attendance facts used in the calculation.

Payroll must not resolve branch identity from current staff membership at read time, because staff membership can change after the payroll period. Payroll must not accept a free request `branchId` as payroll truth.

Canonical branch source:

```text
attendance.branch_id
```

Mapping rule:

```text
tenant_id + ktv_id + month_year
        -> payroll-included attendance rows
        -> distinct non-null attendance.branch_id
        -> exactly one Platform Branch
        -> salary_records.branch_id
```

## Persisted Branch Decision

If a `salary_records` row remains the saved KTV + period result, it must persist the branch identity used by that result:

```text
salary_records.branch_id = the single distinct non-null attendance.branch_id
```

This preserves historical payroll attribution even if the employee later moves branches.

Future implementation must keep the column nullable for legacy salary records unless a canonical historical branch source exists. No automatic backfill is allowed from current membership, current user profile, or guessed branch.

## V1 Preconditions

A branch-aware Payroll calculation is valid in V1 only when:

```yaml
attendance_rows_for_tenant_ktv_month:
  tenant_id: matches salary tenant
  ktv_id: matches salary KTV
  date: inside payroll month
  branch_id: non_null
  distinct_branch_count: 1
```

If the set has zero non-null branches, mixed null branches, or more than one distinct branch, Payroll V1 must not silently choose a branch.

## Explicit Non-Proven Cases

### Legacy or Null Attendance Branch

```text
attendance.branch_id = NULL
```

Decision:

```yaml
branch_aware_payroll: NOT_PROVEN
automatic_backfill: FORBIDDEN
allowed_action: block branch-aware proof or handle as legacy non-branch payroll outside Go-Live evidence
```

### Multi-Branch Payroll Month

```text
KTV works Branch A and Branch B in the same salary month
```

One `salary_records` row cannot faithfully represent branch identity for that period without either:

1. a branch breakdown model, or
2. explicit business policy for primary payroll branch.

Neither is part of V1. V1 must reject or defer this case instead of using latest membership, first attendance row, or caller-provided branch.

### Session/Commission Branch Attribution

Payroll currently includes completed sessions and commission-like components. This contract does not open Commission or Finance.

For Payroll V1, the branch identity of the salary record is derived from Attendance branch facts. Commission branch attribution remains a separate gate if/when opened.

## Future Minimal Implementation Gate

The next implementation gate, if authorized, must be minimal:

```text
read branch-aware attendance
  -> assert exactly one non-null branch_id
  -> compute existing payroll result
  -> persist salary_records.branch_id
  -> read back salary by tenant + ktv + month + branch
```

Required negative behavior:

```text
branch mismatch
  -> deny before salary write/update

cross-tenant branch
  -> deny before salary write/update

ambiguous branch set
  -> deny/defer before salary write/update

denied operation
  -> no salary_records mutation
```

## Proof Requirements

The future proof must include:

```yaml
Unit_Proof:
  - single branch attendance persists salary_records.branch_id
  - branch mismatch denies before mutation
  - cross-tenant branch denies before mutation
  - null or multi-branch attendance set does not produce branch-proven salary

Real_DB_Proof:
  - Platform Branch A attendance -> Payroll Branch A PASS
  - Branch A user -> Branch B payroll operation DENY
  - Tenant A user -> Tenant B branch payroll operation DENY
  - denied operation leaves salary_records unchanged
  - salary_records.branch_id read-back matches attendance.branch_id
  - cleanup current proof residual = 0
```

## Gate Result

```yaml
Payroll_Mapping_Contract: DEFINED
Payroll_Implementation: NOT_STARTED
Payroll_Runtime_Mapping: NOT_PROVEN
Payroll_Branch_Isolation: NOT_PROVEN
Payroll_Tenant_Isolation: PARTIAL_EXISTING_PROVEN
Payroll_Gate: DEFER_PENDING_IMPLEMENTATION_PROOF
Beauty_V2_Go_Live: NOT_READY
```

Payroll can proceed only through a separate minimal implementation gate that follows this contract. Chain, Attendance, Commission, Finance, Governance, and historical DB maintenance remain closed.
