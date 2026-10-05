# Architecture Gate Result - Beauty V2 Payroll Branch Ownership Decision

Date: 2026-10-05

Scope: OWNERSHIP DECISION ONLY

Gate:

```text
BEAUTY_V2_PAYROLL_BRANCH_OWNERSHIP_DECISION
```

This gate decides branch ownership for Beauty V2 payroll, commission, salary payment, and Finance salary-payment journals. It does not authorize runtime code, migration, generated type updates, Finance implementation, or Product refactor.

## Result

```text
GATE = PASS
OWNERSHIP_DECISION = ATTENDANCE_WORK_EVENT_BRANCH
CURRENT_IMPLEMENTATION = NOT_IMPLEMENTED
CURRENT_REAL_DB_PROOF = NOT_PROVEN
IMPLEMENTATION_AUTHORIZED = NO
```

Decision:

```text
The canonical branch for a Beauty V2 payroll / commission / SALARY_PAID event must be the historical work-event branch captured at the attendance / payroll-source event, then persisted onto the salary period record, then carried unchanged into SALARY_PAID and journal_lines.branch_id.
```

Target chain:

```text
Platform Chain
  -> authorizes branch context
Attendance / work event branch
  -> payroll salary_records.branch_id
Commission source branch
  -> must match payroll branch
SALARY_PAID.payload.branchId
  -> must equal salary_records.branch_id
Finance journal_lines.branch_id
  -> must equal SALARY_PAID.payload.branchId
```

Current code does not implement this chain yet. This is a decision about ownership, not a claim of current branch proof.

## Decision Summary

| Candidate | Decision | Reason |
| --- | --- | --- |
| Platform Chain membership | AUTHORIZATION ONLY | It decides whether a user/person can access a branch context. It must not be the historical owner of a paid salary event because membership/access can be current or time-bound. |
| Attendance / work event branch | CANONICAL OWNER | Payroll already derives salary penalties and work-day evidence from attendance/work facts. Branch should be captured with the work fact at the time it happened. |
| Beauty H8 appointment/session branch | SOURCE BRANCH FOR SERVICE/REVENUE, NOT PAYROLL OWNER | It owns service revenue branch and may supply commission source branch, but it must not replace payroll branch for non-appointment payroll. |
| HR employee profile / department | EMPLOYMENT CONTEXT ONLY | It may help default or validate, but it is not historical proof for a specific payroll event. |
| Mapping layer | DEFER / ONLY IF NEEDED | Only use if a payroll period must reconcile multiple historical source branches. Do not create it before a concrete mismatch case exists. |

## Evidence

### 1. Platform Chain is authorization/context, not historical payroll truth

`supabase/migrations/20260914_create_user_org_unit_access_projection.sql:2-14` names the view as Platform Authorization and says it is derived from `people_directory`, `org_relationships`, `org_units`, and role.

`supabase/migrations/20260914_create_user_org_unit_access_projection.sql:43-50` filters org relationships using `since <= CURRENT_DATE` and `until >= CURRENT_DATE`.

`supabase/migrations/20260914_create_user_org_unit_access_projection.sql:118-119` comments that `user_org_unit_access` is a Platform Authorization projection used by product RLS for branch/org-unit access.

`src/platform/org-unit/org-unit.engine.ts:228-244` still returns all active tenant units for accessible-units and marks relationship-based access as future work.

Decision:

```text
PLATFORM_CHAIN_ROLE = AUTHORIZE_CONTEXT
PLATFORM_CHAIN_IS_PAYROLL_EVENT_TRUTH = NO
```

### 2. Legacy payroll currently consumes attendance as the work-fact input

`src/modules/hr-salary/actions/query-salary-actions.ts:145-158` documents salary data as composed from `salary_records`, live sessions, composite ratings, attendance, and KPI records; attendance penalties are calculated from attendance.

`src/modules/hr-salary/actions/query-salary-actions.ts:353-363` reads `attendance` rows by tenant and month.

`src/modules/hr-salary/actions/query-salary-actions.ts:457-468` filters attendance by KTV and passes it into salary calculation.

