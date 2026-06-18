# Database Replication Setup Guide

## Tổng Quan

Bella ERP sử dụng Supabase Read Replicas để:
- **Phân tải analytics queries** khỏi primary database
- **Giảm latency** cho write operations (bookings, payments, salary)
- **Scale horizontally** khi traffic tăng
- **Tách biệt workloads**: OLTP (primary) vs OLAP (replica)

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Bella ERP Application                      │
└────────────┬────────────────────────────────┬────────────────┘
             │                                 │
             │ Write Ops                       │ Read Ops
             │ (Bookings, Payments)            │ (Analytics, Reports)
             │                                 │
             ▼                                 ▼
    ┌────────────────┐                ┌────────────────┐
    │ Primary DB     │───replication──▶│ Read Replica   │
    │ (Singapore)    │    ~100ms lag   │ (Singapore)    │
    └────────────────┘                └────────────────┘
         │                                     │
         │ RLS Policies                        │ Same RLS
         │ Write Locks                         │ Read-only
         └─────────────────────────────────────┘
```

## Supabase Setup (Production)

### 1. Enable Read Replica

**Supabase Dashboard:**
1. Navigate to **Settings → Database → Read Replicas**
2. Click **Enable Read Replica**
3. Choose region: **Singapore (ap-southeast-1)** (same as primary)
4. Wait ~10 minutes for provisioning

### 2. Get Connection Strings

After provisioning:
```bash
Primary URL: https://bella-erp-prod.supabase.co
Replica URL: https://bella-erp-prod-read.supabase.co
```

### 3. Configure Environment Variables

**Production (.env.production):**
```bash
# Primary database (writes)
NEXT_PUBLIC_SUPABASE_URL=https://bella-erp-prod.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=eyJhbGci...primary-key

# Read replica (analytics)
SUPABASE_READ_REPLICA_URL=https://bella-erp-prod-read.supabase.co
SUPABASE_READ_REPLICA_KEY=eyJhbGci...replica-key

# Enable read replica routing
USE_READ_REPLICA=true
```

**Staging (.env.staging):**
```bash
# Staging typically doesn't need read replica (lower traffic)
USE_READ_REPLICA=false
```

### 4. Vercel Environment Variables

Add to **Vercel Project Settings → Environment Variables → Production:**

| Variable | Value | Scope |
|----------|-------|-------|
| `SUPABASE_READ_REPLICA_URL` | `https://bella-erp-prod-read.supabase.co` | Production |
| `SUPABASE_READ_REPLICA_KEY` | `eyJhbGci...replica-key` | Production (Secret) |
| `USE_READ_REPLICA` | `true` | Production |

## Query Routing Strategy

### Use PRIMARY Database For:

✅ **All Write Operations**
```typescript
import { db } from '@/lib/database/read-replica';

// INSERT booking
await db.primary.from('bookings').insert({
  tenant_id: 'xxx',
  customer_id: 'yyy',
  service_id: 'zzz',
});

// UPDATE session status
await db.primary.from('sessions').update({ status: 'completed' }).eq('id', sessionId);

// DELETE draft package
await db.primary.from('packages').delete().eq('id', packageId);
```

✅ **Real-time Subscriptions**
```typescript
// Primary only - replica doesn't support real-time
const subscription = db.primary
  .channel('bookings')
  .on('postgres_changes', { 
    event: 'INSERT', 
    schema: 'public', 
    table: 'bookings' 
  }, handleNewBooking)
  .subscribe();
```

✅ **Time-Sensitive Reads**
```typescript
// Current session status (need latest data)
const { data } = await db.primary
  .from('sessions')
  .select('status, checked_in_at')
  .eq('id', sessionId)
  .single();
```

### Use READ REPLICA For:

✅ **Analytics Queries**
```typescript
import { analyticsQueries } from '@/lib/database/read-replica';

// Monthly revenue report
const revenue = await analyticsQueries.getMonthlyRevenue(
  tenantId, 
  2026, 
  6
);

// KTV leaderboard
const leaderboard = await analyticsQueries.getKtvLeaderboard(
  tenantId,
  '2026-06-01',
  '2026-06-30'
);
```

✅ **Heavy Aggregations**
```typescript
import { db } from '@/lib/database/read-replica';

// Total revenue by service (expensive query)
const { data } = await db.replica
  .from('sessions')
  .select(`
    service:services(name),
    revenue:price.sum(),
    count:id.count()
  `)
  .eq('tenant_id', tenantId)
  .eq('status', 'completed')
  .gte('checked_out_at', '2026-01-01')
  .order('revenue', { ascending: false });
```

