# Intelligence Layer Data Flow - Luồng Dữ Liệu Chi Tiết

## Tổng Quan (Overview)

Intelligence Layer là trung gian giữa Database và Consumers. Luồng dữ liệu luôn một chiều:

```
Database → Intelligence Layer → Consumers
         (KHÔNG BAO GIỜ ngược chiều)
```

---

## Flow 1: AI Agent Query Flow (Luồng Truy Vấn AI Agent)

### Scenario: CEO Agent hỏi "Doanh thu tháng này thế nào?"

```
┌─────────────────────────────────────────────────────────────────────┐
│ 1. CEO Agent                                                        │
│    - User prompt: "Doanh thu tháng này thế nào?"                    │
│    - AI Orchestrator parse intent                                  │
│    - Xác định cần gọi getExecutiveSummary()                        │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ 2. Intelligence Layer - Executive Module                           │
│    - Nhận request: getExecutiveSummary({ tenantId, period: 'month' }) │
│    - Generate cache key: `exec:summary:tenant123:2026-06`         │
│    - Check cache tiers (Memory → Redis → DB)                       │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
          ┌──────────────────┴───────────────────┐
          │                                      │
    Cache Hit?                             Cache Miss?
          │                                      │
          ↓                                      ↓
┌──────────────────────┐            ┌────────────────────────────────┐
│ 3a. Return from Cache│            │ 3b. Query Database             │
│ - Get from Redis     │            │ - Query Materialized View:     │
│ - Deserialize JSON   │            │   `mv_executive_summary`       │
│ - Return DTO         │            │ - Transform to DTO             │
└──────────────────────┘            │ - Store in cache (Redis + Mem) │
                                    │ - Return DTO                   │
                                    └────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ 4. CEO Agent                                                        │
│    - Nhận ExecutiveSummaryDTO                                      │
│    - Format thành prompt cho LLM                                   │
│    - LLM phân tích và trả lời bằng ngôn ngữ tự nhiên              │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ 5. User                                                             │
│    - Nhận câu trả lời: "Doanh thu tháng này là 450 triệu đồng,     │
│      tăng 12% so với tháng trước..."                                │
└─────────────────────────────────────────────────────────────────────┘
```

### Code Example

```typescript
// AI Agent (consumer)
async function handleCEOQuery(userPrompt: string, tenantId: string) {
  // AI Orchestrator xác định intent
  const intent = parseIntent(userPrompt);
  
  if (intent === 'EXECUTIVE_SUMMARY') {
    // Gọi Intelligence Layer
    const summary = await ExecutiveIntelligence.getExecutiveSummary({
      tenantId,
      period: 'month'
    });
    
    // Format cho LLM
    const llmPrompt = `
      Dựa trên dữ liệu sau, trả lời câu hỏi của CEO:
      - Doanh thu: ${summary.revenue.total}
      - Tăng trưởng: ${summary.revenue.growth}%
      - Lợi nhuận: ${summary.profit.net}
      ...
    `;
    
    // LLM analysis
    const response = await callLLM(llmPrompt);
    return response;
  }
}
```

```typescript
// Intelligence Layer (Executive module)
export async function getExecutiveSummary(params: ExecutiveSummaryParams): Promise<ExecutiveSummaryDTO> {
  const cacheKey = `exec:summary:${params.tenantId}:${params.period}`;
  
  // Check cache
  const cached = await cacheService.get(cacheKey);
  if (cached) return cached;
  
  // Query database (materialized view)
  const data = await db.query(`
    SELECT * FROM mv_executive_summary
    WHERE tenant_id = $1 AND period = $2
  `, [params.tenantId, params.period]);
  
  // Transform to DTO
  const dto = transformToExecutiveSummaryDTO(data);
  
  // Store in cache
  await cacheService.set(cacheKey, dto, { ttl: 300 }); // 5 minutes
  
  return dto;
}
```

---

## Flow 2: Dashboard Query Flow (Luồng Truy Vấn Dashboard)

### Scenario: User mở Finance Dashboard

