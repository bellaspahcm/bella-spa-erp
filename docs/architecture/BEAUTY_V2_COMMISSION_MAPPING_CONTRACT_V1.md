# Beauty V2 Commission Mapping Contract V1

Status: DEFINED_PENDING_IMPLEMENTATION_GATE
Date: 2026-10-04
Scope: Commission mapping contract only; no Commission runtime change, no migration, no Finance, no Chain, no Attendance, no Payroll changes.

## Decision

```yaml
Commission_Mapping_Contract: DEFINED
Commission_Source_Branch_Required: true
Commission_Source_Branch_Source: SOURCE_TRANSACTION_BRANCH
Salary_Record_Branch_Source: PAYROLL_ATTENDANCE_BRANCH
Commission_Result_Branch_Rule: SOURCE_BRANCH_MUST_MATCH_SALARY_RECORD_BRANCH
Legacy_Null_Source_Branch: NOT_PROVEN
Legacy_Backfill: NOT_ALLOWED_WITHOUT_CANONICAL_SOURCE
Multi_Branch_Commission_Period: NOT_SUPPORTED_IN_V1
Commission_Runtime_Implementation: NOT_STARTED
Commission_Implementation_Authorized_By_This_Artifact: false
Commission_Gate: DEFER_PENDING_IMPLEMENTATION_PROOF
```

## Boundary

Chain, Attendance, and Payroll are sealed. Commission must consume their proven facts and the branch identity of each commission source transaction. Commission must not create a local chain, branch, membership, authorization, Finance, or payroll subsystem.

```text
Platform Branch
  -> authorized Beauty operation
  -> branch-proven commission source transaction
  -> commission calculation
  -> salary_records commission component
  -> salary_records.branch_id
```

This contract does not authorize code or schema changes. It defines the mapping a later minimal implementation gate must follow.

## Existing Evidence

Payroll branch attribution is already proven:

- `attendance.branch_id` is selected by Payroll.
- Payroll resolves exactly one branch for a KTV payroll period.
- `salary_records.branch_id` persists that Payroll branch.

Evidence:

- `src/modules/hr-salary/actions/salary-recalculation-engine.ts:336-349`
- `src/modules/hr-salary/actions/salary-recalculation-engine.ts:1174-1199`
- `src/types/database.types.ts:30462-30576`

Commission source attribution is not branch-proven yet:

- Session commission currently reads `session_logs` by tenant, KTV, status, and month.
- Service commission currently reads `booking_service_items` by tenant, KTV, status, and month.
- Product commission currently reads `product_sales` by tenant, KTV, status, and month.
- `booking_service_items` and `product_sales` do not carry branch identity.
- Generated `bookings` type does not expose `branch_id`; a `booking_id` alone is not branch truth.

Evidence:

- `src/modules/hr-salary/actions/salary-recalculation-engine.ts:351-358`
- `src/modules/hr-salary/actions/salary-recalculation-engine.ts:623-651`
- `src/modules/hr-salary/actions/salary-recalculation-engine.ts:915-932`
- `supabase/migrations/20260622163000_create_booking_service_items.sql:19-44`
- `supabase/migrations/20260622164000_create_product_sales.sql:19-44`
- `src/types/database.types.ts:7559-7657`
- `src/types/database.types.ts:7665-7817`
- `src/types/database.types.ts:26682-26786`

Beauty H8 has branch identity at appointment level:

```text
beauty_sessions.appointment_id
  -> beauty_appointments.branch_id
```

Evidence:

- `supabase/migrations/20260916000000_beauty_os_h8_persistence.sql:3-21`

But the current Commission engine does not yet prove that its legacy `session_logs` or advanced commission source rows map to that H8 appointment branch.

## Commission Source Branch Contract

Each commission source included in Beauty V2 Go-Live evidence must have a canonical branch at the source transaction level.

```text
Commission source row
  -> tenant_id
  -> ktv_id
  -> period date
  -> branch_id or proven H8 branch relation
  -> calculated commission amount
```

The following are not valid branch truth:

```text
current staff membership
current user profile branch
caller-provided branchId without source verification
salary_records.branch_id alone
booking_id alone when the parent booking has no branch
tenant_id alone
```

## Source Mapping Rules

### Session Commission

Current source:

```text
session_logs
  -> bookings.ktv_commission
```

Current status:

```yaml
session_logs_branch_identity: NOT_PROVEN
bookings_branch_identity: NOT_PRESENT_IN_GENERATED_TYPE
```

V1 canonical rule:

```text
session commission branch
  = branch of the completed Beauty source transaction
```

For H8-native Beauty sessions, the canonical branch path is:

```text
beauty_sessions.appointment_id
  -> beauty_appointments.branch_id
```

Legacy `session_logs` rows are branch-proven only if a future implementation can prove one of these without guessing:

```text
session_logs.branch_id
```

or

```text
session_logs
  -> verified one-to-one Beauty H8 session / appointment
  -> beauty_appointments.branch_id
```

Until then, legacy `session_logs` commission is not eligible for branch-proven Commission Gate evidence.

### Booking Service Item Commission

Current source:

```text
booking_service_items.calculated_commission
```

Current status:

```yaml
booking_service_items_branch_identity: NOT_PRESENT
```

V1 canonical rule:

```text
booking_service_items.branch_id
  = Platform Branch of the authorized service transaction at the time the source row is created
```

The branch may be derived at write time from a branch-proven Beauty booking or H8 appointment, but the source row used for Commission proof must carry or resolve a stable historical branch. Existing rows without branch identity remain legacy `NOT_PROVEN`.

### Product Sales Commission

Current source:

