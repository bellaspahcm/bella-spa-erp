# Intelligence Layer Testing Strategy - Chiến Lược Kiểm Thử

## Tổng Quan (Overview)

Intelligence Layer yêu cầu **comprehensive testing strategy** để đảm bảo:
- **Data accuracy** (độ chính xác dữ liệu 100%)
- **Performance** (response time < 100ms)
- **Reliability** (uptime > 99.9%)
- **Cache consistency** (cache luôn đúng)

---

## Testing Pyramid (Kim Tự Tháp Kiểm Thử)

```
           ┌──────────────────┐
           │   E2E Tests      │  5%
           │   (10 tests)     │
           └──────────────────┘
         ┌────────────────────────┐
         │  Integration Tests     │  25%
         │  (50 tests)            │
         └────────────────────────┘
       ┌──────────────────────────────┐
       │      Unit Tests              │  70%
       │      (140 tests)             │
       └──────────────────────────────┘
```

**Total: ~200 tests**

---

## 1. Unit Tests (140 tests, 70%)

### Mục Tiêu
- Test từng function/method riêng lẻ
- Mock dependencies (database, cache, external APIs)
- Fast execution (< 1 second total)

### Scope

#### 1.1. Cache Service Tests (20 tests)
```typescript
// __tests__/cache/memory-cache.test.ts
describe('MemoryCacheService', () => {
  let cache: MemoryCacheService;
  
  beforeEach(() => {
    cache = new MemoryCacheService();
  });
  
  test('should set and get value', async () => {
    await cache.set('key1', 'value1');
    const value = await cache.get('key1');
    expect(value).toBe('value1');
  });
  
  test('should return null for expired key', async () => {
    await cache.set('key1', 'value1', { ttl: 100 }); // 100ms
    await sleep(200);
    const value = await cache.get('key1');
    expect(value).toBeNull();
  });
  
  test('should delete key', async () => {
    await cache.set('key1', 'value1');
    await cache.delete('key1');
    const value = await cache.get('key1');
    expect(value).toBeNull();
  });
  
  test('should delete keys by pattern', async () => {
    await cache.set('exec:summary:tenant1:month', 'data1');
    await cache.set('exec:summary:tenant1:quarter', 'data2');
    await cache.set('finance:pnl:tenant1:month', 'data3');
    
    await cache.deletePattern('exec:summary:*');
    
    expect(await cache.get('exec:summary:tenant1:month')).toBeNull();
    expect(await cache.get('exec:summary:tenant1:quarter')).toBeNull();
    expect(await cache.get('finance:pnl:tenant1:month')).not.toBeNull();
  });
  
  // ... 16 more tests (LRU eviction, memory limit, etc.)
});
```

#### 1.2. Event Handler Tests (15 tests)
```typescript
// __tests__/events/event-handlers.test.ts
describe('Event Handlers', () => {
  let cacheService: CacheService;
  
  beforeEach(() => {
    cacheService = createMockCacheService();
  });
  
  test('should invalidate cache on BookingCreated', async () => {
    const event: BusinessEvent = {
      type: 'BookingCreated',
      payload: { tenantId: 'tenant-123', bookingId: 'booking-456' }
    };
    
    await handleEvent(event, cacheService);
    
    expect(cacheService.deletePattern).toHaveBeenCalledWith('exec:summary:tenant-123:*');
    expect(cacheService.deletePattern).toHaveBeenCalledWith('sales:pipeline:tenant-123:*');
    expect(cacheService.deletePattern).toHaveBeenCalledWith('customer:segments:tenant-123:*');
  });
  
  test('should invalidate cache on InvoiceCreated', async () => {
    const event: BusinessEvent = {
      type: 'InvoiceCreated',
      payload: { tenantId: 'tenant-123', invoiceId: 'invoice-789' }
    };
    
    await handleEvent(event, cacheService);
    
    expect(cacheService.deletePattern).toHaveBeenCalledWith('exec:summary:tenant-123:*');
    expect(cacheService.deletePattern).toHaveBeenCalledWith('finance:pnl:tenant-123:*');
    expect(cacheService.deletePattern).toHaveBeenCalledWith('finance:cash:tenant-123:*');
  });
  
  // ... 13 more tests
});
```

