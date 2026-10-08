# Bella Hospitality - Hotel Core Full Chain Seal Gate

Date: 2026-10-08

## Gate Result

```ini
ARCHITECTURE_GATE = PASS
SCOPE = HOTEL_CORE_FULL_CHAIN_SEAL

CODE_AUTHORIZED = YES
DB_AUTHORIZED = NO_NEW_TABLES
MIGRATION_AUTHORIZED = YES_TRIGGER_HARDENING_ONLY
PRODUCT_UI_AUTHORIZED = NO
BROWSER_VERIFICATION_ENTRY_AUTHORIZED = YES

HOUSEKEEPING = NOT_AUTHORIZED
MAINTENANCE = NOT_AUTHORIZED
FNB = NOT_AUTHORIZED
REVENUE = NOT_AUTHORIZED
TRAVEL_TOUR = NOT_AUTHORIZED
RESOURCE_KERNEL = NOT_CREATED
```

## Bella OS/Product Development Process Gate

This gate follows the Bella process: reuse existing sealed capabilities, add only
the minimum proof surface required, verify, seal, and stop.

The requested capability is not a new Hospitality phase. It is a seal proof that
Phases 0-4 work as one operational chain:

```text
Login
 -> Product identity
 -> Property
 -> Room
 -> Guest
 -> Reservation
 -> Check-in
 -> Stay
 -> Room occupancy
 -> Folio
 -> Room charge
 -> Finance receivable
 -> Payment allocation
 -> Check-out
 -> Released room
```

## Product Manifest

Product: `bella_hospitality`

Authorized capabilities:
- Reuse Phase 0 Product Identity.
- Reuse Phase 1 Property + Room.
- Reuse Phase 2 Guest + Reservation.
- Reuse Phase 3 Front Office + Stay.
- Reuse Phase 4 Folio + Payment.
- Add a narrow server-side browser verification entry for E2E proof.
- Add a narrow Hospitality trigger hardening migration if authenticated
  full-chain proof exposes an RLS validation gap.

Not authorized:
- Customer-facing Hospitality UI.
- New route/navigation product rollout.
- New database tables.
- Domain expansion migrations beyond the authenticated trigger hardening needed
  for this proof.
- Resource/Availability/Allocation kernel.
- Housekeeping, maintenance, F&B, revenue management, travel, or tour runtime.

## Ownership Map

```text
ProductRegistry/ProductResolver -> Platform Registry
Tenant/User/Auth context        -> Platform Foundation
Party identity                  -> Platform Party
Property/Building/Floor/Room    -> Bella Hospitality
Guest/Reservation/ReservedRoom  -> Bella Hospitality
Stay/RoomOccupancy              -> Bella Hospitality
Folio/FolioItem/Finance links   -> Bella Hospitality
Receivable/Payment/Allocation   -> Finance OS public contract
```

Hospitality must not write Finance internals directly. Hospitality only stores
opaque identifiers returned by the Finance public contract.

## Contract Dependency Map

```text
Browser verification entry
 -> getCurrentUser
 -> Tenant.product_key
 -> ProductResolver
 -> Hospitality Phase 1-4 services
 -> ISemanticReceivableChargeContract
 -> Finance OS concrete gateway at composition boundary
```

The composition boundary may instantiate Finance's concrete public-contract
implementation. Product-owned Hospitality code remains behind the Finance
contract.

## Change Authority

Authorized layers:
- `docs/architecture/*` gate evidence.
- `src/services/*` server action composition boundary.
- `src/app/hospitality/*` verification-only browser entry.
- `e2e/tests/*` focused browser E2E proof.

Forbidden layers:
- `src/platform/healthcare/engines/*`.
- Frozen Healthcare H1-H12.
- Frozen Logistics E7.1/E7.2/E7.3.
- Beauty H5/H8 resource allocation.
- Education kernel.
- New OS resource kernel.

## UI -> Contract Reconciliation

