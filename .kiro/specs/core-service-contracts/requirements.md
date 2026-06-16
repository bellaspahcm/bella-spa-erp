# Requirements Document

## Introduction

This document specifies requirements for Phase 2 of the Core Platform Extraction Roadmap: defining core service contracts (interfaces, types, and adapters) to establish clear boundaries between the core platform and the spa module before physical file extraction in Phase 3.

Phase 2 builds on Phase 1 (Dashboard Core-SPA Boundary Refactor) by creating TypeScript interfaces and type definitions that represent industry-neutral primitives. These contracts will serve as the foundation for separating core platform code from spa-specific module code in future phases.

**Critical Constraints:**
- NO database schema changes
- NO file/folder moves (deferred to Phase 3)
- NO business logic changes
- Type-only changes and adapter patterns
- All existing tests must pass
- Zero functional changes to Bella Spa operations

This is a **contract definition refactor** establishing the type layer that core and modules will share.

## Glossary

- **TenantContext**: A context object that encapsulates tenant-specific information (tenant ID, settings, modules, entitlements) passed to core platform services
- **ModuleId**: A string literal type representing registered industry modules (e.g., 'spa', 'cleaning', 'home-service', 'babycare')
- **FeatureFlag**: A configuration object representing tenant-specific feature toggles that enable/disable functionality based on subscription plan or module
- **CoreServiceCatalogItem**: An industry-neutral representation of a purchasable service or product that modules can extend with module-specific fields
- **CoreBookingOrder**: An industry-neutral primitive representing a customer's order/appointment that can contain module-specific service execution details
- **PaymentIntent**: A core payment primitive representing an intent to collect payment from a customer with amount, method, and status
- **Invoice**: A core accounting primitive representing a financial document issued to a customer for goods/services rendered
- **AuditEvent**: A core observability primitive representing a logged system event with actor, action, resource, and timestamp
- **NotificationEvent**: A core communication primitive representing a system notification with type, recipient, channel, and payload
- **WorkflowInstance**: A core orchestration primitive representing a running workflow with state machine definition and current state
- **ModuleAdapter**: An interface that modules implement to integrate with core platform services and provide module-specific behavior

## Requirements

### Requirement 1: Define TenantContext Interface

**User Story:** As a core platform service, I want a standardized tenant context object, so that I can access tenant configuration and entitlements without querying the database on every operation.

#### Acceptance Criteria

1. THE TenantContext interface SHALL include a `tenantId` field of type string (UUID)
2. THE TenantContext interface SHALL include a `tenantName` field of type string for display purposes
3. THE TenantContext interface SHALL include an `enabledModules` field of type `ModuleId[]` listing active modules for this tenant
4. THE TenantContext interface SHALL include a `subscriptionPlan` field with plan type ('free' | 'basic' | 'professional' | 'enterprise')
5. THE TenantContext interface SHALL include a `featureFlags` field of type `Record<string, boolean>` for feature toggles
6. THE TenantContext interface SHALL include a `settings` field of type `Record<string, any>` for tenant-specific configuration
7. THE TenantContext interface SHALL be exported from a new file `src/core/types/tenant.ts`
8. THE TenantContext interface SHALL be usable in server actions without causing serialization errors
9. WHERE a service function requires tenant context, THE function signature SHALL accept TenantContext as a parameter
10. WHEN TenantContext is passed to a function, THE function SHALL NOT mutate the context object

### Requirement 2: Define ModuleId Type

**User Story:** As a system architect, I want a strongly-typed ModuleId type, so that only valid module identifiers are used throughout the codebase.

#### Acceptance Criteria

1. THE ModuleId type SHALL be defined as a union of string literals: `'spa' | 'cleaning' | 'home-service' | 'babycare'`
2. THE ModuleId type SHALL be exported from `src/core/types/module.ts`
3. WHEN a developer attempts to use an invalid module string, THE TypeScript compiler SHALL produce a type error
4. THE ModuleId type SHALL be used in TenantContext's `enabledModules` field
5. THE ModuleId type SHALL be used in module registry functions (if they exist)
6. WHERE code currently uses hardcoded strings like 'spa', THE codebase SHOULD migrate to ModuleId type (but migration is optional in Phase 2)

