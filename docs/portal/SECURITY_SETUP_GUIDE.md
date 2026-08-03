# Security Setup Guide - Partner Registration System

## Overview
Multi-layered security protection for the Partner Registration system.

**Security Features:**
1. ✅ **Rate Limiting** - Prevent spam/abuse
2. ✅ **reCAPTCHA v3** - Bot detection
3. ✅ **Spam Detection** - Content/IP/Email validation
4. ✅ **Input Validation** - XSS/SQL injection prevention
5. ✅ **IP Blocking** - Automatic threat blocking

**Time Required:** 30 minutes  
**Difficulty:** Moderate

---

## 1. Rate Limiting

### What It Does
- Limits requests per IP address
- Prevents spam/DDoS attacks
- Configurable per endpoint

### Configuration
Rate limits are defined in `src/lib/security/rate-limiter.ts`:

```typescript
export const RATE_LIMITS = {
  PARTNER_REGISTRATION: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 3, // 3 registrations per hour per IP
  },
  EMAIL_VERIFICATION: {
    windowMs: 60 * 60 * 1000,
    maxRequests: 5, // 5 verifications per hour
  },
  LOGIN_ATTEMPTS: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5, // 5 attempts per 15 min
  },
};
```

### Customization
Adjust limits based on your needs:

```typescript
// More strict (e.g., high-traffic production)
PARTNER_REGISTRATION: {
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  maxRequests: 1, // 1 per day per IP
}

// More lenient (e.g., testing/development)
PARTNER_REGISTRATION: {
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 10, // 10 per minute
}
```

### Storage Backend
Current: **In-memory** (single instance)
Production: **Redis** (multi-instance)

**To migrate to Redis:**
1. Install Redis client: `npm install redis`
2. Update `rate-limiter.ts` to use Redis
3. Set `REDIS_URL` in environment

---

## 2. reCAPTCHA v3 Setup

### Step 1: Register Your Site
1. Go to https://www.google.com/recaptcha/admin/create
2. Fill in:
   - **Label:** Bella ERP Partner Portal
   - **reCAPTCHA type:** Select **reCAPTCHA v3**
   - **Domains:** Add your domains:
     - `localhost` (development)
     - `bella-erp.com` (production)
     - `*.vercel.app` (staging/preview)
3. Accept terms and click **Submit**

### Step 2: Get Your Keys
After registration, you'll see:
- **Site Key** (public, used in frontend)
- **Secret Key** (private, used in backend)

Example:
```
Site Key: 6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI
Secret Key: 6LeIxAcTAAAAAGG-vFI1TnRWxMZNFuojJ4WifJWe
```

### Step 3: Add to Environment
Add to `.env.local` (development):
```bash
NEXT_PUBLIC_RECAPTCHA_SITE_KEY=6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI
RECAPTCHA_SECRET_KEY=6LeIxAcTAAAAAGG-vFI1TnRWxMZNFuojJ4WifJWe
```

Add to Vercel (production):
1. Go to Project Settings → Environment Variables
2. Add:
   ```
   NEXT_PUBLIC_RECAPTCHA_SITE_KEY = your-site-key-here
   RECAPTCHA_SECRET_KEY = your-secret-key-here
   ```
3. Select environments: Production, Preview, Development
4. Click **Save** and redeploy

### Step 4: Frontend Integration
Add reCAPTCHA script to your registration page:

```tsx
// src/app/partner/register/page.tsx
'use client';

import { useEffect, useState } from 'react';
import Script from 'next/script';

export default function RegisterPage() {
  const [recaptchaToken, setRecaptchaToken] = useState('');
  const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Get reCAPTCHA token
    if (window.grecaptcha) {
      const token = await window.grecaptcha.execute(siteKey, {
        action: 'partner_registration'
      });
      
      // Submit with token
      const response = await fetch('/api/partner/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          recaptcha_token: token,
        }),
      });
      
      // Handle response...
    }
  };
  
  return (
    <>
      <Script
        src={`https://www.google.com/recaptcha/api.js?render=${siteKey}`}
        strategy="afterInteractive"
      />
      
      <form onSubmit={handleSubmit}>
        {/* Form fields... */}
      </form>
    </>
  );
}
```

### Step 5: Verify Score Thresholds
reCAPTCHA v3 returns a score (0.0 - 1.0):
- **1.0** = Very likely human
- **0.5** = Neutral (default threshold)
- **0.0** = Very likely bot

**Adjust thresholds in `src/lib/security/recaptcha.ts`:**
```typescript
export const RECAPTCHA_THRESHOLDS = {
  REGISTRATION: 0.5, // Strict (fewer false positives)
  LOGIN: 0.4, // Moderate
  CONTACT_FORM: 0.3, // Lenient (avoid blocking real users)
};
```

### Step 6: Test reCAPTCHA
Google provides test keys for development:

**Test Keys (always pass):**
```
Site Key: 6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI
Secret Key: 6LeIxAcTAAAAAGG-vFI1TnRWxMZNFuojJ4WifJWe
```

**Test Keys (always fail):**
```
Site Key: 6LdozgATAAAAAMbC4K8TQcYqJP7XJJJEf0Tk3h_w
Secret Key: 6LdozgATAAAAAPE8bTFnwPPl9Y8PKdHBp1N8SPXZ
```

---

## 3. Spam Detection

### Email Validation
- ✅ Format validation (RFC 5322)
- ✅ Disposable email detection
- ✅ Domain blacklist

**Add disposable domains:**
```typescript
// src/lib/security/spam-detector.ts
import { addDisposableEmailDomain } from '@/lib/security/spam-detector';

addDisposableEmailDomain('tempmail.xyz');
addDisposableEmailDomain('fakeinbox.net');
```

### Phone Validation
- ✅ Vietnamese format (03x, 05x, 07x, 08x, 09x)
- ✅ Length validation (10 digits)
- ✅ Invalid prefix detection

### Content Validation
- ✅ Spam keyword detection
- ✅ URL pattern detection
- ✅ Suspicious character patterns

### IP-Based Detection
- ✅ Multiple registrations from same IP
- ✅ Rapid-fire requests (bot-like)
- ✅ Failed verification attempts

**Spam Score Calculation:**
- Disposable email: +50 points
- Multiple registrations: +30 points
- Rapid requests: +20 points
- Failed verifications: +20 points
- Spam content: +40 points

**Actions:**
- **0-39**: Allow (low risk)
- **40-59**: Review (medium risk)
- **60-79**: High risk (flag for review)
- **80-100**: Block (critical risk)

---

## 4. IP Blocking

### Manual Blocking
```typescript
import { blockIp, unblockIp } from '@/lib/security/spam-detector';

// Block an IP
blockIp('192.168.1.100', 'Spam activity detected');

// Unblock an IP
unblockIp('192.168.1.100');
```

### Automatic Blocking
Automatic blocks trigger when:
- Spam score >= 80
- Multiple rate limit violations
- Repeated reCAPTCHA failures

### View Blocked IPs
Check logs:
```bash
# Search application logs for blocked IPs
grep "Blocked IP" /var/log/app.log

# Or check in-memory store (dev console)
import { isIpBlocked } from '@/lib/security/spam-detector';
console.log(isIpBlocked('192.168.1.100'));
```

---

## 5. Security Headers

### Recommended Headers (add to `next.config.js`):
```javascript
module.exports = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
    ];
  },
};
```

---

## 6. Monitoring & Alerts

### Log Files
Security events are logged to:
- Console (development)
- Application logs (production)
- External monitoring (Sentry, DataDog)

### Key Metrics to Monitor
1. **Rate Limit Hits**: High frequency → adjust limits
2. **reCAPTCHA Failures**: High rate → bot attack
3. **Spam Blocks**: Sudden spike → coordinated attack
4. **IP Blocks**: Track blocked IPs over time

### Alert Thresholds
Set up alerts for:
- **>10 rate limit hits/hour** → Possible DDoS
- **>50 reCAPTCHA failures/hour** → Bot attack
- **>20 spam blocks/hour** → Spam campaign
- **>5 IP blocks/day** → Review security config

### Integration with Sentry
```bash
npm install @sentry/nextjs
```

Add to `sentry.client.config.ts`:
```typescript
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 1.0,
  
  beforeSend(event, hint) {
    // Add security context
    if (event.tags) {
      event.tags.security_event = true;
    }
    return event;
  },
});
```

---

## 7. Testing Security

### Test Rate Limiting
```bash
# Send 4 requests rapidly (should hit rate limit on 4th)
for i in {1..4}; do
  curl -X POST http://localhost:3000/api/partner/register \
    -H "Content-Type: application/json" \
    -d '{"full_name":"Test","email":"test@example.com","phone":"0901234567","applicant_type":"individual","recaptcha_token":"test"}' \
  echo "\nRequest $i done"
  sleep 1
