# Phase 3: Core Platform Physical Extraction & Migration - Requirements

**Feature**: phase-3-physical-extraction  
**Status**: Planning  
**Priority**: High  
**Created**: 2025-06-01

---

## Executive Summary

Phase 3 physically extracts core platform code and migrates the existing Bella Spa codebase to USE the 10 core service contract types defined in Phase 2. This transforms the monolithic spa-specific codebase into a modular, multi-industry platform while maintaining 100% backward compatibility.

**Phase 2 Recap** (COMPLETED):
- ✅ Defined 10 core service contract TypeScript interfaces
- ✅ Zero runtime overhead (compile-time only)
- ✅ 100% backward compatibility maintained
- ✅ All 1304 tests passing
- ✅ No code changes, no schema changes

**Phase 3 Goal**:
- Extract core platform services to `src/core/` directory
- Migrate service functions to use TenantContext and contract types
- Implement SpaModuleAdapter for spa-specific behavior
- Create module registry system
- Extract spa-specific code to `src/modules/spa/`
- Maintain zero regression in functionality

---

## Business Context

### Problem Statement

Currently, Bella Spa ERP is a monolithic application where:
- Core platform logic (auth, bookings, payments) is mixed with spa-specific logic
- No clear boundaries between reusable platform code and industry-specific code
- Difficult to extend to new industries (cleaning, home-service, babycare)
- High risk of breaking spa functionality when adding new modules
- Technical debt slows down new feature development

### Desired Outcome

After Phase 3:
- Clear separation: `src/core/` contains reusable platform, `src/modules/spa/` contains spa-specific code
- Service functions accept TenantContext (tenant-aware, multi-industry ready)
- Module adapters provide industry-specific behavior without core dependencies
- Module registry enables dynamic module loading and feature routing
- Easy to add new industry modules without touching core platform
- Zero disruption to current Bella Spa operations

### Success Metrics

1. **Code Organization**: 100% of core platform code in `src/core/`, 100% of spa-specific code in `src/modules/spa/`
2. **Test Coverage**: All 1304+ existing tests pass after migration
3. **Backward Compatibility**: Zero functional changes to Bella Spa user experience
4. **Type Safety**: All service functions use TenantContext and core contract types
5. **Module Isolation**: SpaModuleAdapter handles all spa-specific logic via adapter pattern
6. **Documentation**: Architecture docs updated with new structure

---

## User Stories & Requirements

### Epic 1: Core Platform Code Extraction

**Goal**: Move core platform services from scattered locations to `src/core/` directory with clear module boundaries.

#### REQ-3.1.1: Create Core Platform Directory Structure

**User Story**: As a developer, I want a clear directory structure for core platform code so that I can quickly locate and modify platform services without touching module-specific code.

**Acceptance Criteria**:
- [ ] `src/core/` directory created with subdirectories:
  - `src/core/types/` - Contract type definitions (already exists from Phase 2)
  - `src/core/services/` - Core business logic services
    - `src/core/services/auth/` - Authentication & authorization
    - `src/core/services/order/` - Customer order management (CoreBookingOrder)
    - `src/core/services/payment/` - Payment processing
    - `src/core/services/audit/` - Audit logging
    - `src/core/services/notification/` - Multi-channel notifications
    - `src/core/services/finance/` - Revenue, expenses, P&L, invoicing
    - `src/core/services/payroll/` - Employee compensation
    - `src/core/services/analytics/` - Business intelligence & reporting
  - `src/core/lib/` - Utility functions and helpers
  - `src/core/adapters/` - Module adapter implementations registry
  - `src/core/middleware/` - Request/response middleware
  - `src/core/hooks/` - React hooks for core functionality
  - `src/core/providers/` - React context providers
- [ ] README.md in each subdirectory explaining its purpose
- [ ] No breaking changes to existing imports

#### REQ-3.1.2: Extract Authentication & Authorization Services

**User Story**: As a developer, I want auth services to be tenant-aware so that they work across all industry modules.

