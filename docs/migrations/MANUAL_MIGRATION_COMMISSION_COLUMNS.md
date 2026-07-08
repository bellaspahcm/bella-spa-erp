# Manual Migration Guide: Add Commission Columns to salary_records

## Issue

User reported product sales commission not showing in salary UI even after:
1. ✅ Configuring 10% commission in settings
2. ✅ Creating product sale with 50,000đ commission
3. ✅ Clicking "Tính Lương" button

**Root Cause:** Database table `salary_records` is missing the new commission columns (`product_sales_commission`, `service_commission`, etc.)

## Solution

Run the migration file to add the columns to production database.

## Migration File

`supabase/migrations/20260622200000_add_commission_columns_to_salary_records.sql`

## How to Apply Migration

### Option 1: Via Supabase Dashboard (Recommended)

1. Open Supabase Dashboard: https://supabase.com/dashboard/project/YOUR_PROJECT_ID
2. Navigate to **SQL Editor**
3. Copy and paste the entire SQL from migration file
4. Click **Run** button
5. Verify success message appears

### Option 2: Via Supabase CLI (Local Docker)

```bash
# Start Docker Desktop first
# Then run:
npx supabase db reset
```

### Option 3: Via psql Command Line

```bash
psql "postgresql://postgres:YOUR_PASSWORD@db.YOUR_PROJECT.supabase.co:5432/postgres" < supabase/migrations/20260622200000_add_commission_columns_to_salary_records.sql
```

## Verification Steps

After running migration, verify columns exist:

```sql
-- Check columns exist
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'salary_records'
  AND column_name IN (
    'service_commission',
    'product_sales_commission',
    'position_bonus',
    'seniority_bonus',
    'manual_adjustments'
  );

-- Should return 5 rows with NUMERIC(12,2) type
```

## Next Steps After Migration

1. **Recalculate Salary**
   - Navigate to `/dashboard/salary`
   - Click "Tính Lương" button for KTV "Quang"
   - System will:
     - Query `product_sales` table
     - Sum `calculated_commission = 50,000đ`
     - Save to `salary_records.product_sales_commission`

2. **Verify Column Appears**
   - Refresh page (Ctrl + Shift + R)
   - Look for "Hoa hồng bán hàng" column in table
   - Should show `+50,000đ` for Quang
   - Column will appear for all KTVs (others show `+0đ`)

3. **View Salary Details**
   - Click "Chi tiết" button on Quang's row
   - Modal should show:
     - "Hoa Hồng Bán Hàng" card with 50,000đ
     - Breakdown: "Sữa tắm DO × 1" = 50,000đ

## Columns Added

| Column Name | Type | Description | Example |
|-------------|------|-------------|---------|
| `service_commission` | NUMERIC(12,2) | Commission from spa services | 150,000đ |
| `product_sales_commission` | NUMERIC(12,2) | Commission from product sales | 50,000đ |
| `position_bonus` | NUMERIC(12,2) | Position multiplier bonus (Junior/Senior/Lead) | 30,000đ |
| `seniority_bonus` | NUMERIC(12,2) | Years-of-service bonus | 300,000đ |
| `manual_adjustments` | NUMERIC(12,2) | Net manual adjustments (bonus - deduction) | -50,000đ |

## Backward Compatibility

- **Existing Records**: All new columns default to `NULL`
- **Baby Care Module**: Columns remain `NULL` (not used)
- **Beauty Spa Module**: Columns populated by `recalculateAndSaveSalaryRecordEngine`

## Data Flow After Migration

```
1. User creates product sale
   ↓
2. System saves to product_sales.calculated_commission = 50,000
   ↓
3. User clicks "Tính Lương"
   ↓
4. recalculateAndSaveSalaryRecordEngine runs:
   - Queries: SELECT SUM(calculated_commission) FROM product_sales WHERE ktv_id = ...
   - Result: 50,000
   - Saves to: salary_records.product_sales_commission = 50,000
   ↓
5. getSalaryData fetches salary_records (with new columns)
   ↓
6. buildSalaryDisplayComponents returns productSalesCommission = 50,000
   ↓
7. SalaryTable conditional check: some(s => s.productSalesCommission > 0) = true
   ↓
8. Column "Hoa hồng bán hàng" appears in UI
   ↓
9. Cell shows: +50,000đ for Quang
```

## Troubleshooting

### Issue: Column still not showing after migration

**Check 1: Migration applied successfully**
```sql
\d salary_records
-- Look for product_sales_commission column
```

**Check 2: Salary record exists**
```sql
SELECT id, ktv_id, month_year, product_sales_commission
FROM salary_records
WHERE ktv_id = (SELECT id FROM users WHERE full_name = 'Quang')
  AND month_year = '2026-06-01';
```

**Check 3: Product sale recorded**
```sql
SELECT id, product_name, quantity, calculated_commission
FROM product_sales
WHERE ktv_id = (SELECT id FROM users WHERE full_name = 'Quang')
  AND sale_date >= '2026-06-01'
  AND sale_date < '2026-07-01';
```

**Check 4: Recalculation engine ran**
- Look for `product_sales_commission` value in query result above
- If NULL, click "Tính Lương" again
- Check console for errors

### Issue: Value is 0 instead of 50,000

**Possible causes:**
1. Product sale `status` is not 'completed'
2. `calculated_commission` in `product_sales` table is 0
3. Date range mismatch (product sale outside current month)

**Fix:**
```sql
-- Update product sale status
UPDATE product_sales
SET status = 'completed'
WHERE id = 'YOUR_SALE_ID';

-- Then click "Tính Lương" again
```

## Related Files

- Migration: `supabase/migrations/20260622200000_add_commission_columns_to_salary_records.sql`
- Salary Engine: `src/modules/hr-salary/actions/salary-recalculation-engine.ts`
- Display Logic: `src/lib/business-rules/salary.ts` (buildSalaryDisplayComponents)
- Data Fetching: `src/modules/hr-salary/actions/query-salary-actions.ts` (getSalaryData)
- UI Table: `src/app/dashboard/salary/components/SalaryTable.tsx`
- UI Modal: `src/components/salary/SalaryDetailModal.tsx`

## Implementation Date

June 22, 2026
