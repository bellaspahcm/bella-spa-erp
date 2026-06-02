# SPEC - Batch Harden Customer / Booking Explicit Any

## Intent

Remove explicit `any` usage from the production customer and booking surfaces selected for refactor group 2 while preserving existing booking, customer, payment, audit rollback, and portal workflows.

## Scope

- Customer services:
  - customer portal booking lookup
  - customer rating submission
  - create/update customer payload typing
- Booking actions:
  - query/session query actions
  - create booking input/result typing
  - create booking helper tenant resolution for new customers
  - update booking/session log sync
  - reuse package
  - online booking
  - KTV commission resolution
- Customer/booking UI:
  - booking modal
  - quick add customer modal
  - customer portal dashboard
  - customer list page
  - customer detail page
- Tests touched only where schema-strict payload typing changed legacy expectations from `name` to `name_mother`.

## Contract

- Production Customer / Booking paths do not use explicit TypeScript `any`.
- Database insert/update payloads use generated `Database` table `Insert`/`Update` types or local DTOs derived from them.
- `createBooking` returns a typed result shape while remaining compatible with existing `result.error` / `result.data` caller patterns.
- Client booking creation no longer needs to know `tenant_id` for a new customer; server action resolves tenant first and injects it into the customer insert payload.
- Customer portal page adapts booking `session_logs` into the dashboard view model explicitly instead of relying on loose data shape.
- DB/read errors remain explicit; no new silent database failure path is introduced.

## Verification

- `rg` for explicit production `any` in selected Customer / Booking paths: only non-TypeScript `step="any"` HTML attributes and plain comments remain.
- `npm.cmd run lint -- <group-2 changed files>`: completed with warnings only, no errors.
- `npx.cmd tsc --noEmit --pretty false`: passed.
- `git diff --check`: passed.
- `npm.cmd test -- --runInBand`: 65 suites passed, 706 tests passed.
