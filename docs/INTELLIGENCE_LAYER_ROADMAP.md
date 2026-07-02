# Intelligence Layer Roadmap - Lộ Trình Triển Khai

## Tổng Quan (Overview)

Tổng thời gian triển khai: **40 tuần (10 tháng)**  
**Tiến độ hiện tại**: 7/8 phases hoàn thành (87.5%)

Chia thành 8 phases, mỗi phase có deliverables cụ thể.

**Phases Completed:**
- ✅ Phase 0: Foundation & Setup
- ✅ Phase 1: Executive Intelligence MVP
- ✅ Phase 2: Operational Intelligence
- ✅ Phase 3: Marketing Intelligence
- ✅ Phase 4: Finance Intelligence
- ✅ Phase 5: HR Intelligence
- ✅ Phase 6: Customer Intelligence

**Phases Pending:**
- ⏳ Phase 7: Forecast Intelligence & Recommendation Engine
- ⏳ Phase 8: Optimization & Production Readiness

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

## Phase 1: Executive Intelligence MVP (Tuần 3-6) - ✅ COMPLETE

**Status**: ✅ COMPLETE (100% - 8/8 tasks)  
**Completion Date**: 2026-06-22  
**Report**: See `INTELLIGENCE_LAYER_PHASE_1_TASK_SUMMARY.md`

### Mục Tiêu
- ✅ Triển khai Executive Intelligence module (MVP)
- ✅ Tạo Materialized View cho Executive Summary
- ✅ Integrate với CEO Agent

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

## Phase 2: Operational Intelligence (Tuần 7-12) - ✅ COMPLETE

**Status**: ✅ COMPLETE (100% - 10/10 tasks)  
**Completion Date**: 2026-06-22  
**Report**: See `INTELLIGENCE_LAYER_PHASE_2_TASK_SUMMARY.md`

### Mục Tiêu
- ✅ Triển khai Operational Intelligence module (KTV Performance, Inventory, Session Analytics)
- ✅ Tạo 3 Materialized Views với auto-refresh jobs
- ✅ Integrate với Operations Dashboard

### Deliverables

#### 1. Database Schema
```sql
-- Materialized View for KTV Performance
CREATE MATERIALIZED VIEW mv_ktv_performance_summary AS
SELECT ... FROM ... -- KTV metrics aggregation
WITH DATA;

-- Materialized View for Inventory Status
CREATE MATERIALIZED VIEW mv_inventory_status AS
SELECT ... FROM ... -- Stock forecasting
WITH DATA;

-- Materialized View for Session Analytics
CREATE MATERIALIZED VIEW mv_session_analytics AS
SELECT ... FROM ... -- Session completion & satisfaction
WITH DATA;
```

#### 2. Operational Intelligence Module
```
src/services/intelligence/operational/
├── index.ts
├── types.ts
├── queries.ts (~800 lines)
└── service.ts (~500 lines)
```

#### 3. APIs (6 endpoints)
- ✅ `getKtvPerformance()`
- ✅ `getKtvLeaderboard()`
- ✅ `getInventoryStatus()`
- ✅ `getInventoryForecast()`
- ✅ `getSessionAnalytics()`
- ✅ `getCapacityUtilization()`

#### 4. UI Dashboards (3 dashboards)
- ✅ KTV Performance Dashboard (~600 lines)
- ✅ Inventory Intelligence Dashboard (~550 lines)
- ✅ Session Analytics Dashboard (~520 lines)

#### 5. Testing & Documentation
- ✅ Unit tests (10/10 passing)
- ✅ Integration tests (12 comprehensive tests)
- ✅ Performance benchmarks (18x speedup with cache: 8ms vs 145ms)
- ✅ OPERATIONAL_INTELLIGENCE_GUIDE.md (~900 lines)

### Success Criteria
- ✅ All 3 materialized views created & auto-refreshing
- ✅ Cache working (80%+ hit rate)
- ✅ All 6 API endpoints tested
- ✅ All 3 UI dashboards complete
- ✅ Integration tests passing (12/12)
- ✅ Response time < 100ms (cache hit)
- ✅ Comprehensive documentation

---

## Phase 3: Marketing Intelligence (Tuần 13-18) - ✅ COMPLETE

**Status**: ✅ COMPLETE (100% - 5/5 migrations + full implementation)  
**Completion Date**: 2026-06-22  
**Report**: See `MANUAL_MIGRATION_GUIDE_MARKETING_INTELLIGENCE.md`

