# Intelligence Layer Domains - Chi Tiết Từng Domain

## 1. Executive Intelligence (Thông Minh Điều Hành)

### Trách Nhiệm
- Tổng hợp KPI toàn công ty cho CEO
- Phân tích hiệu suất tổng thể
- Theo dõi các chỉ số chiến lược

### Data Sources
- Tất cả các domain khác (Finance, Marketing, Sales, HR, Customer)
- Consolidated views
- Executive summary materialized views

### Metrics
- **Revenue Metrics**: Total Revenue, Revenue Growth, Revenue by Channel
- **Profitability**: Gross Profit, Operating Profit, Net Profit, Profit Margin
- **Customer Metrics**: Total Customers, Customer Growth, CAC, LTV
- **Operational Metrics**: Service Utilization, Staff Productivity
- **Marketing Metrics**: Marketing ROI, Campaign Performance
- **Financial Health**: Cash Balance, Burn Rate, Runway

### APIs
```typescript
interface ExecutiveIntelligence {
  // Tổng quan hiệu suất toàn công ty
  getExecutiveSummary(params: {
    tenantId: string;
    period: 'today' | 'week' | 'month' | 'quarter' | 'year';
  }): Promise<ExecutiveSummaryDTO>;

  // Dashboard KPI cho CEO
  getKPIDashboard(params: {
    tenantId: string;
    dateRange: { from: Date; to: Date };
  }): Promise<KPIDashboardDTO>;

  // Xu hướng hiệu suất theo thời gian
  getPerformanceTrends(params: {
    tenantId: string;
    metrics: string[];
    dateRange: { from: Date; to: Date };
    granularity: 'day' | 'week' | 'month';
  }): Promise<PerformanceTrendsDTO>;
}
```

### Cache Strategy
- TTL: 5 minutes (real-time dashboard)
- Invalidate on: Any major business event (InvoiceCreated, BookingConfirmed, etc.)

---

## 2. Marketing Intelligence (Thông Minh Marketing)

### Trách Nhiệm
- Phân tích hiệu quả chiến dịch marketing
- Theo dõi ROI marketing
- Tích hợp dữ liệu quảng cáo từ nền tảng bên ngoài
- Phân tích nguồn khách hàng (source/medium/campaign)

### Data Sources
- Internal: `campaigns`, `bookings`, `customers`
- External Connectors:
  - Facebook Ads API
  - Google Ads API
  - TikTok Ads API
  - Zalo OA API

### Metrics
- **Campaign Performance**: Impressions, Clicks, CTR, Conversions, CPA
- **ROI Metrics**: Marketing Spend, Revenue from Marketing, ROI, ROAS
- **Channel Performance**: Performance by Channel (Facebook, Google, TikTok, Zalo)
- **Lead Quality**: Lead-to-Customer Conversion Rate, Average Booking Value

### APIs
```typescript
interface MarketingIntelligence {
  // Phân tích hiệu quả chiến dịch
  getCampaignAnalytics(params: {
    tenantId: string;
    campaignIds?: string[];
    dateRange: { from: Date; to: Date };
  }): Promise<CampaignAnalyticsDTO>;

  // Báo cáo ROI marketing
  getROIReport(params: {
    tenantId: string;
    dateRange: { from: Date; to: Date };
    groupBy: 'campaign' | 'channel' | 'source';
  }): Promise<ROIReportDTO>;

  // Hiệu suất theo kênh
  getChannelPerformance(params: {
    tenantId: string;
    dateRange: { from: Date; to: Date };
  }): Promise<ChannelPerformanceDTO>;

  // Đồng bộ dữ liệu quảng cáo bên ngoài
  syncExternalAds(params: {
    tenantId: string;
    platform: 'facebook' | 'google' | 'tiktok' | 'zalo';
    dateRange: { from: Date; to: Date };
  }): Promise<SyncResultDTO>;
}
```

### External Connectors Architecture
```
Marketing Intelligence
  ↓
Connector Factory
  ├── Facebook Ads Connector
  ├── Google Ads Connector
  ├── TikTok Ads Connector
  └── Zalo OA Connector
      ↓
External APIs
  ↓
Transform thành unified schema
  ↓
Store in `external_ads_data` table
  ↓
Join với internal campaigns
```

### Cache Strategy
- TTL: 1 hour (campaign data thay đổi không thường xuyên)
- Invalidate on: CampaignCreated, CampaignUpdated, External sync completed

---

## 3. Finance Intelligence (Thông Minh Tài Chính)

### Trách Nhiệm
- Tạo báo cáo P&L (Profit & Loss)
- Tạo báo cáo Cash Flow
- Tính toán các chỉ số tài chính (Financial Ratios)
- Phân tích chi phí

### Data Sources
- `revenue` table
- `expenses` table (operating_expenses, salary_expenses)
- `accounting_entries` table
- Materialized views: `mv_monthly_pnl`, `mv_cash_flow`

