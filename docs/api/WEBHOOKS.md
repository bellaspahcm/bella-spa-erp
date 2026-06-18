# Webhooks Guide

## Table of Contents
- [Overview](#overview)
- [Webhook Events](#webhook-events)
- [Setting Up Webhooks](#setting-up-webhooks)
- [Webhook Payloads](#webhook-payloads)
- [Security & Verification](#security--verification)
- [Retry Logic](#retry-logic)
- [Testing Webhooks](#testing-webhooks)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

---

## Overview

Webhooks allow Bella ERP to notify your system about events in real-time, eliminating the need for constant polling. When an event occurs (e.g., an order is created, a payment is received), Bella ERP sends an HTTP POST request to your configured webhook URL.

### Benefits of Webhooks

- **Real-time Updates**: Get notified instantly when events occur
- **Reduced API Calls**: No need to poll for changes
- **Lower Latency**: Faster integration response times
- **Better UX**: Update your UI immediately when data changes

### How It Works

```
┌─────────────┐           ┌─────────────┐           ┌─────────────┐
│  Bella ERP  │  Event    │   Webhook   │   POST    │  Your App   │
│   System    │──────────>│   Service   │──────────>│   Server    │
└─────────────┘  Occurs   └─────────────┘  Request  └─────────────┘
                                                             │
                                                             v
                                                      Process Event
```

1. An event occurs in Bella ERP (e.g., order created)
2. Webhook service prepares the payload and signs it
3. HTTP POST request sent to your webhook URL
4. Your server verifies the signature
5. Your server processes the event
6. Your server responds with `200 OK`
7. If request fails, Bella ERP retries with exponential backoff

---

## Webhook Events

### Available Events

| Event Type | Description | Trigger |
|-----------|-------------|---------|
| `order.created` | New order created | When a customer places a new order |
| `order.updated` | Order details updated | When order status, items, or metadata changes |
| `order.completed` | Order marked as completed | When order fulfillment is complete |
| `order.cancelled` | Order cancelled | When order is cancelled by staff or system |
| `payment.received` | Payment received | When payment is successfully processed |
| `payment.refunded` | Payment refunded | When a refund is issued |
| `invoice.created` | Invoice generated | When e-invoice is created |
| `invoice.cancelled` | Invoice cancelled | When e-invoice is cancelled |
| `customer.created` | New customer created | When a new customer registers |
| `customer.updated` | Customer details updated | When customer profile is modified |
| `booking.confirmed` | Booking confirmed | When a service booking is confirmed |
| `booking.cancelled` | Booking cancelled | When a booking is cancelled |

### Event Filtering

You can subscribe to specific events when configuring your webhook:

```json
{
  "webhook_url": "https://your-app.com/webhooks/bella",
  "webhook_events": [
    "order.created",
    "order.completed",
    "payment.received"
  ]
}
```

If `webhook_events` is not specified, you'll receive all events.

---

## Setting Up Webhooks

### Step 1: Create a Webhook Endpoint

Create an endpoint on your server that can receive POST requests:

```typescript
// TypeScript/Node.js Example
import express from 'express';
import crypto from 'crypto';

const app = express();
app.use(express.raw({ type: 'application/json' }));

app.post('/webhooks/bella', (req, res) => {
  const signature = req.headers['x-bella-signature'] as string;
  const timestamp = req.headers['x-bella-timestamp'] as string;
  const payload = req.body.toString('utf8');
  
  // Verify signature (see Security section)
  if (!verifySignature(signature, timestamp, payload)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }
  
  // Parse event
  const event = JSON.parse(payload);
  
  // Process event (async, non-blocking)
  processEvent(event).catch(console.error);
  
  // Respond immediately
  res.status(200).json({ received: true });
});

app.listen(3000);
```

```python
# Python/Flask Example
from flask import Flask, request, jsonify
import hmac
import hashlib
import json

app = Flask(__name__)

@app.route('/webhooks/bella', methods=['POST'])
def webhook():
    signature = request.headers.get('X-Bella-Signature')
    timestamp = request.headers.get('X-Bella-Timestamp')
    payload = request.get_data(as_text=True)
    
    # Verify signature
    if not verify_signature(signature, timestamp, payload):
        return jsonify({'error': 'Invalid signature'}), 401
    
    # Parse event
    event = json.loads(payload)
    
    # Process event (async)
    process_event(event)
    
    # Respond immediately
    return jsonify({'received': True}), 200

if __name__ == '__main__':
    app.run(port=3000)
```

```php
<?php
// PHP Example
header('Content-Type: application/json');

$signature = $_SERVER['HTTP_X_BELLA_SIGNATURE'] ?? '';
$timestamp = $_SERVER['HTTP_X_BELLA_TIMESTAMP'] ?? '';
$payload = file_get_contents('php://input');

// Verify signature
if (!verifySignature($signature, $timestamp, $payload)) {
    http_response_code(401);
    echo json_encode(['error' => 'Invalid signature']);
    exit;
}

// Parse event
$event = json_decode($payload, true);

// Process event (queue for async processing)
queueEvent($event);

// Respond immediately
http_response_code(200);
echo json_encode(['received' => true]);
?>
```

### Step 2: Register Your Webhook URL

Use the Admin UI or API to configure your webhook:

**Via Admin UI:**
1. Navigate to Settings → API Partners
2. Select your partner
3. Enter Webhook URL
4. Select events to subscribe
5. Save

**Via API:**
```bash
curl -X POST https://api.bellaspa.com/v1/partners \
  -H "X-API-Key: pk_live_YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "partner_name": "My POS System",
    "webhook_url": "https://your-app.com/webhooks/bella",
    "webhook_events": ["order.created", "payment.received"],
    "allowed_scopes": ["order:read", "payment:read"]
  }'
```

### Step 3: Test Your Endpoint

Send a test webhook from the Admin UI or use a webhook testing tool:

```bash
# Using ngrok for local testing
ngrok http 3000

# Update webhook URL to ngrok URL
curl -X PATCH https://api.bellaspa.com/v1/partners/{partner_id} \
  -H "X-API-Key: pk_live_YOUR_KEY" \
  -d '{"webhook_url": "https://abc123.ngrok.io/webhooks/bella"}'
```

---

## Webhook Payloads

### Payload Structure

All webhook payloads follow this structure:

```json
{
  "event_id": "evt_01HQZX8K9M3N2P4Q6R7S8T9V0W",
  "event_type": "order.created",
  "event_version": "v1",
  "created_at": "2026-06-18T10:30:00Z",
  "data": {
    // Event-specific data
  }
}
```

### Event-Specific Payloads

#### `order.created`

```json
{
  "event_id": "evt_01HQZX8K9M3N2P4Q6R7S8T9V0W",
  "event_type": "order.created",
  "event_version": "v1",
  "created_at": "2026-06-18T10:30:00Z",
  "data": {
    "order_id": "ord_01HQZX8K9M3N2P4Q6R7S8T9V0W",
    "order_number": "ORD-2026-06-18-001",
    "customer": {
      "id": "cus_01HQZX8K9M3N2P4Q6R7S8T9V0W",
      "name": "Nguyễn Văn A",
      "phone": "0901234567",
      "email": "nguyenvana@example.com"
    },
    "items": [
      {
        "product_id": "prod_01HQZX8K9M3N2P4Q6R7S8T9V0W",
        "product_name": "Massage Body 90 phút",
        "quantity": 1,
        "unit_price": 500000,
        "total_price": 500000
      }
    ],
    "subtotal": 500000,
    "discount": 50000,
    "tax": 0,
    "total": 450000,
    "status": "pending",
    "payment_status": "pending",
    "created_at": "2026-06-18T10:30:00Z"
  }
}
```

#### `payment.received`

```json
{
  "event_id": "evt_01HQZX8K9M3N2P4Q6R7S8T9V0W",
  "event_type": "payment.received",
  "event_version": "v1",
  "created_at": "2026-06-18T10:35:00Z",
  "data": {
    "payment_id": "pay_01HQZX8K9M3N2P4Q6R7S8T9V0W",
    "order_id": "ord_01HQZX8K9M3N2P4Q6R7S8T9V0W",
    "amount": 450000,
    "currency": "VND",
    "payment_method": "bank_transfer",
    "payment_gateway": "casso",
    "status": "completed",
    "transaction_id": "TXN123456789",
    "created_at": "2026-06-18T10:35:00Z"
  }
}
```

#### `order.completed`

```json
{
  "event_id": "evt_01HQZX8K9M3N2P4Q6R7S8T9V0W",
  "event_type": "order.completed",
  "event_version": "v1",
  "created_at": "2026-06-18T12:30:00Z",
  "data": {
    "order_id": "ord_01HQZX8K9M3N2P4Q6R7S8T9V0W",
    "order_number": "ORD-2026-06-18-001",
    "completed_at": "2026-06-18T12:30:00Z",
    "completed_by": {
      "id": "usr_01HQZX8K9M3N2P4Q6R7S8T9V0W",
      "name": "Nhân viên A"
    }
  }
}
```

#### `invoice.created`

```json
{
  "event_id": "evt_01HQZX8K9M3N2P4Q6R7S8T9V0W",
  "event_type": "invoice.created",
  "event_version": "v1",
  "created_at": "2026-06-18T12:35:00Z",
  "data": {
    "invoice_id": "inv_01HQZX8K9M3N2P4Q6R7S8T9V0W",
    "invoice_number": "INV-2026-06-18-001",
    "order_id": "ord_01HQZX8K9M3N2P4Q6R7S8T9V0W",
    "customer": {
      "name": "Nguyễn Văn A",
      "tax_code": "0123456789",
      "address": "123 Đường ABC, Quận 1, TP.HCM"
    },
    "total_amount": 450000,
    "tax_amount": 0,
    "status": "issued",
    "pdf_url": "https://cdn.bellaspa.com/invoices/INV-2026-06-18-001.pdf",
    "created_at": "2026-06-18T12:35:00Z"
  }
}
```

---

## Security & Verification

### Signature Verification

Every webhook request includes these headers:

- `X-Bella-Signature`: HMAC-SHA256 signature
- `X-Bella-Timestamp`: Unix timestamp (seconds)
- `X-Bella-Event-ID`: Unique event ID (for idempotency)

**Signature Calculation:**
```
signature = HMAC_SHA256(webhook_secret, timestamp + '.' + payload)
```

### Implementation Examples

#### TypeScript/Node.js

```typescript
import crypto from 'crypto';

function verifySignature(
  signature: string,
  timestamp: string,
  payload: string,
  webhookSecret: string
): boolean {
  // Check timestamp (prevent replay attacks)
  const now = Math.floor(Date.now() / 1000);
  const timestampNum = parseInt(timestamp, 10);
  
  if (Math.abs(now - timestampNum) > 300) {
    // Reject if timestamp is more than 5 minutes old
    return false;
  }
  
  // Calculate expected signature
  const signedPayload = `${timestamp}.${payload}`;
  const expectedSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(signedPayload, 'utf8')
    .digest('hex');
  
  // Constant-time comparison
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}
```

#### Python

```python
import hmac
import hashlib
import time

def verify_signature(signature, timestamp, payload, webhook_secret):
    # Check timestamp
    now = int(time.time())
    timestamp_int = int(timestamp)
    
    if abs(now - timestamp_int) > 300:
        return False
    
    # Calculate expected signature
    signed_payload = f"{timestamp}.{payload}"
    expected_signature = hmac.new(
        webhook_secret.encode('utf-8'),
        signed_payload.encode('utf-8'),
        hashlib.sha256
    ).hexdigest()
    
    # Constant-time comparison
    return hmac.compare_digest(signature, expected_signature)
```

#### PHP

```php
function verifySignature($signature, $timestamp, $payload, $webhookSecret) {
    // Check timestamp
    $now = time();
    $timestampInt = intval($timestamp);
    
    if (abs($now - $timestampInt) > 300) {
        return false;
    }
    
    // Calculate expected signature
    $signedPayload = $timestamp . '.' . $payload;
    $expectedSignature = hash_hmac('sha256', $signedPayload, $webhookSecret);
    
    // Constant-time comparison
    return hash_equals($signature, $expectedSignature);
}
```

### Security Best Practices

1. **Always verify signatures**: Never process unverified webhooks
2. **Check timestamps**: Reject old requests (>5 minutes)
3. **Use HTTPS**: Only accept webhooks over secure connections
4. **Validate event IDs**: Use `event_id` for idempotency
5. **Rotate secrets**: Periodically update `webhook_secret`
6. **Rate limit**: Protect your endpoint from abuse
7. **Log failed verifications**: Monitor for attacks

---

## Retry Logic

### Retry Behavior

If your endpoint fails to respond with `200 OK`, Bella ERP automatically retries:

| Attempt | Delay | Total Time |
|---------|-------|------------|
| 1st retry | 1 minute | 1 minute |
| 2nd retry | 5 minutes | 6 minutes |
| 3rd retry | 15 minutes | 21 minutes |
| 4th retry | 1 hour | 1h 21m |
| 5th retry | 3 hours | 4h 21m |
| Final retry | 6 hours | 10h 21m |

After 6 failed attempts, the webhook is marked as failed and you'll receive an email notification.

### Retry Headers

Retry requests include additional headers:

```
X-Bella-Retry-Count: 3
X-Bella-First-Attempt: 2026-06-18T10:30:00Z
```

### Handling Retries

Your endpoint should be **idempotent** to handle duplicate events:

```typescript
// Bad: Non-idempotent
app.post('/webhooks/bella', async (req, res) => {
  const event = req.body;
  
  // This will fail on retries
  await db.orders.create(event.data);
  
  res.status(200).json({ received: true });
});

// Good: Idempotent
app.post('/webhooks/bella', async (req, res) => {
  const event = req.body;
  const eventId = req.headers['x-bella-event-id'];
  
  // Check if already processed
  const existing = await db.webhookEvents.findOne({ eventId });
  if (existing) {
    return res.status(200).json({ received: true, duplicate: true });
  }
  
  // Process event
  await db.webhookEvents.create({ eventId, processedAt: new Date() });
  await processOrder(event.data);
  
  res.status(200).json({ received: true });
});
```

---

## Testing Webhooks

### Local Development

Use tunneling tools to expose your local server:

**Using ngrok:**
```bash
# Start local server
npm run dev  # Runs on http://localhost:3000

# Create tunnel
ngrok http 3000

# Update webhook URL to ngrok URL
# https://abc123.ngrok.io/webhooks/bella
```

**Using CloudFlare Tunnel:**
```bash
cloudflared tunnel --url http://localhost:3000
```

### Webhook Testing Tools

1. **Webhook.site**: Free webhook testing
   - Visit https://webhook.site
   - Copy your unique URL
   - Configure Bella ERP to send webhooks there
   - Inspect payloads and headers

2. **RequestBin**: Similar to Webhook.site
   - Visit https://requestbin.com
   - Create a bin
   - Test webhook structure

3. **Postman**: Simulate webhook requests
   - Create a new request
   - Set method to POST
   - Add headers (`X-Bella-Signature`, `X-Bella-Timestamp`)
   - Add sample payload
   - Test your verification logic

### Sandbox Testing

Use the sandbox environment to test without affecting production:

```bash
# Create sandbox partner
curl -X POST https://api.bellaspa.com/v1/partners \
  -H "X-API-Key: pk_live_YOUR_KEY" \
  -d '{
    "partner_name": "Test Webhooks",
    "is_sandbox": true,
    "webhook_url": "https://webhook.site/abc123",
    "webhook_events": ["order.created"]
  }'

# Trigger test events via sandbox API
curl -X POST https://api.bellaspa.com/v1/sandbox/orders \
  -H "X-API-Key: pk_test_SANDBOX_KEY" \
  -d '{
    "customer_id": "cus_sandbox_001",
    "items": [{"product_id": "prod_001", "quantity": 1}]
  }'
```

---

## Best Practices

### 1. Respond Quickly

Always respond with `200 OK` within **5 seconds**:

```typescript
// Bad: Process synchronously
app.post('/webhooks/bella', async (req, res) => {
  await longRunningProcess(req.body);  // May take >5 seconds
  res.status(200).json({ received: true });
});

// Good: Queue for async processing
app.post('/webhooks/bella', async (req, res) => {
  await queue.add('process-webhook', req.body);  // Fast
  res.status(200).json({ received: true });
});
```

### 2. Use Event IDs for Idempotency

Store processed event IDs to prevent duplicate processing:

```typescript
const eventId = req.headers['x-bella-event-id'];

// Check if already processed
const isDuplicate = await redis.get(`webhook:${eventId}`);
if (isDuplicate) {
  return res.status(200).json({ received: true, duplicate: true });
}

// Mark as processed (24 hour expiry)
await redis.set(`webhook:${eventId}`, 'processed', 'EX', 86400);
```

### 3. Handle Failures Gracefully

Don't let one bad event block all webhooks:

```typescript
app.post('/webhooks/bella', async (req, res) => {
  try {
    await processEvent(req.body);
    res.status(200).json({ received: true });
  } catch (error) {
    // Log error but still return 200 to prevent retries
    console.error('Webhook processing failed:', error);
    
    // Store failed event for manual review
    await db.failedWebhooks.create({
      eventId: req.headers['x-bella-event-id'],
      payload: req.body,
      error: error.message,
    });
    
    res.status(200).json({ received: true, error: error.message });
  }
});
```

### 4. Monitor Webhook Health

Track webhook performance:

```typescript
const start = Date.now();

try {
  await processEvent(req.body);
  
  // Log success
  await metrics.recordWebhook({
    eventType: req.body.event_type,
    status: 'success',
    duration: Date.now() - start,
  });
} catch (error) {
  // Log failure
  await metrics.recordWebhook({
    eventType: req.body.event_type,
    status: 'error',
    duration: Date.now() - start,
    error: error.message,
  });
}
```

### 5. Version Your Webhook Handlers

Support multiple API versions:

```typescript
app.post('/webhooks/bella', async (req, res) => {
  const version = req.body.event_version;
  
  switch (version) {
    case 'v1':
      await handleV1Event(req.body);
      break;
    case 'v2':
      await handleV2Event(req.body);
      break;
    default:
      console.warn(`Unknown version: ${version}`);
  }
  
  res.status(200).json({ received: true });
});
```

---

## Troubleshooting

### Webhooks Not Being Received

**Check 1: Verify URL is accessible**
```bash
curl -X POST https://your-app.com/webhooks/bella \
  -H "Content-Type: application/json" \
  -d '{"test": true}'
```

**Check 2: Verify firewall/security groups**
- Allow inbound traffic on port 443 (HTTPS)
- Whitelist Bella ERP IP addresses (if needed)

**Check 3: Check webhook configuration**
```bash
curl https://api.bellaspa.com/v1/partners/{partner_id} \
  -H "X-API-Key: pk_live_YOUR_KEY"
```

**Check 4: Review webhook logs**
- Check Admin UI → API Partners → Webhook Logs
- Look for failed attempts and error messages

### Signature Verification Fails

**Issue 1: Incorrect secret**
- Verify you're using the correct `webhook_secret`
- Check for leading/trailing whitespace

**Issue 2: Charset mismatch**
```typescript
// Ensure UTF-8 encoding
const payload = req.body.toString('utf8');
```

**Issue 3: Body parsing**
```typescript
// Don't parse JSON before verification
app.use(express.raw({ type: 'application/json' }));

// Parse after verification
const event = JSON.parse(payload);
```

### High Retry Rate

**Issue: Slow response times**
- Respond within 5 seconds
- Queue long-running tasks
- Scale your infrastructure

**Issue: Non-idempotent handlers**
- Use `event_id` to track processed events
- Implement duplicate detection

**Issue: Intermittent failures**
- Add retry logic in your processing
- Store failed events for manual review

### Events Out of Order

Webhooks may arrive out of chronological order:

```typescript
// Use timestamps to order events
const events = await db.webhookEvents.findAll({
  where: { orderId: order.id },
  order: [['created_at', 'ASC']],
});

// Process in correct order
for (const event of events) {
  await processEvent(event);
}
```

### Missing Events

Events may be lost due to:
- Network failures during delivery
- Your endpoint being down
- Bella ERP service issues

**Solution**: Implement periodic polling as backup:

```typescript
// Every hour, check for orders updated since last sync
setInterval(async () => {
  const lastSync = await getLastSyncTime();
  const orders = await bellaAPI.getOrders({
    updated_after: lastSync,
  });
  
  for (const order of orders) {
    await syncOrder(order);
  }
  
  await saveLastSyncTime(new Date());
}, 3600000);
```

---

## Support

If you need help with webhooks:

1. **Documentation**: Review this guide and [API Reference](./API_REFERENCE.md)
2. **Admin UI**: Check webhook logs in Settings → API Partners
3. **Email Support**: api-support@bellaspa.com
4. **Response Time**: Within 24 hours (business days)

---

## Related Documentation

- [Getting Started](./GETTING_STARTED.md)
- [API Reference](./API_REFERENCE.md)
- [Security Best Practices](./SECURITY_BEST_PRACTICES.md)
- [Error Handling](./ERROR_HANDLING.md)