✅ **Export Operations**
```typescript
// Export all transactions (10K+ rows)
const { data } = await db.replica
  .from('accounting_entries')
  .select('*')
  .eq('tenant_id', tenantId)
  .gte('created_at', '2026-01-01')
  .lte('created_at', '2026-12-31')
  .order('created_at', { ascending: true });
```

## Replication Lag Monitoring

### Health Check Endpoint

**`src/app/api/health/replica/route.ts`:**
```typescript
import { checkReplicaHealth } from '@/lib/database/read-replica';
import { NextResponse } from 'next/server';

export async function GET() {
  const health = await checkReplicaHealth();
  
  if (!health.healthy) {
    return NextResponse.json(health, { status: 503 });
  }
  
  return NextResponse.json(health);
}
```

**Response:**
```json
{
  "healthy": true,
  "lag_ms": 120
}
```

### Monitoring Alerts

**Setup Vercel Cron:**
```typescript
// src/app/api/cron/monitor-replica/route.ts
export async function GET(request: Request) {
  const health = await checkReplicaHealth();
  
  if (health.lag_ms && health.lag_ms > 5000) {
    // Alert: Replication lag > 5 seconds
    await sendSlackAlert({
      text: `⚠️ Database replica lag: ${health.lag_ms}ms`,
      channel: '#infrastructure-alerts',
    });
  }
  
  return NextResponse.json({ ok: true });
}
```

**Add to `vercel.json`:**
```json
{
  "crons": [
    {
      "path": "/api/cron/monitor-replica",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

## Performance Optimization

### Connection Pooling

**Primary Database:**
- Max connections: **100**
- Use for: Writes + critical reads
- Idle timeout: 60 seconds

**Read Replica:**
- Max connections: **50**
- Use for: Analytics only
- Idle timeout: 120 seconds

### Query Optimization

**Before (Primary):**
```typescript
// Heavy analytics query on primary database
const { data } = await supabase
  .from('sessions')
  .select('*, staff(*), services(*), bookings(*)')
  .eq('tenant_id', tenantId)
  .gte('created_at', '2026-01-01');
// 🐌 Slow (5+ seconds), blocks writes
```

**After (Replica):**
```typescript
import { db } from '@/lib/database/read-replica';

const { data } = await db.replica
  .from('sessions')
  .select('*, staff(*), services(*), bookings(*)')
  .eq('tenant_id', tenantId)
  .gte('created_at', '2026-01-01');
// ✅ Fast (1-2 seconds), primary unaffected
```

## Migration Checklist

- [ ] Enable read replica in Supabase Dashboard
- [ ] Configure environment variables (production)
- [ ] Update Vercel environment variables
- [ ] Add replica health check endpoint
- [ ] Setup monitoring cron job
- [ ] Migrate analytics queries to use `db.replica`
- [ ] Test replication lag < 5 seconds
- [ ] Monitor primary database CPU/memory decrease
- [ ] Update team documentation

## Rollback Procedure

If replica has issues:

1. **Disable replica routing:**
```bash
# Vercel Environment Variables
USE_READ_REPLICA=false
```

2. **Verify fallback:**
All queries automatically route to primary.

3. **No code changes needed** - `getReplicaClient()` falls back to primary.

## Cost Estimate

**Supabase Read Replica Pricing:**
- Same compute size as primary: **~$25/month**
- Storage replicated: Included
- Bandwidth: Same as primary

**Benefits:**
- 2x query capacity
- 50% reduction in primary database load
- Better P95 latency for writes

**ROI:** Pays for itself when > 200 concurrent analytics users.

## Troubleshooting

### Issue: High Replication Lag (> 5s)

**Cause:** Heavy write load on primary
**Solution:**
1. Check primary CPU usage in Supabase Dashboard
2. Optimize slow queries with `EXPLAIN ANALYZE`
3. Add missing indexes
4. Consider upgrading primary compute size

### Issue: Replica Query Errors

**Cause:** Row Level Security policies not synced
**Solution:**
1. RLS policies replicate automatically
2. Check `supabase/migrations/` for recent policy changes
3. Wait 1-2 minutes for policy replication

### Issue: Stale Data in Reports

**Cause:** 100ms replication lag + browser cache
**Solution:**
1. Accept eventual consistency (100ms lag acceptable for analytics)
2. Add timestamp indicator: "Data as of [timestamp]"
3. For real-time data, use primary database

## References

- [Supabase Read Replicas Docs](https://supabase.com/docs/guides/platform/read-replicas)
- [PostgreSQL Streaming Replication](https://www.postgresql.org/docs/current/warm-standby.html)
- Bella ERP: `src/lib/database/read-replica.ts`
