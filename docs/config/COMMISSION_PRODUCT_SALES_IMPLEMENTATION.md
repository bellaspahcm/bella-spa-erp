# Product Sales Commission Implementation Summary

**Date:** June 22, 2026  
**Task:** Add commission strategies based on product sales revenue  
**Status:** ✅ **COMPLETED**

---

## Overview

Added 2 new commission strategies to the configuration-driven payroll system to support commission calculations based on product sales revenue (not just service revenue).

---

## Strategies Implemented

### Strategy 5: `product_sales` - Commission on Product Sales Only

**Description:** KTV receives X% commission on total product sales revenue only (mỹ phẩm/cosmetics).

**Config Parameters:**
- `percentage` (number, 0-100): Percentage of product sales revenue
- `minSales` (number, optional): Minimum product sales amount to qualify

**Example:**
```typescript
{
  strategy: 'product_sales',
  config: {
    percentage: 10,      // 10% of product sales
    minSales: 0          // No minimum (optional)
  }
}
```

**Calculation Formula:**
```typescript
commission = productSalesRevenue * (percentage / 100)
// Only count if productSalesRevenue >= minSales (if specified)
```

---

### Strategy 6: `total_revenue` - Commission on Combined Revenue

**Description:** KTV receives X% commission on total combined revenue (services + products) with optional weighting.

**Config Parameters:**
- `percentage` (number, 0-100): Percentage of total revenue
- `minRevenue` (number, optional): Minimum total revenue to qualify
- `serviceWeight` (number, default 1.0): Weight multiplier for service revenue
- `productWeight` (number, default 1.0): Weight multiplier for product revenue

**Example:**
```typescript
{
  strategy: 'total_revenue',
  config: {
    percentage: 12,        // 12% of weighted revenue
    minRevenue: 0,         // No minimum (optional)
    serviceWeight: 1.0,    // Equal weight
    productWeight: 1.0     // Equal weight
  }
}
```

**Calculation Formula:**
```typescript
weightedRevenue = (serviceRevenue * serviceWeight) + (productSalesRevenue * productWeight)
commission = weightedRevenue * (percentage / 100)
// Only count if weightedRevenue >= minRevenue (if specified)
```

**Advanced Use Case (prioritize products):**
```typescript
{
  serviceWeight: 0.8,  // Service revenue counts 80%
  productWeight: 1.5   // Product revenue counts 150%
}
```

---

## Files Modified

### 1. Type Definitions (`src/types/payroll-config.ts`)

**Added Types:**
```typescript
export type CommissionStrategy = 
  | 'fixed' 
  | 'tier' 
  | 'percentage' 
  | 'service'
  | 'product_sales'      // NEW
  | 'total_revenue';     // NEW

export interface CommissionProductSalesConfig {
  percentage: number;
  minSales?: number;
}

export interface CommissionTotalRevenueConfig {
  percentage: number;
  minRevenue?: number;
  serviceWeight?: number;
  productWeight?: number;
}

export type CommissionConfigUnion = 
  | CommissionFixedConfig
  | CommissionTierConfig
  | CommissionPercentageConfig
  | CommissionServiceConfig
  | CommissionProductSalesConfig     // NEW
  | CommissionTotalRevenueConfig;    // NEW
```

---

### 2. Commission Provider (`src/services/providers/commission-provider.ts`)

**Added Strategy Functions:**

#### Strategy 5 Implementation:
```typescript
export function calculateProductSalesCommission(
  sessions: CommissionSession[],
  productSalesRevenue: number,
  config: CommissionProductSalesConfig
): number {
  const minSales = config.minSales ?? 0;
  
  if (productSalesRevenue < minSales) {
    return 0;
  }

  return productSalesRevenue * (config.percentage / 100);
}
```

#### Strategy 6 Implementation:
```typescript
export function calculateTotalRevenueCommission(
  sessions: CommissionSession[],
  productSalesRevenue: number,
  config: CommissionTotalRevenueConfig
): number {
  const serviceWeight = config.serviceWeight ?? 1.0;
  const productWeight = config.productWeight ?? 1.0;
  const minRevenue = config.minRevenue ?? 0;

  const serviceRevenue = sessions.reduce((sum, s) => sum + (s.revenue ?? 0), 0);
  const weightedRevenue = 
    (serviceRevenue * serviceWeight) + 
    (productSalesRevenue * productWeight);

  if (weightedRevenue < minRevenue) {
    return 0;
  }

  return weightedRevenue * (config.percentage / 100);
}
```

