# API Rate Limiting - Bella ERP

**Version**: 2.0  
**Date**: 2026-06-17  
**Status**: Production Ready

---

## Overview

Bella ERP API Gateway implements **token bucket rate limiting with circuit breaker protection** to protect API infrastructure from abuse, ensure fair usage, and maintain service quality for all partners.

### Key Features

- ✅ **5 Partner Tiers** - Free, Basic, Pro, Enterprise, Unlimited
- ✅ **Dual Windows** - Per-minute and per-day limits
- ✅ **Redis Backend** - Distributed rate limiting across instances
- ✅ **Circuit Breaker** - Automatic failover after 3 consecutive Redis failures
- ✅ **Graceful Degradation** - In-memory fallback with reduced limits when Redis down
- ✅ **Endpoint-Specific Limits** - Stricter limits for write operations in degraded mode
- ✅ **Real-time Monitoring** - Alerts when limits approached/exceeded or Redis status changes
- ✅ **Standard Headers** - `X-RateLimit-*` response headers with mode indicator

---

## Rate Limit Tiers

### Normal Mode (Redis Available)

| Tier | Req/Minute | Req/Day | Use Case | Monthly Cost |
|------|------------|---------|----------|--------------|
| **Free** | 60 | 1,000 | Testing, small integrations | $0 |
| **Basic** | 300 | 10,000 | Small partners | $49 |
| **Pro** | 1,000 | 100,000 | Medium partners | $199 |
| **Enterprise** | 5,000 | 1,000,000 | Large partners | $999 |
| **Unlimited** | ∞ | ∞ | Internal Bella services | N/A |

### Degraded Mode (Redis Unavailable)

When Redis is down, limits are reduced to protect system stability:

| Tier | Read Endpoints | Write Endpoints | Notes |
|------|----------------|-----------------|-------|
| **Free** | 30/min (50%) | 12/min (20%) | Unknown partners blocked |
| **Basic** | 150/min (50%) | 60/min (20%) | Known partners only |
| **Pro** | 500/min (50%) | 200/min (20%) | Known partners only |
| **Enterprise** | 2,500/min (50%) | 1,000/min (20%) | Known partners only |
| **Unlimited** | 10,000/min (capped) | 5,000/min (capped) | Even unlimited gets capped |

**Write Endpoints Include**:
- `POST`, `PUT`, `PATCH`, `DELETE` methods
- Payment operations (`/payments/confirm`, `/payments/refund`)
- Order confirmation (`/orders/confirm`)
- Invoice finalization (`/invoices/finalize`)
- POS sync (`/sync`)
- Accounting entries (`/accounting/entry`)

**⚠️ Multi-Instance Warning**:
Degraded mode uses in-memory limiting per server instance. With 3 servers:
- Free tier (30/min read) = ~90 requests/min total across all servers
- This is **best-effort fallback**, not distributed rate limiting

---

## Circuit Breaker

The circuit breaker protects against Redis outages with 3 states:

### States

```
┌─────────┐  3 failures    ┌──────┐  30 seconds   ┌────────────┐
│ CLOSED  │─────────────────→ OPEN ├───────────────→ HALF_OPEN │
│ (Normal)│                 │(Down)│               │ (Testing)  │
└─────────┘                 └──────┘               └─────┬──────┘
     ↑                                                    │
     │                                                    │
     └────────────────────────────────────────────────────┘
              2 consecutive successes

```

| State | Behavior | Duration | Next State |
|-------|----------|----------|------------|
| **CLOSED** | Normal operation, all requests go to Redis | Until 3 failures | → OPEN |
| **OPEN** | Redis unavailable, use in-memory fallback | 30 seconds | → HALF_OPEN |
| **HALF_OPEN** | Testing recovery, limited Redis calls | Until 2 successes or failure | → CLOSED or OPEN |

### Failure Criteria

- **3 consecutive Redis failures** within 60 seconds → Circuit OPENS
- Failures include: connection timeout, command errors, ping failures

