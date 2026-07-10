/**
 * Mock Event Publisher for Testing
 * 
 * In-memory event publisher for unit tests and integration tests.
 * Stores events in memory for assertions without external dependencies.
 */

import type { IEventPublisher } from '../abstractions/IEventPublisher';
import type { DomainEvent } from '../types';

export class MockEventPublisher implements IEventPublisher {
  private events: DomainEvent[] = [];
  
  async publish(event: DomainEvent): Promise<void> {
    this.events.push(event);
  }
  
  async publishBatch(events: DomainEvent[]): Promise<void> {
    this.events.push(...events);
  }
  
  /**
   * Get all published events
   */
  getEvents(): DomainEvent[] {
    return [...this.events];
  }
  
  /**
   * Get events by type
   */
  getEventsByType(type: string): DomainEvent[] {
    return this.events.filter(e => e.type === type);
  }
  
  /**
   * Get events by tenant
   */
  getEventsByTenant(tenantId: string): DomainEvent[] {
    return this.events.filter(e => e.tenantId === tenantId);
  }
  
  /**
   * Get events by correlation ID
   */
  getEventsByCorrelation(correlationId: string): DomainEvent[] {
    return this.events.filter(e => e.correlationId === correlationId);
  }
  
  /**
   * Clear all events (for test cleanup)
   */
  clear(): void {
    this.events = [];
  }
  
  /**
   * Get event count
   */
  count(): number {
    return this.events.length;
  }
  
  /**
   * Check if specific event was published
   */
  hasEvent(type: string, predicate?: (event: DomainEvent) => boolean): boolean {
    const events = this.getEventsByType(type);
    if (!predicate) {
      return events.length > 0;
    }
    return events.some(predicate);
  }
}
