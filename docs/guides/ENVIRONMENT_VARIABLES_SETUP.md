# Environment Variables Setup Guide
*Bella ERP - Complete Environment Configuration*

Last Updated: 2026-06-19

---

## 📋 Overview

This document lists all required and optional environment variables for Bella ERP across different environments (development, staging, production).

---

## 🔐 Critical Variables (Required for All Environments)

### Supabase Configuration

```bash
# Supabase URL (public)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co

# Supabase Anon/Publishable Key (public, safe to expose)
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Supabase Service Role Secret Key (private, NEVER expose to client)
SUPABASE_SECRET_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Supabase Database Direct Connection (for migrations, backups)
SUPABASE_DB_URL=postgresql://postgres:your_password@db.your-project.supabase.co:5432/postgres
```

**Where to find**:
- Dashboard: https://supabase.com/dashboard/project/YOUR_PROJECT_ID/settings/api
- Or: Project Settings → API → Project API keys

---

### Cron Job Authentication

```bash
# Secret for authenticating cron job requests
CRON_SECRET=your_secure_random_string_here_min_32_chars
```

**Purpose**: 
- Protects cron endpoints from unauthorized access
- Used by Vercel Cron to call `/api/cron/*` endpoints
- Also used for manual trigger button

**How to generate**:
```bash
# Method 1: OpenSSL
openssl rand -base64 32

# Method 2: Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# Method 3: PowerShell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))
```

**Security**:
- ✅ Minimum 32 characters
- ✅ Alphanumeric + special chars
- ❌ Never commit to git
- ❌ Never expose in client-side code

---

## 🛠️ Optional Variables

### Site Configuration

```bash
# Public site URL (for emails, webhooks, redirects)
NEXT_PUBLIC_SITE_URL=https://erp.bellaspa.vn

# Deployment environment
DEPLOYMENT_ENV=development  # or: staging, production
```

---

### Email Service (Resend)

```bash
# Resend API Key (for transactional emails)
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxx

# From email address
EMAIL_FROM=noreply@bellaspa.vn
```

**Where to get**: https://resend.com/api-keys

---

### Monitoring & Error Tracking

```bash
# Sentry DSN (public, for frontend error tracking)
NEXT_PUBLIC_SENTRY_DSN=https://xxxxx@o1234567.ingest.sentry.io/1234567

# Sentry Auth Token (private, for source maps upload)
SENTRY_AUTH_TOKEN=your_sentry_auth_token
```

**Where to get**: https://sentry.io/settings/YOUR_ORG/developer-settings/

---

### Analytics

```bash
# Vercel Analytics (auto-injected if deployed on Vercel)
NEXT_PUBLIC_VERCEL_ANALYTICS_ID=your_analytics_id
```

---

### Payment Gateways

```bash
# Momo Payment Gateway
MOMO_PARTNER_CODE=your_partner_code
MOMO_ACCESS_KEY=your_access_key
MOMO_SECRET_KEY=your_secret_key

# ZaloPay
ZALOPAY_APP_ID=your_app_id
ZALOPAY_KEY1=your_key1
ZALOPAY_KEY2=your_key2

# VNPay
VNPAY_TMN_CODE=your_tmn_code
VNPAY_HASH_SECRET=your_hash_secret
```

---

### SMS/Messaging

```bash
# Zalo OA (Official Account) for notifications
ZALO_OA_ACCESS_TOKEN=your_access_token
ZALO_OA_REFRESH_TOKEN=your_refresh_token
ZALO_OA_ID=your_oa_id

# Twilio (SMS backup)
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+84xxxxxxxxx
```

---

### File Storage (Optional, if not using Supabase Storage)

```bash
# AWS S3
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=ap-southeast-1
AWS_S3_BUCKET=bella-erp-uploads

# Or Cloudflare R2
R2_ACCOUNT_ID=your_account_id
R2_ACCESS_KEY_ID=your_access_key
R2_SECRET_ACCESS_KEY=your_secret_key
R2_BUCKET_NAME=bella-erp-uploads
```

---

### API Gateway (for external partners)

```bash
# Webhook signature secret (HMAC-SHA256)
WEBHOOK_SECRET=your_webhook_secret_min_32_chars

# Rate limiting (if using external Redis)
REDIS_URL=redis://your_redis_url:6379
REDIS_TOKEN=your_redis_auth_token
```

---

### AI/ML Services (if using)

```bash
# OpenAI API Key
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxx

# Google Gemini API Key
GEMINI_API_KEY=AIzaSyxxxxxxxxxxxxxxxxxxxxx
```

---

## 📁 Environment Files Structure

### `.env.local` (Development)

```bash
# .env.local
# Local development environment
# Never commit this file to git

NEXT_PUBLIC_SUPABASE_URL=https://lvnvkpyxtuilhrabtlwv.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=eyJhbGci...
SUPABASE_SECRET_KEY=eyJhbGci...
SUPABASE_DB_URL=postgresql://postgres:password@db.project.supabase.co:5432/postgres

CRON_SECRET=dev_cron_secret_12345

NEXT_PUBLIC_SITE_URL=http://localhost:3000
DEPLOYMENT_ENV=development

# Optional: Local overrides for testing
SKIP_EMAIL_VERIFICATION=true
ENABLE_DEBUG_LOGS=true
```

---

### `.env.production` (Vercel Production)

```bash
# .env.production
# Production environment variables
# Managed via Vercel Dashboard

# These are set in Vercel Dashboard → Settings → Environment Variables
# DO NOT commit sensitive values to git
```

**How to set in Vercel**:
1. Go to https://vercel.com/YOUR_TEAM/bella-spa-erp/settings/environment-variables
2. Add each variable:
   - Name: `CRON_SECRET`
   - Value: `your_production_secret_here`
   - Environment: ✅ Production
   - Click "Save"