#### 1.3. Executive Intelligence Tests (15 tests)
```typescript
// __tests__/executive/executive-intelligence.test.ts
describe('ExecutiveIntelligence', () => {
  let db: MockDatabase;
  let cache: MockCache;
  let executive: ExecutiveIntelligence;
  
  beforeEach(() => {
    db = createMockDatabase();
    cache = createMockCache();
    executive = new ExecutiveIntelligence(db, cache);
  });
  
  test('should return cached data if available', async () => {
    const cachedData = { revenue: { total: 450000000 } };
    cache.get.mockResolvedValue(cachedData);
    
    const result = await executive.getExecutiveSummary({
      tenantId: 'tenant-123',
      period: 'month'
    });
    
    expect(result).toEqual(cachedData);
    expect(db.query).not.toHaveBeenCalled();
  });
  
  test('should query database on cache miss', async () => {
    cache.get.mockResolvedValue(null);
    const dbData = { /* mock database response */ };
    db.query.mockResolvedValue(dbData);
    
    const result = await executive.getExecutiveSummary({
      tenantId: 'tenant-123',
      period: 'month'
    });
    
    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('mv_executive_summary'));
    expect(cache.set).toHaveBeenCalled();
  });
  
  test('should transform database data to DTO correctly', async () => {
    const dbData = {
      total_revenue: 450000000,
      revenue_growth_pct: 12.5,
      gross_profit: 135000000,
      // ... more fields
    };
    
    const result = await executive.transformToDTO(dbData);
    
    expect(result.revenue.total).toBe(450000000);
    expect(result.revenue.growth).toBe(12.5);
    expect(result.profit.gross).toBe(135000000);
  });
  
  // ... 12 more tests
});
```

#### 1.4. Finance Intelligence Tests (15 tests)
#### 1.5. Marketing Intelligence Tests (15 tests)
#### 1.6. Sales Intelligence Tests (15 tests)
#### 1.7. HR Intelligence Tests (15 tests)
#### 1.8. Customer Intelligence Tests (15 tests)
#### 1.9. Forecast Intelligence Tests (10 tests)
#### 1.10. Recommendation Engine Tests (10 tests)
#### 1.11. Helper Functions Tests (10 tests)

---

## 2. Integration Tests (50 tests, 25%)

### Mục Tiêu
- Test interaction giữa các modules
- Test với real database (test database)
- Test cache behavior
- Slower execution (< 10 seconds total)

### Setup
```typescript
// __tests__/integration/setup.ts
import { createClient } from '@supabase/supabase-js';

let supabase: SupabaseClient;

beforeAll(async () => {
  // Setup test database
  supabase = createClient(
    process.env.SUPABASE_TEST_URL!,
    process.env.SUPABASE_TEST_KEY!
  );
  
  // Run migrations
  await runMigrations();
  
  // Seed test data
  await seedTestData();
});

afterAll(async () => {
  // Cleanup test database
  await cleanupTestData();
});
```

### Scope

#### 2.1. Executive Intelligence Integration Tests (10 tests)
```typescript
// __tests__/integration/executive-intelligence.test.ts
describe('ExecutiveIntelligence Integration', () => {
  test('should return accurate executive summary', async () => {
    // Seed data
    await seedBookings([
      { amount: 10000000, status: 'confirmed', date: '2026-06-01' },
      { amount: 15000000, status: 'confirmed', date: '2026-06-05' },
      // ... more bookings
    ]);
    
    await seedInvoices([
      { amount: 10000000, status: 'confirmed', date: '2026-06-01' },
      // ... more invoices
    ]);
    
    // Call Intelligence Layer
    const result = await ExecutiveIntelligence.getExecutiveSummary({
      tenantId: 'test-tenant',
      period: 'month'
    });
    
    // Verify accuracy
    expect(result.revenue.total).toBe(25000000);
    expect(result.revenue.growth).toBeCloseTo(12.5, 1);
  });
  
  test('should use cache on second call', async () => {
    const firstCall = await ExecutiveIntelligence.getExecutiveSummary({
      tenantId: 'test-tenant',
      period: 'month'
    });
    
    const startTime = Date.now();
    const secondCall = await ExecutiveIntelligence.getExecutiveSummary({
      tenantId: 'test-tenant',
      period: 'month'
    });
    const duration = Date.now() - startTime;
    
    expect(duration).toBeLessThan(10); // Should be < 10ms (cache hit)
    expect(firstCall).toEqual(secondCall);
  });
  
  test('should invalidate cache on BookingCreated event', async () => {
    // First call (populate cache)
    const firstResult = await ExecutiveIntelligence.getExecutiveSummary({
      tenantId: 'test-tenant',
      period: 'month'
    });
    
    // Emit event
    await eventBus.emit('BookingCreated', {
      tenantId: 'test-tenant',
      bookingId: 'new-booking',
      amount: 5000000
    });
    
    // Wait for cache invalidation
    await sleep(100);
    
    // Second call (should query DB again)
    const secondResult = await ExecutiveIntelligence.getExecutiveSummary({
      tenantId: 'test-tenant',
      period: 'month'
    });
    
    expect(secondResult.revenue.total).toBeGreaterThan(firstResult.revenue.total);
  });
  
  // ... 7 more tests
});
```

