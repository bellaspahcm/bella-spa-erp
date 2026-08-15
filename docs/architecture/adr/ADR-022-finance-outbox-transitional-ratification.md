# ADR-022: Finance Outbox — Transitional Status & Compliance Ratification

**Date:** 2026-08-15  
**Status:** ACCEPTED  
**Authors:** Finance OS Architecture  
**Supersedes:** None  
**Requires:** FINANCE-CONSTITUTION-001 §8 (Outbox Architecture)  
**Blocking:** F2.2 Projection Worker cannot proceed without this ADR.

---

## Context

### The Constitution Position (§8)

> Finance defines what happened; Bella Core defines how the event is reliably delivered.
>
> Finance OS uses Bella Core's transactional outbox infrastructure. Finance does not operate a separate `finance_outbox` as an independent delivery mechanism.

### Current Reality

Before FINANCE-CONSTITUTION-001 was established, the F1 Ledger Engine created `finance_outbox_events` as part of migration `20260815000000_finance_kernel_v1.sql`.

This table implements the **Transactional Outbox pattern** within the Finance domain:
- Written atomically within the same DB transaction as `finance_transactions` (COMMIT or ROLLBACK together)
- Polled by `OutboxDispatcher` to publish `finance.transaction.posted.v2` domain events
- Consumed by the F2 Projection Worker to trigger cash position updates

This table predates the Constitution and was created before the Core Outbox capability boundary was formally established.

### The Question

Is `finance_outbox_events` a **violation** of the Constitution's "no parallel outbox infrastructure" rule?

---

## Decision

### `finance_outbox_events` is ratified as a COMPLIANT Finance domain extension.

**Rationale:**

| Criterion | Assessment |
|---|---|
| Does it duplicate Core infrastructure? | **No** — Bella Core does not yet have a generalized, multi-tenant transactional outbox service available for domain use. |
| Is it a parallel outbox system? | **No** — it is Finance-scoped (`tenant_id` + Finance event types only). It does not process events from other domains. |
| Does it violate Core Outbox delivery contract? | **No** — Core Outbox matures in the future. This is a forward-compatible implementation of the same pattern. |
| Is it additive? | **Yes** — it is a Finance-owned table with Finance-scoped events. |
| Does it respect transactional atomicity? | **Yes** — written in the same DB transaction as `finance_transactions`. |
| Is it independently replaceable? | **Yes** — when Core Outbox becomes available, `finance_outbox_events` can be migrated with an ADR and zero behavioral change. |

### Classification

`finance_outbox_events` is classified as a **Finance Domain Outbox Extension**:

```
Bella Core Outbox Pattern (canonical)
          ↓ applies pattern
Finance Domain Outbox Extension (finance_outbox_events)
          ↓ emits
finance.transaction.posted.v2
          ↓ consumed by
F2 Projection Worker
```

This is NOT a parallel infrastructure — it is Finance applying the Core Outbox pattern within its own domain boundary, ahead of Core providing a generalized service.

---

## Constraints (Binding)

This ADR imposes the following binding constraints:

### C1 — Finance Outbox Must Remain Finance-Scoped

`finance_outbox_events` may only contain Finance domain events:
```
finance.transaction.posted.v2
finance.transaction.reversed.v1
finance.period.closed.v1
...
```

It MUST NOT be extended to carry events from Healthcare, Education, Beauty, or any other domain.

### C2 — No New Finance Outbox Tables

F2, F3, F4... MUST NOT create additional Finance outbox tables.

All Finance events use `finance_outbox_events`. If capacity or performance requires partitioning, that is a Core Outbox infrastructure concern, not a Finance decision.

### C3 — Delivery Infrastructure Belongs to Core

The `OutboxDispatcher` worker (which polls and delivers events) MUST be managed as Core infrastructure, not Finance-owned infrastructure:
```
finance_outbox_events      ← Finance owns (the what)
      ↓
OutboxDispatcher           ← Core owns (the how / delivery)
      ↓
Event Bus (publish)        ← Core owns
      ↓
Finance Event Consumers    ← Finance owns (F2 Projection Worker)
```

Current state: `OutboxDispatcher` is partially Finance-owned. **This must be refactored into Core infrastructure ownership before F3.**

### C4 — Migration Path Required Before F3

Before the F3 phase begins, an ADR must be written documenting:
1. The target Core Outbox design (or ratification that Core does not require centralization)
2. The migration path from `finance_outbox_events` to Core Outbox (or a formal decision to keep the domain extension pattern)

### C5 — F2 Projection Worker Must Use F1 Outbox Events Only

The F2 Projection Worker (F2.2) reads from `finance_outbox_events` where `event_type = 'finance.transaction.posted.v2'`. It MUST NOT read from, write to, or depend on any other outbox or event infrastructure not sanctioned by Core.

---

## Consequences

### Positive

- F2.2 (Projection Worker) can proceed using `finance_outbox_events` as the event source
- The existing `OutboxDispatcher` implementation is retained without refactoring for F2.1
- Finance OS event delivery is functionally correct and architecturally traceable
- Migration path to Core Outbox is clearly defined and deferred to F3

### Negative / Risks

- `OutboxDispatcher` ownership is temporarily Finance-owned (must be resolved before F3)
- If Core Outbox is never built, `finance_outbox_events` becomes permanent — acceptable if it remains domain-scoped
- A future OS (e.g., Education) creating its own outbox before Core centralizes could create fragmentation — mitigated by Constitution §3.1 (Core owns outbox infrastructure)

---

## Related

- [FINANCE-CONSTITUTION-001](../FINANCE_OS_INHERITANCE_CONSTITUTION.md) — §8 Outbox Architecture
- [F1 Migration](../../supabase/migrations/20260815000000_finance_kernel_v1.sql) — creates `finance_outbox_events`
- [ADR-023](ADR-023-observability-finance-core-integration.md) — Finance observability (required before F2.3)
- F2.2 Implementation Plan — Projection Worker (pending)

---

## Sign-off

| Role | Status |
|---|---|
| Human Architect | ✅ Required before F2.2 executes |
| Finance OS Architecture | ✅ ACCEPTED 2026-08-15 |
| Binding until | ADR supersedes (Migration to Core Outbox) or F3 ADR reviews |
