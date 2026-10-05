# Architecture Gate Result - Beauty V2 Attendance Gate

Status: DEFER_HISTORICAL_AUDIT_RESULT
Date: 2026-10-04
Scope: Audit + minimal proof decision only

Superseded by `ARCHITECTURE_GATE_RESULT_BEAUTY_V2_ATTENDANCE_IMPLEMENTATION_GATE_2026_10_04.md`, where the authorized implementation slice and Real DB proof move Attendance Gate to `PROVEN`.

This gate does not reopen Platform Chain. Platform Chain adoption is treated as sealed. This gate asks whether Beauty V2 can prove staff/KTV attendance with Platform branch context, branch isolation, tenant isolation, real DB read-back, and zero current-run cleanup residual.

## Bella OS / Product Development Process Gate

```text
Truth
  -> Source of Truth
  -> Canonical Contract
  -> Ownership
  -> Boundary
  -> Change Authority
  -> Minimal Implementation
  -> Verification
  -> Evidence
```

Result:

```yaml
truth: Staff attendance is currently represented by legacy public.attendance and attendance-actions.
source_of_truth:
  - supabase/migrations/20260511000000_initial_schema.sql
  - src/types/database.types.ts
  - src/services/attendance-actions.ts
  - docs/architecture/H8_ARCHITECTURE_GATE_RESULT.md
  - docs/architecture/H7_BEAUTY_OS_PERSISTENCE_MAPPING.md
  - docs/architecture/H4_1_PROFESSIONAL_ASSIGNMENT_OWNERSHIP.md
canonical_contract: NOT_PROVEN_FOR_BRANCH_AWARE_BEAUTY_V2_ATTENDANCE
owner: Workforce/Attendance
consumer: Beauty V2, Payroll, Commission
change_authority: Audit only; no runtime code, migration, Payroll, Commission, or Chain work authorized.
decision: DEFER_PENDING_WORKFORCE_ATTENDANCE_BRANCH_CONTRACT
```

## Product Manifest

```yaml
product: BEAUTY_V2
gate: Attendance
requested_flow:
  - Platform Branch Context
  - Employee / KTV
  - Check-in / Check-out
  - branch isolation
  - tenant isolation
  - real DB read-back
  - denied operation has no wrong side effect
  - current proof cleanup residual = 0
explicitly_out_of_scope:
  - Platform Chain changes
  - Beauty Chain changes
  - Payroll implementation
  - Commission implementation
  - Beauty-owned attendance subsystem
  - new attendance migration before ownership/contract approval
  - Preschool / Healthcare / Education / Logistics changes
```

## Ownership Map

| Fact | Owner | Current evidence | Gate status |
|---|---|---|---|
| Platform branch, membership, role/scope, authorization | Platform Chain | Sealed before this gate | SEALED / NOT_REOPENED |
| Staff attendance fact: presence, absence, late arrival, leave-derived attendance | Workforce/Attendance | H8 and H4.1 docs assign this outside Beauty OS | OWNED_OUTSIDE_BEAUTY |
| Appointment/session/actual performer | Beauty OS | Beauty service and H8 scope | CONSUMER_OF_ATTENDANCE_FACTS |
| Payroll and commission | Downstream financial/payroll owners | H8/H7 boundaries | NOT_OPENED |

## Contract Dependency Map

Required target flow:

```text
Beauty V2 operation
  -> Platform Branch Context
  -> Workforce Attendance Contract
  -> Platform Chain authorization
  -> branch-scoped attendance write/read
  -> Beauty/Payroll/Commission consumers
```

Observed current flow:

```text
getCurrentUser()
  -> user.tenant_id
  -> public.attendance
  -> ktv_id + tenant_id + date
```

Gap:

```text
Platform Branch Context
  X
public.attendance write/read
```

## Evidence Matrix