#### 2.2. Finance Intelligence Integration Tests (10 tests)
#### 2.3. Marketing Intelligence Integration Tests (10 tests)
#### 2.4. Sales Intelligence Integration Tests (5 tests)
#### 2.5. HR Intelligence Integration Tests (5 tests)
#### 2.6. Customer Intelligence Integration Tests (5 tests)
#### 2.7. Cache Invalidation Integration Tests (5 tests)

---

## 3. E2E Tests (10 tests, 5%)

### Mục Tiêu
- Test toàn bộ flow từ API endpoint → Intelligence Layer → Database
- Test với production-like environment
- Test AI Agent integration

### Scope

#### 3.1. CEO Agent E2E Tests (3 tests)
```typescript
// __tests__/e2e/ceo-agent.test.ts
describe('CEO Agent E2E', () => {
  test('should answer "Doanh thu tháng này thế nào?"', async () => {
    // Seed data
    await seedProductionLikeData();
    
    // Call CEO Agent API
    const response = await fetch('http://localhost:3000/api/agents/ceo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantId: 'test-tenant',
        message: 'Doanh thu tháng này thế nào?'
      })
    });
    
    const result = await response.json();
    
    // Verify response
    expect(result.message).toContain('450 triệu');
    expect(result.message).toContain('tăng 12%');
  });
  
  test('should answer "Top 5 KPI quan trọng nhất hiện tại?"', async () => {
    // ... similar test
  });
  
  test('should answer "Có vấn đề gì cần chú ý không?"', async () => {
    // ... similar test
  });
});
```

#### 3.2. CFO Agent E2E Tests (2 tests)
#### 3.3. CMO Agent E2E Tests (2 tests)
#### 3.4. Dashboard E2E Tests (3 tests)

---

## 4. Data Accuracy Tests (Critical)

### Mục Tiêu
- Đảm bảo 100% accuracy với current calculation logic
- Verify Intelligence Layer results = Current system results

### Approach: Reconciliation Tests

```typescript
// __tests__/accuracy/reconciliation.test.ts
describe('Data Accuracy Reconciliation', () => {
  test('Executive Summary should match current calculation', async () => {
    const tenantId = 'real-tenant-123';
    const period = 'month';
    
    // Get result from Intelligence Layer
    const intelligenceResult = await ExecutiveIntelligence.getExecutiveSummary({
      tenantId,
      period
    });
    
    // Get result from Current System (legacy calculation)
    const currentResult = await getCurrentExecutiveSummary(tenantId, period);
    
    // Compare
    expect(intelligenceResult.revenue.total).toBe(currentResult.revenue.total);
    expect(intelligenceResult.profit.net).toBe(currentResult.profit.net);
    expect(intelligenceResult.customers.total).toBe(currentResult.customers.total);
    // ... compare all fields
  });
  
  test('Finance P&L should match current calculation', async () => {
    // ... similar test
  });
  
  test('Marketing ROI should match current calculation', async () => {
    // ... similar test
  });
  
  // ... more reconciliation tests for all domains
});
```

**Run these tests against production data (read-only) before go-live.**

---

## 5. Performance Tests

