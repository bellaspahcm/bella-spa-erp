/**
 * Common Core — Event Bus & Messaging Abstractions
 * 
 * Domain-agnostic event bus contracts and event envelope interfaces.
 * Complies with strict 1-way dependency: Common Core does NOT import any domain or host modules.
 * 
 * @module platform/core/events
 */

export interface DomainEventEnvelope<T = unknown> {
  eventId: string;
  eventType: string; // Open string; domain-agnostic
  eventVersion: string;
  tenantId: string;
  aggregateId: string;
  aggregateType: string;
  occurredAt: string; // ISO 8601 string
  payload: T;
  userId?: string;
  correlationId?: string;
  causationId?: string;
}

export type EventHandler<T = unknown> = (event: DomainEventEnvelope<T>) => Promise<void> | void;

export interface EventBusPort {
  publish<T = unknown>(event: DomainEventEnvelope<T>): Promise<void>;
  subscribe<T = unknown>(eventType: string, handler: EventHandler<T>): () => void;
  clear(): void;
}
