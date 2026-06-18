# API Reference - Bella Spa ERP v1

Complete reference for all Bella API endpoints.

**Base URL**: `https://bella-spa-erp.vercel.app/api/v1`  
**Version**: v1 (stable)  
**Last Updated**: 2026-06-18

---

## 📋 Table of Contents

1. [Authentication](#authentication)
2. [Orders API](#orders-api)
3. [Payments API](#payments-api)
4. [Customers API](#customers-api)
5. [Products API](#products-api)
6. [Webhooks API](#webhooks-api)
7. [Common Parameters](#common-parameters)
8. [Error Codes](#error-codes)

---

## 🔐 Authentication

All API requests require authentication using an API key in the `Authorization` header.

### Header Format

```
Authorization: Bearer pk_live_abc123xyz789...
```

### API Key Types

| Type | Format | Environment | Usage |
|------|--------|-------------|-------|
| **Test** | `pk_test_...` | Sandbox | Development & testing |
| **Live** | `pk_live_...` | Production | Real transactions |

### Required Scopes

Each endpoint requires specific permission scopes. Your API key must have the required scope(s) to access the endpoint.

**Example Scopes**:
- `order:read` - View orders
- `order:write` - Create/update orders
- `payment:read` - View payments
- `payment:write` - Process payments
- `customer:read` - View customer data
- `customer:write` - Create/update customers

---

## 🛒 Orders API

Manage customer orders, bookings, and appointments.

### Create Order

Create a new order for a customer.

**Endpoint**: `POST /api/v1/orders`

**Required Scope**: `order:write`

**Request Headers**:
```
Authorization: Bearer pk_live_abc123xyz789...
Content-Type: application/json
Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000
```

**Request Body**:
```json
{
  "customer_id": "cus_abc123",
  "items": [
    {
      "product_id": "prod_xyz789",
      "quantity": 1,
      "price": 500000,
      "notes": "Yêu cầu kỹ thuật viên nữ"
    }
  ],
  "discount_code": "SUMMER2026",
  "notes": "Khách hàng VIP, ưu tiên phục vụ",
  "scheduled_at": "2026-06-20T14:00:00Z"
}
```

**Request Parameters**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `customer_id` | string (UUID) | ✅ Yes | Customer identifier |
| `items` | array | ✅ Yes | Order line items (min 1) |
| `items[].product_id` | string (UUID) | ✅ Yes | Product/service identifier |
| `items[].quantity` | integer | ✅ Yes | Quantity (min 1) |
| `items[].price` | integer | ❌ No | Override price (in VND) |
| `items[].notes` | string | ❌ No | Line item notes (max 500 chars) |
| `discount_code` | string | ❌ No | Discount/promo code |
| `notes` | string | ❌ No | Order notes (max 1000 chars) |
| `scheduled_at` | string (ISO 8601) | ❌ No | Appointment time |

**Success Response** (201 Created):
```json
{
  "success": true,
  "data": {
    "id": "ord_abc123",
    "customer_id": "cus_abc123",
    "tenant_id": "ten_xyz789",
    "status": "pending",
    "subtotal": 500000,
    "discount": 50000,
    "total": 450000,
    "currency": "VND",
    "items": [
      {
        "id": "item_001",
        "product_id": "prod_xyz789",
        "product_name": "Massage Mẹ Bầu",
        "quantity": 1,
        "unit_price": 500000,
        "subtotal": 500000
      }
    ],
    "scheduled_at": "2026-06-20T14:00:00Z",
    "created_at": "2026-06-18T10:30:00Z",
    "updated_at": "2026-06-18T10:30:00Z"
  },
  "meta": {
    "request_id": "req_def456",
    "timestamp": "2026-06-18T10:30:01Z",
    "version": "v1"
  }
}
```

**Error Responses**:

| Status | Code | Description |
|--------|------|-------------|
| 400 | `INVALID_INPUT` | Validation failed (check `error.details`) |
| 401 | `INVALID_API_KEY` | API key is invalid or inactive |
| 403 | `INSUFFICIENT_PERMISSIONS` | Missing required scope `order:write` |
| 404 | `RESOURCE_NOT_FOUND` | Customer or product not found |
| 409 | `IDEMPOTENCY_CONFLICT` | Duplicate idempotency key with different payload |
| 429 | `RATE_LIMIT_EXCEEDED` | Too many requests |

**Example Code**:

```typescript
// TypeScript/JavaScript
async function createOrder(customerId: string, items: OrderItem[]) {
  const response = await fetch('https://bella-spa-erp.vercel.app/api/v1/orders', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${BELLA_API_KEY}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': crypto.randomUUID(),
    },
    body: JSON.stringify({
      customer_id: customerId,
      items: items,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error.message);
  }

  return await response.json();
}
```

```python
# Python
import requests
import uuid

def create_order(customer_id, items):
    response = requests.post(
        'https://bella-spa-erp.vercel.app/api/v1/orders',
        headers={
            'Authorization': f'Bearer {BELLA_API_KEY}',
            'Content-Type': 'application/json',
            'Idempotency-Key': str(uuid.uuid4()),
        },
        json={
            'customer_id': customer_id,
            'items': items,
        }
    )
    
    response.raise_for_status()
    return response.json()
```

---

### Get Order

Retrieve details of a specific order.

**Endpoint**: `GET /api/v1/orders/{order_id}`

**Required Scope**: `order:read`

**Path Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `order_id` | string (UUID) | Order identifier |

**Success Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "id": "ord_abc123",
    "customer_id": "cus_abc123",
    "customer": {
      "id": "cus_abc123",
      "name": "Nguyễn Thị A",
      "phone": "0901234567",
      "email": "customer@example.com"
    },
    "status": "completed",
    "subtotal": 500000,
    "discount": 50000,
    "total": 450000,
    "currency": "VND",
    "items": [...],
    "payment_status": "paid",
    "scheduled_at": "2026-06-20T14:00:00Z",
    "completed_at": "2026-06-20T15:30:00Z",
    "created_at": "2026-06-18T10:30:00Z",
    "updated_at": "2026-06-20T15:30:00Z"
  },
  "meta": {
    "request_id": "req_ghi789",
    "timestamp": "2026-06-18T10:35:00Z",
    "version": "v1"
  }
}
```

**Order Statuses**:

| Status | Description |
|--------|-------------|
| `pending` | Order created, waiting for confirmation |
| `confirmed` | Order confirmed, scheduled |
| `in_progress` | Service being performed |
| `completed` | Service completed successfully |
| `cancelled` | Order cancelled |
| `no_show` | Customer didn't show up |

---

### List Orders

Retrieve a paginated list of orders.

**Endpoint**: `GET /api/v1/orders`

**Required Scope**: `order:read`

**Query Parameters**:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | integer | 1 | Page number (min 1) |
| `per_page` | integer | 20 | Items per page (max 100) |
| `status` | string | - | Filter by status |
| `customer_id` | string (UUID) | - | Filter by customer |
| `from_date` | string (ISO 8601) | - | Filter orders created after |
| `to_date` | string (ISO 8601) | - | Filter orders created before |
| `sort` | string | `-created_at` | Sort field (prefix `-` for desc) |

**Success Response** (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "id": "ord_001",
      "customer_id": "cus_001",
      "status": "completed",
      "total": 450000,
      "created_at": "2026-06-18T10:30:00Z"
    },
    {
      "id": "ord_002",
      "customer_id": "cus_002",
      "status": "pending",
      "total": 800000,
      "created_at": "2026-06-18T11:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "per_page": 20,
    "total": 150,
    "total_pages": 8,
    "next": "/api/v1/orders?page=2",
    "prev": null,
    "self": "/api/v1/orders?page=1"
  },
  "meta": {
    "request_id": "req_jkl012",
    "timestamp": "2026-06-18T10:40:00Z",
    "version": "v1"
  }
}
```

---

### Update Order

Update an existing order (partial update).

**Endpoint**: `PATCH /api/v1/orders/{order_id}`

**Required Scope**: `order:write`

**Request Body**:
```json
{
  "status": "confirmed",
  "scheduled_at": "2026-06-21T10:00:00Z",
  "notes": "Updated appointment time"
}
```

**Allowed Updates**:
- `status` - Change order status
- `scheduled_at` - Reschedule appointment
- `notes` - Update order notes

**Restrictions**:
- Cannot update `items` after order is confirmed
- Cannot change `total` or `subtotal` directly
- Cannot update `customer_id`

---

### Cancel Order

Cancel an existing order.

**Endpoint**: `DELETE /api/v1/orders/{order_id}`

**Required Scope**: `order:write`

**Query Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `reason` | string | ❌ No | Cancellation reason |

**Success Response** (204 No Content):
- No response body
- Order status set to `cancelled`

**Restrictions**:
- Cannot cancel orders with status `completed`
- Cannot cancel orders with payment status `paid` (must refund first)

---

## 💳 Payments API

Process and manage payments for orders.

### Create Payment

Record a payment for an order.

**Endpoint**: `POST /api/v1/payments`

**Required Scope**: `payment:write`

**Request Body**:
```json
{
  "order_id": "ord_abc123",
  "amount": 450000,
  "payment_method": "credit_card",
  "payment_provider": "momo",
  "transaction_id": "txn_xyz789",
  "notes": "Thanh toán qua MoMo"
}
```

**Request Parameters**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `order_id` | string (UUID) | ✅ Yes | Order identifier |
| `amount` | integer | ✅ Yes | Payment amount (in VND) |
| `payment_method` | string | ✅ Yes | Payment method (see options below) |
| `payment_provider` | string | ❌ No | Payment provider/gateway |
| `transaction_id` | string | ❌ No | External transaction ID |
| `notes` | string | ❌ No | Payment notes (max 500 chars) |

**Payment Methods**:
- `cash` - Cash payment
- `credit_card` - Credit/debit card
- `bank_transfer` - Bank transfer
- `momo` - MoMo wallet
- `zalopay` - ZaloPay wallet
- `vnpay` - VNPay gateway

**Success Response** (201 Created):
```json
{
  "success": true,
  "data": {
    "id": "pay_abc123",
    "order_id": "ord_abc123",
    "amount": 450000,
    "currency": "VND",
    "payment_method": "momo",
    "payment_provider": "momo",
    "status": "completed",
    "transaction_id": "txn_xyz789",
    "created_at": "2026-06-18T10:45:00Z"
  },
  "meta": {
    "request_id": "req_mno345",
    "timestamp": "2026-06-18T10:45:01Z",
    "version": "v1"
  }
}
```

---

### List Payments

Retrieve a paginated list of payments.

**Endpoint**: `GET /api/v1/payments`

**Required Scope**: `payment:read`

**Query Parameters**: Same as List Orders (page, per_page, from_date, to_date, sort)

Additional filters:
- `order_id` - Filter by order
- `status` - Filter by payment status (pending, completed, failed, refunded)
- `payment_method` - Filter by payment method

---

## 👥 Customers API

Manage customer information and profiles.

### Create Customer

Create a new customer profile.

**Endpoint**: `POST /api/v1/customers`

**Required Scope**: `customer:write`

**Request Body**:
```json
{
  "name": "Nguyễn Thị A",
  "phone": "0901234567",
  "email": "customer@example.com",
  "date_of_birth": "1990-01-15",
  "gender": "female",
  "address": {
    "street": "123 Nguyễn Huệ",
    "district": "Quận 1",
    "city": "TP. Hồ Chí Minh",
    "postal_code": "700000"
  },
  "notes": "Khách hàng VIP"
}
```

**Success Response** (201 Created):
```json
{
  "success": true,
  "data": {
    "id": "cus_abc123",
    "name": "Nguyễn Thị A",
    "phone": "0901234567",
    "email": "customer@example.com",
    "date_of_birth": "1990-01-15",
    "gender": "female",
    "address": {...},
    "total_orders": 0,
    "total_spent": 0,
    "created_at": "2026-06-18T11:00:00Z"
  },
  "meta": {...}
}
```

---

### Get Customer

Retrieve customer details.

**Endpoint**: `GET /api/v1/customers/{customer_id}`

**Required Scope**: `customer:read`

---

### List Customers

Retrieve a paginated list of customers.

**Endpoint**: `GET /api/v1/customers`

**Required Scope**: `customer:read`

**Query Parameters**:
- `page`, `per_page`, `sort` (standard pagination)
- `search` - Search by name, phone, or email
- `from_date`, `to_date` - Filter by registration date

---

## 📦 Products API

Manage products and services catalog.

### List Products

Retrieve available products and services.

**Endpoint**: `GET /api/v1/products`

**Required Scope**: `product:read`

**Query Parameters**:
- `page`, `per_page`, `sort` (standard pagination)
- `category` - Filter by category
- `is_active` - Filter active products only
- `search` - Search by name or SKU

**Success Response** (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "id": "prod_xyz789",
      "name": "Massage Mẹ Bầu",
      "description": "Massage thư giãn cho mẹ bầu",
      "category": "spa_service",
      "price": 500000,
      "currency": "VND",
      "duration_minutes": 60,
      "is_active": true,
      "image_url": "https://cdn.bellaspa.vn/products/massage-me-bau.jpg"
    }
  ],
  "pagination": {...},
  "meta": {...}
}
```

---

## 🔔 Webhooks API

Subscribe to real-time events from Bella.

### Subscribe to Webhook

Register a webhook endpoint to receive events.

**Endpoint**: `POST /api/v1/webhooks`

**Required Scope**: `webhook:write`

**Request Body**:
```json
{
  "url": "https://your-domain.com/webhooks/bella",
  "events": [
    "order.created",
    "order.completed",
    "payment.completed"
  ],
  "secret": "whsec_abc123xyz789..."
}
```

**Available Events**:
- `order.created` - New order created
- `order.updated` - Order status changed
- `order.completed` - Order completed
- `order.cancelled` - Order cancelled
- `payment.completed` - Payment successful
- `payment.failed` - Payment failed
- `customer.created` - New customer registered
- `customer.updated` - Customer info updated

**Webhook Payload Example**:
```json
{
  "id": "evt_abc123",
  "type": "order.completed",
  "created_at": "2026-06-18T12:00:00Z",
  "data": {
    "object": "order",
    "id": "ord_abc123",
    "customer_id": "cus_abc123",
    "status": "completed",
    "total": 450000
  }
}
```

**Webhook Signature Verification**:
```typescript
import crypto from 'crypto';

function verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
    
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

// Usage in webhook handler
app.post('/webhooks/bella', (req, res) => {
  const signature = req.headers['x-bella-signature'];
  const payload = JSON.stringify(req.body);
  
  if (!verifyWebhookSignature(payload, signature, WEBHOOK_SECRET)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }
  
  // Process webhook
  const event = req.body;
  console.log('Received event:', event.type);
  
  res.status(200).json({ received: true });
});
```

---

## 🔧 Common Parameters

### Pagination

All list endpoints support pagination:

| Parameter | Type | Default | Max | Description |
|-----------|------|---------|-----|-------------|
| `page` | integer | 1 | - | Page number (1-indexed) |
| `per_page` | integer | 20 | 100 | Items per page |

### Sorting

Use `sort` parameter with field name:
- `created_at` - Ascending
- `-created_at` - Descending (prefix with `-`)

**Examples**:
- `?sort=total` - Sort by total (low to high)
- `?sort=-created_at` - Sort by creation date (newest first)

### Date Filtering

Use ISO 8601 format:
- `from_date=2026-06-01T00:00:00Z`
- `to_date=2026-06-30T23:59:59Z`

### Expanding Relations

Use `expand` parameter to include related objects:
- `?expand=customer` - Include customer details in order
- `?expand=items.product` - Include product details in order items
- `?expand=customer,payments` - Multiple expansions (comma-separated)

---

## ⚠️ Error Codes

Complete list of error codes returned by the API.

| Code | HTTP Status | Description | Action |
|------|-------------|-------------|--------|
| `INVALID_API_KEY` | 401 | API key not found or inactive | Check API key |
| `INSUFFICIENT_PERMISSIONS` | 403 | Missing required scope | Request scope from admin |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests | Wait and retry |
| `INVALID_INPUT` | 400 | Validation failed | Check request body |
| `RESOURCE_NOT_FOUND` | 404 | Resource doesn't exist | Check resource ID |
| `TENANT_MISMATCH` | 403 | Attempted tenant injection | Remove tenant_id from request |
| `IDEMPOTENCY_CONFLICT` | 409 | Duplicate idempotency key | Use new idempotency key |
| `INTERNAL_ERROR` | 500 | Server error | Retry or contact support |
| `SERVICE_UNAVAILABLE` | 503 | Service temporarily unavailable | Retry after delay |

### Error Response Format

```json
{
  "success": false,
  "error": {
    "code": "INVALID_INPUT",
    "message": "Validation failed",
    "details": {
      "fields": [
        {
          "field": "customer_id",
          "message": "Invalid UUID format",
          "code": "invalid_format"
        }
      ]
    }
  },
  "meta": {
    "request_id": "req_abc123",
    "timestamp": "2026-06-18T12:00:00Z",
    "version": "v1"
  }
}
```

---

## 📊 Response Headers

All responses include these headers:

| Header | Description | Example |
|--------|-------------|---------|
| `X-Request-ID` | Unique request identifier | `req_abc123` |
| `X-RateLimit-Limit` | Rate limit per minute | `300` |
| `X-RateLimit-Remaining` | Remaining requests | `250` |
| `X-RateLimit-Reset` | Reset timestamp (Unix) | `1718611200` |
| `X-Environment` | Environment (sandbox/production) | `production` |
| `X-API-Version` | API version | `v1` |

---

## 🔗 Related Documentation

- [Getting Started Guide](./GETTING_STARTED.md)
- [Authentication Guide](./AUTHENTICATION.md)
- [Webhooks Guide](./WEBHOOKS.md)
- [Error Handling](./ERROR_HANDLING.md)
- [Best Practices](./BEST_PRACTICES.md)
- [Changelog](./CHANGELOG.md)

---

**Document Version**: 1.0.0  
**Last Updated**: 2026-06-18  
**API Version**: v1

For questions or feedback: api-support@bellaspa.vn
