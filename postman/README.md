# Bella ERP Partner API - Postman Collection

This directory contains the official Postman collection for testing and integrating with the Bella ERP Partner API.

## 📦 Contents

- **`Bella_API_v1.postman_collection.json`** - Complete API collection with 30+ requests
- **`Bella_API_Sandbox.postman_environment.json`** - Sandbox environment configuration
- **`Bella_API_Production.postman_environment.json`** - Production environment configuration

---

## 🚀 Quick Start

### 1. Import Collection

1. Open Postman
2. Click **Import** button
3. Drag and drop `Bella_API_v1.postman_collection.json`
4. Collection will appear in your sidebar

### 2. Import Environments

1. Click **Import** again
2. Import both environment files:
   - `Bella_API_Sandbox.postman_environment.json`
   - `Bella_API_Production.postman_environment.json`
3. Select environment from dropdown (top right)

### 3. Configure API Key

**For Sandbox Testing:**
1. Select **"Bella API - Sandbox"** environment
2. Click the eye icon (👁️) next to environment dropdown
3. Edit `api_key` variable
4. Paste your sandbox API key (`pk_test_...`)
5. Save

**For Production:**
1. Select **"Bella API - Production"** environment
2. Edit `api_key` variable
3. Paste your production API key (`pk_live_...`)
4. Save

### 4. Run Your First Request

1. Open collection → **1. Authentication & Health** → **Test API Key**
2. Click **Send**
3. ✅ You should see `200 OK` response with your partner details

---

## 📁 Collection Structure

```
Bella ERP Partner API v1
├── 1. Authentication & Health (2 requests)
│   ├── Test API Key
│   └── API Health Check
│
├── 2. Orders (6 requests)
│   ├── Create Order
│   ├── Get Order
│   ├── List Orders
│   ├── Update Order
│   ├── Complete Order
│   └── Cancel Order
│
├── 3. Payments (3 requests)
│   ├── Create Payment
│   ├── Get Payment
│   └── List Payments
│
├── 4. Customers (4 requests)
│   ├── Create Customer
│   ├── Get Customer
│   ├── List Customers
│   └── Update Customer
│
├── 5. Products (2 requests)
│   ├── List Products
│   └── Get Product
│
├── 6. Webhooks (4 requests)
│   ├── Subscribe to Webhook
│   ├── List Webhook Subscriptions
│   ├── Unsubscribe Webhook
│   └── Test Webhook (Sandbox)
│
└── 7. Sandbox Management (3 requests)
    ├── Get Sandbox Status
    ├── Reset Sandbox Data
    └── Seed Test Data
```

**Total: 24 requests across 7 categories**

---

## 🧪 Testing Workflow

### Recommended Testing Order

1. **Authentication**
   - Test API Key ✅

2. **Setup Test Data** (Sandbox only)
   - Seed Test Data
   - List Products (get `product_id`)
   - Create Customer (get `customer_id`)

3. **Order Flow**
   - Create Order
   - Get Order
   - List Orders
   - Complete Order

4. **Payment Flow**
   - Create Payment
   - Get Payment
   - List Payments

