# Implementation Plan: Core Service Contracts

## Overview

This implementation plan breaks down Phase 2 of the Core Platform Extraction Roadmap into discrete, actionable tasks. The goal is to create TypeScript interface definitions for 10 core service contracts that establish clear boundaries between the core platform and industry-specific modules.

**Critical Constraints:**
- Type-only changes (interfaces, types, type aliases)
- Zero runtime overhead (compile-time only)
- No database schema changes
- No file/folder moves (deferred to Phase 3)
- No business logic changes
- All existing tests must pass (Jest 1297/1297)
- TypeScript compilation must remain clean
- ESLint must pass with no new errors

**Implementation Language:** TypeScript

**Verification Strategy:**
- After each major milestone, run `npx tsc --noEmit --pretty false`
- After all contract files are created, run full Jest suite
- Final ESLint check before completion

## Tasks

- [x] 1. Create directory structure and index file
  - Create `src/core/types/` directory
  - Create `src/core/types/index.ts` barrel export file (initially empty)
  - _Requirements: All requirements (foundational structure)_

- [x] 2. Implement TenantContext interface
  - [x] 2.1 Create `src/core/types/tenant.ts` with TenantContext interface
    - Define `SubscriptionPlan` type: `'free' | 'basic' | 'professional' | 'enterprise'`
    - Define `TenantContext` interface with all required fields:
      - `tenantId: string` (UUID)
      - `tenantName: string`
      - `enabledModules: readonly ModuleId[]`
      - `subscriptionPlan: SubscriptionPlan`
      - `featureFlags: Readonly<Record<string, boolean>>`
      - `settings: Readonly<Record<string, any>>`
    - Add TSDoc comments explaining usage and serialization safety
    - Mark all fields as `readonly` for immutability
    - Add example in TSDoc showing context construction
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10_
  
  - [x] 2.2 Add optional type guard function `isTenantContext`
    - Implement runtime validation checking all required fields
    - Add TSDoc with usage example
    - _Requirements: 1.8_
  
  - [x] 2.3 Export TenantContext and SubscriptionPlan from index.ts
    - Add exports to `src/core/types/index.ts`
    - _Requirements: 1.7_

- [x] 3. Implement ModuleId type and constants
  - [x] 3.1 Create `src/core/types/module.ts` with ModuleId type
    - Define `ModuleId` type: `'spa' | 'babycare' | 'cleaning' | 'home-service'`
    - Add TSDoc explaining module identifiers and how to add new modules
    - _Requirements: 2.1, 2.2, 2.3, 2.4_
  
  - [x] 3.2 Add type guard and constants
    - Implement `isModuleId(value: unknown): value is ModuleId` type guard
    - Define `ALL_MODULE_IDS: readonly ModuleId[]` constant
    - Define `MODULE_DISPLAY_NAMES: Readonly<Record<ModuleId, string>>` constant
    - Add TSDoc for each constant
    - _Requirements: 2.3, 2.5_
  
  - [x] 3.3 Export ModuleId and utilities from index.ts
    - Add exports to `src/core/types/index.ts`
    - _Requirements: 2.2_

- [x] 4. Implement FeatureFlag interface
  - [x] 4.1 Create `src/core/types/feature-flag.ts` with FeatureFlag interface
    - Define `FeatureFlag` interface with fields:
      - `key: string`
      - `enabled: boolean`
      - `requiredPlan?: readonly SubscriptionPlan[]`
      - `requiredModules?: readonly ModuleId[]`
      - `metadata?: Readonly<Record<string, any>>`
    - Import `SubscriptionPlan` from `./tenant`
    - Import `ModuleId` from `./module`
    - Add TSDoc with example showing feature flag evaluation
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_
  
  - [x] 4.2 Add helper function `isFeatureEnabled`
    - Implement `isFeatureEnabled(flag: FeatureFlag, context: TenantContext): boolean`
    - Check `enabled` flag first
    - Validate `requiredPlan` constraint
    - Validate `requiredModules` constraint
    - Add TSDoc with usage example
    - _Requirements: 3.7, 3.8_
  
  - [x] 4.3 Export FeatureFlag and utilities from index.ts
    - Add exports to `src/core/types/index.ts`
    - _Requirements: 3.6_