done

# Expected: First 3 succeed, 4th returns 429
```

### Test reCAPTCHA
```typescript
// Invalid token (should fail)
fetch('/api/partner/register', {
  method: 'POST',
  body: JSON.stringify({
    ...data,
    recaptcha_token: 'invalid-token',
  }),
});

// No token (should fail)
fetch('/api/partner/register', {
  method: 'POST',
  body: JSON.stringify({ ...data }), // No recaptcha_token
});
```

### Test Spam Detection
```typescript
// Disposable email (should be flagged/blocked)
{
  email: 'test@tempmail.com',
}

// Spam content (should be flagged)
{
  company_name: 'Buy Viagra Now! Click Here!',
}

// Invalid phone (should fail validation)
{
  phone: '123', // Too short
}
```

---

## 8. Production Checklist

Before going live:

### reCAPTCHA
- [ ] Production keys registered
- [ ] Domain added to reCAPTCHA console
- [ ] Keys added to Vercel environment
- [ ] Test with production keys
- [ ] Score thresholds configured

### Rate Limiting
- [ ] Limits configured appropriately
- [ ] Redis configured (if multi-instance)
- [ ] Rate limit headers visible in responses
- [ ] Test rate limit enforcement

### Spam Detection
- [ ] Disposable email list updated
- [ ] Spam patterns reviewed
- [ ] Block thresholds configured
- [ ] IP blocking tested

### Monitoring
- [ ] Sentry/monitoring tool integrated
- [ ] Security event logs reviewed
- [ ] Alert thresholds configured
- [ ] Response playbook documented

### Security Headers
- [ ] CSP headers configured
- [ ] X-Frame-Options set
- [ ] CORS policies defined
- [ ] HTTPS enforced

---

## Troubleshooting

### reCAPTCHA Not Working
**Symptoms:** All registrations fail with "reCAPTCHA verification failed"
**Causes:**
- Invalid/expired secret key
- Domain not registered in reCAPTCHA console
- Firewall blocking google.com

**Solutions:**
1. Verify keys in `.env` match reCAPTCHA console
2. Check domain is added to allowed list
3. Test with Google test keys
4. Check server can reach google.com

### Rate Limit Too Strict
**Symptoms:** Legitimate users blocked
**Solutions:**
1. Increase `maxRequests` limit
2. Increase `windowMs` duration
3. Use Redis for accurate distributed rate limiting
4. Whitelist known IPs (e.g., office, VPN)

### Too Many False Positives (Spam)
**Symptoms:** Real users flagged as spam
**Solutions:**
1. Lower spam score thresholds
2. Review and remove overly aggressive patterns
3. Manually unblock flagged IPs
4. Adjust reCAPTCHA score requirements

---

## Security Best Practices

1. **Defense in Depth**: Multiple layers (rate limit + reCAPTCHA + spam detection)
2. **Monitor & Adjust**: Review metrics weekly, adjust thresholds
3. **Graceful Degradation**: Don't break UX for legitimate users
4. **Clear Error Messages**: Help users understand what went wrong
5. **Regular Updates**: Keep dependencies up to date
6. **Incident Response Plan**: Document steps for security incidents

---

## Support Resources

- **reCAPTCHA Docs:** https://developers.google.com/recaptcha/docs/v3
- **OWASP Cheat Sheet:** https://cheatsheetseries.owasp.org/
- **Next.js Security:** https://nextjs.org/docs/advanced-features/security-headers
- **Vercel Security:** https://vercel.com/docs/concepts/solutions/security

---

**Last Updated:** 2026-08-02  
**Maintained By:** Bella ERP Security Team
