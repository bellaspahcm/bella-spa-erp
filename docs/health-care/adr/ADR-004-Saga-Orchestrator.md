# ADR-004: Saga Process Manager for Cross-Context Workflows

## Status
Approved

## Context
Workflows in Bella Healthcare span multiple Bounded Contexts (Scheduling, Encounter, Clinical, Resource). For example, booking an appointment requires allocating chairs, notifying doctors, and prepping rooms.

## Decision
We implement a **Saga / Process Manager** (`EncounterSaga`):
1. The Saga acts as an orchestrator listening to events from the Event Bus.
2. Based on received events, it issues Commands to other Bounded Contexts.
3. Saga state is persisted to track long-running multi-stage transaction cycles.

## Consequences
- **Pros**: Clear responsibility segregation, decoupled context boundaries, robust failure/compensating transaction management.
- **Cons**: Debugging complex distributed flows requires complete event stream tracing.
