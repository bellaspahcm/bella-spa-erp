# Beauty V2 Finance Minimal Wiring Decision - 2026-10-02

## Status

`MINIMAL_WIRING_POINT_IDENTIFIED`

This is the pre-implementation decision checkpoint. The implementation checkpoint
was later opened and proven in:

```text
docs/architecture/BEAUTY_V2_FINANCE_MINIMAL_WIRING_FIX_PROOF_2026_10_02.md
```

## Evidence Base

Real DB proof already established:

```text
Beauty H8 session completed        PASS
accounting_outbox rows             0
SESSION_DONE outbox rows           0
F3 invoice/position/ledger/allocation rows 0
```

Therefore the issue is an integration boundary gap, not a Beauty H8 core defect.

## Exact Wiring Point

The minimal producer wiring point is:

```text
src/products/beauty-spa-v2/service.ts
BeautySpaV2Service.completeSession()
after SessionTrackingService.complete() succeeds
```

Do not wire this inside:

- `src/platform/beauty/application/services.ts`
- `src/platform/beauty/infrastructure/supabase-h8.repositories.ts`
- Beauty H8 migrations
- resource allocation, appointment, rollback, immutable history, or concurrency code

Reason: Beauty H8 core owns operational truth only. Finance side effects are product integration behavior.

## Why A Blind `SESSION_LOG` Reuse Is Not Safe

The shared Spa helper builds `SESSION_DONE` as:

```text
eventType      SESSION_DONE
referenceType  SESSION_LOG
referenceId    sessionLogId
payload        earnedRevenueAmount, deferredRevenueAmount, receivableAmount, bookingId, commissionAmount, ktvId
```

That shape is valid for the legacy `session_logs` flow.

Beauty H8 completion stores:

```text
beauty_sessions.id
beauty_sessions.appointment_id
beauty_sessions.status
beauty_sessions.actual_performer_id
beauty_sessions.outcome
```

It does not store financial amount, price, paid amount, receivable amount, or booking revenue split.

Therefore the minimal Beauty wiring must not simply call the legacy helper with `referenceType = SESSION_LOG`.

## Required Minimal Producer Contract

The Beauty producer should emit an accounting event only after H8 completion persists.

Recommended source event:

```text
eventType      SESSION_DONE
referenceType  BEAUTY_SESSION
referenceId    beauty_sessions.id
payload:
  sourceSystem: BEAUTY_V2
  businessSourceType: BEAUTY_SESSION_DONE
  appointmentId
  customerId
  serviceId
  branchId
  ktvId / performerId
  earnedRevenueAmount
  deferredRevenueAmount
  receivableAmount
  commissionAmount
  description
```

`BEAUTY_SESSION` is an app-layer accounting reference type. The database column is text free-form, so no Finance table or migration is required for this reference type.

## Required Amount Source

Beauty H8 session alone is insufficient as a monetary source.

The minimal valid amount source must be one of:

1. Existing Service Catalog / packages price for the appointment `serviceId`.
2. A product completion finance handoff input carrying a proven amount.

Preferred route:

```text
beauty_sessions.appointment_id
      ↓
beauty_appointments.service_id + customer_id + branch_id
      ↓
existing Service Catalog / packages price
      ↓
SESSION_DONE payload amounts
```

Do not invent Beauty finance tables or store Finance-owned amounts inside H8 core tables.

## Required Worker Route

The existing accounting worker currently validates every `SESSION_DONE` against legacy `session_logs` before processing. That would dead-letter a valid Beauty H8 event.

Minimal worker change:

```text
if SESSION_DONE and referenceType == BEAUTY_SESSION:
    validate source in beauty_sessions
    load beauty_appointments
    recognize F3 through SemanticReceivableChargeService
    post existing SESSION_DONE GL journal
else:
    keep legacy session_logs path unchanged
```

F3 must continue to use:

```text
SemanticReceivableChargeService.recognizeServiceReceivable()
```

The Finance service already supports generic service receivable semantics such as `BEAUTY_SESSION_DONE`; no new AR engine is required.

## Worker Guardrails

Implementation must preserve:

- Legacy `session_logs` behavior for BabyCare/shared Spa/Haircut.
- Haircut-specific `HAIRCUT_SESSION_DONE` source type.
- Outbox idempotency through existing `enqueue_accounting_event`.
- Tenant isolation on every source read.
- No direct Beauty writes to `finance_receivable_*` tables.
- No F5/reconciliation write path from Beauty.

## Definition Of Done For The Fix

After implementation, Real DB proof must show:

```text
Beauty H8 COMPLETED                 PASS
SESSION_DONE accounting_outbox       PASS
Finance worker processed event       PASS
F1 journal read-back                 PASS
F3 receivable read-back              PASS
Idempotent retry                     PASS
Tenant isolation                     PASS
F5/control read-back                 PASS
```

## Decision

The minimal fix is product-boundary + worker-routing wiring:

```text
BeautySpaV2Service.completeSession
      ↓
Beauty SESSION_DONE outbox producer
      ↓
accounting_outbox(referenceType=BEAUTY_SESSION)
      ↓
accounting worker Beauty H8 SESSION_DONE route
      ↓
SemanticReceivableChargeService
      ↓
existing F1/F3/F5 evidence
```

Do not reopen Beauty H8 core.
Do not create Finance subsystem.
Do not add Finance tables or engines.
