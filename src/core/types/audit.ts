import type { ModuleId } from './module';

/**
 * Type of actor performing an action.
 * 
 * @remarks
 * Use this to distinguish between different types of actions:
 * - `user`: Action performed by an authenticated user through the UI
 * - `system`: Action performed automatically by the system (scheduled jobs, workflows)
 * - `api`: Action performed through API endpoints or webhooks (external integrations)
 */
export type ActorType = 'user' | 'system' | 'api';

/**
 * Field-level change tracking for audit logging.
 * 
 * @remarks
 * Use this to track what changed during an update operation.
 * Stores the value before and after the change for compliance and debugging.
 * 
 * @example
 * ```typescript
 * const statusChange: FieldChange = {
 *   before: 'pending_approval',
 *   after: 'approved',
 * };
 * 
 * const salaryChange: FieldChange = {
 *   before: 5000000,
 *   after: 5500000,
 * };
 * ```
 */
export interface FieldChange {
  /** Value before the change */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  before: any;
  
  /** Value after the change */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  after: any;
}

/**
 * Audit event recording a system action for compliance and troubleshooting.
 * 
 * @remarks
 * All critical business actions should generate audit events:
 * - Booking creation/modification/cancellation
 * - Payment processing
 * - Salary approval
 * - Expense approval
 * - Inventory transfers
 * 
 * **Security**: Always filter audit events by `tenantId` to ensure tenant isolation.
 * 
 * @example
 * ```typescript
 * const event: AuditEvent = {
 *   id: 'audit-uuid',
 *   tenantId: 'tenant-uuid',
 *   moduleId: 'spa',
 *   actorId: 'user-uuid',
 *   actorType: 'user',
 *   action: 'approve',
 *   resourceType: 'salary_record',
 *   resourceId: 'salary-uuid',
 *   timestamp: '2025-06-01T10:30:00Z',
 *   changes: {
 *     status: { before: 'pending_approval', after: 'approved' },
 *   },
 *   metadata: {
 *     approverRole: 'admin',
 *     ipAddress: '192.168.1.1',
 *   },
 * };
 * ```
 */
export interface AuditEvent {
  /** Unique identifier (UUID) */
  id: string;
  
  /** Tenant this event belongs to */
  tenantId: string;
  
  /** Module that generated this event (optional for core events) */
  moduleId?: ModuleId;
  
  /** User or system that performed the action */
  actorId: string;
  
  /** Type of actor */
  actorType: ActorType;
  
  /** Action performed (e.g., 'create', 'update', 'delete', 'approve', 'complete') */
  action: string;
  
  /** Type of resource affected (e.g., 'booking', 'session', 'salary_record', 'expense') */
  resourceType: string;
  
  /** ID of the affected resource */
  resourceId: string;
  
  /** When the action occurred (ISO 8601 timestamp) */
  timestamp: string;
  
  /** Field-level change tracking (optional) */
  changes?: Record<string, FieldChange>;
  
  /** Additional context (IP address, user agent, reason, etc.) */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata: Record<string, any>;
}

/**
 * Create a standardized audit event.
 * 
 * @param params - Event parameters
 * @returns AuditEvent ready to be logged
 * 
 * @remarks
 * This helper generates a complete audit event with automatic ID and timestamp.
 * Use this instead of manually constructing audit events to ensure consistency.
 * 
 * @example
 * ```typescript
 * // Log salary approval
 * const event = createAuditEvent({
 *   tenantId: 'tenant-uuid',
 *   moduleId: 'spa',
 *   actorId: currentUser.id,
 *   actorType: 'user',
 *   action: 'approve',
 *   resourceType: 'salary_record',
 *   resourceId: salaryRecord.id,
 *   changes: {
 *     status: { before: 'pending_approval', after: 'approved' },
 *     approvedAt: { before: null, after: new Date().toISOString() },
 *   },
 *   metadata: {
 *     approverRole: 'admin',
 *     ipAddress: req.ip,
 *   },
 * });
 * await saveAuditEvent(event);
 * ```
 */
export function createAuditEvent(params: {
  tenantId: string;
  moduleId?: ModuleId;
  actorId: string;
  actorType: ActorType;
  action: string;
  resourceType: string;
  resourceId: string;
  changes?: Record<string, FieldChange>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata?: Record<string, any>;
}): AuditEvent {
  return {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    ...params,
    metadata: params.metadata ?? {},
  };
}
