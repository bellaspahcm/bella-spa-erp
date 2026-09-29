# Architecture Gate Result: Haircut F3 AR Producer

## Result

PASS

## Problem / Non-Goals

Haircut session completion already emits `SESSION_DONE` accounting outbox payloads with `receivableAmount`, but Haircut has not yet consumed the Finance OS generic service receivable contract from PR #164.

This gate authorizes only the minimal Haircut AR producer integration:

```text
SESSION_DONE
  -> receivableAmount
  -> Finance OS recognizeServiceReceivable()
  -> Invoice / Receivable Position / Receivable Ledger
```

Non-goals:

- No Haircut-specific AR system.
- No F3 primitive changes.
- No payment allocation.
- No Payment Engine, Payroll, COA, Debt, or Reconciliation work.
- No migration and no DB mutation.

## Truth / Source Of Truth

- Finance OS generic service receivable contract exists in `src/platform/finance/contracts/receivable-charge.contract.ts`.
- Finance OS implementation exists in `src/platform/finance/services/semantic-receivable-charge.service.ts`.
- Haircut product identity is `tenants.product_key = 'bella_haircut'`.
- `SESSION_DONE` source is `session_logs`.
- Customer identity for Haircut receivable comes from `bookings.customer_id`.
- The accounting outbox worker is the persisted retry boundary for `SESSION_DONE` events.

## Ownership Map

| Capability | Owner | Current Change |
| --- | --- | --- |
| Service receivable contract | Finance OS | Consume only |
| Invoice / AR / Ledger primitives | Finance OS | Reuse only |
| Session completion event | Haircut / Beauty operational flow | Existing producer |
| Accounting outbox worker routing | Integration boundary | Minimal wiring |
| Payment allocation | Finance OS / Payment integration | Out of scope |
| COA mapping | Finance OS accounting configuration | Out of scope |

## Contract Dependency Map

```text
Haircut SESSION_DONE outbox
  -> accounting worker
  -> Finance OS recognizeServiceReceivable()
  -> existing F3 RPC primitives
```

The integration must be tenant-scoped, use the booking customer, and use a traceable source:

```text
businessSourceType = HAIRCUT_SESSION_DONE
businessSourceId   = session_logs.id
```

## Change Authority

The user explicitly authorized Haircut AR producer integration after Finance OS generic receivable was merged. The authorized layers are:

- Haircut/integration worker routing.
- Focused tests proving worker integration.
- Documentation gate for this change.

The request does not authorize Finance OS primitive changes, payment allocation, Payroll, COA, or architecture redesign.

## UI Reconciliation

Not applicable. This change has no UI surface.

## Migration Plan

No migration. Existing tables and Finance OS RPC primitives are reused.

## Verification Plan

1. Focused accounting outbox worker tests for:
   - Haircut `SESSION_DONE` with positive `receivableAmount` calls `recognizeServiceReceivable()`.
   - Non-Haircut `SESSION_DONE` does not call Haircut AR producer.
   - Existing worker routing remains valid.
2. Scoped TypeScript check if feasible for changed files.
3. `git diff --check`.

