# Intelligence Layer API Reference - Tài Liệu API Chi Tiết

## Quy Ước API (API Conventions)

### Request Parameters (Tham Số Đầu Vào)
Tất cả API đều yêu cầu `tenantId` để đảm bảo multi-tenancy.

### Response Format (Định Dạng Response)
Tất cả API trả về DTO (Data Transfer Object) đã được chuẩn hóa.

### Error Handling (Xử Lý Lỗi)
```typescript
interface APIError {
  code: string;
  message: string;
  details?: any;
}
```

### Date Format (Định Dạng Ngày Tháng)
- Input: ISO 8601 string (`YYYY-MM-DD`)
- Output: ISO 8601 string

---

## 1. Executive Intelligence API

### 1.1. Get Executive Summary (Tổng Quan Điều Hành)

**Mô tả**: Lấy tổng quan KPI toàn công ty cho CEO

**Endpoint**: `ExecutiveIntelligence.getExecutiveSummary()`

**Parameters**:
```typescript
interface ExecutiveSummaryParams {
  tenantId: string;
  period: 'today' | 'week' | 'month' | 'quarter' | 'year';
}
```

**Response**:
```typescript
interface ExecutiveSummaryDTO {
  period: string;
  dateRange: {
    from: Date;
    to: Date;
  };
  revenue: {
    total: number;
    growth: number; // Percentage
    byChannel: Array<{ channel: string; amount: number }>;
  };
  profit: {
    gross: number;
    operating: number;
    net: number;
    margin: number; // Percentage
  };
  customers: {
    total: number;
    new: number;
    retained: number;
    churn: number;
  };
  operational: {
    serviceUtilization: number; // Percentage
    staffProductivity: number; // Revenue per staff
  };
  marketing: {
    roi: number; // Percentage
    cac: number; // Customer Acquisition Cost
    ltv: number; // Lifetime Value
  };
  financial: {
    cashBalance: number;
    burnRate: number; // Monthly burn
    runway: number; // Months
  };
}
```

**Example**:
```typescript
const summary = await ExecutiveIntelligence.getExecutiveSummary({
  tenantId: 'tenant-123',
  period: 'month'
});

console.log(summary.revenue.total); // 450000000
console.log(summary.profit.margin); // 15.5
```

---

### 1.2. Get KPI Dashboard (Dashboard KPI)

**Mô tả**: Lấy dashboard KPI với date range tùy chỉnh

**Endpoint**: `ExecutiveIntelligence.getKPIDashboard()`

**Parameters**:
```typescript
interface KPIDashboardParams {
  tenantId: string;
  dateRange: {
    from: Date;
    to: Date;
  };
}
```

**Response**:
```typescript
interface KPIDashboardDTO {
  dateRange: {
    from: Date;
    to: Date;
  };
  metrics: Array<{
    name: string;
    value: number;
    unit: string;
    trend: 'up' | 'down' | 'stable';
    change: number; // Percentage
  }>;
}
```

---

### 1.3. Get Performance Trends (Xu Hướng Hiệu Suất)

**Mô tả**: Lấy xu hướng các KPI theo thời gian

**Endpoint**: `ExecutiveIntelligence.getPerformanceTrends()`

**Parameters**:
```typescript
interface PerformanceTrendsParams {
  tenantId: string;
  metrics: string[]; // e.g., ['revenue', 'profit', 'customers']
  dateRange: {
    from: Date;
    to: Date;
  };
  granularity: 'day' | 'week' | 'month';
}
```

**Response**:
```typescript
interface PerformanceTrendsDTO {
  metrics: Array<{
    name: string;
    data: Array<{
      date: Date;
      value: number;
    }>;
  }>;
}
```

---

## 2. Marketing Intelligence API

### 2.1. Get Campaign Analytics (Phân Tích Chiến Dịch)

**Mô tả**: Phân tích hiệu quả chiến dịch marketing

**Endpoint**: `MarketingIntelligence.getCampaignAnalytics()`

**Parameters**:
```typescript
interface CampaignAnalyticsParams {
  tenantId: string;
  campaignIds?: string[]; // Optional: filter by campaign IDs
  dateRange: {
    from: Date;
    to: Date;
  };
}
```

