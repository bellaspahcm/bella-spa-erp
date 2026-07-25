# Redis Cache Setup Guide (Upstash Redis)

## 📋 Overview

We use **Upstash Redis** (via Vercel Integration) to cache expensive database queries:

- `getCurrentUser()`: 1200ms → ~50ms (24x faster)
- `getTenantSettings()`: Cached for 5 minutes
- **Total critical_data**: 1200ms → ~100ms

---

## 🚀 Setup Steps

### 1. Install Upstash Redis Integration on Vercel

1. Go to: https://vercel.com/integrations/upstash
2. Click **"Add Integration"**
3. Select your **Bella ERP project**
4. Click **"Install"**
5. Authorize Upstash to access your Vercel account

**Vercel will automatically**:
- Create a Redis database on Upstash (free tier: 10K requests/day)
- Inject environment variables into your project:
  - `UPSTASH_REDIS_REST_URL`
  - `UPSTASH_REDIS_REST_TOKEN`

### 2. Verify Environment Variables

1. Go to: https://vercel.com/bella-spa-erp/settings/environment-variables
2. Check that these exist:
   - ✅ `UPSTASH_REDIS_REST_URL` (e.g., `https://xxx.upstash.io`)
   - ✅ `UPSTASH_REDIS_REST_TOKEN` (encrypted token)

**If missing**, manually add them from Upstash Dashboard:
- Go to: https://console.upstash.com/
- Select your database
- Copy **REST URL** and **REST Token**
- Paste into Vercel Environment Variables

### 3. Redeploy Application

After adding environment variables:

```bash
# Trigger redeployment (or push a new commit)
git commit --allow-empty -m "chore: trigger redeploy for Upstash Redis"
git push origin main
```

Or click **"Redeploy"** in Vercel Dashboard.

### 4. Verify Caching Works

After deployment:

1. Open KTV Dashboard: https://bellaspa-erp.vercel.app/ktv/dashboard
2. Open DevTools Console (F12)
3. Hard reload: `Ctrl + Shift + R`
4. Look for logs:
   ```
   [getCurrentUser] Redis cache check took XXms
   [getCurrentUser] Cache MISS - fetching from DB
   [getCurrentUser] TOTAL TIME: XXXms
   ```
5. Reload again (within 60 seconds):
   ```
   [getCurrentUser] CACHE HIT - returning cached user in XXms
   ```

**Expected result**:
- First load: `critical_data` ~1000ms (DB fetch)
- Second load: `critical_data` ~100ms (cache hit)

---

## 🔧 Configuration

### Cache TTLs (Time To Live)

Defined in `src/lib/redis-cache.ts`:

| Data Type | TTL | Reason |
|-----------|-----|--------|
| User sessions | 60s | Balance between freshness and performance |
| Tenant settings | 300s (5min) | Rarely change, safe to cache longer |
| KTV sessions | 30s | Frequently updated during shift |
| KTV earnings | 3600s (1hr) | Only updated at end of day |

### Cache Keys

Consistent naming convention:

```typescript
user:123              // User profile
tenant:456            // Tenant settings
ktv:sessions:123:2026-07-04  // KTV sessions for date
ktv:earnings:123:2026-07     // KTV earnings for month
```

### Cache Invalidation

Cache is automatically invalidated when data changes:

- **User update** → `deleteCache(CacheKeys.user(userId))`
- **Tenant settings update** → `deleteCache(CacheKeys.tenant(tenantId))`
- **Session complete** → Cache expires naturally (30s TTL)

---

## 📊 Performance Impact

### Before Redis Cache:
```
[KTV Dashboard] critical_data: 1187ms
[KTV Dashboard] total_to_ui: 1189ms
```

### After Redis Cache (cache hit):
```
[getCurrentUser] CACHE HIT - returning cached user in 8ms
[getTenantSettings] CACHE HIT - returning in 12ms
[KTV Dashboard] critical_data: 50ms
[KTV Dashboard] total_to_ui: 200ms
```

**Improvement**: 1.2s → 200ms (**6x faster!**)

---

## 🐛 Troubleshooting

### Cache not working (always CACHE MISS)

**Check environment variables:**
```bash
# In Vercel Dashboard → Settings → Environment Variables
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=AxxxYyyyZzzz...
```

**Check Vercel deployment logs:**
- Look for `[Redis Cache] Upstash Redis not configured` warnings
- If present, env vars are missing

### Cache hits but performance still slow

**Possible causes:**
1. **Network latency** to Upstash (check your region)
2. **Cold start** on Vercel Edge Functions (first request is slow)
3. **Large payload** (user object > 100KB)

**Solution**: Check Upstash dashboard for slow queries:
- Go to: https://console.upstash.com/
- Select your database → **Metrics**
- Check **Latency** graph

### Development mode shows cache warnings

Normal! Development mode doesn't have Upstash env vars.

**To test caching locally:**
1. Copy `.env.local.example` → `.env.local`
2. Add Upstash credentials from Upstash Dashboard
3. Restart `npm run dev`

---

## 💰 Cost & Limits

### Upstash Free Tier:
- ✅ **10,000 requests/day** (enough for ~200 users)
- ✅ **256 MB storage**
- ✅ **No credit card required**

### When to upgrade:
- > 200 daily active users → Upgrade to Pro ($10/month, 100K requests/day)
- > 1000 daily active users → Consider Redis Cluster

---

## 🔐 Security

- ✅ **TLS encrypted** (HTTPS REST API)
- ✅ **Token-based auth** (UPSTASH_REDIS_REST_TOKEN)
- ✅ **Vercel environment variables** (encrypted at rest)
- ✅ **No sensitive data cached** (passwords/tokens excluded from user object)

---

## 📚 References

- Upstash Redis Docs: https://docs.upstash.com/redis
- Vercel Integration: https://vercel.com/integrations/upstash
- Upstash Console: https://console.upstash.com/
