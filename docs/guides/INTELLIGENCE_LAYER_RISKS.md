# Intelligence Layer Risks - Đánh Giá Rủi Ro

## Tổng Quan (Overview)

Tài liệu này phân tích các rủi ro tiềm ẩn khi triển khai Intelligence Layer và đưa ra chiến lược giảm thiểu.

---

## Risk Assessment Matrix (Ma Trận Đánh Giá Rủi Ro)

| Risk ID | Risk | Impact | Probability | Score | Priority |
|---------|------|--------|-------------|-------|----------|
| R1 | Performance Degradation | High | Medium | 15 | Critical |
| R2 | Data Accuracy Issues | High | Low | 10 | High |
| R3 | External API Rate Limits | Medium | Medium | 9 | High |
| R4 | Cache Consistency Issues | High | Low | 10 | High |
| R5 | Scope Creep | High | High | 20 | Critical |
| R6 | Team Knowledge Gap | Medium | Medium | 9 | High |
| R7 | Migration Complexity | High | Medium | 15 | Critical |
| R8 | External API Changes | Medium | Medium | 9 | High |
| R9 | Database Overload | High | Low | 10 | High |
| R10 | Timeline Slippage | Medium | High | 15 | Critical |

**Score = Impact × Probability** (1-5 scale each, max 25)

---

## R1: Performance Degradation (Hiệu Suất Giảm)

### Mô Tả
Intelligence Layer có thể không đạt được performance targets (response time < 100ms, throughput > 1000 RPS).

### Impact: **High**
- User experience bị ảnh hưởng
- Dashboard load chậm
- AI Agents response time tăng
- Có thể phải rollback

### Probability: **Medium**
- Aggregation queries có thể chậm
- Cache miss rate có thể cao hơn dự kiến
- Redis/Database có thể không scale tốt

### Mitigation Strategies

#### 1. Aggressive Caching
```
Memory Cache (60s) → Redis Cache (5-60 min) → Materialized Views
```
- Target cache hit rate: > 90%
- Pre-warm cache cho hot data
- Implement cache-aside pattern

#### 2. Query Optimization
- Sử dụng Materialized Views cho tất cả aggregations
- Index tất cả filter columns
- EXPLAIN ANALYZE tất cả queries
- Target query time: < 50ms (P95)

#### 3. Early Load Testing
- Load test từ Phase 1 (không đợi đến Phase 8)
- Test với production-like data volume
- Test scenarios: normal load (100 RPS), peak load (500 RPS), spike load (1000 RPS)

#### 4. Monitoring & Alerting
- Setup Prometheus + Grafana từ Phase 1
- Monitor cache hit rate, query time, API response time
- Alert nếu response time > 100ms (P95)

#### 5. Fallback Strategy
- Nếu cache miss → query DB
- Nếu DB slow → return stale cache data (với warning)
- Nếu all fail → return error với retry-after header

### Success Criteria
- [ ] Cache hit rate > 90%
- [ ] Response time < 100ms (P95)
- [ ] Load testing passed (1000 RPS)

---

## R2: Data Accuracy Issues (Vấn Đề Độ Chính Xác Dữ Liệu)

### Mô Tả
Intelligence Layer tính toán sai KPI, không match với current system.

### Impact: **High**
- Mất lòng tin của users
- AI Agents đưa ra insights sai
- Quyết định kinh doanh dựa trên dữ liệu sai
- Có thể phải rollback

### Probability: **Low**
- Có comprehensive testing strategy
- Có reconciliation tests với current system
- Database Views/Stored Procedures đã được verify

### Mitigation Strategies

#### 1. Reconciliation Tests
```typescript
// Mandatory: Compare Intelligence Layer results vs Current System
test('Executive Summary should match current calculation', async () => {
  const intelligenceResult = await ExecutiveIntelligence.getExecutiveSummary({ ... });
  const currentResult = await getCurrentExecutiveSummary({ ... });
  
  expect(intelligenceResult).toEqual(currentResult); // 100% match
});
```
- Run reconciliation tests trước khi go-live
- Test với production data (read-only)
- All metrics must match 100%

#### 2. Reuse Existing Database Logic
- Intelligence Layer KHÔNG tính toán lại KPI
- Chỉ query Materialized Views/Stored Procedures đã tồn tại
- Database remains Single Source of Truth

#### 3. Phased Rollout
- Phase 1: Executive Intelligence (MVP) → verify accuracy
- Phase 2: Finance Intelligence → verify accuracy
- Không tiếp tục nếu accuracy < 100%

#### 4. Shadow Mode
- Chạy Intelligence Layer song song với Current System trong 1-2 tuần
- So sánh results mỗi ngày
- Chỉ switch hoàn toàn khi accuracy = 100%