**Response**:
```typescript
interface CampaignAnalyticsDTO {
  campaigns: Array<{
    id: string;
    name: string;
    platform: 'facebook' | 'google' | 'tiktok' | 'zalo';
    metrics: {
      impressions: number;
      clicks: number;
      ctr: number; // Click-through rate (%)
      conversions: number;
      cpa: number; // Cost per acquisition
      spend: number;
      revenue: number;
      roi: number; // ROI (%)
    };
  }>;
  totals: {
    impressions: number;
    clicks: number;
    conversions: number;
    spend: number;
    revenue: number;
    roi: number;
  };
}
```

**Example**:
```typescript
const analytics = await MarketingIntelligence.getCampaignAnalytics({
  tenantId: 'tenant-123',
  dateRange: {
    from: new Date('2026-06-01'),
    to: new Date('2026-06-30')
  }
});

console.log(analytics.totals.roi); // 250.5 (%)
```

---

### 2.2. Get ROI Report (Báo Cáo ROI)

**Mô tả**: Báo cáo ROI marketing theo chiến dịch/kênh/nguồn

**Endpoint**: `MarketingIntelligence.getROIReport()`

**Parameters**:
```typescript
interface ROIReportParams {
  tenantId: string;
  dateRange: {
    from: Date;
    to: Date;
  };
  groupBy: 'campaign' | 'channel' | 'source';
}
```

**Response**:
```typescript
interface ROIReportDTO {
  groupBy: string;
  items: Array<{
    name: string;
    spend: number;
    revenue: number;
    roi: number; // Percentage
    roas: number; // Return on Ad Spend
  }>;
}
```

---

### 2.3. Get Channel Performance (Hiệu Suất Theo Kênh)

**Mô tả**: So sánh hiệu suất giữa các kênh marketing

**Endpoint**: `MarketingIntelligence.getChannelPerformance()`

**Parameters**:
```typescript
interface ChannelPerformanceParams {
  tenantId: string;
  dateRange: {
    from: Date;
    to: Date;
  };
}
```

**Response**:
```typescript
interface ChannelPerformanceDTO {
  channels: Array<{
    name: string;
    impressions: number;
    clicks: number;
    conversions: number;
    spend: number;
    revenue: number;
    roi: number;
    cpa: number;
  }>;
}
```

---

### 2.4. Sync External Ads (Đồng Bộ Quảng Cáo Bên Ngoài)

**Mô tả**: Đồng bộ dữ liệu quảng cáo từ nền tảng bên ngoài (Facebook, Google, TikTok, Zalo)

**Endpoint**: `MarketingIntelligence.syncExternalAds()`

**Parameters**:
```typescript
interface SyncExternalAdsParams {
  tenantId: string;
  platform: 'facebook' | 'google' | 'tiktok' | 'zalo';
  dateRange: {
    from: Date;
    to: Date;
  };
}
```

**Response**:
```typescript
interface SyncResultDTO {
  success: boolean;
  recordCount: number;
  syncedAt: Date;
}
```

---

## 3. Finance Intelligence API

### 3.1. Get Profit and Loss (Báo Cáo P&L)

**Mô tả**: Lấy báo cáo P&L (Profit & Loss)

**Endpoint**: `FinanceIntelligence.getProfitAndLoss()`

**Parameters**:
```typescript
interface PnLParams {
  tenantId: string;
  period: 'month' | 'quarter' | 'year';
  date: Date; // E.g., '2026-06-01' for June 2026
}
```

**Response**:
```typescript
interface PnLDTO {
  period: string; // E.g., 'June 2026'
  revenue: {
    total: number;
    byService: Array<{ service: string; amount: number }>;
    byChannel: Array<{ channel: string; amount: number }>;
  };
  expenses: {
    operating: number;
    salary: number;
    marketing: number;
    other: number;
    total: number;
  };
  profit: {
    gross: number;
    grossMargin: number; // Percentage
    operating: number;
    operatingMargin: number; // Percentage
    net: number;
    netMargin: number; // Percentage
    ebitda: number;
  };
}
```

