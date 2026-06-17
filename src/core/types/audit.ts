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
 * Uses `any` type for before/after values because audit logs must track
 * changes to fields of any type (primitives, objects, arrays, null, undefined).
 * Using `unknown` would require type assertions at every usage site, which
 * would defeat the purpose of having a flexible audit trail.
 * 
 * This is a **justified exception** to the no-any rule for the following reasons:
 * - Audit logs need to capture changes to database columns of varying types
 * - Values are serialized to JSON for storage, so type safety at runtime is not critical
 * - The alternative (union of all possible types) would be impractical and unmaintainable
 * - Type guards would add unnecessary complexity to audit logging code
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
 * 
 * const objectChange: FieldChange = {
 *   before: { enabled: false },
 *   after: { enabled: true, threshold: 10 },
 * };
 * ```
 */
export interface FieldChange {
  /** Value before the change. Can be any type (string, number, boolean, object, array, null, undefined) */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  before: any;
  
  /** Value after the change. Can be any type (string, number, boolean, object, array, null, undefined) */
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
  
  /**
   * Additional context for audit forensics and troubleshooting.
   * 
   * @remarks
   * Uses `any` type for metadata values to allow flexible contextual information.
   * Common fields include:
   * - `ipAddress`: Client IP address (string)
   * - `userAgent`: Browser/client identifier (string)
   * - `reason`: User-provided reason for action (string)
   * - `approverRole`: Role of approving user (string)
   * - `originalValue`: Full object before change (object)
   * - `relatedResourceIds`: Array of related resource IDs (string[])
   * 
   * This is a **justified exception** to the no-any rule because:
   * - Metadata structure varies per action type and module
   * - New metadata fields may be added without schema changes
   * - Values are JSON-serializable and used for display/debugging only
   * - Strong typing would require complex discriminated unions per action type
   * 
   * @example
   * ```typescript
   * metadata: {
   *   ipAddress: '192.168.1.1',
   *   userAgent: 'Mozilla/5.0...',
   *   approverRole: 'admin',
   *   reason: 'Approved by manager for overtime work',
   * }
   * ```
   */
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
  /**
   * Additional context for audit forensics.
   * Can include IP address, user agent, reason, role, etc.
   * See {@link AuditEvent.metadata} for details.
   */
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