### Requirement 3: Define FeatureFlag Interface

**User Story:** As a subscription and billing system, I want a standardized feature flag structure, so that I can consistently enable/disable features based on tenant plan.

#### Acceptance Criteria

1. THE FeatureFlag interface SHALL include a `key` field of type string (unique identifier for the feature)
2. THE FeatureFlag interface SHALL include a `enabled` field of type boolean
3. THE FeatureFlag interface SHALL include an optional `requiredPlan` field of type `('free' | 'basic' | 'professional' | 'enterprise')[]` listing plans that unlock this feature
4. THE FeatureFlag interface SHALL include an optional `requiredModules` field of type `ModuleId[]` listing modules this feature depends on
5. THE FeatureFlag interface SHALL include an optional `metadata` field of type `Record<string, any>` for additional configuration
6. THE FeatureFlag interface SHALL be exported from `src/core/types/feature-flag.ts`
7. WHEN a feature flag is evaluated, THE system SHALL check both tenant plan and enabled modules
8. WHERE a feature requires 'professional' plan, THE system SHALL deny access to 'free' and 'basic' tenants

### Requirement 4: Define CoreServiceCatalogItem Interface

**User Story:** As a core service catalog, I want an industry-neutral service item structure, so that different modules can extend it with module-specific fields without changing the core.

#### Acceptance Criteria

1. THE CoreServiceCatalogItem interface SHALL include an `id` field of type string (UUID)
2. THE CoreServiceCatalogItem interface SHALL include a `tenantId` field of type string (UUID)
3. THE CoreServiceCatalogItem interface SHALL include a `moduleId` field of type ModuleId
4. THE CoreServiceCatalogItem interface SHALL include a `name` field of type string
5. THE CoreServiceCatalogItem interface SHALL include a `description` field of type string (optional)
6. THE CoreServiceCatalogItem interface SHALL include a `basePrice` field of type number
7. THE CoreServiceCatalogItem interface SHALL include a `currency` field of type string (ISO 4217 code like 'VND')
8. THE CoreServiceCatalogItem interface SHALL include a `status` field of type `('active' | 'inactive' | 'archived')`
9. THE CoreServiceCatalogItem interface SHALL include a `metadata` field of type `Record<string, any>` for module-specific extensions
10. THE CoreServiceCatalogItem interface SHALL be exported from `src/core/types/service-catalog.ts`
11. WHERE a spa package has additional fields (total_sessions, session_multiplier, category), THE metadata field SHALL store them
12. WHEN a module queries the service catalog, THE module adapter SHALL transform CoreServiceCatalogItem to module-specific types

### Requirement 5: Define CoreBookingOrder Interface

**User Story:** As a core booking/order system, I want a generic booking primitive, so that different industries can use bookings without coupling core to spa sessions.

#### Acceptance Criteria

1. THE CoreBookingOrder interface SHALL include an `id` field of type string (UUID)
2. THE CoreBookingOrder interface SHALL include a `tenantId` field of type string (UUID)
3. THE CoreBookingOrder interface SHALL include a `moduleId` field of type ModuleId
4. THE CoreBookingOrder interface SHALL include a `customerId` field of type string (UUID)
5. THE CoreBookingOrder interface SHALL include a `serviceItemId` field of type string (UUID) referencing CoreServiceCatalogItem
6. THE CoreBookingOrder interface SHALL include a `status` field of type `('draft' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled')`
7. THE CoreBookingOrder interface SHALL include a `scheduledStartTime` field of type string (ISO 8601 timestamp)
8. THE CoreBookingOrder interface SHALL include an optional `scheduledEndTime` field of type string (ISO 8601 timestamp)
9. THE CoreBookingOrder interface SHALL include a `totalAmount` field of type number
10. THE CoreBookingOrder interface SHALL include a `paidAmount` field of type number
11. THE CoreBookingOrder interface SHALL include a `metadata` field of type `Record<string, any>` for module-specific fields (e.g., session progress, assigned technicians, package details)
12. THE CoreBookingOrder interface SHALL be exported from `src/core/types/booking-order.ts`
13. WHERE a spa booking tracks session progress (3/10 sessions), THE metadata field SHALL store completion counters
14. WHEN an order is completed, THE core system SHALL update status to 'completed' and trigger payment/accounting workflows

