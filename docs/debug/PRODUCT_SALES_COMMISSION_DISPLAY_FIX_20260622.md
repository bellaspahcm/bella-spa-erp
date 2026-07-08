# Product Sales Commission Display Fix - June 22, 2026

## Issue Report

**User Feedback:**
> "ở đây đã cập nhật hoa hồng bán hàng theo % nhưng trong chi tiết lương chưa thấy ghi nhận"

User configured product sales commission (10% percentage-based) in settings and created a product sale, but the commission did not appear in the salary details modal.

## Root Cause Analysis

### ✅ Backend Logic Was Correct

1. **createProductSale** (`src/modules/product-sales/actions/product-sales-actions.ts`)
   - ✅ Correctly calculates `calculated_commission` using `calculateProductSalesCommission()`
   - ✅ Saves to `product_sales.calculated_commission` column in database
   
2. **recalculateAndSaveSalaryRecordEngine** (`src/modules/hr-salary/actions/salary-recalculation-engine.ts`)
   - ✅ Queries `product_sales` table filtering by `ktv_id`, `tenant_id`, `status='completed'`
   - ✅ Sums `calculated_commission` into `liveProductCommission`
   - ✅ Saves to `salary_records.product_sales_commission` column
   
3. **calculateSalaryTotal** (`src/lib/business-rules/salary.ts`)
   - ✅ Includes `productSalesCommission` in total salary calculation
   - ✅ Formula: `baseSalary + ... + productSalesCommission + ... - deductions - advances`

### ❌ Display Layer Was Broken

4. **SalaryDetailModal.tsx** (`src/components/salary/SalaryDetailModal.tsx`)
   - ❌ **Line 211**: Hardcoded `amount={0}` instead of reading from data
   - ❌ **Line 208**: TODO comment: "Product sales commission not yet tracked in salary_records table"
   - This was outdated — the backend was already tracking it!

5. **buildSalaryDisplayComponents** (`src/lib/business-rules/salary.ts`)
   - ❌ Did not accept `liveProductSalesCommission` as input
   - ❌ Did not select saved or live commission based on salary record status
   - ❌ Did not return `productSalesCommission` in output object

6. **getSalaryData** (`src/modules/hr-salary/actions/query-salary-actions.ts`)
   - ❌ Did not pass commission values to `buildSalaryDisplayComponents`
   - ❌ Did not map commission fields from `salaryDisplay` to `KtvSalaryRecord` return object

7. **KtvSalaryRecord type** (`src/types/domain.ts`)
   - ❌ Missing TypeScript types for commission fields

## Solution Implemented

### 1. Update Type Definitions

**File:** `src/types/domain.ts`

Added advanced commission fields to `KtvSalaryRecord` interface:

```typescript
export interface KtvSalaryRecord {
  // ... existing fields ...
  // Advanced commission system (Task 28-32)
  serviceCommission?: number;
  productSalesCommission?: number;
  positionBonus?: number;
  seniorityBonus?: number;
  manualAdjustments?: number;
}
```

### 2. Update Display Logic

**File:** `src/lib/business-rules/salary.ts`

#### Updated `SalaryDisplayComponentsInput` type:

```typescript
export type SalaryDisplayComponentsInput = {
  // ... existing fields ...
  // Advanced commission components (Task 28-32)
  liveServiceCommission?: number | string | null;
  liveProductSalesCommission?: number | string | null;
  livePositionBonus?: number | string | null;
  liveSeniorityBonus?: number | string | null;
  liveManualAdjustments?: number | string | null;
};
```

#### Updated `buildSalaryDisplayComponents` function:

```typescript
export function buildSalaryDisplayComponents(input: SalaryDisplayComponentsInput) {
  // ... existing logic ...
  
  // Advanced commission components (Task 28-32)
  const serviceCommission = selectSavedOrLive(
    useSavedFinancials,
    (record as any)?.service_commission,
    input.liveServiceCommission
  );
  const productSalesCommission = selectSavedOrLive(
    useSavedFinancials,
    (record as any)?.product_sales_commission,
    input.liveProductSalesCommission
  );
  // ... position, seniority, manual adjustments ...
  
  const calculatedTotalSalary = calculateSalaryTotal({
    baseSalary,
    sessionBonus,
    ratingBonus,
    kpiBonus,
    deductions,
    advances,
    serviceCommission,
    productSalesCommission,
    positionBonus,
    seniorityBonus,
    manualAdjustments,
  });
  
  return {
    // ... existing fields ...
    serviceCommission,
    productSalesCommission,
    positionBonus,
    seniorityBonus,
    manualAdjustments,
    // ...
  };
}
```

