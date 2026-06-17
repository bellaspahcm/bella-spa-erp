# Bella API Response Format

**Version**: v1  
**Last Updated**: 2026-06-17  
**Status**: ✅ Stable

---

## Overview

All Bella API endpoints return responses in a standardized JSON format to ensure consistency and predictability for partners.

### Key Features

- ✅ **Consistent structure** across all endpoints
- ✅ **Metadata** with request ID, timestamp, and version
- ✅ **Pagination support** for list endpoints
- ✅ **Rate limit headers** in every response
- ✅ **Error details** with actionable messages
- ✅ **HATEOAS links** for navigation (optional)
- ✅ **Deprecation warnings** for sunset endpoints
- ✅ **Security headers** by default

---

## Success Response Format

All successful API responses follow this structure:

```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "request_id": "req_abc123",
    "timestamp": "2026-06-17T10:30:00Z",
    "version": "v1"
  }
}
```

### Fields

| Field | Type | Description |
|-------|------|-------------|
| `success` | `boolean` | Always `true` for successful responses |
| `data` | `object \| array` | Response payload (structure varies by endpoint) |
| `meta` | `object` | Response metadata |


### Metadata Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `request_id` | `string` | ✅ | Unique identifier for this request (for support/debugging) |
| `timestamp` | `string` | ✅ | ISO 8601 timestamp when the response was generated |
| `version` | `string` | ✅ | API version (e.g., `"v1"`) |
| `rate_limit` | `object` | ⬜ | Rate limit info (see below) |
| `deprecation` | `object` | ⬜ | Deprecation warning (see below) |
| `links` | `object` | ⬜ | HATEOAS navigation links (see below) |

---

## Paginated Response Format

List endpoints return paginated responses:

```json
{
  "success": true,
  "data": [ ... ],
  "pagination": {
    "page": 1,
    "per_page": 20,
    "total": 150,
    "total_pages": 8
  },
  "meta": {
    "request_id": "req_abc123",
    "timestamp": "2026-06-17T10:30:00Z",
    "version": "v1",
    "links": {
      "self": "https://api.bella.vn/v1/orders?page=1&per_page=20",
      "next": "https://api.bella.vn/v1/orders?page=2&per_page=20"
    }
  }
}
```


### Pagination Fields

| Field | Type | Description |
|-------|------|-------------|
| `page` | `number` | Current page number (1-indexed) |
| `per_page` | `number` | Number of items per page |
| `total` | `number` | Total number of items across all pages |
| `total_pages` | `number` | Total number of pages |

### Pagination Links

| Link | Description |
|------|-------------|
| `self` | URL of the current page |
| `next` | URL of the next page (omitted if on last page) |
| `prev` | URL of the previous page (omitted if on first page) |

**Example usage**:
```typescript
let currentPage = 1;
while (currentPage <= response.pagination.total_pages) {
  const response = await fetch(`/api/v1/orders?page=${currentPage}&per_page=20`);
  const json = await response.json();
  
  // Process json.data
  
  currentPage++;
}
```

---

## Error Response Format

All error responses follow this structure:

```json
{
  "success": false,
  "error": {
    "code": "INVALID_INPUT",
    "message": "Validation failed",
    "details": { ... }
  },
  "meta": {
    "request_id": "req_abc123",
    "timestamp": "2026-06-17T10:30:00Z",
    "version": "v1"
  }
}
```


### Error Fields

| Field | Type | Description |
|-------|------|-------------|
| `code` | `string` | Error code (see Error Codes section below) |
| `message` | `string` | Human-readable error message |
| `details` | `object \| array` | Additional error details (structure varies by error type) |
| `field_errors` | `array` | Field-level validation errors (422 responses only) |

### Field Validation Errors (422)

