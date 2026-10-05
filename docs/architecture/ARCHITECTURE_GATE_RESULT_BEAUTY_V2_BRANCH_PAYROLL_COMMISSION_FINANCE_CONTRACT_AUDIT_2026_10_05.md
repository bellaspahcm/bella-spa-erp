# Architecture Gate Result - Beauty V2 Branch Payroll Commission Finance Contract Audit

Date: 2026-10-05

Scope: AUDIT ONLY

Gate:

```text
BEAUTY_V2_BRANCH_PAYROLL_COMMISSION_FINANCE_CONTRACT_AUDIT
```

Purpose:

Verify whether `branch_id` is propagated through Beauty V2 operational dependencies by one canonical branch truth:

```text
Attendance
  -> Payroll
  -> Commission
  -> Finance
```

This audit does not implement a fix, create migrations, refactor runtime code, or reopen sealed Beauty H8 / Finance SESSION_DONE evidence.

## Result

```text
AUDIT_RESULT = PASS
CONTRACT_CONSISTENCY = NOT_PROVEN
CANONICAL_BRANCH_TRUTH = NOT_PROVEN
RUNTIME_FAILURE = NOT_PROVEN
IMPLEMENTATION_AUTHORIZED = NO
```

The current codebase proves important Beauty V2 branch evidence for the H8 session completion and `SESSION_DONE` finance path, but it does not prove the required legacy salary branch chain:

```text
attendance.branch_id
  -> salary_records.branch_id
  -> SALARY_PAID.payload.branchId
  -> handleSalaryPaid(branchId)
  -> journal_lines.branch_id
```

The chain above is not currently implementable as written because `attendance.branch_id` and `salary_records.branch_id` are not present in the current generated database type, and the legacy `SALARY_PAID` payload builder writes `branchId = tenantId`.

## Mandatory Boundary

This is a proof gap, not a product failure claim.

Do not downgrade these separate evidences without a direct contradiction:

- Beauty V2 H8 appointment/session persistence.
- Beauty V2 H8 `SESSION_DONE` outbox.
- Beauty V2 F3/F5 Finance real DB evidence for completed service receivable.
- Beauty V2 payroll/commission tenant-isolated Real DB proof.

The gap is narrower:

```text
Legacy payroll / commission / salary-paid finance branch ownership is not proven.
```

## Ownership Map

| Data / action | Current owner found | Evidence | Branch status |
| --- | --- | --- | --- |
| Beauty V2 appointment branch | Beauty OS H8 appointment | `src/products/beauty-spa-v2/service.ts` creates appointment with `input.branchId`; H8 migration has `beauty_appointments.branch_id` | PARTIAL / PROVEN for H8 appointment path |
| Beauty V2 completed session finance | Beauty V2 outbox -> Finance worker | `src/products/beauty-spa-v2/finance-outbox.ts` uses `input.appointment.branchId` | PROVEN statically for `SESSION_DONE` |
| Legacy attendance rows | Legacy HR attendance table | `attendance` type has tenant/KTV/date/status, no branch | NOT_PROVEN |
| Legacy salary rows | Legacy payroll table | `salary_records` type has tenant/KTV/month/salary fields, no branch | NOT_PROVEN |
| Legacy session commission source | Legacy `session_logs` | `session_logs` type has tenant/session/KTV/date, no branch | NOT_PROVEN |
| Service item commission source | Legacy `booking_service_items` | generated type has tenant/KTV/status/date fields, no branch | NOT_PROVEN |
| Product sales commission source | Legacy `product_sales` | generated type has tenant/KTV/status/date fields, no branch | NOT_PROVEN |
| Salary paid finance journal lines | Finance OS journal lines | `journal_lines.branch_id` exists and `handleSalaryPaid` writes supplied branch | Sink exists, source not proven |

## Contract Dependency Map

Current proven H8 session finance path:

```text
Beauty Spa V2 service input.branchId
  -> Beauty OS appointment create
  -> beauty_appointments.branch_id
  -> BeautySpaAccountingOutboxPort payload.branchId
  -> accounting worker
  -> RevenueRecognitionService.handleSessionDone(branchId)
  -> journal_lines.branch_id
```

Current legacy payroll / salary-paid path:

