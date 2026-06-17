# Sandbox Environment - Bella API

**Version**: 1.0  
**Date**: 2026-06-17  
**Status**: Production Ready

---

## Overview

Bella API provides a **completely isolated sandbox environment** where partners can test integrations safely without affecting production data or incurring real charges.

### Key Features

- ✅ **100% Isolated** - Separate database schema, no production impact
- ✅ **Identical Structure** - Same tables, same API endpoints as production
- ✅ **Pre-seeded Data** - Sample customers, products, orders ready to use
- ✅ **Reset Anytime** - One-click reset to restore fresh test data
- ✅ **Simulated Webhooks** - Test event notifications without real payment providers
- ✅ **Free Tier Available** - Test for free before going live

---

## Environments

Bella API has two completely separate environments:

### Production Environment

| Aspect | Details |
|--------|---------|
| **API Keys** | `pk_live_...` |
| **Database** | `public` schema |
| **Data** | Real tenants, real money |
| **Rate Limits** | Full tier limits |
| **Webhooks** | Real payment provider callbacks |
| **Use Case** | Live integrations, real transactions |

### Sandbox Environment

| Aspect | Details |
|--------|---------|
| **API Keys** | `pk_test_...` |
| **Database** | `sandbox` schema (isolated) |
| **Data** | Test tenants, fake money |
| **Rate Limits** | Same as production (for realistic testing) |
| **Webhooks** | Simulated callbacks (no real providers) |
| **Use Case** | Development, testing, CI/CD |

---

## Getting Started with Sandbox

### 1. Get Your Sandbox API Key

When you create a partner account, you receive **two API keys**:

```
Production: pk_live_abc123xyz...  (use for real transactions)
Sandbox:    pk_test_abc123xyz...  (use for testing)
```

**⚠️ Important**: Never use production keys in test environments or commit them to version control!

### 2. Use Sandbox Key in Your App

Simply replace your API key with the test key:

```javascript
// ❌ Production (real data)
const apiKey = 'pk_live_abc123xyz';

// ✅ Sandbox (test data)
const apiKey = 'pk_test_abc123xyz';

// Make requests as normal
const response = await fetch('https://api.bella.vn/v1/orders', {
  headers: {
    'X-API-Key': apiKey,
  },
});
```

### 3. Verify Sandbox Mode

Check response headers to confirm you're in sandbox:

```javascript
const environment = response.headers.get('X-Environment');
const isSandbox = response.headers.get('X-Sandbox-Mode');

console.log(`Environment: ${environment}`); // "sandbox"
console.log(`Sandbox mode: ${isSandbox}`);   // "true"
```

---

## Sandbox Data

### Pre-seeded Test Data

Every sandbox starts with sample data:

**3 Test Customers**:
- Nguyễn Văn Test (`test1@example.com`, 0901234567)
- Trần Thị Demo (`demo@example.com`, 0902345678)
- Lê Sandbox (`sandbox@example.com`, 0903456789)

**2 Test Products**:
- Test Product 1 (SKU: TEST-001, ₫100,000)
- Test Product 2 (SKU: TEST-002, ₫200,000)

**1 Test Service**:
- Test Service - Massage 60min (₫300,000)

**2 Sample Orders**:
- Completed order (₫400,000, 2 days ago)
- Pending order (₫500,000, 1 day ago)

### Reset Sandbox Data

You can reset your sandbox anytime to restore fresh test data:

**Via Admin UI**:
```
https://app.bella.vn/admin/sandbox
→ Click "Reset Sandbox Data"
→ Confirm
```

**Via API** (Admin only):
```bash
curl -X DELETE https://api.bella.vn/api/admin/sandbox/reset \
  -H "Authorization: Bearer <your_session_token>" \
  -H "Content-Type: application/json" \
  -d '{"partner_id": "your-partner-uuid"}'
```

**Response**:
```json
{
  "success": true,
  "data": {
    "reset": {
      "deleted": {
        "customers": 15,
        "orders": 8,
        "payments": 3
      }
    },
    "seed": {
      "seeded": {
        "customers": 3,
        "products": 2,
        "services": 1,
        "orders": 2
      }
    },
    "message": "Sandbox data reset and re-seeded successfully"
  }
}
```

---

## Response Headers

Sandbox requests include special headers:

```http
HTTP/1.1 200 OK
X-Environment: sandbox
X-Sandbox-Mode: true
X-Sandbox-Schema: sandbox
```

| Header | Values | Description |
|--------|--------|-------------|
| `X-Environment` | `sandbox`, `production` | Current environment |
| `X-Sandbox-Mode` | `true`, `false` | Is sandbox mode active |
| `X-Sandbox-Schema` | `sandbox`, `public` | Database schema used |

---

## Security & Isolation

### Strict Separation