**Acceptance Criteria**:
- [ ] Move `src/services/auth/` to `src/core/services/auth/`
- [ ] Refactor auth functions to accept `TenantContext` parameter
- [ ] Update all auth function signatures to use core contract types
- [ ] All auth-related tests pass after migration
- [ ] Existing auth flows work unchanged (login, logout, session management)

#### REQ-3.1.3: Extract Customer Order Management Services

**User Story**: As a developer, I want order services to use `CoreBookingOrder` contract so that the same order management logic works for spa, cleaning, and home-service orders.

**Acceptance Criteria**:
- [ ] Move `src/services/bookings/` to `src/core/services/order/`
- [ ] Refactor order functions to accept `TenantContext` and return `CoreBookingOrder`
- [ ] Module-specific scheduling logic (spa sessions, cleaning jobs, care visits) handled by module adapters
- [ ] All order tests pass after migration
- [ ] Existing order flows work unchanged (create, confirm, complete, cancel)

**Note**: Service renamed from "booking" to "order" for industry neutrality, but contract name `CoreBookingOrder` remains unchanged to avoid Phase 2 breaking changes.

#### REQ-3.1.4: Extract Payment Processing Services

**User Story**: As a developer, I want payment services to use `PaymentIntent` contract so that payment processing works across all industries.

**Acceptance Criteria**:
- [ ] Move `src/services/payments/` to `src/core/services/payments/`
- [ ] Refactor payment functions to accept `TenantContext` and use `PaymentIntent` type
- [ ] Payment method handling (cash, bank transfer, e-wallet) works for all modules
- [ ] All payment tests pass after migration
- [ ] Existing payment flows work unchanged

#### REQ-3.1.5: Extract Notification Services

**User Story**: As a developer, I want notification services to use `NotificationEvent` contract so that multi-channel notifications work across all modules.

**Acceptance Criteria**:
- [ ] Move `src/services/notifications/` to `src/core/services/notifications/`
- [ ] Refactor notification functions to accept `TenantContext` and use `NotificationEvent` type
- [ ] Multi-channel delivery (in-app, email, SMS, webhook) works for all modules
- [ ] All notification tests pass after migration
- [ ] Existing notification flows work unchanged

#### REQ-3.1.7: Extract Finance Services

**User Story**: As a developer, I want finance services to use core contract types so that revenue, expenses, and P&L tracking work across all industry modules.

**Acceptance Criteria**:
- [ ] Move `src/services/finance/` to `src/core/services/finance/`
- [ ] Refactor finance functions to accept `TenantContext` parameter
- [ ] Revenue recognition uses `CoreBookingOrder` for order-based revenue
- [ ] Expense tracking uses `PaymentIntent` for payment-based expenses
- [ ] Invoice generation uses `Invoice` contract from Phase 2
- [ ] P&L reports aggregate across all modules via TenantContext
- [ ] All finance tests pass after migration
- [ ] Existing finance reports work unchanged

#### REQ-3.1.8: Extract Payroll Services

**User Story**: As a developer, I want payroll services separated from finance so that employee compensation logic is industry-neutral and reusable.

**Acceptance Criteria**:
- [ ] Create `src/core/services/payroll/` for employee compensation
- [ ] Move base salary calculation logic from `src/services/finance/salary.ts` to core payroll
- [ ] Refactor payroll functions to accept `TenantContext` parameter
- [ ] Module-specific salary calculations (spa KTV commissions, session bonuses) handled by module adapters
- [ ] Payroll cycle management works for all industries
- [ ] All payroll tests pass after migration
- [ ] Existing salary flows work unchanged

#### REQ-3.1.9: Extract Analytics Services

**User Story**: As a developer, I want analytics services separated so that dashboard data and reports can aggregate across all modules.

**Acceptance Criteria**:
- [ ] Create `src/core/services/analytics/` for business intelligence
- [ ] Move dashboard aggregation logic from various services to analytics
- [ ] Move report generation logic to analytics service
- [ ] Refactor analytics functions to accept `TenantContext` parameter
- [ ] Analytics can query data from all enabled modules via TenantContext
- [ ] Export to Excel/PDF works for all report types
- [ ] All analytics tests pass after migration