`src/modules/hr-salary/actions/salary-recalculation-engine.ts:296-305` reads attendance rows by `ktv_id`, `tenant_id`, and period.

Decision:

```text
PAYROLL_SOURCE_WORK_FACT = ATTENDANCE
PAYROLL_BRANCH_TARGET_OWNER = ATTENDANCE_WORK_EVENT_BRANCH
```

### 3. Current attendance implementation lacks branch, so ownership is not implemented

`supabase/migrations/20260511000000_initial_schema.sql:188-198` creates legacy `attendance` with KTV/date/status/tenant fields and no `branch_id`.

`src/types/database.types.ts:1366-1396` generated `attendance` Row/Insert/Update has no `branch_id`.

`supabase/migrations/20260810235000_create_attendances.sql:9-57` creates plural `attendances`, but it is student/course attendance, not Beauty payroll attendance, and it also has no `branch_id`.

`src/types/database.types.ts:1435-1510` generated plural `attendances` has student/course/session fields and no payroll branch field.

Decision:

```text
ATTENDANCE_BRANCH_CURRENT = NOT_IMPLEMENTED
ATTENDANCE_BRANCH_OWNERSHIP = TARGET_DECISION
```

### 4. Salary period branch must be persisted, not inferred from current membership

`src/modules/hr-salary/actions/salary-recalculation-engine.ts:625-631` resolves existing salary records by `ktv_id`, `month_year`, and `tenant_id`.

`src/types/database.types.ts:30446-30545` generated `salary_records` has no `branch_id`.

`src/modules/hr-salary/actions/salary-recalculation-engine.ts:1148-1166` writes salary records with salary components and `tenant_id`, but no branch field.

Decision:

```text
SALARY_RECORD_BRANCH_TARGET = salary_records.branch_id
SALARY_RECORD_BRANCH_CURRENT = NOT_IMPLEMENTED
```

The payroll branch must be persisted on the salary record because Finance salary payment happens later. Later membership or current UI context must not be used to infer the historical branch.

### 5. Beauty H8 appointment branch is real but owns service/revenue branch, not payroll branch

`src/platform/beauty/infrastructure/beauty-h8.database.generated.ts:17-45` defines `beauty_appointments.branch_id`.

`src/platform/beauty/infrastructure/supabase-h8.repositories.ts:54-64` writes `appointment.branchId` into `beauty_appointments.branch_id`.

`src/platform/beauty/infrastructure/supabase-h8.repositories.ts:370-379` maps `beauty_appointments.branch_id` back to `AppointmentRecord.branchId`.

`src/products/beauty-spa-v2/finance-outbox.ts:20-38` writes Beauty H8 `SESSION_DONE.payload.branchId` from `input.appointment.branchId`.

Decision:

```text
BEAUTY_H8_APPOINTMENT_BRANCH = SERVICE_REVENUE_BRANCH
BEAUTY_H8_APPOINTMENT_BRANCH_AS_PAYROLL_OWNER = NO
```

Beauty H8 appointment branch may supply commission source branch for a completed service, but it cannot own payroll branch globally because payroll can include attendance, manual adjustments, product sales, and other work facts that are not necessarily one appointment.

### 6. Commission branch must match payroll branch before salary side effects

`src/modules/hr-salary/actions/salary-recalculation-engine.ts:307-314` reads completed `session_logs` by KTV, tenant, status, and period.

`src/modules/hr-salary/actions/salary-recalculation-engine.ts:582-589` reads `booking_service_items` commission by KTV, tenant, status, and period.

`src/modules/hr-salary/actions/salary-recalculation-engine.ts:596-603` reads `product_sales` commission by KTV, tenant, status, and period.

Current generated table types for `session_logs`, `booking_service_items`, and `product_sales` do not expose `branch_id` in the payroll path.

Decision:

```text
COMMISSION_BRANCH_TARGET = SOURCE_BRANCH_MUST_MATCH_SALARY_BRANCH
COMMISSION_BRANCH_CURRENT = NOT_IMPLEMENTED
```

If a payroll period contains multiple source branches for one KTV, the minimal correct behavior is one of:

```text
1. split salary by branch period; or
2. reject multi-branch salary approval before side effects.
```

