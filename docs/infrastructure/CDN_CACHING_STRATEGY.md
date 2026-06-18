# CDN Caching Strategy

## Overview

Bella ERP sử dụng Vercel Edge Network (CDN) để cache static assets và public API responses, giảm latency và server load.

## Caching Tiers

### Tier 1: Static Assets (Immutable)

**Files:** `_next/static/*`, images, fonts, CSS, JS bundles

**Cache Headers:**
```
Cache-Control: public, max-age=31536000, immutable
```

**TTL:** 1 year (files have content hash trong URL)

**Example:**
```
/_next/static/chunks/app-layout-abc123.js
/_next/static/media/logo-def456.png
```

### Tier 2: Public API Data (Stale-While-Revalidate)

**Endpoints:** `/api/v1/public/*`

**Use Cases:**
- Public booking forms
- Service catalogs
- Branch locations
- Operating hours

**Cache Headers:**
```
Cache-Control: s-maxage=300, stale-while-revalidate=600
CDN-Cache-Control: max-age=300
Vercel-CDN-Cache-Control: max-age=300
```

**TTL:** 5 minutes fresh, 10 minutes stale

**Behavior:**
1. First request → Cache MISS → Query database → Cache for 5 minutes
2. Subsequent requests → Cache HIT → Instant response
3. After 5 minutes → Cache STALE → Serve stale, revalidate in background
4. After 10 minutes → Cache EXPIRED → Hard refresh

### Tier 3: Private API Data (No Cache)

**Endpoints:** `/api/*` (except `/api/v1/public`)

**Use Cases:**
- User dashboards
- Bookings
- Payments
- Staff management

**Cache Headers:**
```
Cache-Control: no-store, must-revalidate
```

**TTL:** None (always query fresh data)

### Tier 4: Webhooks (No Cache + Replay Protection)

**Endpoints:** `/api/v1/webhooks/*`, `/api/webhooks/*`

**Cache Headers:**
```
Cache-Control: no-store, no-cache, must-revalidate
```

**Additional Protection:**
- HMAC signature validation
- Timestamp check (reject if > 5 minutes old)
- Idempotency keys

## Implementation

### Middleware Configuration

**`src/middleware.ts`:**
```typescript
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const response = NextResponse.next();

  // Public API - Cache 5 minutes
  if (pathname.startsWith('/api/v1/public')) {
    response.headers.set(
      'Cache-Control',
      's-maxage=300, stale-while-revalidate=600'
    );
  }

  // Private API - No cache
  else if (pathname.startsWith('/api/')) {
    response.headers.set('Cache-Control', 'no-store, must-revalidate');
  }

  return response;
}
```

### Per-Route Caching

**App Router (Next.js 16):**
```typescript
// src/app/api/v1/public/services/route.ts
export const dynamic = 'force-static'; // Pre-render at build time
export const revalidate = 300; // ISR: Revalidate every 5 minutes

export async function GET() {
  const services = await db.replica
    .from('services')
    .select('id, name, description, duration, price')
    .eq('is_active', true);

  return NextResponse.json(services.data, {
    headers: {
      'Cache-Control': 's-maxage=300, stale-while-revalidate=600',
    },
  });
}
```

### Cache Invalidation

**On-Demand Revalidation:**
```typescript
// src/app/api/admin/services/route.ts
import { revalidatePath, revalidateTag } from 'next/cache';

export async function POST(request: Request) {
  const service = await request.json();
  
  // Update service in database
  await db.primary.from('services').insert(service);
  
  // Invalidate public services cache
  revalidatePath('/api/v1/public/services');
  revalidateTag('public-services');
  
  return NextResponse.json({ success: true });
}
```

**Webhook Invalidation:**
```typescript
// src/app/api/webhooks/service-updated/route.ts
export async function POST(request: Request) {
  const { service_id } = await request.json();
  
  // Revalidate specific service cache
  revalidatePath(`/api/v1/public/services/${service_id}`);
  
  return NextResponse.json({ revalidated: true });
}
```

## Cache Purge API

### Manual Cache Purge

**Endpoint:** `POST /api/admin/cache/purge`

```typescript
// src/app/api/admin/cache/purge/route.ts
export async function POST(request: Request) {
  const { path, tags } = await request.json();
  
  if (path) {
    revalidatePath(path);
  }
  
  if (tags) {
    tags.forEach((tag: string) => revalidateTag(tag));
  }
  
  return NextResponse.json({ 
    success: true, 
    purged: { path, tags } 
  });
}
```

