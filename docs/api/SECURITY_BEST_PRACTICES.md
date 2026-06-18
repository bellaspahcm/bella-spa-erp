# Security Best Practices - Bella API

Essential security guidelines for partners integrating with Bella API.

---

## 🔒 API Key Security

### 1. Storage

**✅ DO:**
- Store API keys in environment variables
- Use secret management services (AWS Secrets Manager, HashiCorp Vault, Azure Key Vault)
- Encrypt API keys at rest in databases
- Use separate keys for development/staging/production

**❌ DON'T:**
- Hardcode API keys in source code
- Commit API keys to version control
- Share API keys via email/chat
- Expose API keys in client-side code
- Log API keys in plain text

**Example - Secure Storage:**
```typescript
// ✅ Good: Environment variable
const apiKey = process.env.BELLA_API_KEY;
if (!apiKey) {
  throw new Error('BELLA_API_KEY not configured');
}

// ✅ Better: Secret manager
import { SecretsManager } from 'aws-sdk';
const secretsManager = new SecretsManager();

async function getAPIKey() {
  const secret = await secretsManager.getSecretValue({
    SecretId: 'bella-api-key-production'
  }).promise();
  return JSON.parse(secret.SecretString).apiKey;
}
```

### 2. Key Rotation

Rotate API keys regularly to minimize risk:

**Recommended Schedule:**
- Production keys: Every 90 days
- Test keys: Every 180 days
- After security incident: Immediately
- After employee departure: Within 24 hours

**Rotation Process:**
1. Request new API key from Bella admin
2. Deploy new key to staging environment
3. Test thoroughly
4. Deploy to production
5. Monitor for 24 hours
6. Revoke old key

**Zero-Downtime Rotation:**
```typescript
class APIKeyManager {
  private primary: string;
  private secondary: string | null;

  constructor() {
    this.primary = process.env.BELLA_API_KEY_PRIMARY!;
    this.secondary = process.env.BELLA_API_KEY_SECONDARY || null;
  }

  getKey(): string {
    // Try secondary first during rotation
    return this.secondary || this.primary;
  }

  async rotateKey(newKey: string) {
    // Phase 1: Add new key as secondary
    this.secondary = newKey;
    await this.testKey(newKey);

    // Phase 2: Wait for propagation (24h recommended)
    await new Promise(resolve => setTimeout(resolve, 24 * 60 * 60 * 1000));

    // Phase 3: Promote secondary to primary
    this.primary = newKey;
    this.secondary = null;
  }

  private async testKey(key: string): Promise<boolean> {
    // Test key with read-only operation
    try {
      const response = await fetch('https://bella-spa-erp.vercel.app/api/v1/orders?per_page=1', {
        headers: { 'Authorization': `Bearer ${key}` }
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}
```

### 3. Key Leakage Detection

**Monitor for leaks:**
- GitHub secret scanning
- GitGuardian
- TruffleHog
- Manual code reviews

**If key is leaked:**
1. **Immediate action** (within 1 hour):
   - Rotate API key immediately
   - Revoke compromised key
   - Review audit logs for unauthorized access

2. **Investigation** (within 24 hours):
   - Identify leak source
   - Assess impact (what data was accessed?)
   - Document incident

3. **Prevention** (within 1 week):
   - Fix root cause
   - Implement additional controls
   - Train team on secure practices

---

## 🔐 Authentication Security

### HTTPS Only

**Always use HTTPS**, never HTTP:

```typescript
// ✅ Good
const BASE_URL = 'https://bella-spa-erp.vercel.app/api/v1';

// ❌ Bad
const BASE_URL = 'http://bella-spa-erp.vercel.app/api/v1';
```

### TLS Version

Minimum TLS 1.2 required:

```typescript
import https from 'https';

const agent = new https.Agent({
  minVersion: 'TLSv1.2',
  maxVersion: 'TLSv1.3',
});

fetch(url, { agent });
```

### Certificate Validation

Never disable certificate validation:

```typescript
// ❌ NEVER do this
const agent = new https.Agent({
  rejectUnauthorized: false, // INSECURE!
});
```

---

## 🛡️ Input Validation

### Validate All User Input

**Rule**: Never trust user input, always validate:

```typescript
import { z } from 'zod';

// Define schema
const CreateOrderSchema = z.object({
  customer_id: z.string().uuid(),
  items: z.array(z.object({
    product_id: z.string().uuid(),
    quantity: z.number().int().min(1).max(100),
  })).min(1).max(50),
  notes: z.string().max(1000).optional(),
});

// Validate before sending to API
async function createOrder(input: unknown) {
  const validated = CreateOrderSchema.parse(input); // Throws if invalid
  
  return await bellaAPI.post('/orders', validated);
}
```

### Sanitize String Inputs

