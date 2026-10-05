# Architecture Gate Result — Beauty V2 Branch Runtime Gap Closure — 2026-10-05

## Status

`REAL_DB_PROVEN_FOR_CURRENT_WRITER_PATH`

This gate follows review of commit `ad3bd134f2e23d10fab9d5659efd44d0f7f6f670`. Product Chain remains sealed. Finance `SALARY_PAID` branch propagation is treated as closed/candidate sealed and is not reopened here.

## Problem

Branch-aware readiness is not sealed because production writers can still create branchless upstream facts:

- Attendance UI paths call branchless `ktvCheckIn()` / `ktvCheckOut()`.
- Commission source writers create/update `session_logs`, `booking_service_items`, and `product_sales` without `branch_id`.
- Shared salary engine now rejects null/ambiguous branch facts, so caller compatibility must be verified.

## Product Manifest / Scope

In scope:

- Beauty V2 attendance runtime branch propagation.
- Beauty V2 commission source writer branch propagation.
- Salary engine caller compatibility verification.
- Unit tests and Real DB writer-path proof updates.

Out of scope:

- Platform Chain changes.
- Finance architecture or Finance OS changes.
- Payroll/Commission calculation redesign.
- Go-Live or production mutation.
- Legacy backfill for historical null branch records.

## Ownership Map

| Capability / Data | Owner | Current task authority |
| --- | --- | --- |
| Chain, Branch, Membership, Authorization | Platform Chain | Consume only |
| Attendance event branch identity | Beauty runtime / HR attendance consumer | Minimal writer fix |
| Commission source branch identity | Beauty booking/session/product-sales writers | Minimal writer fix |
| Salary calculation branch enforcement | HR salary engine consumer of branch-aware facts | Verify compatibility |
| Finance `SALARY_PAID` branch propagation | Finance integration | Regression only |

## Contract Dependency Map

```text
Platform org_units / org_relationships
        -> proven staff branch context
        -> attendance.branch_id
        -> salary_records.branch_id
        -> commission source branch_id
        -> commission calculation
        -> SALARY_PAID branchId
        -> journal_lines.branch_id
```

## Change Authority

Authorized:

- Add a minimal staff-branch resolver that consumes existing Platform org units and relationships.
- Use that resolver in Beauty attendance and commission source writer paths.
- Update tests/proofs so branch evidence flows through production writers.

Not authorized:

- New Chain subsystem.
- New product-local membership/permission system.
- Schema invention beyond existing branch columns.
- Backfilling historical null branch data.

## UI -> Contract Reconciliation

| UI/action | Current behavior | Canonical contract | Conclusion |
| --- | --- | --- | --- |
| KTV check-in/out | Calls branchless server action | New write must persist authorized Platform branch | `MAPPING BUG` |
| Add booking service item | Writer omits source `branch_id` | Completed commission source must carry branch truth | `MAPPING BUG` |
| Product sale create/update | Writer omits source `branch_id` | Completed sale source must carry branch truth | `MAPPING BUG` |
| Session completion | Writer omits completed session `branch_id` | Completed session source must carry branch truth | `MAPPING BUG` |

## Additive Migration Plan

No new migration in this gate. Existing migrations already add nullable branch columns and foreign keys:

- `20261004010000_add_branch_id_to_attendance.sql`
- `20261004020000_add_branch_id_to_salary_records.sql`
- `20261004030000_add_branch_id_to_commission_sources.sql`

Legacy null rows remain null and are not guessed/backfilled.

## Verification Plan

1. Unit prove default attendance write resolves exactly one staff branch and rejects ambiguous/no branch.
2. Unit prove service item/product sale/session source writers persist branch or reject before salary side-effect.
3. Unit prove salary engine still rejects null/multi-branch facts intentionally.
4. Run focused unit tests.
5. Run changed TypeScript diagnostics.
6. Run Real DB writer-path branch proof after unit pass.
7. Run Finance branch regression proof or focused finance tests.
8. Run `git diff --check`.

## Result

`REAL_DB_PROVEN`

## Implementation Evidence — Current Run

Implemented:

- Attendance branchless UI path now resolves exactly one Platform staff branch before check-in/check-out writes.
- Attendance ambiguous branch context rejects before attendance write.
- Product sales writer resolves Platform staff branch and persists `product_sales.branch_id`.
- Booking service item writer resolves Platform staff branch and persists `booking_service_items.branch_id`.
- Session completion/update paths persist `session_logs.branch_id` and restore prior `branch_id` on rollback.
- Salary engine caller compatibility was rechecked against focused salary surfaces.

Verification:

```text
npm test -- --runTestsByPath
  src/__tests__/product-sales-branch-writer.test.ts
  src/__tests__/booking-service-items-branch-writer.test.ts
  src/__tests__/attendance-actions.test.ts
  src/__tests__/complete-session-action.test.ts
  src/__tests__/salary-recalculation-lifecycle.test.ts
  src/__tests__/query-salary-actions.test.ts
  src/__tests__/admin-salary-actions.test.ts
= PASS — 7 suites / 101 tests

npm run typecheck:changed
= PASS — 0 diagnostics

git diff --check
= PASS
```

Real DB writer-path proof:

```text
npm test -- --config jest.real-db.config.ts
  src/__tests__/beauty-v2-commission-branch-real-db.test.ts
  --runInBand
= PASS — 1 suite / 2 tests

npm test -- --config jest.real-db.config.ts
  src/__tests__/beauty-v2-attendance-branch-real-db.test.ts
  --runInBand
= PASS — 1 suite / 1 test

npm test -- --config jest.real-db.config.ts
  src/__tests__/beauty-v2-go-live-payroll-commission-real-db.test.ts
  --runInBand
= PASS — 1 suite / 1 test
```

E2E environment:

```text
project_ref = bmnbqbcdbuklhopfbopv
env_source = D:\Antigravity\Projects\BELLA SPA ERP\.env.e2e
```

Schema baseline applied:

```text
supabase/migrations/20261004030000_add_branch_id_to_commission_sources.sql
= APPLIED_TO_E2E

session_logs.branch_id          = PRESENT
booking_service_items.branch_id = PRESENT
product_sales.branch_id         = PRESENT
attendance.branch_id            = PRESENT
salary_records.branch_id        = PRESENT
```

Real DB writer-path evidence:

```text
Attendance explicit branch write -> attendance.branch_id read-back PASS
Attendance branch deny cases     -> no cross-branch/cross-tenant rows PASS
Product sale writer       -> product_sales.branch_id read-back PASS
Booking service writer    -> booking_service_items.branch_id read-back PASS
Session source branch     -> direct source row branch_id PASS
Session completion writer -> session_logs.branch_id read-back PASS
Session rollback restore  -> UNIT_PROVEN
Salary branch result      -> salary_records.branch_id PASS
Cross-branch mismatch     -> reject before salary write PASS
NULL branch source        -> reject before salary write PASS
Multi-branch source       -> reject before salary write PASS
Tenant isolation          -> cross-tenant completion denied PASS
Cleanup marker residuals  -> 0
auth.users marker cleanup -> 0 residual
```

Decision:

```text
Attendance UI auto-resolution  = UNIT_PROVEN
Attendance explicit writer     = REAL_DB_PROVEN
Product/service writer gaps    = REAL_DB_PROVEN
Session writer runtime gap     = REAL_DB_PROVEN
Salary caller compatibility    = REAL_DB_PROVEN
Real DB writer-path proof      = PASS
Branch-aware source writers    = SEALED_FOR_CURRENT_WRITER_PATH
Beauty V2 Go-Live              = NOT_READY
```

Final E2E cleanup read-back:

```text
public.users                         = 0
auth.users                           = 0
people_directory                     = 0
org_relationships_by_marker_branch   = 0
org_units                            = 0
attendance_by_tenant                 = 0
salary_records_by_tenant             = 0
session_reviews_by_tenant            = 0
session_logs_by_marker_booking       = 0
accounting_outbox_by_tenant          = 0
bookings_by_tenant                   = 0
customers_by_tenant                  = 0
accounting_periods_by_tenant         = 0
```