This gate does not choose between split-vs-reject because current code has no branch fields to evaluate that case. That belongs to the implementation gate.

### 7. SALARY_PAID must use salary_records.branch_id, not tenantId

`src/core/services/finance/transaction-mutations.ts:345-356` enqueues `SALARY_PAID` by calling `buildSalaryPaidOutboxEvent`.

`src/core/services/accounting/business-health.ts:1488-1497` also repairs missing salary-paid side effects by calling `buildSalaryPaidOutboxEvent`.

`src/lib/business-rules/accounting-outbox.ts:84-105` currently sets `payload.branchId = input.tenantId` for `SALARY_PAID`.

`src/app/api/cron/accounting-worker/route.ts:866-876` passes `payload.branchId` into `RevenueRecognitionService.handleSalaryPaid`.

`src/services/revenue-recognition.ts:226-249` writes the received branch into salary payment journal lines.

Decision:

```text
SALARY_PAID_BRANCH_TARGET = salary_records.branch_id
SALARY_PAID_BRANCH_CURRENT = tenantId_SUBSTITUTION
SALARY_PAID_BRANCH_CURRENT_STATUS = MUST_NOT_BE_SEALED
```

## Ownership Contract

The ownership contract decided by this gate is:

```text
Platform Chain:
  Owns branch identity and authorization context.
  Does not own historical payroll event branch.

Attendance / Work Event:
  Owns historical branch where employee work fact occurred.
  Must be captured at event time.

Payroll:
  Owns salary period aggregation.
  Must persist branch_id on salary_records for a branch-owned salary period.

Commission:
  Owns source commission facts.
  Must carry source branch and match salary_records.branch_id before salary side effects.

Finance:
  Owns journal persistence.
  Must receive branchId from SALARY_PAID payload and write it unchanged to journal_lines.branch_id.
```

## Required Implementation Gate Later

No implementation is authorized by this file.

The later implementation gate must decide the smallest safe runtime shape:

```text
BEAUTY_V2_PAYROLL_BRANCH_MINIMAL_IMPLEMENTATION_GATE
```

Minimum questions for that future gate:

1. Add `branch_id` to legacy `attendance`, or introduce a branch-owned work-event table?
2. Add `branch_id` to `salary_records` and enforce single-branch period?
3. Add source branch to `session_logs`, `booking_service_items`, and `product_sales`, or bridge Beauty H8 source facts only?
4. For a KTV with multiple branches in a month, split salary records or reject approval before side effects?
5. How to backfill or classify existing historical salary rows without pretending they have branch proof?

## Verification Required Later

Future proof must include:

```text
same tenant
two branches
one KTV
one payroll period
one allowed branch path
one cross-branch mismatch rejection before side effects
one SALARY_PAID outbox read-back
one journal_lines.branch_id read-back
one tenant isolation negative
```

## Final Status Constants

```text
BEAUTY_V2_PAYROLL_BRANCH_OWNERSHIP_DECISION = PASS

PLATFORM_CHAIN_FOR_PAYROLL_BRANCH = AUTHORIZATION_CONTEXT
ATTENDANCE_WORK_EVENT_BRANCH = CANONICAL_OWNER_TARGET
BEAUTY_H8_APPOINTMENT_BRANCH_FOR_PAYROLL = NOT_OWNER
HR_EMPLOYEE_PROFILE_FOR_PAYROLL_BRANCH = NOT_OWNER
MAPPING_LAYER_FOR_PAYROLL_BRANCH = DEFER_UNTIL_CONCRETE_MULTI_SOURCE_CASE

CURRENT_ATTENDANCE_BRANCH = NOT_IMPLEMENTED
CURRENT_SALARY_RECORD_BRANCH = NOT_IMPLEMENTED
CURRENT_COMMISSION_SOURCE_BRANCH = NOT_IMPLEMENTED
CURRENT_SALARY_PAID_BRANCH = tenantId_SUBSTITUTION

IMPLEMENTATION_AUTHORIZED = NO
NEXT_GATE = BEAUTY_V2_PAYROLL_BRANCH_MINIMAL_IMPLEMENTATION_GATE
```
