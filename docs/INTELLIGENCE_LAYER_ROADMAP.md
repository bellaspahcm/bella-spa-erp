# Intelligence Layer Roadmap - Lộ Trình Triển Khai

## Tổng Quan (Overview)

Tổng thời gian triển khai: **40 tuần (10 tháng)**

Chia thành 8 phases, mỗi phase có deliverables cụ thể.

---

## Phase 0: Foundation & Setup (Tuần 1-2) - ✅ COMPLETE

**Status**: ✅ COMPLETE (100% - 8/8 tasks)  
**Completion Date**: 2026-06-22  
**Report**: See `INTELLIGENCE_LAYER_PHASE_0_COMPLETION_REPORT.md`

### Mục Tiêu
- ✅ Setup project structure (11 directories)
- ✅ Thiết lập development environment
- ✅ Thiết lập testing infrastructure (91 passing tests)

### Deliverables

#### 1. Project Structure
```
src/services/intelligence/
├── shared/
│   ├── types.ts
│   ├── constants.ts
│   └── helpers.ts
├── cache/
│   ├── index.ts
│   ├── memory-cache.ts
│   └── redis-cache.ts
├── events/
│   ├── index.ts
│   └── event-listener.ts
└── index.ts
```

#### 2. Development Environment
- Setup TypeScript config
- Setup ESLint & Prettier
- Setup Jest for testing
- Setup Supabase connection

#### 3. Base Types & Interfaces
```typescript
// src/services/intelligence/shared/types.ts
export interface IntelligenceService {
  // Base interface for all intelligence modules
}

export interface CacheService {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, options?: CacheOptions): Promise<void>;
  delete(key: string): Promise<void>;
  deletePattern(pattern: string): Promise<void>;
}

export interface EventListener {
  on(event: string, handler: (payload: any) => Promise<void>): void;
  emit(event: string, payload: any): Promise<void>;
}
```

#### 4. Cache Infrastructure
- Implement Memory Cache (Node.js Map)
- Implement Redis Cache wrapper
- Implement multi-tier cache strategy

#### 5. Event Infrastructure
- Extend Accounting Outbox Pattern
- Implement Event Listener
- Implement Event Handlers skeleton

### Success Criteria
- [ ] Project structure created
- [ ] Cache service working (Memory + Redis)
- [ ] Event listener working
- [ ] Unit tests passing (80% coverage)

---

## Phase 1: Executive Intelligence MVP (Tuần 3-6) - 4 tuần

### Mục Tiêu
- Triển khai Executive Intelligence module (MVP)
- Tạo Materialized View cho Executive Summary
- Integrate với CEO Agent

### Deliverables

#### 1. Database Schema
```sql
-- Materialized View for Executive Summary
CREATE MATERIALIZED VIEW mv_executive_summary AS
SELECT
  tenant_id,
  period,
  period_start_date,
  period_end_date,
  total_revenue,
  revenue_growth_pct,
  gross_profit,
  operating_profit,
  net_profit,
  profit_margin_pct,
  total_customers,
  new_customers,
  retained_customers,
  churn_rate_pct,
  marketing_roi_pct,
  cac,
  ltv,
  cash_balance,
  burn_rate,
  runway_months
FROM ... -- Complex aggregation logic
WITH DATA;

-- Refresh every 5 minutes
CREATE UNIQUE INDEX ON mv_executive_summary (tenant_id, period);
```

#### 2. Executive Intelligence Module
```
src/services/intelligence/executive/
├── index.ts
├── types.ts
├── queries.ts
└── cache.ts
```

#### 3. APIs
- `getExecutiveSummary()`
- `getKPIDashboard()`
- `getPerformanceTrends()`

#### 4. CEO Agent Integration
- Update CEO Agent to consume Executive Intelligence
- Remove direct database queries from CEO Agent
- Test với real data

### Success Criteria
- [ ] Executive Intelligence module working
- [ ] Materialized view created & refreshing
- [ ] Cache working (95%+ hit rate)
- [ ] CEO Agent integrated successfully
- [ ] Integration tests passing
- [ ] Response time < 100ms (cache hit)

---

## Phase 2: Finance Intelligence (Tuần 7-10) - 4 tuần

### Mục Tiêu
- Triển khai Finance Intelligence module
- Tạo Materialized Views cho P&L, Cash Flow
- Integrate với CFO Agent

### Deliverables