**Example**:
```typescript
const pnl = await FinanceIntelligence.getProfitAndLoss({
  tenantId: 'tenant-123',
  period: 'month',
  date: new Date('2026-06-01')
});

console.log(pnl.profit.net); // 67500000
console.log(pnl.profit.netMargin); // 15.0
```

---

### 3.2. Get Cash Flow Statement (Báo Cáo Dòng Tiền)

**Mô tả**: Lấy báo cáo Cash Flow

**Endpoint**: `FinanceIntelligence.getCashFlowStatement()`

**Parameters**:
```typescript
interface CashFlowParams {
  tenantId: string;
  period: 'month' | 'quarter' | 'year';
  date: Date;
}
```

**Response**:
```typescript
interface CashFlowDTO {
  period: string;
  operatingActivities: {
    netIncome: number;
    adjustments: number;
    total: number;
  };
  investingActivities: {
    capitalExpenditure: number;
    total: number;
  };
  financingActivities: {
    loansReceived: number;
    loansPaid: number;
    total: number;
  };
  netCashFlow: number;
  cashBeginning: number;
  cashEnding: number;
}
```

---

### 3.3. Get Financial Ratios (Các Chỉ Số Tài Chính)

**Mô tả**: Tính toán các chỉ số tài chính (Financial Ratios)

**Endpoint**: `FinanceIntelligence.getFinancialRatios()`

**Parameters**:
```typescript
interface FinancialRatiosParams {
  tenantId: string;
  date: Date;
}
```

**Response**:
```typescript
interface FinancialRatiosDTO {
  profitability: {
    grossMargin: number; // Percentage
    operatingMargin: number; // Percentage
    netMargin: number; // Percentage
    roe: number; // Return on Equity (%)
    roa: number; // Return on Assets (%)
  };
  liquidity: {
    currentRatio: number;
    quickRatio: number;
    cashRatio: number;
  };
  efficiency: {
    assetTurnover: number;
    inventoryTurnover: number;
    receivablesTurnover: number;
  };
}
```

---

### 3.4. Get Expense Breakdown (Phân Tích Chi Phí)

**Mô tả**: Phân tích chi phí theo category/department/branch

**Endpoint**: `FinanceIntelligence.getExpenseBreakdown()`

**Parameters**:
```typescript
interface ExpenseBreakdownParams {
  tenantId: string;
  dateRange: {
    from: Date;
    to: Date;
  };
  groupBy: 'category' | 'department' | 'branch';
}
```

**Response**:
```typescript
interface ExpenseBreakdownDTO {
  items: Array<{
    name: string;
    amount: number;
    percentage: number; // % of total
  }>;
  total: number;
}
```

---

## 4. Sales Intelligence API

### 4.1. Get Sales Pipeline (Sales Pipeline)

**Mô tả**: Theo dõi sales pipeline

**Endpoint**: `SalesIntelligence.getSalesPipeline()`

**Parameters**:
```typescript
interface SalesPipelineParams {
  tenantId: string;
  dateRange: {
    from: Date;
    to: Date;
  };
}
```

**Response**:
```typescript
interface SalesPipelineDTO {
  stages: Array<{
    name: string; // E.g., 'Inquiry', 'Booking', 'Confirmed', 'Completed'
    count: number;
    value: number;
  }>;
  metrics: {
    totalOpportunities: number;
    pipelineValue: number;
    winRate: number; // Percentage
    averageDealSize: number;
  };
}
```

---

### 4.2. Get Conversion Funnel (Phễu Chuyển Đổi)

**Mô tả**: Phân tích conversion funnel

**Endpoint**: `SalesIntelligence.getConversionFunnel()`

**Parameters**:
```typescript
interface ConversionFunnelParams {
  tenantId: string;
  dateRange: {
    from: Date;
    to: Date;
  };
  groupBy?: 'service' | 'source' | 'branch';
}
```

**Response**:
```typescript
interface ConversionFunnelDTO {
  stages: Array<{
    name: string;
    count: number;
    conversionRate: number; // Percentage from previous stage
  }>;
  overall: {
    totalLeads: number;
    totalConversions: number;
    overallConversionRate: number; // Percentage
  };
}
```

---

### 4.3. Get Revenue Forecast (Dự Báo Doanh Thu)

