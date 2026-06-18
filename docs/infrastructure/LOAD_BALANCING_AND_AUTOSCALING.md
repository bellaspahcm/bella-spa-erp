# Load Balancing & Auto-scaling Configuration

## Overview

Bella ERP sử dụng Vercel's automatic load balancing và scaling infrastructure. Không cần config manual load balancer - Vercel xử lý tự động.

## Vercel Automatic Scaling

### Architecture

```
                    ┌─────────────────────┐
                    │   Vercel Edge       │
                    │   Load Balancer     │
                    │   (Automatic)       │
                    └──────────┬──────────┘
                               │
                ┌──────────────┼──────────────┐
                │              │              │
                ▼              ▼              ▼
        ┌──────────┐   ┌──────────┐   ┌──────────┐
        │ Lambda 1 │   │ Lambda 2 │   │ Lambda N │
        │ Singapore│   │ Singapore│   │ Singapore│
        └──────────┘   └──────────┘   └──────────┘
                │              │              │
                └──────────────┼──────────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │  Supabase Primary   │
                    │  (Connection Pool)  │
                    └─────────────────────┘
```

### How It Works

1. **Request arrives** at Vercel Edge (CDN)
2. **Edge routes** to nearest serverless function
3. **Lambda auto-scales** based on concurrent requests:
   - 0 requests → 0 instances (sleep)
   - 100 requests → 10 instances (scale up)
   - 10 requests → 2 instances (scale down)
4. **Connection pooling** prevents database overload

## Scaling Configuration

### Vercel Function Limits

**Current Plan (Pro):**
```typescript
// Configured in vercel.json
{
  "functions": {
    "src/app/api/**/*.ts": {
      "memory": 1024,        // 1 GB RAM
      "maxDuration": 10,     // 10 seconds timeout
      "regions": ["sin1"]    // Singapore only
    },
    "src/app/api/cron/**/*.ts": {
      "memory": 3008,        // 3 GB RAM (heavy jobs)
      "maxDuration": 300     // 5 minutes timeout
    }
  }
}
```

**Concurrency:**
- **1000 concurrent executions** (Pro plan)
- Auto-scales from 0 to 1000
- No manual intervention needed

### Database Connection Pooling

**Problem:** Each Lambda creates DB connections
**Solution:** Supabase Pooler + connection limits

**Configuration:**

```typescript
// src/lib/supabase/server.ts
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
  {
    db: {
      schema: 'public',
    },
    auth: {
      persistSession: false,
    },
    global: {
      headers: {
        'x-connection-pool': 'transaction', // Use Supabase transaction pooler
      },
    },
  }
);
```

**Supabase Pooler Modes:**
- **Transaction mode** (recommended): Pool per transaction, max 10K connections
- **Session mode**: Pool per session, max 200 connections

**Production Settings:**
```bash
# .env.production
DATABASE_MAX_CONNECTIONS=100
DATABASE_IDLE_TIMEOUT=60000
DATABASE_CONNECTION_TIMEOUT=10000
```

## Health Check Endpoints

### 1. Application Health

**`src/app/api/health/route.ts`:**
```typescript
import { NextResponse } from 'next/server';
import { getPrimaryClient } from '@/lib/database/read-replica';

export async function GET() {
  try {
    // Check database connectivity
    const db = getPrimaryClient();
    const { data, error } = await db
      .from('tenants')
      .select('id')
      .limit(1);

    if (error) throw error;

    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      checks: {
        database: 'ok',
        application: 'ok',
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 503 }
    );
  }
}
```

### 2. Readiness Check (Load Balancer)