- [x] 5. Checkpoint - Verify foundational types compile
  - Run `npx tsc --noEmit --pretty false` to verify no compilation errors
  - Manually test imports in a scratch file to verify IntelliSense works
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Implement CoreServiceCatalogItem interface
  - [x] 6.1 Create `src/core/types/service-catalog.ts` with CoreServiceCatalogItem interface
    - Define `ServiceCatalogStatus` type: `'active' | 'inactive' | 'archived'`
    - Define `CoreServiceCatalogItem` interface with fields:
      - `id: string` (UUID)
      - `tenantId: string` (UUID)
      - `moduleId: ModuleId`
      - `name: string`
      - `description?: string`
      - `basePrice: number`
      - `currency: string` (ISO 4217 code)
      - `status: ServiceCatalogStatus`
      - `metadata: Record<string, any>`
    - Import `ModuleId` from `./module`
    - Add TSDoc explaining industry-neutral design and spa module extensions
    - Include example showing spa package with metadata (total_sessions, session_multiplier, category)
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 4.10, 4.11_
  
  - [x] 6.2 Add optional type guard `isCoreServiceCatalogItem`
    - Implement runtime validation for all required fields
    - Add TSDoc
    - _Requirements: 4.10_
  
  - [x] 6.3 Export CoreServiceCatalogItem and types from index.ts
    - Add exports to `src/core/types/index.ts`
    - _Requirements: 4.10_

- [x] 7. Implement CoreBookingOrder interface
  - [x] 7.1 Create `src/core/types/booking-order.ts` with CoreBookingOrder interface
    - Define `BookingOrderStatus` type: `'draft' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled'`
    - Define `CoreBookingOrder` interface with fields:
      - `id: string` (UUID)
      - `tenantId: string` (UUID)
      - `moduleId: ModuleId`
      - `customerId: string` (UUID)
      - `serviceItemId: string` (UUID)
      - `status: BookingOrderStatus`
      - `scheduledStartTime: string` (ISO 8601)
      - `scheduledEndTime?: string` (ISO 8601)
      - `totalAmount: number`
      - `paidAmount: number`
      - `metadata: Record<string, any>`
    - Import `ModuleId` from `./module`
    - Add TSDoc explaining industry-neutral design and module-specific extensions
    - Include example showing spa booking with session progress in metadata
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9, 5.10, 5.11, 5.12, 5.13_
  
  - [x] 7.2 Add helper functions for booking operations
    - Implement `getRemainingBalance(booking: CoreBookingOrder): number`
    - Implement `isFullyPaid(booking: CoreBookingOrder): boolean`
    - Implement `isActiveBooking(booking: CoreBookingOrder): boolean`
    - Add TSDoc for each helper
    - _Requirements: 5.9, 5.10_
  
  - [x] 7.3 Export CoreBookingOrder and utilities from index.ts
    - Add exports to `src/core/types/index.ts`
    - _Requirements: 5.12_

- [x] 8. Implement PaymentIntent and Invoice interfaces
  - [x] 8.1 Create `src/core/types/payment.ts` with PaymentIntent interface
    - Define `PaymentMethod` type: `'cash' | 'bank_transfer' | 'credit_card' | 'e_wallet' | 'other'`
    - Define `PaymentStatus` type: `'pending' | 'processing' | 'succeeded' | 'failed' | 'cancelled'`
    - Define `PaymentIntent` interface with fields:
      - `id: string` (UUID)
      - `tenantId: string` (UUID)
      - `customerId: string` (UUID)
      - `bookingOrderId: string` (UUID)
      - `amount: number`
      - `currency: string` (ISO 4217 code)
      - `method: PaymentMethod`
      - `status: PaymentStatus`
      - `metadata: Record<string, any>`
    - Add TSDoc with payment processing example
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9, 6.10_
  
  - [x] 8.2 Add Invoice interface and InvoiceLineItem to payment.ts
    - Define `InvoiceStatus` type: `'draft' | 'issued' | 'paid' | 'overdue' | 'cancelled'`
    - Define `InvoiceLineItem` interface with fields:
      - `description: string`
      - `quantity: number`
      - `unitPrice: number`
      - `amount: number`
      - `metadata?: Record<string, any>`
    - Define `Invoice` interface with fields:
      - `id: string` (UUID)
      - `tenantId: string` (UUID)
      - `customerId: string` (UUID)
      - `bookingOrderId: string` (UUID)
      - `invoiceNumber: string`
      - `issueDate: string` (ISO 8601 date)
      - `dueDate: string` (ISO 8601 date)
      - `totalAmount: number`
      - `paidAmount: number`
      - `status: InvoiceStatus`
      - `lineItems: InvoiceLineItem[]`
    - Add TSDoc with invoice example
    - _Requirements: 6.11, 6.12, 6.13, 6.14, 6.15, 6.16, 6.17, 6.18, 6.19, 6.20, 6.21, 6.22_
  
  - [x] 8.3 Add invoice helper functions
    - Implement `getInvoiceBalance(invoice: Invoice): number`
    - Implement `isInvoiceOverdue(invoice: Invoice): boolean`
    - Add TSDoc for each helper
    - _Requirements: 6.18, 6.19_
  
  - [x] 8.4 Export payment types from index.ts
    - Add exports to `src/core/types/index.ts`
    - _Requirements: 6.10, 6.22_

