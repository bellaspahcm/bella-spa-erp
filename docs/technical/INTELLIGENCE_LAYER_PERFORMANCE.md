# Intelligence Layer Performance - Hiệu Suất & Caching

## Tổng Quan (Overview)

Intelligence Layer được thiết kế với mục tiêu:
- **Response time < 100ms** (P95)
- **Cache hit rate > 90%**
- **Throughput > 1000 RPS**

---

## Multi-Tier Caching Strategy (Chiến Lược Cache Đa Tầng)

### Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│ Request                                                             │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ Tier 1: Memory Cache (Node.js Map)                                 │
│ - Capacity: 100 MB                                                  │
│ - TTL: 60 seconds                                                   │
│ - Eviction: LRU (Least Recently Used)                              │
│ - Hit Rate Target: 70%                                             │
│ - Response Time: < 1ms                                             │
└─────────────────────────────────────────────────────────────────────┘
                              ↓ Cache Miss
┌─────────────────────────────────────────────────────────────────────┐
│ Tier 2: Redis Cache                                                │
│ - Capacity: 1 GB                                                    │
│ - TTL: 5-60 minutes (depends on data type)                         │
│ - Eviction: allkeys-lru                                            │
│ - Hit Rate Target: 20%                                             │
│ - Response Time: < 10ms                                            │
└─────────────────────────────────────────────────────────────────────┘
                              ↓ Cache Miss
┌─────────────────────────────────────────────────────────────────────┐
│ Tier 3: Database (Materialized Views)                              │
│ - Pre-aggregated data                                               │
│ - Refresh: 5 min - 24 hours (depends on data type)                 │
│ - Hit Rate Target: 10%                                             │
│ - Response Time: < 100ms                                           │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Cache Strategy by Domain (Chiến Lược Cache Theo Domain)

### Executive Intelligence

| API | Memory TTL | Redis TTL | MV Refresh | Invalidation Events |
|-----|-----------|-----------|------------|---------------------|
| `getExecutiveSummary()` | 60s | 5 min | 5 min | InvoiceCreated, BookingConfirmed, ExpenseApproved |
| `getKPIDashboard()` | 60s | 5 min | 5 min | All major business events |
| `getPerformanceTrends()` | 60s | 10 min | 15 min | All major business events |

**Cache Key Pattern**: `exec:summary:{tenantId}:{period}`

**Example**:
```
exec:summary:tenant-123:month
exec:summary:tenant-123:quarter
exec:kpi:tenant-123:2026-06-01:2026-06-30
```

---

### Finance Intelligence

| API | Memory TTL | Redis TTL | MV Refresh | Invalidation Events |
|-----|-----------|-----------|------------|---------------------|
| `getProfitAndLoss()` | 60s | 1 hour | 1 hour | InvoiceCreated, ExpenseApproved, SalaryCalculated |
| `getCashFlowStatement()` | 60s | 1 hour | 1 hour | InvoiceCreated, ExpenseApproved, PaymentReceived |
| `getFinancialRatios()` | 60s | 1 hour | 1 hour | InvoiceCreated, ExpenseApproved |
| `getExpenseBreakdown()` | 60s | 30 min | 1 hour | ExpenseApproved |

**Cache Key Pattern**: `finance:{metric}:{tenantId}:{period}:{date}`

**Example**:
```
finance:pnl:tenant-123:month:2026-06
finance:cash:tenant-123:month:2026-06
finance:ratios:tenant-123:2026-06-22
```

---

### Marketing Intelligence

| API | Memory TTL | Redis TTL | MV Refresh | Invalidation Events |
|-----|-----------|-----------|------------|---------------------|
| `getCampaignAnalytics()` | 60s | 1 hour | 24 hours | CampaignCreated, CampaignUpdated, ExternalAdsSynced |
| `getROIReport()` | 60s | 1 hour | 24 hours | CampaignCreated, BookingCreated, ExternalAdsSynced |
| `getChannelPerformance()` | 60s | 1 hour | 24 hours | ExternalAdsSynced |

**Cache Key Pattern**: `marketing:{metric}:{tenantId}:{dateRange}`

**Example**:
```
marketing:campaigns:tenant-123:2026-06-01:2026-06-30
marketing:roi:tenant-123:2026-06-01:2026-06-30
marketing:channels:tenant-123:2026-06-01:2026-06-30
```

---

### Sales Intelligence