When validation fails, the error response includes field-level details:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": {
      "field_errors": [
        {
          "field": "email",
          "message": "Invalid email format",
          "code": "INVALID_FORMAT"
        },
        {
          "field": "phone",
          "message": "Phone number is required",
          "code": "REQUIRED_FIELD"
        }
      ]
    }
  },
  "meta": { ... }
}
```


---

## Error Codes

| HTTP Status | Error Code | Description | Retry? |
|-------------|------------|-------------|--------|
| 400 | `INVALID_INPUT` | Request validation failed (malformed JSON, missing fields) | ❌ No |
| 401 | `UNAUTHORIZED` | Invalid or missing API key | ❌ No |
| 401 | `INVALID_API_KEY` | API key not found or expired | ❌ No |
| 403 | `FORBIDDEN` | Valid API key but missing required scope | ❌ No |
| 403 | `INSUFFICIENT_PERMISSIONS` | Partner lacks permission for this operation | ❌ No |
| 403 | `TENANT_MISMATCH` | Attempted tenant injection attack (security violation) | ❌ No |
| 404 | `NOT_FOUND` | Resource does not exist | ❌ No |
| 409 | `CONFLICT` | Resource conflict (e.g., duplicate idempotency key with different payload) | ❌ No |
| 422 | `VALIDATION_ERROR` | Field-level validation failed | ❌ No |
| 429 | `RATE_LIMIT_EXCEEDED` | Too many requests | ✅ Yes (after Retry-After seconds) |
| 500 | `INTERNAL_ERROR` | Server error | ✅ Yes (with exponential backoff) |
| 503 | `SERVICE_UNAVAILABLE` | Service temporarily unavailable (maintenance) | ✅ Yes (after Retry-After seconds) |

### Example Error Responses

**400 Bad Request**:
```json
{
  "success": false,
  "error": {
    "code": "INVALID_INPUT",
    "message": "Request body must be valid JSON"
  },
  "meta": { ... }
}
```


**401 Unauthorized**:
```json
{
  "success": false,
  "error": {
    "code": "INVALID_API_KEY",
    "message": "API key not found or expired"
  },
  "meta": { ... }
}
```

**403 Forbidden (Missing Scope)**:
```json
{
  "success": false,
  "error": {
    "code": "INSUFFICIENT_PERMISSIONS",
    "message": "Missing required scope: order:write"
  },
  "meta": { ... }
}
```

**403 Forbidden (Tenant Injection)**:
```json
{
  "success": false,
  "error": {
    "code": "TENANT_MISMATCH",
    "message": "Tenant injection detected",
    "details": {
      "attempted_tenant": "other_tenant_id"
    }
  },
  "meta": { ... }
}
```

**404 Not Found**:
```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Order not found"
  },
  "meta": { ... }
}
```


**409 Conflict (Idempotency)**:
```json
{
  "success": false,
  "error": {
    "code": "CONFLICT",
    "message": "Idempotency key already used with different payload",
    "details": {
      "idempotency_key": "idem_abc123",
      "existing_resource_id": "order_789"
    }
  },
  "meta": { ... }
}
```

**429 Rate Limit Exceeded**:
```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded. Please retry after 60 seconds.",
    "details": {
      "retry_after": 60
    }
  },
  "meta": { ... }
}
```
**HTTP Headers**: `Retry-After: 60`

**500 Internal Server Error**:
```json
{
  "success": false,
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "An unexpected error occurred"
  },
  "meta": { ... }
}
```

**503 Service Unavailable**:
```json
{
  "success": false,
  "error": {
    "code": "SERVICE_UNAVAILABLE",
    "message": "Service temporarily unavailable",
    "details": {
      "retry_after": 300
    }
  },
  "meta": { ... }
}
```
**HTTP Headers**: `Retry-After: 300`

---

## Response Headers

All API responses include these standard headers:

### Security Headers

| Header | Value | Purpose |
|--------|-------|---------|
| `Content-Type` | `application/json` | Response content type |
| `X-Content-Type-Options` | `nosniff` | Prevent MIME type sniffing |
| `X-Frame-Options` | `DENY` | Prevent clickjacking attacks |
| `X-XSS-Protection` | `1; mode=block` | Enable browser XSS protection |

### Rate Limit Headers

| Header | Example | Description |
|--------|---------|-------------|
| `X-RateLimit-Limit` | `300` | Maximum requests per minute for your tier |
| `X-RateLimit-Remaining` | `250` | Remaining requests in current window |
| `X-RateLimit-Reset` | `1718611200` | Unix timestamp when rate limit resets |
| `X-RateLimit-Mode` | `normal` | Rate limit mode (`normal` or `degraded`) |

**Note**: When `X-RateLimit-Mode: degraded`, the rate limit is reduced to 50% (Redis unavailable).

### Deprecation Headers (if endpoint is deprecated)

| Header | Example | Description |
|--------|---------|-------------|
| `Deprecation` | `true` | Indicates endpoint is deprecated |
| `Sunset` | `2027-01-01` | Date when endpoint will be removed |
| `Link` | `</api/v2/orders>; rel="successor-version"` | Replacement endpoint URL |


### Other Headers

| Header | Example | Description |
|--------|---------|-------------|
| `Location` | `/api/v1/orders/123` | URL of newly created resource (201 responses only) |
| `Retry-After` | `60` | Seconds to wait before retrying (429, 503 responses) |

---

## Rate Limit Information

The `meta.rate_limit` object in responses provides real-time rate limit info:

```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "request_id": "req_abc123",
    "timestamp": "2026-06-17T10:30:00Z",
    "version": "v1",
    "rate_limit": {
      "limit": "300",
      "remaining": "250",
      "reset": "1718611200",
      "mode": "normal"
    }
  }
}
```

### Fields

| Field | Type | Description |
|-------|------|-------------|
| `limit` | `string` | Maximum requests per minute |
| `remaining` | `string` | Remaining requests in current window |
| `reset` | `string` | Unix timestamp when limit resets |
| `mode` | `string` | `"normal"` or `"degraded"` (50% reduced limits) |


### Rate Limit Tiers

| Tier | Requests/Minute | Requests/Day |
|------|-----------------|--------------|
| **Free** | 60 | 1,000 |
| **Basic** | 300 | 10,000 |
| **Pro** | 1,000 | 100,000 |
| **Enterprise** | 5,000 | 1,000,000 |
| **Unlimited** | ∞ | ∞ |

**Best Practice**: Monitor `remaining` and throttle your requests when approaching the limit to avoid 429 errors.

---

## Deprecation Warnings

When an endpoint is scheduled for removal, responses include deprecation metadata:

```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "request_id": "req_abc123",
    "timestamp": "2026-06-17T10:30:00Z",
    "version": "v1",
    "deprecation": {
      "message": "This endpoint is deprecated and will be removed on 2027-01-01",
      "sunset_date": "2027-01-01",
      "replacement_endpoint": "/api/v2/orders",
      "documentation_url": "https://docs.bella.vn/migration-guide"
    }
  }
}
```

### Fields

| Field | Type | Description |
|-------|------|-------------|
| `message` | `string` | Deprecation notice |
| `sunset_date` | `string` | ISO 8601 date when endpoint will be removed |
| `replacement_endpoint` | `string` | URL of replacement endpoint |
| `documentation_url` | `string` | Migration guide URL |


**Action Required**: When you see a deprecation warning:
1. Review the migration guide
2. Update your integration to use the replacement endpoint
3. Test in sandbox before migrating production
4. Complete migration before the sunset date

---

## HATEOAS Links

Some responses include navigation links (HATEOAS - Hypermedia as the Engine of Application State):

```json
{
  "success": true,
  "data": {
    "id": "order_123",
    "customer_id": "cust_456",
    "status": "completed"
  },
  "meta": {
    "request_id": "req_abc123",
    "timestamp": "2026-06-17T10:30:00Z",
    "version": "v1",
    "links": {
      "self": "/api/v1/orders/order_123",
      "related": {
        "customer": "/api/v1/customers/cust_456",
        "payments": "/api/v1/orders/order_123/payments",
        "invoices": "/api/v1/orders/order_123/invoices"
      }
    }
  }
}
```

### Link Types

| Link | Description |
|------|-------------|
| `self` | URL of the current resource |
| `next` | Next page (pagination) |
| `prev` | Previous page (pagination) |
| `related` | URLs of related resources |


---

## HTTP Status Codes

Bella API uses standard HTTP status codes:

### Success Codes (2xx)

| Code | Name | Usage |
|------|------|-------|
| 200 | OK | Successful GET, PATCH, DELETE requests |
| 201 | Created | Successful POST request (resource created) |
| 202 | Accepted | Async operation accepted (processing in background) |
| 204 | No Content | Successful DELETE request (no response body) |

### Client Error Codes (4xx)

| Code | Name | Usage |
|------|------|-------|
| 400 | Bad Request | Malformed request (invalid JSON, missing Content-Type) |
| 401 | Unauthorized | Missing or invalid API key |
| 403 | Forbidden | Valid API key but insufficient permissions |
| 404 | Not Found | Resource does not exist |
| 409 | Conflict | Resource conflict (e.g., idempotency key collision) |
| 422 | Unprocessable Entity | Validation failed (field-level errors) |
| 429 | Too Many Requests | Rate limit exceeded |

### Server Error Codes (5xx)

| Code | Name | Usage |
|------|------|-------|
| 500 | Internal Server Error | Unexpected server error |
| 503 | Service Unavailable | Temporary downtime (maintenance) |


---

## Best Practices

### 1. Always Check `success` Field

Never assume a 200 status means success. Always check the `success` field:

```typescript
const response = await fetch('/api/v1/orders', {
  headers: { 'X-API-Key': 'pk_live_...' }
});