**`src/app/api/health/ready/route.ts`:**
```typescript
import { NextResponse } from 'next/server';

/**
 * Kubernetes-style readiness probe
 * Load balancer only sends traffic if this returns 200
 */
export async function GET() {
  // Check if application is ready to serve traffic
  const checks = {
    database: await checkDatabase(),
    redis: await checkRedis(),
    supabase: await checkSupabase(),
  };

  const allHealthy = Object.values(checks).every((v) => v === true);

  if (!allHealthy) {
    return NextResponse.json(
      { ready: false, checks },
      { status: 503 }
    );
  }

  return NextResponse.json({ ready: true, checks });
}

async function checkDatabase(): Promise<boolean> {
  try {
    const db = getPrimaryClient();
    await db.from('tenants').select('id').limit(1);
    return true;
  } catch {
    return false;
  }
}

async function checkRedis(): Promise<boolean> {
  // TODO: Implement Redis health check
  return true;
}

async function checkSupabase(): Promise<boolean> {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/`,
      {
        headers: {
          apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
        },
      }
    );
    return response.ok;
  } catch {
    return false;
  }
}
```

### 3. Liveness Check

**`src/app/api/health/live/route.ts`:**
```typescript
import { NextResponse } from 'next/server';

/**
 * Simple liveness probe
 * Returns 200 if process is alive
 */
export async function GET() {
  return NextResponse.json({
    alive: true,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    timestamp: new Date().toISOString(),
  });
}
```

## Auto-scaling Triggers

### Metrics-Based Scaling

Vercel auto-scales based on:

1. **Concurrent Requests**
   - Threshold: 10 requests/instance
   - Scale up: Add instance when threshold exceeded
   - Scale down: Remove instance after 60s idle

2. **CPU Usage**
   - Threshold: 80% CPU
   - Scale up: Add instance
   - Max instances: 1000 (Pro plan)

3. **Memory Usage**
   - Threshold: 90% RAM
   - Scale up: Add instance
   - OOM: Restart instance

4. **Cold Starts**
   - First request: ~500ms cold start
   - Subsequent: ~50ms warm execution
   - Keep-alive: 5 minutes

### Monitoring Scaling Events

**Vercel Dashboard:**
- Navigate to **Deployments → [Production]**
- Click **Functions** tab
- See real-time instance count and memory usage

**Alerts:**
```typescript
// src/app/api/cron/monitor-scaling/route.ts
export async function GET() {
  const metrics = await fetch(
    'https://api.vercel.com/v1/deployments/${deploymentId}/functions',
    {
      headers: {
        Authorization: `Bearer ${process.env.VERCEL_TOKEN}`,
      },
    }
  ).then(r => r.json());

  // Alert if > 800 concurrent instances (80% capacity)
  if (metrics.concurrentExecutions > 800) {
    await sendAlert({
      level: 'warning',
      message: '⚠️ High concurrency: ${metrics.concurrentExecutions}/1000',
    });
  }

  return NextResponse.json(metrics);
}
```

## Traffic Distribution

### Geographic Routing

**Single Region (Current):**
```json
// vercel.production.json
{
  "regions": ["sin1"]
}
```

**Multi-Region (Future):**
```json
{
  "regions": ["sin1", "hnd1", "icn1"]
}
```

**Latency Estimates:**
- Vietnam → Singapore (sin1): **~30ms**
- Vietnam → Tokyo (hnd1): **~80ms**
- Vietnam → Seoul (icn1): **~100ms**

### Edge Middleware

```typescript
// src/middleware.ts
export function middleware(request: NextRequest) {
  const country = request.geo?.country || 'VN';
  const region = request.geo?.region;

  // Log geographic distribution
  console.log(`[Traffic] ${country}/${region} → ${request.url}`);

  return NextResponse.next();
}
```

## Connection Pool Management

### Problem: Lambda Surge → DB Overload

**Scenario:**
- Traffic spike: 0 → 1000 requests/second
- Each Lambda creates 5 connections
- Total: 1000 × 5 = **5000 connections**
- Supabase max: **500 connections**
- Result: **Connection pool exhausted** ❌

### Solution 1: Supabase Transaction Pooler

```typescript
// Use transaction pooler (10K max connections)
const supabase = createClient(
  'https://bella-erp-prod.supabase.co',
  process.env.SUPABASE_SECRET_KEY!,
  {
    global: {
      headers: {
        'x-connection-pool': 'transaction',
      },
    },
  }
);
```

### Solution 2: External Connection Pooler

**Use Supavisor (Supabase native):**
```bash
# Connection string format
postgres://[user]:[password]@[project-ref].pooler.supabase.com:6543/postgres?pgbouncer=true
```

**Benefits:**
- 10,000+ concurrent connections
- Connection reuse
- Automatic failover

### Solution 3: Rate Limiting

```typescript
// Limit concurrent requests to prevent surge
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(1000, '1 m'), // 1000 req/min
});