---

### Epic 2: TenantContext Integration

**Goal**: Refactor service functions to accept TenantContext parameters for multi-tenant, multi-module awareness.

#### REQ-3.2.1: Create TenantContext Provider

**User Story**: As a developer, I want a React context provider for TenantContext so that all components can access tenant configuration.

**Acceptance Criteria**:
- [ ] `TenantContextProvider` component created in `src/core/providers/`
- [ ] Provider fetches tenant data from database on mount
- [ ] Provider constructs `TenantContext` object with enabled modules, feature flags, settings
- [ ] `useTenantContext()` hook returns current tenant context
- [ ] Provider handles loading and error states
- [ ] All pages wrapped with TenantContextProvider

#### REQ-3.2.2: Refactor API Routes to Use TenantContext

**User Story**: As a developer, I want API routes to construct TenantContext from request headers so that services receive tenant configuration.

**Acceptance Criteria**:
- [ ] Middleware created to extract tenant ID from request headers/session
- [ ] Middleware constructs `TenantContext` and attaches to request object
- [ ] All API routes receive `context: TenantContext` parameter
- [ ] Unauthorized requests rejected if tenant ID missing
- [ ] All API tests updated to include TenantContext

#### REQ-3.2.3: Update Service Function Signatures

**User Story**: As a developer, I want all service functions to accept TenantContext first parameter so that they are tenant-aware by default.

**Acceptance Criteria**:
- [ ] All functions in `src/core/services/` accept `context: TenantContext` as first parameter
- [ ] TypeScript compilation enforces TenantContext parameter
- [ ] Helper functions created for constructing TenantContext in tests
- [ ] All service unit tests updated with mock TenantContext
- [ ] No service function makes direct database queries without tenant filtering

---

### Epic 3: Module Adapter Implementation

**Goal**: Implement SpaModuleAdapter to encapsulate spa-specific behavior and establish adapter pattern for future modules.

#### REQ-3.3.1: Create Module Registry System

**User Story**: As a developer, I want a module registry so that modules can register adapters and core services can invoke module-specific behavior.

**Acceptance Criteria**:
- [ ] `ModuleRegistry` class created in `src/core/adapters/registry.ts`
- [ ] Registry supports `registerAdapter(adapter: ModuleAdapter)` method
- [ ] Registry supports `getAdapter(moduleId: ModuleId): ModuleAdapter | undefined` method
- [ ] Registry validates adapter implements `ModuleAdapter` interface
- [ ] Registry throws error if duplicate moduleId registered
- [ ] Registry exported from `src/core/adapters/index.ts`

#### REQ-3.3.2: Implement SpaModuleAdapter

**User Story**: As a developer, I want SpaModuleAdapter to handle all spa-specific booking, pricing, and workflow logic so that core services remain industry-neutral.

**Acceptance Criteria**:
- [ ] `SpaModuleAdapter` class implements `ModuleAdapter` interface
- [ ] `transformServiceItem()` transforms `CoreServiceCatalogItem` to spa package type
- [ ] `transformBookingOrder()` transforms `CoreBookingOrder` to spa booking type
- [ ] `validateBookingRules()` validates spa-specific rules (KTV availability, session limits)
- [ ] `calculatePricing()` applies spa-specific pricing (package discounts, subscription tiers)
- [ ] `onBookingCompleted()` handles spa side effects (salary updates, inventory deductions)
- [ ] `getModuleWidgets()` returns spa dashboard widgets
- [ ] All spa-specific logic moved from core services to adapter

#### REQ-3.3.3: Register SpaModuleAdapter on App Startup

**User Story**: As a developer, I want SpaModuleAdapter registered automatically on app startup so that core services can invoke spa-specific behavior.

**Acceptance Criteria**:
- [ ] `src/modules/spa/register.ts` created with adapter registration logic
- [ ] Registration called in `src/app/layout.tsx` or `src/pages/_app.tsx`
- [ ] Registration only happens once per app lifecycle
- [ ] Console log confirms adapter registered successfully
- [ ] Adapter available to all core services after registration