const json = await response.json();

if (!json.success) {
  console.error('Error:', json.error.code, json.error.message);
  return;
}

// Process json.data
```

### 2. Use `request_id` for Support

When reporting issues, always include the `request_id` from the response:

```typescript
if (!json.success) {
  console.error(`API Error [${json.meta.request_id}]:`, json.error);
  // Send request_id to support team
}
```

### 3. Handle Rate Limits Gracefully

Monitor `rate_limit.remaining` and throttle requests when approaching limit:

```typescript
const rateLimitRemaining = parseInt(json.meta.rate_limit.remaining);

if (rateLimitRemaining < 10) {
  console.warn('Approaching rate limit, throttling requests...');
  await sleep(1000); // Wait 1 second
}
```


### 4. Implement Retry Logic

For 429 and 5xx errors, implement exponential backoff:

```typescript
async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const response = await fetch(url, options);
    const json = await response.json();

    // Success
    if (json.success) {
      return json;
    }

    // Rate limit or server error
    if (response.status === 429 || response.status >= 500) {
      const retryAfter = parseInt(response.headers.get('Retry-After') || '0');
      const delay = retryAfter > 0 
        ? retryAfter * 1000 
        : Math.pow(2, attempt) * 1000; // Exponential backoff

      console.warn(`Retry ${attempt}/${maxRetries} after ${delay}ms`);
      await sleep(delay);
      continue;
    }

    // Client error (4xx) - don't retry
    throw new Error(`API Error: ${json.error.code} - ${json.error.message}`);
  }

  throw new Error('Max retries exceeded');
}
```

### 5. Handle Field Validation Errors

For 422 responses, display field-level errors to users:

```typescript
if (!json.success && json.error.code === 'VALIDATION_ERROR') {
  const fieldErrors = json.error.details.field_errors;
  
  fieldErrors.forEach(err => {
    console.error(`${err.field}: ${err.message}`);
    // Show error next to form field in UI
  });
}
```


### 6. Monitor Deprecation Warnings

Check for deprecation metadata and plan migrations:

```typescript
if (json.meta.deprecation) {
  console.warn('Deprecation Warning:', json.meta.deprecation.message);
  console.warn('Sunset Date:', json.meta.deprecation.sunset_date);
  console.warn('Replacement:', json.meta.deprecation.replacement_endpoint);
  console.warn('Migration Guide:', json.meta.deprecation.documentation_url);
  
  // Log to monitoring system for visibility
}
```

### 7. Use HATEOAS Links

Navigate related resources using provided links instead of hardcoding URLs:

```typescript
// ❌ Don't hardcode URLs
const customerUrl = `/api/v1/customers/${order.customer_id}`;

