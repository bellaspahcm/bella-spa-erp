# Architecture Gate Result - Real Estate Any-Type Batch RE1

Date: 2026-09-30
Status: PASS FOR 9 SAFE CANDIDATE VIOLATIONS

## Scope

Real Estate Batch RE1 targets the 9 violations classified as safe candidates by the inventory-only triage:

```text
8 UI literal narrowing violations
1 generated-aligned reservation status cast
```

Files in scope:

```text
src/app/dashboard/real-estate/apartments/page.tsx
src/app/dashboard/real-estate/contracts/page.tsx
src/app/dashboard/real-estate/customers/page.tsx
src/app/dashboard/real-estate/documents/page.tsx
src/app/dashboard/real-estate/reports/page.tsx
src/app/dashboard/real-estate/marketing/page.tsx
src/app/dashboard/real-estate/leads/page.tsx
src/platform/real-estate/engines/reservation.service.ts
```

## Product Manifest

```text
Product / OS area: Bella Real Estate
Capabilities:
- Apartments inventory UI
- Contracts/payment UI
- Customer 360 UI
- Legal documents UI
- Reports UI
- Marketing/channel UI
- Lead UI
- Reservation service status insert
```

## Ownership Map

```text
src/app/dashboard/real-estate/**            = Real Estate product UI
src/platform/real-estate/engines/**         = Real Estate platform service layer
src/types/database.types.ts                 = generated Database contract
```

## Contract Dependency Map

```text
UI tab/select state
  -> local literal unions in same file
  -> no DB or RPC contract change

ReservationService.reserveProduct
  -> re_reservations.Insert.status
  -> generated enum re_reservation_status includes "active"
```

## Change Authority

Authorized:

- Remove UI `as any` by typing local tab arrays or guarding `PremiumSelect` values.
- Remove `as any` from `'active'` reservation status because it is already in generated Database enum.
- Preserve existing invalid-value behavior as no-op where a select returns a value outside the typed union.

Not authorized:

- Modify generated Database types.
- Modify migrations or DB schema.
- Modify `unit_code` repository casts.
- Modify `re_contracts` contract service casts.
- Modify reservation `'cancelled'` status semantics.
- Modify Real Estate domain state machines.
- Modify Logistics, Finance/Core, Integration Hub/Runtime, Partner Admin, `next.config.ts`, or `check:any-types` Batch 21.

## Verification Plan

```text
targeted scan for touched files
targeted ESLint for touched files
targeted Real Estate platform test if present
git diff --check
independent production scan
production-runtime-integrity expected fail with remaining baseline
```

## Gate Result

```text
PASS FOR RE1 ONLY
```