```text
attendance rows: tenant_id + ktv_id + date
  -> salary recalculation: tenant_id + ktv_id + month
  -> salary_records row: tenant_id + ktv_id + month
  -> buildSalaryPaidOutboxEvent payload.branchId = tenantId
  -> accounting worker handleSalaryPaid(payload.branchId)
  -> journal_lines.branch_id = payload.branchId
```

These are not the same branch contract.

## Confirmed Evidence

### 1. Beauty H8 appointment has branch_id

`supabase/migrations/20260916000000_beauty_os_h8_persistence.sql:3-7` creates `beauty_appointments` with `tenant_id` and `branch_id UUID NOT NULL`.

`src/products/beauty-spa-v2/service.ts:62-70` requires `BookBeautySpaServiceInput.branchId`.

`src/products/beauty-spa-v2/service.ts:159-170` creates the Beauty appointment with `branchId: input.branchId`.

`src/products/beauty-spa-v2/__tests__/beauty-spa-v2-real-db.test.ts:573-584` reads back `beauty_appointments.branch_id` and expects it to equal the branch used in the test.

Status:

```text
BEAUTY_H8_APPOINTMENT_BRANCH = PROVEN
```

### 2. Beauty H8 SESSION_DONE finance payload uses appointment branch

`src/products/beauty-spa-v2/finance-outbox.ts:20-38` builds a `SESSION_DONE` event where `payload.branchId = input.appointment.branchId`.

`src/app/api/cron/accounting-worker/route.ts:580-599` records Beauty completed-service receivable metadata using `appointment.branch_id`.

`src/__tests__/accounting-outbox.test.ts:598-610` and `src/__tests__/accounting-outbox.test.ts:726-746` cover the Beauty H8 `SESSION_DONE` branch payload in worker expectations.

Status:

```text
BEAUTY_H8_SESSION_DONE_BRANCH_FINANCE = PROVEN_STATIC
```

### 3. Current legacy attendance table has no branch_id

`supabase/migrations/20260511000000_initial_schema.sql:188-198` creates `attendance` with `ktv_id`, `date`, timestamps, `shift_id`, `status`, and `tenant_id`; no `branch_id`.

`src/types/database.types.ts:1366-1396` generated `attendance` Row/Insert/Update has no `branch_id`.

`src/modules/hr-salary/actions/salary-recalculation-engine.ts:296-302` queries attendance by `ktv_id`, `tenant_id`, and date range only.

Status:

```text
ATTENDANCE_BRANCH_ID = NOT_PROVEN
```

### 4. Current legacy salary_records table has no branch_id

`supabase/migrations/20260511000000_initial_schema.sql:171-184` creates `salary_records` with KTV/month/salary/status/tenant fields; no `branch_id`.

`src/types/database.types.ts:30446-30545` generated `salary_records` Row/Insert/Update has no `branch_id`.

`src/modules/hr-salary/actions/salary-recalculation-engine.ts:625-631` finds salary records by `ktv_id`, `month_year`, and `tenant_id` only.

`src/modules/hr-salary/actions/salary-recalculation-engine.ts:1148-1166` inserts/updates salary records with salary component fields and `tenant_id`; no branch field is written.

Status:

```text
SALARY_RECORDS_BRANCH_ID = NOT_PROVEN
```

### 5. Current legacy commission sources have no branch_id

`src/types/database.types.ts:30587-30650` generated `session_logs` Row/Insert has no `branch_id`.

`src/types/database.types.ts:7549-7590` generated `booking_service_items` Row/Insert has no `branch_id`.

`src/types/database.types.ts:26672-26715` generated `product_sales` Row/Insert has no `branch_id`.

`src/modules/hr-salary/actions/salary-recalculation-engine.ts:307-314` queries completed sessions by KTV, tenant, status, and date.

`src/modules/hr-salary/actions/salary-recalculation-engine.ts:582-589` queries service commission by KTV, tenant, status, and date.

`src/modules/hr-salary/actions/salary-recalculation-engine.ts:596-603` queries product sales commission by KTV, tenant, status, and date.

Status:

```text
COMMISSION_SOURCE_BRANCH_ID = NOT_PROVEN
```

### 6. SALARY_PAID payload currently uses tenant identity as branch identity

`src/lib/business-rules/accounting-outbox.ts:84-105` builds `SALARY_PAID` and writes:

