# Performance Testing & Benchmarks

This directory contains performance tests and benchmarks for the Intelligence Layer.

## 📁 Files

- **`intelligence-executive-load-test.js`** - k6 load test for Executive Intelligence API
- **`benchmark-executive-intelligence.ts`** - Node.js performance benchmark with clinic.js profiling

---

## 🚀 Quick Start

### 1. Install Tools

```bash
# Install k6 (load testing)
# macOS
brew install k6

# Windows (using Chocolatey)
choco install k6

# Linux
sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6

# Install clinic.js (profiling)
npm install -g clinic
```

### 2. Start Dev Server

```bash
npm run dev
```

### 3. Run Load Test

```bash
# Basic load test
k6 run tests/performance/intelligence-executive-load-test.js

# With custom configuration
BASE_URL=http://localhost:3000 TEST_TENANT_ID=your-tenant-id k6 run tests/performance/intelligence-executive-load-test.js

# Save results to JSON
k6 run --out json=test-results.json tests/performance/intelligence-executive-load-test.js
```

---

## 📊 Load Test Details

### Test Stages

1. **Warmup** (30s, 10 users): Populate cache with initial requests
2. **Ramp Up** (1min, 10→50 users): Gradually increase load
3. **Sustained Load** (3min, 50 users): Measure cache hit rate and stability
4. **Ramp Down** (1min, 50→0 users): Graceful shutdown

**Total Duration**: ~5.5 minutes

### Performance Targets

| Metric | Target | Description |
|--------|--------|-------------|
| Cache Hit Rate | >80% | Percentage of requests served from cache |
| P95 Response Time | <1000ms | 95th percentile response time |
| Cached Response Time | <50ms | Average response time for cache hits |
| Fresh Response Time | <1000ms | Average response time for cache misses |
| Throughput | >100 req/s | Requests per second during sustained load |
| Error Rate | <1% | Percentage of failed requests |
| Dashboard Load Time | <5s | Time to load all 5 metrics in parallel |

### Test Scenarios

1. **Single Metric Query** (30% of requests)
   - Tests individual endpoint performance
   - Measures cache effectiveness

2. **Dashboard Load** (50% of requests)
   - Simulates loading all 5 metrics in parallel
   - Tests concurrent request handling

3. **Period Switching** (15% of requests)
   - Tests different time periods (day, week, month, quarter, year)
   - Verifies cache key differentiation

4. **Cache Invalidation** (5% of requests)
   - Tests post-invalidation behavior
   - Verifies cache refresh logic

---

## 🔬 Profiling with clinic.js

### Doctor (Event Loop Delay)

Diagnoses event loop delays and async issues:

```bash
clinic doctor -- node --loader ts-node/esm tests/performance/benchmark-executive-intelligence.ts
```

**What to Look For:**
- Event loop delays >10ms
- Long-running synchronous operations
- Blocked I/O operations

### Flame (CPU Profiling)

Identifies CPU-intensive operations:

```bash
clinic flame -- node --loader ts-node/esm tests/performance/benchmark-executive-intelligence.ts
```

**What to Look For:**
- Hot paths (frequently called functions)
- Inefficient algorithms (O(n²) loops)
- JSON parsing overhead

### BubbleProf (Async Operations)

Analyzes async operation delays:

```bash
clinic bubbleprof -- node --loader ts-node/esm tests/performance/benchmark-executive-intelligence.ts
```

**What to Look For:**
- Slow database queries
- Cache read/write delays
- Promise chain bottlenecks

---

## 🎯 Cache Tuning Recommendations

### Current Configuration

```typescript
// src/services/intelligence/shared/constants.ts
export const DEFAULT_CACHE_TTL = {
  EXECUTIVE: 600, // 10 minutes
};
```

### Tuning Guidelines

#### 1. Increase TTL if Cache Hit Rate is High (>90%)

If cache hit rate consistently exceeds 90%, you can increase TTL to reduce database load:

```typescript
export const DEFAULT_CACHE_TTL = {
  EXECUTIVE: 900, // 15 minutes (increased from 10)
};
```

**Trade-offs:**
- ✅ Fewer database queries
- ✅ Lower database CPU usage
- ❌ Staler data (up to 15 minutes old)

#### 2. Decrease TTL if Data Freshness is Critical

If business requirements demand near-real-time data:

```typescript
export const DEFAULT_CACHE_TTL = {
  EXECUTIVE: 300, // 5 minutes (decreased from 10)
};
```

**Trade-offs:**
- ✅ Fresher data
- ❌ More database queries
- ❌ Higher database CPU usage

#### 3. Implement Cache Warming

Pre-populate cache on server startup or tenant login:

```typescript
// src/services/intelligence/cache/warming.ts
export async function warmExecutiveCache(tenantId: string) {
  const service = getExecutiveIntelligence();
  
  // Pre-fetch common queries
  await Promise.all([
    service.getMonthlyRevenueSummary(tenantId, 'month'),
    service.getOperationalEfficiency(tenantId, 'month'),
    service.getCustomerMetrics(tenantId, 'month'),
    service.getFinancialHealth(tenantId, 'month'),
    service.getGrowthIndicators(tenantId, 'month'),
  ]);
  
  console.log(`✅ Warmed cache for tenant ${tenantId}`);
}
```

