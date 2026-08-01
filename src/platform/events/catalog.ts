/**
 * @fileoverview Platform Centralized Event Catalog
 *
 * Single source of truth for all typed platform events across verticals.
 * Provides EventBuilder factory, event schema lookup, and runtime validation.
 *
 * @module platform/events/catalog
 */

// ─────────────────────────────────────────────────────────────────────────────
// Event Envelope & Core Types
// ─────────────────────────────────────────────────────────────────────────────

export type EventVersion = 'v1' | 'v2' | 'v3';
export type EventCategory = 'domain' | 'integration' | 'system' | 'audit';

export interface PlatformEventEnvelope<TPayload = Record<string, unknown>> {
  /** Globally unique event ID */
  eventId: string;
  /** Namespaced event type: domain.entity.verb.version (e.g. crm.lead.created.v1) */
  eventType: string;
  /** Event schema version */
  eventVersion: EventVersion;
  /** Category for routing/filtering */
  category: EventCategory;
  /** Tenant isolation */
  tenantId: string;
  /** Correlation chain for distributed tracing */
  correlationId: string;
  /** Original request ID */
  requestId?: string;
  /** Actor who triggered this event */
  actor: {
    userId: string;
    userName?: string;
    roles?: string[];
  };
  /** Event-specific payload */
  payload: TPayload;
  /** ISO timestamp */
  timestamp: string;
  /** Source module/vertical */
  source?: string;
  /** Optional idempotency key */
  idempotencyKey?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Known Platform Event Types (typed catalog)
// ─────────────────────────────────────────────────────────────────────────────

/** Domain Events — business state changes within a vertical */
export type DomainEventType =
  // Resource lifecycle
  | 'resource.assigned.v1'
  | 'resource.accepted.v1'
  | 'resource.rotated.v1'
  | 'resource.closed.v1'
  | 'resource.sla.breached.v1'
  | 'resource.workflow.updated.v1'
  // CRM
  | 'crm.lead.created.v1'
  | 'crm.lead.qualified.v1'
  | 'crm.lead.converted.v1'
  | 'crm.lead.lost.v1'
  // Real Estate
  | 'real_estate.apartment.reserved.v1'
  | 'real_estate.apartment.deposited.v1'
  | 'real_estate.apartment.contracted.v1'
  | 'real_estate.apartment.cancelled.v1'
  | 'real_estate.contract.signed.v1'
  | 'real_estate.payment.received.v1'
  // HR & Payroll
  | 'hr.salary.calculated.v1'
  | 'hr.salary.approved.v1'
  | 'hr.salary.paid.v1'
  | 'hr.attendance.checked_in.v1'
  | 'hr.attendance.checked_out.v1'
  // Finance
  | 'finance.journal.posted.v1'
  | 'finance.expense.approved.v1'
  | 'finance.month.closed.v1';

/** Integration Events — cross-system notifications */
export type IntegrationEventType =
  | 'erp.invoice.created.v1'
  | 'erp.payment.synced.v1'
  | 'misa.journal.synced.v1'
  | 'facebook.lead.received.v1'
  | 'zalo.message.sent.v1'
  | 'webhook.delivered.v1'
  | 'webhook.failed.v1';

/** System Events — platform infrastructure */
export type SystemEventType =
  | 'platform.tenant.created.v1'
  | 'platform.config.changed.v1'
  | 'platform.feature_flag.toggled.v1'
  | 'platform.engine.error.v1'
  | 'platform.dlq.item.added.v1';

/** Audit Events — immutable trail */
export type AuditEventType =
  | 'audit.state_transition.v1'
  | 'audit.permission.denied.v1'
  | 'audit.data.accessed.v1'
  | 'audit.data.modified.v1'
  | 'audit.admin.action.v1';

export type PlatformEventType =
  | DomainEventType
  | IntegrationEventType
  | SystemEventType
  | AuditEventType
  | string; // extensible for vertical-specific events

// ─────────────────────────────────────────────────────────────────────────────
// Event Schema Registry
// ─────────────────────────────────────────────────────────────────────────────

export interface EventSchemaEntry {
  type: PlatformEventType;
  category: EventCategory;
  version: EventVersion;
  description: string;
  /** Required payload fields (for runtime validation) */
  requiredFields?: string[];
  /** Whether event is idempotency-safe to replay */
  idempotent?: boolean;
  /** Max retain days for audit */
  retentionDays?: number;
}

/** Central event schema registry */
const EVENT_SCHEMA_MAP = new Map<PlatformEventType, EventSchemaEntry>([
  // ── Resource ──────────────────────────────────────────────────────────────
  ['resource.assigned.v1', { type: 'resource.assigned.v1', category: 'domain', version: 'v1', description: 'Resource assigned to an agent', idempotent: true, retentionDays: 365 }],
  ['resource.sla.breached.v1', { type: 'resource.sla.breached.v1', category: 'domain', version: 'v1', description: 'SLA deadline breached', requiredFields: ['stage', 'deadlineTime'], retentionDays: 365 }],
  // ── CRM ───────────────────────────────────────────────────────────────────
  ['crm.lead.created.v1', { type: 'crm.lead.created.v1', category: 'domain', version: 'v1', description: 'New lead created in CRM', requiredFields: ['leadId', 'source'], retentionDays: 730 }],
  ['crm.lead.converted.v1', { type: 'crm.lead.converted.v1', category: 'domain', version: 'v1', description: 'Lead converted to opportunity', idempotent: true, retentionDays: 730 }],
  // ── Real Estate ───────────────────────────────────────────────────────────
  ['real_estate.apartment.reserved.v1', { type: 'real_estate.apartment.reserved.v1', category: 'domain', version: 'v1', description: 'Apartment reserved by investor', requiredFields: ['apartmentId', 'investorId'], retentionDays: 3650 }],
  ['real_estate.apartment.contracted.v1', { type: 'real_estate.apartment.contracted.v1', category: 'domain', version: 'v1', description: 'Contract signed for apartment', requiredFields: ['contractId', 'apartmentId'], retentionDays: 3650 }],
  // ── Finance ───────────────────────────────────────────────────────────────
  ['finance.journal.posted.v1', { type: 'finance.journal.posted.v1', category: 'domain', version: 'v1', description: 'Journal entry posted to ledger', requiredFields: ['journalId', 'amount'], idempotent: true, retentionDays: 3650 }],
  ['finance.month.closed.v1', { type: 'finance.month.closed.v1', category: 'domain', version: 'v1', description: 'Month-end accounting closed', idempotent: true, retentionDays: 3650 }],
  // ── Integration ───────────────────────────────────────────────────────────
  ['misa.journal.synced.v1', { type: 'misa.journal.synced.v1', category: 'integration', version: 'v1', description: 'Journal synced to MISA ERP', idempotent: true, retentionDays: 365 }],
  ['facebook.lead.received.v1', { type: 'facebook.lead.received.v1', category: 'integration', version: 'v1', description: 'Lead received from Facebook Lead Ads', requiredFields: ['leadgenId', 'formId'], idempotent: true, retentionDays: 365 }],
  // ── Audit ────────────────────────────────────────────────────────────────
  ['audit.state_transition.v1', { type: 'audit.state_transition.v1', category: 'audit', version: 'v1', description: 'State machine transition recorded', requiredFields: ['fromState', 'toState', 'event'], idempotent: true, retentionDays: 3650 }],
  ['audit.permission.denied.v1', { type: 'audit.permission.denied.v1', category: 'audit', version: 'v1', description: 'Permission check denied', requiredFields: ['permission', 'userId'], retentionDays: 365 }],
]);

// ─────────────────────────────────────────────────────────────────────────────
// Event Builder
// ─────────────────────────────────────────────────────────────────────────────

function generateEventId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).substring(2, 8);
  return `evt_${ts}_${rand}`;
}