- [x] 9. Checkpoint - Verify business entity types compile
  - Run `npx tsc --noEmit --pretty false`
  - Test importing CoreServiceCatalogItem, CoreBookingOrder, PaymentIntent, Invoice
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Implement AuditEvent interface
  - [x] 10.1 Create `src/core/types/audit.ts` with AuditEvent interface
    - Define `ActorType` type: `'user' | 'system' | 'api'`
    - Define `FieldChange` interface with `before: any` and `after: any` fields
    - Define `AuditEvent` interface with fields:
      - `id: string` (UUID)
      - `tenantId: string` (UUID)
      - `moduleId?: ModuleId`
      - `actorId: string` (UUID)
      - `actorType: ActorType`
      - `action: string`
      - `resourceType: string`
      - `resourceId: string` (UUID)
      - `timestamp: string` (ISO 8601)
      - `changes?: Record<string, FieldChange>`
      - `metadata: Record<string, any>`
    - Import `ModuleId` from `./module`
    - Add TSDoc explaining audit logging for compliance
    - Include example showing salary approval audit
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9, 7.10, 7.11, 7.12, 7.13, 7.14_
  
  - [x] 10.2 Add helper function `createAuditEvent`
    - Implement factory function generating UUID and timestamp
    - Accept params object with all required fields
    - Return complete AuditEvent
    - Add TSDoc
    - _Requirements: 7.13_
  
  - [x] 10.3 Export AuditEvent types from index.ts
    - Add exports to `src/core/types/index.ts`
    - _Requirements: 7.12_

- [x] 11. Implement NotificationEvent interface
  - [x] 11.1 Create `src/core/types/notification.ts` with NotificationEvent interface
    - Define `RecipientType` type: `'user' | 'customer' | 'admin'`
    - Define `NotificationChannel` type: `'in_app' | 'email' | 'sms' | 'webhook' | 'push'`
    - Define `NotificationPriority` type: `'low' | 'medium' | 'high' | 'urgent'`
    - Define `NotificationEvent` interface with fields:
      - `id: string` (UUID)
      - `tenantId: string` (UUID)
      - `moduleId?: ModuleId`
      - `type: string`
      - `recipientId: string` (UUID)
      - `recipientType: RecipientType`
      - `channels: NotificationChannel[]`
      - `priority: NotificationPriority`
      - `title: string`
      - `message: string`
      - `metadata: Record<string, any>`
      - `createdAt: string` (ISO 8601)
    - Import `ModuleId` from `./module`
    - Add TSDoc explaining multi-channel notification system
    - Include example showing booking confirmation notification
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8, 8.9, 8.10, 8.11, 8.12, 8.13, 8.14, 8.15_
  
  - [x] 11.2 Export NotificationEvent types from index.ts
    - Add exports to `src/core/types/index.ts`
    - _Requirements: 8.13_

