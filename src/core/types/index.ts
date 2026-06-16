/**
 * Core Service Contracts - Type Definitions
 * 
 * This barrel export file provides convenient access to all core service contract
 * interfaces defined in Phase 2 of the Core Platform Extraction Roadmap.
 * 
 * @remarks
 * These are compile-time-only TypeScript interfaces with zero runtime overhead.
 * They establish industry-neutral primitives that work across spa, cleaning,
 * home-service, and babycare modules.
 * 
 * **Phase 2 Status**: Contract definitions complete
 * **Phase 3 Plan**: Migrate existing code to use these contracts
 * 
 * @see {@link ../README.md} for usage guidance and examples
 */

// Foundational types (Task 1-3)
export type { TenantContext, SubscriptionPlan } from './tenant';
export { isTenantContext } from './tenant';

export type { ModuleId } from './module';
export { isModuleId, ALL_MODULE_IDS, MODULE_DISPLAY_NAMES } from './module';

// Feature flag types
export type { FeatureFlag } from './feature-flag';
export { isFeatureEnabled } from './feature-flag';

// Service catalog types
export type { CoreServiceCatalogItem, ServiceCatalogStatus } from './service-catalog';
export { isCoreServiceCatalogItem } from './service-catalog';

// Booking order types
export type { CoreBookingOrder, BookingOrderStatus } from './booking-order';
export { getRemainingBalance, isFullyPaid, isActiveBooking } from './booking-order';

// Payment and invoice types
export type { PaymentIntent, PaymentMethod, PaymentStatus } from './payment';
export type { Invoice, InvoiceLineItem, InvoiceStatus } from './payment';
export { getInvoiceBalance, isInvoiceOverdue } from './payment';

// Audit event types
export type { AuditEvent, ActorType, FieldChange } from './audit';
export { createAuditEvent } from './audit';

// Notification event types (Task 11.2)
export type { NotificationEvent, RecipientType, NotificationChannel, NotificationPriority } from './notification';

// Workflow instance types
export type { WorkflowInstance, WorkflowStatus } from './workflow';

// Module adapter types (Task 13.2)
export type { ModuleAdapter } from './module-adapter';
