# API Rate Limiting - Bella ERP

**Version**: 1.0  
**Date**: 2026-06-17  
**Status**: Production Ready

---

## Overview

Bella ERP API Gateway implements **token bucket rate limiting** to protect API infrastructure from abuse, ensure fair usage, and maintain service quality for all partners.

### Key Features

- ✅ **5 Partner Tiers** - Free, Basic, Pro, Enterprise, Unlimited
- ✅ **Dual Windows** - Per-minute and per-day limits
- ✅ **Redis Backend** - Distributed rate limiting across instances
- ✅ **Graceful Degradation** - Fails open if Redis unavailable
- ✅ **Real-time Monitoring** - Alerts when limits approached/exceeded
- ✅ **Standard Headers** - `X-RateLimit-*` response headers

---

## Rate Limit Tiers

| Tier | Req/Minute | Req/Day | Use Case | Monthly Cost |
|------|------------|---------|----------|--------------|
| **Free** | 60 | 1,000 | Testing, small integrations | $0 |
| **Basic** | 300 | 10,000 | Small partners | $49 |
| **Pro** | 1,000 | 100,000 | Medium partners | $199 |
| **Enterprise** | 5,000 | 1,000,000 | Large partners | $999 |
| **Unlimited** | ∞ | ∞ | Internal Bella services | N/A |

### Tier Recommendations

**Free Tier**:
- Good for: Development, testing, proof-of-concept
- Example: Local dev environment, sandbox testing
- Limit: 1 request per second average

**Basic Tier**:
- Good for: Single-location businesses
- Example: Small spa with 1-2 branches
- Limit: 5 requests per second average

**Pro Tier**:
- Good for: Multi-location businesses
- Example: Spa chain with 10+ branches
- Limit: 16 requests per second average

**Enterprise Tier**:
- Good for: Large enterprises, franchise networks
- Example: National spa chain with 100+ locations
- Limit: 83 requests per second average

---

## Response Headers

Every API response includes rate limit information:

```http
HTTP/1.1 200 OK
X-RateLimit-Limit: 300
X-RateLimit-Remaining: 250
X-RateLimit-Reset: 1718611200
```

### Header Definitions

| Header | Description | Example |
|--------|-------------|---------|
| `X-RateLimit-Limit` | Total requests allowed in current window | `300` |
| `X-RateLimit-Remaining` | Requests remaining in current window | `250` |
| `X-RateLimit-Reset` | Unix timestamp (seconds) when limit resets | `1718611200` |

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

console.log(`Rate limit: ${remaining}/${limit} remaining`);
console.log(`Resets at: ${new Date(reset * 1000).toISOString()}`);

// Warning if approaching limit
if (remaining / limit < 0.2) {
  console.warn('⚠️ Approaching rate limit!');
}
```

---

## Rate Limit Exceeded Response

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