```
┌─────────────────────────────────────────────────────────────────────┐
│ 1. Dashboard Component (Frontend)                                  │
│    - Component mount: FinanceDashboard.tsx                         │
│    - Gọi API: GET /api/intelligence/finance/pnl?period=month      │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ 2. API Route (Next.js)                                             │
│    - Route: /api/intelligence/finance/pnl                         │
│    - Validate params                                               │
│    - Call Intelligence Layer                                       │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ 3. Intelligence Layer - Finance Module                            │
│    - Nhận request: getProfitAndLoss({ tenantId, period, date })  │
│    - Generate cache key: `finance:pnl:tenant123:2026-06`         │
│    - Check cache (Memory → Redis → DB)                            │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
          ┌──────────────────┴───────────────────┐
          │                                      │
    Cache Hit?                             Cache Miss?
          │                                      │
          ↓                                      ↓
┌──────────────────────┐            ┌────────────────────────────────┐
│ 4a. Return from Cache│            │ 4b. Query Database             │
└──────────────────────┘            │ - Query Materialized View:     │
                                    │   `mv_monthly_pnl`             │
                                    │ - Transform to PnLDTO          │
                                    │ - Store in cache               │
                                    └────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ 5. API Route                                                       │
│    - Return JSON response                                          │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ 6. Dashboard Component                                             │
│    - Nhận PnLDTO                                                   │
│    - Render charts (Revenue, Expenses, Profit)                    │
│    - Display tables                                                │
└─────────────────────────────────────────────────────────────────────┘
```

### Code Example

```typescript
// Frontend (Dashboard component)
export default function FinanceDashboard() {
  const { data, isLoading } = useSWR(
    `/api/intelligence/finance/pnl?period=month`,
    fetcher
  );
  
  if (isLoading) return <Loading />;
  
  return (
    <div>
      <RevenueChart data={data.revenue} />
      <ExpenseChart data={data.expenses} />
      <ProfitChart data={data.profit} />
    </div>
  );
}
```

```typescript
// API Route (Next.js)
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const period = searchParams.get('period');
  
  const pnl = await FinanceIntelligence.getProfitAndLoss({
    tenantId: getCurrentTenantId(),
    period,
    date: new Date()
  });
  
  return NextResponse.json(pnl);
}
```

---

## Flow 3: Event-Driven Cache Invalidation (Cache Tự Động Làm Mới)

### Scenario: Booking mới được tạo → Cache bị invalidate

```
┌─────────────────────────────────────────────────────────────────────┐
│ 1. Business Transaction                                            │
│    - User tạo booking mới                                          │
│    - BookingService.createBooking()                               │
│    - Insert vào `bookings` table                                  │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ 2. Accounting Outbox Pattern                                      │
│    - Trigger: AFTER INSERT on bookings                            │
│    - Insert event vào `business_events` table                     │
│    - Event: BookingCreated { bookingId, tenantId, amount, ... }  │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ 3. Event Listener (Intelligence Layer)                            │
│    - Background worker polling `business_events`                  │
│    - Detect new event: BookingCreated                             │
│    - Dispatch to appropriate handler                              │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ 4. Event Handler                                                  │
│    - Handle BookingCreated event                                  │
│    - Xác định các cache keys bị ảnh hưởng:                        │
│      - `exec:summary:tenant123:*`                                 │
│      - `sales:pipeline:tenant123:*`                               │
│      - `customer:segments:tenant123:*`                            │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ 5. Cache Invalidator                                              │
│    - Delete cache keys từ Memory Cache                            │
│    - Delete cache keys từ Redis                                   │
│    - Mark materialized views for refresh (nếu cần)                │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ 6. Next Query                                                     │
│    - Cache miss → Query fresh data from DB                        │
│    - Rebuild cache                                                │
└─────────────────────────────────────────────────────────────────────┘
```

### Event Mapping (Event → Cache Invalidation)

| Business Event | Invalidate Cache Keys |
|----------------|----------------------|
| **BookingCreated** | `exec:summary:*`, `sales:pipeline:*`, `customer:segments:*` |
| **InvoiceCreated** | `exec:summary:*`, `finance:pnl:*`, `finance:cash:*` |
| **ExpenseApproved** | `finance:pnl:*`, `finance:expenses:*` |
| **SalaryCalculated** | `hr:payroll:*`, `finance:pnl:*` |
| **AttendanceSubmitted** | `hr:attendance:*`, `hr:workforce:*` |
| **CampaignCreated** | `marketing:campaigns:*` |
| **CustomerUpdated** | `customer:segments:*`, `customer:ltv:*` |

