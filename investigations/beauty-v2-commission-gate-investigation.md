# Investigation: Beauty V2 Commission Gate

## Hand-off Brief

1. **What happened.** Chain, Attendance, and Payroll are sealed, so the next Beauty V2 gate is whether Commission consumes branch-aware operational facts.
2. **Where the case stands.** Commission is not branch-proven: salary records now carry `branch_id`, but the commission source queries remain tenant/KTV/month scoped and their source tables do not persist branch identity.
3. **What's needed next.** Define a Commission Mapping Contract before any Commission runtime, migration, or Real DB proof work.

## Case Info

| Field | Value |
|---|---|
| Ticket | N/A |
| Date opened | 2026-10-04 |
| Status | Concluded |
| System | BELLA SPA ERP / Beauty V2 |
| Evidence sources | Source code, migrations, generated DB types, existing Real DB tests, architecture memory |

## Problem Statement

Determine whether Beauty V2 Commission already consumes branch-aware Payroll/Attendance and can be treated as branch-isolated, or whether it needs a mapping contract before implementation.

## Evidence Inventory

| Source | Status | Notes |
|---|---|---|
| `src/modules/hr-salary/actions/salary-recalculation-engine.ts` | Available | Payroll branch attribution is real; commission source queries remain tenant/KTV/month scoped. |
| `supabase/migrations/20260622163000_create_booking_service_items.sql` | Available | Service commission source table has no branch column. |
| `supabase/migrations/20260622164000_create_product_sales.sql` | Available | Product sales commission source table has no branch column. |
| `src/types/database.types.ts` | Available | `salary_records.branch_id` exists; `booking_service_items` and `product_sales` rows do not include branch identity. |
| `src/__tests__/beauty-v2-go-live-payroll-commission-real-db.test.ts` | Available | Existing proof is tenant-scoped and inserts attendance without branch. |
| `src/core/services/order/session-completion-helpers.ts` | Available | Completion path recalculates salary without passing branch context and emits Finance outbox commission from booking value. |

## Confirmed Findings

### Finding 1: Payroll branch attribution is proven but Commission is only co-located in the salary row

**Evidence:** `src/modules/hr-salary/actions/salary-recalculation-engine.ts:336-349`, `src/modules/hr-salary/actions/salary-recalculation-engine.ts:1174-1199`, `src/types/database.types.ts:30456-30576`

**Detail:** Payroll resolves a single branch from `attendance.branch_id` and persists it on `salary_records.branch_id`. The same salary row also stores commission components (`session_bonus`, `service_commission`, `product_sales_commission`, `position_bonus`, `seniority_bonus`, `manual_adjustments`). This proves branch-aware salary persistence, not branch-aware commission source attribution.

### Finding 2: Session-based commission source is not branch-filtered

**Evidence:** `src/modules/hr-salary/actions/salary-recalculation-engine.ts:351-358`

**Detail:** Completed sessions are queried by `completed_by_ktv_id`, `tenant_id`, `status`, and month range. No branch column is selected or filtered. The session commission amount is then derived from `bookings.ktv_commission`.

### Finding 3: Advanced commission source tables do not persist branch identity

**Evidence:** `supabase/migrations/20260622163000_create_booking_service_items.sql:19-44`, `supabase/migrations/20260622164000_create_product_sales.sql:19-44`, `src/modules/hr-salary/actions/salary-recalculation-engine.ts:622-651`, `src/modules/hr-salary/actions/salary-recalculation-engine.ts:915-932`

**Detail:** `booking_service_items` and `product_sales` have tenant, KTV, date/status, and calculated commission fields, but no `branch_id`. The runtime queries those tables by tenant/KTV/status/month only.

### Finding 4: Existing payroll/commission Real DB proof is tenant-scoped, not branch-scoped

**Evidence:** `src/__tests__/beauty-v2-go-live-payroll-commission-real-db.test.ts:231-239`, `src/__tests__/beauty-v2-go-live-payroll-commission-real-db.test.ts:292-325`