export async function middleware(request: NextRequest) {
  const ip = request.ip || '127.0.0.1';
  const { success, limit, remaining } = await ratelimit.limit(ip);

  if (!success) {
    return NextResponse.json(
      { error: 'Rate limit exceeded' },
      { status: 429 }
    );
  }

  return NextResponse.next();
}
```

## Cost Optimization

### Vercel Pro Plan Pricing

**Included:**
- 1000 GB-hours compute: **$20/month**
- 1000 concurrent executions
- 100 GB bandwidth

**Additional:**
- Extra compute: **$40/1000 GB-hours**
- Extra bandwidth: **$40/TB**

### Optimization Strategies

**1. Reduce Function Memory**
```typescript
// Before: 3 GB RAM for all functions
{
  "memory": 3008  // Cost: 3x
}

// After: Right-size per function
{
  "src/app/api/bookings/**/*.ts": {
    "memory": 1024  // Cost: 1x
  },
  "src/app/api/reports/**/*.ts": {
    "memory": 3008  // Cost: 3x (heavy analytics)
  }
}
```

**2. Reduce Cold Starts**
```typescript
// Keep-alive ping every 4 minutes
// Prevents cold start during business hours
setInterval(async () => {
  await fetch('https://bella-erp.com/api/health');
}, 4 * 60 * 1000);
```

**3. Use Edge Functions for Static Logic**
```typescript
// Runs at Edge (faster, cheaper)
export const runtime = 'edge';

export async function GET() {
  return NextResponse.json({ message: 'Hello from Edge' });
}
```

## Monitoring & Alerts

### Key Metrics

**1. Function Invocations**
- Target: **< 1M invocations/month** (included in Pro)
- Alert: **> 800K/month** (80% quota)

**2. Average Duration**
- Target: **< 500ms P95**
- Alert: **> 1000ms P95**

**3. Error Rate**
- Target: **< 0.1%**
- Alert: **> 1% errors**

**4. Cold Start Rate**
- Target: **< 10% cold starts**
- Alert: **> 30% cold starts**

### Vercel Analytics Integration

```typescript
// src/app/api/[[...route]]/route.ts
import { track } from '@vercel/analytics/server';

export async function GET(request: Request) {
  const start = Date.now();
  
  try {
    const result = await handleRequest(request);
    
    track('api_call', {
      endpoint: request.url,
      duration: Date.now() - start,
      status: 'success',
    });
    
    return result;
  } catch (error) {
    track('api_call', {
      endpoint: request.url,
      duration: Date.now() - start,
      status: 'error',
    });
    
    throw error;
  }
}
```

## Disaster Recovery

### Failover Strategy

**Primary Region Outage:**
1. Vercel automatically routes to secondary region (if configured)
2. Database read replica promoted to primary (manual)
3. DNS failover to backup domain (manual)

**Complete Outage:**
1. Static error page served from Edge
2. Queue requests in Redis
3. Process when service restored

**Recovery Time Objectives:**
- **RTO** (Recovery Time Objective): **< 15 minutes**
- **RPO** (Recovery Point Objective): **< 5 minutes** (replication lag)

## References

- [Vercel Functions Limits](https://vercel.com/docs/functions/limits)
- [Supabase Connection Pooling](https://supabase.com/docs/guides/database/connection-pooling)
- [Vercel Auto-scaling](https://vercel.com/docs/functions/scaling)