### Recovery Criteria

- After 30 seconds in OPEN state → Attempt HALF_OPEN
- **2 consecutive successful** Redis operations in HALF_OPEN → Circuit CLOSES

---

## Response Headers

Every API response includes rate limit information with mode indicator:

```http
HTTP/1.1 200 OK
X-RateLimit-Limit: 300
X-RateLimit-Remaining: 250
X-RateLimit-Reset: 1718611200
X-RateLimit-Mode: normal
X-RateLimit-Operation: read
```

### Header Definitions

| Header | Description | Example Values |
|--------|-------------|----------------|
| `X-RateLimit-Limit` | Total requests allowed in current window | `300`, `unlimited` |
| `X-RateLimit-Remaining` | Requests remaining in current window | `250`, `unlimited` |
| `X-RateLimit-Reset` | Unix timestamp (seconds) when limit resets | `1718611200` |
| `X-RateLimit-Mode` | Rate limiting mode | `normal`, `degraded` |
| `X-RateLimit-Operation` | Operation type for degraded mode | `read`, `write` |

### Mode Indicator

- `normal`: Redis available, full limits apply
- `degraded`: Redis down, reduced limits + circuit breaker active

**⚠️ Important**: When you see `mode: degraded`, reduce your request rate significantly. Write operations have only 20% of normal capacity.

---## Rate Limit Exceeded Response

When you exceed your rate limit, you'll receive a `429 Too Many Requests` response:

```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded. Please retry after 45 seconds.",
    "limit": 300,
    "reset": 1718611200,
    "retryAfter": 45
  },
  "meta": {
    "request_id": "req_abc123",
    "timestamp": "2026-06-17T10:30:00Z",
    "version": "v1"
  }
}
```

### Retry Strategy

**Best Practice**: Implement exponential backoff with jitter

```javascript
async function apiRequestWithRetry(url, options, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      
      if (response.status === 429) {
        // Rate limit exceeded
        const retryAfter = response.headers.get('Retry-After');
        const delay = retryAfter 
          ? parseInt(retryAfter) * 1000 
          : Math.min(1000 * Math.pow(2, attempt), 30000); // Max 30s
        
        console.warn(`Rate limited. Retrying in ${delay}ms...`);
        await sleep(delay);
        continue;
      }
      
      return response;
    } catch (error) {
      if (attempt === maxRetries) throw error;
      await sleep(1000 * attempt); // Linear backoff for network errors
    }
  }
  
  throw new Error('Max retries exceeded');
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

---

## Monitoring & Alerts

### Usage Dashboard

Check your current usage at: `https://admin.bella.vn/partners/api-usage`

### Real-time Monitoring

```typescript
// GET /api/admin/partners/{partner_id}/usage
const usage = await fetch('https://api.bella.vn/admin/partners/partner_123/usage', {
  headers: {
    'Authorization': 'Bearer admin_token'
  }
});

const data = await usage.json();

console.log(`Minute: ${data.minute.remaining}/${data.minute.limit}`);
console.log(`Day: ${data.day.remaining}/${data.day.limit}`);
console.log(`Tier: ${data.tier}`);
```

### Alerts

You'll receive notifications when:
- **80% consumed**: Warning email sent
- **100% consumed**: Rate limit exceeded email
- **Sustained high usage**: Recommendation to upgrade tier

---

## Best Practices

### 1. Cache Responses

Don't repeatedly fetch the same data:

```javascript
// ❌ BAD: Fetch every time
function getOrder(orderId) {
  return fetch(`https://api.bella.vn/v1/orders/${orderId}`);
}

// ✅ GOOD: Cache for 5 minutes
const cache = new Map();