### Success Criteria
- [ ] 100% accuracy với current system (reconciliation tests passed)
- [ ] Shadow mode completed (1-2 tuần)
- [ ] Production verification (1 tuần)

---

## R3: External API Rate Limits (Giới Hạn API Bên Ngoài)

### Mô Tả
Facebook/Google/TikTok/Zalo APIs có rate limits. Có thể bị block nếu vượt quá.

### Impact: **Medium**
- External ads data không sync được
- Marketing Intelligence thiếu dữ liệu
- CMO Agent không có đủ insights

### Probability: **Medium**
- Rate limits khác nhau tùy platform
- Có thể vượt quá nếu sync too frequently

### Mitigation Strategies

#### 1. Implement Rate Limiting
```typescript
class RateLimiter {
  constructor(
    private maxRequests: number, // E.g., 200 requests
    private windowMs: number      // E.g., per hour (3600000ms)
  ) {}
  
  async waitIfNeeded() {
    // Wait if reached rate limit
  }
}

// Facebook Ads: 200 requests/hour
const facebookRateLimiter = new RateLimiter(200, 3600000);
```

#### 2. Exponential Backoff Retry
```typescript
async function callExternalAPI(url: string, retries = 3) {
  try {
    return await fetch(url);
  } catch (error) {
    if (error.code === 17 && retries > 0) { // Rate limit error
      const delay = Math.pow(2, 3 - retries) * 1000; // 1s, 2s, 4s
      await sleep(delay);
      return callExternalAPI(url, retries - 1);
    }
    throw error;
  }
}
```

#### 3. Aggressive Caching
- Cache external ads data for 24 hours
- Không cần sync realtime (daily sync is enough)

#### 4. Batch Requests
- Fetch multiple campaigns in one API call
- Use batch endpoints nếu có

#### 5. Fallback to Previous Data
- Nếu sync fail → use cached data from previous day
- Show "Data as of [date]" warning

### Success Criteria
- [ ] Rate limiter implemented
- [ ] Retry logic với exponential backoff
- [ ] Sync success rate > 99%

---

## R4: Cache Consistency Issues (Vấn Đề Tính Nhất Quán Cache)

### Mô Tả
Cache không được invalidate kịp thời → users thấy stale data.

### Impact: **High**
- Users thấy dữ liệu cũ
- KPI không realtime
- Mất lòng tin

### Probability: **Low**
- Có event-driven cache invalidation
- Có comprehensive testing

### Mitigation Strategies

#### 1. Event-Driven Cache Invalidation
```typescript
// Business Event → Cache Invalidation
const eventToCachePatterns: Record<string, string[]> = {
  BookingCreated: [
    'exec:summary:*',
    'sales:pipeline:*',
    'customer:segments:*'
  ],
  InvoiceCreated: [
    'exec:summary:*',
    'finance:pnl:*',
    'finance:cash:*'
  ],
  // ... more mappings
};
```

#### 2. Fast Invalidation (< 1 second)
- Event listener polls every 1 second
- Invalidation time target: < 1 second

#### 3. TTL as Safety Net
- Ngay cả khi event-driven invalidation fail
- Cache sẽ expire sau TTL (60s - 60min)
- Users sẽ thấy fresh data sau TTL

#### 4. Manual Invalidation API
- Provide admin API để invalidate cache manually:
```typescript
POST /api/admin/cache/invalidate
{
  "pattern": "exec:summary:tenant-123:*"
}
```

#### 5. Cache Consistency Tests
```typescript
test('cache should be invalidated within 1 second of event', async () => {
  // ... test logic
  expect(invalidationTime - eventTime).toBeLessThan(1000);
});
```

### Success Criteria
- [ ] Event-driven invalidation working
- [ ] Invalidation time < 1 second
- [ ] Cache consistency tests passing

---

## R5: Scope Creep (Mở Rộng Phạm Vi)

### Mô Tả
Stakeholders yêu cầu thêm features ngoài scope ban đầu → timeline bị kéo dài.

### Impact: **High**
- Timeline slippage
- Budget overrun
- Team burnout

### Probability: **High**
- Thường xuyên xảy ra trong dự án lớn
- Stakeholders thấy demo → muốn thêm features

### Mitigation Strategies

#### 1. Strict MVP Scope
- Mỗi phase có scope rõ ràng
- Không thêm features ngoài scope
- "Nice to have" features → Phase 9 (future iterations)

#### 2. Change Control Process
```
Feature Request
  ↓
Impact Analysis (time, resources, risks)
  ↓
Stakeholder Review
  ↓
Approve/Reject/Defer
  ↓
Update Roadmap (if approved)
```

#### 3. Regular Stakeholder Alignment
- Weekly demo sessions
- Show progress
- Manage expectations
- Say "NO" to out-of-scope requests

