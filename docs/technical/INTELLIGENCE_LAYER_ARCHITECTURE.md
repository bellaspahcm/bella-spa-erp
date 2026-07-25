# Intelligence Layer Architecture - Kiến Trúc Tầng Thông Minh

## Tổng Quan (Overview)

Intelligence Layer là tầng ngữ nghĩa (Semantic Layer) của Bella ERP, đóng vai trò trung gian giữa:
- **Dữ liệu**: Database Views, Materialized Views, Stored Procedures
- **Người tiêu dùng**: AI Agents, Dashboard, Reports, Export APIs

### Nguyên Tắc Thiết Kế (Design Principles)

1. **Database là Single Source of Truth**
   - Không tính toán lại KPI đã có trong Database
   - Chỉ đọc từ Views/Materialized Views/Stored Procedures
   - Không duplicate logic tính toán

2. **Extension, NOT Refactoring**
   - Không viết lại Business Services
   - Không tách thành Microservices
   - Chỉ mở rộng Modular Monolith hiện tại

3. **Read-Only Operations**
   - Không tạo business transactions (INSERT/UPDATE/DELETE)
   - Chỉ Read, Aggregate, Analyze, Forecast, Recommend

4. **Event-Driven Cache Invalidation**
   - Reuse Accounting Outbox Pattern
   - Expand thành Business Event infrastructure
   - Cache tự động refresh khi có events

---

## Vị Trí Trong Kiến Trúc Tổng Thể (Position in Overall Architecture)

```
Bella ERP (Modular Monolith)
│
├── Business Services
│   ├── Finance
│   ├── Accounting
│   ├── CRM
│   ├── Booking
│   ├── Inventory
│   ├── HR
│   ├── Payroll
│   ├── Marketing
│   ├── AI Orchestrator
│   ├── API Gateway
│   └── Intelligence ← NEW MODULE
│
├── Database Layer
│   ├── Tables
│   ├── Views
│   ├── Materialized Views
│   ├── Stored Procedures
│   └── Business Events (Outbox Pattern)
│
└── Consumers
    ├── AI Agents (CEO, CFO, CMO, CHRO...)
    ├── Dashboard
    ├── Reports
    └── Export APIs
```

---

## Cấu Trúc Thư Mục (Folder Structure)

```
src/services/intelligence/
│
├── executive/              # Executive Intelligence (CEO metrics)
│   ├── index.ts
│   ├── types.ts
│   ├── queries.ts
│   └── cache.ts
│
├── marketing/              # Marketing Intelligence
│   ├── index.ts
│   ├── types.ts
│   ├── queries.ts
│   ├── cache.ts
│   └── connectors/         # External connectors
│       ├── facebook-ads.ts
│       ├── google-ads.ts
│       ├── tiktok-ads.ts
│       └── zalo-oa.ts
│
├── finance/                # Finance Intelligence (CFO metrics)
│   ├── index.ts
│   ├── types.ts
│   ├── queries.ts
│   └── cache.ts
│
├── sales/                  # Sales Intelligence
│   ├── index.ts
│   ├── types.ts
│   ├── queries.ts
│   └── cache.ts
│
├── hr/                     # HR Intelligence (CHRO metrics)
│   ├── index.ts
│   ├── types.ts
│   ├── queries.ts
│   └── cache.ts
│
├── customer/               # Customer Intelligence
│   ├── index.ts
│   ├── types.ts
│   ├── queries.ts
│   ├── cache.ts
│   └── segmentation.ts
│
├── forecast/               # Forecast Intelligence (Predictive models)
│   ├── index.ts
│   ├── types.ts
│   ├── revenue-forecast.ts
│   ├── churn-forecast.ts
│   └── demand-forecast.ts
│
├── recommendation/         # Recommendation Engine
│   ├── index.ts
│   ├── types.ts
│   ├── service-recommendation.ts
│   └── upsell-recommendation.ts
│
├── cache/                  # Multi-tier caching
│   ├── index.ts
│   ├── memory-cache.ts     # In-memory (Node.js Map)
│   ├── redis-cache.ts      # Redis
│   └── db-cache.ts         # Materialized Views
│
├── events/                 # Event-driven cache invalidation
│   ├── index.ts
│   ├── event-listener.ts
│   ├── event-handlers.ts
│   └── cache-invalidator.ts
│
├── shared/                 # Shared utilities
│   ├── types.ts
│   ├── constants.ts
│   └── helpers.ts
│
└── index.ts                # Public API exports
```