**Key Logic:**
- Uses `selectSavedOrLive()` helper to choose between saved record values (for non-draft) or live calculated values (for draft)
- Passes all commission components to `calculateSalaryTotal()`
- Returns commission fields in output object

### 3. Update Data Fetching

**File:** `src/modules/hr-salary/actions/query-salary-actions.ts`

#### Updated `getSalaryData` function:

```typescript
const salaryDisplay = buildSalaryDisplayComponents({
  record,
  liveSessionsCount,
  liveSessionBonus,
  liveRatingBonus,
  liveBaseSalary,
  liveKpiBonus: kpiBonusByKtv.get(ktv.id) ?? 0,
  liveDeductions: autoAttendancePenalty,
  liveAdvances: 0,
  // Advanced commission components (Task 28-32) - will be queried and added later
  liveServiceCommission: 0,
  liveProductSalesCommission: 0,
  livePositionBonus: 0,
  liveSeniorityBonus: 0,
  liveManualAdjustments: 0,
});

return {
  id: ktv.id,
  name: ktv.full_name || '',
  // ... existing fields ...
  // Advanced commission components (Task 28-32)
  serviceCommission: salaryDisplay.serviceCommission,
  productSalesCommission: salaryDisplay.productSalesCommission,
  positionBonus: salaryDisplay.positionBonus,
  seniorityBonus: salaryDisplay.seniorityBonus,
  manualAdjustments: salaryDisplay.manualAdjustments,
};
```

**Note:** Currently passing `0` for live commission values. A future enhancement would query `product_sales` and `booking_service_items` tables here to calculate live values for draft records. For now, the system relies on saved values from `salary_records` table (which are populated by `recalculateAndSaveSalaryRecordEngine`).

### 4. Update UI Display

**File:** `src/components/salary/SalaryDetailModal.tsx`

#### Before (BROKEN):

```tsx
{/* TODO: Product sales commission not yet tracked in salary_records table */}
<SalaryComponentCard
  title="Hoa Hồng Bán Hàng"
  amount={0}  // ❌ HARDCODED ZERO
  icon={<TrendingUp className="w-5 h-5 text-gray-400" />}
  variant="neutral"
  tooltip="Hoa hồng từ bán sản phẩm (chưa có dữ liệu)"
  badge="Chưa có dữ liệu"
>
  <div className="text-sm text-gray-500 dark:text-gray-400 py-2">
    Tính năng đang được phát triển
  </div>
</SalaryComponentCard>
```

#### After (FIXED):

```tsx
{/* Product Sales Commission */}
{(salary.productSalesCommission || 0) > 0 && (
  <SalaryComponentCard
    title="Hoa Hồng Bán Hàng"
    amount={salary.productSalesCommission || 0}  // ✅ READS FROM DATA
    icon={<TrendingUp className="w-5 h-5 text-emerald-600" />}
    variant="income"
    tooltip="Hoa hồng từ bán sản phẩm"
  >
    {productSales.length > 0 && (
      <div className="mt-3 space-y-2 border-t border-gray-200 dark:border-gray-700 pt-3">
        <p className="text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
          Chi Tiết Bán Hàng
        </p>
        {isLoadingProducts ? (
          <p className="text-sm text-gray-500">Đang tải...</p>
        ) : (
          <div className="space-y-1.5">
            {productSales.map((product, index) => (
              <div key={index} className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-300 py-1 border-b border-gray-100 dark:border-gray-800 last:border-0">
                <span className="flex-1 truncate">
                  {product.product_name} × {product.quantity}
                </span>
                <span className="font-medium text-emerald-600">
                  {product.calculated_commission.toLocaleString('vi-VN')} đ
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    )}
  </SalaryComponentCard>
)}
```

**Key Changes:**
- ✅ Reads `salary.productSalesCommission` from prop (no longer hardcoded)
- ✅ Only shows card if `productSalesCommission > 0` (conditional rendering)
- ✅ Fetches `product_sales` data via `useEffect` to display breakdown
- ✅ Shows line-item details: product name, quantity, individual commission
- ✅ Uses `variant="income"` with green color to indicate positive income
- ✅ Loading state while fetching product sales data

