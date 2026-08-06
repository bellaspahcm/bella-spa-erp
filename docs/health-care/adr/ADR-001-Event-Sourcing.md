# ADR-001: Event Sourcing with Versioned Schemas in Bella Healthcare Platform

## Status
Approved

## Context
Bella Healthcare Platform requires a highly audit-ready, scalable, and resilient clinical operation model. In order to capture every change in clinical workflow, tooth updates, and prescribing actions for compliance, telemetry, and AI training context, we need a complete chronological ledger of state mutations.

## Decision
We implement **Event Sourcing** as the write model pattern for key aggregates.
1. The state of an aggregate (e.g., `Encounter`, `Patient`) is derived by replaying its historical domain events.
2. Events are immutable, versioned, and follow the naming scheme: `[Context][Action].[Version]` (e.g. `AppointmentCreated.v1`, `EncounterArrived.v1`, `ToothUpdated.v1`, `EncounterFinished.v2`).
3. Every event carries metadata, including correlation ID, causation ID, occurred timestamp, schema version, tenant, and active user context.

## Consequences
- **Pros**: Complete audit trail for medical safety compliance, capability to rebuild any historical state, rich dataset for offline AI training and pipeline modeling.
- **Cons**: Higher initial code complexity, need for upcasters when schema versions evolve.
