# Integration Guide - Bella API

This guide provides step-by-step instructions and code examples for integrating with the Bella API.

---

## 📚 Table of Contents

1. [Integration Checklist](#integration-checklist)
2. [Authentication Setup](#authentication-setup)
3. [Common Integration Patterns](#common-integration-patterns)
4. [Error Handling](#error-handling)
5. [Best Practices](#best-practices)
6. [Testing Strategy](#testing-strategy)
7. [Production Checklist](#production-checklist)

---

## ✅ Integration Checklist

Before you start coding:

### Planning Phase
- [ ] Understand your integration use case (POS, Payment, Booking, etc.)
- [ ] Identify required API scopes
- [ ] Review rate limits for your tier
- [ ] Design webhook event handling strategy
- [ ] Plan error handling and retry logic

### Development Phase
- [ ] Set up development environment
- [ ] Store API keys securely (environment variables)
- [ ] Implement authentication
- [ ] Implement core business logic
- [ ] Add error handling
- [ ] Add retry logic with exponential backoff
- [ ] Implement idempotency
- [ ] Add logging and monitoring

### Testing Phase
- [ ] Unit tests for API client
- [ ] Integration tests with sandbox
- [ ] Load testing (rate limits)
- [ ] Error scenario testing
- [ ] Webhook signature verification testing

### Production Phase
- [ ] Security audit
- [ ] Performance optimization
- [ ] Monitoring and alerting setup
- [ ] Documentation for your team
- [ ] Incident response plan

---

## 🔑 Authentication Setup

### Step 1: Secure API Key Storage

**❌ NEVER do this:**
```typescript
// Bad: Hardcoded API key
const API_KEY = 'pk_live_abc123xyz789...';

// Bad: Committed to version control
// .env
BELLA_API_KEY=pk_live_abc123xyz789...

// Bad: Exposed in client-side code
<script>
  const apiKey = 'pk_live_abc123xyz789...';
</script>
```

**✅ DO this:**
```typescript
// Good: Environment variables
// .env (add to .gitignore!)
BELLA_API_KEY=pk_live_abc123xyz789...

// app.ts
const API_KEY = process.env.BELLA_API_KEY;
if (!API_KEY) {
  throw new Error('BELLA_API_KEY environment variable is required');
}
```

### Step 2: Create API Client

```typescript
// api-client.ts
import fetch from 'node-fetch';

export class BellaAPIClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(apiKey: string, useSandbox: boolean = false) {
    if (!apiKey) {
      throw new Error('API key is required');
    }
    
    this.apiKey = apiKey;
    this.baseUrl = 'https://bella-spa-erp.vercel.app/api/v1';
    
    // Auto-detect environment from API key
    const isSandbox = apiKey.startsWith('pk_test_');
    if (isSandbox !== useSandbox) {
      console.warn(`API key environment mismatch: key=${isSandbox ? 'test' : 'live'}, useSandbox=${useSandbox}`);
    }
  }

  private async request<T>(
    method: string,
    path: string,
    data?: any,
    options?: RequestOptions
  ): Promise<APIResponse<T>> {
    const url = `${this.baseUrl}${path}`;
    
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };

    // Add idempotency key for mutations
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      headers['Idempotency-Key'] = options?.idempotencyKey || crypto.randomUUID();
    }

    const response = await fetch(url, {
      method,
      headers,
      body: data ? JSON.stringify(data) : undefined,
    });

    const responseData = await response.json();

    if (!response.ok) {
      throw new BellaAPIError(
        responseData.error.code,
        responseData.error.message,
        response.status,
        responseData.error.details
      );
    }

    return responseData;
  }

  // HTTP method helpers
  async get<T>(path: string): Promise<APIResponse<T>> {
    return this.request<T>('GET', path);
  }

  async post<T>(path: string, data: any, options?: RequestOptions): Promise<APIResponse<T>> {
    return this.request<T>('POST', path, data, options);
  }

  async patch<T>(path: string, data: any, options?: RequestOptions): Promise<APIResponse<T>> {
    return this.request<T>('PATCH', path, data, options);
  }

  async delete<T>(path: string, options?: RequestOptions): Promise<APIResponse<T>> {
    return this.request<T>('DELETE', path, undefined, options);
  }
}

// Custom error class
export class BellaAPIError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
    public details?: any
  ) {
    super(message);
    this.name = 'BellaAPIError';
  }
}

// Types
interface RequestOptions {
  idempotencyKey?: string;
}

interface APIResponse<T> {
  success: true;
  data: T;
  pagination?: Pagination;
  meta: ResponseMeta;
}

interface Pagination {
  page: number;
  per_page: number;
  total: number;
  total_pages: number;
  next: string | null;
  prev: string | null;
}

interface ResponseMeta {
  request_id: string;
  timestamp: string;
  version: string;
}
```

### Step 3: Usage Examples

```typescript
// Initialize client
const client = new BellaAPIClient(process.env.BELLA_API_KEY!);

// Create an order
const order = await client.post('/orders', {
  customer_id: 'cus_abc123',
  items: [
    {
      product_id: 'prod_xyz789',
      quantity: 1,
    },
  ],
});

console.log('Order created:', order.data.id);

// List orders with pagination
const orders = await client.get('/orders?page=1&per_page=20');
console.log('Total orders:', orders.pagination?.total);

// Handle errors
try {
  await client.post('/orders', { invalid: 'data' });
} catch (error) {
  if (error instanceof BellaAPIError) {
    console.error('API Error:', error.code, error.message);
    console.error('Details:', error.details);
  }
}
```

---

## 🔄 Common Integration Patterns

### Pattern 1: Sync Orders from POS to Bella

**Use Case**: Point-of-Sale system syncs orders to Bella ERP

```typescript
async function syncOrderFromPOS(posOrder: POSOrder) {
  const client = new BellaAPIClient(process.env.BELLA_API_KEY!);

  try {
    // Use POS order ID as idempotency key to prevent duplicates
    const idempotencyKey = `pos_order_${posOrder.id}`;

    const bellaOrder = await client.post(
      '/orders',
      {
        customer_id: posOrder.customerId,
        items: posOrder.items.map(item => ({
          product_id: item.productId,
          quantity: item.quantity,
          price: item.price,
        })),
        notes: `Synced from POS Order #${posOrder.id}`,
      },
      { idempotencyKey }
    );

    // Save mapping in your database
    await savePOSOrderMapping(posOrder.id, bellaOrder.data.id);

    return bellaOrder.data;
  } catch (error) {
    if (error instanceof BellaAPIError) {
      if (error.code === 'IDEMPOTENCY_CONFLICT') {
        // Order already synced, fetch existing order
        const existingOrderId = await getPOSOrderMapping(posOrder.id);
        const existingOrder = await client.get(`/orders/${existingOrderId}`);
        return existingOrder.data;
      }
    }
    throw error;
  }
}
```

### Pattern 2: Handle Webhook Events

**Use Case**: Receive real-time notifications when orders are completed

```typescript
import express from 'express';
import crypto from 'crypto';

const app = express();

// Middleware to verify webhook signature
function verifyWebhookSignature(req, res, next) {
  const signature = req.headers['x-bella-signature'];
  const payload = JSON.stringify(req.body);
  const secret = process.env.BELLA_WEBHOOK_SECRET!;

  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  next();
}

// Webhook endpoint
app.post('/webhooks/bella', express.json(), verifyWebhookSignature, async (req, res) => {
  const event = req.body;

  try {
    // Acknowledge receipt immediately
    res.status(200).json({ received: true });

    // Process event asynchronously
    await processWebhookEvent(event);
  } catch (error) {
    console.error('Webhook processing error:', error);
    // Don't return error to Bella (already acknowledged)
  }
});

async function processWebhookEvent(event: WebhookEvent) {
  switch (event.type) {
    case 'order.completed':
      await handleOrderCompleted(event.data);
      break;
    case 'payment.completed':
      await handlePaymentCompleted(event.data);
      break;
    default:
      console.log('Unhandled event type:', event.type);
  }
}

async function handleOrderCompleted(order: any) {
  console.log('Order completed:', order.id);
  // Update your local database
  // Send confirmation email
  // Update inventory
  // etc.
}
```

### Pattern 3: Batch Operations with Rate Limiting

**Use Case**: Sync 1000 customers from legacy system

```typescript
import pLimit from 'p-limit';

async function batchSyncCustomers(customers: Customer[]) {
  const client = new BellaAPIClient(process.env.BELLA_API_KEY!);
  
  // Rate limit: 300 requests/minute = 5 requests/second
  const limit = pLimit(5);
  
  const results = await Promise.allSettled(
    customers.map(customer =>
      limit(async () => {
        try {
          const result = await client.post(
            '/customers',
            {
              name: customer.name,
              phone: customer.phone,
              email: customer.email,
            },
            { idempotencyKey: `migrate_${customer.legacyId}` }
          );
          
          return { success: true, customerId: result.data.id };
        } catch (error) {
          if (error instanceof BellaAPIError && error.code === 'RATE_LIMIT_EXCEEDED') {
            // Wait for rate limit reset
            await new Promise(resolve => setTimeout(resolve, 60000));
            // Retry
            return limit(() => syncCustomer(customer));
          }
          throw error;
        }
      })
    )
  );

  const succeeded = results.filter(r => r.status === 'fulfilled').length;
  const failed = results.filter(r => r.status === 'rejected').length;

  console.log(`Batch sync complete: ${succeeded} succeeded, ${failed} failed`);
  return results;
}
```

### Pattern 4: Polling vs Webhooks

**Use Case**: Monitor order status changes

**Option A: Polling (Simple, but less efficient)**
```typescript
async function pollOrderStatus(orderId: string, maxAttempts: number = 60) {
  const client = new BellaAPIClient(process.env.BELLA_API_KEY!);

  for (let i = 0; i < maxAttempts; i++) {
    const order = await client.get(`/orders/${orderId}`);
    
    if (order.data.status === 'completed') {
      return order.data;
    }
    
    // Wait 5 seconds before next poll
    await new Promise(resolve => setTimeout(resolve, 5000));
  }

  throw new Error('Order not completed within timeout');
}
```

**Option B: Webhooks (Recommended, real-time)**
```typescript
// No polling needed! Just handle webhook:
async function handleOrderCompleted(event: WebhookEvent) {
  const orderId = event.data.id;
  // Order is already completed, process immediately
  await processCompletedOrder(orderId);
}
```

---

## ⚠️ Error Handling

### Comprehensive Error Handling

```typescript
async function robustAPICall<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3
): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof BellaAPIError) {
        switch (error.code) {
          case 'RATE_LIMIT_EXCEEDED':
            // Exponential backoff
            const delay = Math.pow(2, attempt) * 1000;
            console.log(`Rate limited. Waiting ${delay}ms before retry ${attempt}/${maxRetries}`);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;

          case 'INTERNAL_ERROR':
          case 'SERVICE_UNAVAILABLE':
            // Server error, retry
            if (attempt < maxRetries) {
              console.log(`Server error. Retrying ${attempt}/${maxRetries}`);
              await new Promise(resolve => setTimeout(resolve, 2000));
              continue;
            }
            break;

          case 'INVALID_API_KEY':
          case 'INSUFFICIENT_PERMISSIONS':
          case 'INVALID_INPUT':
            // Client error, don't retry
            throw error;

          default:
            // Unknown error
            if (attempt < maxRetries) {
              await new Promise(resolve => setTimeout(resolve, 1000));
              continue;
            }
        }
      }

      // Non-API error or max retries reached
      throw error;
    }
  }

  throw new Error('Max retries exceeded');
}