| Required proof | Evidence found | Result |
|---|---|---|
| KTV Branch A can check in/out at Branch A | `ktvCheckIn`/`ktvCheckOut` write/read by `ktv_id`, `tenant_id`, and date only | NOT_PROVEN |
| Branch A KTV cannot write Branch B attendance | `public.attendance` has no `branch_id`; `users` and `shifts` in the initial schema have no branch dimension | NOT_PROVEN |
| Cross-tenant denied | actions and policies use `tenant_id`; prior tests assert tenant/identity predicates | PARTIAL_STATIC_PROVEN |
| Read-back employee + branch + tenant | employee and tenant can be read; branch cannot be read because attendance row has no branch field | NOT_PROVEN |
| No side effect on branch authorization fail | no branch authorization boundary exists in attendance write path | NOT_PROVEN |
| Real DB cleanup residual = 0 | no current-run Real DB attendance proof was executed | NOT_PROVEN |

## Concrete Findings

### 1. Beauty V2 does not currently own or expose Attendance

`src/products/beauty-spa-v2/service.ts` wires booking, resource, waitlist, finance handoff, and payroll handoff classification. It does not expose an attendance port or Workforce Attendance consumer.

Decision:

```yaml
beauty_v2_attendance_runtime: NOT_PRESENT
beauty_v2_attendance_owner: false
```

### 2. Existing staff attendance action is tenant/KTV/date scoped, not branch scoped

`src/services/attendance-actions.ts`:

```text
getKTVTodayAttendance -> attendance where ktv_id, tenant_id, date
ktvCheckIn           -> insert ktv_id, date, checkin_time, status, tenant_id
ktvCheckOut          -> update existing row by id and tenant_id
```

There is no Platform branch context input and no Platform Chain authorization call in the attendance write path.

Decision:

```yaml
runtime_mapping_to_branch: NOT_PROVEN
branch_authorization: NOT_PRESENT
```

### 3. Current `attendance` schema cannot prove Branch A vs Branch B

`supabase/migrations/20260511000000_initial_schema.sql` creates `attendance` with:

```text
id
ktv_id
date
checkin_time
checkout_time
shift_id
status
tenant_id
UNIQUE(ktv_id, date)
```

Generated DB types match this shape. There is no `branch_id` on `attendance`. `shifts` also lacks `branch_id` in the same initial schema, so `shift_id` is not a proven branch derivation path.

Decision:

```yaml
branch_readback: IMPOSSIBLE_WITH_CURRENT_ATTENDANCE_ROW
branch_isolation_proof: NOT_PROVEN
```

### 4. Existing Beauty Payroll/Commission proof seeds attendance directly

`src/__tests__/beauty-v2-go-live-payroll-commission-real-db.test.ts` inserts directly into `attendance` using `tenant_id`, `ktv_id`, date, and check-in/out timestamps, then proves payroll/commission read-back. It does not prove check-in/check-out authorization, branch context, Branch A/Branch B isolation, or no side effect on denied branch access.

Decision:

```yaml
payroll_commission_existing_evidence: DOES_NOT_SEAL_ATTENDANCE_GATE
```

### 5. Nail staff proof is not sufficient for Beauty V2 Branch Attendance

`src/products/nail/__tests__/nail-staff-real-db.test.ts` proves existing staff attendance with tenant + technician read-back. It does not carry Platform Branch Context and does not exercise Branch A vs Branch B denial.

Decision:

```yaml
nail_reference: TENANT_STAFF_ATTENDANCE_ONLY
beauty_branch_attendance_reference: INSUFFICIENT
```

## Root Cause

```text
Beauty V2 Attendance Gate is blocked because the current Workforce/Attendance surface is tenant-scoped, not Platform-branch-scoped.

There is no proven canonical contract that maps:

Platform Branch Context
  -> Workforce Attendance check-in/out
  -> public.attendance branch read-back
  -> branch authorization and isolation
```

This is not a Beauty Chain gap and not a Payroll gap.

## Additive Migration Plan

```yaml
status: NOT_AUTHORIZED_IN_THIS_GATE
reason: Ownership/contract is not proven yet.
allowed_now:
  - audit
  - documentation
  - contract decision
forbidden_now:
  - ALTER public.attendance
  - create beauty_attendance
  - create Beauty-specific Workforce subsystem
  - attach branch_id ad hoc to Beauty records to bypass Workforce ownership
```

