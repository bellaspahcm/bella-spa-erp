# Analytics Services

This directory contains services for business intelligence, dashboard aggregation, and report generation.

## Purpose

Provides core analytics capabilities that aggregate data across all industry modules for dashboards and reports.

## Key Services

### Dashboard Aggregation
- Aggregate key business metrics
- Support real-time data updates
- Filter by tenant and module
- Provide widget data for dashboards

### Report Generation
- Generate business intelligence reports
- Support custom date ranges
- Export to Excel, PDF formats
- Handle large datasets efficiently

### Cross-Module Analytics
- Query data from all enabled modules
- Aggregate metrics across modules
- Support module-specific metrics
- Provide unified analytics view

## Usage Patterns

### 1. Getting Dashboard Data

```typescript
import { getDashboardData } from '@/core/services/analytics/dashboard';

const dashboardData = await getDashboardData(context, {
  dateRange: {
    startDate: '2025-01-01',
    endDate: '2025-01-31'
  }
});

console.log(`Total Revenue: ${dashboardData.totalRevenue}`);
console.log(`Total Orders: ${dashboardData.totalOrders}`);
```

### 2. Generating Reports

```typescript
import { generateReport } from '@/core/services/analytics/reports';

const report = await generateReport(context, {
  reportType: 'revenue_by_module',
  startDate: '2025-01-01',
  endDate: '2025-01-31',
  format: 'excel'
});

// Returns: { url: 's3://reports/revenue-2025-01.xlsx' }
```

### 3. Exporting Data

```typescript
import { exportToExcel } from '@/core/services/analytics/export';

const file = await exportToExcel(context, {
  data: orders,
  columns: ['id', 'customerName', 'totalPrice', 'status'],
  sheetName: 'Orders Report'
});
```

## Report Types

Supported report types:
- **revenue_by_module**: Revenue breakdown by industry module
- **orders_by_status**: Order counts by status
- **customer_analytics**: Customer behavior and trends
- **employee_performance**: Employee performance metrics (module-specific)
- **financial_summary**: P&L and cash flow summary

## Module Integration

Analytics services query data from all enabled modules:

```typescript
const modules = context.enabledModules; // ['spa', 'cleaning']

for (const moduleId of modules) {
  const adapter = moduleRegistry.get(moduleId);
  if (adapter) {
    const moduleMetrics = await adapter.getModuleMetrics(context);
    aggregateMetrics.push(moduleMetrics);
  }
}
```

## Export Formats

Supported export formats:
- **excel**: .xlsx files with formatted data
- **pdf**: PDF documents with charts and tables
- **csv**: Plain CSV for data import

## Tenant Isolation

All analytics queries filter by `tenantId` from TenantContext to ensure tenant isolation.

## Performance Considerations

- Dashboard data is cached for 5 minutes
- Large reports are processed asynchronously
- Background jobs handle report generation
- S3 storage for large report files