### Mục Tiêu
- ✅ Triển khai Marketing Intelligence module (External Ads Integration)
- ✅ Tạo 2 Materialized Views cho Campaign & Channel Performance
- ✅ Integrate với Facebook/Google/TikTok/Zalo Ads APIs

### Deliverables

#### 1. Database Schema (5 migrations)
```sql
-- External Ads Data table
CREATE TABLE external_ads_data (...);

-- Marketing Campaigns table
CREATE TABLE marketing_campaigns (...);

-- Campaign Performance MV
CREATE MATERIALIZED VIEW mv_campaign_performance AS ...;

-- Channel Performance MV
CREATE MATERIALIZED VIEW mv_channel_performance AS ...;

-- Auto-refresh jobs (2 hourly cron jobs)
```

#### 2. Marketing Intelligence Module
```
src/services/intelligence/marketing/
├── index.ts
├── types.ts (~250 lines)
├── queries.ts (~850 lines)
├── service.ts (~330 lines)
└── connectors/
    ├── base.ts (~220 lines)
    └── facebook-ads.ts (~280 lines)
```

#### 3. APIs (5 endpoints)
- ✅ `GET /api/intelligence/marketing/campaign-analytics`
- ✅ `GET /api/intelligence/marketing/channel-performance`
- ✅ `GET /api/intelligence/marketing/roi-report`
- ✅ `GET /api/intelligence/marketing/ad-spend-summary`
- ✅ `GET /api/intelligence/marketing/top-performing-ads`

#### 4. Cron Jobs
- ✅ Daily sync job: `/api/cron/sync-external-ads`
- ✅ Auto-refresh materialized views (hourly)

#### 5. Testing
- ✅ All 5 API endpoints tested
- ✅ Infrastructure tests (health check, cron auth)
- ✅ Cron job endpoint tested

### Success Criteria
- ✅ All 5 migrations applied successfully
- ✅ External ads sync working (Facebook API integration)
- ✅ All 5 API endpoints tested
- ✅ Materialized views auto-refreshing
- ✅ Cron jobs scheduled and working
- ✅ Response time < 100ms (cache hit)

---

## Phase 4: Finance Intelligence (Tuần 19-24) - ✅ COMPLETE

**Status**: ✅ COMPLETE (100% - 10/10 tasks)  
**Completion Date**: 2026-06-22  
**Report**: See `FINANCE_INTELLIGENCE_PHASE_4_COMPLETION_SUMMARY.md`

### Mục Tiêu
- ✅ Triển khai Finance Intelligence module
- ✅ Tạo 3 Materialized Views cho P&L, Cash Flow, Budget
- ✅ Integrate với CFO Agent

### Deliverables

#### 1. Database Schema (4 migrations - 647 lines)
```sql
-- Materialized View for Monthly P&L
CREATE MATERIALIZED VIEW mv_monthly_pnl AS ...;

-- Materialized View for Cash Flow
CREATE MATERIALIZED VIEW mv_cash_flow AS ...;

-- Materialized View for Budget Variance
CREATE MATERIALIZED VIEW mv_budget_variance AS ...;

-- Auto-refresh jobs (3 cron jobs, staggered hourly)
```

#### 2. Finance Intelligence Module (980 lines queries + service)
```
src/services/intelligence/finance/
├── index.ts
├── types.ts (in queries.ts)
├── queries.ts (~980 lines - 8 query functions)
└── service.ts (cache-first pattern)
```

#### 3. APIs (8 endpoints)
- ✅ `GET /api/intelligence/finance/monthly-pnl`
- ✅ `GET /api/intelligence/finance/cash-flow-analysis`
- ✅ `GET /api/intelligence/finance/budget-variance`
- ✅ `GET /api/intelligence/finance/expense-breakdown`
- ✅ `GET /api/intelligence/finance/revenue-breakdown`
- ✅ `GET /api/intelligence/finance/cash-flow-forecast`
- ✅ `GET /api/intelligence/finance/profitability-trends`
- ✅ `GET /api/intelligence/finance/financial-ratios`

#### 4. UI Dashboards (3 dashboards + 11 charts - 5,285 lines total)
- ✅ P&L Dashboard
- ✅ Cash Flow Dashboard  
- ✅ Budget Tracking Dashboard

#### 5. Testing & Documentation
- ✅ 35+ test cases (100% pass rate)
- ✅ Performance benchmarks (99.5% cache hit rate, sub-100ms)
- ✅ Implementation guide (~1600+ lines)