| API | Memory TTL | Redis TTL | MV Refresh | Invalidation Events |
|-----|-----------|-----------|------------|---------------------|
| `getSalesPipeline()` | 60s | 15 min | 15 min | BookingCreated, BookingUpdated, BookingConfirmed |
| `getConversionFunnel()` | 60s | 30 min | 1 hour | BookingCreated, BookingConfirmed |
| `getRevenueForecast()` | 60s | 12 hours | 24 hours | BookingCreated, InvoiceCreated |

**Cache Key Pattern**: `sales:{metric}:{tenantId}:{dateRange}`

---

### HR Intelligence

| API | Memory TTL | Redis TTL | MV Refresh | Invalidation Events |
|-----|-----------|-----------|------------|---------------------|
| `getWorkforceAnalytics()` | 60s | 1 hour | 24 hours | EmployeeCreated, EmployeeUpdated |
| `getAttendanceReport()` | 60s | 30 min | 1 hour | AttendanceSubmitted |
| `getPayrollSummary()` | 60s | 1 hour | 1 hour | SalaryCalculated |
| `getEmployeePerformance()` | 60s | 30 min | 1 hour | KPIUpdated, SessionCompleted |

**Cache Key Pattern**: `hr:{metric}:{tenantId}:{period}:{date}`

---

### Customer Intelligence

| API | Memory TTL | Redis TTL | MV Refresh | Invalidation Events |
|-----|-----------|-----------|------------|---------------------|
| `getCustomerSegmentation()` | 60s | 24 hours | 24 hours | CustomerCreated, BookingCreated, FeedbackSubmitted |
| `getCustomerLTV()` | 60s | 12 hours | 24 hours | BookingCreated, InvoiceCreated |
| `getChurnRiskAnalysis()` | 60s | 12 hours | 24 hours | BookingCreated, FeedbackSubmitted |
| `getRFMAnalysis()` | 60s | 24 hours | 24 hours | BookingCreated |

**Cache Key Pattern**: `customer:{metric}:{tenantId}:{date}`

---

### Forecast Intelligence

| API | Memory TTL | Redis TTL | MV Refresh | Invalidation Events |
|-----|-----------|-----------|------------|---------------------|
| `getRevenueForecast()` | 60s | 12 hours | 24 hours | End of day (scheduled) |
| `getChurnForecast()` | 60s | 12 hours | 24 hours | End of day (scheduled) |
| `getDemandForecast()` | 60s | 12 hours | 24 hours | End of day (scheduled) |

**Cache Key Pattern**: `forecast:{metric}:{tenantId}:{forecastPeriod}`

---

### Recommendation Engine

| API | Memory TTL | Redis TTL | MV Refresh | Invalidation Events |
|-----|-----------|-----------|------------|---------------------|
| `getServiceRecommendations()` | 60s | 1 hour | N/A | BookingCreated, CustomerUpdated |
| `getUpsellOpportunities()` | 60s | 1 hour | N/A | BookingCreated, CustomerUpdated |
| `getPackageRecommendations()` | 60s | 1 hour | N/A | BookingCreated, PackageCreated |

**Cache Key Pattern**: `recommendation:{type}:{tenantId}:{customerId}`

---

## Cache Invalidation Strategy (Chiến Lược Làm Mới Cache)

### Event-Driven Invalidation

```typescript
// Event Mapping
const eventToCachePatterns: Record<string, string[]> = {
  BookingCreated: [
    'exec:summary:*',
    'sales:pipeline:*',
    'customer:segments:*',
    'recommendation:*'
  ],
  InvoiceCreated: [
    'exec:summary:*',
    'finance:pnl:*',
    'finance:cash:*'
  ],
  ExpenseApproved: [
    'finance:pnl:*',
    'finance:expenses:*'
  ],
  SalaryCalculated: [
    'hr:payroll:*',
    'finance:pnl:*'
  ],
  AttendanceSubmitted: [
    'hr:attendance:*',
    'hr:workforce:*'
  ],
  CampaignCreated: [
    'marketing:campaigns:*'
  ],
  ExternalAdsSynced: [
    'marketing:*'
  ],
  CustomerUpdated: [
    'customer:segments:*',
    'customer:ltv:*',
    'recommendation:*'
  ]
};
```

### Invalidation Flow

```
Business Event
  ↓
Event Listener
  ↓
Event Handler
  ↓
Cache Invalidator
  ├─→ Delete Memory Cache keys
  ├─→ Delete Redis Cache keys
  └─→ Mark Materialized Views for refresh (if needed)
```