- [x] 12. Implement WorkflowInstance interface
  - [x] 12.1 Create `src/core/types/workflow.ts` with WorkflowInstance interface
    - Define `WorkflowStatus` type: `'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled'`
    - Define `WorkflowInstance` interface with fields:
      - `id: string` (UUID)
      - `tenantId: string` (UUID)
      - `moduleId: ModuleId`
      - `workflowDefinitionId: string`
      - `status: WorkflowStatus`
      - `currentState: string`
      - `context: Record<string, any>`
      - `startedAt: string` (ISO 8601)
      - `completedAt?: string` (ISO 8601)
      - `error?: string`
      - `metadata: Record<string, any>`
    - Import `ModuleId` from `./module`
    - Add TSDoc explaining workflow orchestration
    - Include example showing booking lifecycle workflow
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8, 9.9, 9.10, 9.11, 9.12, 9.13, 9.14_
  
  - [x] 12.2 Export WorkflowInstance types from index.ts
    - Add exports to `src/core/types/index.ts`
    - _Requirements: 9.12_

- [x] 13. Implement ModuleAdapter interface
  - [x] 13.1 Create `src/core/types/module-adapter.ts` with ModuleAdapter interface
    - Import `ModuleId` from `./module`
    - Import `CoreServiceCatalogItem` from `./service-catalog`
    - Import `CoreBookingOrder` from `./booking-order`
    - Import `TenantContext` from `./tenant`
    - Define `ModuleAdapter` interface with fields:
      - `moduleId: ModuleId`
      - `moduleName: string`
      - `transformServiceItem?: (item: CoreServiceCatalogItem) => any`
      - `transformBookingOrder?: (order: CoreBookingOrder) => any`
      - `validateBookingRules?: (order: CoreBookingOrder, context: TenantContext) => Promise<boolean>`
      - `calculatePricing?: (item: CoreServiceCatalogItem, context: TenantContext) => Promise<number>`
      - `onBookingCompleted?: (order: CoreBookingOrder, context: TenantContext) => Promise<void>`
      - `getModuleWidgets?: () => any[]`
    - Add TSDoc explaining module extension points
    - Include note that registration system is deferred to Phase 3
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8, 10.9, 10.10, 10.11_
  
  - [x] 13.2 Export ModuleAdapter from index.ts
    - Add exports to `src/core/types/index.ts`
    - _Requirements: 10.9_

- [x] 14. Checkpoint - Verify all contract types compile
  - Run `npx tsc --noEmit --pretty false` to ensure zero compilation errors
  - Manually test importing all contracts from `src/core/types` in a scratch file
  - Verify IntelliSense shows TSDoc comments for all interfaces
  - Ensure all tests pass, ask the user if questions arise.

- [x] 15. Create README.md with usage guidance
  - [x] 15.1 Create `src/core/types/README.md` with comprehensive documentation
    - Add "Overview" section explaining Phase 2 goals and zero-runtime-overhead design
    - Add "Contract Definitions" section listing all 10 interfaces with brief descriptions
    - Add "Usage Examples" section showing:
      - How to construct TenantContext from tenant database row
      - How to pass TenantContext to service functions
      - How to store module-specific data in metadata fields
      - How ModuleAdapter will be registered in Phase 3
    - Add "Migration Path" section explaining:
      - These contracts are for future use (Phase 3)
      - No immediate migration required in Phase 2
      - Existing code continues working unchanged
    - Add "Database Mapping" section explaining alignment with existing schema
    - Add "Type Safety" section explaining compile-time benefits
    - Add "References" section linking to Core Platform Extraction Roadmap
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7_
  
  - [x] 15.2 Add TSDoc comments to all contract files
    - Review all interface files and ensure every field has TSDoc explanation
    - Add `@remarks` blocks explaining when to use each type
    - Add `@example` blocks showing real-world usage
    - Ensure metadata fields explain what belongs there
    - _Requirements: 12.6, 13.1_