This is not a Hospitality product UI. The page is a canonical browser
verification entry, mirroring the existing Warehouse canonical browser-entry
pattern. It exists only to prove the sealed service and database chain through a
browser and authenticated server action.

## Additive Migration Plan

```ini
MIGRATION_REQUIRED = YES
NEW_TABLES = NO
NEW_INDEXES = NO
RLS_CHANGE = FUNCTION_SECURITY_DEFINER_ONLY
```

The E2E reuses the already created Phase 1-4 Hospitality tables and existing
Finance public contract tables. The only authorized DB change is hardening
`hospitality_validate_guest_party_tenant()` so authenticated Hospitality runtime
can validate canonical Party identity without creating a Hospitality-owned Party
copy or changing Platform Party ownership.

## Verification Gates Plan

1. Product identity resolves `tenant.product_key = bella_hospitality`.
2. Browser entry requires authenticated user context.
3. Server action binds authenticated tenant context into PostgreSQL.
4. Property + Room persisted.
5. Guest + Reservation + Reserved Room persisted.
6. Check-in creates active Stay and occupied Room Occupancy.
7. Folio opens for the Stay.
8. Room charge creates Folio Item and Finance receivable through public contract.
9. Payment applies through Finance payment allocation contract.
10. Check-out completes Stay and releases occupancy.
11. Authenticated Real DB read-back proves same-tenant visibility and cross-tenant invisibility.

## Decision

```ini
HOSPITALITY_HOTEL_CORE_CHAIN_SEAL = PROVEN / SEALED
HOTEL_CORE_REAL_DB_CHAIN = PROVEN
HOTEL_CORE_BROWSER_E2E = PASS
HOTEL_CORE_OPERATIONAL_CHAIN = PROVEN

RESOURCE_KERNEL = NOT_CREATED
PRODUCT_UI = NOT_STARTED
DB_MIGRATION = TRIGGER_HARDENING_ONLY
```

## Seal Evidence

```text
Browser E2E
  npx playwright test e2e/tests/38-hospitality-hotel-core-chain-browser-e2e.spec.ts --project=chromium
  PASS: 1/1 with Playwright-managed Next.js webServer on port 3113

Hospitality regression
  npx jest src/platform/registry/__tests__/hospitality-product-identity.test.ts src/products/bella-hospitality/__tests__ --runInBand
  PASS: 18/18 suites, 53/53 tests

Finance contract
  npx jest src/platform/finance/__tests__/semantic-receivable-charge.service.test.ts --runInBand
  PASS: 12/12 tests

Architecture guard
  npm run arch:guard
  PASS

Typecheck
  NODE_OPTIONS=--max-old-space-size=8192 npm run typecheck:changed
  PASS: zero diagnostics

Zero-downtime migration check
  npm run db:migration:zero-downtime
  PASS: 5 migrations

Migration drift
  BASE_REF=origin/main npm run db:migration:check
  NOT_RUN / ENVIRONMENT_BLOCKED
  Reason: LegacyProjectNotLinkedError - Supabase project ref is not linked.

Diff hygiene
  git diff --check
  PASS

No any / ts-ignore
  rg "\bany\b|@ts-ignore" over Hospitality touched paths
  PASS: no matches
```

## Browser E2E Root Cause Closure

The managed worktree dev server was blocked by a `node_modules` junction and
stale `.next` cache that caused Next.js to resolve internal assets from the
primary checkout path. The worktree now uses a local dependency tree and a fresh
Next.js cache, and Playwright can auto-start the dev server.

The browser action also exposed a PostgreSQL session-state reset across
repository transactions: by the time `recordPaymentApplication` attempted
`SELECT ... FOR UPDATE`, the connection had reset to `postgres` with no tenant
claims. The minimal fix is at the server-action SQL client boundary: re-bind the
authenticated tenant context for each standalone query and bind `SET LOCAL`
role/claims immediately after every repository `BEGIN`.