### Implementation

```typescript
// src/services/intelligence/events/cache-invalidator.ts
export async function invalidateCache(event: BusinessEvent) {
  const patterns = eventToCachePatterns[event.type] || [];
  
  for (const pattern of patterns) {
    // Invalidate Memory Cache
    await memoryCacheService.deletePattern(pattern);
    
    // Invalidate Redis Cache
    await redisCacheService.deletePattern(pattern);
  }
  
  // Log invalidation
  console.log(`Cache invalidated for event: ${event.type}, patterns: ${patterns.join(', ')}`);
}
```

---

## Materialized View Refresh Strategy (Chiến Lược Refresh Materialized View)

### Refresh Types

#### 1. Real-Time Refresh (5-15 minutes)
- Executive Summary
- Sales Pipeline
- Attendance Report

```sql
-- Scheduled refresh every 5 minutes
CREATE OR REPLACE FUNCTION refresh_executive_summary()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_executive_summary;
END;
$$ LANGUAGE plpgsql;

-- Cron job (using pg_cron)
SELECT cron.schedule('refresh-executive-summary', '*/5 * * * *', 'SELECT refresh_executive_summary()');
```

#### 2. Hourly Refresh
- Finance P&L
- Finance Cash Flow
- Payroll Summary

```sql
-- Scheduled refresh every 1 hour
SELECT cron.schedule('refresh-pnl', '0 * * * *', 'REFRESH MATERIALIZED VIEW CONCURRENTLY mv_monthly_pnl');
```

#### 3. Daily Refresh
- Customer Segmentation
- Marketing Campaigns
- Workforce Analytics
- Forecasts

```sql
-- Scheduled refresh every day at 3:00 AM
SELECT cron.schedule('refresh-customer-segments', '0 3 * * *', 'REFRESH MATERIALIZED VIEW CONCURRENTLY mv_customer_segments');
```

### Event-Driven Refresh

Ngoài scheduled refresh, Materialized Views cũng có thể được refresh khi có events quan trọng:

```typescript
// src/services/intelligence/events/mv-refresher.ts
const eventToMaterializedViews: Record<string, string[]> = {
  BookingConfirmed: ['mv_sales_pipeline', 'mv_executive_summary'],
  InvoiceCreated: ['mv_monthly_pnl', 'mv_monthly_cash_flow'],
  ExpenseApproved: ['mv_monthly_pnl'],
  SalaryCalculated: ['mv_monthly_pnl', 'mv_payroll_summary']
};

export async function refreshMaterializedViews(event: BusinessEvent) {
  const views = eventToMaterializedViews[event.type] || [];
  
  for (const view of views) {
    await db.query(`REFRESH MATERIALIZED VIEW CONCURRENTLY ${view}`);
  }
}
```

---

## Query Optimization (Tối Ưu Hóa Query)

### 1. Use Materialized Views

**KHÔNG ĐƯỢC** query raw tables trực tiếp:
```typescript
// ❌ BAD: Query raw tables
const revenue = await db.query(`
  SELECT SUM(amount) FROM invoices
  WHERE tenant_id = $1 AND status = 'confirmed'
`, [tenantId]);
```

**PHẢI** query Materialized Views:
```typescript
// ✅ GOOD: Query Materialized View
const revenue = await db.query(`
  SELECT total_revenue FROM mv_executive_summary
  WHERE tenant_id = $1 AND period = 'month'
`, [tenantId]);
```

### 2. Use Indexes

Tất cả Materialized Views phải có indexes:
```sql
-- Primary key index
CREATE UNIQUE INDEX ON mv_executive_summary (tenant_id, period);

-- Additional indexes for common filters
CREATE INDEX idx_mv_exec_summary_date ON mv_executive_summary (period_start_date, period_end_date);
```

### 3. Use EXPLAIN ANALYZE

Luôn luôn analyze query performance:
```sql
EXPLAIN ANALYZE
SELECT * FROM mv_executive_summary WHERE tenant_id = 'tenant-123' AND period = 'month';
```

Target: Query time < 50ms (P95)

---

## Performance Monitoring (Giám Sát Hiệu Suất)

### Metrics to Monitor

#### 1. Cache Metrics
- Cache hit rate (Memory, Redis)
- Cache miss rate
- Cache eviction rate
- Cache memory usage

#### 2. Query Metrics
- Query response time (P50, P95, P99)
- Query throughput (QPS)
- Slow query count (> 100ms)