### Code Example

```typescript
// Event Listener
async function pollBusinessEvents() {
  while (true) {
    const events = await db.query(`
      SELECT * FROM business_events
      WHERE processed_at IS NULL
      ORDER BY created_at ASC
      LIMIT 100
    `);
    
    for (const event of events) {
      await handleEvent(event);
      await markEventAsProcessed(event.id);
    }
    
    await sleep(1000); // Poll every 1 second
  }
}

// Event Handler
async function handleEvent(event: BusinessEvent) {
  switch (event.type) {
    case 'BookingCreated':
      await invalidateBookingRelatedCaches(event);
      break;
    case 'InvoiceCreated':
      await invalidateFinanceCaches(event);
      break;
    case 'ExpenseApproved':
      await invalidateExpenseCaches(event);
      break;
    // ... more handlers
  }
}

// Cache Invalidator
async function invalidateBookingRelatedCaches(event: BusinessEvent) {
  const { tenantId } = event.payload;
  
  // Invalidate Executive caches
  await cacheService.deletePattern(`exec:summary:${tenantId}:*`);
  
  // Invalidate Sales caches
  await cacheService.deletePattern(`sales:pipeline:${tenantId}:*`);
  
  // Invalidate Customer caches
  await cacheService.deletePattern(`customer:segments:${tenantId}:*`);
}
```

---

## Flow 4: External Connector Sync Flow (Đồng Bộ Dữ Liệu Quảng Cáo Bên Ngoài)

### Scenario: Đồng bộ dữ liệu Facebook Ads

```
┌─────────────────────────────────────────────────────────────────────┐
│ 1. Scheduled Job (Cron)                                            │
│    - Chạy hàng ngày lúc 3:00 AM                                    │
│    - Trigger: syncExternalAds()                                    │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ 2. Marketing Intelligence                                          │
│    - Nhận request: syncExternalAds({ platform: 'facebook', ... }) │
│    - Delegate to Connector Factory                                │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ 3. Facebook Ads Connector                                         │
│    - Get access token from config                                 │
│    - Call Facebook Ads API                                        │
│    - Fetch campaigns, ad sets, ads, metrics                       │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ 4. Facebook Ads API                                               │
│    - Return raw data (JSON)                                       │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ 5. Data Transformer                                               │
│    - Transform Facebook schema → Unified schema                   │
│    - Map fields: campaign_id, impressions, clicks, spend, etc.   │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ 6. Database (external_ads_data table)                            │
│    - Upsert transformed data                                      │
│    - De-duplicate by (platform, external_campaign_id, date)      │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ 7. Campaign Matching                                              │
│    - Match external_campaign_id with internal campaign_id        │
│    - Update `campaigns` table with external metrics              │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ 8. Cache Invalidation                                             │
│    - Emit event: ExternalAdsSynced                                │
│    - Invalidate marketing caches                                  │
└─────────────────────────────────────────────────────────────────────┘
```

### Unified Schema (external_ads_data table)

```sql
CREATE TABLE external_ads_data (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL,
  platform VARCHAR(50) NOT NULL, -- 'facebook', 'google', 'tiktok', 'zalo'
  external_campaign_id VARCHAR(255) NOT NULL,
  internal_campaign_id UUID, -- Link to campaigns table
  date DATE NOT NULL,
  impressions BIGINT,
  clicks BIGINT,
  spend NUMERIC(12, 2),
  conversions INTEGER,
  revenue NUMERIC(12, 2),
  raw_data JSONB, -- Store full response for future use
  synced_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (platform, external_campaign_id, date)
);
```

### Code Example

```typescript
// Facebook Ads Connector
export class FacebookAdsConnector implements ExternalAdsConnector {
  async sync(params: SyncParams): Promise<SyncResult> {
    // 1. Get access token
    const token = await this.getAccessToken(params.tenantId);
    
    // 2. Call Facebook Ads API
    const campaigns = await this.fetchCampaigns(token, params.dateRange);
    
    // 3. Transform to unified schema
    const transformedData = campaigns.map(campaign => ({
      platform: 'facebook',
      external_campaign_id: campaign.id,
      date: campaign.date,
      impressions: campaign.impressions,
      clicks: campaign.clicks,
      spend: campaign.spend,
      conversions: campaign.conversions,
      revenue: campaign.revenue,
      raw_data: campaign // Store full response
    }));
    
    // 4. Upsert to database
    await db.upsertExternalAdsData(transformedData);
    
    // 5. Match with internal campaigns
    await this.matchInternalCampaigns(params.tenantId);
    
    // 6. Emit event
    await eventBus.emit('ExternalAdsSynced', {
      tenantId: params.tenantId,
      platform: 'facebook',
      recordCount: transformedData.length
    });
    
    return { success: true, recordCount: transformedData.length };
  }
}
```

