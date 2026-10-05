# Architecture Gate Result - Beauty V2 Attendance Implementation Gate

Status: ATTENDANCE_GATE_PROVEN
Date: 2026-10-04
Scope: Minimal Attendance branch-aware implementation slice; no Payroll, Commission, Governance, Chain, or Finance expansion

This follows `ARCHITECTURE_GATE_RESULT_BEAUTY_V2_ATTENDANCE_GATE_2026_10_04.md`. Platform Chain remains sealed. Payroll and Commission remain closed.

## Gate Result

```yaml
Attendance_Contract_Audit: COMPLETE
Branch_Strategy: PERSIST_BRANCH_ID_ON_ATTENDANCE_EVENT
Runtime_Implementation: MINIMAL_BRANCH_AWARE_SLICE_IMPLEMENTED
Migration: CREATED_NULLABLE_NO_BACKFILL
Unit_Proof: PASS_25_25
Changed_TypeScript: PASS_ZERO_DIAGNOSTICS
Real_DB_Proof: PASS
Automated_Proof_Command: PASS
Cleanup_Current_Proof: PASS_AUTOMATED_ZERO_RESIDUAL
Payroll: NOT_OPENED
Commission: NOT_OPENED
Chain: SEALED_UNCHANGED
Attendance_Gate: PROVEN
```

## Problem

Beauty V2 Attendance must be able to prove that each staff/KTV attendance event belongs to the correct Platform Branch at the time the event is recorded.

Required proof target:

```text
User / Staff
  -> Platform membership / branch access
  -> authorized branch context
  -> attendance mutation
  -> read-back employee + branch + tenant
  -> branch and tenant isolation
```

Pre-implementation runtime shape:

```text
public.attendance
  -> ktv_id
  -> tenant_id
  -> date
```

The current shape cannot prove branch ownership for an attendance event.

## Product Manifest

```yaml
product: BEAUTY_V2
gate: Attendance Implementation Contract
authorized_now:
  - additive nullable public.attendance.branch_id
  - branch-aware KTV attendance write/read path
  - branch-aware admin override path when branchId is supplied
  - unit proof
  - Real DB proof artifact
not_authorized_now:
  - create beauty_attendance
  - Payroll
  - Commission
  - Platform Chain changes
  - legacy backfill without canonical historical branch source
```

## Ownership Map

| Fact | Owner | Contract result |
|---|---|---|
| Branch org unit, membership, role/scope authorization | Platform Chain / Platform Authorization | Consume only; do not fork |
| Staff attendance event | Workforce/Attendance | Owns write contract and attendance persistence |
| Beauty appointment/session/actual performer | Beauty OS | Consumer/related workflow only |
| Payroll | Payroll owner | Closed until Attendance proof passes |
| Commission | Commission/Finance owner | Closed until Attendance/Payroll proof allows it |

## Current Attendance Producers

| Producer | File | Current behavior | Branch status |
|---|---|---|---|
| KTV check-in | `src/services/attendance-actions.ts` lines 157-210 | Inserts `ktv_id`, `date`, `checkin_time`, `status`, `tenant_id` | Missing branch |
| KTV check-out | `src/services/attendance-actions.ts` lines 214-262 | Reads by `ktv_id`, `date`, `tenant_id`; updates `checkout_time` | Missing branch |
| Admin override | `src/services/attendance-actions.ts` lines 333-397 | Upserts attendance by `ktvId`, `date`, `tenant_id` payload | Missing branch |
| Leave approval | `src/services/attendance-actions.ts` lines 620-817 | Creates/updates absent or half-day attendance from approved leave | Missing branch |
| Tests/seeds | Beauty V2 payroll proof, Nail staff/payroll proofs, salary helpers, seed scripts | Directly insert/delete/read `attendance` | Test-only; not runtime enforcement |

Additional producer gap:

```yaml
ktvCheckIn_existing_lookup_tenant_filter: MISSING
adminOverride_existing_lookup_tenant_filter: MISSING
approveLeaveRequest_existing_lookup_tenant_filter: MISSING
```

These are not fixed in this contract audit, but the implementation slice must not preserve them in the branch-aware write path.

## Current Attendance Readers / Consumers

| Consumer | File | Current read pattern | Branch impact |
|---|---|---|---|
| KTV today attendance | `src/services/attendance-actions.ts` | `ktv_id + tenant_id + date` | Can remain branch-neutral for current-day personal status if write path persists branch |
| Monthly attendance summary | `src/services/attendance-actions.ts` | tenant month scan | Must remain tenant-level by default; branch filter can be additive later |
| KTV checkout alert | `src/services/notification-helpers.ts` | `ktv_id + date range + checkout_time is null` | No branch reporting today |
| Leave decision | `src/services/leave-decision.service.ts` | `ktv_id + last 90 days` | No branch reporting today |
| Monthly PnL | `src/core/services/finance/monthly-pnl-report.ts` | tenant month scan | Payroll/finance consumer; must not open now |
| HR intelligence | `src/services/intelligence/hr/queries-simple.ts` | tenant month scan | Existing tenant aggregate should keep working |
| Payroll employee detail | `src/app/api/payroll/employees/[employeeId]/detail/route.ts` | employee month scan | Must keep working with additive branch column |
| Salary recalculation | `src/modules/hr-salary/actions/salary-recalculation-engine.ts` | `ktv_id + tenant_id + month` | Payroll remains closed |
| Salary query | `src/modules/hr-salary/actions/query-salary-actions.ts` | tenant month scan | Payroll remains closed |

