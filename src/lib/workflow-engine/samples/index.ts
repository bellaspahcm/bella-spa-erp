/**
 * Workflow Engine Sample Workflows
 * 
 * Three real-world workflow examples demonstrating:
 * 1. Booking-to-Fulfillment - Decision + conditional branching + parallel notifications
 * 2. Payroll Approval - Multiple decisions + human approvals + pause/resume
 * 3. Inventory Reorder - Decision + conditional branching + compensation
 */

// ============ Booking-to-Fulfillment Workflow ============
export {
  createBookingToFulfillmentWorkflow
} from './booking-to-fulfillment';

export type {
  IBookingService,
  IInventoryService as IBookingInventoryService,
  IKtvService,
  INotificationService as IBookingNotificationService
} from './booking-to-fulfillment';

// ============ Payroll Approval Workflow ============
export {
  createPayrollApprovalWorkflow
} from './payroll-approval';

export type {
  IApprovalService,
  IPayrollService,
  IAccountingService
} from './payroll-approval';

// ============ Inventory Reorder Workflow ============
export {
  createInventoryReorderWorkflow
} from './inventory-reorder';

export type {
  IInventoryService as IReorderInventoryService,
  IPurchaseOrderService,
  INotificationService as IReorderNotificationService,
  IAuditService
} from './inventory-reorder';