#### 4. Buffer Time
- Phase 8: 8 tuần (includes 2 tuần buffer)
- Có thể absorb small scope changes

### Success Criteria
- [ ] All phases completed on time
- [ ] Zero out-of-scope features added
- [ ] Stakeholder satisfaction > 90%

---

## R6: Team Knowledge Gap (Thiếu Kiến Thức)

### Mô Tả
Team chưa quen với Intelligence Layer concepts (caching, events, ML models).

### Impact: **Medium**
- Development chậm
- Code quality thấp
- Bugs nhiều

### Probability: **Medium**
- Team có experience với Backend/Database
- Nhưng chưa có experience với ML/Forecasting

### Mitigation Strategies

#### 1. Training Sessions
- Week 1: Intelligence Layer concepts
- Week 2: Caching strategies
- Week 3: Event-driven architecture
- Week 4: ML basics (for Phase 7)

#### 2. Pair Programming
- Junior devs pair với Senior devs
- Knowledge transfer

#### 3. Code Reviews
- All code must be reviewed
- Focus on best practices

#### 4. Documentation
- Architecture docs (completed)
- API reference (completed)
- Code comments
- Runbooks

#### 5. External Consultant (Phase 7)
- Hire ML consultant cho Forecast Intelligence
- 1-2 tháng contract

### Success Criteria
- [ ] Team trained
- [ ] Code review completion rate = 100%
- [ ] Documentation complete

---

## R7: Migration Complexity (Phức Tạp Di Chuyển)

### Mô Tả
Migrate AI Agents & Dashboard từ direct DB queries sang Intelligence Layer APIs rất phức tạp.

### Impact: **High**
- Migration time > expected
- Bugs trong migration
- Downtime

### Probability: **Medium**
- Có nhiều consumers (AI Agents, Dashboard, Reports)
- Mỗi consumer có nhiều queries

### Mitigation Strategies

#### 1. Phased Migration
- Phase 1: CEO Agent only
- Phase 2: CFO Agent
- Phase 3: CMO Agent
- Phase 4: Dashboard
- Không migrate tất cả cùng lúc

#### 2. Backward Compatibility
- Giữ lại old code trong 1-2 tuần
- Có thể rollback nhanh chóng

#### 3. Feature Flags
```typescript
if (featureFlags.useIntelligenceLayer) {
  // New code: Intelligence Layer
  return await ExecutiveIntelligence.getExecutiveSummary({ ... });
} else {
  // Old code: Direct DB queries
  return await getExecutiveSummaryLegacy({ ... });
}
```

#### 4. A/B Testing
- 10% traffic → Intelligence Layer
- 90% traffic → Current system
- Gradually increase Intelligence Layer traffic

#### 5. Rollback Plan
```
1. Disable feature flag
2. Users go back to current system
3. Zero downtime
```

### Success Criteria
- [ ] Zero downtime migration
- [ ] Rollback plan tested
- [ ] All consumers migrated successfully

---

## R8: External API Changes (API Bên Ngoài Thay Đổi)

### Mô Tả
Facebook/Google/TikTok/Zalo thay đổi API structure → connectors fail.

### Impact: **Medium**
- External ads data không sync được
- Marketing Intelligence thiếu dữ liệu

### Probability: **Medium**
- External APIs thường xuyên thay đổi
- Breaking changes ít nhưng có thể xảy ra

### Mitigation Strategies

#### 1. Versioned APIs
```typescript
class FacebookAdsConnector {
  constructor(private apiVersion = 'v18.0') {} // Pin API version
  
  async fetchCampaigns() {
    const url = `https://graph.facebook.com/${this.apiVersion}/campaigns`;
    // ...
  }
}
```

#### 2. Adapter Pattern
```typescript
interface ExternalAdsConnector {
  sync(params: SyncParams): Promise<SyncResult>;
  transform(rawData: any): UnifiedAdsData;
}

