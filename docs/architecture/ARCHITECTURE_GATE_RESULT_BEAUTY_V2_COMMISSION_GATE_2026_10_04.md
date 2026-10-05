# Architecture Gate Result - Beauty V2 Commission Gate

Status: DEFER_PENDING_COMMISSION_MAPPING_CONTRACT
Date: 2026-10-04
Scope: Commission gate audit only; no Commission implementation, no Finance, no Chain, no Attendance, no Payroll changes.

## Gate Result

```yaml
Chain: SEALED_UNCHANGED
Attendance: SEALED_PROVEN
Payroll: SEALED_PROVEN
Commission_Audit: COMPLETE
Commission_Mapping_Contract: NOT_DEFINED
Commission_Runtime_Mapping: NOT_PROVEN
Commission_Branch_Isolation: NOT_PROVEN
Commission_Tenant_Isolation: PARTIAL_TENANT_SCOPED_ONLY
Existing_Commission_Evidence: TENANT_SCOPED_OR_PAYROLL_COLOCATED_ONLY
Commission_Implementation: NOT_AUTHORIZED
Finance: NOT_OPENED
Beauty_V2_Go_Live: NOT_READY
```
## Problem

Payroll is now branch-aware and sealed:

```text
attendance.branch_id
  -> salary_records.branch_id
```

The Commission gate asks a different question:

```text
Commission source fact
  -> branch truth
  -> commission calculation
  -> salary commission component
  -> branch isolation
```

That is not proven yet.

## Ownership Map

| Fact | Owner | Gate result |
|---|---|---|
| Chain, Branch, Membership, Authorization | Platform Chain | SEALED / consume only |
| Attendance event branch | Attendance | SEALED / consume only |
| Salary result branch | Payroll / HR Salary | SEALED / proven |
| Commission source attribution | Commission / HR Salary downstream compensation | Audit target |
| SESSION_DONE finance posting | Finance OS | Not opened |

## Confirmed Evidence

### Payroll now persists branch on salary records

Evidence:

- `src/modules/hr-salary/actions/salary-recalculation-engine.ts:336-349`
- `src/modules/hr-salary/actions/salary-recalculation-engine.ts:1174-1199`
- `src/types/database.types.ts:30456-30576`

Result:

```yaml
salary_records.branch_id: PROVEN
payroll_branch_truth: attendance.branch_id
```

### Commission source queries remain tenant/KTV/month scoped

Session commission reads completed sessions:

Evidence:

- `src/modules/hr-salary/actions/salary-recalculation-engine.ts:351-358`

Service and product commission read source rows:

Evidence:

- `src/modules/hr-salary/actions/salary-recalculation-engine.ts:622-651`
- `src/modules/hr-salary/actions/salary-recalculation-engine.ts:915-932`

Result:

```yaml
commission_source_branch_filter: NOT_FOUND
commission_source_branch_select: NOT_FOUND
```

### Advanced commission source tables do not carry branch identity

Evidence:

- `supabase/migrations/20260622163000_create_booking_service_items.sql:19-44`
- `supabase/migrations/20260622164000_create_product_sales.sql:19-44`
- `src/types/database.types.ts:26682-26735`

Result:

```yaml
booking_service_items.branch_id: NOT_PRESENT
product_sales.branch_id: NOT_PRESENT
```

### Existing payroll/commission Real DB proof is not branch proof

Evidence:

- `src/__tests__/beauty-v2-go-live-payroll-commission-real-db.test.ts:231-239`
- `src/__tests__/beauty-v2-go-live-payroll-commission-real-db.test.ts:292-325`

The existing test inserts attendance without `branch_id`, reads salary without `branch_id`, and verifies tenant-scoped salary/commission plus Finance outbox payload.

Result:

```yaml
existing_commission_real_db_proof: TENANT_SCOPED_ONLY
branch_isolation: NOT_PROVEN
```

### Finance outbox commission is downstream and not opened here

Evidence:

- `src/core/services/order/session-completion-helpers.ts:671-686`

`SESSION_DONE` outbox includes `commissionAmount` from `currentBooking.ktv_commission`. This belongs to Finance handoff evidence, not Commission branch mapping proof.

Result:

```yaml
finance_commission_handoff: OUT_OF_SCOPE_FOR_THIS_GATE
finance_gate: NOT_OPENED
```

## Decision

Commission cannot be sealed from Payroll evidence alone.

```text
salary_records.branch_id exists
  !=
commission source rows are branch-proven
```

The current system can produce a salary record with commission components and a payroll branch. It does not yet prove that each commission source row belongs to that same authorized Platform Branch.

## Required Next Contract

Create `BEAUTY_V2_COMMISSION_MAPPING_CONTRACT_V1.md` before implementation.

The contract must define:

1. Canonical branch truth for session commission.
2. Canonical branch truth for `booking_service_items`.
3. Canonical branch truth for `product_sales`.
4. Whether V1 rejects multi-branch commission inside one payroll period or splits salary by branch.
5. Whether branch identity must be persisted on commission source rows.
6. How branch mismatch is denied before salary/commission write.
7. Real DB proof requirements and cleanup expectations.

## Non-Goals

```text
Do not reopen Chain.
Do not reopen Attendance.
Do not reopen Payroll.
Do not open Finance.
Do not add commission runtime code yet.
Do not add migration yet.
Do not run Real DB Commission proof before the mapping contract exists.
```

## Gate Decision

```yaml
Commission_Gate: DEFER_PENDING_COMMISSION_MAPPING_CONTRACT
Commission_Implementation: NOT_AUTHORIZED
Beauty_V2_Go_Live: NOT_READY
```