---

## Phân Tách Domain (Domain Separation)

| Domain | Responsibilities | Data Sources | Consumers |
|--------|-----------------|--------------|-----------|
| **Executive** | CEO metrics, Overall performance | All domains | CEO Agent, Dashboard |
| **Marketing** | Campaign analytics, ROI, External ads data | Campaigns, Ads platforms | CMO Agent, Dashboard |
| **Finance** | P&L, Cash Flow, Ratios | Accounting, Revenue, Expenses | CFO Agent, Dashboard |
| **Sales** | Pipeline, Conversion, Revenue | Bookings, Invoices, Packages | Sales Agent, Dashboard |
| **HR** | Workforce, Payroll, Attendance | Employees, Attendance, Salary | CHRO Agent, Dashboard |
| **Customer** | Segmentation, LTV, Churn | Customers, Bookings, Feedback | AI Agents, Dashboard |
| **Forecast** | Predictive models | Historical data, Time series | All Agents, Dashboard |
| **Recommendation** | Recommendation engine | Behavior, Purchase history | All Agents, Dashboard |

---

## Data Flow (Luồng Dữ Liệu)

### Flow 1: AI Agent → Intelligence → Database

```
CEO Agent
  ↓
  Gọi: getExecutiveSummary({ tenantId, period })
  ↓
Executive Intelligence
  ↓
  Check Cache (Memory → Redis → DB)
  ↓
  Nếu miss: Query Database Views/Stored Procedures
  ↓
  Transform thành JSON KPI
  ↓
  Cache kết quả
  ↓
  Trả về cho CEO Agent
  ↓
LLM Analysis
```

### Flow 2: Dashboard → Intelligence → Database

```
Dashboard Component
  ↓
  Gọi: getFinanceMetrics({ tenantId, period })
  ↓
Finance Intelligence
  ↓
  Check Cache
  ↓
  Query Database Views
  ↓
  Transform thành DTO
  ↓
  Trả về cho Dashboard
  ↓
Render Charts
```

### Flow 3: Event → Cache Invalidation

```
Business Transaction (e.g., BookingConfirmed)
  ↓
Accounting Outbox Pattern
  ↓
Business Event emitted
  ↓
Event Listener (Intelligence Layer)
  ↓
Cache Invalidator
  ↓
Invalidate relevant cache keys
  ↓
Next query will refresh data
```

---

## Public Interfaces (Giao Diện Công Khai)

### Executive Intelligence

```typescript
export interface ExecutiveIntelligence {
  getExecutiveSummary(params: ExecutiveSummaryParams): Promise<ExecutiveSummaryDTO>;
  getKPIDashboard(params: KPIDashboardParams): Promise<KPIDashboardDTO>;
  getPerformanceTrends(params: PerformanceTrendsParams): Promise<PerformanceTrendsDTO>;
}
```

### Marketing Intelligence

```typescript
export interface MarketingIntelligence {
  getCampaignAnalytics(params: CampaignAnalyticsParams): Promise<CampaignAnalyticsDTO>;
  getROIReport(params: ROIReportParams): Promise<ROIReportDTO>;
  getChannelPerformance(params: ChannelPerformanceParams): Promise<ChannelPerformanceDTO>;
  syncExternalAds(params: SyncExternalAdsParams): Promise<void>;
}
```

### Finance Intelligence

```typescript
export interface FinanceIntelligence {
  getProfitAndLoss(params: PnLParams): Promise<PnLDTO>;
  getCashFlowStatement(params: CashFlowParams): Promise<CashFlowDTO>;
  getFinancialRatios(params: FinancialRatiosParams): Promise<FinancialRatiosDTO>;
}
```

### Customer Intelligence

```typescript
export interface CustomerIntelligence {
  getCustomerSegmentation(params: SegmentationParams): Promise<SegmentationDTO>;
  getCustomerLTV(params: LTVParams): Promise<LTVDTO>;
  getChurnRiskAnalysis(params: ChurnParams): Promise<ChurnDTO>;
}
```