#### REQ-3.3.4: Update Core Services to Invoke Adapters

**User Story**: As a developer, I want core order service to invoke module adapters so that module-specific validation and side effects execute automatically.

**Acceptance Criteria**:
- [ ] `createOrder()` invokes `adapter.validateBookingRules()` before creating order
- [ ] `completeOrder()` invokes `adapter.onBookingCompleted()` after marking order complete
- [ ] `calculateOrderPrice()` invokes `adapter.calculatePricing()` to get final price
- [ ] Core service gracefully handles missing adapter (default behavior)
- [ ] All order flows work with and without adapter registered

---

### Epic 4: Spa Module Separation

**Goal**: Extract spa-specific code to `src/modules/spa/` directory to establish clear module boundaries.

#### REQ-3.4.1: Create Spa Module Directory Structure

**User Story**: As a developer, I want spa-specific code isolated in `src/modules/spa/` so that I can work on spa features without touching core platform or other modules.

**Acceptance Criteria**:
- [ ] `src/modules/spa/` directory created with subdirectories:
  - `src/modules/spa/types/` - Spa-specific types (package types, KTV types)
  - `src/modules/spa/components/` - Spa UI components
  - `src/modules/spa/services/` - Spa-specific business logic
  - `src/modules/spa/adapters/` - SpaModuleAdapter implementation
  - `src/modules/spa/hooks/` - Spa-specific React hooks
  - `src/modules/spa/lib/` - Spa utility functions
- [ ] README.md in each subdirectory explaining spa module structure

#### REQ-3.4.2: Move Spa-Specific Types

**User Story**: As a developer, I want spa package types separated from core types so that package-specific fields (total_sessions, session_multiplier) don't clutter core contracts.

**Acceptance Criteria**:
- [ ] Spa package types moved to `src/modules/spa/types/package.ts`
- [ ] Spa booking types moved to `src/modules/spa/types/booking.ts`
- [ ] KTV/employee types moved to `src/modules/spa/types/employee.ts`
- [ ] Session types moved to `src/modules/spa/types/session.ts`
- [ ] Salary types moved to `src/modules/spa/types/salary.ts`
- [ ] All spa types exported from `src/modules/spa/types/index.ts`

#### REQ-3.4.3: Move Spa-Specific Components

**User Story**: As a developer, I want spa UI components moved to spa module directory so that core UI components remain industry-neutral.

**Acceptance Criteria**:
- [ ] Spa dashboard widgets moved to `src/modules/spa/components/dashboard/`
- [ ] Spa booking forms moved to `src/modules/spa/components/bookings/`
- [ ] KTV management components moved to `src/modules/spa/components/employees/`
- [ ] Package management components moved to `src/modules/spa/components/packages/`
- [ ] Salary management components moved to `src/modules/spa/components/salary/`
- [ ] All spa components imported from `src/modules/spa/components/`

#### REQ-3.4.4: Move Spa-Specific Services

**User Story**: As a developer, I want spa business logic separated from core services so that spa-specific calculations (session counting, salary pro-rata) are isolated.

**Acceptance Criteria**:
- [ ] Session management moved to `src/modules/spa/services/session.ts`
- [ ] Session scheduling, KTV assignment, session multiplier logic in spa module
- [ ] Salary calculation moved to `src/modules/spa/services/salary.ts`
- [ ] KTV salary pro-rata, session bonus, KPI bonus, violation deduction in spa module
- [ ] KTV performance tracking moved to `src/modules/spa/services/ktvPerformance.ts`
- [ ] Package session multiplier logic moved to `src/modules/spa/services/package.ts`
- [ ] All spa services use `CoreBookingOrder` as base type and extend with spa-specific fields
- [ ] All spa services exported from `src/modules/spa/services/`

**Note**: Core payroll in `src/core/services/payroll/` handles base compensation logic. Spa module handles KTV-specific commission calculations.

---

### Epic 5: Database Query Migration