- [x] 16. Final verification and testing
  - [x] 16.1 Run TypeScript compilation check
    - Execute `npx tsc --noEmit --pretty false`
    - Verify zero new TypeScript errors
    - Fix any compilation issues
    - _Requirements: 11.1, 13.1_
  
  - [x] 16.2 Run full Jest test suite
    - Execute `npm run test` (or appropriate test command)
    - Verify all 1297 tests still pass
    - Investigate any test failures (should be zero)
    - _Requirements: 11.2_
  
  - [x] 16.3 Run ESLint check
    - Execute `npm run lint` on new contract files
    - Fix any linting violations
    - Ensure zero new ESLint errors
    - _Requirements: 11.1_
  
  - [x] 16.4 Verify bundle size impact
    - Confirm TypeScript interfaces are erased at runtime (no JavaScript output)
    - Check that helper functions (type guards, utilities) are minimal
    - _Requirements: 13.2, 13.3, 13.4, 13.5_
  
  - [x] 16.5 Test imports and IntelliSense
    - Create a temporary test file importing all contracts from `src/core/types`
    - Verify IntelliSense shows type hints and TSDoc
    - Verify no runtime errors when importing
    - Delete test file after verification
    - _Requirements: 11.4, 13.2_
  
  - [x] 16.6 Verify database schema compatibility
    - Review contracts against existing Supabase schema
    - Confirm no conflicting field types
    - Ensure metadata fields can store module-specific data
    - _Requirements: 11.7, 15.1, 15.2, 15.3, 15.4, 15.5, 15.6, 15.7, 15.8, 15.9_

- [x] 17. Final checkpoint - Complete Phase 2
  - Confirm all contract files created in `src/core/types/`
  - Confirm README.md provides clear usage guidance
  - Confirm TypeScript compiles without errors
  - Confirm all Jest tests pass (1297/1297)
  - Confirm ESLint passes
  - Confirm zero functional changes to Bella Spa operations
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- All tasks create **type-only definitions** with zero runtime footprint
- Helper functions (type guards, utilities) are minimal and optional
- No migration of existing code is required in Phase 2
- Phase 3 will use these contracts for actual core/module separation
- All interfaces include `metadata: Record<string, any>` for module-specific extensions
- All resource interfaces include `tenantId` for multi-tenant isolation
- TSDoc comments make contracts self-documenting
- Imports use relative paths within `src/core/types/` directory
- Barrel export (`index.ts`) provides convenient single import point

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["2.1", "3.1"] },
    { "id": 1, "tasks": ["2.2", "3.2", "4.1"] },
    { "id": 2, "tasks": ["2.3", "3.3", "4.2", "6.1", "7.1", "8.1"] },
    { "id": 3, "tasks": ["4.3", "6.2", "7.2", "8.2", "10.1", "11.1", "12.1"] },
    { "id": 4, "tasks": ["6.3", "7.3", "8.3", "10.2", "11.2", "12.2", "13.1"] },
    { "id": 5, "tasks": ["8.4", "10.3", "13.2", "15.1"] },
    { "id": 6, "tasks": ["15.2", "16.1", "16.2", "16.3", "16.4", "16.5", "16.6"] }
  ]
}
```

## Validation Checklist

After completing all tasks, verify:

- [x] `src/core/types/` directory exists
- [x] `src/core/types/index.ts` barrel export exists
- [x] `src/core/types/tenant.ts` exists with TenantContext interface
- [x] `src/core/types/module.ts` exists with ModuleId type
- [x] `src/core/types/feature-flag.ts` exists with FeatureFlag interface
- [x] `src/core/types/service-catalog.ts` exists with CoreServiceCatalogItem interface
- [x] `src/core/types/booking-order.ts` exists with CoreBookingOrder interface
- [x] `src/core/types/payment.ts` exists with PaymentIntent and Invoice interfaces
- [x] `src/core/types/audit.ts` exists with AuditEvent interface
- [x] `src/core/types/notification.ts` exists with NotificationEvent interface
- [x] `src/core/types/workflow.ts` exists with WorkflowInstance interface
- [x] `src/core/types/module-adapter.ts` exists with ModuleAdapter interface
- [x] `src/core/types/README.md` exists with usage guidance
- [x] All interfaces have comprehensive TSDoc comments
- [x] All interfaces include examples in TSDoc
- [x] TypeScript compilation passes: `npx tsc --noEmit --pretty false`
- [x] Jest tests pass: `npm run test` (1297/1297)
- [x] ESLint passes: `npm run lint`
- [x] No runtime errors when importing contract types
- [x] No increase in JavaScript bundle size
- [x] Contract interfaces compatible with existing database schema
- [x] README explains relationship to Phase 3 migration