**Detail:** The existing proof inserts attendance without `branch_id`, reads salary without `branch_id`, and verifies `session_bonus` plus Finance outbox `commissionAmount`. It cannot prove branch isolation for Commission.

### Finding 5: Finance outbox commission is a separate downstream concern

**Evidence:** `src/core/services/order/session-completion-helpers.ts:671-686`

**Detail:** Session completion enqueues `commissionAmount` from `currentBooking.ktv_commission`. This is Finance handoff evidence, but Finance is not opened in this gate and this path does not prove Commission branch isolation.

## Deduced Conclusions

### Deduction 1: Commission Gate cannot be sealed from Payroll proof alone

**Based on:** Findings 1-4

**Reasoning:** `salary_records.branch_id` proves where the payroll result is attributed. It does not prove every commission input inside that salary result came from the same authorized branch, because the source commission queries do not carry branch constraints.

**Conclusion:** Commission branch isolation is `NOT_PROVEN`.

### Deduction 2: The next step is a mapping contract, not implementation

**Based on:** Findings 2-5

**Reasoning:** The missing decision is not a small query bug yet. The system must first define the canonical branch truth for each commission source: completed session, service item, product sale, and payroll snapshot.

**Conclusion:** Implementation is not authorized until the mapping contract is defined.

## Missing Evidence

| Gap | Impact | How to Obtain |
|---|---|---|
| Canonical Commission branch truth | Cannot decide whether to persist branch on source rows, derive from Beauty appointment/session, or treat salary branch as sufficient. | Commission Mapping Contract. |
| Branch-aware source rows for service/product commission | Cannot prove cross-branch denial for advanced commission. | Contract plus minimal implementation proof if required. |
| Real DB Commission branch proof | Cannot seal Commission Gate. | Run only after mapping and implementation are proven. |

## Source Code Trace

| Element | Detail |
|---|---|
| Payroll branch source | `attendance.branch_id` resolved by `resolvePayrollBranchIdFromAttendance`. |
| Salary result branch | `salary_records.branch_id` persisted from payroll branch. |
| Session commission source | `session_logs` joined to `bookings.ktv_commission`, tenant/KTV/month scoped only. |
| Service commission source | `booking_service_items.calculated_commission`, tenant/KTV/month scoped only. |
| Product commission source | `product_sales.calculated_commission`, tenant/KTV/month scoped only. |
| Finance handoff | `SESSION_DONE` outbox includes `commissionAmount`, not opened for this gate. |

## Conclusion

**Confidence:** High

Commission is not ready for implementation or Real DB proof as a sealed gate. Payroll now gives a branch-aware salary result, but Commission source attribution remains tenant/KTV/month scoped. A PASS here would collapse Payroll proof into Commission proof without evidence.

## Recommended Next Steps

### Fix direction

Define `BEAUTY_V2_COMMISSION_MAPPING_CONTRACT_V1.md` before runtime changes:

```text
Commission source
  -> canonical branch truth
  -> source read/write contract
  -> salary_records commission component
  -> branch mismatch behavior
  -> tenant isolation
  -> Real DB proof plan
```

### Diagnostic

The contract must decide, at minimum:

- Whether V1 Commission branch truth comes from Beauty appointment/session branch, service item branch, product sale branch, or Payroll branch.
- Whether `booking_service_items` and `product_sales` need persisted `branch_id`.
- Whether session commission can use the branch of the completed Beauty session/appointment.
- Whether multi-branch commission inside one payroll period is rejected in V1 or split into separate branch-scoped salary records.

## Reproduction Plan

Do not run Real DB Commission proof yet. A valid proof must first have branch-aware source data and should include:

```text
Branch A commission source -> salary commission for Branch A PASS
Branch A user/source -> Branch B commission operation DENY
Tenant A source -> Tenant B branch DENY
Denied operation -> no salary/commission side effect
Read-back -> correct branch
Cleanup -> 0 residual
```