**Goal**: Update database queries to use core contract types instead of ad-hoc interfaces while maintaining compatibility with existing schema.

#### REQ-3.5.1: Create Type Mappers for Database Queries

**User Story**: As a developer, I want helper functions to map database rows to contract types so that queries return properly typed contract objects.

**Acceptance Criteria**:
- [ ] `mapDbRowToBooking()` maps `bookings` table row to `CoreBookingOrder`
- [ ] `mapDbRowToServiceItem()` maps `packages` table row to `CoreServiceCatalogItem`
- [ ] `mapDbRowToPayment()` maps payment table row to `PaymentIntent`
- [ ] `mapDbRowToAuditEvent()` maps `audit_log` table row to `AuditEvent`
- [ ] `mapDbRowToNotification()` maps `app_notifications` table row to `NotificationEvent`
- [ ] All mappers handle null/undefined fields gracefully
- [ ] All mappers preserve metadata fields

#### REQ-3.5.2: Update Order Queries to Use CoreBookingOrder

**User Story**: As a developer, I want order queries to return `CoreBookingOrder` type so that TypeScript catches invalid field access at compile-time.

**Acceptance Criteria**:
- [ ] `getOrderById()` returns `CoreBookingOrder | null`
- [ ] `getOrdersByCustomer()` returns `CoreBookingOrder[]`
- [ ] `createOrder()` accepts `Partial<CoreBookingOrder>` and returns `CoreBookingOrder`
- [ ] `updateOrder()` accepts order ID and `Partial<CoreBookingOrder>`
- [ ] All order queries filter by `tenantId` from TenantContext
- [ ] All order tests updated to use `CoreBookingOrder` type

**Note**: Function names use "Order" terminology, but return `CoreBookingOrder` type from Phase 2 to avoid breaking changes.

#### REQ-3.5.3: Update Service Catalog Queries to Use CoreServiceCatalogItem

**User Story**: As a developer, I want service catalog queries to return `CoreServiceCatalogItem` so that package data is consistently typed.

**Acceptance Criteria**:
- [ ] `getServiceItemById()` returns `CoreServiceCatalogItem | null`
- [ ] `getServiceItemsByModule()` returns `CoreServiceCatalogItem[]`
- [ ] `createServiceItem()` accepts `Partial<CoreServiceCatalogItem>` and returns `CoreServiceCatalogItem`
- [ ] `updateServiceItem()` accepts item ID and `Partial<CoreServiceCatalogItem>`
- [ ] All service catalog queries filter by `tenantId` and `moduleId`
- [ ] Spa package metadata (total_sessions, session_multiplier) stored in `metadata` field

#### REQ-3.5.4: Update Payment Queries to Use PaymentIntent

**User Story**: As a developer, I want payment queries to return `PaymentIntent` so that payment processing is consistently typed.

**Acceptance Criteria**:
- [ ] `getPaymentById()` returns `PaymentIntent | null`
- [ ] `getPaymentsByBooking()` returns `PaymentIntent[]`
- [ ] `createPayment()` accepts `Partial<PaymentIntent>` and returns `PaymentIntent`
- [ ] `updatePaymentStatus()` accepts payment ID and `PaymentStatus`
- [ ] All payment queries filter by `tenantId`
- [ ] Payment method-specific details stored in `metadata` field

---

### Epic 6: Testing & Validation

**Goal**: Ensure zero regression in Bella Spa functionality after Phase 3 migration.

#### REQ-3.6.1: Update Unit Tests for TenantContext

**User Story**: As a developer, I want unit tests to provide mock TenantContext so that service functions can be tested in isolation.

**Acceptance Criteria**:
- [ ] `createMockTenantContext()` helper created in test utilities
- [ ] Helper accepts optional overrides for tenant configuration
- [ ] All unit tests updated to pass TenantContext to service functions
- [ ] Tests verify service functions respect tenant configuration (enabled modules, feature flags)
- [ ] All existing unit tests pass after migration

#### REQ-3.6.2: Create Integration Tests for Module Adapters

