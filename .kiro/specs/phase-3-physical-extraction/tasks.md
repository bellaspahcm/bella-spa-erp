# Implementation Plan: Phase 3 - Core Platform Physical Extraction & Migration

## Overview

This implementation plan executes the physical extraction of core platform code from the monolithic Bella Spa codebase into a modular, multi-industry architecture. The migration follows a 5-wave strategy to minimize risk and ensure zero regression in functionality.

**Migration Approach**:
- **Wave 1**: Foundation (directory structure, TenantContext, module registry)
- **Wave 2**: Core Services (auth, order, payment, notification, audit, finance, payroll, analytics)
- **Wave 3**: Spa Module (adapter, types, services, components)
- **Wave 4**: Integration (adapter invocation, database query migration, import updates)
- **Wave 5**: Validation (testing, documentation, performance benchmarking)

**Key Constraints**:
- Zero database schema changes (100% backward compatible)
- All 1304+ tests must pass after each wave
- No functional changes to user experience
- TypeScript compilation must enforce core/module boundaries

---

## Tasks

### Wave 1: Foundation (Week 1-2)

- [x] 1. Create core platform directory structure and foundational infrastructure
  - [x] 1.1 Create core platform directory hierarchy
    - Create `src/core/` with subdirectories: `types/`, `services/`, `lib/`, `adapters/`, `middleware/`, `hooks/`, `providers/`
    - Create `src/core/services/` subdirectories: `auth/`, `order/`, `payment/`, `notification/`, `audit/`, `finance/`, `payroll/`, `analytics/`
    - Create README.md in each subdirectory explaining its purpose and usage patterns
    - Verify `src/core/types/` already exists from Phase 2 with all contract type definitions
    - _Requirements: REQ-3.1.1_

  - [x] 1.2 Implement TenantContext provider and React hook
    - Create `src/core/providers/TenantContextProvider.tsx` with loading and error states
    - Implement `/api/tenant/context` API route to fetch tenant configuration from database
    - Create `useTenantContext()` hook in `src/core/hooks/useTenantContext.ts`
    - Add error handling for missing or invalid tenant configurations
    - _Requirements: REQ-3.2.1_

  - [x] 1.3 Implement module registry system
    - Create `ModuleRegistry` class in `src/core/adapters/registry.ts`
    - Implement `register()`, `get()`, `getRequired()`, and `has()` methods
    - Add validation to prevent duplicate module ID registration
    - Export singleton `moduleRegistry` instance
    - Create `src/core/adapters/types.ts` for adapter utility types
    - _Requirements: REQ-3.3.1_

  - [x] 1.4 Create API middleware for TenantContext extraction
    - Create `src/core/middleware/tenantContext.ts` to extract tenant ID from request headers/session
    - Implement middleware to construct `TenantContext` object and attach to request
    - Add authorization check to reject requests with missing/invalid tenant ID
    - Create TypeScript types for extended request object with TenantContext
    - _Requirements: REQ-3.2.2_

  - [x] 1.5 Wrap Next.js app with TenantContextProvider
    - Update `src/app/layout.tsx` (or `src/pages/_app.tsx`) to wrap all pages with TenantContextProvider
    - Verify provider mounts correctly and fetches tenant configuration on startup
    - Test error states (network failure, invalid tenant, missing config)
    - _Requirements: REQ-3.2.1_

- [x] 2. Checkpoint - Verify Wave 1 foundation is stable
  - Run `npm run build` and ensure TypeScript compilation succeeds
  - Run existing test suite and verify all tests pass
  - Manually test tenant context provider loading in browser
  - Ask the user if questions arise before proceeding to Wave 2


### Wave 2: Core Services (Week 3-4)

- [x] 3. Extract authentication and authorization services to core platform
  - [x] 3.1 Move authentication services to core and refactor for TenantContext
    - Move existing auth services from `src/services/auth/` to `src/core/services/auth/`
    - Refactor all auth functions to accept `context: TenantContext` as first parameter
    - Update function signatures to use core contract types where applicable
    - Update all internal imports within auth services to reference new paths
    - _Requirements: REQ-3.1.2, REQ-3.2.3_

  - [ ]* 3.2 Update authentication unit tests with TenantContext mocks
    - Create `createMockTenantContext()` helper in test utilities
    - Update all auth unit tests to pass mock TenantContext to service functions
    - Verify tests validate tenant-specific auth behavior (tenant isolation, feature flags)
    - Run auth test suite and ensure all tests pass
    - _Requirements: REQ-3.6.1_