#### 3. API Metrics
- API response time (P50, P95, P99)
- API throughput (RPS)
- API error rate

#### 4. Materialized View Metrics
- Refresh duration
- Refresh frequency
- View size (rows, MB)

### Prometheus Metrics

```typescript
// src/services/intelligence/shared/metrics.ts
import { Counter, Histogram, Gauge } from 'prom-client';

// Cache metrics
export const cacheHitCounter = new Counter({
  name: 'intelligence_cache_hits_total',
  help: 'Total number of cache hits',
  labelNames: ['tier', 'domain']
});

export const cacheMissCounter = new Counter({
  name: 'intelligence_cache_misses_total',
  help: 'Total number of cache misses',
  labelNames: ['tier', 'domain']
});

// Query metrics
export const queryDurationHistogram = new Histogram({
  name: 'intelligence_query_duration_seconds',
  help: 'Query duration in seconds',
  labelNames: ['domain', 'api'],
  buckets: [0.001, 0.01, 0.05, 0.1, 0.5, 1]
});

// API metrics
export const apiDurationHistogram = new Histogram({
  name: 'intelligence_api_duration_seconds',
  help: 'API duration in seconds',
  labelNames: ['domain', 'api'],
  buckets: [0.001, 0.01, 0.05, 0.1, 0.5, 1]
});

// Materialized view metrics
export const mvRefreshDurationGauge = new Gauge({
  name: 'intelligence_mv_refresh_duration_seconds',
  help: 'Materialized view refresh duration in seconds',
  labelNames: ['view']
});
```

### Grafana Dashboards

Dashboard nên bao gồm:
- Cache hit rate (by tier, by domain)
- API response time (P50, P95, P99)
- Query response time (P50, P95, P99)
- API throughput (RPS)
- Cache memory usage
- Materialized view refresh duration

---

## Load Testing (Kiểm Tra Tải)

### Test Scenarios

#### 1. Normal Load
- 100 RPS
- Duration: 10 minutes
- Expected: Response time < 100ms (P95), Cache hit rate > 90%

#### 2. Peak Load
- 500 RPS
- Duration: 5 minutes
- Expected: Response time < 200ms (P95), Cache hit rate > 85%

#### 3. Spike Load
- 0 → 1000 RPS (sudden spike)
- Duration: 1 minute
- Expected: No errors, Response time < 500ms (P95)

#### 4. Sustained Load
- 200 RPS
- Duration: 1 hour
- Expected: Stable response time, No memory leaks

### Load Testing Tools
- Apache JMeter
- k6
- Locust

### Example k6 Script

```javascript
// load-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export let options = {
  stages: [
    { duration: '1m', target: 100 }, // Ramp up to 100 RPS
    { duration: '5m', target: 100 }, // Stay at 100 RPS
    { duration: '1m', target: 0 },   // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<100'], // 95% of requests must complete below 100ms
  },
};

export default function () {
  const res = http.get('https://api.bella-erp.com/intelligence/executive/summary?tenantId=tenant-123&period=month');
  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 100ms': (r) => r.timings.duration < 100,
  });
  sleep(1);
}
```

Run:
```bash
k6 run load-test.js
```

---

## Performance Optimization Tips (Mẹo Tối Ưu Hóa)

### 1. Aggressive Caching
- Cache aggressively ở Memory tier (60s)
- Cache lâu hơn ở Redis tier (5-60 min)
- Sử dụng Materialized Views cho pre-aggregation

### 2. Connection Pooling
- Sử dụng connection pool cho Database
- Sử dụng connection pool cho Redis
- Pool size: 20-50 connections

### 3. Batch Operations
- Batch multiple queries into one
- Batch cache invalidations

### 4. Async Processing
- Sử dụng async/await
- Non-blocking I/O
- Parallel queries khi có thể

### 5. Compression
- Compress cache data (Redis)
- Compress API responses (gzip)

---

## Xem Thêm (See Also)

- [Intelligence Layer Architecture](./INTELLIGENCE_LAYER_ARCHITECTURE.md) - Tổng quan kiến trúc
- [Intelligence Layer Data Flow](./INTELLIGENCE_LAYER_DATA_FLOW.md) - Luồng dữ liệu chi tiết
- [Intelligence Layer Roadmap](./INTELLIGENCE_LAYER_ROADMAP.md) - Lộ trình triển khai

---

## Version History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-06-22 | Chief Solution Architect | Initial performance & caching strategy |