**Usage:**
```bash
curl -X POST https://bella-erp.com/api/admin/cache/purge \
  -H "Authorization: Bearer admin-token" \
  -H "Content-Type: application/json" \
  -d '{"path": "/api/v1/public/services"}'
```

## Monitoring

### Cache Hit Rate Dashboard

**Vercel Analytics:**
- Navigate to **Analytics → Speed Insights**
- Check **Cache Status** metrics:
  - HIT: Served from CDN
  - MISS: Origin server query
  - STALE: Stale cache, revalidating

**Target Metrics:**
- Public API cache hit rate: **> 80%**
- Static assets cache hit rate: **> 95%**
- Average response time: **< 100ms** (cached), **< 500ms** (uncached)

### Cache Performance Query

**Check cache headers:**
```bash
curl -I https://bella-erp.com/api/v1/public/services

HTTP/2 200
cache-control: s-maxage=300, stale-while-revalidate=600
x-vercel-cache: HIT
age: 120
```

**Response Headers:**
- `x-vercel-cache: HIT` → Served from edge
- `x-vercel-cache: MISS` → Origin query
- `x-vercel-cache: STALE` → Stale served, revalidating
- `age: 120` → Cached 2 minutes ago

## Edge Regions

### Vercel Edge Network

**Enabled Regions (Production):**
- **sin1** (Singapore) - Primary region, nearest to Vietnam
- **hnd1** (Tokyo) - Backup region

**Configuration:**
```json
// vercel.production.json
{
  "regions": ["sin1", "hnd1"]
}
```

**Latency Estimates:**
- Vietnam → Singapore: **~30ms**
- Vietnam → Tokyo: **~80ms**
- Singapore CDN hit: **~10ms**

## Best Practices

### ✅ DO:

1. **Cache public, non-personalized data**
   - Service catalogs
   - Branch information
   - Public booking forms

2. **Use stale-while-revalidate**
   - Serve stale content immediately
   - Revalidate in background
   - User sees instant response

3. **Set appropriate TTLs**
   - Frequently changing data: 5 minutes
   - Rarely changing data: 1 hour
   - Static assets: 1 year (with hash)

4. **Invalidate on updates**
   - Revalidate cache when data changes
   - Use webhooks for instant purge

### ❌ DON'T:

1. **Don't cache user-specific data**
   - Dashboards
   - Personal bookings
   - Payment history

2. **Don't cache sensitive endpoints**
   - Authentication
   - Payments
   - Admin operations

3. **Don't set TTL too high**
   - Risk serving stale data
   - Hard to invalidate
   - Users see outdated content

4. **Don't forget Vary headers**
   - `Vary: Accept-Encoding` for gzip
   - `Vary: Cookie` for personalized content

## Cost Optimization

### Vercel Bandwidth Pricing

**Pro Plan:**
- 1 TB bandwidth included: **$20/month**
- Additional bandwidth: **$40/TB**

**Caching Benefits:**
- 80% cache hit rate → 5x bandwidth reduction
- 1 TB origin → 200 GB after caching
- Savings: **~$32/month** per 1 TB

**ROI Calculator:**
```
Monthly origin bandwidth: 2 TB
Cache hit rate: 80%
Cached bandwidth: 2 TB * 0.8 = 1.6 TB
Origin bandwidth: 2 TB * 0.2 = 0.4 TB
Savings: (1.6 TB * $40) = $64/month
```

## Troubleshooting

### Issue: Cache Not Working

**Symptoms:**
- `x-vercel-cache: MISS` on every request
- Slow response times

**Solutions:**
1. Check `Cache-Control` headers in response
2. Verify middleware is setting headers correctly
3. Check Vercel deployment logs for cache configuration
4. Ensure request URL is consistent (no query params for cached routes)

### Issue: Stale Data Served

**Symptoms:**
- Users see outdated service prices
- New bookings don't appear

**Solutions:**
1. Reduce TTL for frequently changing data
2. Implement on-demand revalidation on updates
3. Use webhook invalidation for instant purge
4. Add "Last updated" timestamp in UI

### Issue: Cache Hit Rate Low

**Symptoms:**
- Cache hit rate < 50%
- High origin server load

**Solutions:**
1. Analyze request patterns (query params vary?)
2. Normalize URLs (remove unnecessary params)
3. Increase TTL for stable data
4. Pre-warm cache with automated requests

## References

- [Vercel Edge Network Docs](https://vercel.com/docs/edge-network/overview)
- [Next.js Caching Docs](https://nextjs.org/docs/app/building-your-application/caching)
- [HTTP Caching RFC 7234](https://tools.ietf.org/html/rfc7234)