If the owner approves a Workforce/Attendance branch contract later, any schema change must be an additive, owner-approved migration with real DB proof.

## Eleven Automated Verification Gates Plan

These gates define the minimum future proof. They are not passed by this audit.

| Gate | Future verification requirement | Current status |
|---|---|---|
| 1 | Architecture ownership: Workforce/Attendance owns attendance; Beauty consumes | PARTIAL_DOC_PROVEN |
| 2 | Public contract: branch-aware attendance check-in/out contract exists | NOT_PROVEN |
| 3 | Platform Chain authorization before attendance write | NOT_PROVEN |
| 4 | Branch A KTV check-in/out at Branch A succeeds | NOT_PROVEN |
| 5 | Branch A KTV write to Branch B is denied before write | NOT_PROVEN |
| 6 | Tenant A write/read against Tenant B is denied | PARTIAL_STATIC_PROVEN / REAL_DB_PENDING |
| 7 | Read-back includes employee + branch + tenant | NOT_PROVEN |
| 8 | Denied branch operation creates no attendance/audit/payroll side effect | NOT_PROVEN |
| 9 | Payroll remains unopened until Attendance passes | PASS_THIS_GATE |
| 10 | Commission remains unopened until Attendance/Payroll pass | PASS_THIS_GATE |
| 11 | Real DB cleanup current proof residual = 0 | NOT_RUN |

## Verification Performed

```yaml
static_audit:
  status: COMPLETE
  evidence:
    - src/services/attendance-actions.ts
    - src/__tests__/attendance-auth-context.test.ts
    - src/__tests__/attendance-actions.test.ts
    - src/__tests__/beauty-v2-go-live-payroll-commission-real-db.test.ts
    - src/products/nail/__tests__/nail-staff-real-db.test.ts
    - supabase/migrations/20260511000000_initial_schema.sql
    - supabase/migrations/20260522000000_enable_attendance_rls.sql
    - supabase/migrations/20260518000000_disable_attendance_rls.sql
    - supabase/migrations/20260525000000_security_hardening.sql
    - supabase/migrations/20260810235000_create_attendances.sql
    - src/types/database.types.ts
unit_tests:
  status: NOT_RUN_ENV_DEPENDENCY_MISSING
  attempts:
    - "npm test -- --runInBand src/__tests__/attendance-auth-context.test.ts src/__tests__/attendance-actions.test.ts -> jest not recognized in isolated worktree"
    - "main checkout jest binary from isolated worktree -> config could not resolve next from isolated worktree"
real_db:
  status: NOT_RUN
  reason: Branch-aware contract missing; running Real DB proof would create a false PASS.
```

## Gate Decision

```yaml
Beauty_V2_Attendance_Gate: DEFER
Attendance_Runtime_Mapping: NOT_PROVEN
Attendance_Branch_Isolation: NOT_PROVEN
Attendance_Tenant_Isolation: PARTIAL_STATIC_PROVEN
Real_DB_Attendance_Proof: NOT_RUN
Payroll: NOT_OPENED
Commission: NOT_OPENED
Platform_Chain: SEALED_UNCHANGED
Beauty_Chain: SEALED_UNCHANGED
Implementation_Authorized: false
```

## Minimal Next Step

Do not code Payroll or Commission.

Do not create `beauty_attendance`.

The next authorized architecture step is to define or locate a Workforce/Attendance public contract that can consume Platform Branch Context:

```text
actor/user
  -> tenant
  -> Platform branch org_unit
  -> membership/scope authorization
  -> check-in / check-out
  -> branch-scoped attendance persistence
  -> read-back employee + branch + tenant
```

Only after that contract is approved should a minimal Real DB proof be implemented:

```text
Branch A KTV -> Branch A attendance PASS
Branch A KTV -> Branch B attendance DENY
Tenant A -> Tenant B DENY
denied operation -> no side effect
cleanup current proof -> 0
```

Until then:

```text
Beauty V2 Attendance = NOT_PROVEN
Beauty V2 Go-Live    = NOT_READY
```