// ✅ Use HATEOAS links
const customerUrl = json.meta.links.related.customer;
const customer = await fetch(customerUrl, { headers });
```

---

## Examples

### Example 1: Successful Order Creation (201)

**Request**:
```http
POST /api/v1/orders HTTP/1.1
Host: api.bella.vn
X-API-Key: pk_live_abc123
Content-Type: application/json

{
  "customer_id": "cust_456",
  "items": [
    { "product_id": "prod_789", "quantity": 2 }
  ],
  "idempotency_key": "idem_unique_123"
}
```


**Response**:
```http
HTTP/1.1 201 Created
Content-Type: application/json
Location: /api/v1/orders/order_123
X-RateLimit-Limit: 300
X-RateLimit-Remaining: 250
X-RateLimit-Reset: 1718611200
X-Content-Type-Options: nosniff
X-Frame-Options: DENY

{
  "success": true,
  "data": {
    "id": "order_123",
    "customer_id": "cust_456",
    "status": "pending",
    "total": 200000,
    "created_at": "2026-06-17T10:30:00Z"
  },
  "meta": {
    "request_id": "req_abc123",
    "timestamp": "2026-06-17T10:30:00Z",
    "version": "v1",
    "rate_limit": {
      "limit": "300",
      "remaining": "250",
      "reset": "1718611200",
      "mode": "normal"
    },
    "links": {
      "self": "/api/v1/orders/order_123",
      "related": {
        "customer": "/api/v1/customers/cust_456",
        "payments": "/api/v1/orders/order_123/payments"
      }
    }
  }
}
```


### Example 2: Validation Error (422)

**Request**:
```http
POST /api/v1/orders HTTP/1.1
Host: api.bella.vn
X-API-Key: pk_live_abc123
Content-Type: application/json

