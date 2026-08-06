# ADR-002: Command Query Responsibility Segregation (CQRS)

## Status
Approved

## Context
Writing data and performing complex analytical dashboard reporting / AI decision inference on a single data model creates scalability issues, locks table schemas, and slows down UI interactions.

## Decision
We implement **CQRS** (Command Query Responsibility Segregation).
1. **Command Side**: Handles mutation intents (e.g. `CheckInPatientCommand`, `UpdateToothStatusCommand`) by loading aggregates from the event store and outputting versioned domain events.
2. **Query Side**: Subscribes to the Event Bus and projects event streams into decoupled **Read Models** (e.g. `EncounterReadRepository`, `ChairReadRepository`).
3. UI components and AI engines query these Read Models instead of querying the event store or the live database transactional tables.

## Consequences
- **Pros**: Optimized read performance, flexible view models, decoupled read/write database schemas.
- **Cons**: Eventual consistency between command execution and projection updates.