#### 1. Database Schema
```sql
-- Materialized View for P&L
CREATE MATERIALIZED VIEW mv_monthly_pnl AS
SELECT ... FROM ... -- Complex P&L calculation
WITH DATA;

-- Materialized View for Cash Flow
CREATE MATERIALIZED VIEW mv_monthly_cash_flow AS
SELECT ... FROM ... -- Cash flow calculation
WITH DATA;
```

#### 2. Finance Intelligence Module
```
src/services/intelligence/finance/
├── index.ts
├── types.ts
├── queries.ts
└── cache.ts
```

#### 3. APIs
- `getProfitAndLoss()`
- `getCashFlowStatement()`
- `getFinancialRatios()`
- `getExpenseBreakdown()`

#### 4. CFO Agent Integration
- Update CFO Agent to consume Finance Intelligence
- Test với real financial data

### Success Criteria
- [ ] Finance Intelligence module working
- [ ] P&L report accurate (100% match với current calculation)
- [ ] Cash Flow report working
- [ ] CFO Agent integrated successfully
- [ ] Performance target met (< 100ms cache hit)

---

## Phase 3: Marketing Intelligence (Tuần 11-14) - 4 tuần

### Mục Tiêu
- Triển khai Marketing Intelligence module
- Implement External Ads Connectors (Facebook, Google, TikTok, Zalo)
- Integrate với CMO Agent

### Deliverables

#### 1. Database Schema
```sql
-- Table for external ads data
CREATE TABLE external_ads_data (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  platform VARCHAR(50) NOT NULL,
  external_campaign_id VARCHAR(255) NOT NULL,
  internal_campaign_id UUID,
  date DATE NOT NULL,
  impressions BIGINT,
  clicks BIGINT,
  spend NUMERIC(12, 2),
  conversions INTEGER,
  revenue NUMERIC(12, 2),
  raw_data JSONB,
  synced_at TIMESTAMP NOT NULL,
  UNIQUE (platform, external_campaign_id, date)
);
```

#### 2. Marketing Intelligence Module
```
src/services/intelligence/marketing/
├── index.ts
├── types.ts
├── queries.ts
├── cache.ts
└── connectors/
    ├── facebook-ads.ts
    ├── google-ads.ts
    ├── tiktok-ads.ts
    └── zalo-oa.ts
```

#### 3. External Connectors
- Facebook Ads Connector
- Google Ads Connector
- TikTok Ads Connector
- Zalo OA Connector

#### 4. APIs
- `getCampaignAnalytics()`
- `getROIReport()`
- `getChannelPerformance()`
- `syncExternalAds()`

#### 5. Scheduled Jobs
- Daily sync job (chạy lúc 3:00 AM)

#### 6. CMO Agent Integration
- Update CMO Agent to consume Marketing Intelligence

### Success Criteria
- [ ] Marketing Intelligence module working
- [ ] All 4 external connectors working
- [ ] External ads data syncing daily
- [ ] CMO Agent integrated successfully
- [ ] ROI calculations accurate

---

## Phase 4: Sales Intelligence (Tuần 15-18) - 4 tuần

### Mục Tiêu
- Triển khai Sales Intelligence module
- Integrate với Sales Agent

### Deliverables

#### 1. Database Schema
```sql
-- Views for Sales Pipeline
CREATE VIEW v_sales_pipeline AS ...;

-- Views for Conversion Funnel
CREATE VIEW v_conversion_funnel AS ...;
```

#### 2. Sales Intelligence Module
```
src/services/intelligence/sales/
├── index.ts
├── types.ts
├── queries.ts
└── cache.ts
```

#### 3. APIs
- `getSalesPipeline()`
- `getConversionFunnel()`
- `getRevenueForecast()` (basic, sử dụng sales pipeline)

#### 4. Sales Agent Integration

### Success Criteria
- [ ] Sales Intelligence module working
- [ ] Sales pipeline accurate
- [ ] Conversion funnel working
- [ ] Sales Agent integrated successfully

---

## Phase 5: HR Intelligence (Tuần 19-22) - 4 tuần

### Mục Tiêu
- Triển khai HR Intelligence module
- Integrate với CHRO Agent

### Deliverables

#### 1. Database Schema
```sql
-- Views for Workforce Analytics
CREATE VIEW v_workforce_analytics AS ...;

-- Views for Employee Performance
CREATE VIEW v_employee_performance AS ...;
```

#### 2. HR Intelligence Module
```
src/services/intelligence/hr/
├── index.ts
├── types.ts
├── queries.ts
└── cache.ts
```

#### 3. APIs
- `getWorkforceAnalytics()`
- `getAttendanceReport()`
- `getPayrollSummary()`
- `getEmployeePerformance()`