{
  "customer_id": "invalid_uuid",
  "items": []
}
```

**Response**:
```http
HTTP/1.1 422 Unprocessable Entity
Content-Type: application/json
X-RateLimit-Limit: 300
X-RateLimit-Remaining: 249
X-Content-Type-Options: nosniff

{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": {
      "field_errors": [
        {
          "field": "customer_id",
          "message": "Invalid UUID format",
          "code": "INVALID_FORMAT"
        },
        {
          "field": "items",
          "message": "At least one item is required",
          "code": "MIN_LENGTH"
        },
        {
          "field": "idempotency_key",
          "message": "Idempotency key is required",
          "code": "REQUIRED_FIELD"
        }
      ]
    }
  },
  "meta": {
    "request_id": "req_def456",
    "timestamp": "2026-06-17T10:31:00Z",
    "version": "v1"
  }
}
```


### Example 3: Rate Limit Exceeded (429)

**Request**:
```http
GET /api/v1/orders?page=1&per_page=20 HTTP/1.1
Host: api.bella.vn
X-API-Key: pk_live_abc123
```

**Response**:
```http
HTTP/1.1 429 Too Many Requests
Content-Type: application/json
Retry-After: 60
X-RateLimit-Limit: 300
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1718611260
X-RateLimit-Mode: normal
X-Content-Type-Options: nosniff

{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded. Please retry after 60 seconds.",
    "details": {
      "retry_after": 60
    }
  },
  "meta": {
    "request_id": "req_ghi789",
    "timestamp": "2026-06-17T10:32:00Z",
    "version": "v1",
    "rate_limit": {
      "limit": "300",
      "remaining": "0",
      "reset": "1718611260",
      "mode": "normal"
    }
  }
}
```

**What to do**: Wait 60 seconds (from `Retry-After` header) before retrying.


### Example 4: Paginated List (200)

**Request**:
```http
GET /api/v1/orders?page=2&per_page=20&status=completed HTTP/1.1
Host: api.bella.vn
X-API-Key: pk_live_abc123
```

**Response**:
```http
HTTP/1.1 200 OK
Content-Type: application/json
X-RateLimit-Limit: 300
X-RateLimit-Remaining: 248
X-Content-Type-Options: nosniff