**User Story**: As a developer, I want integration tests to verify module adapters work correctly so that module-specific behavior is validated.

**Acceptance Criteria**:
- [ ] Integration test for `SpaModuleAdapter.validateBookingRules()`
- [ ] Integration test for `SpaModuleAdapter.calculatePricing()`
- [ ] Integration test for `SpaModuleAdapter.onBookingCompleted()`
- [ ] Integration test for adapter registration and lookup
- [ ] Tests verify adapter methods receive correct contract types
- [ ] Tests verify adapter methods return expected results

#### REQ-3.6.3: Run Full E2E Test Suite

**User Story**: As a developer, I want E2E tests to verify Bella Spa user flows work unchanged so that we confirm zero regression.

**Acceptance Criteria**:
- [ ] E2E test for order creation flow (customer purchasing a spa package)
- [ ] E2E test for payment processing flow (customer paying deposit)
- [ ] E2E test for session completion flow (KTV completing a session)
- [ ] E2E test for salary calculation flow (admin calculating KTV salary)
- [ ] All E2E tests pass after Phase 3 migration
- [ ] Performance benchmarks show no degradation

#### REQ-3.6.4: Validate Database Schema Unchanged

**User Story**: As a developer, I want to confirm database schema remains unchanged so that no data migration is required.

**Acceptance Criteria**:
- [ ] Run schema diff against production database
- [ ] Confirm zero new tables added
- [ ] Confirm zero tables dropped
- [ ] Confirm zero columns added or removed
- [ ] Confirm RLS policies unchanged
- [ ] Confirm indexes unchanged

---

### Epic 7: Documentation & Developer Experience

**Goal**: Update documentation to reflect new architecture and provide migration guides for developers.

#### REQ-3.7.1: Update Architecture Documentation

**User Story**: As a developer, I want architecture docs updated so that I understand the new core/module structure.

**Acceptance Criteria**:
- [ ] `docs/architecture/core-platform.md` created explaining core platform design
- [ ] `docs/architecture/module-system.md` created explaining module adapter pattern
- [ ] `docs/architecture/tenant-context.md` created explaining multi-tenancy
- [ ] Architecture diagrams showing core ↔ module boundaries
- [ ] Migration path documented from Phase 2 → Phase 3
- [ ] Future roadmap documented for additional modules

#### REQ-3.7.2: Create Developer Migration Guide

**User Story**: As a developer, I want a migration guide so that I can update my feature branches to use the new architecture.

**Acceptance Criteria**:
- [ ] `docs/migration/phase-3-migration-guide.md` created
- [ ] Guide explains how to update service function signatures
- [ ] Guide explains how to use TenantContext in components
- [ ] Guide explains how to add module-specific logic to adapters
- [ ] Code examples for common migration patterns
- [ ] FAQ section for common migration issues

#### REQ-3.7.3: Update API Documentation

**User Story**: As a developer, I want API docs updated so that I know which endpoints require TenantContext.

**Acceptance Criteria**:
- [ ] All API route docs updated with TenantContext parameter
- [ ] Request/response examples updated to use core contract types
- [ ] Authentication section updated to explain tenant ID extraction
- [ ] Error responses documented for missing/invalid tenant ID
- [ ] Postman collection updated with tenant headers

---

## Non-Functional Requirements

### Performance

- **NFR-3.1**: Phase 3 migration must NOT degrade API response times by more than 5%
- **NFR-3.2**: TenantContext construction must NOT add more than 10ms to request latency
- **NFR-3.3**: Module adapter lookup must complete in <1ms (use in-memory registry)

### Reliability

- **NFR-3.4**: All 1304+ existing tests must pass after Phase 3 migration
- **NFR-3.5**: Zero data loss during migration (no database changes required)
- **NFR-3.6**: Zero downtime for production users (migration deployed gradually)

### Maintainability

- **NFR-3.7**: Code duplication reduced by 30% (reusable core services)
- **NFR-3.8**: New industry module can be added in <2 weeks (adapter pattern)
- **NFR-3.9**: TypeScript compilation enforces core/module boundaries (no implicit any)