### Metrics
- **Revenue**: Total Revenue, Revenue by Service, Revenue by Channel
- **Expenses**: Operating Expenses, Salary Expenses, Marketing Expenses
- **Profitability**: Gross Profit, Operating Profit, Net Profit, EBITDA
- **Cash Flow**: Operating Cash Flow, Investing Cash Flow, Financing Cash Flow
- **Ratios**: Gross Margin, Operating Margin, Net Margin, Current Ratio, Quick Ratio

### APIs
```typescript
interface FinanceIntelligence {
  // Báo cáo P&L
  getProfitAndLoss(params: {
    tenantId: string;
    period: 'month' | 'quarter' | 'year';
    date: Date;
  }): Promise<PnLDTO>;

  // Báo cáo Cash Flow
  getCashFlowStatement(params: {
    tenantId: string;
    period: 'month' | 'quarter' | 'year';
    date: Date;
  }): Promise<CashFlowDTO>;

  // Các chỉ số tài chính
  getFinancialRatios(params: {
    tenantId: string;
    date: Date;
  }): Promise<FinancialRatiosDTO>;

  // Phân tích chi phí
  getExpenseBreakdown(params: {
    tenantId: string;
    dateRange: { from: Date; to: Date };
    groupBy: 'category' | 'department' | 'branch';
  }): Promise<ExpenseBreakdownDTO>;
}
```

### Cache Strategy
- TTL: 1 hour (financial data thay đổi không thường xuyên)
- Invalidate on: InvoiceCreated, ExpenseApproved, SalaryCalculated

---

## 4. Sales Intelligence (Thông Minh Bán Hàng)

### Trách Nhiệm
- Theo dõi sales pipeline
- Phân tích conversion funnel
- Dự báo doanh thu
- Phân tích hiệu suất bán hàng

### Data Sources
- `bookings` table
- `invoices` table
- `packages` table
- Views: `v_sales_pipeline`, `v_conversion_funnel`

### Metrics
- **Pipeline**: Total Opportunities, Pipeline Value, Win Rate
- **Conversion**: Booking-to-Payment Conversion, Average Deal Size
- **Revenue**: Revenue by Service, Revenue by Sales Rep, Revenue by Branch
- **Performance**: Top Performing Services, Top Sales Reps

### APIs
```typescript
interface SalesIntelligence {
  // Sales pipeline
  getSalesPipeline(params: {
    tenantId: string;
    dateRange: { from: Date; to: Date };
  }): Promise<SalesPipelineDTO>;

  // Conversion funnel
  getConversionFunnel(params: {
    tenantId: string;
    dateRange: { from: Date; to: Date };
    groupBy?: 'service' | 'source' | 'branch';
  }): Promise<ConversionFunnelDTO>;

  // Dự báo doanh thu
  getRevenueForecast(params: {
    tenantId: string;
    forecastPeriod: 'month' | 'quarter';
  }): Promise<RevenueForecastDTO>;
}
```

### Cache Strategy
- TTL: 15 minutes (sales data cần real-time hơn)
- Invalidate on: BookingCreated, BookingConfirmed, InvoiceCreated

---

## 5. HR Intelligence (Thông Minh Nhân Sự)

### Trách Nhiệm
- Phân tích workforce
- Theo dõi attendance & productivity
- Phân tích payroll
- Employee performance metrics

### Data Sources
- `employees` table
- `attendance` table
- `salary_records` table
- `kpi_records` table
- Views: `v_employee_performance`, `v_workforce_analytics`

### Metrics
- **Workforce**: Total Employees, Active Employees, Turnover Rate, Headcount Growth
- **Attendance**: Attendance Rate, Overtime Hours, Leave Utilization
- **Payroll**: Total Payroll, Average Salary, Salary by Department
- **Performance**: KPI Achievement Rate, Top Performers, Performance Distribution

### APIs
```typescript
interface HRIntelligence {
  // Phân tích workforce
  getWorkforceAnalytics(params: {
    tenantId: string;
    dateRange: { from: Date; to: Date };
  }): Promise<WorkforceAnalyticsDTO>;

  // Attendance report
  getAttendanceReport(params: {
    tenantId: string;
    period: 'month' | 'quarter';
    date: Date;
  }): Promise<AttendanceReportDTO>;

  // Payroll summary
  getPayrollSummary(params: {
    tenantId: string;
    period: 'month' | 'quarter';
    date: Date;
  }): Promise<PayrollSummaryDTO>;

  // Employee performance
  getEmployeePerformance(params: {
    tenantId: string;
    employeeIds?: string[];
    dateRange: { from: Date; to: Date };
  }): Promise<EmployeePerformanceDTO>;
}
```

### Cache Strategy
- TTL: 30 minutes (HR data thay đổi vừa phải)
- Invalidate on: AttendanceSubmitted, SalaryCalculated, KPIUpdated

---

## 6. Customer Intelligence (Thông Minh Khách Hàng)

### Trách Nhiệm
- Phân khúc khách hàng (Customer Segmentation)
- Tính toán Customer Lifetime Value (LTV)
- Phân tích Churn Risk
- RFM Analysis (Recency, Frequency, Monetary)

### Data Sources
- `customers` table
- `bookings` table
- `invoices` table
- `feedback` table
- Views: `v_customer_segments`, `v_customer_ltv`

