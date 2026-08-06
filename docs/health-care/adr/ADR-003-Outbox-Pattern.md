# ADR-003: Outbox Pattern for Reliable Event Delivery

## Status
Approved

## Context
When an aggregate processes a command, it publishes events. If the write to the database succeeds but the event publication to the message broker / event bus fails (or vice versa), the system falls out of sync.

## Decision
We implement the **Transactional Outbox Pattern**:
1. During a command database transaction, the domain events are written to a dedicated `outbox` table in the database alongside the aggregate state mutation.
2. A background worker / publisher reads from this `outbox` table and guarantees event publishing to the Event Bus (At-Least-Once delivery guarantee).
3. The event bus dispatches to Projections.

## Consequences
- **Pros**: Dual-write problems are eliminated. Reliability of event delivery is guaranteed.
- **Cons**: Introduce asynchronous delay for event publishing, requiring background pollers or CDC (Change Data Capture) setups.
