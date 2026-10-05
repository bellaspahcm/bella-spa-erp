# ARCHITECTURE GATE RESULT - HAIRCUT BRANCH CHAIN

Date: 2026-10-05
Scope: Haircut (`bella_haircut`) operational branch-chain adoption only.
Status: PASS

## 1. Bella OS/Product Development Process Gate

ROOT CAUSE:
Haircut currently runs on the legacy tenant-scoped Beauty/Core operational chain. Platform Org Unit / Branch capability exists, but Haircut does not adopt branch context across booking, session, payment/revenue, and payroll/attendance records.

AUTHORIZED CHANGE:
Adopt the existing Platform Org Unit / Branch contract into Haircut operational paths.

EXCLUSIONS:
- No Beauty OS fork.
- No Finance/Payroll redesign.
- No unrelated RLS cleanup.
- No Healthcare, Education, Logistics, or frozen kernel changes.
- No invented product-local branch access mechanism.

## 2. Product Manifest

Product key: `bella_haircut`
Product: Haircut Shop
Shared modules: Beauty/Core operational chain, Finance outbox/F3 where already connected, HR salary/attendance where already applicable.

Required capability for this task:
`user -> user_org_unit_access -> branch context -> booking -> session -> revenue/payment -> Finance outbox -> payroll/attendance where used`

## 3. Ownership Map

- Product identity: `tenants.product_key -> ProductRegistry -> ProductDefinition`.
- Branch/org unit identity: Platform Org Unit (`org_units`).
- User branch authorization: Platform projection (`user_org_unit_access`).
- Booking/session/payment records: Core order service tables, with Haircut-specific branch adoption.
- Finance kernel: existing Finance/accounting outbox consumers. This task may pass branch ownership where supported, but must not redesign Finance schema.
- Payroll/attendance: existing HR salary/attendance records. This task may populate/filter existing branch columns, but must not redesign Payroll.

## 4. Contract Dependency Map

Haircut Product
-> Product Registry (`bella_haircut`)
-> Platform Org Unit contract (`org_units`, `user_org_unit_access`)
-> Core Order actions (`booking`, `session_logs`, `revenue`)
-> Accounting outbox / Finance worker
-> HR attendance/salary paths where already called

## 5. Change Authority

Allowed:
- Haircut/Core order action branch-context adoption.
- Additive migration for `bookings.branch_id` and `revenue.branch_id`.
- Additive or replacement RLS policies only for Haircut branch isolation on the operational tables touched by this task.
- Focused unit tests for branch context, persistence, propagation, and isolation.

Not allowed:
- Modify frozen kernels.
- Fork Beauty OS.
- Create a parallel Haircut branch subsystem.
- Reassign existing production records to invented branches.
- Broaden to unrelated tables.

## 6. UI -> Contract Reconciliation

No UI redesign is authorized.
Runtime input may provide `branch_id`/`branchId` through existing booking metadata. If absent, valid single-branch users may resolve implicitly from `user_org_unit_access`; multi-branch users must provide explicit branch context.

## 7. Additive Migration Plan

- Add nullable `branch_id` to `bookings` and `revenue`, FK to `org_units(id)`.
- Preserve existing `session_logs`, `attendance`, and `salary_records` branch columns.
- Add branch indexes for Haircut operational read/write paths.
- Existing records with no determinable branch remain explicit migration-required evidence, not silently assigned.

## 8. Automated Verification Gates Plan

1. Branch context resolves from Platform access.
2. User branch access is enforced.
3. Booking persists branch ownership.
4. Session logs inherit branch ownership.
5. Payment/revenue preserves branch ownership.
6. Completion/outbox passes branch ownership where supported.
7. Attendance/salary use existing branch columns where applicable.
8. Cross-branch access is denied in focused tests.
9. Tenant isolation remains intact.
10. Existing valid single-branch flow still works.
11. Typecheck/lint or focused test evidence is reported honestly.

## Gate Verdict

PASS - proceed with minimal implementation inside the authorized Haircut Branch Chain boundary.