### Forecast Intelligence

```typescript
export interface ForecastIntelligence {
  getRevenueForecast(params: RevenueForecastParams): Promise<RevenueForecastDTO>;
  getChurnForecast(params: ChurnForecastParams): Promise<ChurnForecastDTO>;
  getDemandForecast(params: DemandForecastParams): Promise<DemandForecastDTO>;
}
```

### Recommendation Engine

```typescript
export interface RecommendationEngine {
  getServiceRecommendations(params: ServiceRecommendationParams): Promise<ServiceRecommendationDTO>;
  getUpsellOpportunities(params: UpsellParams): Promise<UpsellDTO>;
}
```

---

## Dependency Rules (Quy Tắc Phụ Thuộc)

### Allowed Dependencies

```
Intelligence Layer
  ↓ CÓ THỂ phụ thuộc
  ├── Database Layer (Views, Stored Procedures)
  ├── Cache Layer (Redis)
  ├── Event Infrastructure (Outbox Pattern)
  └── Shared Types/Utilities
```

### Forbidden Dependencies

```
Intelligence Layer
  ↗ KHÔNG ĐƯỢC phụ thuộc
  ├── Business Services (Finance, CRM, Booking...)
  ├── Repositories (trừ read-only queries)
  ├── API Controllers
  └── AI Orchestrator
```

### Reverse Dependencies (Ai phụ thuộc Intelligence?)

```
AI Agents ────→ Intelligence Layer
Dashboard ────→ Intelligence Layer
Reports ──────→ Intelligence Layer
Export APIs ──→ Intelligence Layer
```

---

## SOLID Principles Compliance

### Single Responsibility Principle (SRP)
- Mỗi domain intelligence chỉ chịu trách nhiệm về 1 lĩnh vực
- Executive Intelligence → CEO metrics only
- Finance Intelligence → CFO metrics only

### Open/Closed Principle (OCP)
- Dễ dàng thêm domain mới (e.g., Franchise Intelligence)
- Không cần sửa code cũ khi thêm domain mới

### Liskov Substitution Principle (LSP)
- Tất cả Intelligence modules implement `IntelligenceService` interface
- Có thể swap implementation (e.g., mock cho testing)

### Interface Segregation Principle (ISP)
- Mỗi consumer chỉ cần implement interface cần thiết
- CEO Agent không cần biết về Marketing Intelligence

### Dependency Inversion Principle (DIP)
- AI Agents phụ thuộc vào `IntelligenceService` interface
- Không phụ thuộc vào concrete implementation

---

## Clean Architecture Compliance

```
┌─────────────────────────────────────────┐
│         Consumers (AI, Dashboard)       │  ← Outer Layer
├─────────────────────────────────────────┤
│      Intelligence Layer (Use Cases)     │  ← Application Layer
├─────────────────────────────────────────┤
│       Cache Layer (Infrastructure)      │  ← Infrastructure Layer
├─────────────────────────────────────────┤
│         Database (Data Source)          │  ← Data Layer
└─────────────────────────────────────────┘
```

### Dependency Direction: Inward Only

```
Consumers → Intelligence → Cache → Database
         (KHÔNG BAO GIỜ ngược chiều)
```

---

## Xem Thêm (See Also)

- [Intelligence Layer Domains](./INTELLIGENCE_LAYER_DOMAINS.md) - Chi tiết từng domain
- [Intelligence Layer Data Flow](./INTELLIGENCE_LAYER_DATA_FLOW.md) - Luồng dữ liệu chi tiết
- [Intelligence Layer API Reference](./INTELLIGENCE_LAYER_API_REFERENCE.md) - API contracts
- [Intelligence Layer Roadmap](./INTELLIGENCE_LAYER_ROADMAP.md) - Lộ trình triển khai
- [Intelligence Layer Performance](./INTELLIGENCE_LAYER_PERFORMANCE.md) - Caching & optimization
- [Intelligence Layer Testing](./INTELLIGENCE_LAYER_TESTING.md) - Testing strategy
- [Intelligence Layer Risks](./INTELLIGENCE_LAYER_RISKS.md) - Risk assessment

---

## Version History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-06-22 | Chief Solution Architect | Initial architecture design |