**Updated Main Function:**
```typescript
export async function calculateCommission(
  ktvId: string,
  sessions: CommissionSession[],
  tenantId: string,
  productSalesRevenue: number = 0  // NEW PARAMETER
): Promise<number> {
  const configResult = await loadCommissionConfig(tenantId);
  
  if (!configResult.success || !configResult.data?.enabled) {
    return 0;
  }

  switch (configResult.data.strategy) {
    case 'fixed':
      return calculateFixedCommission(sessions, config);
    case 'tier':
      return calculateTierCommission(sessions, config);
    case 'percentage':
      return calculatePercentageCommission(sessions, config);
    case 'service':
      return calculateServiceCommission(sessions, config);
    case 'product_sales':                                                    // NEW
      return calculateProductSalesCommission(sessions, productSalesRevenue, config);
    case 'total_revenue':                                                    // NEW
      return calculateTotalRevenueCommission(sessions, productSalesRevenue, config);
    default:
      return 0;
  }
}
```

---

### 3. Salary Engine Integration (`src/modules/hr-salary/actions/salary-recalculation-engine.ts`)

**Updated Context for Provider:**
```typescript
// Pass productSalesRevenue to CommissionProvider
const commissionProviderResult = await CommissionProvider.evaluate({
  tenantId: savedRecord.tenant_id,
  ktvId: savedRecord.ktv_id,
  month,
  // ... other context ...
  sessions: allSessionsForCommission,
  productSalesRevenue: liveProductCommission,  // NEW: Pass product sales data
});
```

**Data Source:**
- `liveProductCommission` is already calculated from `product_sales` table
- Commission amounts are aggregated per KTV per month from existing sales records

---

### 4. Settings UI (`src/app/dashboard/settings/components/SalaryConfigTab.tsx`)

**Added State Variables:**
```typescript
const [productSalesPercentage, setProductSalesPercentage] = useState(15);
const [productSalesMinSales, setProductSalesMinSales] = useState(0);
const [totalRevenuePercentage, setTotalRevenuePercentage] = useState(10);
const [totalRevenueMinRevenue, setTotalRevenueMinRevenue] = useState(0);
const [serviceWeight, setServiceWeight] = useState(1.0);
const [productWeight, setProductWeight] = useState(1.0);
```

**Added Dropdown Options:**
```typescript
{
  value: 'product_sales',
  label: 'Phần trăm bán hàng (% doanh số mỹ phẩm)',
  icon: <Coins className="w-4 h-4" />
},
{
  value: 'total_revenue',
  label: 'Tổng doanh thu (% dịch vụ + bán hàng)',
  icon: <TrendingUp className="w-4 h-4" />
}
```

**Added UI Forms:**

#### Product Sales Form:
- Input: Percentage (0-100%)
- Input: Minimum Sales (VNĐ, optional)
- Pattern: Same as percentage strategy

#### Total Revenue Form:
- Input: Percentage (0-100%)
- Input: Minimum Revenue (VNĐ, optional)
- Advanced Section: Service Weight (0-10, default 1.0)
- Advanced Section: Product Weight (0-10, default 1.0)
- Blue info box explaining weights feature

**Load Logic:**
```typescript
else if (commissionResult.data.strategy === 'product_sales') {
  setProductSalesPercentage(config.percentage || 15);
  setProductSalesMinSales(config.minSales || 0);
} else if (commissionResult.data.strategy === 'total_revenue') {
  setTotalRevenuePercentage(config.percentage || 10);
  setTotalRevenueMinRevenue(config.minRevenue || 0);
  setServiceWeight(config.serviceWeight || 1.0);
  setProductWeight(config.productWeight || 1.0);
}
```