### Metrics
- **Segmentation**: Customer Segments (VIP, Loyal, At Risk, Lost)
- **LTV**: Average LTV, LTV by Segment, LTV Distribution
- **Churn**: Churn Rate, Churn Risk Score, Churn Prediction
- **RFM**: Recency Score, Frequency Score, Monetary Score

### APIs
```typescript
interface CustomerIntelligence {
  // Phân khúc khách hàng
  getCustomerSegmentation(params: {
    tenantId: string;
    date: Date;
  }): Promise<SegmentationDTO>;

  // Customer LTV
  getCustomerLTV(params: {
    tenantId: string;
    customerIds?: string[];
  }): Promise<LTVDTO>;

  // Churn risk analysis
  getChurnRiskAnalysis(params: {
    tenantId: string;
    date: Date;
  }): Promise<ChurnDTO>;

  // RFM analysis
  getRFMAnalysis(params: {
    tenantId: string;
    date: Date;
  }): Promise<RFMDTO>;
}
```

### Cache Strategy
- TTL: 24 hours (customer segmentation thay đổi chậm)
- Invalidate on: BookingCreated, CustomerUpdated, FeedbackSubmitted

---

## 7. Forecast Intelligence (Thông Minh Dự Báo)

### Trách Nhiệm
- Dự báo doanh thu (Revenue Forecast)
- Dự báo churn (Churn Forecast)
- Dự báo demand (Demand Forecast)
- Time series analysis

### Data Sources
- Historical data từ tất cả các domains
- Time series tables
- External economic indicators (future)

### Algorithms
- Time Series Models: ARIMA, Prophet, LSTM
- Machine Learning Models: Regression, Random Forest, XGBoost

### APIs
```typescript
interface ForecastIntelligence {
  // Dự báo doanh thu
  getRevenueForecast(params: {
    tenantId: string;
    forecastPeriod: 'week' | 'month' | 'quarter' | 'year';
    granularity: 'day' | 'week' | 'month';
  }): Promise<RevenueForecastDTO>;

  // Dự báo churn
  getChurnForecast(params: {
    tenantId: string;
    forecastPeriod: 'month' | 'quarter';
  }): Promise<ChurnForecastDTO>;

  // Dự báo demand
  getDemandForecast(params: {
    tenantId: string;
    serviceId: string;
    forecastPeriod: 'week' | 'month';
  }): Promise<DemandForecastDTO>;
}
```

### Cache Strategy
- TTL: 12 hours (forecast chạy nặng, cache lâu hơn)
- Invalidate on: End of day (scheduled refresh)

---

## 8. Recommendation Engine (Công Cụ Gợi Ý)

### Trách Nhiệm
- Gợi ý dịch vụ cho khách hàng
- Xác định cơ hội upsell/cross-sell
- Personalized recommendations

### Data Sources
- Customer behavior data
- Purchase history
- Service usage patterns
- Collaborative filtering data

### Algorithms
- Collaborative Filtering
- Content-Based Filtering
- Hybrid Recommendation
- Association Rules (Market Basket Analysis)

### APIs
```typescript
interface RecommendationEngine {
  // Gợi ý dịch vụ cho khách hàng
  getServiceRecommendations(params: {
    tenantId: string;
    customerId: string;
    topN: number;
  }): Promise<ServiceRecommendationDTO>;

  // Cơ hội upsell
  getUpsellOpportunities(params: {
    tenantId: string;
    customerId?: string;
    segmentId?: string;
  }): Promise<UpsellDTO>;

  // Gợi ý combo/package
  getPackageRecommendations(params: {
    tenantId: string;
    customerId: string;
    currentServices: string[];
  }): Promise<PackageRecommendationDTO>;
}
```

### Cache Strategy
- TTL: 1 hour (recommendations có thể cache khá lâu)
- Invalidate on: CustomerBehaviorChanged, BookingCreated

---

## Domain Interaction Matrix

| Domain | Depends On | Consumed By |
|--------|-----------|-------------|
| **Executive** | All domains | CEO Agent, Dashboard |
| **Marketing** | Customer, Sales | CMO Agent, Dashboard |
| **Finance** | Sales, HR, Marketing | CFO Agent, Dashboard |
| **Sales** | Customer | Sales Agent, Dashboard |
| **HR** | - | CHRO Agent, Dashboard |
| **Customer** | Sales | All Agents, Recommendation |
| **Forecast** | All domains | All Agents, Dashboard |
| **Recommendation** | Customer, Sales | All Agents, Dashboard |

---

## Xem Thêm (See Also)

- [Intelligence Layer Architecture](./INTELLIGENCE_LAYER_ARCHITECTURE.md) - Tổng quan kiến trúc
- [Intelligence Layer Data Flow](./INTELLIGENCE_LAYER_DATA_FLOW.md) - Luồng dữ liệu chi tiết
- [Intelligence Layer API Reference](./INTELLIGENCE_LAYER_API_REFERENCE.md) - API contracts
- [Intelligence Layer Roadmap](./INTELLIGENCE_LAYER_ROADMAP.md) - Lộ trình triển khai

---

## Version History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-06-22 | Chief Solution Architect | Initial domain design |