#### 4. Implement Tiered TTL Strategy

Different metrics may have different freshness requirements:

```typescript
export const DEFAULT_CACHE_TTL = {
  EXECUTIVE_REVENUE: 300,      // 5 min (high priority, changes frequently)
  EXECUTIVE_OPERATIONAL: 600,  // 10 min (moderate priority)
  EXECUTIVE_CUSTOMER: 900,     // 15 min (low priority, changes slowly)
  EXECUTIVE_FINANCIAL: 600,    // 10 min (moderate priority)
  EXECUTIVE_GROWTH: 1800,      // 30 min (lowest priority, historical data)
};
```

#### 5. Monitor Cache Performance

Add cache metrics to your monitoring dashboard:

```typescript
// Example: Prometheus metrics
cacheHitRate.set(cacheHits / (cacheHits + cacheMisses));
cacheMemoryUsage.set(process.memoryUsage().heapUsed / 1024 / 1024);
avgCachedResponseTime.set(avgCached);
avgFreshResponseTime.set(avgFresh);
```

---

## 📈 Interpreting Results

### Good Performance ✅

```
Cache Hit Rate:       85.2% (target >80%)
P95 Response Time:    842ms (target <1000ms)
Cached Response Time: 38ms (target <50ms)
Throughput:           127 req/s (target >100)
Error Rate:           0.2% (target <1%)
```

**Actions:** No tuning needed. System is performing well.

### High Cache Miss Rate ⚠️

```
Cache Hit Rate:       42% (target >80%)
```

**Possible Causes:**
1. TTL too short (cache expires before reuse)
2. High query parameter variation (different date ranges)
3. Cache not warmed up after deployment

**Solutions:**
- Increase TTL from 10min to 15min
- Implement cache warming on startup
- Reduce date range granularity (use day/week/month instead of custom ranges)

### Slow Response Times ⚠️

```
P95 Response Time:    2300ms (target <1000ms)
```

**Possible Causes:**
1. Slow database queries (missing indexes)
2. Large result sets (too much data returned)
3. Network latency (database in different region)

**Solutions:**
- Add database indexes on frequently queried columns
- Implement pagination for large result sets
- Optimize SQL queries (use EXPLAIN ANALYZE)
- Consider database replica in same region as app server

### High Memory Usage ⚠️

```
Memory Usage: 850 MB (for 100 tenants)
```

**Possible Causes:**
1. Cache storing too much data per tenant
2. Memory leaks in service layer
3. Large JSON objects not garbage collected

**Solutions:**
- Reduce cache payload size (select only needed columns)
- Implement cache eviction policy (LRU)
- Run clinic.js heap profiling to identify leaks

---

## 🧪 CI/CD Integration

### GitHub Actions Example

```yaml
name: Performance Tests

on:
  pull_request:
    branches: [main]
  schedule:
    - cron: '0 2 * * *' # Daily at 2 AM

jobs:
  performance:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Start dev server
        run: npm run dev &
        
      - name: Wait for server
        run: npx wait-on http://localhost:3000
      
      - name: Install k6
        run: |
          sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
          echo "deb https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
          sudo apt-get update
          sudo apt-get install k6
      
      - name: Run load test
        run: k6 run --out json=results.json tests/performance/intelligence-executive-load-test.js
      
      - name: Upload results
        uses: actions/upload-artifact@v3
        with:
          name: performance-results
          path: results.json
      
      - name: Check performance thresholds
        run: |
          CACHE_HIT_RATE=$(jq '.metrics.cache_hit_rate.values.rate' results.json)
          if (( $(echo "$CACHE_HIT_RATE < 0.8" | bc -l) )); then
            echo "❌ Cache hit rate below 80%: $CACHE_HIT_RATE"
            exit 1
          fi
          echo "✅ Performance tests passed"
```

---

## 📚 Additional Resources

- **k6 Documentation**: https://k6.io/docs/
- **clinic.js Guide**: https://clinicjs.org/documentation/
- **Cache Strategy Patterns**: https://aws.amazon.com/caching/best-practices/
- **Node.js Performance Best Practices**: https://nodejs.org/en/docs/guides/simple-profiling/

---

## 🐛 Troubleshooting

### Issue: k6 test fails with "connection refused"

**Solution:** Ensure dev server is running on `http://localhost:3000`

```bash
# Terminal 1: Start dev server
npm run dev

# Terminal 2: Run load test
k6 run tests/performance/intelligence-executive-load-test.js
```

### Issue: Cache hit rate is 0%

**Solution:** Run warmup phase before test

```bash
# Manually warm cache
curl "http://localhost:3000/api/intelligence/executive/monthly-revenue-summary?tenantId=YOUR_TENANT&period=month"

# Then run load test
k6 run tests/performance/intelligence-executive-load-test.js
```

### Issue: clinic.js reports fail to generate

**Solution:** Ensure HTML report directory is writable

```bash
# Check permissions
ls -la .clinic

# If directory doesn't exist, clinic.js will create it
# If permission denied, fix permissions:
chmod 755 .clinic
```

---

**Last Updated**: 2026-06-22  
**Maintainer**: Intelligence Layer Team
