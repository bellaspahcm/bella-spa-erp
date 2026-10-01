# ARCHITECTURE GATE RESULT - NAIL SHOP FULL UI E2E

Date: 2026-10-01
Branch: `codex/nail-shop-go-live-release`
Status: PASS / SEALED

## 1. Bella OS/Product Development Process Gate

Requested change: prove Nail Shop full business workflow through operator UI.

This gate authorizes only:

- Stable UI selectors on existing operator screens.
- One focused Playwright E2E journey for Nail Shop.
- Documentation of evidence status.
- Minimal proven runtime fixes discovered by the E2E only when separately justified.

This gate does not authorize:

- Backend business logic changes.
- Schema changes.
- Payroll, commission, Finance, or Beauty OS engine redesign.
- Haircut, Preschool, Healthcare, Education, or Logistics changes.
- `any` cleanup or unrelated technical debt cleanup.

## 2. Product Manifest

Product identity: `bella_nail`

Capability: Beauty OS / `beauty_spa`

Scoped workflow:

```text
Tenant precondition
  -> Staff precondition
  -> Services / Packages
  -> Customer
  -> Booking
  -> Attendance
  -> Completed Session
  -> Payment / Revenue
  -> Payroll / Commission
  -> Finance read-back
```

Tenant and staff setup are test preconditions. The business mutations above must be triggered through existing operator UI where user-facing action exists.

## 3. Ownership Map

| Data | Owner | UI Surface |
| --- | --- | --- |
| Product identity | Product Registry | N/A |
| Service/package catalog | Beauty OS service catalog | `/dashboard/services` |
| Customer profile | Product CRM surface | `/dashboard/customers` |
| Booking | Booking/order service | Customer detail booking modal |
| Attendance | HR attendance actions | `/dashboard/salary?tab=attendance` |
| Session completion | Order/session service | `/dashboard/sessions` |
| Payment/revenue | Order payment + Finance truth layer | Customer detail payment modal, `/dashboard/finance` |
| Payroll/commission | HR salary module | `/dashboard/salary` |
| Finance read-back | Finance transaction read model | `/dashboard/finance` |

## 4. Contract Dependency Map

```text
Bella Nail Product
  -> Beauty OS service package contract
  -> Order booking/session contract
  -> HR attendance/salary contract
  -> Finance revenue/expense read model
```

No Healthcare, Education, Logistics, or Preschool contract is modified or consumed.

## 5. Change Authority

Authorized:

- Existing React component `data-testid` attributes.
- New Playwright E2E spec.
- Evidence documentation.
- Minimal E2E-environment compatibility fixes for already existing product actions.
- One Core Finance approval fix under `ACR-2026-012`.

Not authorized:

- Database migration.
- Core/kernel modification outside `ACR-2026-012`.
- Product-specific workaround such as `product_key === "bella_nail"` in shared engines.

## 6. UI -> Contract Reconciliation

Each E2E segment must show:

```text
UI action
  -> existing action/service contract
  -> DB mutation
  -> DB read-back
  -> UI read-back where operationally visible
```

If a segment has no existing user-facing UI action, the test must not fake PASS with a backend-only shortcut.

## 7. Additive Migration Plan

No migration.

## 8. 11 Automated Verification Gates Plan

| Gate | Plan |
| --- | --- |
| Product identity | Existing Nail registry evidence retained |
| Tenant isolation | E2E tenant seeded with unique tenant_id |
| Service/package | UI create + DB read-back |
| Customer | UI create + DB read-back |
| Booking | UI booking modal + DB read-back |
| Attendance | UI attendance override + DB read-back |
| Completion | UI session completion + DB read-back |
| Payment/revenue | UI payment modal + DB read-back |
| Payroll/commission | UI publish/confirm/finalize + DB read-back |
| Finance | UI finance read-back |
| Cleanup | Delete E2E tenant-scoped rows |

## Result

PASS for implementing and verifying focused UI E2E evidence.

Verification:

```text
Targeted ESLint                 PASS
Finance Jest regression          PASS
Nail full UI E2E                 PASS
ACR-2026-012 Core fix            APPROVED / VERIFIED
```

Playwright evidence:

```text
npx playwright test e2e/tests/31-nail-full-business-ui-e2e.spec.ts --project=chromium
1 passed
```

`NAIL_SHOP_UI_E2E = SEALED`