- [x] 4. Extract customer order management services to core platform
  - [x] 4.1 Move order services to core and refactor for CoreBookingOrder contract
    - Move existing booking services from `src/services/bookings/` to `src/core/services/order/`
    - Refactor all order functions to accept `context: TenantContext` as first parameter
    - Update function signatures to return `CoreBookingOrder` type instead of ad-hoc booking types
    - Extract spa-specific order logic (session tracking, KTV assignment) to be handled later by adapter
    - Create database mapper helper `mapDbRowToBooking()` in `src/core/lib/database.ts`
    - **Note**: Service directory renamed from "booking" to "order" for industry neutrality, but still uses `CoreBookingOrder` contract type from Phase 2
    - _Requirements: REQ-3.1.3, REQ-3.5.2_

  - [ ]* 4.2 Update order unit tests with TenantContext and CoreBookingOrder types
    - Update all order unit tests to use mock TenantContext
    - Verify tests use `CoreBookingOrder` type for assertions
    - Test tenant filtering in order queries
    - Run order test suite and ensure all tests pass
    - _Requirements: REQ-3.6.1_


- [ ] 5. Extract payment processing services to core platform
  - [x] 5.1 Move payment services to core and refactor for PaymentIntent contract
    - **SKIPPED**: Payment services already extracted with order services (Task 4.1)
    - Payment logic resides in `src/core/services/order/payment-actions.ts` and `payment-helpers.ts`
    - _Requirements: REQ-3.1.4, REQ-3.5.4_

  - [ ]* 5.2 Update payment unit tests with TenantContext and PaymentIntent types
    - **SKIPPED**: Payment tests already updated with order extraction
    - _Requirements: REQ-3.6.1_

- [x] 6. Extract notification services to core platform
  - [x] 6.1 Move notification services to core and refactor for NotificationEvent contract
    - Move existing notification services from `src/services/notifications/` to `src/core/services/notification/`
    - Refactor all notification functions to accept `context: TenantContext` as first parameter
    - Update function signatures to use `NotificationEvent` type
    - Create database mapper helper `mapDbRowToNotification()` in `src/core/lib/database.ts`
    - Ensure multi-channel delivery (in-app, email, SMS, webhook) works across modules
    - **Commit**: 753e7983
    - _Requirements: REQ-3.1.5_

  - [ ]* 6.2 Update notification unit tests with TenantContext and NotificationEvent types
    - Update all notification unit tests to use mock TenantContext
    - Verify tests use `NotificationEvent` type for assertions
    - Test tenant-specific notification preferences
    - Run notification test suite and ensure all tests pass
    - _Requirements: REQ-3.6.1_


- [x] 7. Extract audit logging services to core platform
  - [x] 7.1 Move audit services to core and refactor for AuditEvent contract
    - Move existing audit services from `src/services/audit/` to `src/core/services/audit/`
    - Refactor all audit functions to accept `context: TenantContext` as first parameter
    - **Commit**: dcaf22ff
    - _Requirements: REQ-3.1.6 (Note: Accounting services extracted separately as critical task - commit 2cb0260)
    - _Requirements: REQ-3.6.1_


- [ ] 5. Extract payment processing services to core platform
  - [ ] 5.1 Move payment services to core and refactor for PaymentIntent contract
    - Move existing payment services from `src/services/payments/` to `src/core/services/payment/`
    - Refactor all payment functions to accept `context: TenantContext` as first parameter
    - Update function signatures to use `PaymentIntent` type instead of ad-hoc payment types
    - Create database mapper helper `mapDbRowToPayment()` in `src/core/lib/database.ts`
    - Ensure payment method-specific details are stored in `metadata` field
    - _Requirements: REQ-3.1.4, REQ-3.5.4_

  - [ ]* 5.2 Update payment unit tests with TenantContext and PaymentIntent types
    - Update all payment unit tests to use mock TenantContext
    - Verify tests use `PaymentIntent` type for assertions
    - Test multi-tenant payment isolation
    - Run payment test suite and ensure all tests pass
    - _Requirements: REQ-3.6.1_