Prevent XSS and injection attacks:

```typescript
import DOMPurify from 'isomorphic-dompurify';

function sanitizeInput(input: string): string {
  // Remove HTML tags
  const clean = DOMPurify.sanitize(input, { ALLOWED_TAGS: [] });
  
  // Trim whitespace
  return clean.trim();
}

// Usage
const order = {
  customer_id: customerId,
  notes: sanitizeInput(userInput),
};
```

---

## 🔔 Webhook Security

### 1. Signature Verification

**ALWAYS verify webhook signatures**:

```typescript
import crypto from 'crypto';

function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  // Use constant-time comparison to prevent timing attacks
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

// Express middleware
app.post('/webhooks/bella', express.raw({ type: 'application/json' }), (req, res) => {
  const signature = req.headers['x-bella-signature'] as string;
  const payload = req.body.toString('utf8');

  if (!verifyWebhookSignature(payload, signature, WEBHOOK_SECRET)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  // Signature valid, process webhook
  const event = JSON.parse(payload);
  processWebhook(event);

  res.status(200).json({ received: true });
});
```

### 2. Replay Attack Prevention

Prevent replay attacks with timestamp validation:

```typescript
function verifyWebhookTimestamp(timestamp: string, toleranceSeconds: number = 300): boolean {
  const eventTime = new Date(timestamp).getTime();
  const currentTime = Date.now();
  const diff = Math.abs(currentTime - eventTime) / 1000;

  return diff <= toleranceSeconds;
}

// Usage
if (!verifyWebhookTimestamp(event.created_at, 300)) {
  return res.status(400).json({ error: 'Webhook timestamp too old' });
}
```

### 3. Idempotent Webhook Processing

Process each webhook exactly once:

```typescript
const processedEvents = new Set<string>();

async function processWebhook(event: WebhookEvent) {
  // Check if already processed
  if (processedEvents.has(event.id)) {
    console.log('Duplicate webhook, skipping:', event.id);
    return;
  }

  try {
    // Process event
    await handleEvent(event);

    // Mark as processed
    processedEvents.add(event.id);
    await saveProcessedEventId(event.id); // Persist to database
  } catch (error) {
    console.error('Webhook processing failed:', error);
    throw error; // Bella will retry
  }
}
```

---

## 🚨 Error Handling Security

### Don't Leak Sensitive Information

```typescript
// ❌ Bad: Exposes internal details
catch (error) {
  res.status(500).json({
    error: error.message, // May contain sensitive info
    stack: error.stack,   // NEVER expose stack traces
    query: sqlQuery,      // NEVER expose queries
  });
}

// ✅ Good: Generic error message
catch (error) {
  console.error('[Internal]', error); // Log internally
  
  res.status(500).json({
    error: 'An error occurred processing your request',
    request_id: requestId, // For support reference
  });
}
```

### Log Securely

```typescript
// ❌ Bad: Logs sensitive data
console.log('API request:', {
  apiKey: req.headers.authorization, // NEVER log API keys
  password: req.body.password,       // NEVER log passwords
  creditCard: req.body.card_number,  // NEVER log PII
});

// ✅ Good: Redact sensitive data
console.log('API request:', {
  apiKey: '***REDACTED***',
  endpoint: req.url,
  method: req.method,
  userId: req.user?.id,
});
```

---

## 🔄 Rate Limiting Security

### Implement Client-Side Rate Limiting

Respect API rate limits:

```typescript
class RateLimiter {
  private queue: Array<() => Promise<any>> = [];
  private processing = false;
  private requestsThisMinute = 0;
  private minuteStart = Date.now();

  async enqueue<T>(operation: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await operation();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });

      this.process();
    });
  }

  private async process() {
    if (this.processing || this.queue.length === 0) return;

    this.processing = true;

    while (this.queue.length > 0) {
      // Reset counter every minute
      if (Date.now() - this.minuteStart > 60000) {
        this.requestsThisMinute = 0;
        this.minuteStart = Date.now();
      }

      // Check rate limit (e.g., 300/minute)
      if (this.requestsThisMinute >= 300) {
        const waitTime = 60000 - (Date.now() - this.minuteStart);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }

      const operation = this.queue.shift()!;
      this.requestsThisMinute++;
      
      try {
        await operation();
      } catch (error) {
        console.error('Rate limiter operation failed:', error);
      }
    }

    this.processing = false;
  }
}

// Usage
const rateLimiter = new RateLimiter();

async function createOrder(data: any) {
  return rateLimiter.enqueue(() => 
    bellaAPI.post('/orders', data)
  );
}
```

---

## 🔍 Monitoring & Auditing

### Log All API Interactions

