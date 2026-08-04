# Bella Auto Module - API Documentation

**Version:** 1.0.0  
**Last Updated:** 04/08/2026  
**Base Path:** `/api/bella-auto`

---

## Table of Contents

1. [Authentication](#authentication)
2. [Marketplace APIs](#marketplace-apis)
3. [Business Rules APIs](#business-rules-apis)
4. [Rollback & Audit APIs](#rollback--audit-apis)
5. [Transaction Management APIs](#transaction-management-apis)
6. [Error Handling](#error-handling)
7. [Rate Limiting](#rate-limiting)

---

## Authentication

All API endpoints require authentication via Supabase session cookies. Unauthenticated requests will receive a `401 Unauthorized` response.

**Headers Required:**
```
Cookie: sb-access-token=<token>
Cookie: sb-refresh-token=<token>
```

**Tenant Isolation:**
All data is automatically filtered by `tenant_id` from the authenticated user's session. Cross-tenant data access is prevented via Row-Level Security (RLS).

---

## Marketplace APIs

### 1. List Available Capabilities

**Endpoint:** `GET /api/bella-auto/marketplace/capabilities`

**Description:** Retrieves a list of all available capabilities that can be installed in the Bella Auto module.

**Query Parameters:**
- `category` (optional): Filter by capability category (`ai`, `workshop`, `crm`, `analytics`)
- `installed` (optional): Filter by installation status (`true` | `false`)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "cap_ai_demand_forecast",
      "name": "AI Demand Forecasting",
      "description": "Dự đoán nhu cầu mua xe dựa trên ML models",
      "category": "ai",
      "version": "1.2.0",
      "price": 1500000,
      "installed": false,
      "requiredCapabilities": ["cap_customer_journey"],
      "features": [
        "Seasonal trend analysis",
        "Regional demand patterns",
        "Customer segment preferences"
      ]
    }
  ]
}
```

**Status Codes:**
- `200 OK` - Success
- `401 Unauthorized` - Not authenticated
- `500 Internal Server Error` - Server error

---

### 2. Install Capability

**Endpoint:** `POST /api/bella-auto/marketplace/install`

**Description:** Installs a capability into the tenant's Bella Auto module. Requires admin or owner role.

**Request Body:**
```json
{
  "capabilityId": "cap_ai_demand_forecast",
  "autoEnable": true
}
```

**Parameters:**
- `capabilityId` (required, string): The unique ID of the capability to install
- `autoEnable` (optional, boolean): Automatically enable after installation (default: `true`)

**Response:**
```json
{
  "success": true,
  "message": "Capability 'AI Demand Forecasting' installed successfully",
  "data": {
    "capabilityId": "cap_ai_demand_forecast",
    "installedAt": "2026-08-04T10:30:00Z",
    "enabled": true,
    "configRequired": false
  }
}
```

**Status Codes:**
- `201 Created` - Capability installed
- `400 Bad Request` - Invalid capability ID or already installed
- `403 Forbidden` - Insufficient permissions
- `409 Conflict` - Missing required dependencies

---

### 3. Uninstall Capability

**Endpoint:** `DELETE /api/bella-auto/marketplace/uninstall`

**Description:** Removes an installed capability from the tenant's module.

**Request Body:**
```json
{
  "capabilityId": "cap_ai_demand_forecast",
  "force": false
}
```

**Parameters:**
- `capabilityId` (required, string): The capability to uninstall
- `force` (optional, boolean): Force uninstall even if other capabilities depend on it (default: `false`)

**Response:**
```json
{
  "success": true,
  "message": "Capability uninstalled successfully",
  "data": {
    "capabilityId": "cap_ai_demand_forecast",
    "uninstalledAt": "2026-08-04T11:00:00Z"
  }
}
```

**Status Codes:**
- `200 OK` - Uninstalled successfully
- `400 Bad Request` - Capability not found or not installed
- `409 Conflict` - Cannot uninstall due to dependencies

---

## Business Rules APIs

### 4. List Business Rules

**Endpoint:** `GET /api/bella-auto/rules`

**Description:** Retrieves all configured business rules for the tenant's Bella Auto module.

**Query Parameters:**
- `category` (optional): Filter by rule category (`lead_assignment`, `pricing`, `approval`, `workflow`)
- `active` (optional): Filter by active status (`true` | `false`)
- `limit` (optional, number): Number of results per page (default: `50`, max: `200`)
- `offset` (optional, number): Pagination offset (default: `0`)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "rule_001",
      "name": "Smart Lead Assignment",
      "category": "lead_assignment",
      "description": "Phân bổ lead dựa trên conversion rate của agent",
      "conditions": {
        "type": "conversion_rate",
        "operator": "highest",
        "threshold": 0.15
      },
      "actions": [
        {
          "type": "assign_to_agent",
          "agentSelection": "highest_conversion"
        }
      ],
      "priority": 100,
      "active": true,
      "createdAt": "2026-07-15T08:00:00Z",
      "updatedAt": "2026-08-01T14:30:00Z"
    }
  ],
  "pagination": {
    "total": 12,
    "limit": 50,
    "offset": 0,
    "hasMore": false
  }
}
```

**Status Codes:**
- `200 OK` - Success
- `401 Unauthorized` - Not authenticated

---

### 5. Create Business Rule

**Endpoint:** `POST /api/bella-auto/rules`

**Description:** Creates a new business rule.

**Request Body:**
```json
{
  "name": "VIP Customer Auto-Approve",
  "category": "approval",
  "description": "Tự động phê duyệt đơn đặt cọc cho khách VIP",
  "conditions": {
    "type": "customer_segment",
    "operator": "equals",
    "value": "vip"
  },
  "actions": [
    {
      "type": "auto_approve_deposit",
      "skipManualReview": true
    }
  ],
  "priority": 90,
  "active": true
}
```

**Response:**
```json
{
  "success": true,
  "message": "Business rule created successfully",
  "data": {
    "id": "rule_015",
    "name": "VIP Customer Auto-Approve",
    "createdAt": "2026-08-04T12:00:00Z"
  }
}
```

**Status Codes:**
- `201 Created` - Rule created
- `400 Bad Request` - Invalid rule configuration
- `403 Forbidden` - Insufficient permissions

---

### 6. Get Rule Analytics

**Endpoint:** `GET /api/bella-auto/rules/analytics`

**Description:** Retrieves execution analytics for business rules.

**Query Parameters:**
- `ruleId` (optional): Filter by specific rule ID
- `startDate` (optional, ISO 8601): Start date for analytics period
- `endDate` (optional, ISO 8601): End date for analytics period

**Response:**
```json
{
  "success": true,
  "data": {
    "summary": {
      "totalExecutions": 1250,
      "successRate": 0.96,
      "averageExecutionTime": 120,
      "errorCount": 50
    },
    "rulePerformance": [
      {
        "ruleId": "rule_001",
        "ruleName": "Smart Lead Assignment",
        "executions": 450,
        "successRate": 0.98,
        "avgExecutionTime": 95
      }
    ]
  }
}
```

**Status Codes:**
- `200 OK` - Success
- `401 Unauthorized` - Not authenticated

---

## Rollback & Audit APIs

### 7. Get Rollback Audit Trail

**Endpoint:** `GET /api/bella-auto/rollback-audit`

**Description:** Retrieves audit trail of all rollback operations performed in the system.

**Query Parameters:**
- `entityType` (optional): Filter by entity type (`vehicle_delivery`, `trade_in_approval`, `service_completion`, `quotation`, `loan`)
- `entityId` (optional): Filter by specific entity ID
- `userId` (optional): Filter by user who initiated rollback
- `startDate` (optional, ISO 8601): Start date
- `endDate` (optional, ISO 8601): End date
- `limit` (optional, number): Results per page (default: `50`)
- `offset` (optional, number): Pagination offset

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "audit_rb_001",
      "entityType": "vehicle_delivery",
      "entityId": "delivery_xyz123",
      "rollbackType": "full",
      "initiatedBy": "user_admin_01",
      "initiatedAt": "2026-08-03T15:30:00Z",
      "reason": "Khách hàng từ chối nhận xe do lỗi sơn",
      "affectedRecords": [
        {
          "table": "auto_vehicles",
          "recordId": "vehicle_001",
          "action": "status_reverted",
          "before": "delivered",
          "after": "allocated"
        },
        {
          "table": "auto_bookings",
          "recordId": "booking_456",
          "action": "status_reverted",
          "before": "completed",
          "after": "deposit_confirmed"
        }
      ],
      "status": "completed",
      "completedAt": "2026-08-03T15:30:05Z"
    }
  ],
  "pagination": {
    "total": 8,
    "limit": 50,
    "offset": 0
  }
}
```

**Status Codes:**
- `200 OK` - Success
- `401 Unauthorized` - Not authenticated
- `403 Forbidden` - Insufficient permissions (admin only)

---

## Transaction Management APIs

### 8. List Transactions

**Endpoint:** `GET /api/bella-auto/transactions`

**Description:** Retrieves a list of all business transactions (bookings, deliveries, service orders, etc.).

**Query Parameters:**
- `type` (optional): Filter by transaction type (`booking`, `delivery`, `service`, `trade_in`, `loan`)
- `status` (optional): Filter by status (`pending`, `in_progress`, `completed`, `cancelled`, `failed`)
- `customerId` (optional): Filter by customer ID
- `agentId` (optional): Filter by sales agent ID
- `startDate` (optional, ISO 8601)
- `endDate` (optional, ISO 8601)
- `limit` (optional, number): Default `50`, max `200`
- `offset` (optional, number)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "txn_bk_001",
      "type": "booking",
      "referenceNumber": "BK-AUTO-2026-0145",
      "customerId": "cust_012",
      "customerName": "Nguyễn Văn A",
      "vehicleVin": "WBAHF3C01L7D34567",
      "vehicleInfo": "BMW 330i Luxury Line 2026",
      "agentId": "agent_03",
      "agentName": "Lê Thùy Chi",
      "status": "deposit_confirmed",
      "totalAmount": 2439000000,
      "depositAmount": 100000000,
      "createdAt": "2026-08-01T09:00:00Z",
      "updatedAt": "2026-08-02T14:30:00Z"
    }
  ],
  "pagination": {
    "total": 145,
    "limit": 50,
    "offset": 0,
    "hasMore": true
  }
}
```

**Status Codes:**
- `200 OK` - Success
- `401 Unauthorized` - Not authenticated

---

### 9. Get Transaction Details

**Endpoint:** `GET /api/bella-auto/transactions/[id]`

**Description:** Retrieves detailed information about a specific transaction.

**Path Parameters:**
- `id` (required): Transaction ID

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "txn_bk_001",
    "type": "booking",
    "referenceNumber": "BK-AUTO-2026-0145",
    "customer": {
      "id": "cust_012",
      "name": "Nguyễn Văn A",
      "phone": "0901234567",
      "email": "nguyenvana@example.com"
    },
    "vehicle": {
      "vin": "WBAHF3C01L7D34567",
      "brandName": "BMW",
      "modelName": "3 Series",
      "variantName": "330i Luxury Line",
      "colorExterior": "Alpine White",
      "colorInterior": "Black Vernasca",
      "modelYear": 2026
    },
    "agent": {
      "id": "agent_03",
      "name": "Lê Thùy Chi",
      "phone": "0909876543"
    },
    "pricing": {
      "listPrice": 2439000000,
      "discount": 0,
      "finalPrice": 2439000000,
      "depositAmount": 100000000,
      "depositPaidAt": "2026-08-02T14:30:00Z"
    },
    "status": "deposit_confirmed",
    "statusHistory": [
      {
        "status": "draft",
        "timestamp": "2026-08-01T09:00:00Z",
        "changedBy": "agent_03"
      },
      {
        "status": "deposit_pending",
        "timestamp": "2026-08-01T10:15:00Z",
        "changedBy": "agent_03"
      },
      {
        "status": "deposit_confirmed",
        "timestamp": "2026-08-02T14:30:00Z",
        "changedBy": "admin_01"
      }
    ],
    "notes": [
      {
        "id": "note_001",
        "createdBy": "agent_03",
        "createdAt": "2026-08-01T09:05:00Z",
        "content": "Khách hàng quan tâm gói bảo hiểm VIP"
      }
    ],
    "attachments": [
      {
        "id": "att_001",
        "filename": "CMND_front.jpg",
        "fileUrl": "https://cdn.example.com/...",
        "uploadedAt": "2026-08-01T09:10:00Z"
      }
    ],
    "createdAt": "2026-08-01T09:00:00Z",
    "updatedAt": "2026-08-02T14:30:00Z"
  }
}
```

**Status Codes:**
- `200 OK` - Success
- `404 Not Found` - Transaction not found
- `401 Unauthorized` - Not authenticated

---

### 10. Rollback Transaction

**Endpoint:** `POST /api/bella-auto/transactions/[id]/rollback`

**Description:** Initiates a rollback operation for a transaction. This reverses all side effects and state changes.

**Path Parameters:**
- `id` (required): Transaction ID

**Request Body:**
```json
{
  "reason": "Khách hàng hủy đơn do không đủ khả năng thanh toán",
  "rollbackType": "full",
  "notifyCustomer": true,
  "refundDeposit": true
}
```

**Parameters:**
- `reason` (required, string): Reason for rollback (min 10 characters)
- `rollbackType` (optional, enum): `full` | `partial` (default: `full`)
- `notifyCustomer` (optional, boolean): Send notification to customer (default: `true`)
- `refundDeposit` (optional, boolean): Refund deposit amount (default: `false`)

**Response:**
```json
{
  "success": true,
  "message": "Transaction rollback initiated successfully",
  "data": {
    "rollbackId": "rb_001",
    "transactionId": "txn_bk_001",
    "status": "completed",
    "affectedRecords": 5,
    "refundAmount": 100000000,
    "initiatedAt": "2026-08-04T16:00:00Z",
    "completedAt": "2026-08-04T16:00:03Z"
  }
}
```

**Status Codes:**
- `200 OK` - Rollback completed
- `202 Accepted` - Rollback initiated (async processing)
- `400 Bad Request` - Transaction cannot be rolled back (e.g., already delivered)
- `404 Not Found` - Transaction not found
- `403 Forbidden` - Insufficient permissions

---

## Error Handling

All API errors follow a consistent format:

```json
{
  "success": false,
  "error": {
    "code": "INVALID_CAPABILITY_ID",
    "message": "The specified capability ID does not exist",
    "details": {
      "capabilityId": "cap_invalid_xyz",
      "validIds": ["cap_ai_demand_forecast", "cap_workshop_scheduler"]
    }
  }
}
```

**Common Error Codes:**
- `UNAUTHORIZED` - Authentication required
- `FORBIDDEN` - Insufficient permissions
- `NOT_FOUND` - Resource not found
- `VALIDATION_ERROR` - Invalid request parameters
- `CONFLICT` - Resource conflict (e.g., duplicate, dependency issue)
- `INTERNAL_ERROR` - Server error

---

## Rate Limiting

API requests are rate-limited per tenant:

- **Standard Tier:** 100 requests/minute
- **Premium Tier:** 500 requests/minute
- **Enterprise Tier:** Unlimited

Rate limit headers are included in all responses:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1722787200
```

When rate limit is exceeded, API returns `429 Too Many Requests`:

```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests. Please retry after 60 seconds.",
    "retryAfter": 60
  }
}
```

---

## Changelog

### Version 1.0.0 (04/08/2026)
- Initial API documentation
- 10 endpoints documented
- Added Marketplace, Rules, Rollback, Transaction APIs

---

**Contact:** Bella ERP Development Team  
**Support:** support@bella-erp.vn  
**Documentation Home:** `/docs/bella-auto/`