- [ ] 6. Extract notification services to core platform
  - [ ] 6.1 Move notification services to core and refactor for NotificationEvent contract
    - Move existing notification services from `src/services/notifications/` to `src/core/services/notification/`
    - Refactor all notification functions to accept `context: TenantContext` as first parameter
    - Update function signatures to use `NotificationEvent` type
    - Create database mapper helper `mapDbRowToNotification()` in `src/core/lib/database.ts`
    - Ensure multi-channel delivery (in-app, email, SMS, webhook) works across modules
    - _Requirements: REQ-3.1.5_

  - [ ]* 6.2 Update notification unit tests with TenantContext and NotificationEvent types
    - Update all notification unit tests to use mock TenantContext
    - Verify tests use `NotificationEvent` type for assertions
    - Test tenant-specific notification preferences
    - Run notification test suite and ensure all tests pass
    - _Requirements: REQ-3.6.1_


- [ ] 7. Extract audit logging services to core platform
  - [ ] 7.1 Move audit services to core and refactor for AuditEvent contract
    - Move existing audit services from `src/services/audit/` to `src/core/services/audit/`
    - Refactor all audit functions to accept `context: TenantContext` as first parameter
    - Update function signatures to use `AuditEvent` type
    - Create database mapper helper `mapDbRowToAuditEvent()` in `src/core/lib/database.ts`
    - Ensure field-level change tracking works for all resource types
    - _Requirements: REQ-3.1.6_

  - [ ]* 7.2 Update audit unit tests with TenantContext and AuditEvent types
    - Update all audit unit tests to use mock TenantContext
    - Verify tests use `AuditEvent` type for assertions
    - Test tenant-specific audit log isolation
    - Run audit test suite and ensure all tests pass
    - _Requirements: REQ-3.6.1_

- [x] 8. Extract finance services to core platform
  - [x] 8.1 Move finance services to core and refactor for TenantContext
    - Move existing finance services from `src/services/finance/` to `src/core/services/finance/`
    - Refactor all finance functions to accept `context: TenantContext` as first parameter
    - Ensure revenue recognition uses `CoreBookingOrder` for order-based revenue
    - Ensure expense tracking uses `PaymentIntent` for payment-based expenses
    - Ensure invoice generation uses `Invoice` contract from Phase 2
    - Ensure P&L reports aggregate across all modules via TenantContext
    - **Commit**: 3391d065
    - _Requirements: REQ-3.1.7_

  - [ ]* 8.2 Update finance unit tests with TenantContext
    - Update all finance unit tests to use mock TenantContext
    - Test revenue recognition, expense tracking, and P&L calculations
    - Test tenant-specific finance report isolation
    - Run finance test suite and ensure all tests pass
    - _Requirements: REQ-3.6.1_

- [ ] 9. Extract payroll services to core platform
  - [ ] 9.1 Move payroll services to core and refactor for TenantContext
    - Create `src/core/services/payroll/` for employee compensation
    - Move base salary calculation logic from `src/services/finance/salary.ts` to core payroll
    - Refactor payroll functions to accept `context: TenantContext` as first parameter
    - Ensure module-specific salary calculations (spa KTV commissions, session bonuses) handled by module adapters
    - Ensure payroll cycle management works for all industries
    - _Requirements: REQ-3.1.8_

  - [ ]* 9.2 Update payroll unit tests with TenantContext
    - Update all payroll unit tests to use mock TenantContext
    - Test base salary calculations and payroll cycles
    - Test tenant-specific payroll isolation
    - Run payroll test suite and ensure all tests pass
    - _Requirements: REQ-3.6.1_

- [ ] 10. Extract analytics services to core platform
  - [ ] 10.1 Move analytics services to core and refactor for TenantContext
    - Create `src/core/services/analytics/` for business intelligence
    - Move dashboard aggregation logic from various services to analytics
    - Move report generation logic to analytics service
    - Refactor analytics functions to accept `context: TenantContext` as first parameter
    - Ensure analytics can query data from all enabled modules via TenantContext
    - Ensure export to Excel/PDF works for all report types
    - _Requirements: REQ-3.1.9_

  - [ ]* 10.2 Update analytics unit tests with TenantContext
    - Update all analytics unit tests to use mock TenantContext
    - Test dashboard aggregation and report generation
    - Test multi-module analytics queries
    - Run analytics test suite and ensure all tests pass
    - _Requirements: REQ-3.6.1_

- [ ] 11. Update all API routes to use TenantContext middleware
  - [ ] 11.1 Refactor API routes to accept TenantContext from middleware
    - Update API route handlers to extract `context: TenantContext` from request object
    - Update route handlers to pass TenantContext to core service functions
    - Add error responses for missing/invalid tenant ID
    - Update TypeScript types for API route request/response objects
    - _Requirements: REQ-3.2.2_

  - [ ]* 11.2 Update API route tests with TenantContext
    - Update API route tests to include tenant headers in mock requests
    - Verify unauthorized requests are rejected
    - Run API route test suite and ensure all tests pass
    - _Requirements: REQ-3.6.1_

