# Architecture Gate Result: Haircut + Nail Chain Seal

Date: 2026-10-05

## Status

PASS / SEALED

This gate authorizes only the minimum evidence work needed to prove or reject Chain seal for:

- Haircut Shop (`bella_haircut`)
- Nail Shop (`bella_nail`)

It does not authorize production deployment, production workflow edits, payroll/finance implementation, new Platform Chain abstractions, new product-local Chain subsystems, or Healthcare/Logistics kernel changes.

## Bella OS / Product Development Process Gate

Bella Engineering Constitution controls this work:

```text
Truth before assumption
Ownership before code
Reuse before create
Canonical contract before consumer
Change authority before implementation
Evidence before closure
```

The current task is a seal/evidence task, not a feature implementation task.

## Product Manifest

| Product | Product key | Product layer | Platform capability consumed |
| ------- | ----------- | ------------- | ---------------------------- |
| Haircut Shop | `bella_haircut` | Core booking/order flow | Platform `org_units` + `user_org_unit_access` |
| Nail Shop | `bella_nail` | `src/products/nail` over Beauty OS H8 | Platform `org_units` + `user_org_unit_access` |

Beauty V2 is not part of this implementation gate.

## Ownership Map

| Data / capability | Owner | Rule |
| ----------------- | ----- | ---- |
| Chain hierarchy | Platform | `org_units` is canonical. |
| User branch access | Platform | `user_org_unit_access` is canonical authorization projection. |
| Haircut booking/session/payment branch persistence | Haircut consumer over Core order tables | Must consume Platform Chain; no product-local chain. |
| Nail appointment/session branch persistence | Nail consumer over Beauty OS H8 | Must consume Platform Chain; no product-local chain. |
| Product identity | Product Registry / tenant `product_key` | `bella_haircut` and `bella_nail` must not be inferred from landing copy or modules alone. |

## Contract Dependency Map

```text
Haircut product
  -> Product identity: tenants.product_key = bella_haircut
  -> Platform Chain: org_units + user_org_unit_access
  -> Core order tables: bookings, session_logs, revenue
```

```text
Nail product
  -> Product identity: tenants.product_key = bella_nail
  -> Platform Chain: org_units + user_org_unit_access
  -> Beauty OS H8 tables: beauty_appointments, beauty_sessions
```

## Change Authority

Authorized:

- Add focused test/proof files.
- Update the portfolio audit artifact with current evidence results.
- Update real-db Jest inclusion if a new real-db proof test is added.

Not authorized:

- Runtime refactor.
- New migration by assumption.
- Production workflow/deployment changes.
- New Chain subsystem.
- Beauty Payroll/Commission/Finance implementation.
- Healthcare or Logistics kernel changes.

If proof shows a real runtime or schema gap, the correct result is `NOT_PROVEN` with exact blocker unless the minimal fix is already authorized and strictly within this gate.

## Evidence Required To Seal

Haircut can be SEALED only if evidence proves:

1. Product identity is `bella_haircut`.
2. Platform `org_units` supplies branch identity.
3. Platform `user_org_unit_access` authorizes a user to the branch.
4. Haircut runtime/static path persists `branch_id` on booking/session/payment tables.
5. Cross-branch or missing-branch access is rejected before side effects.
6. Real DB read-back proves the branch is stored and cleanup leaves no business rows.

Nail can be SEALED only if evidence proves:

1. Product identity is `bella_nail`.
2. Platform `org_units` supplies branch identity.
3. Platform `user_org_unit_access` authorizes a user to the branch.
4. Nail / Beauty H8 path persists `beauty_appointments.branch_id`.
5. Nail-specific proof exists; Haircut or generic Beauty proof cannot be substituted.
6. Real DB read-back proves the branch is stored and cleanup leaves no business rows.

## Verification Plan

Run:

```text
npm test -- src/__tests__/haircut-branch-chain.test.ts --runInBand
npm test -- src/__tests__/haircut-nail-chain-seal-real-db.test.ts --runInBand
```

If no runnable real database credentials exist, the real DB proof is `NOT_PROVEN`, not PASS.

## Verification Executed

```text
npm test -- src/__tests__/haircut-branch-chain.test.ts --runInBand
PASS: Test Suites 1 passed, Tests 5 passed

ALLOW_E2E_MIGRATION_APPLY=1 node -r dotenv/config scripts/apply-e2e-pr-migrations.cjs --base HEAD^
PASS: Applied existing E2E migration 20261005090000_haircut_branch_chain_adoption.sql

npm test -- src/__tests__/haircut-nail-chain-seal-real-db.test.ts --runInBand
PASS: Test Suites 1 passed, Tests 2 passed
```

Evidence added:

- `src/__tests__/haircut-nail-chain-seal-real-db.test.ts`
- `jest.real-db.config.ts`

Haircut proof:

- Product identity is `tenants.product_key = bella_haircut`.
- Platform branches are seeded in `org_units`.
- User access is resolved through `user_org_unit_access`.
- `haircut_branch_access_allowed` returns true for the assigned branch and false for an unassigned branch and null branch.
- Real DB read-back proves `bookings.branch_id` and `bookings.metadata.branch_id`.
- Haircut branch columns and restrictive branch guard policies are present for the branch-owned operational tables.

Nail proof:

- Product identity is `tenants.product_key = bella_nail`.
- Platform branches are seeded in `org_units`.
- User access is resolved through `user_org_unit_access`.
- Real DB read-back proves Nail/Beauty H8 `beauty_appointments.branch_id`.
- Nail proof is product-specific; it does not borrow Haircut proof.

Cleanup:

- Product business rows are cleaned and asserted at zero for `bookings`, `session_logs`, `revenue`, `beauty_appointments`, and `beauty_sessions`.
- Test tenant shells are retained as a historical DB shell residual because `public.timeline_events` has append-only/RLS FK behavior that blocks tenant deletion by this proof harness. This is cleanup technical debt, not a Haircut/Nail runtime failure.
- Residual audit after failed/retried proof runs found `chain-seal-*` tenant shells = 13 and business/org/person rows = 0. Four stale `chain-seal-*@example.com` auth fixture users from failed runs were deleted through Supabase Admin; current auth fixture count is 0. The proof now uses fixed tenant shell IDs for future runs to avoid unbounded shell growth.

## Gate Conclusion

```text
GATE = PASS / SEALED
RUNTIME_IMPLEMENTATION_AUTHORIZED = NO
NEW_MIGRATION_AUTHORIZED = NO
EXISTING_E2E_MIGRATION_APPLIED = YES
PRODUCTION_AUTHORIZED = NO
HAIRCUT_CHAIN_SEAL = SEALED
NAIL_CHAIN_SEAL = SEALED
PRODUCTION_GO_LIVE_STATUS = NOT_CHANGED
```
