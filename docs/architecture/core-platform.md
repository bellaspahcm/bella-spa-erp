# Core Platform Architecture

**Version**: 1.0  
**Last Updated**: 2025-06-01  
**Status**: Active

---

## Table of Contents

- [Overview](#overview)
- [Architecture Principles](#architecture-principles)
- [Directory Structure](#directory-structure)
- [Core Services](#core-services)
- [TenantContext System](#tenantcontext-system)
- [Module Adapter Pattern](#module-adapter-pattern)
- [Data Flow](#data-flow)
- [Service Layer Design](#service-layer-design)
- [Type System](#type-system)
- [Security Architecture](#security-architecture)
- [Performance & Scalability](#performance--scalability)
- [Best Practices](#best-practices)

---

## Overview

The Bella ERP Core Platform is an industry-neutral foundation that powers multi-industry business management applications. It provides reusable services for authentication, order management, payments, notifications, audit logging, finance, payroll, and analytics.

### Key Characteristics

- **Industry-Neutral**: Core services work across spa, cleaning, home service, and other verticals
- **Multi-Tenant**: Built-in tenant isolation and configuration management
- **Extensible**: Module adapter pattern allows industry-specific customization
- **Type-Safe**: Strong TypeScript typing with core contract types
- **Secure**: Row-level security, tenant isolation, audit logging
- **Scalable**: Stateless services, caching, horizontal scaling support

### Platform Evolution

**Phase 1**: Monolithic Bella Spa application (spa-specific logic mixed with core logic)  
**Phase 2**: Contract type definitions added (compile-time only, no runtime changes)  
**Phase 3**: Physical extraction of core platform (current phase)  
**Phase 4+**: Additional industry modules (cleaning, home service, etc.)

---

## Architecture Principles

### 1. Separation of Concerns

```
┌─────────────────────────────────────────────────────────┐
│                   Application Layer                     │
│  (Next.js pages, API routes, React components)         │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                Core Platform Services                    │
│  (Industry-neutral business logic)                      │
│  • Authentication  • Order Management  • Payments       │
│  • Notifications   • Audit           • Finance         │
│  • Payroll        • Analytics                          │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│              Module Adapters (Optional)                  │
│  (Industry-specific customization)                      │
│  • Spa Module  • Cleaning Module  • Home Service       │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                   Data Layer                            │
│  (Supabase PostgreSQL + RLS)                           │
└─────────────────────────────────────────────────────────┘
```

### 2. Dependency Inversion

- **Core Platform**: Never imports from `src/modules/` (zero dependencies on modules)
- **Modules**: Can import from `src/core/` (depend on core platform)
- **Module Adapters**: Registered at runtime via module registry (dependency injection)

### 3. Contract-Based Integration

- All cross-layer communication uses **core contract types**
- Database rows mapped to contract types (e.g., `CoreBookingOrder`, `PaymentIntent`)
- Module-specific metadata stored in flexible `metadata` fields

### 4. Tenant Isolation

- Every service function accepts `TenantContext` as first parameter
- All database queries filter by `tenant_id`
- Row-Level Security (RLS) policies enforce isolation at database level

---

## Directory Structure

The core platform resides in `src/core/` with the following organization:

```
src/core/
├── types/                  # Contract type definitions
│   ├── tenant.ts           # TenantContext, SubscriptionPlan
│   ├── module.ts           # ModuleAdapter, ModuleId
│   ├── booking-order.ts    # CoreBookingOrder
│   ├── payment.ts          # PaymentIntent, PaymentStatus
│   ├── notification.ts     # NotificationEvent, NotificationChannel
│   ├── audit.ts            # AuditEvent, AuditAction
│   ├── service-catalog.ts  # CoreServiceCatalogItem
│   ├── customer.ts         # CustomerProfile
│   ├── employee.ts         # EmployeeProfile
│   └── index.ts            # Barrel exports
│
├── services/               # Business logic services
│   ├── auth/              # Authentication & authorization
│   │   ├── authenticate.ts
│   │   ├── authorize.ts
│   │   └── index.ts
│   │
│   ├── order/             # Customer order management
│   │   ├── create.ts
│   │   ├── update.ts
│   │   ├── complete.ts
│   │   ├── cancel.ts
│   │   ├── query.ts
│   │   └── index.ts
│   │
│   ├── payment/           # Payment processing
│   │   ├── process.ts
│   │   ├── refund.ts
│   │   ├── query.ts
│   │   └── index.ts
│   │
│   ├── notification/      # Multi-channel notifications
│   │   ├── send.ts
│   │   ├── query.ts
│   │   └── index.ts
│   │
│   ├── audit/             # Audit logging
│   │   ├── log.ts
│   │   ├── query.ts
│   │   └── index.ts
│   │
│   ├── finance/           # Revenue, expenses, P&L, invoicing
│   │   ├── revenue.ts
│   │   ├── expense.ts
│   │   ├── invoice.ts
│   │   ├── reports.ts
│   │   └── index.ts
│   │
│   ├── payroll/           # Employee compensation
│   │   ├── calculate.ts
│   │   ├── approve.ts
│   │   ├── reports.ts
│   │   └── index.ts
│   │
│   └── analytics/         # Business intelligence
│       ├── dashboard.ts
│       ├── reports.ts
│       ├── export.ts
│       └── index.ts
│
├── adapters/              # Module adapter system
│   ├── registry.ts        # Module registry singleton
│   ├── types.ts           # Adapter utility types
│   └── index.ts
│
├── providers/             # React context providers
│   ├── TenantContextProvider.tsx
│   └── index.ts
│
├── hooks/                 # React hooks
│   ├── useTenantContext.ts
│   ├── useModuleAdapter.ts
│   └── index.ts
│
├── middleware/            # API middleware
│   ├── tenantContext.ts   # Extract and attach TenantContext
│   ├── auth.ts            # Authentication middleware
│   └── index.ts
│
└── lib/                   # Utility functions
    ├── database.ts        # Database utilities and mappers
    ├── validation.ts      # Input validation helpers
    ├── date.ts            # Date/time utilities
    └── index.ts
```

### Naming Conventions

- **Services**: Verb-based filenames (`create.ts`, `update.ts`, `query.ts`)
- **Types**: Noun-based filenames (`tenant.ts`, `payment.ts`)
- **Barrel Exports**: Every directory has `index.ts` for clean imports
- **Function Names**: `camelCase` for functions, `PascalCase` for types

---

## Core Services

### 1. Authentication Service (`src/core/services/auth/`)

**Purpose**: User authentication, authorization, and session management.

**Key Functions**:
```typescript
// Authenticate user with credentials
export async function authenticateUser(
  context: TenantContext,
  email: string,
  password: string
): Promise<User>

// Check if user has permission
export async function authorize(
  context: TenantContext,
  userId: string,
  permission: string
): Promise<boolean>

// Get current user session
export async function getCurrentUser(
  context: TenantContext
): Promise<User | null>
```

**Features**:
- Email/password authentication
- Session management
- Role-based access control (RBAC)
- Multi-factor authentication support
- Tenant-specific user management

---

### 2. Order Service (`src/core/services/order/`)

**Purpose**: Manage customer orders across all industries (spa bookings, cleaning jobs, home service appointments).

**Key Functions**:
```typescript
// Create a new order
export async function createOrder(
  context: TenantContext,
  orderData: Partial<CoreBookingOrder>
): Promise<CoreBookingOrder>

// Update existing order
export async function updateOrder(
  context: TenantContext,
  orderId: string,
  updates: Partial<CoreBookingOrder>
): Promise<CoreBookingOrder>

// Mark order as completed
export async function completeOrder(
  context: TenantContext,
  orderId: string
): Promise<CoreBookingOrder>

// Query orders with filters
export async function queryOrders(
  context: TenantContext,
  filters: OrderFilters
): Promise<CoreBookingOrder[]>
```

**Features**:
- Order lifecycle management (pending → confirmed → in-progress → completed)
- Customer assignment and tracking
- Service item association
- Scheduled start/end time management
- Module adapter invocation for industry-specific logic

**Note**: Service renamed from "booking" to "order" for industry neutrality, but contract type remains `CoreBookingOrder` from Phase 2.

---

### 3. Payment Service (`src/core/services/payment/`)

**Purpose**: Process payments, refunds, and payment tracking.

**Key Functions**:
```typescript
// Process a payment
export async function processPayment(
  context: TenantContext,
  paymentData: Partial<PaymentIntent>
): Promise<PaymentIntent>

// Issue a refund
export async function refundPayment(
  context: TenantContext,
  paymentId: string,
  amount: number
): Promise<PaymentIntent>

// Query payment history
export async function queryPayments(
  context: TenantContext,
  filters: PaymentFilters
): Promise<PaymentIntent[]>
```

**Features**:
- Multiple payment methods (cash, bank transfer, e-wallet, credit card)
- Payment status tracking (pending, completed, failed, refunded)
- Partial payments and deposits
- Payment method-specific metadata
- Integration with payment gateways

---

### 4. Notification Service (`src/core/services/notification/`)

**Purpose**: Multi-channel notification delivery (in-app, email, SMS, webhook).

**Key Functions**:
```typescript
// Send a notification
export async function sendNotification(
  context: TenantContext,
  notificationData: Partial<NotificationEvent>
): Promise<NotificationEvent>

// Query notification history
export async function queryNotifications(
  context: TenantContext,
  filters: NotificationFilters
): Promise<NotificationEvent[]>

// Mark notification as read
export async function markAsRead(
  context: TenantContext,
  notificationId: string
): Promise<void>
```

**Features**:
- Multi-channel delivery (in-app, email, SMS, webhook)
- Template-based messaging
- Delivery status tracking
- Read/unread status management
- Tenant-specific notification preferences

---

### 5. Audit Service (`src/core/services/audit/`)

**Purpose**: Log all system actions for compliance and debugging.

**Key Functions**:
```typescript
// Log an audit event
export async function logAuditEvent(
  context: TenantContext,
  eventData: Partial<AuditEvent>
): Promise<AuditEvent>

// Query audit logs
export async function queryAuditLogs(
  context: TenantContext,
  filters: AuditFilters
): Promise<AuditEvent[]>
```

**Features**:
- Action logging (create, update, delete, etc.)
- User attribution (who performed the action)
- Timestamp tracking (when the action occurred)
- Field-level change tracking (what changed)
- Tenant-isolated audit logs

---

### 6. Finance Service (`src/core/services/finance/`)

**Purpose**: Revenue recognition, expense tracking, invoicing, and financial reporting.

**Key Functions**:
```typescript
// Record revenue
export async function recordRevenue(
  context: TenantContext,
  revenueData: RevenueRecord
): Promise<void>

// Record expense
export async function recordExpense(
  context: TenantContext,
  expenseData: ExpenseRecord
): Promise<void>

// Generate invoice
export async function generateInvoice(
  context: TenantContext,
  invoiceData: Partial<Invoice>
): Promise<Invoice>

// Get P&L report
export async function getProfitAndLoss(
  context: TenantContext,
  startDate: Date,
  endDate: Date
): Promise<ProfitAndLossReport>
```

**Features**:
- Revenue recognition from orders
- Expense tracking from payments
- Invoice generation (PDF export)
- P&L report generation
- Cash flow analysis
- Module-agnostic financial data aggregation

---

### 7. Payroll Service (`src/core/services/payroll/`)

**Purpose**: Employee compensation calculation and management.

**Key Functions**:
```typescript
// Calculate employee salary
export async function calculateSalary(
  context: TenantContext,
  employeeId: string,
  period: PayrollPeriod
): Promise<SalaryCalculation>

// Approve salary
export async function approveSalary(
  context: TenantContext,
  salaryRecordId: string
): Promise<void>

// Get payroll report
export async function getPayrollReport(
  context: TenantContext,
  period: PayrollPeriod
): Promise<PayrollReport>
```

**Features**:
- Base salary calculation
- Payroll cycle management
- Salary approval workflow
- Payroll reports and exports
- Module adapters for industry-specific commissions

**Note**: Module-specific salary calculations (e.g., spa KTV commissions) handled by module adapters.

---

### 8. Analytics Service (`src/core/services/analytics/`)

**Purpose**: Business intelligence, dashboard data aggregation, and report generation.

**Key Functions**:
```typescript
// Get dashboard data
export async function getDashboardData(
  context: TenantContext,
  dashboardId: string
): Promise<DashboardData>

// Generate report
export async function generateReport(
  context: TenantContext,
  reportType: string,
  filters: ReportFilters
): Promise<ReportData>

// Export report to Excel
export async function exportToExcel(
  context: TenantContext,
  reportData: ReportData
): Promise<Buffer>
```

**Features**:
- Dashboard widget data aggregation
- Custom report generation
- Export to Excel/PDF
- Cross-module data querying
- Performance metrics and KPIs

---

## TenantContext System

### TenantContext Structure

```typescript
export interface TenantContext {
  readonly tenantId: string;
  readonly tenantName: string;
  readonly enabledModules: readonly ModuleId[];
  readonly subscriptionPlan: SubscriptionPlan;
  readonly featureFlags: Readonly<Record<string, boolean>>;
  readonly settings: Readonly<Record<string, any>>;
}
```

### TenantContext Lifecycle

**Server-Side (API Routes)**:
```
1. User makes request → API route handler
2. Middleware extracts tenant ID from session
3. Middleware fetches tenant config from database
4. Middleware constructs TenantContext
5. Middleware attaches context to request object
6. Handler extracts context and passes to services
```

**Client-Side (React Components)**:
```
1. TenantContextProvider mounts
2. Provider fetches tenant config from /api/tenant/context
3. Provider stores context in React Context
4. Child components access context via useTenantContext() hook
```

### Why TenantContext?

1. **Single Source of Truth**: Tenant configuration loaded once, passed everywhere
2. **Type Safety**: Strong typing prevents invalid configuration access
3. **Performance**: Avoids repeated database queries for tenant config
4. **Security**: Enforces tenant isolation at service function level
5. **Flexibility**: Supports per-tenant feature flags, settings, and module enablement

For more details, see [Tenant Context Architecture](./tenant-context.md).

---

## Module Adapter Pattern

### Purpose

Module adapters allow industry-specific customization without modifying core platform code.

### ModuleAdapter Interface

```typescript
export interface ModuleAdapter {
  moduleId: ModuleId;
  moduleName: string;
  
  transformServiceItem?: (item: CoreServiceCatalogItem) => unknown;
  transformBookingOrder?: (order: CoreBookingOrder) => unknown;
  validateBookingRules?: (order: CoreBookingOrder, context: TenantContext) => Promise<boolean>;
  calculatePricing?: (item: CoreServiceCatalogItem, context: TenantContext) => Promise<number>;
  onBookingCompleted?: (order: CoreBookingOrder, context: TenantContext) => Promise<void>;
  getModuleWidgets?: () => unknown[];
}
```

### Adapter Invocation Flow

```
Core Service → Module Registry → Module Adapter
     ↓              ↓                   ↓
createOrder()   .get('spa')    SpaModuleAdapter.validateBookingRules()
```

### Benefits

- **Zero Core Dependencies**: Core platform never imports module code
- **Dynamic Loading**: Adapters registered at runtime
- **Graceful Degradation**: Core services work without adapters
- **Easy Extension**: New modules added without modifying core

For more details, see [Module System Architecture](./module-system.md).

---

## Data Flow

### Request Flow (API Route)

```
1. Client Request
   ↓
2. Authentication Middleware (verify session)
   ↓
3. TenantContext Middleware (extract tenant config)
   ↓
4. API Route Handler (extract context from request)
   ↓
5. Core Service (business logic with TenantContext)
   ↓
6. Module Adapter (optional industry-specific logic)
   ↓
7. Database Query (with tenant_id filter)
   ↓
8. RLS Policy Enforcement (database-level isolation)
   ↓
9. Response (core contract type returned)
```

### Service Call Pattern

```typescript
// API Route Handler
export const POST = withTenantContext(async (request: NextRequestWithContext) => {
  const context = request.tenantContext; // Step 4
  const orderData = await request.json();
  
  const order = await createOrder(context, orderData); // Step 5
  
  return Response.json(order); // Step 9
});

// Core Service
export async function createOrder(
  context: TenantContext, // Step 5
  orderData: Partial<CoreBookingOrder>
): Promise<CoreBookingOrder> {
  // Step 6: Optional adapter validation
  const adapter = moduleRegistry.get(context.moduleId);
  if (adapter?.validateBookingRules) {
    const isValid = await adapter.validateBookingRules(orderData as CoreBookingOrder, context);
    if (!isValid) throw new Error('Validation failed');
  }
  
  // Step 7: Database query with tenant filter
  const { data, error } = await supabase
    .from('bookings')
    .insert({
      ...orderData,
      tenant_id: context.tenantId, // Tenant isolation
    })
    .select()
    .single();
  
  if (error) throw error;
  
  return data as CoreBookingOrder; // Step 9
}
```

---

## Service Layer Design

### Service Function Signature Pattern

**All core service functions follow this signature pattern**:

```typescript
export async function serviceFunctionName(
  context: TenantContext,     // ALWAYS first parameter
  ...otherParameters          // Function-specific parameters
): Promise<ReturnType> {
  // Implementation
}
```

### Example Services

```typescript
// Create operation
export async function createResource(
  context: TenantContext,
  data: Partial<Resource>
): Promise<Resource>

// Read operation
export async function getResourceById(
  context: TenantContext,
  id: string
): Promise<Resource | null>

// Update operation
export async function updateResource(
  context: TenantContext,
  id: string,
  updates: Partial<Resource>
): Promise<Resource>

// Delete operation
export async function deleteResource(
  context: TenantContext,
  id: string
): Promise<void>

// Query operation
export async function queryResources(
  context: TenantContext,
  filters: ResourceFilters
): Promise<Resource[]>
```

### Service Design Principles

1. **Stateless**: Services do not store state (pure functions)
2. **Single Responsibility**: Each service function does one thing well
3. **Tenant-Aware**: All functions receive and use TenantContext
4. **Type-Safe**: Strong TypeScript typing for inputs and outputs
5. **Error Handling**: Explicit error throwing, no silent failures
6. **Testable**: Easy to unit test with mock TenantContext

---

## Type System

### Core Contract Types

All cross-layer communication uses core contract types from `src/core/types/`.

**Key Contract Types**:

| Type | Purpose | Key Fields |
|------|---------|------------|
| `CoreBookingOrder` | Customer orders | `id`, `customerId`, `totalAmount`, `status`, `scheduledStartTime`, `metadata` |
| `PaymentIntent` | Payment transactions | `id`, `amount`, `method`, `status`, `metadata` |
| `NotificationEvent` | Notifications | `id`, `type`, `channel`, `recipient`, `content` |
| `AuditEvent` | Audit logs | `id`, `action`, `userId`, `resourceType`, `changes` |
| `CoreServiceCatalogItem` | Service catalog | `id`, `name`, `basePrice`, `category`, `metadata` |
| `CustomerProfile` | Customer data | `id`, `name`, `email`, `phone`, `metadata` |
| `EmployeeProfile` | Employee data | `id`, `name`, `role`, `baseSalary`, `metadata` |

### Metadata Pattern

Contract types use flexible `metadata` fields for module-specific data:

```typescript
export interface CoreBookingOrder {
  id: string;
  customerId: string;
  totalAmount: number;
  status: BookingStatus;
  metadata: Record<string, any>; // Module-specific fields
}

// Spa module extracts spa-specific fields from metadata
export interface SpaBooking extends CoreBookingOrder {
  assignedKtvId: string;              // From metadata.assigned_ktv_id
  sessionsTotal: number;              // From metadata.sessions_total
  sessionsCompleted: number;          // From metadata.sessions_completed
  packageCategory: 'basic' | 'vip';  // From metadata.package_category
}
```

### Type Mapping

Database rows are mapped to contract types using mapper functions:

```typescript
// src/core/lib/database.ts
export function mapDbRowToBooking(row: BookingsTable): CoreBookingOrder {
  return {
    id: row.id,
    customerId: row.customer_id,
    totalAmount: row.total_amount,
    status: row.status as BookingStatus,
    scheduledStartTime: new Date(row.scheduled_start_time),
    scheduledEndTime: row.scheduled_end_time ? new Date(row.scheduled_end_time) : undefined,
    metadata: row.metadata || {},
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}
```

---

## Security Architecture

### Defense-in-Depth Layers

**Layer 1: Authentication**
- Supabase Auth validates user sessions
- JWT token validation
- Session expiration enforcement

**Layer 2: Tenant Assignment Validation**
- Verify user has valid `tenant_id`
- Reject requests from users without tenant assignment

**Layer 3: Application-Level Filtering**
- All service functions filter by `context.tenantId`
- TypeScript enforces TenantContext parameter

**Layer 4: Row-Level Security (RLS)**
- PostgreSQL policies enforce tenant isolation
- Even if application has bugs, database prevents cross-tenant access

**Layer 5: Audit Logging**
- All actions logged with user attribution
- Audit trail for compliance and forensics

### Tenant Isolation Example

```typescript
// Service function (Layer 3)
export async function getOrders(
  context: TenantContext
): Promise<CoreBookingOrder[]> {
  // Set session tenant for RLS (Layer 4)
  await supabase.rpc('set_session_tenant', {
    p_tenant_id: context.tenantId,
  });
  
  // Query with explicit tenant filter (Layer 3)
  const { data, error } = await supabase
    .from('bookings')
    .select('*')
    .eq('tenant_id', context.tenantId); // Explicit filter
  
  if (error) throw error;
  
  // Log audit event (Layer 5)
  await logAuditEvent(context, {
    action: 'query_orders',
    userId: context.userId,
    resourceType: 'booking',
  });
  
  return data.map(mapDbRowToBooking);
}
```

```sql
-- RLS Policy (Layer 4)
CREATE POLICY "Users can view own tenant bookings"
ON bookings
FOR SELECT
USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
```

### Security Best Practices

1. **Never Trust Client Input**: Always validate and sanitize
2. **Always Filter by tenantId**: Required in all database queries
3. **Use Parameterized Queries**: Prevent SQL injection
4. **Log Sensitive Actions**: Audit all create/update/delete operations
5. **Validate Permissions**: Check user roles before sensitive operations
6. **Rate Limiting**: Prevent abuse (implement per-tenant rate limits)

---

## Performance & Scalability

### Caching Strategy

**TenantContext Caching**:
```typescript
// Redis cache with 5-minute TTL
const TENANT_CONTEXT_CACHE_TTL = 300; // seconds

async function getTenantContext(tenantId: string): Promise<TenantContext> {
  const cacheKey = `tenant:${tenantId}:context`;
  
  // Check cache first
  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached);
  
  // Fetch from database
  const context = await constructTenantContext(tenantId);
  
  // Cache for 5 minutes
  await redis.setex(cacheKey, TENANT_CONTEXT_CACHE_TTL, JSON.stringify(context));
  
  return context;
}
```

**Module Registry Caching**:
- Module adapters instantiated once at application startup
- Stored in in-memory Map for O(1) lookup
- No database queries needed

### Stateless Services

- Core services are pure functions (no instance state)
- Easy to scale horizontally (add more servers)
- Session state stored in Supabase (shared across servers)

### Database Optimization

- Indexes on `tenant_id` for all tenant-scoped tables
- Composite indexes for common query patterns (e.g., `tenant_id, customer_id`)
- RLS policies compiled once and cached by PostgreSQL

### Performance Targets

| Metric | Target | Notes |
|--------|--------|-------|
| API Response Time | <200ms (p95) | Excluding external service calls |
| TenantContext Construction | <10ms | Cached after first request |
| Module Adapter Lookup | <1ms | In-memory Map lookup |
| Database Query | <50ms (p95) | With proper indexes |

---

## Best Practices

### 1. Always Pass TenantContext First

```typescript
// ✅ GOOD
export async function createOrder(
  context: TenantContext,
  orderData: Partial<CoreBookingOrder>
): Promise<CoreBookingOrder>

// ❌ BAD
export async function createOrder(
  orderData: Partial<CoreBookingOrder>,
  context: TenantContext
): Promise<CoreBookingOrder>
```

### 2. Always Filter by tenantId

```typescript
// ✅ GOOD
const { data } = await supabase
  .from('bookings')
  .select('*')
  .eq('tenant_id', context.tenantId);

// ❌ BAD (security vulnerability!)
const { data } = await supabase
  .from('bookings')
  .select('*');
```

### 3. Use Core Contract Types

```typescript
// ✅ GOOD
export async function getOrderById(
  context: TenantContext,
  id: string
): Promise<CoreBookingOrder | null>

// ❌ BAD
export async function getOrderById(
  context: TenantContext,
  id: string
): Promise<any>
```

### 4. Handle Errors Explicitly

```typescript
// ✅ GOOD
const { data, error } = await supabase
  .from('bookings')
  .select('*');

if (error) {
  console.error('[OrderService] Query failed:', error);
  throw new Error(`Failed to fetch orders: ${error.message}`);
}

// ❌ BAD (silent failure!)
const { data, error } = await supabase
  .from('bookings')
  .select('*');

if (error) {
  console.error(error);
  return []; // Silent failure!
}
```

### 5. Invoke Module Adapters Gracefully

```typescript
// ✅ GOOD (graceful - adapter is optional)
const adapter = moduleRegistry.get(context.moduleId);
if (adapter?.validateBookingRules) {
  const isValid = await adapter.validateBookingRules(order, context);
  if (!isValid) throw new Error('Validation failed');
}

// ❌ BAD (assumes adapter exists)
const adapter = moduleRegistry.getRequired(context.moduleId);
const isValid = await adapter.validateBookingRules(order, context);
```

### 6. Log Important Actions

```typescript
// ✅ GOOD
export async function deleteOrder(
  context: TenantContext,
  orderId: string
): Promise<void> {
  console.log(`[OrderService] Deleting order ${orderId} for tenant ${context.tenantId}`);
  
  await supabase
    .from('bookings')
    .delete()
    .eq('id', orderId)
    .eq('tenant_id', context.tenantId);
  
  await logAuditEvent(context, {
    action: 'delete_order',
    resourceId: orderId,
    resourceType: 'booking',
  });
}
```

---

## Additional Resources

### Related Documentation

- [Module System Architecture](./module-system.md)
- [Tenant Context Architecture](./tenant-context.md)
- [Phase 3 Migration Guide](../migration/phase-3-migration-guide.md)

### Code Examples

- **Core Services**: `src/core/services/`
- **Module Adapters**: `src/modules/spa/adapters/`
- **API Routes**: `src/app/api/`
- **React Components**: `src/app/` (pages and layouts)

### Getting Help

- **Slack Channel**: `#core-platform-support`
- **Technical Lead**: Contact the architecture team for questions
- **Documentation**: Refer to this guide and related docs

---

**Document Version**: 1.0  
**Last Updated**: 2025-06-01  
**Status**: Active