### Requirement 6: Define PaymentIntent and Invoice Interfaces

**User Story:** As a core payment and accounting system, I want standardized payment and invoice structures, so that modules can handle payments without custom payment logic.

#### Acceptance Criteria

1. THE PaymentIntent interface SHALL include an `id` field of type string (UUID)
2. THE PaymentIntent interface SHALL include a `tenantId` field of type string (UUID)
3. THE PaymentIntent interface SHALL include a `customerId` field of type string (UUID)
4. THE PaymentIntent interface SHALL include a `bookingOrderId` field of type string (UUID) referencing CoreBookingOrder
5. THE PaymentIntent interface SHALL include an `amount` field of type number
6. THE PaymentIntent interface SHALL include a `currency` field of type string (ISO 4217 code)
7. THE PaymentIntent interface SHALL include a `method` field of type `('cash' | 'bank_transfer' | 'credit_card' | 'e_wallet' | 'other')`
8. THE PaymentIntent interface SHALL include a `status` field of type `('pending' | 'processing' | 'succeeded' | 'failed' | 'cancelled')`
9. THE PaymentIntent interface SHALL include a `metadata` field of type `Record<string, any>` for additional payment details
10. THE PaymentIntent interface SHALL be exported from `src/core/types/payment.ts`
11. THE Invoice interface SHALL include an `id` field of type string (UUID)
12. THE Invoice interface SHALL include a `tenantId` field of type string (UUID)
13. THE Invoice interface SHALL include a `customerId` field of type string (UUID)
14. THE Invoice interface SHALL include a `bookingOrderId` field of type string (UUID)
15. THE Invoice interface SHALL include an `invoiceNumber` field of type string (human-readable invoice number)
16. THE Invoice interface SHALL include an `issueDate` field of type string (ISO 8601 date)
17. THE Invoice interface SHALL include a `dueDate` field of type string (ISO 8601 date)
18. THE Invoice interface SHALL include a `totalAmount` field of type number
19. THE Invoice interface SHALL include a `paidAmount` field of type number
20. THE Invoice interface SHALL include a `status` field of type `('draft' | 'issued' | 'paid' | 'overdue' | 'cancelled')`
21. THE Invoice interface SHALL include a `lineItems` field of type array containing invoice line items with description, quantity, unitPrice, amount
22. THE Invoice interface SHALL be exported from `src/core/types/payment.ts`

### Requirement 7: Define AuditEvent Interface

**User Story:** As a core audit system, I want a standardized audit event structure, so that all system mutations are logged consistently for compliance and troubleshooting.

#### Acceptance Criteria

1. THE AuditEvent interface SHALL include an `id` field of type string (UUID)
2. THE AuditEvent interface SHALL include a `tenantId` field of type string (UUID)
3. THE AuditEvent interface SHALL include a `moduleId` field of type ModuleId (optional, for module-specific events)
4. THE AuditEvent interface SHALL include an `actorId` field of type string (UUID) representing the user/system that performed the action
5. THE AuditEvent interface SHALL include an `actorType` field of type `('user' | 'system' | 'api')`
6. THE AuditEvent interface SHALL include an `action` field of type string (e.g., 'create', 'update', 'delete', 'approve', 'complete')
7. THE AuditEvent interface SHALL include a `resourceType` field of type string (e.g., 'booking', 'session', 'salary_record', 'expense')
8. THE AuditEvent interface SHALL include a `resourceId` field of type string (UUID of the affected resource)
9. THE AuditEvent interface SHALL include a `timestamp` field of type string (ISO 8601 timestamp)
10. THE AuditEvent interface SHALL include an optional `changes` field of type `Record<string, { before: any; after: any }>` for field-level change tracking
11. THE AuditEvent interface SHALL include a `metadata` field of type `Record<string, any>` for additional context
12. THE AuditEvent interface SHALL be exported from `src/core/types/audit.ts`
13. WHEN a critical business action occurs (booking creation, salary approval, expense approval), THE system SHALL create an AuditEvent
14. WHERE audit events are queried for compliance, THE system SHALL filter by tenantId to ensure tenant isolation

