# Getting Started with Bella API

Welcome to the Bella Spa ERP API! This guide will help you get started with integrating your application with Bella's ecosystem.

## 🎯 Overview

The Bella API allows partners to:
- Create and manage customer orders
- Process payments
- Sync inventory and services
- Receive real-time webhooks
- Access customer data (with consent)

**Base URL**: 
- Production: `https://bella-spa-erp.vercel.app/api/v1`
- Sandbox: `https://bella-spa-erp.vercel.app/api/v1` (use test API key)

**API Version**: v1 (stable)

---

## 📋 Prerequisites

Before you start, you'll need:

1. **A Bella Partner Account**
   - Contact: api-partners@bellaspa.vn
   - Subject: "API Partnership Request"
   
2. **Technical Requirements**
   - HTTPS support (TLS 1.2+)
   - Ability to receive webhooks (optional)
   - JSON parsing capability

3. **Development Environment**
   - Code editor
   - API testing tool (Postman, Insomnia, or cURL)

---

## 🔑 Step 1: Get Your API Keys

### Sandbox Key (Testing)

For development and testing, you'll receive a sandbox API key:

```
pk_test_abc123xyz789...
```

**Sandbox Features**:
- ✅ Isolated test environment
- ✅ Pre-seeded test data
- ✅ Safe to experiment
- ✅ Unlimited requests
- ✅ Can be reset anytime

### Production Key (Live)

After testing, you'll receive a production API key:

```
pk_live_abc123xyz789...
```

**Production Features**:
- 🔴 Real money transactions
- 🔴 Real customer data
- 🔴 Rate limits apply
- 🔴 Requires security audit

> ⚠️ **Security Warning**: Never commit API keys to version control or expose them in client-side code!

---

## 🚀 Step 2: Make Your First API Call

### Using cURL

```bash
curl -X GET https://bella-spa-erp.vercel.app/api/v1/orders \
  -H "Authorization: Bearer pk_test_abc123xyz789..." \
  -H "Content-Type: application/json"
```

### Using JavaScript/TypeScript

```typescript
const BELLA_API_KEY = 'pk_test_abc123xyz789...';
const BASE_URL = 'https://bella-spa-erp.vercel.app/api/v1';

async function getOrders() {
  const response = await fetch(`${BASE_URL}/orders`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${BELLA_API_KEY}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const data = await response.json();
  return data;
}

// Usage
getOrders()
  .then(result => console.log('Orders:', result.data))
  .catch(error => console.error('Error:', error));
```

### Using Python

```python
import requests

BELLA_API_KEY = 'pk_test_abc123xyz789...'
BASE_URL = 'https://bella-spa-erp.vercel.app/api/v1'

def get_orders():
    response = requests.get(
        f'{BASE_URL}/orders',
        headers={
            'Authorization': f'Bearer {BELLA_API_KEY}',
            'Content-Type': 'application/json',
        }
    )
    
    response.raise_for_status()
    return response.json()

# Usage
try:
    result = get_orders()
    print('Orders:', result['data'])
except requests.exceptions.RequestException as e:
    print('Error:', e)
```

### Using PHP

```php
<?php
$bellaApiKey = 'pk_test_abc123xyz789...';
$baseUrl = 'https://bella-spa-erp.vercel.app/api/v1';

function getOrders($apiKey, $baseUrl) {
    $ch = curl_init();
    
    curl_setopt_array($ch, [
        CURLOPT_URL => "$baseUrl/orders",
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => [
            "Authorization: Bearer $apiKey",
            "Content-Type: application/json",
        ],
    ]);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    if ($httpCode !== 200) {
        throw new Exception("HTTP $httpCode");
    }
    
    return json_decode($response, true);
}

// Usage
try {
    $result = getOrders($bellaApiKey, $baseUrl);
    print_r($result['data']);
} catch (Exception $e) {
    echo "Error: " . $e->getMessage();
}
```

---

## 📊 Step 3: Understand the Response

All API responses follow a standard format:

### Success Response

```json
{
  "success": true,
  "data": {
    "id": "ord_abc123",
    "customer_id": "cus_xyz789",
    "total": 500000,
    "status": "completed",
    "created_at": "2026-06-18T10:30:00Z"
  },
  "meta": {
    "request_id": "req_def456",
    "timestamp": "2026-06-18T10:30:01Z",
    "version": "v1"
  }
}
```

### Error Response

```json
{
  "success": false,
  "error": {
    "code": "INVALID_API_KEY",
    "message": "The provided API key is invalid or inactive",
    "details": {
      "api_key": "pk_test_***"
    }
  },
  "meta": {
    "request_id": "req_def456",
    "timestamp": "2026-06-18T10:30:01Z",
    "version": "v1"
  }
}
```

### Paginated Response

```json
{
  "success": true,
  "data": [
    { "id": "ord_1", ... },
    { "id": "ord_2", ... }
  ],
  "pagination": {
    "page": 1,
    "per_page": 20,
    "total": 150,
    "total_pages": 8,
    "next": "/api/v1/orders?page=2",
    "prev": null
  },
  "meta": { ... }
}
```

---

## 🔐 Step 4: Authentication

### API Key in Header

The API key must be included in the `Authorization` header:

```
Authorization: Bearer pk_test_abc123xyz789...
```

### Common Mistakes

❌ **Wrong**:
```bash
# Missing "Bearer" prefix
-H "Authorization: pk_test_abc123xyz789..."

# Wrong header name
-H "X-API-Key: pk_test_abc123xyz789..."

# In query parameters (INSECURE!)
GET /api/v1/orders?api_key=pk_test_abc123xyz789...
```

✅ **Correct**:
```bash
-H "Authorization: Bearer pk_test_abc123xyz789..."
```