### Security

- **NFR-3.10**: All service functions must validate `tenantId` matches authenticated user's tenant
- **NFR-3.11**: Module adapters must NOT have direct database access (only through core services)
- **NFR-3.12**: TenantContext must be read-only after construction (immutable)

---

## Risks & Mitigation

### Risk 1: Breaking Existing Functionality

**Impact**: HIGH  
**Likelihood**: MEDIUM

**Mitigation**:
- Migrate in small waves (one epic at a time)
- Run full test suite after each wave
- Deploy to staging environment before production
- Implement feature flags to toggle new architecture
- Keep rollback plan ready for each deployment

### Risk 2: Performance Degradation

**Impact**: MEDIUM  
**Likelihood**: LOW

**Mitigation**:
- Benchmark API response times before and after migration
- Profile TenantContext construction overhead
- Use in-memory module registry (no database lookups)
- Cache tenant configuration in Redis
- Monitor production performance metrics closely

### Risk 3: Developer Adoption Resistance

**Impact**: MEDIUM  
**Likelihood**: MEDIUM

**Mitigation**:
- Create comprehensive migration guide with examples
- Hold training sessions for development team
- Provide code snippets and templates
- Assign migration champions for support
- Celebrate migration milestones

### Risk 4: Incomplete Spa Logic Extraction

**Impact**: HIGH  
**Likelihood**: MEDIUM

**Mitigation**:
- Audit all service functions for spa-specific logic before extraction
- Create checklist of spa-specific behaviors
- Review adapter implementation with domain experts
- Run integration tests for all spa workflows
- Conduct user acceptance testing

---

## Dependencies

### Internal Dependencies

- Phase 2 completion (DONE): Contract type definitions exist in `src/core/types/`
- All 1304 tests passing (CURRENT): Test suite baseline established
- No pending PRs with conflicting file moves (REQUIRED)
- Database schema frozen during migration (REQUIRED)

### External Dependencies

- TypeScript 5.9.3+ (CURRENT): For advanced type features
- Next.js 15.1+ (CURRENT): For API route middleware
- Supabase client 2.x (CURRENT): For database queries
- Jest 29.x (CURRENT): For unit/integration tests

---

## Out of Scope (Phase 3)

The following are explicitly OUT OF SCOPE for Phase 3 and deferred to future phases:

- ❌ Adding new industry modules (cleaning, home-service) - Phase 4+
- ❌ Implementing multi-tenancy UI (tenant switcher, admin panel) - Phase 4+
- ❌ Invoice generation system (using Invoice contract) - Phase 5+
- ❌ Workflow orchestration system (using WorkflowInstance contract) - Phase 6+
- ❌ Database schema changes or migrations - NOT NEEDED
- ❌ Frontend framework changes (staying with Next.js + React) - NOT NEEDED
- ❌ Authentication provider changes (staying with Supabase Auth) - NOT NEEDED

---

## Acceptance Criteria Summary

Phase 3 is considered COMPLETE when:

1. ✅ All core platform code physically extracted to `src/core/` directory
2. ✅ All service functions refactored to accept `TenantContext` first parameter
3. ✅ SpaModuleAdapter implemented with all spa-specific behavior
4. ✅ Module registry system working with adapter registration
5. ✅ All spa-specific code extracted to `src/modules/spa/` directory
6. ✅ Database queries use core contract types (CoreBookingOrder, PaymentIntent, etc.)
7. ✅ All 1304+ tests passing after migration
8. ✅ Zero functional changes to Bella Spa user experience
9. ✅ Architecture documentation updated
10. ✅ Developer migration guide published

---

## Next Steps

After Phase 3 requirements approval:

1. Create `design.md` with detailed architecture diagrams and implementation approach
2. Create `tasks.md` with granular implementation tasks
3. Begin wave-based migration starting with authentication services
4. Conduct code reviews and pair programming sessions
5. Deploy to staging for UAT before production rollout

---

**Document Version**: 1.0  
**Last Updated**: 2025-06-01  
**Status**: Draft - Awaiting Review