**Mô tả**: Dự báo doanh thu dựa trên sales pipeline

**Endpoint**: `SalesIntelligence.getRevenueForecast()`

**Parameters**:
```typescript
interface RevenueForecastParams {
  tenantId: string;
  forecastPeriod: 'month' | 'quarter';
}
```

**Response**:
```typescript
interface RevenueForecastDTO {
  forecastPeriod: string;
  forecast: number;
  confidence: number; // Percentage
  breakdown: Array<{
    source: string; // E.g., 'Confirmed bookings', 'Pipeline'
    amount: number;
  }>;
}
```

---

## 5. HR Intelligence API

### 5.1. Get Workforce Analytics (Phân Tích Lực Lượng Lao Động)

**Mô tả**: Phân tích workforce

**Endpoint**: `HRIntelligence.getWorkforceAnalytics()`

**Parameters**:
```typescript
interface WorkforceAnalyticsParams {
  tenantId: string;
  dateRange: {
    from: Date;
    to: Date;
  };
}
```

**Response**:
```typescript
interface WorkforceAnalyticsDTO {
  metrics: {
    totalEmployees: number;
    activeEmployees: number;
    turnoverRate: number; // Percentage
    headcountGrowth: number; // Percentage
  };
  demographics: {
    byDepartment: Array<{ department: string; count: number }>;
    byRole: Array<{ role: string; count: number }>;
    byBranch: Array<{ branch: string; count: number }>;
  };
}
```

---

### 5.2. Get Attendance Report (Báo Cáo Chấm Công)

**Mô tả**: Báo cáo attendance

**Endpoint**: `HRIntelligence.getAttendanceReport()`

**Parameters**:
```typescript
interface AttendanceReportParams {
  tenantId: string;
  period: 'month' | 'quarter';
  date: Date;
}
```

**Response**:
```typescript
interface AttendanceReportDTO {
  period: string;
  summary: {
    totalWorkingDays: number;
    totalAttendance: number;
    attendanceRate: number; // Percentage
    totalOvertimeHours: number;
    totalLeaveHours: number;
  };
  byEmployee: Array<{
    employeeId: string;
    name: string;
    attendance: number;
    overtime: number;
    leave: number;
  }>;
}
```

---

### 5.3. Get Payroll Summary (Tổng Quan Lương)

**Mô tả**: Tổng quan payroll

**Endpoint**: `HRIntelligence.getPayrollSummary()`

**Parameters**:
```typescript
interface PayrollSummaryParams {
  tenantId: string;
  period: 'month' | 'quarter';
  date: Date;
}
```

**Response**:
```typescript
interface PayrollSummaryDTO {
  period: string;
  summary: {
    totalPayroll: number;
    averageSalary: number;
    totalBonuses: number;
    totalDeductions: number;
  };
  byDepartment: Array<{
    department: string;
    totalPayroll: number;
    averageSalary: number;
  }>;
}
```

---

### 5.4. Get Employee Performance (Hiệu Suất Nhân Viên)

**Mô tả**: Phân tích employee performance

**Endpoint**: `HRIntelligence.getEmployeePerformance()`

**Parameters**:
```typescript
interface EmployeePerformanceParams {
  tenantId: string;
  employeeIds?: string[]; // Optional: filter by employee IDs
  dateRange: {
    from: Date;
    to: Date;
  };
}
```

**Response**:
```typescript
interface EmployeePerformanceDTO {
  employees: Array<{
    employeeId: string;
    name: string;
    kpi: {
      target: number;
      actual: number;
      achievement: number; // Percentage
    };
    sessions: {
      total: number;
      averageRating: number;
    };
    revenue: number; // Revenue generated
  }>;
}
```

---

## 6. Customer Intelligence API

### 6.1. Get Customer Segmentation (Phân Khúc Khách Hàng)

**Mô tả**: Phân khúc khách hàng (VIP, Loyal, At Risk, Lost)

**Endpoint**: `CustomerIntelligence.getCustomerSegmentation()`

**Parameters**:
```typescript
interface SegmentationParams {
  tenantId: string;
  date: Date;
}
```

