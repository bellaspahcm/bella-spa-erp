# Bella ERP API Reference - Phase 3

**Version**: 1.0  
**Last Updated**: 2025-06-01  
**Status**: Active

---

## Table of Contents

- [Overview](#overview)
- [Authentication](#authentication)
- [TenantContext Integration](#tenantcontext-integration)
- [Core Contract Types](#core-contract-types)
- [Error Responses](#error-responses)
- [Order Management APIs](#order-management-apis)
- [Payment APIs](#payment-apis)
- [Notification APIs](#notification-apis)
- [Analytics & Dashboard APIs](#analytics--dashboard-apis)
- [Audit APIs](#audit-apis)
- [Tenant Configuration API](#tenant-configuration-api)
- [Postman Collection](#postman-collection)
- [Migration Notes](#migration-notes)

---

## Overview

This document describes the Bella ERP API endpoints after migrating to Phase 3 architecture with:
- **TenantContext**: All API routes use tenant context for multi-tenancy
- **Core Contract Types**: Request/response use standardized types (CoreBookingOrder, PaymentIntent, etc.)
- **Module Adapters**: APIs can invoke module-specific logic through adapters
- **Enhanced Security**: Automatic tenant isolation at multiple layers

### Base URL

- **Production**: `https://api.bella-erp.com`
- **Staging**: `https://staging-api.bella-erp.com`
- **Development**: `http://localhost:3000`

---

## Authentication

All API endpoints require authentication unless explicitly stated.

### Authentication Flow

1. User logs in via `/api/auth/login`
2. Server issues session token (stored in httpOnly cookie or returned in response)
3. Client includes token in subsequent requests
4. Server validates token and extracts tenant ID
5. Server constructs TenantContext and passes to services

### Required Headers

```http
Authorization: Bearer <session_token>
Content-Type: application/json
```

### Session Management

- Session tokens are valid for 7 days by default
- Tokens are refreshed automatically on activity
- Logout via `/api/auth/logout` invalidates the session token

---

## TenantContext Integration

### What is TenantContext?

TenantContext is a read-only object containing tenant-specific configuration automatically injected into all API requests.

```typescript
interface TenantContext {
  readonly tenantId: string;
  readonly tenantName: string;
  readonly enabledModules: readonly ModuleId[];
  readonly subscriptionPlan: SubscriptionPlan;
  readonly featureFlags: Readonly<Record<string, boolean>>;
  readonly settings: Readonly<Record<string, any>>;
}
```

### How Tenant Context is Extracted

Every API route automatically:

1. Validates user session token
2. Queries user's `tenant_id` from user profile
3. Fetches tenant configuration from database
4. Constructs TenantContext object  
5. Attaches context to request: `request.tenantContext`
6. Passes context to service functions

### Tenant Isolation

All database queries automatically filter by `tenant_id` ensuring:
- Users can only access data from their tenant
- Cross-tenant data leaks are prevented
- Row-Level Security (RLS) policies enforce isolation at database level

---

## Core Contract Types

All API request/response data uses core contract types for consistency and type safety.

### CoreBookingOrder

Represents a customer order across all industries (spa bookings, cleaning jobs, home service appointments).

```typescript
interface CoreBookingOrder {
  id: string;
  tenantId: string;
  customerId: string;
  serviceItems: string[];  // Array of service/package IDs
  totalAmount: number;
  status: 'pending' | 'confirmed' | 'in-progress' | 'completed' | 'cancelled';
  scheduledStartTime: string;  // ISO 8601 format
  scheduledEndTime?: string;   // ISO 8601 format
  notes?: string;
  metadata: Record<string, any>;  // Module-specific data
  createdAt: string;
  updatedAt: string;
}
```

**Module-Specific Metadata Examples**:
- Spa: `assigned_ktv_id`, `sessions_total`, `sessions_completed`, `package_category`
- Cleaning: `team_id`, `rooms_count`, `cleaning_type`
- Home Service: `technician_id`, `service_type`, `equipment_needed`

### PaymentIntent

Represents a payment transaction.

```typescript
interface PaymentIntent {
  id: string;
  tenantId: string;
  orderId: string;
  amount: number;
  method: 'cash' | 'bank_transfer' | 'e_wallet' | 'credit_card';
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  reference?: string;  // External transaction ID
  notes?: string;
  metadata: Record<string, any>;
  createdAt: string;
  completedAt?: string;
}
```

### NotificationEvent

Represents a notification sent to users.

```typescript
interface NotificationEvent {
  id: string;
  tenantId: string;
  recipientId: string;
  type: string;  // e.g., 'order_confirmed', 'payment_received'
  channel: 'in_app' | 'email' | 'sms' | 'webhook' | 'all';
  title: string;
  content: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  metadata: Record<string, any>;
  createdAt: string;
  readAt?: string;
}
```

### AuditEvent

Represents an audit log entry for compliance.

```typescript
interface AuditEvent {
  id: string;
  tenantId: string;
  userId: string;
  action: 'create' | 'update' | 'delete' | 'view';
  resourceType: string;  // e.g., 'order', 'payment', 'user'
  resourceId: string;
  changes?: Record<string, { old: any; new: any }>;
  ipAddress: string;
  userAgent: string;
  timestamp: string;
}
```

---

## Error Responses

All endpoints return standard error responses.

### HTTP Status Codes

| Status Code | Description | When It Occurs |
|-------------|-------------|----------------|
| `200 OK` | Request successful | Successful GET, PATCH, DELETE |
| `201 Created` | Resource created | Successful POST |
| `400 Bad Request` | Invalid input data | Missing required fields, validation errors |
| `401 Unauthorized` | Authentication failed | Missing or expired session token |
| `403 Forbidden` | Authorization failed | User not assigned to tenant, insufficient permissions |
| `404 Not Found` | Resource not found | Invalid ID, tenant doesn't exist, resource deleted |
| `409 Conflict` | Resource conflict | Duplicate entry, concurrent update conflict |
| `422 Unprocessable Entity` | Business logic validation failed | Module adapter validation failed |
| `429 Too Many Requests` | Rate limit exceeded | Too many requests from tenant |
| `500 Internal Server Error` | System error | Database error, service error, unexpected exception |

### Error Response Format

```typescript
{
  error: string;         // Human-readable error message
  code?: string;         // Machine-readable error code
  details?: any;         // Additional error details
  timestamp: string;     // ISO 8601 timestamp
}
```

### Error Codes

| Code | Message | Description |
|------|---------|-------------|
| `AUTH_001` | Invalid session token | Token expired or invalid |
| `AUTH_002` | No tenant assigned | User not assigned to any tenant |
| `TENANT_001` | Tenant not found | Tenant ID doesn't exist |
| `TENANT_002` | Tenant inactive | Tenant subscription inactive |
| `ORDER_001` | Invalid order data | Missing required fields in order |
| `ORDER_002` | Order not found | Order ID doesn't exist or wrong tenant |
| `ORDER_003` | Validation failed | Module adapter validation failed |
| `PAYMENT_001` | Insufficient amount | Payment amount less than required |
| `PAYMENT_002` | Invalid payment method | Payment method not supported |
| `RATE_LIMIT` | Rate limit exceeded | Too many requests |

---

## Order Management APIs

### POST /api/orders

Create a new customer order.

**Authentication**: Required  
**Roles**: `customer`, `admin`, `staff`  
**TenantContext**: Automatically injected

**Request Body**:
```json
{
  "customerId": "cust_123",
  "serviceItems": [
    {
      "itemId": "pkg_vip_001",
      "quantity": 1,
      "price": 5000000
    }
  ],
  "scheduledStartTime": "2025-06-15T09:00:00Z",
  "scheduledEndTime": "2025-06-15T10:30:00Z",
  "notes": "Customer prefers KTV Lan",
  "metadata": {
    "assigned_ktv_id": "ktv_456",
    "sessions_total": 10,
    "package_category": "vip"
  }
}
```

**Response (201 Created)**:
```json
{
  "id": "order_789",
  "tenantId": "tenant_001",
  "customerId": "cust_123",
  "serviceItems": ["pkg_vip_001"],
  "totalAmount": 5000000,
  "status": "pending",
  "scheduledStartTime": "2025-06-15T09:00:00Z",
  "scheduledEndTime": "2025-06-15T10:30:00Z",
  "notes": "Customer prefers KTV Lan",
  "metadata": {
    "assigned_ktv_id": "ktv_456",
    "sessions_total": 10,
    "package_category": "vip"
  },
  "createdAt": "2025-06-01T12:00:00Z",
  "updatedAt": "2025-06-01T12:00:00Z"
}
```

**Module Adapter Invocation**:
- `adapter.validateBookingRules()` - Validates module-specific rules (e.g., KTV availability)
- `adapter.calculatePricing()` - Applies module-specific pricing (e.g., subscription discounts)

**Errors**:
- `400` - Missing required fields
- `404` - Customer not found
- `422` - Validation failed (e.g., KTV unavailable, invalid schedule)

---

### GET /api/orders

Retrieve list of orders.

**Authentication**: Required  
**TenantContext**: Auto-filters by tenant

**Query Parameters**:
```
?customerId=cust_123        # Filter by customer
&status=confirmed           # Filter by status
&startDate=2025-06-01       # From date (ISO 8601)
&endDate=2025-06-30         # To date (ISO 8601)
&limit=50                   # Number of results (default: 50, max: 100)
&offset=0                   # Pagination offset (default: 0)
```

**Response (200 OK)**:
```json
{
  "data": [
    {
      "id": "order_789",
      "tenantId": "tenant_001",
      "customerId": "cust_123",
      "totalAmount": 5000000,
      "status": "confirmed",
      "scheduledStartTime": "2025-06-15T09:00:00Z",
      "metadata": {
        "assigned_ktv_id": "ktv_456"
      },
      "createdAt": "2025-06-01T12:00:00Z",
      "updatedAt": "2025-06-02T09:00:00Z"
    }
  ],
  "total": 142,
  "limit": 50,
  "offset": 0
}
```

**Tenant Isolation**: 
- Automatically filters by `context.tenantId`
- RLS policies enforce database-level isolation

---

### GET /api/orders/:id

Retrieve a single order by ID.

**Authentication**: Required  
**TenantContext**: Validates tenant ownership

**Response (200 OK)**:
```json
{
  "id": "order_789",
  "tenantId": "tenant_001",
  "customerId": "cust_123",
  "serviceItems": ["pkg_vip_001"],
  "totalAmount": 5000000,
  "status": "confirmed",
  "scheduledStartTime": "2025-06-15T09:00:00Z",
  "scheduledEndTime": "2025-06-15T10:30:00Z",
  "notes": "Customer prefers KTV Lan",
  "metadata": {
    "assigned_ktv_id": "ktv_456",
    "sessions_total": 10,
    "sessions_completed": 2
  },
  "customer": {
    "id": "cust_123",
    "name": "Nguyễn Thị Mai",
    "phone": "0987654321",
    "email": "mai@example.com"
  },
  "serviceDetails": [
    {
      "id": "pkg_vip_001",
      "name": "Combo Mẹ & Bé VIP Toàn Diện",
      "basePrice": 5000000,
      "sessions": 10
    }
  ],
  "createdAt": "2025-06-01T12:00:00Z",
  "updatedAt": "2025-06-02T09:00:00Z"
}
```

**Errors**:
- `404` - Order not found or belongs to different tenant

---

### PATCH /api/orders/:id

Update an existing order.

**Authentication**: Required  
**Roles**: `admin`, `staff`  
**TenantContext**: Validates tenant ownership

**Request Body** (all fields optional):
```json
{
  "status": "confirmed",
  "scheduledStartTime": "2025-06-16T10:00:00Z",
  "notes": "Updated time per customer request",
  "metadata": {
    "assigned_ktv_id": "ktv_999"
  }
}
```

**Response (200 OK)**:
```json
{
  "id": "order_789",
  "tenantId": "tenant_001",
  "customerId": "cust_123",
  "status": "confirmed",
  "scheduledStartTime": "2025-06-16T10:00:00Z",
  "updatedAt": "2025-06-02T15:30:00Z"
  // ... full order object
}
```

**Audit**: All updates are logged in audit_log table

---

### POST /api/orders/:id/complete

Mark an order as completed.

**Authentication**: Required  
**Roles**: `admin`, `staff`

**Response (200 OK)**:
```json
{
  "success": true,
  "order": {
    "id": "order_789",
    "status": "completed",
    "updatedAt": "2025-06-15T11:00:00Z"
  },
  "sideEffects": {
    "salaryUpdated": true,
    "inventoryDeducted": true,
    "revenueRecorded": true,
    "notificationSent": true
  }
}
```

**Module Adapter Side Effects** (via `adapter.onBookingCompleted()`):
- **Spa Module**: Updates KTV salary, deducts product inventory, records revenue
- **Cleaning Module**: Credits team salary, deducts supplies, records revenue
- **Home Service**: Updates technician commission, records revenue

---

### POST /api/orders/:id/cancel

Cancel an order.

**Authentication**: Required  
**Roles**: `admin`, `staff`, `customer` (own orders only)

**Request Body**:
```json
{
  "reason": "Customer requested cancellation",
  "refundAmount": 500000  // Optional partial refund
}
```

**Response (200 OK)**:
```json
{
  "success": true,
  "order": {
    "id": "order_789",
    "status": "cancelled",
    "metadata": {
      "cancellation_reason": "Customer requested cancellation",
      "cancelled_at": "2025-06-10T14:30:00Z",
      "cancelled_by": "user_123"
    }
  },
  "refund": {
    "id": "refund_456",
    "amount": 500000,
    "status": "pending"
  }
}
```

---

## Payment APIs

### POST /api/payments

Process a payment for an order.

**Authentication**: Required  
**TenantContext**: Automatically injected

**Request Body**:
```json
{
  "orderId": "order_789",
  "amount": 1000000,
  "method": "bank_transfer",
  "reference": "TXN20250601123456",
  "notes": "Deposit payment",
  "metadata": {
    "bank_name": "Vietcombank",
    "account_number": "1234567890"
  }
}
```

**Response (201 Created)**:
```json
{
  "id": "payment_456",
  "tenantId": "tenant_001",
  "orderId": "order_789",
  "amount": 1000000,
  "method": "bank_transfer",
  "status": "completed",
  "reference": "TXN20250601123456",
  "notes": "Deposit payment",
  "metadata": {
    "bank_name": "Vietcombank",
    "account_number": "1234567890"
  },
  "createdAt": "2025-06-01T14:30:00Z",
  "completedAt": "2025-06-01T14:30:05Z"
}
```

**Side Effects**:
- Creates revenue record in `revenue` table
- Creates accounting entry in `accounting_entries` table
- Sends payment confirmation notification
- Updates order status if fully paid

---

### GET /api/payments

Retrieve list of payments.

**Authentication**: Required  
**Roles**: `admin`, `accountant`, `staff`

**Query Parameters**:
```
?orderId=order_789          # Filter by order
&method=bank_transfer       # Filter by payment method
&status=completed           # Filter by status
&startDate=2025-06-01       # From date
&endDate=2025-06-30         # To date
&limit=50                   # Number of results
&offset=0                   # Pagination offset
```

**Response (200 OK)**:
```json
{
  "data": [
    {
      "id": "payment_456",
      "tenantId": "tenant_001",
      "orderId": "order_789",
      "amount": 1000000,
      "method": "bank_transfer",
      "status": "completed",
      "reference": "TXN20250601123456",
      "createdAt": "2025-06-01T14:30:00Z",
      "completedAt": "2025-06-01T14:30:05Z"
    }
  ],
  "total": 89,
  "summary": {
    "totalAmount": 250000000,
    "completedAmount": 240000000,
    "pendingAmount": 10000000,
    "byMethod": {
      "cash": 80000000,
      "bank_transfer": 150000000,
      "e_wallet": 10000000
    }
  }
}
```

---

### GET /api/payments/:id

Retrieve a single payment by ID.

**Authentication**: Required  
**TenantContext**: Validates tenant ownership

**Response (200 OK)**:
```json
{
  "id": "payment_456",
  "tenantId": "tenant_001",
  "orderId": "order_789",
  "amount": 1000000,
  "method": "bank_transfer",
  "status": "completed",
  "reference": "TXN20250601123456",
  "notes": "Deposit payment",
  "metadata": {
    "bank_name": "Vietcombank",
    "account_number": "1234567890"
  },
  "order": {
    "id": "order_789",
    "customerId": "cust_123",
    "totalAmount": 5000000,
    "status": "confirmed"
  },
  "createdAt": "2025-06-01T14:30:00Z",
  "completedAt": "2025-06-01T14:30:05Z"
}
```

---

### POST /api/payments/:id/refund

Issue a refund for a payment.

**Authentication**: Required  
**Roles**: `admin`, `accountant`

**Request Body**:
```json
{
  "amount": 500000,  // Optional: defaults to full refund
  "reason": "Customer cancellation"
}
```

**Response (200 OK)**:
```json
{
  "success": true,
  "payment": {
    "id": "payment_456",
    "status": "refunded",
    "refundedAmount": 500000,
    "updatedAt": "2025-06-05T10:00:00Z"
  },
  "refund": {
    "id": "refund_789",
    "paymentId": "payment_456",
    "amount": 500000,
    "reason": "Customer cancellation",
    "createdAt": "2025-06-05T10:00:00Z"
  }
}
```

**Side Effects**:
- Creates refund record in `refunds` table
- Reverses revenue record
- Creates accounting entry for refund
- Sends refund notification to customer

---

## Notification APIs

### POST /api/notifications

Send a notification to a user.

**Authentication**: Required  
**Roles**: `admin`, `staff`

**Request Body**:
```json
{
  "recipientId": "user_123",
  "type": "order_confirmed",
  "channel": "all",
  "title": "Order Confirmed",
  "content": "Your order #789 has been confirmed. Scheduled for June 15, 2025 at 9:00 AM.",
  "metadata": {
    "orderId": "order_789",
    "customerId": "cust_123"
  }
}
```

**Response (201 Created)**:
```json
{
  "id": "notif_456",
  "tenantId": "tenant_001",
  "recipientId": "user_123",
  "type": "order_confirmed",
  "channel": "all",
  "title": "Order Confirmed",
  "content": "Your order #789 has been confirmed...",
  "status": "sent",
  "deliveryResults": [
    {
      "channel": "in_app",
      "status": "delivered",
      "timestamp": "2025-06-01T15:00:00Z"
    },
    {
      "channel": "email",
      "status": "sent",
      "timestamp": "2025-06-01T15:00:01Z"
    },
    {
      "channel": "sms",
      "status": "delivered",
      "timestamp": "2025-06-01T15:00:05Z"
    }
  ],
  "createdAt": "2025-06-01T15:00:00Z"
}
```

---

### GET /api/notifications

Retrieve notifications for current user.

**Authentication**: Required

**Query Parameters**:
```
?read=false                 # Filter by read/unread
&type=order_confirmed       # Filter by notification type
&limit=20                   # Number of results
&offset=0                   # Pagination offset
```

**Response (200 OK)**:
```json
{
  "data": [
    {
      "id": "notif_456",
      "type": "order_confirmed",
      "title": "Order Confirmed",
      "content": "Your order #789 has been confirmed...",
      "status": "read",
      "createdAt": "2025-06-01T15:00:00Z",
      "readAt": "2025-06-01T16:30:00Z"
    }
  ],
  "total": 45,
  "unreadCount": 12
}
```

---

### PATCH /api/notifications/:id/read

Mark a notification as read.

**Authentication**: Required

**Response (200 OK)**:
```json
{
  "success": true,
  "notification": {
    "id": "notif_456",
    "status": "read",
    "readAt": "2025-06-02T09:00:00Z"
  }
}
```

---

## Analytics & Dashboard APIs

### GET /api/analytics/dashboard

Retrieve dashboard data for the current tenant.

**Authentication**: Required  
**Roles**: `admin`, `manager`

**Query Parameters**:
```
?period=month               # Period: today, week, month, year, custom
&startDate=2025-06-01       # For custom period
&endDate=2025-06-30         # For custom period
```

**Response (200 OK)**:
```json
{
  "period": "month",
  "startDate": "2025-06-01",
  "endDate": "2025-06-30",
  "revenue": {
    "total": 250000000,
    "trend": 15.5,  // % change from previous period
    "byDay": [
      { "date": "2025-06-01", "amount": 8500000 },
      { "date": "2025-06-02", "amount": 9200000 }
    ]
  },
  "orders": {
    "total": 142,
    "completed": 120,
    "pending": 15,
    "cancelled": 7,
    "trend": 12.3
  },
  "customers": {
    "total": 450,
    "new": 25,
    "returning": 425,
    "trend": 8.7
  },
  "moduleWidgets": [
    {
      "id": "spa_ktv_performance",
      "title": "KTV Performance",
      "data": {
        "topPerformers": [
          { "ktvId": "ktv_456", "name": "Lan", "sessions": 45, "revenue": 22500000 }
        ]
      }
    },
    {
      "id": "spa_package_sales",
      "title": "Package Sales",
      "data": {
        "byCategory": {
          "vip": 15,
          "basic": 30
        }
      }
    }
  ]
}
```

**Module Adapter Integration**:
- `adapter.getModuleWidgets()` returns module-specific dashboard widgets
- Spa: KTV performance, package sales distribution
- Cleaning: Job types, team utilization
- Home Service: Service categories, technician ratings

---

### GET /api/analytics/reports/:reportType

Generate a specific report.

**Authentication**: Required  
**Roles**: `admin`, `accountant`, `manager`

**Report Types**: `revenue`, `expenses`, `profit-loss`, `customer-lifetime-value`, `staff-performance`

**Query Parameters**:
```
?startDate=2025-06-01
&endDate=2025-06-30
&groupBy=day                # day, week, month
&format=json                # json, csv, pdf
```

**Response (200 OK)**:
```json
{
  "reportType": "revenue",
  "period": {
    "startDate": "2025-06-01",
    "endDate": "2025-06-30"
  },
  "summary": {
    "totalRevenue": 250000000,
    "averageDaily": 8333333,
    "growth": 15.5
  },
  "breakdown": [
    {
      "date": "2025-06-01",
      "revenue": 8500000,
      "orders": 5
    }
  ],
  "downloadUrl": "/api/analytics/reports/download/report_123.pdf"
}
```

---

## Audit APIs

### GET /api/audit-logs

Retrieve audit logs for compliance and debugging.

**Authentication**: Required  
**Roles**: `admin`, `super_admin`

**Query Parameters**:
```
?userId=user_123            # Filter by user
&action=update              # Filter by action (create, update, delete, view)
&resourceType=order         # Filter by resource type
&resourceId=order_789       # Filter by specific resource
&startDate=2025-06-01       # From date
&endDate=2025-06-30         # To date
&limit=50                   # Number of results
&offset=0                   # Pagination offset
```

**Response (200 OK)**:
```json
{
  "data": [
    {
      "id": "audit_789",
      "tenantId": "tenant_001",
      "userId": "user_123",
      "userName": "Admin User",
      "action": "update",
      "resourceType": "order",
      "resourceId": "order_789",
      "changes": {
        "status": {
          "old": "pending",
          "new": "confirmed"
        },
        "scheduledStartTime": {
          "old": "2025-06-15T09:00:00Z",
          "new": "2025-06-16T10:00:00Z"
        }
      },
      "ipAddress": "192.168.1.100",
      "userAgent": "Mozilla/5.0...",
      "timestamp": "2025-06-02T14:30:00Z"
    }
  ],
  "total": 1250
}
```

**Privacy**: Sensitive fields (passwords, payment details) are automatically redacted from audit logs.

---

## Tenant Configuration API

### GET /api/tenant/context

Retrieve tenant configuration for the current user. Used by `TenantContextProvider` on app startup.

**Authentication**: Required

**Response (200 OK)**:
```json
{
  "tenantId": "tenant_001",
  "tenantName": "Bella Spa Hà Nội",
  "enabledModules": ["spa"],
  "subscriptionPlan": "professional",
  "featureFlags": {
    "ai_salary_reconciliation": true,
    "multi_currency": false,
    "advanced_analytics": true
  },
  "settings": {
    "currency": "VND",
    "timezone": "Asia/Ho_Chi_Minh",
    "locale": "vi-VN",
    "logoUrl": "https://cdn.bella-erp.com/logos/tenant_001.png",
    "primaryColor": "#4F46E5",
    "businessHours": {
      "monday": { "open": "08:00", "close": "22:00" },
      "tuesday": { "open": "08:00", "close": "22:00" }
    }
  }
}
```

**Usage**:
- Called by `TenantContextProvider` when app loads
- Cached in React Context for client-side access
- Used for feature gating, UI customization, business logic

---

## Postman Collection

### Setup Instructions

1. Download Postman collection: `docs/api/bella-erp-phase3.postman_collection.json`
2. Import into Postman
3. Configure environment variables:
   - `base_url`: `https://api.bella-erp.com` (or your API base URL)
   - `session_token`: Your session token from login

### Collection Structure

The collection includes:

**Authentication**
- `POST /api/auth/login` - Login and get session token
- `POST /api/auth/logout` - Logout and invalidate token
- `GET /api/auth/session` - Check session validity

**Orders**
- `POST /api/orders` - Create new order
- `GET /api/orders` - List orders
- `GET /api/orders/:id` - Get order details
- `PATCH /api/orders/:id` - Update order
- `POST /api/orders/:id/complete` - Complete order
- `POST /api/orders/:id/cancel` - Cancel order

**Payments**
- `POST /api/payments` - Process payment
- `GET /api/payments` - List payments
- `GET /api/payments/:id` - Get payment details
- `POST /api/payments/:id/refund` - Issue refund

**Notifications**
- `POST /api/notifications` - Send notification
- `GET /api/notifications` - List notifications
- `PATCH /api/notifications/:id/read` - Mark as read

**Analytics**
- `GET /api/analytics/dashboard` - Get dashboard data
- `GET /api/analytics/reports/:reportType` - Generate report

**Audit**
- `GET /api/audit-logs` - Query audit logs

**Configuration**
- `GET /api/tenant/context` - Get tenant configuration

### Example Requests

All requests automatically include:
```http
Authorization: Bearer {{session_token}}
Content-Type: application/json
```

Tenant context is automatically extracted from the session token.

### Testing Workflow

1. **Login**: Run authentication login request to get `session_token`
2. **Set Token**: Token is automatically saved to environment variable
3. **Create Order**: Create a test order
4. **Process Payment**: Process payment for the order
5. **Complete Order**: Mark order as completed
6. **View Dashboard**: Check updated analytics

---

## Migration Notes

### Changes from Pre-Phase 3

#### 1. Endpoint Renaming

| Old Endpoint | New Endpoint | Status |
|--------------|--------------|--------|
| `/api/bookings` | `/api/orders` | ✅ Migrated |
| `/api/bookings/:id` | `/api/orders/:id` | ✅ Migrated |

**Note**: Old `/api/bookings/*` endpoints are deprecated and will be removed in Phase 4.

#### 2. TenantContext Required

**Before Phase 3**:
```javascript
// Had to manually include tenantId
fetch('/api/bookings', {
  method: 'POST',
  body: JSON.stringify({
    tenantId: 'tenant_001',  // ❌ Manual
    customerId: 'cust_123',
    ...
  })
})
```

**After Phase 3**:
```javascript
// TenantContext automatically injected
fetch('/api/orders', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`  // Tenant extracted from token
  },
  body: JSON.stringify({
    // tenantId auto-filled from context ✅
    customerId: 'cust_123',
    ...
  })
})
```

#### 3. Contract Type Responses

**Before Phase 3**:
```json
{
  "id": "booking_123",
  "customer_id": "cust_456",  // snake_case
  "total_amount": 5000000,
  ...
}
```

**After Phase 3**:
```json
{
  "id": "order_123",
  "customerId": "cust_456",  // camelCase
  "totalAmount": 5000000,
  ...
}
```

#### 4. Module Adapter Integration

APIs can now trigger module-specific logic:
- Order creation validates module-specific rules
- Order completion triggers module-specific side effects
- Dashboard widgets include module-specific data

#### 5. Enhanced Error Handling

- Standardized error codes (`AUTH_001`, `ORDER_001`, etc.)
- Better error messages
- Consistent error response format

### Backward Compatibility

- Old `/api/bookings/*` endpoints still work (deprecated)
- Response format is compatible with old clients
- Gradual migration recommended

### Migration Checklist for API Clients

- [ ] Update base URLs from `/api/bookings` to `/api/orders`
- [ ] Remove manual `tenantId` from request bodies
- [ ] Update response field names from `snake_case` to `camelCase`
- [ ] Handle new error codes
- [ ] Test with Postman collection

---

## Support & Resources

### Documentation

- **Architecture**: `docs/architecture/core-platform.md`
- **Module System**: `docs/architecture/module-system.md`
- **Tenant Context**: `docs/architecture/tenant-context.md`
- **Migration Guide**: `docs/migration/phase-3-migration-guide.md`

### Support Channels

- **API Issues**: Slack #api-support
- **Bug Reports**: GitHub Issues
- **Feature Requests**: GitHub Discussions

### Rate Limits & Quotas

| Subscription Plan | Requests/Minute | Requests/Day |
|-------------------|-----------------|--------------|
| Free | 100 | 5,000 |
| Basic | 500 | 25,000 |
| Professional | 2,000 | 100,000 |
| Enterprise | 10,000 | Unlimited |

**Rate Limit Headers**:
```http
X-RateLimit-Limit: 2000
X-RateLimit-Remaining: 1950
X-RateLimit-Reset: 1640000000
```

---

**Document Version**: 1.0  
**Last Updated**: 2025-06-01  
**Status**: Active  
**Maintained By**: Bella ERP Platform Team
