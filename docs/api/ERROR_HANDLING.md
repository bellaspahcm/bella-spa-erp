# Error Handling Guide

## Table of Contents
- [Overview](#overview)
- [Error Response Format](#error-response-format)
- [Error Codes](#error-codes)
- [HTTP Status Codes](#http-status-codes)
- [Common Error Scenarios](#common-error-scenarios)
- [Retry Strategies](#retry-strategies)
- [Best Practices](#best-practices)
- [Error Recovery](#error-recovery)
- [Debugging Tips](#debugging-tips)

---

## Overview

Bella ERP API uses conventional HTTP status codes and returns structured error responses to help you identify and resolve issues quickly. This guide covers all error types, their meanings, and how to handle them effectively.

### Error Philosophy

- **Predictable**: Errors follow consistent structure
- **Actionable**: Error messages guide you to resolution
- **Debuggable**: Include request IDs for support inquiries
- **Safe**: Never expose sensitive data in error responses

---

## Error Response Format

All API errors follow this structure:

```json
{
  "success": false,
  "error": {
    "code": "VAL_001",
    "message": "Invalid request body",
    "details": {
      "field": "customer_id",
      "issue": "Must be a valid UUID",
      "received": "invalid-id-123"
    }
  },
  "meta": {
    "timestamp": "2026-06-18T10:30:00Z",
    "request_id": "req_01HQZX8K9M3N2P4Q6R7S8T9V0W"
  }
}
```

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `success` | boolean | Always `false` for errors |
| `error.code` | string | Machine-readable error code (see [Error Codes](#error-codes)) |
| `error.message` | string | Human-readable error description |
| `error.details` | object | Additional context (optional) |
| `meta.timestamp` | string | ISO 8601 timestamp |
| `meta.request_id` | string | Unique request identifier (for support) |

### Validation Error Details

For validation errors (`VAL_001`, `VAL_002`, `VAL_003`), the `details` field contains:

```json
{
  "success": false,
  "error": {
    "code": "VAL_001",
    "message": "Invalid request body",
    "details": {
      "errors": [
        {
          "field": "customer_id",
          "issue": "Required field missing"
        },
        {
          "field": "items[0].quantity",
          "issue": "Must be greater than 0",
          "received": -5
        }
      ]
    }
  }
}
```

---

## Error Codes

### Authentication Errors (AUTH)

| Code | Message | HTTP Status | Description | Action |
|------|---------|-------------|-------------|--------|
| `AUTH_001` | Invalid API key | 401 | API key not found or malformed | Check your API key format |
| `AUTH_002` | API key inactive | 401 | API key has been disabled | Contact support to reactivate |
| `AUTH_003` | API key expired | 401 | API key has expired | Generate a new API key |

**Example:**
```json
{
  "success": false,
  "error": {
    "code": "AUTH_001",
    "message": "Invalid API key",
    "details": {
      "hint": "API key must start with 'pk_live_' or 'pk_test_'"
    }
  }
}
```

### Authorization Errors (AUTHZ)

| Code | Message | HTTP Status | Description | Action |
|------|---------|-------------|-------------|--------|
| `AUTHZ_001` | Insufficient permissions | 403 | Missing required scope | Request additional scopes |
| `AUTHZ_002` | Scope required | 403 | Endpoint requires specific scope | Check API documentation |
| `AUTHZ_003` | Tenant mismatch | 403 | Resource belongs to different tenant | Verify tenant ID |

**Example:**
```json
{
  "success": false,
  "error": {
    "code": "AUTHZ_001",
    "message": "Insufficient permissions",
    "details": {
      "required_scope": "order:write",
      "granted_scopes": ["order:read", "payment:read"]
    }
  }
}
```

### Rate Limiting Errors (RATE)

| Code | Message | HTTP Status | Description | Action |
|------|---------|-------------|-------------|--------|
| `RATE_001` | Rate limit exceeded (per minute) | 429 | Too many requests in 1 minute | Wait before retrying |
| `RATE_002` | Rate limit exceeded (per day) | 429 | Daily quota exhausted | Wait until tomorrow or upgrade tier |
| `RATE_003` | Burst limit exceeded | 429 | Too many simultaneous requests | Implement request queuing |
| `RATE_LIMIT_EXCEEDED` | Rate limit exceeded | 429 | Generic rate limit error | Check headers for reset time |

**Example:**
```json
{
  "success": false,
  "error": {
    "code": "RATE_001",
    "message": "Rate limit exceeded (per minute)",
    "details": {
      "limit": 60,
      "reset_at": "2026-06-18T10:31:00Z",
      "retry_after": 45
    }
  },
  "meta": {
    "timestamp": "2026-06-18T10:30:15Z",
    "request_id": "req_01HQZX8K9M3N2P4Q6R7S8T9V0W"
  }
}
```

**Response Headers:**
```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1719571860
Retry-After: 45
```

### Validation Errors (VAL)

| Code | Message | HTTP Status | Description | Action |
|------|---------|-------------|-------------|--------|
| `VAL_001` | Invalid request body | 400 | Request body validation failed | Check request structure |
| `VAL_002` | Missing required field | 400 | Required field not provided | Add missing field |
| `VAL_003` | Invalid field format | 400 | Field value format invalid | Fix field format |

**Example:**
```json
{
  "success": false,
  "error": {
    "code": "VAL_001",
    "message": "Invalid request body",
    "details": {
      "errors": [
        {
          "field": "email",
          "issue": "Must be a valid email address",
          "received": "not-an-email"
        },
        {
          "field": "phone",
          "issue": "Must be 10 digits",
          "received": "123"
        }
      ]
    }
  }
}
```

### Tenant Errors (TENANT)

| Code | Message | HTTP Status | Description | Action |
|------|---------|-------------|-------------|--------|
| `TENANT_001` | Tenant not found | 404 | Tenant ID doesn't exist | Verify tenant ID |
| `TENANT_002` | Tenant inactive | 403 | Tenant account is disabled | Contact support |

### Server Errors (SERVER)

| Code | Message | HTTP Status | Description | Action |
|------|---------|-------------|-------------|--------|
| `SERVER_001` | Internal server error | 500 | Unexpected server error | Retry or contact support |
| `SERVER_002` | Database error | 500 | Database operation failed | Retry or contact support |
| `SERVER_003` | External service error | 503 | Third-party service unavailable | Retry later |

**Example:**
```json
{
  "success": false,
  "error": {
    "code": "SERVER_001",
    "message": "Internal server error",
    "details": {
      "hint": "Our team has been notified. Please retry in a few minutes."
    }
  },
  "meta": {
    "timestamp": "2026-06-18T10:30:00Z",
    "request_id": "req_01HQZX8K9M3N2P4Q6R7S8T9V0W"
  }
}
```

---

## HTTP Status Codes

| Status | Meaning | When Used |
|--------|---------|-----------|
| `200 OK` | Success | Request completed successfully |
| `201 Created` | Created | Resource created successfully |
| `204 No Content` | Success, no content | Delete operation succeeded |
| `400 Bad Request` | Client error | Invalid request (validation errors) |
| `401 Unauthorized` | Authentication failed | Invalid/missing API key |
| `403 Forbidden` | Authorization failed | Insufficient permissions |
| `404 Not Found` | Resource not found | Endpoint or resource doesn't exist |
| `409 Conflict` | Conflict | Resource already exists (duplicate) |
| `422 Unprocessable Entity` | Validation failed | Business logic validation failed |
| `429 Too Many Requests` | Rate limited | Too many requests |
| `500 Internal Server Error` | Server error | Unexpected server error |
| `502 Bad Gateway` | Gateway error | Upstream service error |
| `503 Service Unavailable` | Service down | Service temporarily unavailable |
| `504 Gateway Timeout` | Timeout | Request took too long |

---

## Common Error Scenarios

### Scenario 1: Invalid API Key

**Request:**
```bash
curl https://api.bellaspa.com/v1/orders \
  -H "X-API-Key: invalid_key"
```

**Response:**
```json
{
  "success": false,
  "error": {
    "code": "AUTH_001",
    "message": "Invalid API key",
    "details": {
      "hint": "API key must start with 'pk_live_' or 'pk_test_'"
    }
  }
}
```

**Resolution:**
1. Check your API key format
2. Verify you copied the complete key
3. Ensure no extra spaces or characters
4. Regenerate key if necessary

---

### Scenario 2: Missing Required Field

**Request:**
```bash
curl -X POST https://api.bellaspa.com/v1/orders \
  -H "X-API-Key: pk_live_YOUR_KEY" \
  -d '{
    "items": [{"product_id": "prod_001", "quantity": 1}]
  }'
```

**Response:**
```json
{
  "success": false,
  "error": {
    "code": "VAL_002",
    "message": "Missing required field",
    "details": {
      "field": "customer_id",
      "hint": "Customer ID is required for all orders"
    }
  }
}
```

**Resolution:**
```bash
curl -X POST https://api.bellaspa.com/v1/orders \
  -H "X-API-Key: pk_live_YOUR_KEY" \
  -d '{
    "customer_id": "cus_01HQZX8K9M3N2P4Q6R7S8T9V0W",
    "items": [{"product_id": "prod_001", "quantity": 1}]
  }'
```

---

### Scenario 3: Rate Limit Exceeded

**Request:**
```bash
# 61st request in 1 minute
curl https://api.bellaspa.com/v1/orders \
  -H "X-API-Key: pk_live_YOUR_KEY"
```

**Response:**
```json
{
  "success": false,
  "error": {
    "code": "RATE_001",
    "message": "Rate limit exceeded (per minute)",
    "details": {
      "limit": 60,
      "reset_at": "2026-06-18T10:31:00Z",
      "retry_after": 45
    }
  }
}
```

**Response Headers:**
```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1719571860
Retry-After: 45
```

**Resolution:**
```typescript
// Wait and retry
const retryAfter = parseInt(response.headers.get('Retry-After') || '60');
await sleep(retryAfter * 1000);
const retryResponse = await fetch(url, options);
```

---

### Scenario 4: Resource Not Found

**Request:**
```bash
curl https://api.bellaspa.com/v1/orders/ord_nonexistent \
  -H "X-API-Key: pk_live_YOUR_KEY"
```

**Response:**
```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Order not found",
    "details": {
      "resource": "order",
      "id": "ord_nonexistent"
    }
  }
}
```

**Resolution:**
1. Verify the resource ID is correct
2. Check if resource was deleted
3. Ensure you have permission to access the resource

---

### Scenario 5: Insufficient Permissions

**Request:**
```bash
curl -X POST https://api.bellaspa.com/v1/orders \
  -H "X-API-Key: pk_live_READ_ONLY_KEY" \
  -d '{"customer_id": "cus_001", "items": [...]}'
```

**Response:**
```json
{
  "success": false,
  "error": {
    "code": "AUTHZ_001",
    "message": "Insufficient permissions",
    "details": {
      "required_scope": "order:write",
      "granted_scopes": ["order:read"]
    }
  }
}
```

**Resolution:**
1. Request `order:write` scope for your API key
2. Contact admin to update permissions
3. Use a different API key with write permissions

---

## Retry Strategies

### Exponential Backoff

Recommended retry strategy for transient errors (500, 502, 503, 504, 429):

```typescript
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 3
): Promise<Response> {
  let attempt = 0;
  
  while (attempt < maxRetries) {
    try {
      const response = await fetch(url, options);
      
      // Success
      if (response.ok) {
        return response;
      }
      
      // Don't retry client errors (4xx except 429)
      if (response.status >= 400 && response.status < 500 && response.status !== 429) {
        return response;
      }
      
      // Rate limited - use Retry-After header
      if (response.status === 429) {
        const retryAfter = parseInt(response.headers.get('Retry-After') || '60');
        await sleep(retryAfter * 1000);
        attempt++;
        continue;
      }
      
      // Server error - exponential backoff
      if (response.status >= 500) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 30000); // Max 30 seconds
        await sleep(delay);
        attempt++;
        continue;
      }
      
      return response;
    } catch (error) {
      // Network error - exponential backoff
      if (attempt === maxRetries - 1) {
        throw error;
      }
      
      const delay = Math.min(1000 * Math.pow(2, attempt), 30000);
      await sleep(delay);
      attempt++;
    }
  }
  
  throw new Error('Max retries exceeded');
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

### When to Retry

| Error Type | Retry? | Strategy |
|------------|--------|----------|
| `AUTH_001`, `AUTH_002`, `AUTH_003` | ❌ No | Fix API key |
| `AUTHZ_001`, `AUTHZ_002`, `AUTHZ_003` | ❌ No | Request permissions |
| `VAL_001`, `VAL_002`, `VAL_003` | ❌ No | Fix request body |
| `RATE_001`, `RATE_002`, `RATE_003` | ✅ Yes | Wait `Retry-After` seconds |
| `SERVER_001`, `SERVER_002` | ✅ Yes | Exponential backoff |
| `SERVER_003` | ✅ Yes | Exponential backoff |
| Network errors | ✅ Yes | Exponential backoff |

---

## Best Practices

### 1. Always Check Status Codes

```typescript
const response = await fetch(url, options);

if (!response.ok) {
  const error = await response.json();
  throw new Error(`API Error: ${error.error.message}`);
}

const data = await response.json();
```

### 2. Handle Errors Gracefully

```typescript
try {
  const order = await bellaAPI.createOrder(orderData);
  console.log('Order created:', order.id);
} catch (error) {
  if (error.code === 'VAL_001') {
    // Validation error - show user-friendly message
    showUserError('Please check your input and try again');
  } else if (error.code === 'RATE_001') {
    // Rate limit - queue for later
    await queue.add('create-order', orderData, {
      delay: error.details.retry_after * 1000
    });
  } else if (error.code?.startsWith('SERVER_')) {
    // Server error - retry with backoff
    await retryWithBackoff(() => bellaAPI.createOrder(orderData));
  } else {
    // Unknown error - log and alert
    console.error('Unexpected error:', error);
    alertTeam('API integration error', error);
  }
}
```

### 3. Log Errors with Context

```typescript
try {
  await processOrder(order);
} catch (error) {
  logger.error('Order processing failed', {
    orderId: order.id,
    customerId: order.customer_id,
    errorCode: error.code,
    errorMessage: error.message,
    requestId: error.meta?.request_id,
    timestamp: new Date().toISOString(),
  });
  
  throw error;
}
```

### 4. Monitor Error Rates

```typescript
// Track error rates by type
const errorCounts = {
  auth: 0,
  validation: 0,
  rateLimit: 0,
  server: 0,
};

function trackError(error: APIError) {
  if (error.code.startsWith('AUTH_')) {
    errorCounts.auth++;
  } else if (error.code.startsWith('VAL_')) {
    errorCounts.validation++;
  } else if (error.code.startsWith('RATE_')) {
    errorCounts.rateLimit++;
  } else if (error.code.startsWith('SERVER_')) {
    errorCounts.server++;
  }
  
  // Alert if error rate exceeds threshold
  const totalErrors = Object.values(errorCounts).reduce((a, b) => a + b, 0);
  if (totalErrors > 100) {
    alertTeam('High API error rate', errorCounts);
  }
}
```

### 5. Provide User-Friendly Messages

```typescript
function getUserFriendlyMessage(error: APIError): string {
  switch (error.code) {
    case 'AUTH_001':
      return 'Authentication failed. Please contact support.';
    case 'VAL_001':
      return 'Please check your input and try again.';
    case 'RATE_001':
      return 'Too many requests. Please wait a moment and try again.';
    case 'SERVER_001':
      return 'Something went wrong. Please try again later.';
    default:
      return 'An error occurred. Please try again or contact support.';
  }
}
```

---

## Error Recovery

### Implementing Circuit Breaker

Prevent cascading failures with a circuit breaker:

```typescript
class CircuitBreaker {
  private failureCount = 0;
  private lastFailureTime = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  
  constructor(
    private threshold = 5,
    private timeout = 60000, // 1 minute
    private resetTime = 300000 // 5 minutes
  ) {}
  
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime > this.resetTime) {
        this.state = 'half-open';
        this.failureCount = 0;
      } else {
        throw new Error('Circuit breaker is open');
      }
    }
    
    try {
      const result = await fn();
      
      if (this.state === 'half-open') {
        this.state = 'closed';
        this.failureCount = 0;
      }
      
      return result;
    } catch (error) {
      this.failureCount++;
      this.lastFailureTime = Date.now();
      
      if (this.failureCount >= this.threshold) {
        this.state = 'open';
      }
      
      throw error;
    }
  }
}

// Usage
const breaker = new CircuitBreaker();

try {
  const order = await breaker.execute(() => bellaAPI.createOrder(data));
} catch (error) {
  if (error.message === 'Circuit breaker is open') {
    // Fallback logic
    await queue.add('create-order', data);
  }
}
```

### Fallback Strategies

```typescript
async function getProductWithFallback(productId: string) {
  try {
    // Try API first
    return await bellaAPI.getProduct(productId);
  } catch (error) {
    if (error.code?.startsWith('SERVER_')) {
      // Server error - use cache
      const cached = await cache.get(`product:${productId}`);
      if (cached) {
        return { ...cached, _fromCache: true };
      }
    }
    
    // No fallback available
    throw error;
  }
}
```

---

## Debugging Tips

### 1. Use Request IDs

Always include the `request_id` when contacting support:

```typescript
try {
  await bellaAPI.createOrder(data);
} catch (error) {
  console.error('Order creation failed', {
    requestId: error.meta?.request_id,
    errorCode: error.error?.code,
    errorMessage: error.error?.message,
  });
  
  // Show to user
  alert(`Error occurred. Reference ID: ${error.meta?.request_id}`);
}
```

### 2. Enable Request Logging

```typescript
// Log all requests for debugging
bellaAPI.on('request', (req) => {
  console.log('API Request:', {
    method: req.method,
    url: req.url,
    headers: req.headers,
    body: req.body,
  });
});

bellaAPI.on('response', (res) => {
  console.log('API Response:', {
    status: res.status,
    headers: res.headers,
    body: res.body,
    duration: res.duration,
  });
});
```

### 3. Test Error Scenarios

Use sandbox mode to test error handling:

```typescript
// Force validation error
await bellaAPI.createOrder({
  customer_id: 'invalid_id',  // Will trigger VAL_003
  items: [],
});

// Force rate limit
for (let i = 0; i < 100; i++) {
  await bellaAPI.getOrders();  // Will trigger RATE_001
}
```

### 4. Monitor API Health

```typescript
// Periodic health check
setInterval(async () => {
  try {
    await bellaAPI.healthCheck();
    console.log('API is healthy');
  } catch (error) {
    console.error('API health check failed:', error);
    alertTeam('API is down', error);
  }
}, 60000); // Every minute
```

---

## Support

If you encounter persistent errors:

1. **Check Status Page**: https://status.bellaspa.com
2. **Review Documentation**: Ensure you're following API guidelines
3. **Contact Support**: api-support@bellaspa.com
   - Include `request_id` from error response
   - Describe what you were trying to do
   - Include relevant code snippets
4. **Response Time**: Within 24 hours (business days)

---

## Related Documentation

- [Getting Started](./GETTING_STARTED.md)
- [API Reference](./API_REFERENCE.md)
- [Security Best Practices](./SECURITY_BEST_PRACTICES.md)
- [Webhooks](./WEBHOOKS.md)