---

### `.env.staging` (Vercel Preview/Staging)

Same as production but with staging values:
- Different Supabase project (staging database)
- Different API keys (test mode)
- Different email sender (staging@bellaspa.vn)

---

## 🔒 Security Best Practices

### ✅ DO:

1. **Use strong secrets**:
   ```bash
   # ✅ Good: Random, long, complex
   CRON_SECRET=A7kP9mN2xQ5vR8wT3hJ6gF4dS1zL0yC9bE2aU7iO5pM8nK3jH

   # ❌ Bad: Predictable, short, simple
   CRON_SECRET=secret123
   ```

2. **Different secrets per environment**:
   - Development: `dev_cron_secret_12345`
   - Staging: `staging_cron_secret_67890`
   - Production: `prod_cron_secret_abcdef`

3. **Store in Vercel Dashboard** (for production):
   - Never commit production secrets to git
   - Use Vercel's encrypted environment variables

4. **Rotate secrets regularly**:
   - Quarterly for critical secrets (CRON_SECRET, WEBHOOK_SECRET)
   - Immediately if compromised

---

### ❌ DON'T:

1. **Never commit secrets to git**:
   ```bash
   # Add to .gitignore
   .env.local
   .env.development.local
   .env.production.local
   .env*.local
   ```

2. **Never log secrets**:
   ```typescript
   // ❌ BAD
   console.log('CRON_SECRET:', process.env.CRON_SECRET);

   // ✅ GOOD
   console.log('CRON_SECRET is', process.env.CRON_SECRET ? 'set' : 'missing');
   ```

3. **Never expose in client-side code**:
   ```typescript
   // ❌ BAD: Sending secret to client
   return NextResponse.json({ secret: process.env.CRON_SECRET });

   // ✅ GOOD: Only use on server-side
   const isValid = request.headers.get('authorization') === `Bearer ${process.env.CRON_SECRET}`;
   ```

4. **Never use weak secrets**:
   - ❌ `secret`, `password`, `12345`, `admin`
   - ✅ Use password manager or crypto.randomBytes()

---

## 🧪 Testing Environment Variables

### Check if all required variables are set:

```bash
# Run in terminal
npm run check-env
```

**Script** (add to `package.json`):
```json
{
  "scripts": {
    "check-env": "node scripts/check-env.js"
  }
}
```

**`scripts/check-env.js`**:
```javascript
const requiredVars = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  'SUPABASE_SECRET_KEY',
  'CRON_SECRET',
];

const missing = requiredVars.filter(v => !process.env[v]);

if (missing.length > 0) {
  console.error('❌ Missing required environment variables:');
  missing.forEach(v => console.error(`  - ${v}`));
  process.exit(1);
}

console.log('✅ All required environment variables are set');
```

---

## 🚀 Deployment Checklist

### Before deploying to production:

- [ ] All required variables set in Vercel Dashboard
- [ ] `CRON_SECRET` is strong (32+ chars)
- [ ] `WEBHOOK_SECRET` is different from `CRON_SECRET`
- [ ] Production Supabase project configured
- [ ] No `.env.local` files committed to git
- [ ] Email service configured (Resend or SMTP)
- [ ] Payment gateway credentials tested
- [ ] Monitoring tools connected (Sentry, Vercel Analytics)

---

### Setting up on Vercel:

1. **Go to Project Settings**:
   https://vercel.com/YOUR_TEAM/bella-spa-erp/settings/environment-variables

2. **Add each variable**:
   - Click "Add"
   - Name: `CRON_SECRET`
   - Value: (paste your secret)
   - Environment: Select ✅ Production, ✅ Preview, ✅ Development
   - Click "Save"

3. **Redeploy**:
   - Go to Deployments tab
   - Click "..." on latest deployment
   - Click "Redeploy"
   - Select "Use existing Build Cache: No"

---

## 📞 Troubleshooting

### "CRON_SECRET is not defined"

**Cause**: Environment variable not set

**Solution**:
1. Check `.env.local` exists and has `CRON_SECRET=...`
2. Restart Next.js dev server: `Ctrl+C` then `npm run dev`
3. If on Vercel, check Dashboard → Settings → Environment Variables

---

### "fetch failed" when calling cron endpoint

**Cause**: Incorrect base URL construction

**Solution**:
1. Check `VERCEL_URL` or `NEXT_PUBLIC_SITE_URL` is set
2. In development, it will use `http://localhost:3000`
3. In production, Vercel auto-sets `VERCEL_URL`

---

### Cron job not triggering

**Cause**: Missing `CRON_SECRET` in Vercel

**Solution**:
1. Go to Vercel Dashboard → Environment Variables
2. Add `CRON_SECRET` for Production environment
3. Redeploy

---

## 📚 Related Documents

- [Security Best Practices](./api/SECURITY_BEST_PRACTICES.md)
- [Deployment Guide](./DEPLOYMENT_GUIDE.md)
- [Vercel Cron Jobs](https://vercel.com/docs/cron-jobs)
- [Supabase Environment Variables](https://supabase.com/docs/guides/cli/managing-environments)

---

## 🔗 Quick Links

- **Vercel Dashboard**: https://vercel.com/bella-spa-s-projects/bella-spa-erp
- **Supabase Dashboard**: https://supabase.com/dashboard/project/lvnvkpyxtuilhrabtlwv
- **Sentry Dashboard**: https://sentry.io/organizations/bella-spa
- **Resend Dashboard**: https://resend.com/api-keys

---

*Keep this document updated when adding new environment variables. Last review: 2026-06-19*