## Testing Checklist

### Unit Testing

- [ ] `buildSalaryDisplayComponents` returns commission fields
- [ ] `getSalaryData` maps commission fields to return object
- [ ] `calculateSalaryTotal` includes all commission components

### Integration Testing

1. **Create Product Sale**
   - [ ] Navigate to `/dashboard/product-sales`
   - [ ] Click "Thêm Bán Hàng"
   - [ ] Select KTV, product, quantity
   - [ ] Configure commission override (e.g., 10% percentage)
   - [ ] Verify `calculated_commission` is saved to database
   - [ ] Check `product_sales` table in Supabase dashboard

2. **Recalculate Salary**
   - [ ] Navigate to `/dashboard/admin/salary`
   - [ ] Click "Tính Lương" for the KTV who made the sale
   - [ ] Verify `product_sales_commission` is saved to `salary_records` table
   - [ ] Check total salary includes commission amount

3. **View Salary Details**
   - [ ] Click "Chi Tiết" on salary row
   - [ ] Verify "Hoa Hồng Bán Hàng" card appears (not hidden)
   - [ ] Verify amount matches saved `product_sales_commission`
   - [ ] Verify breakdown shows individual product sales
   - [ ] Check format: "Product Name × Quantity" with commission amount
   - [ ] Verify green color (income variant) is applied

### Edge Cases

- [ ] Draft salary: Should show commission if products sold this month
- [ ] Published salary: Should show saved commission from `salary_records`
- [ ] No product sales: Card should not appear (conditional rendering)
- [ ] Multiple products: All should appear in breakdown list
- [ ] Large commission amounts: Number formatting works (`toLocaleString`)

## Data Flow Summary

```
1. Admin creates product sale
   ↓
2. createProductSale calculates commission
   ↓
3. Saves to product_sales.calculated_commission
   ↓
4. Admin clicks "Tính Lương"
   ↓
5. recalculateAndSaveSalaryRecordEngine queries product_sales
   ↓
6. Sums calculated_commission
   ↓
7. Saves to salary_records.product_sales_commission
   ↓
8. getSalaryData fetches salary_records
   ↓
9. buildSalaryDisplayComponents selects saved or live value
   ↓
10. Maps to KtvSalaryRecord.productSalesCommission
   ↓
11. SalaryDetailModal.tsx reads from salary prop
   ↓
12. Displays in UI with breakdown
```

## Related Files

### Backend
- `src/modules/product-sales/actions/product-sales-actions.ts` - Product sale creation
- `src/modules/hr-salary/actions/salary-recalculation-engine.ts` - Salary calculation engine
- `src/lib/business-rules/commission.ts` - Commission calculation logic
- `src/lib/business-rules/salary.ts` - Salary display logic

### Database
- `supabase/migrations/20260622164000_create_product_sales.sql` - Table schema
- `product_sales` table - Stores product sales and commissions
- `salary_records` table - Stores calculated salaries

### Frontend
- `src/components/salary/SalaryDetailModal.tsx` - Salary details UI
- `src/modules/hr-salary/actions/query-salary-actions.ts` - Data fetching
- `src/types/domain.ts` - TypeScript type definitions

## Future Enhancements

1. **Live Draft Calculation**
   - Currently `getSalaryData` passes `0` for `liveProductSalesCommission`
   - Should query `product_sales` table and calculate sum for draft records
   - This would show commission immediately without saving salary record first

2. **Service Commission Display**
   - Similar fix needed for `serviceCommission` field
   - Query `booking_service_items` table for line-item breakdown

3. **Position & Seniority Bonuses**
   - Add UI cards for `positionBonus` and `seniorityBonus`
   - Show tier (Junior/Senior/Lead) and years of service

4. **Manual Adjustments Breakdown**
   - Query `salary_adjustments` table
   - Show list of bonus/deduction adjustments with reasons

## Commits

- `2c22d631` - feat(salary): display product sales commission in salary details

## Related Tasks

- Task 28-32: Advanced Commission System
- Task 33: Product Sales Commission Implementation
- Task 34: Service Commission Implementation

## Implementation Date

June 22, 2026