// Usage
const order = await robustAPICall(() =>
  client.post('/orders', orderData)
);
```

---

## 📝 Best Practices

### 1. Always Use Idempotency Keys

```typescript
// ✅ Good: Consistent idempotency key
const idempotencyKey = `order_${customerOrder.id}_${Date.now()}`;
await client.post('/orders', orderData, { idempotencyKey });

// ❌ Bad: Random UUID every time
await client.post('/orders', orderData); // Different UUID each call
```

### 2. Implement Exponential Backoff

```typescript
async function exponentialBackoff(
  operation: () => Promise<any>,
  maxRetries: number = 5
) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      
      const delay = Math.min(1000 * Math.pow(2, i), 30000);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}
```

### 3. Log All API Interactions

```typescript
class BellaAPIClient {
  private async request<T>(method: string, path: string, data?: any): Promise<T> {
    const requestId = crypto.randomUUID();
    
    console.log('[Bella API Request]', {
      requestId,
      method,
      path,
      timestamp: new Date().toISOString(),
    });

    try {
      const response = await fetch(this.baseUrl + path, {
        method,
        headers: { ... },
        body: data ? JSON.stringify(data) : undefined,
      });

      const responseData = await response.json();

      console.log('[Bella API Response]', {
        requestId,
        status: response.status,
        success: responseData.success,
        timestamp: new Date().toISOString(),
      });

      return responseData;
    } catch (error) {
      console.error('[Bella API Error]', {
        requestId,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
      throw error;
    }
  }
}
```

### 4. Monitor Rate Limits

```typescript
class RateLimitMonitor {
  private remaining: number = Infinity;
  private reset: number = 0;

  updateFromHeaders(headers: Headers) {
    const remaining = headers.get('X-RateLimit-Remaining');
    const reset = headers.get('X-RateLimit-Reset');

    if (remaining) this.remaining = parseInt(remaining);
    if (reset) this.reset = parseInt(reset);

    // Alert if close to limit
    if (this.remaining < 10) {
      console.warn(`[Rate Limit Warning] Only ${this.remaining} requests remaining`);
    }
  }

  async waitIfNeeded() {
    if (this.remaining === 0) {
      const now = Date.now() / 1000;
      const waitTime = Math.max(0, this.reset - now) * 1000;
      
      console.log(`[Rate Limit] Waiting ${waitTime}ms for reset`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
}
```

---

## 🧪 Testing Strategy

### Unit Tests

```typescript
import { describe, it, expect, vi } from 'vitest';

describe('BellaAPIClient', () => {
  it('should make authenticated requests', async () => {
    const client = new BellaAPIClient('pk_test_abc123');
    
    // Mock fetch
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: { id: 'ord_123' } }),
    });

    const result = await client.get('/orders');
    
    expect(result.success).toBe(true);
    expect(result.data.id).toBe('ord_123');
  });

  it('should throw on API errors', async () => {
    const client = new BellaAPIClient('pk_test_abc123');
    
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({
        success: false,
        error: { code: 'INVALID_API_KEY', message: 'Invalid API key' },
      }),
    });

    await expect(client.get('/orders')).rejects.toThrow('Invalid API key');
  });
});
```

### Integration Tests (Sandbox)

```typescript
describe('Integration Tests', () => {
  const client = new BellaAPIClient(process.env.BELLA_TEST_API_KEY!);

  beforeEach(async () => {
    // Reset sandbox before each test
    await fetch('https://bella-spa-erp.vercel.app/api/admin/sandbox/reset', {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${process.env.BELLA_TEST_API_KEY}` },
    });
  });

  it('should create and retrieve an order', async () => {
    // Create order
    const created = await client.post('/orders', {
      customer_id: 'cus_test_001',
      items: [{ product_id: 'prod_test_001', quantity: 1 }],
    });

    expect(created.data.id).toBeDefined();

    // Retrieve order
    const retrieved = await client.get(`/orders/${created.data.id}`);
    
    expect(retrieved.data.id).toBe(created.data.id);
    expect(retrieved.data.status).toBe('pending');
  });
});
```

---

## 🚀 Production Checklist

Before going live:

### Security
- [ ] API keys stored in secure vault (not .env files)
- [ ] API keys rotated regularly (quarterly)
- [ ] Webhook signatures verified
- [ ] HTTPS only (TLS 1.2+)
- [ ] Input validation on all user data
- [ ] Rate limit monitoring alerts set up

### Reliability
- [ ] Error handling implemented
- [ ] Retry logic with exponential backoff
- [ ] Idempotency keys for all mutations
- [ ] Webhook endpoint is idempotent
- [ ] Circuit breaker pattern implemented
- [ ] Timeout configured (30s recommended)

### Monitoring
- [ ] API request/response logging
- [ ] Error rate alerts
- [ ] Latency monitoring
- [ ] Rate limit alerts (>80% usage)
- [ ] Success rate dashboard

### Documentation
- [ ] Internal API client documented
- [ ] Runbook for common issues
- [ ] Contact information for Bella support
- [ ] Incident response plan

### Testing
- [ ] Unit tests passing
- [ ] Integration tests passing
- [ ] Load tests completed
- [ ] Failure scenario tests completed

---

**Document Version**: 1.0.0  
**Last Updated**: 2026-06-18

Need help? Contact api-support@bellaspa.vn