```typescript
interface APILog {
  timestamp: string;
  method: string;
  endpoint: string;
  status: number;
  duration_ms: number;
  request_id: string;
  user_id?: string;
  error?: string;
}

async function logAPICall(log: APILog) {
  // Send to logging service (DataDog, Sentry, etc.)
  await logger.info('bella_api_call', log);
}

// Middleware
async function requestWithLogging(method: string, path: string, data?: any) {
  const start = Date.now();
  const requestId = crypto.randomUUID();

  try {
    const response = await fetch(baseUrl + path, {
      method,
      headers: { 'Authorization': `Bearer ${apiKey}` },
      body: data ? JSON.stringify(data) : undefined,
    });

    await logAPICall({
      timestamp: new Date().toISOString(),
      method,
      endpoint: path,
      status: response.status,
      duration_ms: Date.now() - start,
      request_id: requestId,
    });

    return response;
  } catch (error) {
    await logAPICall({
      timestamp: new Date().toISOString(),
      method,
      endpoint: path,
      status: 0,
      duration_ms: Date.now() - start,
      request_id: requestId,
      error: error.message,
    });

    throw error;
  }
}
```

### Alert on Anomalies

```typescript
class SecurityMonitor {
  private failureCount = 0;
  private lastFailure = 0;

  async checkAnomaly(error: BellaAPIError) {
    this.failureCount++;
    this.lastFailure = Date.now();

    // Alert on repeated auth failures
    if (error.code === 'INVALID_API_KEY' && this.failureCount > 5) {
      await this.sendAlert({
        severity: 'CRITICAL',
        message: 'Repeated API authentication failures',
        count: this.failureCount,
      });
    }

    // Alert on rate limit hits
    if (error.code === 'RATE_LIMIT_EXCEEDED') {
      await this.sendAlert({
        severity: 'WARNING',
        message: 'Rate limit exceeded',
        recommendation: 'Review request volume or upgrade tier',
      });
    }

    // Alert on unusual error patterns
    if (this.failureCount > 50) {
      await this.sendAlert({
        severity: 'HIGH',
        message: 'High API error rate',
        count: this.failureCount,
      });
    }
  }

  private async sendAlert(alert: any) {
    // Send to PagerDuty, OpsGenie, etc.
    await alertService.send(alert);
  }
}
```

---

## 📋 Security Checklist

Before going to production, verify:

### API Key Management
- [ ] API keys stored in secure vault
- [ ] Keys not committed to version control
- [ ] Separate keys for each environment
- [ ] Key rotation schedule established
- [ ] Leaked key response plan documented

### Authentication
- [ ] HTTPS only (TLS 1.2+)
- [ ] Certificate validation enabled
- [ ] Authorization header format correct
- [ ] Keys never in query parameters or URLs

### Input Validation
- [ ] All user input validated with schemas
- [ ] String inputs sanitized
- [ ] Size limits enforced
- [ ] Type checking implemented

### Webhook Security
- [ ] Signature verification implemented
- [ ] Timestamp validation enabled
- [ ] Replay attack prevention
- [ ] Idempotent processing
- [ ] HTTPS endpoint only

### Error Handling
- [ ] Generic error messages to clients
- [ ] Sensitive data redacted from logs
- [ ] Stack traces never exposed
- [ ] Internal errors logged separately

### Monitoring
- [ ] All API calls logged
- [ ] Anomaly detection configured
- [ ] Alert rules defined
- [ ] Security incidents tracked

### Compliance
- [ ] Data retention policy defined
- [ ] PII handling procedures documented
- [ ] GDPR/privacy requirements met
- [ ] Security audit completed

---

## 🆘 Incident Response

### If API Key is Compromised

**Immediate (0-1 hour):**
1. Rotate API key via Bella admin portal
2. Revoke compromised key
3. Review recent API logs for unauthorized access
4. Block suspicious IPs if necessary

**Investigation (1-24 hours):**
1. Identify how key was leaked
2. Check for data exfiltration
3. Assess customer impact
4. Document timeline

**Remediation (1-7 days):**
1. Fix leak source (code, process, training)
2. Implement additional controls
3. Notify affected customers if required
4. Update security procedures

**Contact:**
- **Emergency**: security@bellaspa.vn
- **PGP Key**: Available at https://bellaspa.vn/.well-known/security.txt
- **Response Time**: Within 1 hour for critical incidents

---

## 📚 Additional Resources

- [OWASP API Security Top 10](https://owasp.org/www-project-api-security/)
- [CWE Top 25 Software Weaknesses](https://cwe.mitre.org/top25/)
- [Bella Security Policy](./SECURITY_POLICY.md)
- [Bella Vulnerability Disclosure](./VULNERABILITY_DISCLOSURE.md)

---

**Document Version**: 1.0.0  
**Last Updated**: 2026-06-18  
**Next Review**: 2026-09-18

Report security issues: security@bellaspa.vn (PGP encouraged)
