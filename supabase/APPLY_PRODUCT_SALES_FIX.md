# Apply Product Sales Commission Fix

## Problem

The salary reconciliation screen does NOT show `product_sales_commission` column even though:
- ✅ Database column exists (`salary_records.product_sales_commission`)
- ✅ `calculate_ktv_salary_sheet` RPC returns the column
- ❌ `get_salary_reconciliation_report` RPC does NOT return the column

**Result:** UI shows "Kế toán chốt" and "AI tính" but MISSING product sales commission breakdown.

---

## Solution

Apply migration `20260709000000_complete_product_sales_reconciliation_fix.sql` which updates `get_salary_reconciliation_report` to include `product_sales_commission` in both legacy and AI columns.

---

## How to Apply

### Option 1: Using Supabase CLI (Recommended)

```bash
# Push the new migration
supabase db push

# This will apply:
# - migrations/20260709000000_complete_product_sales_reconciliation_fix.sql
```

### Option 2: Using Supabase Dashboard

1. Go to **Supabase Dashboard** → Your Project
2. Click **SQL Editor** in left sidebar
3. Copy entire content of `supabase/migrations/20260709000000_complete_product_sales_reconciliation_fix.sql`
4. Paste into SQL Editor
5. Click **Run** (or press Ctrl+Enter)
6. Wait for success message

---

## Verification

After applying the migration, verify the fix:

### 1. Check RPC exists

```sql
-- Run in Supabase SQL Editor
SELECT routine_name, routine_type 
FROM information_schema.routines 
WHERE routine_name = 'get_salary_reconciliation_report'
  AND routine_schema = 'public';

-- Expected: 1 row with routine_type = 'FUNCTION'
```

### 2. Check return columns

```sql
-- Run in Supabase SQL Editor
SELECT 
    parameter_name,
    data_type,
    ordinal_position
FROM information_schema.parameters
WHERE specific_schema = 'public'
  AND specific_name LIKE 'get_salary_reconciliation_report%'
  AND parameter_mode = 'OUT'
ORDER BY ordinal_position;

-- Expected: 18 columns including 'legacy_product_sales_commission' and 'ai_product_sales_commission'
```

### 3. Test with real data

```sql
-- Run in Supabase SQL Editor (replace with your tenant_id and month)
SELECT 
    ktv_name,
    legacy_product_sales_commission,
    ai_product_sales_commission,
    legacy_total,
    ai_total
FROM public.get_salary_reconciliation_report(
    'your-tenant-id-here'::UUID,
    '2026-07-01'::DATE
)
LIMIT 5;

-- Expected: Columns should show values (0 if no product sales, or actual commission amounts)
```

---

## Expected UI Changes

After migration + UI refresh:

### Before Fix

**Reconciliation Table:**
- Lương cơ bản (Base salary) ✅
- Hoa hồng ca (Session bonus) ✅
- KPI bonus ✅
- Khấu trừ (Deductions) ✅
- **Hoa hồng bán hàng (Product sales)** ❌ MISSING

### After Fix

**Reconciliation Table:**
- Lương cơ bản (Base salary) ✅
- Hoa hồng ca (Session bonus) ✅
- KPI bonus ✅
- **Hoa hồng bán hàng (Product sales)** ✅ NOW VISIBLE
- Khấu trừ (Deductions) ✅

**Columns will show:**
- `legacy_product_sales_commission` (Kế toán chốt)
- `ai_product_sales_commission` (AI tính)
- Both values included in `legacy_total` and `ai_total`

---

## Rollback (if needed)

If something goes wrong, rollback to previous version:

```sql
-- This will revert to the version WITHOUT product_sales_commission in reconciliation
-- (calculate_ktv_salary_sheet will still have it, just reconciliation report won't show it)

-- Option 1: Restore from backup (recommended)
-- Use Supabase Dashboard → Database → Point-in-time Recovery

-- Option 2: Manually drop and recreate old version (NOT recommended unless you have the SQL)
```

---

## Migration History

- **2026-06-23**: `20260623000000_fix_salary_reconciliation_product_sales.sql`
  - Updated `calculate_ktv_salary_sheet` to include product_sales_commission
  - ❌ Did NOT update `get_salary_reconciliation_report`
  
- **2026-07-09**: `20260709000000_complete_product_sales_reconciliation_fix.sql`
  - ✅ Updates `get_salary_reconciliation_report` to include product_sales_commission
  - ✅ Completes the fix for UI display

---

## Related Files

- **Migration:** `supabase/migrations/20260709000000_complete_product_sales_reconciliation_fix.sql`
- **Original incomplete fix:** `supabase/migrations/20260623000000_fix_salary_reconciliation_product_sales.sql`
- **Manual run script:** `supabase/RUN_THIS_FIX_PRODUCT_SALES_IN_RECONCILIATION.sql` (now superseded by migration)
- **UI component:** `src/app/dashboard/accounting/salary-reconciliation/page.tsx`

---

## Status

- [ ] Migration created: ✅ YES (`20260709000000_complete_product_sales_reconciliation_fix.sql`)
- [ ] Migration applied to database: ⏳ PENDING (you need to run this)
- [ ] UI verified: ⏳ PENDING (after migration)