5. **Webhooks** (optional)
   - Subscribe to Webhook
   - List Webhook Subscriptions
   - Test Webhook (use https://webhook.site)

### Running All Tests

1. Click on collection name
2. Click **Run** button (▶️)
3. Select environment
4. Click **Run Bella ERP Partner API v1**
5. View test results

---

## 🔧 Features

### Automatic Features

1. **Idempotency Keys**
   - Automatically generated for POST/PUT/PATCH/DELETE requests
   - Stored in `last_idempotency_key` variable

2. **Environment Variables**
   - IDs automatically saved after creation
   - `last_order_id`, `customer_id`, `product_id`, etc.
   - Reused in subsequent requests

3. **Timestamps**
   - Request timestamp stored in `request_timestamp`
   - Response time tracked in `last_response_time`

4. **Test Assertions**
   - Status code validation
   - Response structure validation
   - Rate limit header checks
   - Data integrity checks

### Pre-Request Scripts

Every request includes:
- Automatic idempotency key generation
- Timestamp tracking
- Header injection

### Test Scripts

Every request validates:
- ✅ HTTP status code
- ✅ Content-Type header
- ✅ Response structure (`success`, `data`, `meta`)
- ✅ Rate limit headers
- ✅ Request ID presence

---

## 📊 Environment Variables

### Automatically Set

These variables are set automatically by test scripts:

| Variable | Description | Set By |
|----------|-------------|--------|
| `customer_id` | Last created customer ID | Create Customer |
| `product_id` | First product ID from list | List Products |
| `last_order_id` | Last created order ID | Create Order |
| `last_order_number` | Last order number | Create Order |
| `last_payment_id` | Last created payment ID | Create Payment |
| `webhook_subscription_id` | Last subscription ID | Subscribe to Webhook |
| `last_idempotency_key` | Last used idempotency key | All mutations |
| `request_timestamp` | Last request timestamp | All requests |
| `last_response_time` | Last response time (ms) | All requests |

### Manually Configure

These variables must be set manually:

| Variable | Description | Example |
|----------|-------------|---------|
| `api_key` | Your API key | `pk_test_abc123...` |
| `tenant_id` | Your tenant ID (optional) | `uuid-here` |

---

## 🔐 Security Best Practices

### API Key Management

1. **Never commit API keys**
   - Use environment variables
   - Mark `api_key` as "secret" type in Postman

2. **Use correct environment**
   - Sandbox: `pk_test_` keys only
   - Production: `pk_live_` keys only

3. **Rotate keys regularly**
   - Every 90 days recommended
   - Immediately after any security incident

### Safe Testing

1. **Always test in Sandbox first**
   - Use sandbox environment
   - Reset sandbox data when needed

2. **Production testing**
   - Use non-critical data
   - Have rollback plan
   - Monitor closely

---

## 🐛 Troubleshooting

### "401 Unauthorized"

**Problem**: Invalid API key

**Solutions**:
1. Check API key format (`pk_test_` or `pk_live_`)
2. Verify no extra spaces
3. Ensure key is active
4. Check environment selected (Sandbox vs Production)

---

### "403 Forbidden"

**Problem**: Insufficient permissions

**Solutions**:
1. Check required scopes in API documentation
2. Request additional scopes from admin
3. Verify endpoint requires specific scope

---

### "429 Rate Limit Exceeded"

**Problem**: Too many requests

**Solutions**:
1. Check `X-RateLimit-Reset` header
2. Wait before retrying
3. Implement exponential backoff
4. Consider upgrading tier

---

### "Sandbox data is empty"

**Problem**: Sandbox not seeded

**Solutions**:
1. Run **Sandbox Management → Seed Test Data**
2. Or manually create customers and products
3. Check sandbox environment selected

---

### "Environment variables not working"

**Problem**: Variables not auto-populating

**Solutions**:
1. Check test scripts are enabled
2. Run requests in order (Create before Get)
3. Verify environment is selected (not "No Environment")
4. Check Console for errors (View → Show Postman Console)

---

## 📚 Related Documentation

- [Getting Started Guide](../docs/api/GETTING_STARTED.md)
- [API Reference](../docs/api/API_REFERENCE.md)
- [Integration Guide](../docs/api/INTEGRATION_GUIDE.md)
- [Webhooks Guide](../docs/api/WEBHOOKS.md)
- [Error Handling](../docs/api/ERROR_HANDLING.md)
- [FAQ](../docs/api/FAQ.md)

---

## 🆘 Support

Need help?

- **Documentation**: https://docs.bellaspa.com
- **Email**: api-support@bellaspa.com
- **Status Page**: https://status.bellaspa.com

---

## 🔄 Updates

This collection is regularly updated. Check for updates:

1. Visit: https://docs.bellaspa.com/postman
2. Download latest version
3. Re-import to Postman

**Current Version**: 1.0.0  
**Last Updated**: 2026-06-18  
**API Version**: v1

---

## ✅ Quick Checklist

Before contacting support, verify:

- [ ] Correct environment selected
- [ ] API key is valid and active
- [ ] No typos in API key
- [ ] Using correct key type (`pk_test_` vs `pk_live_`)
- [ ] Sandbox data seeded (if using sandbox)
- [ ] Test scripts are enabled
- [ ] Postman Console checked for errors
- [ ] API status page checked (https://status.bellaspa.com)

---

**Happy Testing! 🚀**