---

## Flow 5: Multi-Tier Caching Strategy (Chiến Lược Cache Đa Tầng)

### Cache Tiers

```
┌─────────────────────────────────────────────────────────────────────┐
│ Tier 1: Memory Cache (Node.js Map)                                 │
│ - TTL: 60 seconds                                                   │
│ - Size: 100 MB                                                      │
│ - Hit Rate: 70%                                                     │
│ - Use Case: Hot data (frequently accessed)                         │
└─────────────────────────────────────────────────────────────────────┘
                              ↓ (Cache Miss)
┌─────────────────────────────────────────────────────────────────────┐
│ Tier 2: Redis Cache                                                │
│ - TTL: 5-60 minutes (depends on data type)                         │
│ - Size: 1 GB                                                        │
│ - Hit Rate: 20%                                                     │
│ - Use Case: Warm data (moderately accessed)                        │
└─────────────────────────────────────────────────────────────────────┘
                              ↓ (Cache Miss)
┌─────────────────────────────────────────────────────────────────────┐
│ Tier 3: Database (Materialized Views)                              │
│ - Refresh: Every 1-24 hours (depends on data type)                 │
│ - Hit Rate: 10%                                                     │
│ - Use Case: Cold data (rarely accessed, but pre-aggregated)        │
└─────────────────────────────────────────────────────────────────────┘
```

### Cache Strategy by Data Type

| Data Type | Memory TTL | Redis TTL | Materialized View Refresh | Invalidation Strategy |
|-----------|-----------|-----------|--------------------------|----------------------|
| **Executive Summary** | 60s | 5 min | 5 min | Event-driven (all major events) |
| **Finance P&L** | 60s | 1 hour | 1 hour | Event-driven (InvoiceCreated, ExpenseApproved) |
| **Marketing Campaigns** | 60s | 1 hour | 24 hours | Event-driven (CampaignCreated, ExternalAdsSynced) |
| **Sales Pipeline** | 60s | 15 min | 15 min | Event-driven (BookingCreated) |
| **HR Payroll** | 60s | 30 min | 1 hour | Event-driven (SalaryCalculated) |
| **Customer Segments** | 60s | 24 hours | 24 hours | Event-driven (CustomerUpdated, BookingCreated) |
| **Forecast** | 60s | 12 hours | 24 hours | Scheduled (nightly) |
| **Recommendations** | 60s | 1 hour | N/A | Event-driven (BookingCreated, CustomerUpdated) |

---

## Performance Considerations (Cân Nhắc Hiệu Suất)

### Query Performance
- Tất cả queries từ Intelligence Layer đều query Views/Materialized Views, KHÔNG query raw tables
- Materialized Views được index tốt
- Stored Procedures được optimize cho aggregation

### Cache Hit Rate Target
- Memory Cache: 70% hit rate
- Redis Cache: 20% hit rate
- Database: 10% (cache miss on both tiers)

### Response Time Target
- Memory Cache hit: < 1ms
- Redis Cache hit: < 10ms
- Database query: < 100ms

---

## Xem Thêm (See Also)

- [Intelligence Layer Architecture](./INTELLIGENCE_LAYER_ARCHITECTURE.md) - Tổng quan kiến trúc
- [Intelligence Layer Domains](./INTELLIGENCE_LAYER_DOMAINS.md) - Chi tiết từng domain
- [Intelligence Layer Performance](./INTELLIGENCE_LAYER_PERFORMANCE.md) - Caching & optimization
- [Intelligence Layer API Reference](./INTELLIGENCE_LAYER_API_REFERENCE.md) - API contracts

---

## Version History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-06-22 | Chief Solution Architect | Initial data flow design |
