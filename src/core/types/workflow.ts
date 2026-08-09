import type { ModuleId } from './module';

/**
 * Workflow instance status.
 * 
 * @remarks
 * Represents the lifecycle stages of a workflow:
 * - `pending`: Workflow created but not yet started
 * - `running`: Workflow actively executing
 * - `paused`: Workflow temporarily suspended (manual or automatic)
 * - `completed`: Workflow finished successfully
 * - `failed`: Workflow encountered an error and stopped
 * - `cancelled`: Workflow manually terminated by user/system
 */
export type WorkflowStatus = 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';

/**
 * Workflow instance representing a running business process.
 * 
 * @remarks
 * Workflows orchestrate multi-step processes like:
 * - Booking confirmation → Payment → Service execution → Completion
 * - Salary calculation → Approval → Payment processing
 * - Inventory order → Approval → Receiving → Stock update
 * 
 * **State Machine Pattern**: Each workflow follows a defined state machine where
 * `currentState` represents the active step. Transitions between states are
 * governed by the workflow definition identified by `workflowDefinitionId`.
 * 
 * **Context Persistence**: The `context` field stores workflow-specific data
 * that persists across state transitions, allowing steps to access shared data.
 * 
 * **Error Handling**: When a workflow fails, the `status` is set to 'failed'
 * and the `error` field contains the failure reason. Failed workflows can be
 * retried or cancelled based on business logic.
 * 
 * @example
 * ```typescript
 * // Booking lifecycle workflow
 * const workflow: WorkflowInstance = {
 *   id: 'workflow-uuid',
 *   tenantId: 'tenant-uuid',
 *   moduleId: 'spa',
 *   workflowDefinitionId: 'booking_lifecycle',
 *   status: 'running',
 *   currentState: 'awaiting_payment',
 *   context: {
 *     bookingId: 'booking-uuid',
 *     customerId: 'customer-uuid',
 *     packageId: 'package-uuid',
 *     totalAmount: 15000000,
 *     paidAmount: 5000000,
 *     remainingBalance: 10000000,
 *     sessionsCompleted: 0,
 *     sessionsTotalAllocation: 20,
 *   },
 *   startedAt: '2025-06-01T09:00:00Z',
 *   metadata: {
 *     retryCount: 0,
 *     lastStateChange: '2025-06-01T09:15:00Z',
 *     initiatedBy: 'user-uuid',
 *     priority: 'normal',
 *   },
 * };
 * 
 * // After payment completed, workflow transitions
 * const updatedWorkflow: WorkflowInstance = {
 *   ...workflow,
 *   currentState: 'service_execution',
 *   context: {
 *     ...workflow.context,
 *     paidAmount: 15000000,
 *     remainingBalance: 0,
 *     paymentConfirmedAt: '2025-06-01T10:00:00Z',
 *   },
 *   metadata: {
 *     ...workflow.metadata,
 *     lastStateChange: '2025-06-01T10:00:00Z',
 *   },
 * };
 * ```
 */
export interface WorkflowInstance {
  /** Unique identifier (UUID) */
  id: string;
  
  /** Tenant this workflow belongs to */
  tenantId: string;
  
  /** Module that owns this workflow */
  moduleId: ModuleId;
  
  /** Workflow definition/template identifier */
  workflowDefinitionId: string;
  
  /** Current workflow status */
  status: WorkflowStatus;
  
  /** Current step/state in the workflow */
  currentState: string;
  
  /** 
   * Workflow execution context (data passed between steps).
   * 
   * @remarks
   * Store workflow-specific state that persists across state transitions.
   * Each step can read from and write to this context.
   * 
   * **Booking workflow examples**:
   * - `bookingId: string` - Reference to booking
   * - `customerId: string` - Customer ID
   * - `totalAmount: number` - Booking total
   * - `paidAmount: number` - Amount paid so far
   * - `remainingBalance: number` - Outstanding balance
   * - `sessionsCompleted: number` - Progress tracking
   * 
   * **Salary workflow examples**:
   * - `salaryRecordId: string` - Reference to salary record
   * - `ktvId: string` - KTV employee ID
   * - `month: string` - Salary month (YYYY-MM)
   * - `calculatedTotal: number` - Computed salary
   * - `approvalRequired: boolean` - Approval flag
   * 
   * **Inventory workflow examples**:
   * - `orderId: string` - Purchase order ID
   * - `supplierId: string` - Supplier reference
   * - `items: Array` - Ordered items
   * - `receivedItems: Array` - Items received
   * - `approvalStatus: string` - Current approval state
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  context: Record<string, unknown>;
  
  /** When the workflow started (ISO 8601 timestamp) */
  startedAt: string;
  
  /** When the workflow completed (ISO 8601 timestamp, optional) */
  completedAt?: string;
  
  /** Error message if workflow failed (optional) */
  error?: string;
  
  /** 
   * Additional workflow data (retry counts, timestamps, priority, etc.).
   * 
   * @remarks
   * Store operational metadata about workflow execution.
   * 
   * **Common fields**:
   * - `retryCount: number` - Number of retry attempts
   * - `lastStateChange: string` - ISO timestamp of last state transition
   * - `initiatedBy: string` - User/system ID that started workflow
   * - `priority: string` - Workflow priority (low, normal, high, urgent)
   * - `estimatedCompletionTime: string` - Expected completion timestamp
   * 
   * **Error handling**:
   * - `failureReason: string` - Detailed error message
   * - `lastError: string` - Most recent error
   * - `errorTimestamp: string` - When error occurred
   * 
   * **Monitoring**:
   * - `executionDuration: number` - Total execution time in milliseconds
   * - `stateTransitions: Array` - History of state changes
   * - `performanceMetrics: object` - Step-level performance data
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata: Record<string, unknown>;
}
