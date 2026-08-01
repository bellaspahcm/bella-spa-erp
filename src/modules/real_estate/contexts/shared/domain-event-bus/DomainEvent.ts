export interface DomainEvent {
  readonly eventId: string;
  readonly eventType: string;
  readonly aggregateId: string;
  readonly aggregateType: string;
  readonly tenantId: string;
  readonly occurredAt: Date;
  readonly version: number;
  readonly correlationId: string;
  readonly causationId?: string;
  readonly payload: Readonly<Record<string, unknown>>;
}