function getOrder(orderId) {
  const cached = cache.get(orderId);
  if (cached && Date.now() - cached.time < 5 * 60 * 1000) {
    return Promise.resolve(cached.data);
  }
  
  return fetch(`https://api.bella.vn/v1/orders/${orderId}`)
    .then(res => res.json())
    .then(data => {
      cache.set(orderId, { data, time: Date.now() });
      return data;
    });
}
```

### 2. Batch Requests

Use list endpoints instead of individual requests:

```javascript
// ❌ BAD: 100 requests
for (const orderId of orderIds) {
  await fetch(`https://api.bella.vn/v1/orders/${orderId}`);
}

// ✅ GOOD: 1 request
const orders = await fetch('https://api.bella.vn/v1/orders?ids=' + orderIds.join(','));
```

### 3. Use Webhooks

Instead of polling for changes, subscribe to webhooks:

```javascript
// ❌ BAD: Poll every 10 seconds (8,640 req/day)
setInterval(async () => {
  const orders = await fetch('https://api.bella.vn/v1/orders?status=pending');
  // Process orders
}, 10000);

// ✅ GOOD: Subscribe to webhook (0 polling requests)
// POST /api/v1/webhooks/subscribe
{
  "events": ["order.created", "order.updated"],
  "url": "https://your-app.com/webhooks/bella"
}
```

### 4. Monitor Your Usage

Track your API usage and set alerts:

```javascript
// Check remaining quota before critical operations
const response = await fetch('https://api.bella.vn/v1/orders');
const remaining = response.headers.get('X-RateLimit-Remaining');

if (remaining < 10) {
  console.error('⚠️ Low rate limit remaining!');
  // Alert ops team, pause non-critical operations
}
```

---

## Upgrading Your Tier

### When to Upgrade

Upgrade your tier when you consistently hit:
- **>70% of daily limit**: Upgrade to avoid disruption
- **>50% at end of month**: You're growing, upgrade proactively
- **Multiple 429 errors**: Already over limit, upgrade immediately

### How to Upgrade

1. **Self-service** (Basic → Pro):
   - Login to https://admin.bella.vn/partners/billing
   - Select new tier
   - Update payment method
   - Instant activation

2. **Sales contact** (Enterprise, custom):
   - Email: sales@bella.vn
   - Include: partner ID, current usage, expected growth
   - Custom pricing for >5M requests/day

---

## FAQ

### Q: What happens if I exceed my limit?

A: You'll receive `429 Too Many Requests` until the window resets. Your data is safe, requests are just blocked temporarily.

### Q: Can I get a temporary limit increase?

A: Yes, for special events (Black Friday, Tet holiday), contact support@bella.vn 7 days in advance.

### Q: Do failed requests count toward my limit?

A: Yes, all requests (successful or failed) count toward your rate limit.

### Q: Can I see historical usage?

A: Yes, at https://admin.bella.vn/partners/usage-history (last 90 days).

### Q: Does sandbox count separately?

A: Sandbox keys (`pk_test_*`) have separate limits from production (`pk_live_*`).

### Q: What if Redis goes down?

A: Rate limiting gracefully degrades (fails open). Your requests will succeed, but without rate limit protection. We monitor Redis 24/7.

---

## Technical Implementation

For developers implementing rate-limited APIs:

```typescript
import { withRateLimit } from '@/lib/middleware/rate-limit.middleware';

export const GET = withRateLimit(async (req: NextRequest) => {
  // Your API logic here
  // Rate limiting, auth, and headers are handled automatically
  
  return NextResponse.json({ data: '...' });
});
```

See: `src/lib/middleware/rate-limit.middleware.ts` for implementation details.

---

**Need Help?**
- Technical issues: support@bella.vn
- Billing questions: billing@bella.vn
- API documentation: https://docs.bella.vn/api

**Last Updated**: 2026-06-17  
**Document Version**: 1.0


### Usage Example (JavaScript)

```javascript
const response = await fetch('https://api.bella.vn/v1/orders', {
  headers: {
    'X-API-Key': 'pk_live_yourkey...'
  }
});

// Check rate limit status
const limit = response.headers.get('X-RateLimit-Limit');
const remaining = response.headers.get('X-RateLimit-Remaining');
const reset = response.headers.get('X-RateLimit-Reset');
const mode = response.headers.get('X-RateLimit-Mode');
const operation = response.headers.get('X-RateLimit-Operation');