- [ ] 12. Checkpoint - Verify Wave 2 core services are stable
  - Run `npm run build` and ensure TypeScript compilation succeeds
  - Run full test suite and verify all 1304+ tests pass
  - Manually test key user flows (login, create booking, process payment)
  - Review git diff to ensure no unintended changes
- [ ] 12. Checkpoint - Verify Wave 2 core services are stable
  - Run `npm run build` and ensure TypeScript compilation succeeds
  - Run full test suite and verify all 1304+ tests pass
  - Manually test key user flows (login, create order, process payment)
  - Review git diff to ensure no unintended changes
  - Ask the user if questions arise before proceeding to Wave 3


### Wave 3: Spa Module (Week 5-6)

- [ ] 13. Create spa module directory structure and extract spa-specific types
  - [ ] 13.1 Create spa module directory hierarchy
    - Create `src/modules/spa/` with subdirectories: `types/`, `adapters/`, `services/`, `components/`, `hooks/`, `lib/`
    - Create README.md in each subdirectory explaining spa module organization
    - _Requirements: REQ-3.4.1_

  - [ ] 13.2 Extract spa-specific types to spa module
    - Move spa package types to `src/modules/spa/types/package.ts`
    - Move spa booking types to `src/modules/spa/types/booking.ts`
    - Move KTV/employee types to `src/modules/spa/types/employee.ts`
    - Move session types to `src/modules/spa/types/session.ts`
    - Move salary types to `src/modules/spa/types/salary.ts`
    - Create barrel export `src/modules/spa/types/index.ts`
    - _Requirements: REQ-3.4.2_

- [ ] 14. Implement SpaModuleAdapter with all spa-specific business logic
  - [ ] 14.1 Create SpaModuleAdapter class implementing ModuleAdapter interface
    - Create `src/modules/spa/adapters/SpaModuleAdapter.ts`
    - Implement `moduleId` and `moduleName` properties
- [ ] 14. Implement SpaModuleAdapter with all spa-specific business logic
  - [ ] 14.1 Create SpaModuleAdapter class implementing ModuleAdapter interface
    - Create `src/modules/spa/adapters/SpaModuleAdapter.ts`
    - Implement `moduleId` and `moduleName` properties
    - Implement `transformServiceItem()` to transform `CoreServiceCatalogItem` to spa package type
    - Implement `transformBookingOrder()` to transform `CoreBookingOrder` to spa booking type
    - _Requirements: REQ-3.3.2_

  - [ ] 14.2 Implement spa-specific validation and pricing logic in adapter
    - Implement `validateBookingRules()` to check KTV availability and session limits
    - Implement `calculatePricing()` to apply spa-specific discounts (subscription tiers, package rates)
    - Ensure adapter respects package session multipliers (1.0x, 1.5x, 2.0x)
    - _Requirements: REQ-3.3.2_


  - [ ] 14.3 Implement spa-specific side effects and widget registry in adapter
    - Implement `onBookingCompleted()` to handle spa side effects (salary updates, inventory deductions)
    - Implement `getModuleWidgets()` to return spa dashboard widget definitions
    - Ensure adapter methods use core services for data operations (no direct database access)
    - _Requirements: REQ-3.3.2_

  - [ ] 14.4 Register SpaModuleAdapter on application startup
    - Create `src/modules/spa/register.ts` with adapter registration logic
    - Import and call registration in `src/app/layout.tsx` or `src/pages/_app.tsx`
    - Add console log to confirm successful registration
    - Verify adapter is accessible via `moduleRegistry.get('spa')`
    - _Requirements: REQ-3.3.3_