#### 4. CHRO Agent Integration

### Success Criteria
- [ ] HR Intelligence module working
- [ ] All metrics accurate
- [ ] CHRO Agent integrated successfully

---

## Phase 6: Customer Intelligence (Tuần 23-26) - 4 tuần

### Mục Tiêu
- Triển khai Customer Intelligence module
- Implement RFM Analysis
- Implement Churn Risk Analysis

### Deliverables

#### 1. Database Schema
```sql
-- Views for Customer Segmentation
CREATE VIEW v_customer_segments AS ...;

-- Views for Customer LTV
CREATE VIEW v_customer_ltv AS ...;
```

#### 2. Customer Intelligence Module
```
src/services/intelligence/customer/
├── index.ts
├── types.ts
├── queries.ts
├── cache.ts
└── segmentation.ts
```

#### 3. APIs
- `getCustomerSegmentation()`
- `getCustomerLTV()`
- `getChurnRiskAnalysis()`
- `getRFMAnalysis()`

#### 4. Churn Risk Model
- Simple rule-based model (MVP)
- Input: Days since last booking, Total bookings, Total revenue
- Output: Churn risk score (0-100)

### Success Criteria
- [ ] Customer Intelligence module working
- [ ] Segmentation accurate
- [ ] LTV calculations accurate
- [ ] Churn risk model working (70%+ accuracy)

---

## Phase 7: Forecast Intelligence & Recommendation Engine (Tuần 27-32) - 6 tuần

### Mục Tiêu
- Triển khai Forecast Intelligence module
- Triển khai Recommendation Engine
- Implement Machine Learning models

### Deliverables

#### 1. Forecast Intelligence Module
```
src/services/intelligence/forecast/
├── index.ts
├── types.ts
├── revenue-forecast.ts
├── churn-forecast.ts
└── demand-forecast.ts
```

#### 2. Forecast Models
- Revenue Forecast: Time series model (ARIMA hoặc Prophet)
- Churn Forecast: Logistic regression
- Demand Forecast: Time series model

#### 3. APIs
- `getRevenueForecast()`
- `getChurnForecast()`
- `getDemandForecast()`

#### 4. Recommendation Engine Module
```
src/services/intelligence/recommendation/
├── index.ts
├── types.ts
├── service-recommendation.ts
└── upsell-recommendation.ts
```

#### 5. Recommendation Algorithms
- Service Recommendations: Collaborative Filtering
- Upsell Opportunities: Association Rules (Market Basket Analysis)

#### 6. APIs
- `getServiceRecommendations()`
- `getUpsellOpportunities()`
- `getPackageRecommendations()`

### Success Criteria
- [ ] Forecast Intelligence module working
- [ ] Revenue forecast accuracy > 85%
- [ ] Churn forecast accuracy > 80%
- [ ] Recommendation Engine working
- [ ] Recommendation relevance > 70%

---

## Phase 8: Optimization & Production Readiness (Tuần 33-40) - 8 tuần

### Mục Tiêu
- Performance optimization
- Monitoring & Alerting
- Documentation
- Production deployment

### Deliverables

#### 1. Performance Optimization
- Query optimization
- Cache tuning
- Materialized view refresh strategy
- Index optimization

#### 2. Monitoring & Alerting
- Setup Prometheus metrics
- Setup Grafana dashboards
- Setup alerting rules
- Monitor cache hit rates
- Monitor query performance
- Monitor external API errors

#### 3. Dashboard Integration
- Update all dashboards to consume Intelligence APIs
- Remove SQL logic from dashboard components

#### 4. Documentation
- API documentation (complete)
- Architecture documentation (complete)
- Deployment guide
- Runbook for operations

#### 5. Testing
- Integration tests (100% coverage)
- Load testing
- Stress testing
- Failover testing

#### 6. Production Deployment
- Blue-green deployment strategy
- Rollback plan
- Production monitoring

### Success Criteria
- [ ] All performance targets met
- [ ] Monitoring & alerting working
- [ ] All dashboards migrated
- [ ] Documentation complete
- [ ] Load testing passed (1000 RPS)
- [ ] Production deployment successful
- [ ] Zero downtime migration

---

## Performance Targets (Mục Tiêu Hiệu Suất)

| Metric | Target |
|--------|--------|
| **Cache Hit Rate** | > 90% |
| **Response Time (Cache Hit)** | < 10ms |
| **Response Time (Cache Miss)** | < 100ms |
| **API Throughput** | > 1000 RPS |
| **Database Query Time** | < 50ms (P95) |
| **External API Sync Time** | < 5 minutes (Facebook/Google/TikTok/Zalo) |
| **Materialized View Refresh** | < 1 minute |

