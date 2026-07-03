# Redis Cache Troubleshooting

## Issue: Performance logs show no CACHE HIT

### Symptoms:
- Console shows `critical_data: 3900ms` (still slow)
- No logs with text `CACHE HIT` or `Cache MISS`
- `sessions_fetch` improved but `critical_data` did not

### Root cause analysis:

#### Possibility 1: Redis client initialization failed
**Check Console for warning**:
```
[Redis Cache] Upstash Redis not configured. Caching disabled.
[Redis Cache] Install Upstash Redis integration: https://vercel.com/integrations/upstash
```

**If present**: Environment variables not loaded correctly.

**Solution**:
1. Verify env vars exist in Vercel Dashboard
2. Check they are scoped to "Production"
3. Trigger another redeploy (cache bust)

#### Possibility 2: Server-side logs not appearing in browser Console
**Reason**: `getCurrentUser()` and `getTenantSettings()` run on **Vercel Edge Functions**, not client-side.

**Solution**: Check Vercel Function Logs:
1. Go to: https://vercel.com/bella-spa-erp/logs
2. Filter by: Function = `/api` or `/ktv`
3. Look for logs:
   - `[getCurrentUser] Redis cache check`
   - `[getCurrentUser] CACHE HIT`

#### Possibility 3: Cache keys mismatch
**Reason**: User ID from `auth.getUser()` differs from cached user ID.

**Debug**:
Add temporary log in browser DevTools:
```javascript
// In getCurrentUser() client call
console.log('[DEBUG] User ID:', user.id);
```

Compare with Redis cache key pattern: `user:{userId}`

---

## Quick verification steps

### Step 1: Check if Redis is configured

Open browser Console and look for this warning at page load:
```
[Redis Cache] Upstash Redis not configured
```

- **If present**: Redis not working, env vars missing
- **If absent**: Redis client initialized successfully

### Step 2: Check Vercel Function Logs

1. Go to: https://vercel.com/bella-spa-erp/logs
2. Select latest deployment
3. Filter by timeframe: Last 10 minutes
4. Search for: `getCurrentUser`

**Expected logs**:
```
[getCurrentUser] Redis cache check took 5ms
[getCurrentUser] Cache MISS - fetching from DB
[getCurrentUser] TOTAL TIME: 1100ms
```

**On second request (within 60s)**:
```
[getCurrentUser] CACHE HIT - returning cached user in 8ms
```

### Step 3: Manual Redis check via Upstash Console

1. Go to: https://console.upstash.com/
2. Select `bella-erp-cache` database
3. Click **"Data Browser"**
4. Look for keys matching pattern: `user:*`

**If keys exist**: Cache is working, just not logging properly
**If no keys**: Cache writes are failing

---

## Solution: Force cache verification

Add this temporary diagnostic endpoint:

```typescript
// src/app/api/debug-cache/route.ts
import { getCache, setCache, CacheKeys } from '@/lib/redis-cache';

export async function GET() {
  const testKey = 'test:debug';
  const testValue = { timestamp: Date.now(), message: 'Hello Redis' };
  
  // Test write
  const writeResult = await setCache(testKey, testValue, 30);
  
  // Test read
  const readResult = await getCache(testKey);
  
  return Response.json({
    write: writeResult ? 'SUCCESS' : 'FAILED',
    read: readResult ? 'SUCCESS' : 'FAILED',
    data: readResult,
    env: {
      hasUrl: !!process.env.UPSTASH_REDIS_REST_URL,
      hasToken: !!process.env.UPSTASH_REDIS_REST_TOKEN,
    }
  });
}
```

**Test**:
```bash
curl https://bellaspa-erp.vercel.app/api/debug-cache
```

**Expected response**:
```json
{
  "write": "SUCCESS",
  "read": "SUCCESS",
  "data": { "timestamp": 1234567890, "message": "Hello Redis" },
  "env": { "hasUrl": true, "hasToken": true }
}
```

---

## Current status based on logs

From screenshot:
- `critical_data: 6057ms` (first load) → 3902ms (second load)
- Improvement: **37% faster** but not the expected 12x

**Likely issue**: Redis cache is working for **sessions data** (hence `sessions_fetch` improved), but **NOT for user/tenant data**.

**Next step**: Check Vercel Function Logs to see if `[getCurrentUser] CACHE HIT` appears there.