Consumer impact result:

```yaml
adding_nullable_branch_id: LOW_CONSUMER_BREAK_RISK
reason: existing readers select explicit fields or tolerate extra columns from select('*')
branch_filtered_reporting: NOT_IN_THIS_SCOPE
```

## Platform Branch / Membership Evidence

Platform already has a reusable current-authorization projection:

```text
public.user_org_unit_access
  <- people_directory.user_id
  <- org_relationships person -> org unit
  <- org_units hierarchy
  <- users.role admin expansion
```

Evidence:

- `supabase/migrations/20260914_create_user_org_unit_access_projection.sql` defines it as Platform Authorization projection.
- The projection filters relationship dates using `CURRENT_DATE`.
- Generated DB types expose `user_org_unit_access` as a view with `user_id`, `tenant_id`, `org_unit_id`, `root_org_unit_id`, `relationship_id`, and `access_source`.

Important limitation:

```text
user_org_unit_access proves current/effective access.
It does not persist which branch was used by a historical attendance event.
```

Therefore it can authorize a write, but it cannot by itself be the historical attendance fact.

## Persist vs Resolve Decision

### Option A - Persist branch on attendance event

Decision:

```yaml
status: REQUIRED_FOR_BEAUTY_V2_ATTENDANCE
contract_shape:
  public.attendance.branch_id: UUID nullable for legacy rows
  new_branch_aware_writes: branch_id required at service boundary
  branch_identity: Platform org_units.id
```

Why:

- Attendance must prove the branch at event write time.
- Current membership projection is date-relative and can drift when relationships change.
- Existing `shift_id` cannot derive branch because `shifts` has no branch dimension.
- Payroll/Commission later need stable branch facts; they must not infer from current membership.
- Read-back requirement explicitly includes employee + branch + tenant.

Minimum future schema shape:

```text
public.attendance
  -> tenant_id
  -> ktv_id
  -> branch_id
  -> date
  -> checkin_time
  -> checkout_time
  -> status
```

Recommended constraints for the implementation gate:

```yaml
branch_id:
  references: public.org_units(id)
  nullable_for_legacy_rows: true
  required_for_new_Beauty_V2_branch_aware_writes: true
indexes:
  - attendance(tenant_id, branch_id, date)
  - attendance(tenant_id, ktv_id, date)
uniqueness:
  keep_existing: UNIQUE(ktv_id, date)
  reason: changing same-day multi-branch semantics is not required for this gate
tenant_match:
  required: true
  note: enforce in service proof and, if available, DB constraint/trigger/RLS in implementation plan
```

### Option B - Resolve branch only from membership/context

Decision:

```yaml
status: REJECTED_FOR_THIS_GATE
reason: does not prove historical branch ownership of attendance events
```

Why:

- `user_org_unit_access` uses current/effective relationship dates, not attendance event timestamps.
- A staff member can move branches later; historical attendance would drift if branch is resolved only at read time.
- Existing `attendance` rows have no branch read-back field.
- Existing consumers and Payroll/Commission would risk using current branch, not event branch.

## Implementation Contract

The minimal future runtime implementation must follow this flow:

```text
Attendance command
  -> actor user
  -> tenant
  -> requested branchId
  -> assert branchId is accessible via Platform authorization / BeautyChainAccessPort
  -> write public.attendance with branch_id = authorized branchId
  -> read back attendance row by id/tenant/branch
```

All branch denial must happen before any mutation.

Forbidden:

```text
beauty_attendance table
Beauty-local permission subsystem
direct test fixture as proof
Payroll or Commission side-effect during Attendance proof
Chain architecture changes
```

## Implemented Minimal Slice

Implemented after explicit implementation authorization:

1. Added additive nullable `public.attendance.branch_id` schema support.
2. Did not backfill legacy attendance records.
3. Added branch-aware KTV check-in/check-out path with Platform org/people authorization before mutation.
4. Added branch-aware KTV read wrapper.
5. Added branch-aware admin override support when `branchId` is supplied.
6. Added tenant predicate to legacy attendance lookups touched by the slice.
7. Added unit proof for allow/deny/no-side-effect.
8. Added Real DB proof file for Branch A allow, Branch B deny, cross-tenant deny, read-back, and cleanup intent.

Implemented files:

```text
supabase/migrations/20261004010000_add_branch_id_to_attendance.sql
src/services/attendance-actions.ts
src/types/database.types.ts
src/__tests__/attendance-actions.test.ts
src/__tests__/attendance-auth-context.test.ts
src/__tests__/beauty-v2-attendance-branch-real-db.test.ts
jest.real-db.config.ts
```