{
  "success": true,
  "data": [
    {
      "id": "order_123",
      "customer_id": "cust_456",
      "status": "completed",
      "total": 200000,
      "created_at": "2026-06-17T10:00:00Z"
    },
    {
      "id": "order_124",
      "customer_id": "cust_457",
      "status": "completed",
      "total": 150000,
      "created_at": "2026-06-17T09:30:00Z"
    }
  ],
  "pagination": {
    "page": 2,
    "per_page": 20,
    "total": 150,
    "total_pages": 8
  },
  "meta": {
    "request_id": "req_jkl012",
    "timestamp": "2026-06-17T10:33:00Z",
    "version": "v1",
    "rate_limit": {
      "limit": "300",
      "remaining": "248",
      "reset": "1718611200",
      "mode": "normal"
    },
    "links": {
      "self": "https://api.bella.vn/v1/orders?page=2&per_page=20&status=completed",
      "next": "https://api.bella.vn/v1/orders?page=3&per_page=20&status=completed",
      "prev": "https://api.bella.vn/v1/orders?page=1&per_page=20&status=completed"
    }
  }
}
```


---

## FAQs

### Q1: Why is `success` a boolean instead of checking HTTP status?

**A**: HTTP status codes can be misleading (e.g., 200 doesn't always mean success in all systems). The `success` field provides a consistent, language-agnostic way to determine outcome without parsing HTTP status.

### Q2: Why are rate limit values strings instead of numbers?

**A**: To avoid precision issues with very large numbers (e.g., Unix timestamps) in JavaScript/JSON. Always use `parseInt()` or `parseFloat()` when converting to numbers.

### Q3: What is the difference between 404 and 403?

**A**:
- **404 NOT_FOUND**: Resource does not exist (e.g., `order_id` not found in database)
- **403 FORBIDDEN**: Resource exists but you don't have permission to access it (e.g., trying to access another tenant's order)

### Q4: When should I use `request_id`?

**A**: Include `request_id` in all support tickets and bug reports. It allows Bella's support team to trace the exact request in logs and reproduce the issue.

### Q5: How do I know if rate limit is approaching?

**A**: Monitor `meta.rate_limit.remaining`. When it drops below 10-20% of the limit, start throttling your requests to avoid hitting the limit.


### Q6: What is degraded mode for rate limiting?

**A**: When Redis (rate limit storage) is unavailable, Bella API switches to degraded mode with 50% reduced limits. Check `meta.rate_limit.mode` in responses. If mode is `"degraded"`, reduce your request rate accordingly.

### Q7: Are HATEOAS links mandatory to use?

**A**: No, they're optional. You can hardcode URLs if you prefer, but using HATEOAS links makes your integration more resilient to API changes (e.g., if we change URL structure in v2).

### Q8: How long are `request_id` values stored?

**A**: Request logs are retained for 90 days. After that, `request_id` may no longer be searchable in support systems.

### Q9: Can I customize the `per_page` value for pagination?

**A**: Yes, you can specify `per_page` in query params (default: 20, max: 100). Example: `?page=1&per_page=50`

### Q10: What happens if I exceed rate limit?

**A**: You'll receive a 429 response with `Retry-After` header. Wait for the specified duration before retrying. Repeated violations may result in temporary API key suspension.

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| v1.0 | 2026-06-17 | Initial release with standardized response format |

---

## Support

If you have questions about response formats:
- **Documentation**: https://docs.bella.vn/api
- **Support**: support@bella.vn
- **Status Page**: https://status.bella.vn

Always include `request_id` when reporting issues!