```text
product_sales.calculated_commission
```

Current status:

```yaml
product_sales_branch_identity: NOT_PRESENT
booking_id: OPTIONAL_NOT_BRANCH_TRUTH
```

V1 canonical rule:

```text
product_sales.branch_id
  = Platform Branch of the authorized product sale transaction at the time the source row is created
```

If a product sale is attached to a booking, that booking can help locate the source workflow only when the workflow has a proven branch. A nullable `booking_id` or a booking without branch identity is not enough.

### Salary Commission Snapshot

Current persisted result:

```text
salary_records
  -> branch_id
  -> session_bonus
  -> service_commission
  -> product_sales_commission
```

V1 canonical rule:

```text
salary_records.branch_id
  = Payroll branch from attendance.branch_id

commission source branch set
  = exactly one non-null branch

commission source branch
  = salary_records.branch_id
```

`salary_records.branch_id` is the branch of the saved payroll result. It does not, by itself, prove that every commission source row inside the result came from the same branch.

## V1 Validity Preconditions

A branch-aware Commission calculation is valid in V1 only when all included commission source rows satisfy:

```yaml
source_rows:
  tenant_id: matches salary tenant
  ktv_id: matches salary KTV
  period_date: inside salary month
  branch_id: non_null_or_proven_h8_branch_relation
  distinct_branch_count: 1

source_branch:
  equals: salary_records.branch_id
  authorized_by: Platform Chain branch scope before result write
```

If any included source row has no branch, multiple branches, cross-tenant branch, or a branch that mismatches the Payroll branch, Commission V1 must reject before writing or updating the salary commission result.

## Legacy Boundary

Legacy source rows without branch identity are not branch-proven.

```text
source.branch_id = NULL
or
source has no branch relation
```

Decision:

```yaml
branch_aware_commission: NOT_PROVEN
automatic_backfill: FORBIDDEN
allowed_action: exclude from Go-Live proof or block branch-aware Commission calculation
not_allowed: infer from current membership, latest attendance, tenant default, booking_id alone, or caller branch
```

This contract does not remove or rewrite historical tenant-scoped Commission behavior. It only defines the branch-aware path required for Beauty V2 Go-Live evidence.

## Multi-Branch Period Boundary

Commission V1 follows the sealed Payroll V1 boundary:

```text
one salary_records row
  -> one KTV
  -> one month
  -> one proven branch
```

If a KTV has commission source transactions in more than one branch during the same payroll month, V1 must reject or defer. It must not:

```text
choose the first branch
choose the latest branch
use current membership
split values without a branch-scoped salary model
silently mix sources into one branch
```

A future branch-split salary model is out of scope for V1.

## Minimal Future Implementation Gate

If this contract is accepted, a separate minimal implementation gate may proceed only inside this boundary:

```text
read branch-aware commission sources
  -> assert every included source has exactly one branch
  -> assert source branch matches Payroll salary branch
  -> preserve existing commission amount semantics
  -> persist/update salary commission components
  -> read back salary result with matching branch
```

Potential additive schema changes, if implementation proves they are required, must be minimal and nullable for legacy data:

```text
booking_service_items.branch_id
product_sales.branch_id
```

No automatic backfill is allowed unless a canonical historical source is proven. Adding `branch_id` to a table is not itself proof; runtime must write it from an authorized source transaction.

This contract does not require opening Finance and does not authorize direct Finance table writes.

## Required Negative Behavior

```text
Branch A source + Branch A salary context
  -> allow

Branch A source + Branch B salary context
  -> reject before salary commission write

Tenant A source + Tenant B branch context
  -> reject before salary commission write

NULL / missing source branch
  -> reject for branch-aware Commission proof

multi-branch source set
  -> reject / NOT_SUPPORTED_IN_V1

denied operation
  -> no salary_records mutation
```

## Proof Requirements

The future proof must include:

```yaml
Unit_Proof:
  - branch-proven source rows calculate and persist commission under the same salary branch
  - source branch mismatch rejects before salary write
  - cross-tenant branch/source rejects before salary write
  - null or missing source branch does not produce branch-proven commission
  - multi-branch commission source set is rejected in V1

Real_DB_Proof:
  - Platform Branch A commission source -> salary commission Branch A PASS
  - Branch A user/source -> Branch B commission operation DENY
  - Tenant A source -> Tenant B branch operation DENY
  - denied operation leaves salary_records unchanged
  - salary_records.branch_id matches both Payroll branch and Commission source branch
  - cleanup current proof residual = 0
```

Existing tenant-scoped payroll/commission tests do not satisfy this proof because they do not prove source branch identity.

## Non-Goals

```text
No Chain changes.
No Attendance changes.
No Payroll changes.
No Finance changes.
No commission runtime code in this artifact.
No migration in this artifact.
No historical source backfill.
No branch-split salary model.
No new commission authorization subsystem.
No Beauty-local chain, branch, membership, or permission subsystem.
```

## Gate Result

```yaml
Commission_Mapping_Contract: DEFINED
Commission_Runtime_Mapping: NOT_PROVEN
Commission_Branch_Isolation: NOT_PROVEN
Commission_Tenant_Isolation: PARTIAL_TENANT_SCOPED_ONLY
Commission_Implementation: NOT_STARTED
Commission_Implementation_Authorized_By_This_Artifact: false
Commission_Gate: DEFER_PENDING_IMPLEMENTATION_PROOF
Finance: NOT_OPENED
Beauty_V2_Go_Live: NOT_READY
```

Commission may proceed only through a separate minimal implementation gate that follows this contract. Chain, Attendance, Payroll, Finance, Governance, and historical DB maintenance remain closed.