export class EventBuilder {
  /**
   * Build a fully structured PlatformEventEnvelope from minimal params.
   */
  static build<TPayload = Record<string, unknown>>(params: {
    eventType: PlatformEventType;
    tenantId: string;
    actor: { userId: string; userName?: string; roles?: string[] };
    payload: TPayload;
    correlationId?: string;
    requestId?: string;
    source?: string;
    idempotencyKey?: string;
  }): PlatformEventEnvelope<TPayload> {
    const schema = EVENT_SCHEMA_MAP.get(params.eventType);
    const version: EventVersion = schema?.version ?? 'v1';
    const category: EventCategory = schema?.category ?? 'domain';

    return {
      eventId: generateEventId(),
      eventType: params.eventType,
      eventVersion: version,
      category,
      tenantId: params.tenantId,
      correlationId: params.correlationId ?? generateEventId(),
      requestId: params.requestId,
      actor: params.actor,
      payload: params.payload,
      timestamp: new Date().toISOString(),
      source: params.source,
      idempotencyKey: params.idempotencyKey,
    };
  }

  /**
   * Validate that a payload contains all required fields for this event type.
   */
  static validate(eventType: PlatformEventType, payload: Record<string, unknown>): { valid: boolean; missing: string[] } {
    const schema = EVENT_SCHEMA_MAP.get(eventType);
    if (!schema?.requiredFields) return { valid: true, missing: [] };
    const missing = schema.requiredFields.filter((f) => !(f in payload));
    return { valid: missing.length === 0, missing };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Event Catalog Singleton
// ─────────────────────────────────────────────────────────────────────────────

class EventCatalog {
  private schemas = EVENT_SCHEMA_MAP;

  /** Lookup schema for a given event type */
  getSchema(eventType: PlatformEventType): EventSchemaEntry | undefined {
    return this.schemas.get(eventType);
  }

  /** Register a new event type (for vertical-specific events) */
  register(entry: EventSchemaEntry): void {
    this.schemas.set(entry.type, entry);
  }

  /** List all registered event types by category */
  listByCategory(category: EventCategory): EventSchemaEntry[] {
    return Array.from(this.schemas.values()).filter((s) => s.category === category);
  }

  /** Get all registered event types */
  listAll(): EventSchemaEntry[] {
    return Array.from(this.schemas.values());
  }
}

export const eventCatalog = new EventCatalog();
