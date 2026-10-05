# Investigation: Beauty V2 Payroll Gate

## Hand-off Brief

1. **What happened.** Attendance is sealed, so the next Beauty V2 gate is Payroll branch mapping.
2. **Where the case stands.** Payroll currently consumes attendance by tenant, KTV, and month; branch-aware attendance is not consumed.
3. **What's needed next.** Define a Payroll branch mapping contract before any Payroll runtime or schema work.

## Case Info

| Field | Value |
|---|---|
| Ticket | N/A |
| Date opened | 2026-10-04 |
| Status | Concluded |
| System | BELLA SPA ERP / Beauty V2 |
| Evidence sources | Source code, migrations, generated DB types, existing Real DB proof |

## Problem Statement

Determine whether Payroll can move forward after Attendance was sealed, specifically whether Payroll already consumes branch-aware Attendance or remains tenant/KTV/month scoped.

## Evidence Inventory

| Source | Status | Notes |
|---|---|---|
| `src/modules/hr-salary/actions/salary-recalculation-engine.ts` | Available | Reads attendance as status/date by tenant, KTV, month. |
| `src/modules/hr-salary/actions/query-salary-actions.ts` | Available | Dashboard read path fetches tenant-month attendance and filters by KTV. |
| `src/__tests__/beauty-v2-go-live-payroll-commission-real-db.test.ts` | Available | Existing proof inserts attendance directly without branch_id and reads salary without branch. |
| `src/types/database.types.ts` | Available | `salary_records` has tenant/KTV/month fields, no branch field. |
| `supabase/migrations/20260511000000_initial_schema.sql` | Available | Initial `salary_records` has no branch dimension. |

## Confirmed Findings

### Finding 1: Payroll recalculation ignores branch_id

**Evidence:** `src/modules/hr-salary/actions/salary-recalculation-engine.ts:296-302`

**Detail:** The engine reads `attendance(status, date)` by `ktv_id`, `tenant_id`, and month range. It does not select or filter `branch_id`.

### Finding 2: Payroll display path aggregates attendance tenant-wide

**Evidence:** `src/modules/hr-salary/actions/query-salary-actions.ts:352-363`, `src/modules/hr-salary/actions/query-salary-actions.ts:460-469`

**Detail:** The dashboard salary query loads all tenant attendance for the month, then filters by KTV only before calculating attendance components.

### Finding 3: Payroll persistence has no branch identity

**Evidence:** `supabase/migrations/20260511000000_initial_schema.sql:171-184`, `src/types/database.types.ts:30456-30558`

**Detail:** `salary_records` persists KTV, month, tenant, and salary components. No branch identity or branch breakdown is present.

### Finding 4: Existing Beauty Payroll Real DB proof is tenant-scoped

**Evidence:** `src/__tests__/beauty-v2-go-live-payroll-commission-real-db.test.ts:231-239`, `src/__tests__/beauty-v2-go-live-payroll-commission-real-db.test.ts:292-306`

**Detail:** The proof inserts attendance directly without `branch_id` and reads back salary without branch context.

## Conclusion

**Confidence:** High

Beauty V2 Payroll is not branch-aware yet. Existing Payroll evidence remains useful for tenant payroll and salary recalculation, but it does not prove Payroll consumes sealed branch-aware Attendance.

## Recommended Next Steps

### Fix direction

Do not code Payroll yet. Define a Payroll branch mapping contract first:

```text
Attendance branch_id
  -> Payroll period / employee salary basis
  -> branch attribution or branch-scoped payroll record
  -> read-back
  -> branch isolation
  -> tenant isolation
```

### Diagnostic

The next proof should decide whether Payroll persists branch identity in `salary_records` or derives branch breakdown from attendance rows during calculation. Do not infer this from existing tenant-level payroll code.

## Reproduction Plan

No runtime reproduction was required for this audit. The gap is static and directly visible in source and schema.