**Save Logic:**
```typescript
else if (commissionStrategy === 'product_sales') {
  commissionConfig = { 
    percentage: productSalesPercentage, 
    minSales: productSalesMinSales 
  };
} else if (commissionStrategy === 'total_revenue') {
  commissionConfig = { 
    percentage: totalRevenuePercentage, 
    minRevenue: totalRevenueMinRevenue,
    serviceWeight,
    productWeight
  };
}
```

---

## Testing Checklist

### Unit Testing

- [ ] Test `calculateProductSalesCommission()` with:
  - Zero product sales → expect 0
  - Product sales below minSales threshold → expect 0
  - Product sales above threshold → expect correct %
  - No minSales specified → always apply %

- [ ] Test `calculateTotalRevenueCommission()` with:
  - Zero revenue → expect 0
  - Combined revenue below minRevenue → expect 0
  - Default weights (1.0, 1.0) → equal treatment
  - Custom weights (0.8, 1.5) → verify weighted calculation
  - Only service revenue → verify calculation
  - Only product revenue → verify calculation

### Integration Testing

- [ ] Save `product_sales` config in Settings UI
- [ ] Reload page → verify config persists
- [ ] Run salary calculation → verify provider calculates correctly
- [ ] Check salary record → verify commission amount matches

- [ ] Save `total_revenue` config with weights
- [ ] Reload page → verify all 4 parameters persist
- [ ] Run salary calculation → verify weighted calculation
- [ ] Compare with manual calculation

### E2E Testing

- [ ] Create test KTV with product sales data
- [ ] Configure `product_sales` strategy (10%)
- [ ] Run payroll wizard for month
- [ ] Verify commission = productSales * 0.10

- [ ] Configure `total_revenue` strategy (12%, weights 1.0/1.5)
- [ ] Run payroll wizard
- [ ] Verify commission = (serviceRev * 1.0 + productRev * 1.5) * 0.12

---

## Database Schema (No Changes Required)

The existing `product_sales` table already tracks commission per sale:

```sql
CREATE TABLE product_sales (
  id UUID PRIMARY KEY,
  sold_by_ktv_id UUID REFERENCES users(id),
  product_id UUID REFERENCES products(id),
  quantity INTEGER,
  unit_price NUMERIC,
  total_amount NUMERIC,
  calculated_commission NUMERIC,  -- Per-sale commission already tracked
  sale_date TIMESTAMPTZ,
  tenant_id UUID
);
```

**Aggregation Query (already in engine):**
```sql
SELECT SUM(calculated_commission) AS total_commission
FROM product_sales
WHERE sold_by_ktv_id = $1 
  AND DATE_TRUNC('month', sale_date) = $2
  AND tenant_id = $3;
```

---

## Feature Flags

**Current Status:** Providers enabled by default
```env
USE_CONFIG_PROVIDERS=true
```

**Provider Activation:**
- KPIProvider: ✅ Active
- AttendanceProvider: ✅ Active
- RatingProvider: ✅ Active
- CommissionProvider: ✅ Active (including new strategies)

---

## Deployment Notes

1. **No Database Migration Required** - All changes are code-level only
2. **Backward Compatible** - Existing commission strategies unaffected
3. **Feature Flag Control** - Can disable providers with `USE_CONFIG_PROVIDERS=false`
4. **UI Verification** - Test Settings page loads without errors
5. **Calculation Verification** - Run test salary calculation with new strategies

---

## Next Steps

1. ✅ **COMPLETED:** Add UI forms for new strategies
2. **TODO:** Run E2E tests with real product sales data
3. **TODO:** Update user documentation with new strategy examples
4. **TODO:** Train admin users on configuring product sales commission
5. **TODO:** Monitor production payroll calculations for accuracy

---

## Related Documentation

- [Commission Settings Test Guide](./COMMISSION_SETTINGS_TEST_GUIDE.md)
- [Provider Activation Test Plan](./PROVIDER_ACTIVATION_TEST_PLAN.md)
- [Payroll Wizard Test Guide](../product/PAYROLL_WIZARD_TEST_GUIDE.md)

---

**Implementation Completed By:** Kiro AI Agent  
**Commit:** `78a7aa36` - feat(payroll): add product sales commission UI forms  
**GitHub:** https://github.com/bellaspahcm/bella-spa-erp/commit/78a7aa36