- [ ] 15. Extract spa-specific services to spa module
  - [ ] 15.1 Move spa session management services
    - Create `src/modules/spa/services/session.ts` with session tracking logic
    - Move session completion, session counting, and session multiplier logic
    - Ensure services use `CoreBookingOrder` as base type and extend with spa-specific fields
    - Update imports in components to reference new spa module paths
    - _Requirements: REQ-3.4.4_

  - [ ] 15.2 Move spa salary calculation services
    - Create `src/modules/spa/services/salary.ts` with salary calculation logic
    - Move KTV salary pro-rata, session bonus, KPI bonus, and violation deduction logic
    - Implement `recalculateAndSaveSalaryRecord()` respecting draft vs. finalized status
    - Ensure decimal session counts (NUMERIC(5,2)) are handled correctly
    - _Requirements: REQ-3.4.4_

  - [ ] 15.3 Move spa KTV performance tracking services
    - Create `src/modules/spa/services/ktvPerformance.ts` with performance tracking logic
    - Move KTV rating, customer feedback, and leaderboard calculation logic
    - Ensure services use core contract types for audit and notification events
    - _Requirements: REQ-3.4.4_

  - [ ] 15.4 Move spa package management services
    - Create `src/modules/spa/services/package.ts` with package-specific logic
    - Move package session multiplier handling (1.0x, 1.5x, 2.0x)
    - Move package category logic (basic, premium, VIP)
    - Create database mapper helper `mapDbRowToServiceItem()` in `src/core/lib/database.ts`
    - _Requirements: REQ-3.4.4, REQ-3.5.3_


- [ ] 16. Extract spa-specific UI components to spa module
  - [ ] 16.1 Move spa dashboard widgets to spa module
    - Move spa dashboard widgets to `src/modules/spa/components/dashboard/`
- [ ] 16. Extract spa-specific UI components to spa module
  - [ ] 16.1 Move spa dashboard widgets to spa module
    - Move spa dashboard widgets to `src/modules/spa/components/dashboard/`
    - Update widget imports in dashboard pages
    - Ensure widgets use `useTenantContext()` hook for tenant-specific data
    - _Requirements: REQ-3.4.3_

  - [ ] 16.2 Move spa order components to spa module
    - Move spa order forms to `src/modules/spa/components/order/`
    - Move spa order list and detail views
    - Update component imports in order pages
    - Ensure components use spa types from `src/modules/spa/types/`
    - _Requirements: REQ-3.4.3_

  - [ ] 16.3 Move spa employee management components to spa module
    - Move KTV management components to `src/modules/spa/components/employees/`
    - Move KTV performance dashboards and leaderboards
    - Update component imports in employee pages
    - _Requirements: REQ-3.4.3_

  - [ ] 16.4 Move spa package management components to spa module
    - Move package list and detail components to `src/modules/spa/components/packages/`
    - Move package creation and editing forms
    - Update component imports in package pages
    - _Requirements: REQ-3.4.3_

  - [ ] 16.5 Move spa salary management components to spa module
    - Move salary calculation dashboards to `src/modules/spa/components/salary/`
    - Move salary reconciliation reports and approval workflows
    - Update component imports in salary pages
    - _Requirements: REQ-3.4.3_

- [ ] 17. Create spa-specific React hooks
  - [ ] 17.1 Create spa order hook
    - Create `src/modules/spa/hooks/useSpaOrder.ts` wrapping core order services
    - Add spa-specific order state management and validation
    - Export hook from `src/modules/spa/hooks/index.ts`
    - _Requirements: REQ-3.4.1_

  - [ ] 17.2 Create spa session hook
    - Create `src/modules/spa/hooks/useSpaSession.ts` for session tracking
    - Add session completion and session counting logic
    - Export hook from barrel file
    - _Requirements: REQ-3.4.1_

- [ ] 18. Checkpoint - Verify Wave 3 spa module extraction is complete
  - Run `npm run build` and ensure TypeScript compilation succeeds
  - Run full test suite and verify all tests pass
  - Manually test spa-specific features (package booking, session completion, salary calculation)
  - Review git diff to ensure all spa-specific code moved to `src/modules/spa/`
- [ ] 18. Checkpoint - Verify Wave 3 spa module extraction is complete
  - Run `npm run build` and ensure TypeScript compilation succeeds
  - Run full test suite and verify all tests pass
  - Manually test spa-specific features (package order, session completion, salary calculation)
  - Review git diff to ensure all spa-specific code moved to `src/modules/spa/`
  - Ask the user if questions arise before proceeding to Wave 4


### Wave 4: Integration (Week 7-8)

