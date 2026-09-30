# ACR-2026-011: Session Completion Payroll Capability Guard

Status: APPROVED
Date: 2026-09-30
Approver: User explicit approval in Codex thread

<!-- APPROVED_CORE_CHANGE_V1
{
  "version": 1,
  "acrId": "ACR-2026-011",
  "status": "APPROVED",
  "pr": "LOCAL-NAIL-PHASE1",
  "approvedCoreFiles": [
    "src/core/services/order/complete-session-action.ts",
    "src/core/services/order/session-completion-helpers.ts"
  ],
  "approver": "User explicit approval in Codex thread",
  "approvedDate": "2026-09-30",
  "purpose": "Guard completeSession payroll recalculation behind tenant payroll capability so tenants with payroll disabled do not hard-require Payroll schema during session completion or rollback.",
  "contractChange": false,
  "schemaChange": false,
  "rpcChange": false,
  "apiChange": false,
  "ownershipChange": false
}
-->

## Problem

Nail Phase 1 Revenue real DB proof is blocked after booking completion reaches the shared Core session completion path. `completeSession()` updates the session, records revenue/outbox side effects, and then hard-requires Payroll salary recalculation. The E2E Nail tenant has `enabled_modules.payroll = false`, but the shared completion path still imports and executes Payroll logic. Runtime evidence shows rollback caused by Payroll schema drift (`salary_records.manual_adjustments` and related Payroll tables/columns), while Nail revenue/payment logic is not the failing layer.

## Change Authority

This ACR authorizes one controlled Core behavior fix:

```text
completeSession() payroll capability guard
```

The guard must be capability/configuration based:

```text
enabled_modules.payroll === true
```

It must not branch on:

```text
product_key === "bella_nail"
```

## Approved Scope

- Add a tenant Payroll capability resolver in the existing session-completion helper boundary.
- Skip KTV salary recalculation when Payroll is disabled for the tenant.
- Apply the same guard to rollback salary recalculation in `completeSession()`.
- Preserve existing Payroll ON behavior and existing rollback semantics for tenants with Payroll enabled.
- Add focused unit coverage for Payroll OFF skip and Payroll ON preservation.

## Out Of Scope

- Payroll engine changes.
- Payroll schema/migration repair.
- Commission rules.
- Finance implementation.
- Revenue calculation changes.
- Product-specific Nail workaround.
- Haircut behavior change beyond regression verification.
- Preschool or BabyCare changes.

## Expected Effect

```text
Tenant payroll ON
  -> completeSession()
  -> salary recalculation preserved

Tenant payroll OFF
  -> completeSession()
  -> salary recalculation skipped
  -> Revenue / SESSION_DONE outbox path continues
```

## Verification Plan

- Focused Core unit tests for capability parsing and Payroll OFF skip.
- Focused `completeSession()` rollback test proving Payroll OFF does not call salary recalculation.
- Nail Revenue real DB proof rerun against E2E project.
- Cleanup scoped Nail fixtures.
- ESLint on touched Core and Nail test files.
- `git diff --check`.
- Architecture guard.
- Core freeze guard using local placeholder binding; update `pr` metadata to the real PR number before PR/CI.

