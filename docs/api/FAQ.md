# Frequently Asked Questions (FAQ)

## Table of Contents
- [Getting Started](#getting-started)
- [Authentication & Security](#authentication--security)
- [API Usage](#api-usage)
- [Rate Limiting](#rate-limiting)
- [Webhooks](#webhooks)
- [Error Handling](#error-handling)
- [Sandbox & Testing](#sandbox--testing)
- [Billing & Plans](#billing--plans)
- [Technical Support](#technical-support)

---

## Getting Started

### How do I get started with the Bella ERP API?

1. **Get API Key**: Contact your account manager or request via Admin UI
2. **Read Documentation**: Start with [Getting Started Guide](./GETTING_STARTED.md)
3. **Test in Sandbox**: Use `pk_test_` key to test without affecting production
4. **Implement Integration**: Follow [Integration Guide](./INTEGRATION_GUIDE.md)
5. **Go Live**: Switch to `pk_live_` key for production

### Do I need a Bella ERP account to use the API?

Yes, you need an active Bella ERP account. API access is available for:
- Spa/Clinic branches using Bella ERP
- Technology partners (POS, payment gateways, etc.)
- Franchise partners

Contact sales@bellaspa.com for more information.

### Is there a free tier?

Yes! The **Free Tier** includes:
- 60 requests per minute
- 1,000 requests per day
- Access to all endpoints
- Sandbox environment
- Email support

Perfect for testing and low-volume integrations.


### What programming languages are supported?

The API is language-agnostic and works with any language that can make HTTP requests. We provide code examples for:
- **JavaScript/TypeScript** (Node.js, React, Vue.js)
- **Python** (Flask, Django, FastAPI)
- **PHP** (Laravel, WordPress)
- **cURL** (command-line testing)

### Where can I find code examples?

Code examples are included in:
- [Getting Started Guide](./GETTING_STARTED.md) - Basic examples
- [Integration Guide](./INTEGRATION_GUIDE.md) - Advanced patterns
- [API Reference](./API_REFERENCE.md) - Per-endpoint examples
- [GitHub Repository](https://github.com/bellaspa/api-examples) - Full sample apps

---

## Authentication & Security

### How do I authenticate API requests?

Include your API key in the `X-API-Key` header:

```bash
curl https://api.bellaspa.com/v1/orders \
  -H "X-API-Key: pk_live_YOUR_KEY"
```

Never send API keys in query parameters or request bodies.

### What's the difference between `pk_live_` and `pk_test_` keys?

- **`pk_live_`**: Production key, affects real data
- **`pk_test_`**: Sandbox key, uses test data only

Sandbox data is reset periodically and isolated from production.


### How do I rotate my API key?

1. Generate a new key in Admin UI (Settings → API Partners)
2. Test new key in sandbox
3. Update your application with new key
4. Deploy to production
5. Verify everything works
6. Deactivate old key

**Important**: Old key remains valid until you deactivate it. Update all systems before deactivating.

### Can I have multiple API keys?

Yes! You can create multiple API keys for:
- Different environments (dev, staging, production)
- Different applications
- Different teams
- Different permission scopes

Each key can have its own scopes and rate limits.

### How do I secure my API key?

**DO:**
- Store in environment variables (`process.env.BELLA_API_KEY`)
- Use secret management services (AWS Secrets Manager, HashiCorp Vault)
- Rotate keys regularly (every 90 days recommended)
- Use different keys for different environments
- Restrict key permissions to minimum required scopes

**DON'T:**
- Commit keys to version control (Git)
- Share keys via email or Slack
- Embed keys in client-side code
- Log keys in application logs
- Use production keys in development


### What happens if my API key is compromised?

1. **Immediately**: Deactivate the compromised key in Admin UI
2. **Generate**: Create a new API key
3. **Update**: Update all systems with new key
4. **Review**: Check API logs for suspicious activity
5. **Report**: Contact security@bellaspa.com with details

We monitor for unusual activity and will notify you if detected.

---

## API Usage

### What is the base URL for the API?

**Production**: `https://api.bellaspa.com/v1/`  
**Sandbox**: `https://api.bellaspa.com/v1/` (use `pk_test_` key)

### What data format does the API use?

- **Request**: JSON (`Content-Type: application/json`)
- **Response**: JSON with UTF-8 encoding
- **Dates**: ISO 8601 format (`2026-06-18T10:30:00Z`)
- **Currency**: VND (Vietnamese Dong)
- **IDs**: ULID format (`01HQZX8K9M3N2P4Q6R7S8T9V0W`)

### How do I handle pagination?

Use `limit` and `offset` parameters:

```bash
# Get first 20 orders
GET /v1/orders?limit=20&offset=0

# Get next 20 orders
GET /v1/orders?limit=20&offset=20
```

Response includes pagination metadata:

```json
{
  "data": [...],
  "pagination": {
    "total": 150,
    "limit": 20,
    "offset": 0,
    "has_more": true
  }
}
```


### How do I filter and sort results?

**Filtering:**
```bash
# Filter by status
GET /v1/orders?status=completed

# Filter by date range
GET /v1/orders?created_after=2026-06-01&created_before=2026-06-30

# Filter by customer
GET /v1/orders?customer_id=cus_01HQZX8K9M3N2P4Q6R7S8T9V0W
```

**Sorting:**
```bash
# Sort by created_at descending (newest first)
GET /v1/orders?sort=-created_at

# Sort by total ascending
GET /v1/orders?sort=total

# Multiple sort fields
GET /v1/orders?sort=-created_at,total
```

### What is idempotency and why should I use it?

Idempotency ensures that retrying a request produces the same result. Include an `Idempotency-Key` header:

```bash
curl -X POST https://api.bellaspa.com/v1/orders \
  -H "X-API-Key: pk_live_YOUR_KEY" \
  -H "Idempotency-Key: order_create_20260618_001" \
  -d '{"customer_id": "cus_001", "items": [...]}'
```

If the request is retried with the same key, the API returns the original response without creating a duplicate order.

### Can I make requests in parallel?

Yes, but stay within rate limits:
- **Free**: 60 requests/minute
- **Basic**: 300 requests/minute
- **Pro**: 600 requests/minute
- **Enterprise**: 1,200 requests/minute

Use request queuing to avoid hitting limits.


---

## Rate Limiting

### What are the rate limits?

| Tier | Per Minute | Per Day | Burst |
|------|-----------|---------|-------|
| Free | 60 | 1,000 | 10 |
| Basic | 300 | 10,000 | 50 |
| Pro | 600 | 50,000 | 100 |
| Enterprise | 1,200 | 200,000 | 200 |
| Unlimited | ∞ | ∞ | ∞ |

### How do I check my rate limit status?

Check response headers:

```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1719571860
```

- `Limit`: Total requests allowed in current window
- `Remaining`: Requests left in current window
- `Reset`: Unix timestamp when limit resets

### What happens when I exceed the rate limit?

You'll receive a `429 Too Many Requests` error:

```json
{
  "success": false,
  "error": {
    "code": "RATE_001",
    "message": "Rate limit exceeded (per minute)",
    "details": {
      "retry_after": 45
    }
  }
}
```

Wait `retry_after` seconds before retrying.


### How do I avoid hitting rate limits?

1. **Cache responses**: Don't fetch the same data repeatedly
2. **Batch requests**: Use pagination to fetch multiple records
3. **Use webhooks**: Get real-time updates instead of polling
4. **Implement exponential backoff**: Retry with increasing delays
5. **Upgrade tier**: Higher tiers have higher limits

### Can I request a rate limit increase?

Yes! Contact your account manager or email api-support@bellaspa.com with:
- Current tier
- Current usage patterns
- Requested new limits
- Business justification

---

## Webhooks

### What are webhooks and why should I use them?

Webhooks send real-time notifications to your server when events occur. Benefits:
- **Real-time**: Instant updates, no polling
- **Efficient**: Reduces API calls
- **Scalable**: Better for high-volume integrations

### How do I set up webhooks?

1. Create an endpoint on your server (e.g., `https://your-app.com/webhooks/bella`)
2. Verify webhook signatures for security
3. Register webhook URL in Admin UI or via API
4. Subscribe to specific events
5. Test with sandbox events

See [Webhooks Guide](./WEBHOOKS.md) for details.


### How do I verify webhook signatures?

Every webhook includes these headers:
- `X-Bella-Signature`: HMAC-SHA256 signature
- `X-Bella-Timestamp`: Unix timestamp

Verify using your `webhook_secret`:

```typescript
const signature = req.headers['x-bella-signature'];
const timestamp = req.headers['x-bella-timestamp'];
const payload = req.body.toString('utf8');

const expectedSignature = crypto
  .createHmac('sha256', webhookSecret)
  .update(`${timestamp}.${payload}`)
  .digest('hex');

if (signature !== expectedSignature) {
  throw new Error('Invalid signature');
}
```

### What happens if my webhook endpoint is down?

Bella ERP automatically retries failed webhooks:
- 1st retry: 1 minute
- 2nd retry: 5 minutes
- 3rd retry: 15 minutes
- 4th retry: 1 hour
- 5th retry: 3 hours
- 6th retry: 6 hours

After 6 attempts, the webhook is marked as failed and you receive an email notification.

### Can I replay missed webhooks?

Yes! You can:
1. **Check webhook logs** in Admin UI
2. **Manually replay** individual webhooks
3. **Use API polling** as backup to catch missed events


---

## Error Handling

### What error codes does the API return?

Common error codes:

| Code | Meaning | HTTP Status |
|------|---------|-------------|
| `AUTH_001` | Invalid API key | 401 |
| `AUTH_002` | API key inactive | 401 |
| `AUTHZ_001` | Insufficient permissions | 403 |
| `VAL_001` | Invalid request body | 400 |
| `RATE_001` | Rate limit exceeded | 429 |
| `SERVER_001` | Internal server error | 500 |

See [Error Handling Guide](./ERROR_HANDLING.md) for complete list.

### Should I retry failed requests?

**YES** - Retry these errors with exponential backoff:
- `429` (Rate limit exceeded)
- `500` (Internal server error)
- `502` (Bad gateway)
- `503` (Service unavailable)
- `504` (Gateway timeout)

**NO** - Don't retry these errors:
- `400` (Bad request)
- `401` (Unauthorized)
- `403` (Forbidden)
- `404` (Not found)

Fix the issue instead.


### What is the `request_id` and why is it important?

Every API response includes a unique `request_id`:

```json
{
  "success": true,
  "data": {...},
  "meta": {
    "request_id": "req_01HQZX8K9M3N2P4Q6R7S8T9V0W"
  }
}
```

**Use it for:**
- Debugging issues with support
- Tracing requests in logs
- Correlating webhooks with API calls

Always include the `request_id` when contacting support.

---

## Sandbox & Testing

### How do I access the sandbox environment?

Use a `pk_test_` API key:

```bash
curl https://api.bellaspa.com/v1/orders \
  -H "X-API-Key: pk_test_YOUR_SANDBOX_KEY"
```

Sandbox data is isolated and periodically reset.

### What's in the sandbox environment?

The sandbox includes:
- Sample customers, products, and orders
- Test payment methods
- Webhook testing
- All API endpoints
- Realistic demo data

Perfect for development and testing without affecting production.


### Can I reset my sandbox data?

Yes! Request a sandbox reset via:
- Admin UI: Settings → API Partners → Reset Sandbox
- Email: api-support@bellaspa.com

Data will be restored to default state.

### How do I test webhooks locally?

Use tunneling tools to expose your local server:

**Using ngrok:**
```bash
# Start local server
npm run dev

# Create tunnel
ngrok http 3000

# Use ngrok URL as webhook URL
# https://abc123.ngrok.io/webhooks/bella
```

**Using Webhook.site:**
- Visit https://webhook.site
- Copy your unique URL
- Register it as your webhook URL
- Inspect incoming webhooks

---

## Billing & Plans

### How much does the API cost?

| Tier | Price | Requests/Min | Requests/Day |
|------|-------|-------------|--------------|
| **Free** | $0/month | 60 | 1,000 |
| **Basic** | $49/month | 300 | 10,000 |
| **Pro** | $149/month | 600 | 50,000 |
| **Enterprise** | Custom | 1,200 | 200,000 |
| **Unlimited** | Custom | ∞ | ∞ |

Contact sales@bellaspa.com for pricing.


### Is there overage pricing?

**Free & Basic**: Hard limits, no overage charges (requests blocked after limit)  
**Pro & Enterprise**: Soft limits with overage pricing:
- $0.001 per request above daily limit
- Billed monthly

### Can I upgrade or downgrade my plan?

Yes! Changes take effect immediately:
- **Upgrade**: Instant access to higher limits
- **Downgrade**: Effective at next billing cycle

Contact your account manager or use Admin UI.

### Do I pay for failed requests?

No. Only successful requests (HTTP 2xx status codes) count toward your quota.

---

## Technical Support

### How do I get help?

1. **Documentation**: Start with our comprehensive guides
2. **Email Support**: api-support@bellaspa.com
3. **Admin UI**: Submit tickets via Settings → Support
4. **Status Page**: https://status.bellaspa.com
5. **Community**: https://github.com/bellaspa/api-discussions

### What's the support response time?

| Plan | Response Time | Channels |
|------|--------------|----------|
| Free | 48 hours | Email |
| Basic | 24 hours | Email |
| Pro | 12 hours | Email, Phone |
| Enterprise | 4 hours | Email, Phone, Slack |
| Unlimited | 1 hour | 24/7 Dedicated |

Business hours: Mon-Fri, 9am-6pm ICT


### Where can I report bugs?

Email api-support@bellaspa.com with:
- Description of the issue
- Steps to reproduce
- Expected vs actual behavior
- `request_id` from error response
- Code samples (if applicable)

We'll respond within 24 hours (business days).

### Is there a developer community?

Yes! Join our community:
- **GitHub Discussions**: https://github.com/bellaspa/api-discussions
- **Developer Blog**: https://blog.bellaspa.com/developers
- **Monthly Newsletter**: Subscribe at api-updates@bellaspa.com

### Can I request new features?

Absolutely! Submit feature requests via:
- Email: api-feedback@bellaspa.com
- GitHub: https://github.com/bellaspa/api-discussions
- Admin UI: Settings → API Feedback

We review all requests and prioritize based on demand.

---

## Related Documentation

- [Getting Started](./GETTING_STARTED.md) - First steps with the API
- [API Reference](./API_REFERENCE.md) - Complete endpoint documentation
- [Integration Guide](./INTEGRATION_GUIDE.md) - Best practices and patterns
- [Security Best Practices](./SECURITY_BEST_PRACTICES.md) - Security guidelines
- [Webhooks](./WEBHOOKS.md) - Real-time event notifications
- [Error Handling](./ERROR_HANDLING.md) - Error codes and recovery
- [Changelog](./CHANGELOG.md) - API version history

---

**Still have questions?** Contact us at api-support@bellaspa.com