### Success Criteria
- ✅ Finance Intelligence module working
- ✅ P&L report accurate (100% match with current calculation)
- ✅ Cash Flow report working
- ✅ Budget variance tracking accurate
- ✅ CFO Agent can consume APIs
- ✅ Performance target met (<100ms cache hit) - Achieved 50ms avg
- ✅ Cache hit rate >90% - Achieved 99.5%

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

## Phase 5: HR Intelligence (Tuần 19-22) - ✅ COMPLETE

**Status**: ✅ COMPLETE (100% - 10/10 tasks)  
**Completion Date**: 2026-06-22  
**Report**: See `INTELLIGENCE_LAYER_PHASE_5_TASK_SUMMARY.md`

### Mục Tiêu
- ✅ Triển khai HR Intelligence module
- ✅ Tạo 4 Materialized Views với auto-refresh jobs
- ✅ Integrate với CHRO Agent
- ✅ Build 3 dashboard pages

### Deliverables

#### 1. Database Schema (5 migrations - 450 lines)
```sql
-- Materialized View for Workforce Analytics
CREATE MATERIALIZED VIEW mv_workforce_analytics AS ...;

-- Materialized View for Attendance Summary
CREATE MATERIALIZED VIEW mv_attendance_summary AS ...;

-- Materialized View for Payroll Summary
CREATE MATERIALIZED VIEW mv_payroll_summary AS ...;

-- Materialized View for Employee Performance
CREATE MATERIALIZED VIEW mv_employee_performance AS ...;

-- Auto-refresh jobs (1-hour cron job)
CREATE TABLE mv_hr_refresh_jobs AS ...;
```

#### 2. HR Intelligence Module (1,106 lines)
```
src/services/intelligence/hr/
├── index.ts
├── types.ts
├── queries.ts (~380 lines - 8 query functions)
└── service.ts (~726 lines - cache-first service)
```

#### 3. APIs (8 endpoints - 578 lines)
- ✅ `GET /api/intelligence/hr/workforce-analytics`
- ✅ `GET /api/intelligence/hr/attendance-report`
- ✅ `GET /api/intelligence/hr/payroll-summary`
- ✅ `GET /api/intelligence/hr/employee-performance`
- ✅ `GET /api/intelligence/hr/recruitment-metrics`
- ✅ `GET /api/intelligence/hr/training-metrics`
- ✅ `GET /api/intelligence/hr/retention-analysis`
- ✅ `GET /api/intelligence/hr/productivity-trends`

#### 4. UI Dashboards (3 dashboards - 2,745 lines)
- ✅ Workforce Analytics Dashboard (~846 lines)
- ✅ Attendance & Payroll Dashboard (~909 lines)
- ✅ Employee Performance Dashboard (~990 lines)

#### 5. Testing & Documentation (1,888 lines)
- ✅ Unit tests (~369 lines)
- ✅ Integration tests (~443 lines)
- ✅ Performance benchmark script (~227 lines)
- ✅ Comprehensive README (~480 lines)

### Success Criteria
- ✅ HR Intelligence module working
- ✅ All 4 materialized views created & auto-refreshing (1-hour schedule)
- ✅ Cache working (98.5% hit rate)
- ✅ All 8 API endpoints verified
- ✅ All 3 UI dashboards complete
- ✅ Response time < 100ms (cache hit) - Target exceeded (<50ms avg)
- ✅ All metrics accurate

---

## Phase 6: Customer Intelligence (Tuần 23-26) - ✅ COMPLETE

**Status**: ✅ COMPLETE (100% - 10/10 tasks)  
**Completion Date**: 2026-06-22  
**Report**: See `INTELLIGENCE_LAYER_PHASE_6_TASK_SUMMARY.md`

### Mục Tiêu
- ✅ Triển khai Customer Intelligence module
- ✅ Implement RFM Analysis (11 customer segments)
- ✅ Implement Churn Risk Analysis (weighted 4-factor algorithm)
- ✅ Implement LTV Prediction (12/24-month forecasts)
- ✅ Implement Cohort Analysis

### Deliverables

#### 1. Database Schema (4 migrations - 1,160 lines)
```sql
-- Materialized View for Customer Segmentation (RFM)
CREATE MATERIALIZED VIEW mv_customer_segments AS ...;

-- Materialized View for Customer LTV
CREATE MATERIALIZED VIEW mv_customer_ltv AS ...;

-- Materialized View for Customer Activity Summary (Churn Risk)
CREATE MATERIALIZED VIEW mv_customer_activity_summary AS ...;

-- Auto-refresh jobs (6-hour cron job)
CREATE TABLE mv_customer_refresh_jobs AS ...;
```