---

## ⚡ Step 5: Rate Limits

All API requests are rate limited to ensure fair usage:

| Environment | Requests/Min | Requests/Day |
|-------------|--------------|--------------|
| **Sandbox** | Unlimited | Unlimited |
| **Production (Basic)** | 300 | 10,000 |
| **Production (Pro)** | 1,000 | 100,000 |
| **Production (Enterprise)** | 5,000 | 1,000,000 |

### Rate Limit Headers

Every response includes rate limit information:

```
X-RateLimit-Limit: 300
X-RateLimit-Remaining: 250
X-RateLimit-Reset: 1718611200
```

### Handling Rate Limits

When you exceed the rate limit, you'll receive a `429 Too Many Requests` response:

```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded",
    "details": {
      "limit": 300,
      "reset_at": "2026-06-18T11:00:00Z"
    }
  }
}
```

**Recommended Retry Logic**:

```typescript
async function makeRequestWithRetry(url, options, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    const response = await fetch(url, options);
    
    if (response.status === 429) {
      const resetTime = response.headers.get('X-RateLimit-Reset');
      const waitTime = (parseInt(resetTime) * 1000) - Date.now();
      
      console.log(`Rate limited. Waiting ${waitTime}ms...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      continue;
    }
    
    return response;
  }
  
  throw new Error('Max retries exceeded');
}
```

---

## 🧪 Step 6: Test with Sandbox Data

The sandbox environment comes with pre-seeded test data:

### Test Customers

```json
{
  "id": "cus_test_001",
  "name": "Nguyễn Thị Test",
  "phone": "0901234567",
  "email": "test@example.com"
}
```

### Test Products

```json
{
  "id": "prod_test_001",
  "name": "Massage Mẹ Bầu",
  "price": 500000,
  "category": "spa_service"
}
```

### Creating a Test Order

```bash
curl -X POST https://bella-spa-erp.vercel.app/api/v1/orders \
  -H "Authorization: Bearer pk_test_abc123xyz789..." \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(uuidgen)" \
  -d '{
    "customer_id": "cus_test_001",
    "items": [
      {
        "product_id": "prod_test_001",
        "quantity": 1
      }
    ],
    "notes": "Test order from sandbox"
  }'
```

### Resetting Sandbox Data

To start fresh, reset your sandbox:

```bash
curl -X DELETE https://bella-spa-erp.vercel.app/api/admin/sandbox/reset \
  -H "Authorization: Bearer pk_test_abc123xyz789..."
```

This will:
- Delete all your test orders
- Delete all your test customers
- Re-seed with fresh test data

---

## 📚 Next Steps

Now that you've made your first API call, explore more:

1. **[API Reference](./API_REFERENCE.md)** - Complete endpoint documentation
2. **[Authentication Guide](./AUTHENTICATION.md)** - Advanced auth patterns
3. **[Webhooks Guide](./WEBHOOKS.md)** - Receive real-time events
4. **[Error Handling](./ERROR_HANDLING.md)** - Handle errors gracefully
5. **[Best Practices](./BEST_PRACTICES.md)** - Production-ready patterns

---

## 🆘 Getting Help

### Documentation
- API Reference: [docs/api/API_REFERENCE.md](./API_REFERENCE.md)
- Status Page: https://status.bellaspa.vn
- Changelog: https://changelog.bellaspa.vn

### Support Channels
- **Technical Support**: api-support@bellaspa.vn
- **Partnership Inquiries**: api-partners@bellaspa.vn
- **Security Issues**: security@bellaspa.vn (PGP key available)
- **Response Time**: Within 24 hours (business days)

### Community
- GitHub Discussions: https://github.com/bellaspahcm/api-community
- Developer Forum: https://forum.bellaspa.vn/api
- Stack Overflow: Tag `bella-api`

---

## 🔒 Security Best Practices

Before going to production, review these security guidelines:

### ✅ DO:
- Store API keys in environment variables
- Use HTTPS for all requests
- Implement retry logic with exponential backoff
- Validate webhook signatures
- Log API errors for debugging
- Monitor rate limit headers
- Use idempotency keys for mutations

### ❌ DON'T:
- Commit API keys to version control
- Expose API keys in client-side code
- Share API keys between environments
- Ignore rate limit headers
- Skip input validation
- Use production keys in development

---

## 📊 Quick Reference

### HTTP Methods

| Method | Usage | Idempotent? |
|--------|-------|-------------|
| `GET` | Retrieve resources | ✅ Yes |
| `POST` | Create resources | ❌ No (use idempotency key) |
| `PATCH` | Update resources partially | ❌ No (use idempotency key) |
| `PUT` | Replace resources | ❌ No (use idempotency key) |
| `DELETE` | Delete resources | ✅ Yes |

### Common Status Codes

| Code | Meaning | Action |
|------|---------|--------|
| `200` | Success | Continue |
| `201` | Created | Resource created successfully |
| `400` | Bad Request | Fix request payload |
| `401` | Unauthorized | Check API key |
| `403` | Forbidden | Check permissions |
| `404` | Not Found | Check resource ID |
| `429` | Rate Limited | Wait and retry |
| `500` | Server Error | Retry with exponential backoff |

### Required Headers

| Header | Value | Required |
|--------|-------|----------|
| `Authorization` | `Bearer <api_key>` | ✅ Always |
| `Content-Type` | `application/json` | ✅ For POST/PUT/PATCH |
| `Idempotency-Key` | UUID v4 | ✅ For mutations |

---

**Last Updated**: 2026-06-18  
**API Version**: v1  
**Document Version**: 1.0.0

For the latest updates, visit: https://docs.bellaspa.vn/api/getting-started