console.log(`Rate limit: ${remaining}/${limit} remaining (${mode} mode, ${operation} operation)`);
console.log(`Resets at: ${new Date(reset * 1000).toISOString()}`);

// Warning if approaching limit
if (remaining / limit < 0.2) {
  console.warn('⚠️ Approaching rate limit!');
}

// Critical warning if degraded mode
if (mode === 'degraded') {
  console.error('🚨 DEGRADED MODE: Rate limiting running with reduced capacity');
  console.error('   Reduce request rate immediately, especially for write operations');
}
```

---

## Monitoring & Alerts

### Alert Types

| Alert Type | Severity | Trigger | Action Required |
|------------|----------|---------|-----------------|
| **APPROACHING_LIMIT** | MEDIUM | Partner consumed >80% of rate limit | Monitor usage, consider tier upgrade |
| **LIMIT_EXCEEDED** | MEDIUM | Partner exceeded rate limit | Implement retry logic with backoff |
| **REDIS_DOWN** | CRITICAL | Redis failed 3 times in 60s | Ops team notified, reduce write operations |
| **REDIS_RECOVERED** | INFO | Redis recovered after 2 successful checks | System back to normal |

### Alert Channels

**Console Logs** (Always enabled):
```json
{
  "type": "REDIS_DOWN",
  "severity": "CRITICAL",
  "message": "🚨 CRITICAL: Redis unavailable after 3 consecutive failures",
  "circuit_state": "OPEN",
  "failure_count": 3,
  "next_attempt": "2026-06-17T10:30:30Z",
  "impact": "Unknown partners blocked, known partners have reduced limits"
}
```

**Telegram Integration** (Planned):
- Alerts sent to `@bella_alerts_bot`
- Critical alerts trigger immediate notification
- Recovery alerts sent as FYI

**Sentry Integration** (Planned):
- CRITICAL alerts create Sentry errors
- MEDIUM alerts create Sentry warnings
- INFO alerts logged but not alerted

**Email Integration** (Planned):
- CRITICAL alerts → `ops@bella.vn`
- Partner LIMIT_EXCEEDED → partner contact email
- Daily summary report → `tech@bella.vn`

### Partner Notifications

Partners receive email notifications when:
1. **80% threshold** - Warning email with upgrade suggestions
2. **100% exceeded** - Block notification with reset time
3. **Tier upgrade** - Welcome email with new limits

---

## Best Practices

### 1. Monitor Rate Limit Headers

Always check `X-RateLimit-Remaining` before making batch requests:

```javascript
async function safeBatchRequest(items) {
  for (const item of items) {
    const response = await makeRequest(item);
    const remaining = parseInt(response.headers.get('X-RateLimit-Remaining'));
    
    // Throttle if low
    if (remaining < 10) {
      const reset = parseInt(response.headers.get('X-RateLimit-Reset'));
      const waitTime = (reset * 1000) - Date.now();
      console.log(`Rate limit low, waiting ${waitTime}ms`);
      await sleep(waitTime);
    }
  }
}
```

### 2. Implement Exponential Backoff

When you receive 429, retry with increasing delays:

```javascript
async function requestWithRetry(url, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const response = await fetch(url, { headers: { 'X-API-Key': apiKey } });
    
    if (response.status === 429) {
      const retryAfter = parseInt(response.headers.get('Retry-After') || '60');
      const delay = Math.min(retryAfter * 1000, Math.pow(2, attempt) * 1000);
      console.log(`Rate limited, retry ${attempt}/${maxRetries} after ${delay}ms`);
      await sleep(delay);
      continue;
    }
    
    return response;
  }
  
  throw new Error('Max retries exceeded');
}
```

### 3. Respect Degraded Mode

When `X-RateLimit-Mode: degraded`, reduce request rate immediately:

```javascript
const mode = response.headers.get('X-RateLimit-Mode');
const operation = response.headers.get('X-RateLimit-Operation');