### 5.1. Response Time Tests
```typescript
// __tests__/performance/response-time.test.ts
describe('Response Time', () => {
  test('getExecutiveSummary should respond < 100ms (cache hit)', async () => {
    // Warm up cache
    await ExecutiveIntelligence.getExecutiveSummary({
      tenantId: 'test-tenant',
      period: 'month'
    });
    
    // Measure response time
    const startTime = performance.now();
    await ExecutiveIntelligence.getExecutiveSummary({
      tenantId: 'test-tenant',
      period: 'month'
    });
    const duration = performance.now() - startTime;
    
    expect(duration).toBeLessThan(100);
  });
  
  test('getExecutiveSummary should respond < 200ms (cache miss)', async () => {
    // Clear cache
    await cacheService.deletePattern('exec:*');
    
    // Measure response time
    const startTime = performance.now();
    await ExecutiveIntelligence.getExecutiveSummary({
      tenantId: 'test-tenant',
      period: 'month'
    });
    const duration = performance.now() - startTime;
    
    expect(duration).toBeLessThan(200);
  });
});
```

### 5.2. Load Tests
- Sử dụng k6, JMeter, hoặc Locust
- Test scenarios:
  - Normal load: 100 RPS
  - Peak load: 500 RPS
  - Spike load: 0 → 1000 RPS
- Targets:
  - Response time P95 < 100ms
  - Error rate < 0.1%
  - Cache hit rate > 90%

---

## 6. Reliability Tests

### 6.1. Fault Tolerance Tests
```typescript
describe('Fault Tolerance', () => {
  test('should fallback to DB on Redis failure', async () => {
    // Simulate Redis failure
    redisClient.get = jest.fn().mockRejectedValue(new Error('Redis connection failed'));
    
    // Should still work (query DB)
    const result = await ExecutiveIntelligence.getExecutiveSummary({
      tenantId: 'test-tenant',
      period: 'month'
    });
    
    expect(result).toBeDefined();
    expect(result.revenue.total).toBeGreaterThan(0);
  });
  
  test('should return cached data on DB failure (if cached)', async () => {
    // Populate cache
    await ExecutiveIntelligence.getExecutiveSummary({
      tenantId: 'test-tenant',
      period: 'month'
    });
    
    // Simulate DB failure
    db.query = jest.fn().mockRejectedValue(new Error('DB connection failed'));
    
    // Should return cached data
    const result = await ExecutiveIntelligence.getExecutiveSummary({
      tenantId: 'test-tenant',
      period: 'month'
    });
    
    expect(result).toBeDefined();
  });
});
```

### 6.2. Cache Consistency Tests
```typescript
describe('Cache Consistency', () => {
  test('cache should be invalidated within 1 second of event', async () => {
    // Populate cache
    const firstResult = await ExecutiveIntelligence.getExecutiveSummary({
      tenantId: 'test-tenant',
      period: 'month'
    });
    
    // Emit event
    const eventTime = Date.now();
    await eventBus.emit('BookingCreated', { /* ... */ });
    
    // Wait for cache invalidation
    await waitForCacheInvalidation();
    const invalidationTime = Date.now();
    
    // Check cache is invalidated
    const cachedValue = await cacheService.get('exec:summary:test-tenant:month');
    expect(cachedValue).toBeNull();
    
    // Verify timing
    expect(invalidationTime - eventTime).toBeLessThan(1000); // < 1 second
  });
});
```

---

## 7. External API Tests (Marketing Intelligence)

### 7.1. Facebook Ads Connector Tests
```typescript
describe('FacebookAdsConnector', () => {
  test('should fetch campaigns from Facebook Ads API', async () => {
    const connector = new FacebookAdsConnector();
    
    const result = await connector.sync({
      tenantId: 'test-tenant',
      dateRange: {
        from: new Date('2026-06-01'),
        to: new Date('2026-06-30')
      }
    });
    
    expect(result.success).toBe(true);
    expect(result.recordCount).toBeGreaterThan(0);
  });
  
  test('should handle Facebook API rate limit', async () => {
    // Simulate rate limit error
    facebookAPI.get = jest.fn().mockRejectedValue({ code: 17, message: 'Rate limit exceeded' });
    
    const connector = new FacebookAdsConnector();
    
    // Should retry with exponential backoff
    await expect(connector.sync({ /* ... */ })).resolves.toBeDefined();
  });
  
  test('should transform Facebook data to unified schema', async () => {
    const facebookData = {
      id: 'fb-campaign-123',
      impressions: 10000,
      clicks: 500,
      spend: 5000000,
      // ... Facebook-specific fields
    };
    
    const transformed = connector.transform(facebookData);
    
    expect(transformed.platform).toBe('facebook');
    expect(transformed.external_campaign_id).toBe('fb-campaign-123');
    expect(transformed.impressions).toBe(10000);
    expect(transformed.clicks).toBe(500);
    expect(transformed.spend).toBe(5000000);
  });
});
```