---

## Resource Requirements (Yêu Cầu Tài Nguyên)

### Team
- 1 Solution Architect (full-time)
- 2 Backend Developers (full-time)
- 1 Data Engineer (full-time, Phase 3-7)
- 1 ML Engineer (part-time, Phase 7)
- 1 QA Engineer (full-time, Phase 2-8)
- 1 DevOps Engineer (part-time, Phase 8)

### Infrastructure
- Redis instance (16 GB RAM)
- Additional database resources for Materialized Views
- Monitoring infrastructure (Prometheus + Grafana)

---

## Dependencies (Phụ Thuộc)

| Phase | Depends On |
|-------|-----------|
| Phase 0 | None |
| Phase 1 | Phase 0 |
| Phase 2 | Phase 0 |
| Phase 3 | Phase 0 |
| Phase 4 | Phase 0 |
| Phase 5 | Phase 0 |
| Phase 6 | Phase 0, Phase 4 (for segmentation) |
| Phase 7 | Phase 0, Phase 2, Phase 4, Phase 6 (for forecast & recommendation) |
| Phase 8 | All phases |

**Note**: Phase 2-6 có thể chạy song song sau khi Phase 0 hoàn thành.

---

## Risks & Mitigation (Rủi Ro & Giảm Thiểu)

### Risk 1: Performance Degradation (Hiệu Suất Giảm)
- **Impact**: High
- **Probability**: Medium
- **Mitigation**:
  - Load testing early (Phase 2)
  - Aggressive caching strategy
  - Materialized view optimization

### Risk 2: External API Rate Limits (Giới Hạn API Bên Ngoài)
- **Impact**: Medium
- **Probability**: Medium
- **Mitigation**:
  - Implement rate limiting
  - Implement retry logic with exponential backoff
  - Cache external API responses aggressively

### Risk 3: Data Accuracy Issues (Vấn Đề Độ Chính Xác Dữ Liệu)
- **Impact**: High
- **Probability**: Low
- **Mitigation**:
  - Comprehensive integration tests
  - Data validation at every layer
  - Reconciliation reports

### Risk 4: Scope Creep (Mở Rộng Phạm Vi)
- **Impact**: High
- **Probability**: High
- **Mitigation**:
  - Strict MVP scope for each phase
  - Change control process
  - Regular stakeholder alignment

---

## Success Metrics (Chỉ Số Thành Công)

### Phase Completion
- [ ] All phases completed on time
- [ ] All deliverables met

### Performance
- [ ] All performance targets met
- [ ] Cache hit rate > 90%
- [ ] Response time < 100ms (P95)

### Quality
- [ ] Unit test coverage > 80%
- [ ] Integration test coverage > 90%
- [ ] Zero critical bugs in production

### Adoption
- [ ] All AI Agents migrated to Intelligence Layer
- [ ] All Dashboards migrated to Intelligence Layer
- [ ] Zero direct database queries from consumers

---

## Phase Timeline Summary

| Phase | Duration | Start Week | End Week |
|-------|----------|------------|----------|
| Phase 0: Foundation | 2 tuần | 1 | 2 |
| Phase 1: Executive Intelligence | 4 tuần | 3 | 6 |
| Phase 2: Finance Intelligence | 4 tuần | 7 | 10 |
| Phase 3: Marketing Intelligence | 4 tuần | 11 | 14 |
| Phase 4: Sales Intelligence | 4 tuần | 15 | 18 |
| Phase 5: HR Intelligence | 4 tuần | 19 | 22 |
| Phase 6: Customer Intelligence | 4 tuần | 23 | 26 |
| Phase 7: Forecast & Recommendation | 6 tuần | 27 | 32 |
| Phase 8: Optimization & Production | 8 tuần | 33 | 40 |
| **Total** | **40 tuần** | | |

---

## Xem Thêm (See Also)

- [Intelligence Layer Architecture](./INTELLIGENCE_LAYER_ARCHITECTURE.md) - Tổng quan kiến trúc
- [Intelligence Layer Domains](./INTELLIGENCE_LAYER_DOMAINS.md) - Chi tiết từng domain
- [Intelligence Layer Risks](./INTELLIGENCE_LAYER_RISKS.md) - Risk assessment chi tiết

---

## Version History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-06-22 | Chief Solution Architect | Initial roadmap |
