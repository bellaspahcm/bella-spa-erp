# Environment Setup Guide

## 🚀 Quick Setup (5 minutes)

### 1. Copy Environment Template

```bash
cp .env.example .env.local
```

### 2. Fill Required Variables

Open `.env.local` and fill these **required** variables:

```env
# Database (Supabase)
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx...
SUPABASE_SERVICE_ROLE_KEY=eyJxxx...

# Application
NODE_ENV=development
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 3. Start Development

```bash
npm install
npm run dev
```

---

## 📋 Variable Reference

### Required (Critical)

| Variable | Description | Where to Get |
|----------|-------------|--------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Supabase Dashboard → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public anon key | Supabase Dashboard → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (server-only) | Supabase Dashboard → Settings → API |
| `NODE_ENV` | Environment mode | `development` / `production` |
| `NEXT_PUBLIC_APP_URL` | Application URL | Local: `http://localhost:3000` |

### Monitoring (Recommended)

| Variable | Description | Where to Get |
|----------|-------------|--------------|
| `NEXT_PUBLIC_SENTRY_DSN` | Sentry error tracking | Sentry.io → Project Settings → DSN |
| `SENTRY_AUTH_TOKEN` | Sentry upload token | Sentry.io → Settings → Auth Tokens |
| `LOG_LEVEL` | Logging level | `debug` / `info` / `warn` / `error` |

### Optional Features

| Variable | Description | Default |
|----------|-------------|---------|
| `ENABLE_REAL_ESTATE_MODULE` | Enable Real Estate | `true` |
| `ENABLE_PARTNER_PORTAL` | Enable Partner Portal | `true` |
| `DEFAULT_COMMISSION_RATE` | Commission % | `3.0` |
| `DEFAULT_INSTALLMENT_COUNT` | Payment installments | `12` |
| `RESERVATION_EXPIRY_HOURS` | Auto-cancel reservations | `48` |

---

## 🔐 Getting Supabase Credentials

### Step 1: Create Project
1. Go to [supabase.com](https://supabase.com)
2. Click "New Project"
3. Choose organization and region
4. Wait ~2 minutes for setup

### Step 2: Get API Keys
1. Go to **Settings** → **API**
2. Copy values:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** → `SUPABASE_SERVICE_ROLE_KEY` ⚠️ Keep secret!

### Step 3: Database URL
1. Go to **Settings** → **Database**
2. Copy **Connection string** (URI format)
3. Replace `[YOUR-PASSWORD]` with your database password
4. Set as `DATABASE_URL`

---

## 🔧 Sentry Setup (Optional)

### Step 1: Create Project
1. Go to [sentry.io](https://sentry.io)
2. Create new project → **Next.js**
3. Copy DSN

### Step 2: Create Auth Token
1. Go to **Settings** → **Auth Tokens**
2. Click **Create New Token**
3. Scopes: `project:read`, `project:releases`, `org:read`
4. Copy token

### Step 3: Configure
```env
NEXT_PUBLIC_SENTRY_DSN=https://xxxxx@xxxxx.ingest.sentry.io/xxxxx
SENTRY_ORG=your-org-slug
SENTRY_PROJECT=your-project-name
SENTRY_AUTH_TOKEN=sntrys_xxxxx
```

---

## 🧪 Testing Environment

For E2E tests, use separate environment:

```env
# .env.test.local
PLAYWRIGHT_TEST_BASE_URL=http://localhost:3000
TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:54322/postgres
```

---

## 🚨 Security Warnings

### ⚠️ Never Commit These Files:
- `.env.local`
- `.env.production.local`
- `.env.test.local`

### ✅ Safe to Commit:
- `.env.example` (template only, no real values)

### 🔒 Service Role Key:
- **NEVER** expose `SUPABASE_SERVICE_ROLE_KEY` to client
- Only use in server-side code
- Can bypass RLS (dangerous if leaked)

---

## 🌍 Environment-Specific Configs

### Development
```env
NODE_ENV=development
LOG_LEVEL=debug
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Staging
```env
NODE_ENV=production
LOG_LEVEL=info
NEXT_PUBLIC_APP_URL=https://staging.yourdomain.com
NEXT_PUBLIC_VERCEL_ENV=preview
```

### Production
```env
NODE_ENV=production
LOG_LEVEL=warn
NEXT_PUBLIC_APP_URL=https://yourdomain.com
NEXT_PUBLIC_VERCEL_ENV=production
```

---

## 🐛 Troubleshooting

**"Error: Must provide Supabase URL"**
→ Check `NEXT_PUBLIC_SUPABASE_URL` is set in `.env.local`

**"Error: JWT secret missing"**
→ Check `SUPABASE_JWT_SECRET` is set

**"Sentry not capturing errors"**
→ Verify `NEXT_PUBLIC_SENTRY_DSN` is correct
→ Check Sentry project is active

**"Database connection failed"**
→ Verify `DATABASE_URL` format
→ Check database password is correct
→ Ensure Supabase project is running

---

## 📖 Related Docs
- Quick Start: `docs/real-estate/QUICK_START.md`
- Deployment: `docs/deployment/DEPLOYMENT_RUNBOOK.md`
- Monitoring: `docs/deployment/MONITORING_SETUP.md`