```
┌─────────────────────────────────┐
│  Production (pk_live_)          │
│  ├─ public schema               │
│  ├─ Real customers              │
│  ├─ Real payments               │
│  └─ Cannot access sandbox ❌    │
└─────────────────────────────────┘

┌─────────────────────────────────┐
│  Sandbox (pk_test_)             │
│  ├─ sandbox schema              │
│  ├─ Test customers              │
│  ├─ Fake payments               │
│  └─ Cannot access production ❌ │
└─────────────────────────────────┘
```

**Cross-Environment Protection**:
- `pk_test_` keys **CANNOT** access production data
- `pk_live_` keys **CANNOT** access sandbox data
- Enforced at database level with Row Level Security (RLS)
- Enforced at middleware level with environment validation

### Test vs Live Key Detection

```typescript
// Middleware automatically detects environment
if (apiKey.startsWith('pk_test_')) {
  // Route to sandbox schema
  req.dbConnection = getSandboxDB();
} else if (apiKey.startsWith('pk_live_')) {
  // Route to production schema
  req.dbConnection = getProductionDB();
}
```

---

## Testing Scenarios

### 1. Create Order (Sandbox)

```javascript
const response = await fetch('https://api.bella.vn/v1/orders', {
  method: 'POST',
  headers: {
    'X-API-Key': 'pk_test_abc123',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    customer_id: 'test-customer-uuid',
    items: [
      { product_id: 'test-product-uuid', quantity: 2 }
    ],
    idempotency_key: 'test_' + Date.now(),
  }),
});

// Check sandbox mode
console.log(response.headers.get('X-Sandbox-Mode')); // "true"
```

### 2. Test Payment Flow (Simulated)

```javascript
// In sandbox, payments are simulated
const payment = await fetch('https://api.bella.vn/v1/payments', {
  method: 'POST',
  headers: {
    'X-API-Key': 'pk_test_abc123',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    order_id: 'order-uuid',
    amount: 500000,
    method: 'card',
    // Sandbox accepts test card numbers
    card_number: '4242424242424242', // Always succeeds
    // or
    card_number: '4000000000000002', // Always fails (for testing errors)
  }),
});
```

**Sandbox Test Cards**:
| Card Number | Result |
|-------------|--------|
| `4242424242424242` | ✅ Success |
| `4000000000000002` | ❌ Decline (insufficient funds) |
| `4000000000000069` | ❌ Decline (expired card) |
| `4000000000000127` | ❌ Decline (incorrect CVC) |

### 3. Test Webhooks (Simulated)

```javascript
// Subscribe to webhook in sandbox
await fetch('https://api.bella.vn/v1/webhooks', {
  method: 'POST',
  headers: {
    'X-API-Key': 'pk_test_abc123',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    url: 'https://your-app.com/webhooks',
    events: ['order.created', 'payment.succeeded'],
  }),
});

// Trigger test webhook manually (Admin UI)
// → Sends simulated webhook to your endpoint
```

### 4. Test Rate Limiting

```javascript
// Make 100 requests to test rate limit handling
for (let i = 0; i < 100; i++) {
  const response = await fetch('https://api.bella.vn/v1/orders', {
    headers: { 'X-API-Key': 'pk_test_abc123' },
  });
  
  // Monitor rate limit headers
  const remaining = response.headers.get('X-RateLimit-Remaining');
  console.log(`Remaining: ${remaining}`);
  
  if (response.status === 429) {
    const retryAfter = response.headers.get('Retry-After');
    console.log(`Rate limited! Retry after ${retryAfter}s`);
    break;
  }
}
```

---

## Best Practices

### 1. Use Sandbox First, Always

```javascript
// ✅ Good: Test in sandbox first
const SANDBOX_KEY = 'pk_test_abc123';
const PRODUCTION_KEY = 'pk_live_xyz789';

// Development/Staging
const apiKey = process.env.NODE_ENV === 'production' 
  ? PRODUCTION_KEY 
  : SANDBOX_KEY;
```

### 2. Never Commit API Keys

```bash
# ❌ Bad: Hardcoded keys
const apiKey = 'pk_live_abc123xyz';

# ✅ Good: Environment variables
const apiKey = process.env.BELLA_API_KEY;
```

**.gitignore**:
```
.env
.env.local
secrets.json
```

### 3. Automate Sandbox Testing

```javascript
// CI/CD pipeline (e.g., GitHub Actions)
describe('Bella API Integration', () => {
  const apiKey = process.env.BELLA_TEST_API_KEY; // pk_test_...
  
  beforeEach(async () => {
    // Reset sandbox before each test suite
    await resetSandbox();
  });
  
  it('creates an order', async () => {
    const response = await createOrder({ apiKey, ... });
    expect(response.status).toBe(201);
    
    // Verify sandbox mode
    expect(response.headers.get('X-Sandbox-Mode')).toBe('true');
  });
});
```

### 4. Test Error Scenarios