if (mode === 'degraded') {
  if (operation === 'write') {
    // Reduce write operations to 20% of normal rate
    await sleep(5000); // Wait 5 seconds between writes
  } else {
    // Reduce read operations to 50% of normal rate
    await sleep(2000); // Wait 2 seconds between reads
  }
}
```

### 4. Batch Operations When Possible

Instead of 100 individual requests, make 1 batch request:

```javascript
// ❌ Bad: 100 requests
for (const orderId of orderIds) {
  await fetch(`/api/v1/orders/${orderId}`);
}

// ✅ Good: 1 batch request
await fetch('/api/v1/orders/batch', {
  method: 'POST',
  body: JSON.stringify({ order_ids: orderIds }),
});
```

### 5. Cache Responses

Cache stable data to reduce API calls:

```javascript
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function getCachedData(url) {
  const cached = cache.get(url);
  
  if (cached && Date.now() - cached.time < CACHE_TTL) {
    return cached.data;
  }
  
  const response = await fetch(url);
  const data = await response.json();
  cache.set(url, { data, time: Date.now() });
  
  return data;
}
```

---

## FAQs

### Q1: What happens if I exceed my rate limit?

You'll receive a `429 Too Many Requests` response. Wait for the `Retry-After` seconds before retrying. Repeated violations may result in temporary API key suspension.

### Q2: Can I request a rate limit increase?

Yes! Contact `sales@bella.vn` to discuss upgrading to a higher tier or custom limits for Enterprise partners.

### Q3: Do rate limits reset at a fixed time?

No, rate limits use sliding windows. If you hit the limit at 10:30:15, it resets at 10:31:15 (1 minute later).

### Q4: What is degraded mode?

When Redis (our rate limiting backend) is unavailable, we switch to in-memory limiting with reduced capacity. Unknown partners are blocked, known partners get 50% (read) or 20% (write) of normal limits.

### Q5: How does the circuit breaker work?

- **3 consecutive Redis failures in 60 seconds** → Circuit OPENS (degraded mode for 30 seconds)
- After 30 seconds → Circuit goes HALF_OPEN (testing recovery)
- **2 consecutive successful** Redis operations → Circuit CLOSES (back to normal)

### Q6: Why do write operations have stricter limits in degraded mode?

Write operations (payments, orders, invoices) modify data and are more critical. Stricter limits (20% vs 50%) prevent data integrity issues during Redis outages.

### Q7: What if I'm running multiple servers and Redis is down?

Each server maintains its own in-memory limiter. With 3 servers, your actual limit = degraded_limit × 3. This is a **best-effort fallback**, not perfect distributed limiting.

### Q8: How are alerts sent?

Currently console logs only. Planned integrations:
- Telegram: Real-time alerts to `@bella_alerts_bot`
- Sentry: Error tracking with severity levels
- Email: Critical alerts to ops team

### Q9: Can I see my current usage?

Yes, use the `/api/admin/partners/[id]/usage` endpoint to get real-time statistics:

```json
{
  "minute": {
    "limit": 300,
    "remaining": 250,
    "reset": 1718611200,
    "mode": "normal"
  },
  "day": {
    "limit": 10000,
    "remaining": 8500,
    "reset": 1718697600,
    "mode": "normal"
  },
  "tier": "basic",
  "circuit_state": "CLOSED"
}
```

### Q10: What is the Unlimited tier limit in degraded mode?

Even Unlimited tier gets capped at:
- **10,000 requests/min** for read operations
- **5,000 requests/min** for write operations

This prevents runaway loops or bugs from overwhelming the system during Redis outages.

---

## Support

If you experience rate limiting issues:
- **Documentation**: https://docs.bella.vn/api/rate-limiting
- **Support Email**: support@bella.vn
- **Status Page**: https://status.bella.vn

Always include your `request_id` from the response metadata when reporting issues!