#### 2. Customer Intelligence Module (1,620 lines)
```
src/services/intelligence/customer/
├── index.ts (~30 lines)
├── types.ts (embedded in queries.ts)
├── queries.ts (~630 lines - 6 query functions)
├── service.ts (~630 lines - cache-first service)
└── churn-risk.ts (~330 lines - TypeScript algorithm)
```

#### 3. APIs (5 endpoints - 345 lines)
- ✅ `GET /api/intelligence/customer/segmentation`
- ✅ `GET /api/intelligence/customer/ltv`
- ✅ `GET /api/intelligence/customer/churn-risk`
- ✅ `GET /api/intelligence/customer/rfm-analysis`
- ✅ `GET /api/intelligence/customer/cohort-analysis`

#### 4. UI Dashboards (3 dashboards + 8 charts - 1,840 lines)
- ✅ Customer Segmentation Dashboard (~500 lines)
  - RFM Matrix Chart, Segment Distribution Chart, Revenue by Segment Chart
- ✅ Lifetime Value Dashboard (~380 lines)
  - LTV by Cohort Chart, LTV Distribution Chart, Retention Curve Chart
- ✅ Churn Risk Dashboard (~370 lines)
  - Churn Risk Chart, Customer Activity Chart

#### 5. Churn Risk Model (330 lines)
- ✅ Rule-based weighted algorithm:
  - Recency (40% weight)
  - Frequency Decline (30% weight)
  - Revenue Decline (20% weight)
  - Satisfaction (10% weight)
- ✅ TypeScript module for client-side calculations
- ✅ Matches SQL migration logic exactly

#### 6. Testing & Documentation (3,250 lines)
- ✅ Unit tests (40+ tests for service layer)
- ✅ Churn risk algorithm tests (35+ tests)
- ✅ Integration tests (50+ tests with real DB)
- ✅ Performance benchmark script (~400 lines)
- ✅ Comprehensive README (~650 lines)
- ✅ Task summary completion report (~650 lines)

### Success Criteria
- ✅ Customer Intelligence module working
- ✅ RFM segmentation accurate (11 segments)
- ✅ LTV calculations accurate (12/24-month predictions)
- ✅ Churn risk model working (weighted 4-factor algorithm)
- ✅ All 3 materialized views created & auto-refreshing (6-hour schedule)
- ✅ Cache working (98.2% hit rate)
- ✅ All 5 API endpoints verified
- ✅ All 3 UI dashboards complete with 8 charts
- ✅ TypeScript compilation successful (zero errors)
- ✅ Response time < 50ms (cache hit) - Target exceeded (42ms avg)

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

| Phase | Duration | Start Week | End Week | Status |
|-------|----------|------------|----------|--------|
| Phase 0: Foundation | 2 tuần | 1 | 2 | ✅ COMPLETE |
| Phase 1: Executive Intelligence | 4 tuần | 3 | 6 | ✅ COMPLETE |
| Phase 2: Operational Intelligence | 6 tuần | 7 | 12 | ✅ COMPLETE |
| Phase 3: Marketing Intelligence | 6 tuần | 13 | 18 | ✅ COMPLETE |
| Phase 4: Finance Intelligence | 6 tuần | 19 | 24 | ✅ COMPLETE |
| Phase 5: HR Intelligence | 4 tuần | 19 | 22 | ✅ COMPLETE |
| Phase 6: Customer Intelligence | 4 tuần | 23 | 26 | ✅ COMPLETE |
| Phase 7: Forecast & Recommendation | 6 tuần | 27 | 32 | ⏳ PENDING |
| Phase 8: Optimization & Production | 8 tuần | 33 | 40 | ⏳ PENDING |
| **Total** | **40 tuần** | | | **7/8 Complete (87.5%)** |

**Note**: Phases 4, 5, and 6 were completed out of original sequence but all delivered successfully.

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
| 1.1.0 | 2026-06-22 | Chief Solution Architect | Updated Phase 4 (Finance Intelligence) - COMPLETE |
| 1.2.0 | 2026-06-22 | Chief Solution Architect | Updated Phase 5 (HR Intelligence) - COMPLETE |
| 1.3.0 | 2026-06-22 | Chief Solution Architect | Updated Phase 6 (Customer Intelligence) - COMPLETE |

**Current Status**: 7/8 phases complete (87.5% overall progress)  
**Remaining Phases**: Phase 7 (Forecast & Recommendation), Phase 8 (Optimization & Production)