```javascript
// Test validation errors
try {
  await fetch('https://api.bella.vn/v1/orders', {
    method: 'POST',
    headers: { 'X-API-Key': 'pk_test_abc123' },
    body: JSON.stringify({
      customer_id: 'invalid-uuid', // Invalid format
      items: [], // Empty items (validation error)
    }),
  });
} catch (error) {
  console.log('Validation error caught:', error);
  // Handle error in your app
}
```

### 5. Monitor Sandbox vs Production

```javascript
// Add telemetry to track environment
const environment = response.headers.get('X-Environment');

analytics.track('API Request', {
  environment, // "sandbox" or "production"
  endpoint: '/v1/orders',
  status: response.status,
});
```

---

## Limitations

### What's Different in Sandbox?

| Feature | Sandbox | Production |
|---------|---------|------------|
| **Data Persistence** | Can be reset anytime | Permanent (unless deleted) |
| **Payment Processing** | Simulated (no real money) | Real payment providers |
| **Webhook Delivery** | Simulated (manual trigger) | Real-time from providers |
| **Email Notifications** | Mock (logged, not sent) | Real emails sent |
| **SMS Notifications** | Mock (logged, not sent) | Real SMS sent |
| **3rd Party APIs** | Mocked responses | Real API calls |

### What's the Same?

- ✅ Rate limits (same as production tier)
- ✅ API endpoints (identical URLs and responses)
- ✅ Authentication (API key format)
- ✅ Validation rules (same constraints)
- ✅ Database structure (identical schemas)
- ✅ Error codes (same error responses)

---

## FAQs

### Q1: Do I need a separate account for sandbox?

No! When you create a partner account, you automatically get:
- 1 production API key (`pk_live_...`)
- 1 sandbox API key (`pk_test_...`)

### Q2: Does sandbox count towards my rate limit?

Yes, sandbox uses the same rate limits as your tier. This ensures realistic testing of your integration's performance.

### Q3: Can I upgrade from Free to Pro in sandbox?

Sandbox always uses the same tier as your production account. If you upgrade to Pro, both production and sandbox get Pro limits.

### Q4: What happens if I reset sandbox data during active testing?

All test data is deleted immediately. Active API requests may fail with 404 errors. Reset triggers re-seeding with fresh sample data.

### Q5: Can I import my production data to sandbox?

No, for security and privacy reasons. Sandbox starts with generic test data only. You can create custom test data via API calls.

### Q6: Are sandbox webhooks real-time?

No, webhooks in sandbox are simulated. You can trigger them manually from the Admin UI to test your webhook endpoint.

### Q7: How long is sandbox data retained?

Sandbox data persists until you reset it or your account is deleted. There's no automatic cleanup.

### Q8: Can multiple team members use the same sandbox?

Yes! The sandbox API key is shared across your team. All team members test against the same sandbox environment.

### Q9: What if I accidentally use production key in development?

API calls will work, but affect real data! Always use `pk_test_` keys in development. Set up environment variable checks to prevent accidents.

### Q10: Can I have multiple sandbox environments (e.g., dev, staging)?

Currently, each partner has 1 production + 1 sandbox environment. For complex workflows, create separate partner accounts or use prefixed data (e.g., `dev_`, `staging_` customer names).

---

## Migration to Production

### Pre-Launch Checklist

Before switching from sandbox to production:

- [ ] All integration tests passing in sandbox
- [ ] Error handling tested (rate limits, validation, server errors)
- [ ] Webhook endpoint verified and secured (HTTPS, signature validation)
- [ ] API keys stored securely (environment variables, not committed to git)
- [ ] Production API key has correct scopes for your use case
- [ ] Rate limit tier suitable for expected traffic
- [ ] Monitoring/alerting set up for production requests
- [ ] Team trained on production vs sandbox key usage

### Switch to Production

1. **Update API Key**:
   ```javascript
   // Change from:
   const apiKey = 'pk_test_abc123';
   
   // To:
   const apiKey = process.env.BELLA_PROD_API_KEY; // pk_live_xyz789
   ```

2. **Verify Environment**:
   ```javascript
   const response = await makeRequest();
   const env = response.headers.get('X-Environment');
   
   if (env !== 'production') {
     throw new Error('Not in production mode!');
   }
   ```

3. **Monitor First Requests**:
   - Check logs for errors
   - Verify data appears in production dashboard
   - Confirm webhooks arrive (if applicable)

4. **Keep Sandbox for Development**:
   - Continue using `pk_test_` for new features
   - Test in sandbox before deploying to production

---

## Support

If you experience sandbox issues:
- **Documentation**: https://docs.bella.vn/api/sandbox
- **Admin UI**: https://app.bella.vn/admin/sandbox
- **Support Email**: support@bella.vn
- **Status Page**: https://status.bella.vn

Include your `request_id` and confirm which environment (`X-Environment` header) when reporting issues!