**Response**:
```typescript
interface SegmentationDTO {
  segments: Array<{
    name: string; // E.g., 'VIP', 'Loyal', 'At Risk', 'Lost'
    count: number;
    percentage: number; // % of total customers
    totalRevenue: number;
    averageLTV: number;
  }>;
  total: number;
}
```

---

### 6.2. Get Customer LTV (Customer Lifetime Value)

**Mô tả**: Tính toán Customer LTV

**Endpoint**: `CustomerIntelligence.getCustomerLTV()`

**Parameters**:
```typescript
interface LTVParams {
  tenantId: string;
  customerIds?: string[]; // Optional: filter by customer IDs
}
```

**Response**:
```typescript
interface LTVDTO {
  customers: Array<{
    customerId: string;
    name: string;
    ltv: number;
    totalRevenue: number;
    totalBookings: number;
    averageBookingValue: number;
    firstBookingDate: Date;
    lastBookingDate: Date;
  }>;
  averageLTV: number;
}
```

---

### 6.3. Get Churn Risk Analysis (Phân Tích Nguy Cơ Rời Bỏ)

**Mô tả**: Phân tích churn risk

**Endpoint**: `CustomerIntelligence.getChurnRiskAnalysis()`

**Parameters**:
```typescript
interface ChurnParams {
  tenantId: string;
  date: Date;
}
```

**Response**:
```typescript
interface ChurnDTO {
  atRiskCustomers: Array<{
    customerId: string;
    name: string;
    churnRiskScore: number; // 0-100 (100 = highest risk)
    lastBookingDate: Date;
    daysSinceLastBooking: number;
    totalBookings: number;
    totalRevenue: number;
  }>;
  summary: {
    totalAtRisk: number;
    potentialRevenueLoss: number;
    churnRate: number; // Percentage
  };
}
```

---

### 6.4. Get RFM Analysis (RFM Analysis)

**Mô tả**: RFM analysis (Recency, Frequency, Monetary)

**Endpoint**: `CustomerIntelligence.getRFMAnalysis()`

**Parameters**:
```typescript
interface RFMParams {
  tenantId: string;
  date: Date;
}
```

**Response**:
```typescript
interface RFMDTO {
  customers: Array<{
    customerId: string;
    name: string;
    recency: number; // Days since last booking
    frequency: number; // Number of bookings
    monetary: number; // Total revenue
    rfmScore: string; // E.g., '555' (highest), '111' (lowest)
    segment: string; // E.g., 'Champions', 'Loyal', 'At Risk'
  }>;
}
```

---

## 7. Forecast Intelligence API

### 7.1. Get Revenue Forecast (Dự Báo Doanh Thu)

**Mô tả**: Dự báo doanh thu sử dụng time series models

**Endpoint**: `ForecastIntelligence.getRevenueForecast()`

**Parameters**:
```typescript
interface RevenueForecastParams {
  tenantId: string;
  forecastPeriod: 'week' | 'month' | 'quarter' | 'year';
  granularity: 'day' | 'week' | 'month';
}
```

**Response**:
```typescript
interface RevenueForecastDTO {
  forecast: Array<{
    date: Date;
    predictedRevenue: number;
    confidenceInterval: {
      lower: number;
      upper: number;
    };
  }>;
  model: string; // E.g., 'ARIMA', 'Prophet', 'LSTM'
  accuracy: number; // Model accuracy (%)
}
```

---

### 7.2. Get Churn Forecast (Dự Báo Churn)

**Mô tả**: Dự báo churn rate

**Endpoint**: `ForecastIntelligence.getChurnForecast()`

**Parameters**:
```typescript
interface ChurnForecastParams {
  tenantId: string;
  forecastPeriod: 'month' | 'quarter';
}
```

**Response**:
```typescript
interface ChurnForecastDTO {
  forecast: Array<{
    period: string;
    predictedChurnRate: number; // Percentage
    predictedChurnCount: number;
  }>;
}
```

---

### 7.3. Get Demand Forecast (Dự Báo Cầu)

**Mô tả**: Dự báo demand cho dịch vụ

**Endpoint**: `ForecastIntelligence.getDemandForecast()`

