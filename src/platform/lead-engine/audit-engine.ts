import { LeadAuditEvent, AuditEventType, ManagedLead } from './types';

export class LeadAuditEngine {
  /**
   * Sinh một sự kiện Timeline mới
   */
  public static createEvent(
    leadId: string,
    eventType: AuditEventType,
    actorId: string,
    actorName: string,
    description: string,
    metadata?: Record<string, unknown>
  ): LeadAuditEvent {
    return {
      id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      leadId,
      eventType,
      actorId,
      actorName,
      description,
      metadata,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Thêm sự kiện vào dòng thời gian của Lead
   */
  public static recordEvent(
    lead: ManagedLead,
    eventType: AuditEventType,
    actorId: string,
    actorName: string,
    description: string,
    metadata?: Record<string, unknown>
  ): ManagedLead {
    const event = this.createEvent(lead.id, eventType, actorId, actorName, description, metadata);
    return {
      ...lead,
      auditTimeline: [event, ...(lead.auditTimeline || [])],
      updatedAt: new Date().toISOString(),
    };
  }
}