- [ ] 19. Update core services to invoke module adapters for module-specific behavior
  - [ ] 19.1 Integrate adapter validation in order creation flow
    - Update `createOrder()` in `src/core/services/order/` to invoke `adapter.validateBookingRules()`
    - Look up adapter from `moduleRegistry.get(context.moduleId)`
    - Handle case where adapter is not found (use default validation or throw error)
    - Ensure validation errors are properly propagated to API routes
    - _Requirements: REQ-3.3.4_

  - [ ] 19.2 Integrate adapter pricing in order flow
    - Update `calculateOrderPrice()` to invoke `adapter.calculatePricing()`
    - Ensure pricing calculation respects tenant subscription tiers
    - Fall back to base price if adapter is not found
    - _Requirements: REQ-3.3.4_

  - [ ] 19.3 Integrate adapter side effects in order completion flow
    - Update `completeOrder()` to invoke `adapter.onBookingCompleted()`
    - Ensure side effects (salary updates, inventory deductions) execute after order marked complete
    - Handle adapter errors gracefully and log for debugging
    - _Requirements: REQ-3.3.4_

  - [ ]* 19.4 Write integration tests for adapter invocation in core services
    - Test adapter validation is called during order creation
    - Test adapter pricing is called during price calculation
    - Test adapter side effects are called on order completion
    - Test graceful handling when adapter is not registered
    - _Requirements: REQ-3.6.2_

- [ ] 20. Migrate all database queries to use core contract types
  - [ ] 20.1 Update order database queries to return CoreBookingOrder
    - Update `getOrderById()` to return `CoreBookingOrder | null`
    - Update `getOrdersByCustomer()` to return `CoreBookingOrder[]`
    - Update `createOrder()` to accept `Partial<CoreBookingOrder>` and return `CoreBookingOrder`
    - Update `updateOrder()` to accept order ID and `Partial<CoreBookingOrder>`
    - Ensure all queries filter by `tenantId` from TenantContext
    - Use strict Supabase types: `Database['public']['Tables']['bookings']['Insert']`
    - _Requirements: REQ-3.5.2_

  - [ ] 20.2 Update service catalog queries to return CoreServiceCatalogItem
    - Update `getServiceItemById()` to return `CoreServiceCatalogItem | null`
    - Update `getServiceItemsByModule()` to return `CoreServiceCatalogItem[]`
    - Update `createServiceItem()` to accept `Partial<CoreServiceCatalogItem>` and return `CoreServiceCatalogItem`
    - Update `updateServiceItem()` to accept item ID and `Partial<CoreServiceCatalogItem>`
    - Ensure spa package metadata (total_sessions, session_multiplier) stored in `metadata` field
    - Use strict Supabase types: `Database['public']['Tables']['packages']['Insert']`
    - _Requirements: REQ-3.5.3_

  - [ ] 20.3 Update payment queries to return PaymentIntent
    - Update `getPaymentById()` to return `PaymentIntent | null`
    - Update `getPaymentsByBooking()` to return `PaymentIntent[]`
    - Update `createPayment()` to accept `Partial<PaymentIntent>` and return `PaymentIntent`
    - Update `updatePaymentStatus()` to accept payment ID and `PaymentStatus`
    - Ensure payment method-specific details stored in `metadata` field
    - Use strict Supabase types: `Database['public']['Tables']['payment_intents']['Insert']`
    - _Requirements: REQ-3.5.4_

  - [ ] 20.4 Update notification queries to return NotificationEvent
    - Update notification database queries to return `NotificationEvent` type
    - Ensure multi-channel delivery metadata stored correctly
    - Use strict Supabase types for notification tables
    - _Requirements: REQ-3.1.5_

  - [ ] 20.5 Update audit log queries to return AuditEvent
    - Update audit log database queries to return `AuditEvent` type
    - Ensure field-level change tracking metadata stored correctly
    - Use strict Supabase types for audit log tables
    - _Requirements: REQ-3.1.6_

- [ ] 21. Update all import statements across the codebase
  - [ ] 21.1 Update imports in app pages to use core and spa module paths
    - Update all page imports to reference `src/core/` for core functionality
    - Update all page imports to reference `src/modules/spa/` for spa-specific features
    - Verify no broken imports remain (TypeScript compilation will catch these)
    - _Requirements: REQ-3.1.1, REQ-3.4.1_

  - [ ] 21.2 Update imports in API routes to use core paths
    - Update all API route imports to reference `src/core/services/`
    - Update all API route imports to use TenantContext from `src/core/providers/`
    - Verify no broken imports remain
    - _Requirements: REQ-3.1.1_

  - [ ] 21.3 Update imports in shared utilities and libraries
    - Update utility function imports to use core or spa module paths as appropriate
    - Update type imports to use contract types from `src/core/types/`
    - Verify no circular dependencies introduced
    - _Requirements: REQ-3.1.1, REQ-3.4.1_