### 7.2. Google Ads Connector Tests (similar)
### 7.3. TikTok Ads Connector Tests (similar)
### 7.4. Zalo OA Connector Tests (similar)

---

## 8. Test Coverage Requirements

### Coverage Targets
- **Unit Tests**: 80% line coverage
- **Integration Tests**: 90% critical path coverage
- **E2E Tests**: 100% user journey coverage

### Coverage Report
```bash
npm.cmd run test:coverage
```

Output:
```
----------------------------|---------|----------|---------|---------|-------------------
File                        | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
----------------------------|---------|----------|---------|---------|-------------------
All files                   |   82.5  |   78.3   |   85.1  |   83.2  |
 executive/                 |   85.0  |   80.0   |   87.0  |   86.0  |
  index.ts                  |   90.0  |   85.0   |   92.0  |   91.0  | 45-47,102-105
  queries.ts                |   80.0  |   75.0   |   82.0  |   81.0  | 67-70,145-150
 finance/                   |   80.0  |   76.0   |   83.0  |   81.0  |
 marketing/                 |   83.0  |   79.0   |   85.0  |   84.0  |
 ...
----------------------------|---------|----------|---------|---------|-------------------
```

---

## 9. CI/CD Integration

### GitHub Actions Workflow
```yaml
# .github/workflows/test.yml
name: Intelligence Layer Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
      
      redis:
        image: redis:7
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: 18
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run migrations
        run: npm run db:migrate
      
      - name: Run unit tests
        run: npm run test:unit
      
      - name: Run integration tests
        run: npm run test:integration
      
      - name: Run E2E tests
        run: npm run test:e2e
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info
```

### Test Scripts (package.json)
```json
{
  "scripts": {
    "test": "jest",
    "test:unit": "jest --testPathPattern=__tests__/unit",
    "test:integration": "jest --testPathPattern=__tests__/integration",
    "test:e2e": "jest --testPathPattern=__tests__/e2e",
    "test:accuracy": "jest --testPathPattern=__tests__/accuracy",
    "test:performance": "jest --testPathPattern=__tests__/performance",
    "test:coverage": "jest --coverage",
    "test:watch": "jest --watch"
  }
}
```

---

## 10. Test Data Management

### Test Data Strategy
- Use **fixture files** for consistent test data
- Use **factory functions** for dynamic test data
- Use **seed scripts** for integration/E2E tests

### Fixture Example
```typescript
// __tests__/fixtures/bookings.ts
export const mockBookings = [
  {
    id: 'booking-1',
    tenant_id: 'test-tenant',
    customer_id: 'customer-1',
    package_id: 'package-1',
    amount: 10000000,
    status: 'confirmed',
    booking_date: '2026-06-01'
  },
  // ... more bookings
];
```

### Factory Example
```typescript
// __tests__/factories/booking-factory.ts
export function createBooking(overrides?: Partial<Booking>): Booking {
  return {
    id: faker.string.uuid(),
    tenant_id: 'test-tenant',
    customer_id: faker.string.uuid(),
    package_id: faker.string.uuid(),
    amount: faker.number.int({ min: 1000000, max: 50000000 }),
    status: 'confirmed',
    booking_date: faker.date.recent().toISOString(),
    ...overrides
  };
}
```

---

## Xem Thêm (See Also)

- [Intelligence Layer Architecture](./INTELLIGENCE_LAYER_ARCHITECTURE.md) - Tổng quan kiến trúc
- [Intelligence Layer Roadmap](./INTELLIGENCE_LAYER_ROADMAP.md) - Lộ trình triển khai
- [Intelligence Layer Performance](./INTELLIGENCE_LAYER_PERFORMANCE.md) - Caching & optimization

---

## Version History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-06-22 | Chief Solution Architect | Initial testing strategy |