### Requirement 8: Define NotificationEvent Interface

**User Story:** As a core notification system, I want a standardized notification structure, so that modules can send notifications through consistent channels (in-app, email, SMS, webhook).

#### Acceptance Criteria

1. THE NotificationEvent interface SHALL include an `id` field of type string (UUID)
2. THE NotificationEvent interface SHALL include a `tenantId` field of type string (UUID)
3. THE NotificationEvent interface SHALL include a `moduleId` field of type ModuleId (optional, for module-specific notifications)
4. THE NotificationEvent interface SHALL include a `type` field of type string (e.g., 'booking_confirmed', 'session_completed', 'payment_received', 'low_inventory')
5. THE NotificationEvent interface SHALL include a `recipientId` field of type string (UUID of the user/customer)
6. THE NotificationEvent interface SHALL include a `recipientType` field of type `('user' | 'customer' | 'admin')`
7. THE NotificationEvent interface SHALL include a `channels` field of type array of `('in_app' | 'email' | 'sms' | 'webhook' | 'push')`
8. THE NotificationEvent interface SHALL include a `priority` field of type `('low' | 'medium' | 'high' | 'urgent')`
9. THE NotificationEvent interface SHALL include a `title` field of type string
10. THE NotificationEvent interface SHALL include a `message` field of type string
11. THE NotificationEvent interface SHALL include a `metadata` field of type `Record<string, any>` for additional data (e.g., link URL, action buttons)
12. THE NotificationEvent interface SHALL include a `createdAt` field of type string (ISO 8601 timestamp)
13. THE NotificationEvent interface SHALL be exported from `src/core/types/notification.ts`
14. WHEN a notification is created, THE system SHALL route it to the appropriate channels based on the `channels` field
15. WHERE in-app notifications are supported, THE system SHALL store NotificationEvents in the `app_notifications` table

### Requirement 9: Define WorkflowInstance Interface

**User Story:** As a core workflow orchestration system, I want a standardized workflow instance structure, so that modules can define and execute multi-step business processes with state tracking.

#### Acceptance Criteria

1. THE WorkflowInstance interface SHALL include an `id` field of type string (UUID)
2. THE WorkflowInstance interface SHALL include a `tenantId` field of type string (UUID)
3. THE WorkflowInstance interface SHALL include a `moduleId` field of type ModuleId
4. THE WorkflowInstance interface SHALL include a `workflowDefinitionId` field of type string identifying the workflow template
5. THE WorkflowInstance interface SHALL include a `status` field of type `('pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled')`
6. THE WorkflowInstance interface SHALL include a `currentState` field of type string representing the current workflow step
7. THE WorkflowInstance interface SHALL include a `context` field of type `Record<string, any>` for workflow-specific data
8. THE WorkflowInstance interface SHALL include a `startedAt` field of type string (ISO 8601 timestamp)
9. THE WorkflowInstance interface SHALL include an optional `completedAt` field of type string (ISO 8601 timestamp)
10. THE WorkflowInstance interface SHALL include an optional `error` field of type string for failure reason
11. THE WorkflowInstance interface SHALL include a `metadata` field of type `Record<string, any>` for additional workflow data
12. THE WorkflowInstance interface SHALL be exported from `src/core/types/workflow.ts`
13. WHEN a workflow step completes, THE system SHALL update `currentState` to the next step
14. WHERE a workflow fails, THE system SHALL set status to 'failed' and populate the `error` field

### Requirement 10: Define ModuleAdapter Interface

**User Story:** As a core platform architect, I want a module adapter interface, so that modules can implement extension points without core having direct dependencies on module code.

#### Acceptance Criteria