## Verification Evidence

```yaml
Unit:
  command: npx jest src/__tests__/attendance-actions.test.ts src/__tests__/attendance-auth-context.test.ts --runInBand
  result: PASS
  suites: 2
  tests: 25

TypeScript:
  command: npm run typecheck:changed
  result: PASS
  diagnostics: 0

Diff_Check:
  command: git diff --check
  result: PASS

Initial_Real_DB:
  command: npx jest --config jest.real-db.config.ts src/__tests__/beauty-v2-attendance-branch-real-db.test.ts --runInBand
  result: NOT_VERIFIED_ENV_BLOCKED
  blocker: NEXT_PUBLIC_SUPABASE_URL=mock.supabase.co and SUPABASE_SERVICE_ROLE_KEY=mock-service-role-key

E2E_Schema_Preflight:
  target: bella-spa-erp-e2e
  result: INITIALLY_BLOCKED
  evidence:
    public.org_units: MISSING
    public.attendance.branch_id: MISSING
    partial_migration_residual: 0

E2E_Platform_Baseline:
  baseline: supabase/migrations/20260801030000_foundation_org_people_schema.sql
  target: bella-spa-erp-e2e
  result: APPLIED
  read_back:
    public.org_units: PRESENT
    public.people_directory: PRESENT
    public.org_relationships: PRESENT
    public.people_profiles: PRESENT

E2E_Migration_Attempt:
  command: supabase db query --linked --project-ref bmnbqbcdbuklhopfbopv --file supabase/migrations/20261004010000_add_branch_id_to_attendance.sql
  result: PASS_AFTER_PLATFORM_BASELINE
  read_back:
    public.attendance.branch_id: PRESENT_NULLABLE
    attendance_branch_id_fkey: PRESENT
    idx_attendance_tenant_branch_date: PRESENT
    idx_attendance_tenant_ktv_date: PRESENT

Real_DB_Attendance_Proof:
  command: npx jest --config jest.real-db.config.ts src/__tests__/beauty-v2-attendance-branch-real-db.test.ts --runInBand
  result: PASS
  evidence:
    tests: 1 passed / 1 total
    Branch_A_check_in: PASS
    branch_id_persisted: PASS
    Branch_A_user_to_Branch_B: DENY
    Tenant_A_user_to_Tenant_B_branch: DENY
    denied_write_rows: 0
    Branch_A_check_out_same_branch: PASS
    automated_cleanup: PASS

Cleanup_Hygiene_Fix:
  result: PASS
  method: target-scoped SQL cleanup with increased statement_timeout plus auth admin delete in the Real DB proof harness
  reason: public.users and tenants are central FK boundaries that can exceed PostgREST statement_timeout during test teardown

Current_Proof_Residual_Check:
  command: marker-scoped SQL residual query after Real DB proof
  result: PASS
  residual:
    tenants: 0
    users: 0
    org_units: 0
    people_directory: 0
    attendance: 0
    auth_user: 0

Real_DB_Mock_Compile_Skip:
  command: npx jest src/__tests__/beauty-v2-attendance-branch-real-db.test.ts --runInBand
  result: PASS_SKIP
  suites: 1 skipped
  tests: 1 skipped

Migration_Check:
  command: npm run db:migration:check -- --help
  result: NOT_VERIFIED_ENV_BLOCKED
  blocker: LegacyProjectNotLinkedError

Non_E2E_Project_Read_Only_Check:
  result: NOT_USED_FOR_MUTATION
  evidence:
    public.org_units: PRESENT
    public.attendance.branch_id: MISSING
  reason: not the named E2E target; schema mutation requires explicit target authorization
```

## Residual Boundary

```yaml
Runtime_Mapping: REAL_DB_PROVEN
Branch_Isolation: REAL_DB_PROVEN
Tenant_Isolation: REAL_DB_PROVEN_FOR_BRANCH_AWARE_PATH
Real_DB_Read_Back: PASS
Cleanup_Current_Proof: PASS_AUTOMATED_ZERO_RESIDUAL
E2E_Schema_State: PLATFORM_BASELINE_APPLIED
Attendance_Gate: PROVEN
Beauty_V2_Go_Live: NOT_READY
```

The minimal slice is not a Go-Live seal. Real DB business assertions passed and automated current-proof cleanup returns zero residual.

## Gate Decision

```yaml
Attendance_Implementation_Contract: DEFINED
Branch_Persistence: REQUIRED
Branch_Resolve_Only: REJECTED_FOR_THIS_GATE
Runtime_Code: MINIMAL_BRANCH_AWARE_SLICE_IMPLEMENTED
Migration: CREATED_NULLABLE_NO_BACKFILL
Real_DB_Proof: PASS
Cleanup_Current_Proof: PASS_AUTOMATED_ZERO_RESIDUAL
Attendance_Gate: PROVEN
Payroll: NOT_OPENED
Commission: NOT_OPENED
Next_Allowed_Work: Payroll gate audit / proof may be opened separately
```

```text
Beauty V2 Attendance = PROVEN
Beauty V2 Go-Live    = NOT_READY
```
