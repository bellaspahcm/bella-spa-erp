import { ResourceAuditEvent, ResourceType } from './types';

export class ResourceAuditEngine {
  public static createEvent(
    resourceType: ResourceType,
    resourceId: string,
    eventType: string,
    actorId: string,
    actorName: string,
    description: string,
    metadata?: Record<string, unknown>
  ): ResourceAuditEvent {
    return {
      id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      resourceType,
      resourceId,
      eventType,
      actorId,
      actorName,
      description,
      metadata,
      timestamp: new Date().toISOString(),
    };
  }
}