1. THE ModuleAdapter interface SHALL include a `moduleId` property of type ModuleId
2. THE ModuleAdapter interface SHALL include a `moduleName` property of type string (display name like 'Bella Spa & Babycare')
3. THE ModuleAdapter interface SHALL include an optional `transformServiceItem` method that converts CoreServiceCatalogItem to module-specific type
4. THE ModuleAdapter interface SHALL include an optional `transformBookingOrder` method that converts CoreBookingOrder to module-specific type
5. THE ModuleAdapter interface SHALL include an optional `validateBookingRules` method that checks module-specific booking constraints (e.g., KTV availability, package session limits)
6. THE ModuleAdapter interface SHALL include an optional `calculatePricing` method that applies module-specific pricing rules (e.g., spa package discounts)
7. THE ModuleAdapter interface SHALL include an optional `onBookingCompleted` hook that executes module-specific side effects (e.g., update KTV salary, deduct inventory)
8. THE ModuleAdapter interface SHALL include an optional `getModuleWidgets` method that returns dashboard widget components for this module
9. THE ModuleAdapter interface SHALL be exported from `src/core/types/module-adapter.ts`
10. WHEN core platform invokes an adapter method, THE method SHALL return a result or throw an error (no silent failures)
11. WHERE a module does not implement an optional adapter method, THE core platform SHALL handle the absence gracefully with default behavior

### Requirement 11: Preserve All Existing Functionality

**User Story:** As a Bella Spa user, I want Phase 2 to produce zero functional changes, so that my daily operations are not disrupted by contract definitions.

#### Acceptance Criteria

1. WHEN the TypeScript compiler runs after Phase 2, THE codebase SHALL compile successfully with zero new errors
2. WHEN existing Jest tests run after Phase 2, THE test suite SHALL produce the same pass/fail results as before
3. THE new type files SHALL NOT break any existing imports or module boundaries
4. THE new interfaces SHALL NOT cause runtime errors in production
5. WHERE existing code uses similar types (e.g., custom booking types), THE existing code SHALL continue working without modification
6. WHEN a developer reads the new core type files, THE interfaces SHALL be self-documenting with TSDoc comments
7. THE new type definitions SHALL NOT conflict with Supabase auto-generated database types

### Requirement 12: Document Contract Usage Guidance

**User Story:** As a developer preparing for Phase 3 extraction, I want clear documentation on how to use these contracts, so that I understand the migration path from current code to core/module structure.

#### Acceptance Criteria

1. THE core types directory SHALL include a README.md file explaining the purpose of each interface
2. THE README.md SHALL provide examples of how TenantContext should be constructed and passed to service functions
3. THE README.md SHALL explain how ModuleAdapter implementations should be registered (even if registration is not implemented in Phase 2)
4. THE README.md SHALL clarify that these contracts are for future use and do not require immediate migration of existing code
5. THE README.md SHALL reference the Core Platform Extraction Roadmap as the source of truth for phased rollout
6. WHERE a contract field uses `Record<string, any>` for metadata, THE TSDoc comment SHALL explain what types of data belong there
7. WHEN a developer reviews a contract interface, THE TSDoc SHALL indicate whether it's stable or subject to change in Phase 3

### Requirement 13: Ensure Type Safety Without Runtime Overhead

**User Story:** As a performance-conscious developer, I want contract definitions to be compile-time only, so that they add zero runtime overhead or bundle size increase.

#### Acceptance Criteria

1. THE contract interfaces SHALL be TypeScript `interface` or `type` declarations (not classes or runtime objects)
2. THE contract files SHALL export only types, interfaces, and type aliases (no functions or constants unless they are type guards)
3. WHEN the TypeScript compiler transpiles to JavaScript, THE interface declarations SHALL be removed (no runtime representation)
4. THE contract imports SHALL NOT increase JavaScript bundle size
5. WHERE type guards are needed (e.g., `isCoreBookingOrder(obj)`), THE type guard functions SHALL be minimal runtime validators

### Requirement 14: Maintain Tenant Isolation and Security

**User Story:** As a security engineer, I want contract definitions to enforce tenant isolation, so that multi-tenant data separation is preserved.

#### Acceptance Criteria

1. THE TenantContext interface SHALL be immutable (readonly fields or passed by value)
2. WHEN a service function receives TenantContext, THE function SHALL NOT modify tenant data
3. THE contract interfaces SHALL include `tenantId` field for all resource types (bookings, payments, audit events, notifications)
4. WHERE database queries use these contracts, THE queries SHALL continue applying RLS policies
5. THE contract definitions SHALL NOT introduce any shared global state that violates tenant isolation
6. WHEN audit events are logged, THE AuditEvent SHALL always include `tenantId` to prevent cross-tenant audit log leakage