- [ ] 22. Checkpoint - Verify Wave 4 integration is complete
  - Run `npm run build` and ensure TypeScript compilation succeeds
  - Run full test suite and verify all 1304+ tests pass
  - Manually test end-to-end user flows (create order → process payment → complete session → calculate salary)
  - Review git diff to ensure all imports updated correctly
  - Ask the user if questions arise before proceeding to Wave 5


### Wave 5: Validation (Week 9-10)

- [ ] 23. Comprehensive testing and validation
  - [ ]* 23.1 Run full unit test suite with coverage analysis
    - Run `npm run test` and ensure all 1304+ tests pass
    - Generate test coverage report
    - Verify coverage for new TenantContext, module registry, and adapter code
    - Identify and address any coverage gaps
    - _Requirements: REQ-3.6.1_

  - [ ]* 23.2 Create and run E2E tests for critical spa workflows
    - E2E test: Customer ordering a spa package (login → select package → order → pay deposit)
    - E2E test: KTV completing a session (login → view assignments → complete session → verify salary update)
    - E2E test: Admin calculating monthly salary (login → view salary dashboard → calculate → approve)
    - E2E test: Payment processing (select payment method → process → verify receipt)
    - Verify all E2E tests pass with zero regression
    - _Requirements: REQ-3.6.3_

  - [ ]* 23.3 Performance benchmarking and validation
  - [ ]* 23.3 Performance benchmarking and validation
    - Benchmark API response times before and after Phase 3 migration
    - Verify TenantContext construction adds <10ms overhead
    - Verify module adapter lookup completes in <1ms
    - Verify API response time degradation is <5%
    - Document performance metrics in test results
    - _Requirements: NFR-3.1, NFR-3.2, NFR-3.3_

  - [ ] 23.4 Validate database schema unchanged
    - Run schema diff against production database
    - Confirm zero new tables added
    - Confirm zero tables dropped or renamed
    - Confirm zero columns added, removed, or modified
    - Confirm RLS policies unchanged
    - Confirm indexes unchanged
    - _Requirements: REQ-3.6.4_

  - [ ]* 23.5 Security and tenant isolation validation
    - Test that all service functions validate `tenantId` matches authenticated user
    - Test that database queries correctly filter by `tenantId` from TenantContext
    - Test that module adapters cannot access database directly (only via core services)
    - Test that TenantContext is immutable after construction
    - Verify RLS policies enforce tenant isolation
    - _Requirements: NFR-3.10, NFR-3.11, NFR-3.12_


- [ ] 24. Documentation updates
  - [ ] 24.1 Create core platform architecture documentation
- [ ] 24. Documentation updates
  - [ ] 24.1 Create core platform architecture documentation
    - Create `docs/architecture/core-platform.md` explaining core platform design
    - Document directory structure and module organization
    - Include architecture diagrams showing core ↔ module boundaries
    - Explain TenantContext lifecycle and usage patterns
    - _Requirements: REQ-3.7.1_

  - [ ] 24.2 Create module system documentation
    - Create `docs/architecture/module-system.md` explaining module adapter pattern
    - Document how to create a new module adapter
    - Provide code examples for common adapter methods
    - Explain module registry and adapter registration
    - _Requirements: REQ-3.7.1_

  - [ ] 24.3 Create multi-tenancy documentation
    - Create `docs/architecture/tenant-context.md` explaining multi-tenancy design
    - Document how tenant configuration is loaded and cached
    - Explain tenant isolation and security considerations
    - Provide examples of tenant-specific feature flags
    - _Requirements: REQ-3.7.1_

  - [ ] 24.4 Create Phase 3 migration guide for developers
    - Create `docs/migration/phase-3-migration-guide.md`
    - Explain how to update service function signatures for TenantContext
    - Provide examples of using TenantContext in React components
    - Explain how to add module-specific logic to adapters
    - Include code migration patterns and FAQ section
    - _Requirements: REQ-3.7.2_

  - [ ] 24.5 Update API documentation with TenantContext and contract types
    - Update API route documentation with TenantContext parameter
    - Update request/response examples to use core contract types (CoreBookingOrder, PaymentIntent, etc.)
    - Document authentication and tenant ID extraction
    - Document error responses for missing/invalid tenant ID
    - Update Postman collection with tenant headers
    - _Requirements: REQ-3.7.3_

- [ ] 25. Final checkpoint and production readiness review
  - Run full test suite one final time and ensure all tests pass
  - Review all git commits and ensure clean migration history
  - Conduct code review with development team
  - Prepare rollback plan and feature flag configuration
  - Deploy to staging environment for UAT
  - Obtain stakeholder approval for production deployment
  - Schedule production deployment with zero-downtime strategy