```text
payload.branchId = input.tenantId
```

This contradicts the target contract if the target contract is:

```text
payload.branchId = salary_records.branch_id
```

because `salary_records.branch_id` is not present in current generated types.

Status:

```text
SALARY_PAID_BRANCH_PAYLOAD = INCONSISTENT_WITH_TARGET_CONTRACT
```

### 7. Finance sink writes whatever branchId it receives

`src/app/api/cron/accounting-worker/route.ts:866-876` passes `payload.branchId` into `RevenueRecognitionService.handleSalaryPaid`.

`src/services/revenue-recognition.ts:226-249` writes that `branchId` into both salary payment journal lines.

`src/types/database.types.ts:21580-21610` confirms `journal_lines.branch_id` exists.

This proves the Finance sink can store a branch, but does not prove the branch source is canonical.

Status:

```text
FINANCE_BRANCH_SINK = EXISTS
FINANCE_BRANCH_SOURCE_FOR_SALARY_PAID = NOT_PROVEN
```

### 8. Beauty V2 payroll/commission Real DB proof is tenant-scoped, not branch-scoped

`src/__tests__/beauty-v2-go-live-payroll-commission-real-db.test.ts:231-239` inserts attendance without branch.

`src/__tests__/beauty-v2-go-live-payroll-commission-real-db.test.ts:242-249` inserts session log without branch.

`src/__tests__/beauty-v2-go-live-payroll-commission-real-db.test.ts:292-309` reads salary record fields without branch.

`src/__tests__/beauty-v2-go-live-payroll-commission-real-db.test.ts:337-370` proves cross-tenant rejection / hidden salary rows, not branch isolation.

Status:

```text
BEAUTY_V2_PAYROLL_COMMISSION_REAL_DB = PROVEN_FOR_TENANT_SCOPE
BEAUTY_V2_PAYROLL_COMMISSION_BRANCH_REAL_DB = NOT_PROVEN
```

### 9. Generated database types do not include Beauty H8 tables

A targeted search found no `beauty_appointments` or `beauty_sessions` entries in `src/types/database.types.ts`.

This does not refute the H8 migration or Real DB tests, but it means generated type evidence is not synchronized with the H8 persistence evidence.

Status:

```text
BEAUTY_H8_GENERATED_TYPES = NOT_FOUND
```

## Layer Matrix

| Layer | Contract | Implementation | Runtime Mapping | Branch Isolation | Real DB | Gate |
| --- | --- | --- | --- | --- | --- | --- |
| Chain | PARTIAL | Platform/foundation chain exists elsewhere; Beauty V2 uses branch IDs internally | NOT_PROVEN from Platform Chain canonical source | NOT_PROVEN | PARTIAL | PARTIAL |
| Attendance | NOT_PROVEN | Legacy attendance exists | No branch mapping found | NOT_PROVEN | Tenant proof exists in payroll test | NOT_PROVEN |
| Payroll | NOT_PROVEN | Legacy salary engine exists | KTV + tenant + month, no branch | NOT_PROVEN | Tenant-scoped salary proof exists | NOT_PROVEN_FOR_BRANCH |
| Commission | NOT_PROVEN | Legacy session/service/product commission exists | KTV + tenant + date, no branch | NOT_PROVEN | Tenant-scoped commission proof exists | NOT_PROVEN_FOR_BRANCH |
| Finance | PARTIAL | H8 SESSION_DONE path branch-aware; SALARY_PAID sink accepts branch | SESSION_DONE branch proven; SALARY_PAID branch source inconsistent | NOT_PROVEN for salary branch | SESSION_DONE proven; salary-paid branch proof missing | PARTIAL |

## Direct Answer

Question:

```text
Does branch_id flow through Attendance -> Payroll -> Commission -> Finance by the same canonical branch truth?
```

Answer:

```text
NO, NOT PROVEN IN CURRENT CODEBASE.
```

More precise:

```text
Beauty H8 SESSION_DONE branch path:
  PROVEN_STATIC and supported by Real DB H8 read-back.

Legacy Attendance -> Payroll -> Commission -> SALARY_PAID branch path:
  NOT_PROVEN and currently inconsistent with the target salary branch contract.
```

## What This Does Not Mean

This audit does not prove:

- Production is broken.
- Beauty V2 H8 completion is broken.
- Beauty V2 `SESSION_DONE` finance integration is broken.
- Tenant isolation for payroll/commission is broken.
- A migration is authorized.
- A new Finance implementation is authorized.

It only proves that the branch contract requested for payroll / commission / salary-paid finance is not currently sealed by code/schema/test evidence.

## Required Negative Evidence Status

| Negative case | Status | Reason |
| --- | --- | --- |
| NULL branch rejection for attendance | NOT_PROVEN | No branch column / branch input found on legacy attendance path |
| NULL branch rejection for salary_records | NOT_PROVEN | No branch column in current generated type |
| Multi-branch payroll period rejection | NOT_PROVEN | Salary engine aggregates by KTV/tenant/month, not branch |
| Attendance branch -> salary branch mismatch rejection | NOT_PROVEN | No attendance branch or salary branch field in current path |
| Commission source branch -> salary branch mismatch rejection | NOT_PROVEN | Commission source branch fields not found in generated types |
| Cross-tenant payroll isolation | PROVEN/PARTIAL | Real DB test covers cross-tenant salary row visibility when JWT env exists |
| Cross-branch payroll isolation | NOT_PROVEN | No branch-scoped payroll proof found |
| Deny-before-side-effect for branch mismatch | NOT_PROVEN | No branch mismatch validation path found |
| Salary-paid journal branch read-back | NOT_PROVEN | Finance writes supplied branch, but source is `tenantId` in legacy builder |

## Decision

```text
STATUS = DEFER_IMPLEMENTATION
REASON = CONTRACT_GAP_CONFIRMED
```

Do not code until architecture ownership is decided.

The current system has two branch truths:

```text
H8 Beauty session branch:
  appointment.branchId / beauty_appointments.branch_id

Legacy payroll salary branch:
  not present; SALARY_PAID currently substitutes tenantId into branchId
```

The next action must decide whether payroll branch ownership belongs to:

1. Legacy HR salary tables,
2. Beauty H8 session / appointment source tables,
3. Platform Chain membership / org assignment,
4. A read-only mapping layer from KTV/date/session to branch,
5. Or no branch-level payroll/commission contract for the current product gate.

## Minimal Next Gate

```text
ONE NEXT GATE =
BEAUTY_V2_PAYROLL_BRANCH_OWNERSHIP_DECISION
```

Root Cause:

```text
Beauty H8 branch identity exists, but legacy payroll/commission/salary-paid finance does not consume a canonical branch identity.
```

Minimal Fix:

```text
No runtime fix now.
Create a human-reviewed ownership decision that chooses the canonical branch source for payroll/commission salary payment.
```

Verify:

```text
After ownership is decided, add one minimal branch proof:
same tenant, two branches, one KTV/session/salary period,
one allowed branch path,
one mismatch rejection before salary/finance side effects,
and one journal_lines.branch_id read-back.
```

Seal:

```text
Seal only the payroll/commission/salary-paid branch contract.
Do not reopen Beauty H8 SESSION_DONE, Finance F3/F5, Haircut, Nail, English, BabyCare, or production gates.
```

Stop:

```text
Stop after this one ownership decision + proof gate.
```

## Final Status Constants

```text
BEAUTY_H8_APPOINTMENT_BRANCH = PROVEN
BEAUTY_H8_SESSION_DONE_BRANCH_FINANCE = PROVEN_STATIC

BEAUTY_V2_ATTENDANCE_BRANCH = NOT_PROVEN
BEAUTY_V2_PAYROLL_BRANCH = NOT_PROVEN
BEAUTY_V2_COMMISSION_BRANCH = NOT_PROVEN
BEAUTY_V2_SALARY_PAID_FINANCE_BRANCH = NOT_PROVEN

BEAUTY_V2_PAYROLL_COMMISSION_TENANT_PROOF = PROVEN_PARTIAL
BEAUTY_V2_PAYROLL_COMMISSION_BRANCH_PROOF = NOT_PROVEN

BEAUTY_V2_BRANCH_CONTRACT_CONSISTENCY = NOT_PROVEN
BEAUTY_V2_BRANCH_PAYROLL_COMMISSION_FINANCE_GATE = DEFER_IMPLEMENTATION
```