### Requirement 15: Align with Database Schema Without Modification

**User Story:** As a database architect, I want contract interfaces to map to existing tables without requiring schema changes, so that Phase 2 remains a safe refactor.

#### Acceptance Criteria

1. THE CoreServiceCatalogItem interface SHALL map to the existing `packages` table structure (or `services` table if it exists)
2. THE CoreBookingOrder interface SHALL map to the existing `bookings` table structure
3. THE PaymentIntent interface SHALL align with existing payment/revenue tracking tables
4. THE Invoice interface SHALL align with existing invoice generation logic (if any)
5. THE AuditEvent interface SHALL align with existing `audit_log` or similar table
6. THE NotificationEvent interface SHALL map to the existing `app_notifications` table
7. WHERE existing tables have additional fields not in core contracts, THE `metadata` field SHALL store them
8. WHEN Supabase auto-generates types, THE contract interfaces SHALL be compatible (no conflicting field types)
9. THE contract definitions SHALL NOT require adding new tables in Phase 2

## Core Boundary Decision

- **Classification**: core (pure type definitions establishing platform contracts)
- **Why**: These interfaces define the core platform's API surface and data primitives that all industry modules will use. They represent industry-neutral concepts (tenant, service catalog, booking/order, payment, audit, notification, workflow) that apply across spa, cleaning, home-service, and other verticals.
- **Future industry reuse**: All interfaces designed for cross-industry reuse. The `moduleId` and `metadata` fields enable module-specific extensions without modifying core contracts.
- **Spa behavior preserved by**: Zero runtime changes, no database modifications, all existing tests pass, no functional logic changes. These are compile-time type definitions only.
- **Database impact**: None - contracts map to existing tables without requiring schema changes. The `metadata` fields allow storing module-specific data in existing JSONB columns or similar flexible fields.
- **Tests required**: 
  - TypeScript compilation must pass: `npx tsc --noEmit --pretty false`
  - All existing Jest tests must pass (no behavior changes)
  - ESLint must pass with no new violations
  - Manual verification: import contracts in a test file and verify TypeScript IntelliSense works
- **Deferred extraction**: Actual usage of these contracts throughout the codebase is deferred to Phase 3. Phase 2 only defines the contracts. Migration from current types to core contracts is optional in Phase 2.

## Validation Checklist

After completing Phase 2, verify:

- [ ] `src/core/types/tenant.ts` created with TenantContext interface
- [ ] `src/core/types/module.ts` created with ModuleId type
- [ ] `src/core/types/feature-flag.ts` created with FeatureFlag interface
- [ ] `src/core/types/service-catalog.ts` created with CoreServiceCatalogItem interface
- [ ] `src/core/types/booking-order.ts` created with CoreBookingOrder interface
- [ ] `src/core/types/payment.ts` created with PaymentIntent and Invoice interfaces
- [ ] `src/core/types/audit.ts` created with AuditEvent interface
- [ ] `src/core/types/notification.ts` created with NotificationEvent interface
- [ ] `src/core/types/workflow.ts` created with WorkflowInstance interface
- [ ] `src/core/types/module-adapter.ts` created with ModuleAdapter interface
- [ ] `src/core/types/README.md` created with usage guidance
- [ ] All interfaces have TSDoc comments explaining fields
- [ ] TenantContext used in at least one sample function signature (optional demo)
- [ ] ModuleId enforces valid module strings
- [ ] TypeScript compilation passes: `npx tsc --noEmit --pretty false`
- [ ] Jest tests pass: `npm run test`
- [ ] ESLint passes: `npm run lint`
- [ ] No runtime errors when importing contract types
- [ ] No increase in JavaScript bundle size
- [ ] Contract interfaces compatible with existing database schema
- [ ] README explains relationship to Roadmap Phase 3

## References

- [Core Platform Extraction Roadmap](../../docs/plans/core-platform-extraction-roadmap.md)
- Phase 1 Spec: `.kiro/specs/dashboard-core-spa-boundary-refactor/`
- Supabase Database Types: `src/types/database.types.ts` (if exists)