---

## Notes

### Task Organization
- Tasks are organized into **5 waves** matching the migration strategy in the design document
- Each wave has clear dependencies on previous waves
- **Checkpoint tasks** are included after each wave to validate progress before proceeding
- Total estimated duration: **9-10 weeks** (2 weeks per wave)

### Optional Task Marking
- Tasks marked with `*` are **optional** and can be skipped for faster MVP delivery
- Optional tasks include: unit tests, integration tests, E2E tests, performance benchmarking, and security validation
- **Core implementation tasks are never marked optional** - all service extraction, refactoring, and integration tasks are required

### Testing Strategy
- **Unit tests** validate individual service functions with mock TenantContext
- **Integration tests** validate adapter integration with core services
- **E2E tests** validate full user workflows (order, payment, session, salary)
- All tests must respect Bella ERP critical testing rules (zero silent failures, side-effect assertions, strict typing)

### Key Constraints
- **Zero database schema changes** - all migrations are code-only
- **Zero functional changes** - user experience must remain identical
- **TypeScript compilation enforces boundaries** - core/module separation enforced at compile-time
- **All 1304+ tests must pass** after each wave before proceeding

### Traceability
- Each task references specific requirements from `requirements.md` using `_Requirements: REQ-X.Y.Z_` notation
- Requirements are organized into 7 epics:
  1. Core Platform Code Extraction
  2. TenantContext Integration
  3. Module Adapter Implementation
  4. Spa Module Separation
  5. Database Query Migration
  6. Testing & Validation
  7. Documentation & Developer Experience

### Bella ERP Specific Considerations
- **Package session multipliers** (1.0x, 1.5x, 2.0x) must be preserved in spa adapter
- **Decimal session counts** (NUMERIC(5,2)) must be handled correctly
- **Salary calculation engine** must respect draft vs. finalized status
- **Pro-rata base salary** calculations must use actual working days from attendance
- **Strict database typing** using Supabase generated types is mandatory
- **Zero silent database failures** - all errors must propagate or return explicit failure status

### Rollback Strategy
- Feature flags allow toggling between old and new architecture
- Git commits are organized by wave for easy rollback
- No database migrations required, so rollback is code-only
- Cache invalidation required for TenantContext if rolling back

### Future Phases
- **Phase 4**: Add new industry modules (cleaning, home-service)
- **Phase 5**: Invoice generation system
- **Phase 6**: Workflow orchestration system

---

## Task Dependency Graph

```json
{
  "waves": [
    {
      "id": 0,
      "tasks": ["1.1", "1.2", "1.3", "1.4"]
    },
    {
      "id": 1,
      "tasks": ["1.5", "3.1", "5.1", "6.1", "7.1", "8.1", "9.1", "10.1"]
    },
    {
      "id": 2,
      "tasks": ["3.2", "4.1", "5.2", "6.2", "7.2", "8.2", "9.2", "10.2", "11.1"]
    },
    {
      "id": 3,
      "tasks": ["4.2", "11.2", "13.1", "13.2", "14.1"]
    },
    {
      "id": 4,
      "tasks": ["14.2", "14.3", "15.1", "15.2", "15.3", "15.4"]
    },
    {
      "id": 5,
      "tasks": ["14.4", "16.1", "16.2", "16.3", "16.4", "16.5", "17.1", "17.2"]
    },
    {
      "id": 6,
      "tasks": ["19.1", "19.2", "19.3", "20.1", "20.2"]
    },
    {
      "id": 7,
      "tasks": ["19.4", "20.3", "20.4", "20.5", "21.1", "21.2", "21.3"]
    },
    {
      "id": 8,
      "tasks": ["23.1", "23.2", "23.3", "23.4", "23.5"]
    },
    {
      "id": 9,
      "tasks": ["24.1", "24.2", "24.3", "24.4", "24.5"]
    }
  ]
}
```},
    {
      "id": 8,
      "tasks": ["18.1", "18.2", "18.3"]
    },
    {
      "id": 9,
      "tasks": ["20.1", "20.2", "20.3", "20.4", "20.5", "21.1", "21.2"]
    },
    {
      "id": 10,
      "tasks": ["21.3", "21.4", "21.5"]
    }
  ]
}
```

---

**Document Version**: 1.0  
**Last Updated**: 2025-01-24  
**Status**: Ready for Implementation