**Parameters**:
```typescript
interface DemandForecastParams {
  tenantId: string;
  serviceId: string;
  forecastPeriod: 'week' | 'month';
}
```

**Response**:
```typescript
interface DemandForecastDTO {
  serviceId: string;
  serviceName: string;
  forecast: Array<{
    date: Date;
    predictedDemand: number; // Number of bookings
  }>;
}
```

---

## 8. Recommendation Engine API

### 8.1. Get Service Recommendations (Gợi Ý Dịch Vụ)

**Mô tả**: Gợi ý dịch vụ cho khách hàng dựa trên behavior & purchase history

**Endpoint**: `RecommendationEngine.getServiceRecommendations()`

**Parameters**:
```typescript
interface ServiceRecommendationParams {
  tenantId: string;
  customerId: string;
  topN: number; // E.g., 5
}
```

**Response**:
```typescript
interface ServiceRecommendationDTO {
  customerId: string;
  recommendations: Array<{
    serviceId: string;
    serviceName: string;
    score: number; // 0-1 (1 = highest recommendation)
    reason: string; // E.g., 'Customers like you also booked this'
  }>;
}
```

---

### 8.2. Get Upsell Opportunities (Cơ Hội Upsell)

**Mô tả**: Xác định cơ hội upsell/cross-sell

**Endpoint**: `RecommendationEngine.getUpsellOpportunities()`

**Parameters**:
```typescript
interface UpsellParams {
  tenantId: string;
  customerId?: string; // Optional: for specific customer
  segmentId?: string; // Optional: for customer segment
}
```

**Response**:
```typescript
interface UpsellDTO {
  opportunities: Array<{
    customerId: string;
    customerName: string;
    currentServices: string[];
    recommendedService: {
      serviceId: string;
      serviceName: string;
      potentialRevenue: number;
    };
    score: number; // 0-1 (1 = highest opportunity)
  }>;
}
```

---

### 8.3. Get Package Recommendations (Gợi Ý Combo/Package)

**Mô tả**: Gợi ý combo/package dựa trên current services

**Endpoint**: `RecommendationEngine.getPackageRecommendations()`

**Parameters**:
```typescript
interface PackageRecommendationParams {
  tenantId: string;
  customerId: string;
  currentServices: string[]; // Service IDs
}
```

**Response**:
```typescript
interface PackageRecommendationDTO {
  customerId: string;
  recommendations: Array<{
    packageId: string;
    packageName: string;
    includedServices: string[];
    price: number;
    discount: number; // Percentage
    score: number; // 0-1
  }>;
}
```

---

## Common Types (Kiểu Dữ Liệu Chung)

### Date Range
```typescript
interface DateRange {
  from: Date;
  to: Date;
}
```

### Period
```typescript
type Period = 'today' | 'week' | 'month' | 'quarter' | 'year';
```

### Granularity
```typescript
type Granularity = 'day' | 'week' | 'month';
```

### Trend
```typescript
type Trend = 'up' | 'down' | 'stable';
```

---

## Error Codes (Mã Lỗi)

| Code | Message | Description |
|------|---------|-------------|
| `INVALID_TENANT` | Invalid tenant ID | Tenant ID không tồn tại |
| `INVALID_DATE_RANGE` | Invalid date range | Date range không hợp lệ |
| `CACHE_ERROR` | Cache service error | Lỗi cache service |
| `DATABASE_ERROR` | Database query error | Lỗi query database |
| `EXTERNAL_API_ERROR` | External API error | Lỗi khi gọi API bên ngoài (Facebook, Google, ...) |
| `INSUFFICIENT_DATA` | Insufficient data for analysis | Không đủ dữ liệu để phân tích |

---

## Xem Thêm (See Also)

- [Intelligence Layer Architecture](./INTELLIGENCE_LAYER_ARCHITECTURE.md) - Tổng quan kiến trúc
- [Intelligence Layer Domains](./INTELLIGENCE_LAYER_DOMAINS.md) - Chi tiết từng domain
- [Intelligence Layer Data Flow](./INTELLIGENCE_LAYER_DATA_FLOW.md) - Luồng dữ liệu chi tiết

---

## Version History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-06-22 | Chief Solution Architect | Initial API reference |
