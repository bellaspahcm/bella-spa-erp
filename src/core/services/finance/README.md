# Finance Services

This directory contains services for revenue recognition, expense tracking, invoicing, and P&L reporting.

## Purpose

Provides core financial management logic that works across all industry modules.

## Key Services

### Revenue Recognition
- Recognize revenue from completed orders
- Track revenue by module and category
- Handle revenue adjustments and refunds
- Support multiple revenue recognition methods

### Expense Tracking
- Track operating expenses
- Track salary expenses
- Categorize expenses by type
- Handle expense approvals and payments

### Invoicing
- Generate invoices from orders
- Track invoice status
- Handle invoice payments
- Support invoice templates

### P&L Reporting
- Generate profit & loss reports
- Aggregate data across modules
- Calculate gross profit and net profit
- Support custom date ranges

## Usage Patterns

### 1. Recognizing Revenue

```typescript
import { recognizeRevenue } from '@/core/services/finance/revenue';

const revenue = await recognizeRevenue(context, {
  orderId: order.id,
  amount: order.totalPrice,
  recognizedAt: new Date(),
  category: 'service_revenue'
});
```

### 2. Tracking Expenses

```typescript
import { createExpense } from '@/core/services/finance/expense';

const expense = await createExpense(context, {
  category: 'operating_expense',
  amount: 5000000,
  description: 'Monthly rent',
  status: 'pending'
});
```

### 3. Generating P&L Report

```typescript
import { generatePnLReport } from '@/core/services/finance/reports';

const report = await generatePnLReport(context, {
  startDate: '2025-01-01',
  endDate: '2025-01-31'
});

console.log(`Revenue: ${report.totalRevenue}`);
console.log(`Expenses: ${report.totalExpenses}`);
console.log(`Net Profit: ${report.netProfit}`);
```

## Revenue Recognition Rules

- Revenue is recognized when order status is `confirmed`
- Only approved/paid expenses are included in P&L
- Revenue and expenses are filtered by tenant
- Module-specific revenue logic handled by module adapters

## Expense Categories

- **operating_expense**: General operating costs
- **salary_expense**: Employee compensation
- **marketing_expense**: Marketing and advertising
- **other_expense**: Miscellaneous expenses

## Tenant Isolation

All finance queries filter by `tenantId` from TenantContext to ensure tenant isolation.

## Integration with Other Services

- Uses `CoreBookingOrder` for order-based revenue
- Uses `PaymentIntent` for payment-based expenses
- Uses `Invoice` contract for invoicing
- Aggregates data across all enabled modules