// Easy to swap implementation nếu API changes
class FacebookAdsConnectorV18 implements ExternalAdsConnector { }
class FacebookAdsConnectorV19 implements ExternalAdsConnector { }
```

#### 3. Store Raw Response
```sql
CREATE TABLE external_ads_data (
  ...
  raw_data JSONB, -- Store full response for future use
  ...
);
```
- Nếu API changes → có thể re-process raw data

#### 4. Monitoring & Alerting
- Monitor sync success rate
- Alert nếu sync fail > 3 times

#### 5. Graceful Degradation
- Nếu sync fail → use cached data
- Show "Data as of [date]" warning

### Success Criteria
- [ ] API version pinned
- [ ] Adapter pattern implemented
- [ ] Monitoring & alerting working

---

## R9: Database Overload (Database Quá Tải)

### Mô Tả
Intelligence Layer queries quá nhiều → Database overload.

### Impact: **High**
- Database slow down
- Affect all services (not just Intelligence Layer)
- Possible downtime

### Probability: **Low**
- Intelligence Layer sử dụng Materialized Views (pre-aggregated)
- Aggressive caching (90%+ hit rate)

### Mitigation Strategies

#### 1. Materialized Views
- All aggregations pre-computed
- Intelligence Layer chỉ query Materialized Views (fast)

#### 2. Read Replicas
- Intelligence Layer queries → Read Replica
- Không affect Primary Database

#### 3. Connection Pooling
```typescript
const pool = new Pool({
  max: 20, // Max 20 connections
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});
```

#### 4. Query Timeout
```typescript
const result = await db.query({
  text: 'SELECT * FROM mv_executive_summary WHERE ...',
  timeout: 5000 // 5 seconds timeout
});
```

#### 5. Monitoring
- Monitor database CPU, memory, connections
- Alert nếu CPU > 80%

### Success Criteria
- [ ] Read Replica setup
- [ ] Connection pooling configured
- [ ] Database CPU < 70% (P95)

---

## R10: Timeline Slippage (Trễ Timeline)

### Mô Tả
Dự án không hoàn thành đúng 40 tuần.

### Impact: **Medium**
- Opportunity cost
- Stakeholder dissatisfaction

### Probability: **High**
- 40 tuần là timeline aggressive
- Nhiều dependencies

### Mitigation Strategies

#### 1. Buffer Time
- Total: 40 tuần, includes 2-3 tuần buffer
- Phase 8: 8 tuần (includes 2 tuần buffer)

#### 2. Parallel Execution
- Phase 2-6 có thể chạy song song (sau Phase 0)
- Reduce total time từ ~50 tuần → 40 tuần

#### 3. MVP First
- Deliver MVP sớm (Phase 1-2: 10 tuần)
- Show value early
- Get feedback early

#### 4. Agile Approach
- 2-week sprints
- Weekly demos
- Adjust plan nếu cần

#### 5. Risk Management
- Identify blockers early
- Escalate early
- Don't wait until it's too late

### Success Criteria
- [ ] All phases completed within 40 tuần
- [ ] Zero critical blockers

---

## Risk Mitigation Summary (Tóm Tắt)

| Risk | Priority | Key Mitigation |
|------|----------|---------------|
| R1: Performance Degradation | Critical | Aggressive caching, Early load testing |
| R2: Data Accuracy Issues | High | Reconciliation tests, Shadow mode |
| R3: External API Rate Limits | High | Rate limiter, Exponential backoff |
| R4: Cache Consistency Issues | High | Event-driven invalidation, TTL safety net |
| R5: Scope Creep | Critical | Strict MVP scope, Change control |
| R6: Team Knowledge Gap | High | Training sessions, Pair programming |
| R7: Migration Complexity | Critical | Phased migration, Feature flags |
| R8: External API Changes | High | Versioned APIs, Adapter pattern |
| R9: Database Overload | High | Materialized Views, Read Replicas |
| R10: Timeline Slippage | Critical | Buffer time, Parallel execution |

---

## Contingency Plans (Kế Hoạch Dự Phòng)

### Plan A: Normal Execution
- Follow roadmap exactly
- 40 tuần

### Plan B: Accelerated (nếu timeline bị pressure)
- Skip Phase 7 (Forecast & Recommendation) → Future iteration
- 34 tuần

### Plan C: Minimal Viable (nếu critical blocker)
- Only Phase 0-1-2 (Foundation + Executive + Finance)
- 12 tuần
- Enough to deliver value cho CEO & CFO

### Plan D: Rollback
- Nếu go-live fail critically
- Rollback to current system
- Zero downtime
- Retry after fixing issues

---

## Monitoring & Alerting (Giám Sát & Cảnh Báo)

### Critical Alerts (Pagerduty)
- Response time > 200ms (P95) for 5 minutes
- Cache hit rate < 70% for 5 minutes
- External API sync fail > 3 times
- Database CPU > 90% for 2 minutes

### Warning Alerts (Slack)
- Response time > 100ms (P95) for 5 minutes
- Cache hit rate < 85% for 10 minutes
- Query time > 50ms (P95) for 5 minutes
- Materialized view refresh fail

---

## Xem Thêm (See Also)

- [Intelligence Layer Architecture](./INTELLIGENCE_LAYER_ARCHITECTURE.md) - Tổng quan kiến trúc
- [Intelligence Layer Roadmap](./INTELLIGENCE_LAYER_ROADMAP.md) - Lộ trình triển khai
- [Intelligence Layer Testing](./INTELLIGENCE_LAYER_TESTING.md) - Testing strategy

---

## Version History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-06-22 | Chief Solution Architect | Initial risk assessment |
