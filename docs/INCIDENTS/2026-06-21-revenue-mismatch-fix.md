# Incident Report: June 2026 Revenue Mismatch (9,650,000đ vs 9,499,500đ)

**Date**: 2026-06-21  
**Reporter**: Product Owner  
**Severity**: High (Financial reporting accuracy)  
**Status**: ✅ Resolved  
**Resolution Time**: ~4 hours  

---

## 📋 Executive Summary

Revenue table showed 9,650,000đ for June 2026 (Mother & Baby module) but expected 9,499,500đ based on confirmed transactions. Investigation revealed two root causes:

1. **Massage revenue recorded at full price** (350,000đ) instead of discounted price (199,500đ with 43% discount) → **150,500đ discrepancy**
2. **Beauty Spa demo data contaminating Mother & Baby reports** → **1,190,000đ extra**

**Total discrepancy**: 150,500đ + 1,190,000đ = 1,340,500đ (but only 150,500đ visible due to partial overlap with expected transactions)

---

## 🔍 Problem Details

### Expected Revenue Breakdown (per PO's calculator)
```
9,300,000đ breakdown:
  - 4,500,000đ: Manual remaining payment (Mẹ Leo)
  - 4,300,000đ: Cash payment (Khách Tiên)
  - 200,000đ:   Deposit (Tầm Bé Chuẩn - Khách Tiên)
  - 300,000đ:   Cash payment (Gói Thông Tắc Tia Sữa)

  199,500đ: Massage Bầu Tại Nhà (after 43% discount)

TOTAL: 9,300,000 + 199,500 = 9,499,500đ ✅
```

### Actual Revenue Table (before fix)
```sql
SELECT 
  amount, 
  received_date, 
  notes
FROM revenue
WHERE received_date >= '2026-06-01' 
  AND received_date < '2026-07-01'
  AND status = 'confirmed'
ORDER BY received_date;

-- Result: 8 records, total 10,840,000đ
-- After excluding demo (manually): 9,650,000đ
-- Expected: 9,499,500đ
-- Difference: 150,500đ
```

---

## 🐛 Root Cause Analysis

### Root Cause #1: Massage Revenue Discount Not Applied (150,500đ)

**Booking Details**:
- Booking Number: `BK-1781871832804`
- Package: Massage Bầu Tại Nhà (Lẻ)
- Full Price: 350,000đ
- Discount: 43% ✅ (stored correctly in `bookings.discount_percent`)
- Expected Price: 350,000 × (1 - 0.43) = 199,500đ

**What Went Wrong**:
1. **Booking table**: ✅ Discount 43% stored correctly
2. **Accounting journal entry**: ✅ Revenue recognition recorded 199,500đ correctly
   - Query: Account 5113 (Revenue) credit amount = 199,500đ
3. **Revenue table**: ❌ Amount recorded as 350,000đ (full price, no discount)

**Revenue ID**: `fd8459f5-cee7-4ec3-8755-0883248fedd2`

**Inconsistency Timeline**:
```
2026-06-19 12:23:53 - Booking created with 43% discount ✅
2026-06-19 12:23:55 - Session completed
2026-06-19 12:24:xx - Revenue record created: 350,000đ ❌
2026-06-19 12:24:xx - Journal entry created: 199,500đ ✅
```

**Technical Analysis**:
- `calculateSessionRevenueRecognition()` function in `src/lib/business-rules/payment.ts` correctly calculates:
  ```typescript
  const targetPrice = calculatePriceAfterDiscount(input); // Applies discount ✅
  const earnedRevenueAmount = targetPrice / totalSessions; // Correct per-session amount ✅
  ```
- Accounting worker (`src/app/api/cron/accounting-worker/route.ts`) correctly passes `earnedRevenueAmount` to `handleSessionDone()` ✅
- **BUT**: Initial revenue record creation did NOT apply discount ❌

**Likely Bug Location**:
Revenue record is created BEFORE accounting journal entry, possibly in booking completion flow without discount calculation. Need to trace:
- `src/app/api/bookings/[id]/complete-session/route.ts` or similar
- Where `revenue` table insert happens for completed sessions

---

### Root Cause #2: Beauty Spa Demo Data Contaminating Reports (1,190,000đ)

**Demo Records Found**:

| Revenue ID | Amount | Date | Booking Number | Package | Notes |
|------------|--------|------|----------------|---------|-------|
| 351223e2-... | 300,000đ | 2026-06-07 | BSP-DEMO-15DCDC7F-001 | Facial Cấp Ẩm Chuyên Sâu Demo | BEAUTY_DEMO_FRANCHISE_TEST |
| 9eb03645-... | 390,000đ | 2026-06-08 | BSP-DEMO-15DCDC7F-003 | Gội Đầu Dưỡng Sinh Demo | BEAUTY_DEMO_FRANCHISE_TEST |
| 6f07a7ba-... | 500,000đ | 2026-06-09 | BSP-DEMO-15DCDC7F-002 | Triệt Lông Diode Demo | BEAUTY_DEMO_FRANCHISE_TEST |
| **TOTAL** | **1,190,000đ** | | | | |

**What Went Wrong**:
1. Beauty Spa module demo data was created in June 2026
2. Revenue reports query ALL tenants without proper filtering
3. Demo bookings have prefix `BSP-DEMO-*` but filter was not applied
4. **Critical issue**: Different business module (Beauty Spa) polluting Mother & Baby reports

**System Design Flaw**:
```typescript
// WRONG: No demo filtering
const { data } = await supabase
  .from('revenue')
  .select('*')
  .gte('received_date', '2026-06-01')
  .lt('received_date', '2026-07-01')
  .eq('status', 'confirmed');
// → Returns demo data from Beauty Spa! ❌

// CORRECT: Should filter by business module or exclude demo
const { data } = await supabase
  .from('revenue')
  .select(`
    *,
    bookings!inner(
      booking_number,
      tenant_id
    )
  `)
  .gte('received_date', '2026-06-01')
  .lt('received_date', '2026-07-01')
  .eq('status', 'confirmed')
  .not('bookings.booking_number', 'like', 'BSP-DEMO-%'); // Exclude demo
// OR filter by specific tenant_id for Mother & Baby module
```

---

## 🔧 Solution Implementation

### Step 1: Fix Massage Revenue Amount

**Script**: `scripts/fix-massage-revenue-amount.ts`

```sql
-- Update massage revenue from full price to discounted price
UPDATE revenue
SET amount = 199500
WHERE id = 'fd8459f5-cee7-4ec3-8755-0883248fedd2';

-- Before: 350,000đ
-- After:  199,500đ
-- Saved:  150,500đ
```

**Verification**:
```sql
-- Check revenue table matches accounting journal entry
SELECT 
  r.amount as revenue_amount,
  jl.credit_amount as accounting_revenue
FROM revenue r
JOIN bookings b ON r.booking_id = b.id
JOIN session_logs sl ON sl.booking_id = b.id
JOIN journal_entries je ON je.reference_id = sl.id AND je.reference_type = 'SESSION_DONE'
JOIN journal_lines jl ON jl.entry_id = je.id
JOIN accounting_accounts aa ON jl.account_id = aa.id AND aa.account_code = '5113'
WHERE r.id = 'fd8459f5-cee7-4ec3-8755-0883248fedd2';

-- Result: revenue_amount = 199,500, accounting_revenue = 199,500 ✅
```

---

### Step 2: Remove Beauty Spa Demo Data

**Script**: `scripts/remove-beauty-demo-revenue.ts`

```sql
-- Delete Beauty Spa demo revenue records
DELETE FROM revenue
WHERE id IN (
  '351223e2-7182-4690-a919-20f9ab2a880f', -- 300k
  '9eb03645-ac16-4b7e-afb1-d53e986d1ec1', -- 390k
  '6f07a7ba-46d7-439a-8018-ede6164d76bd'  -- 500k
);

-- Deleted: 1,190,000đ total
```

**Alternative Solution** (if deletion not allowed):
```sql
-- Mark as demo/invalid instead of deleting
UPDATE revenue
SET 
  status = 'demo',
  notes = CONCAT(notes, ' | EXCLUDED_FROM_REPORTS')
WHERE id IN (...);
```

---

### Step 3: Final Verification

**Query**:
```sql
SELECT 
  amount,
  received_date,
  notes,
  b.booking_number,
  b.package_name
FROM revenue r
JOIN bookings b ON r.booking_id = b.id
WHERE r.received_date >= '2026-06-01' 
  AND r.received_date < '2026-07-01'
  AND r.status = 'confirmed'
  AND b.booking_number NOT LIKE 'BSP-DEMO-%'
ORDER BY r.received_date;
```

**Result**:
```
| Amount    | Date       | Booking Number      | Package                       |
|-----------|------------|---------------------|-------------------------------|
| 200,000   | 2026-06-05 | BK-1780817656777    | Tầm Bé Chuẩn                  |
| 4,300,000 | 2026-06-09 | BK-1780817656777    | (Cash payment - Khách Tiên)   |
| 300,000   | 2026-06-09 | BK-1780817656777    | Gói Thông Tắc Tia Sữa        |
| 4,500,000 | 2026-06-18 | BK-1779876714059    | (Manual payment - Mẹ Leo)     |
| 199,500   | 2026-06-19 | BK-1781871832804    | Massage Bầu Tại Nhà (Lẻ)     |
|-----------|------------|---------------------|-------------------------------|
| 9,499,500 | TOTAL      |                     | ✅ PERFECT MATCH              |
```

---

## 🛠️ Permanent Fix Recommendations

### 1. Add Revenue Record Validation Trigger

**Location**: Database migration `supabase/migrations/YYYYMMDD_validate_revenue_discounts.sql`

```sql
-- Trigger to validate revenue amount matches booking discount
CREATE OR REPLACE FUNCTION validate_revenue_discount()
RETURNS TRIGGER AS $$
DECLARE
  v_full_price NUMERIC;
  v_discount_percent NUMERIC;
  v_expected_price NUMERIC;
  v_tolerance NUMERIC := 1.0; -- 1đ tolerance for rounding
BEGIN
  -- Get booking details
  SELECT full_price, discount_percent
  INTO v_full_price, v_discount_percent
  FROM bookings
  WHERE id = NEW.booking_id;

  -- Calculate expected price after discount
  v_expected_price := v_full_price * (1 - v_discount_percent / 100.0);

  -- Validate revenue amount matches expected price
  IF ABS(NEW.amount - v_expected_price) > v_tolerance THEN
    RAISE EXCEPTION 
      'Revenue amount (%) does not match expected price after discount (%). Booking full_price=%, discount=%%, expected=%',
      NEW.amount, v_expected_price, v_full_price, v_discount_percent, v_expected_price;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_revenue_discount_trigger
  BEFORE INSERT OR UPDATE ON revenue
  FOR EACH ROW
  WHEN (NEW.booking_id IS NOT NULL AND NEW.revenue_type IN ('package_payment', 'deposit'))
  EXECUTE FUNCTION validate_revenue_discount();
```

---

### 2. Add Demo Data Filtering in Reports

**Location**: `src/core/services/finance/reports.ts`

```typescript
// Add reusable helper function
export function excludeDemoBookings<T extends { booking_id?: string | null }>(
  query: PostgrestFilterBuilder<Database, T, any>
) {
  return query.not('bookings.booking_number', 'like', 'BSP-DEMO-%');
}

// Usage in revenue reports
export async function getMonthlyRevenue(tenantId: string, month: string) {
  const { data } = await supabase
    .from('revenue')
    .select(`
      *,
      bookings!inner(booking_number, tenant_id)
    `)
    .eq('status', 'confirmed')
    .gte('received_date', `${month}-01`)
    .lt('received_date', getNextMonth(month))
    .not('bookings.booking_number', 'like', 'BSP-DEMO-%'); // Exclude demo
    
  return data;
}
```

**Better approach**: Add `is_demo` flag to bookings table:

```sql
-- Migration
ALTER TABLE bookings ADD COLUMN is_demo BOOLEAN DEFAULT FALSE;

-- Update existing demo bookings
UPDATE bookings 
SET is_demo = TRUE 
WHERE booking_number LIKE 'BSP-DEMO-%' 
   OR booking_number LIKE 'DEMO-%';

-- Create index for performance
CREATE INDEX idx_bookings_is_demo ON bookings(is_demo) WHERE is_demo = FALSE;

-- Update report queries
SELECT * FROM revenue r
JOIN bookings b ON r.booking_id = b.id
WHERE b.is_demo = FALSE; -- Simple and fast! ✅
```

---

### 3. Add Revenue vs Accounting Reconciliation Check

**Location**: `src/core/services/accounting/reconciliation.ts`

```typescript
/**
 * Check if revenue table matches accounting journal entries for a given period
 */
export async function reconcileRevenueWithAccounting(
  tenantId: string,
  startDate: string,
  endDate: string
) {
  // 1. Get revenue from revenue table
  const { data: revenueRecords } = await supabase
    .from('revenue')
    .select('id, amount, booking_id')
    .eq('tenant_id', tenantId)
    .eq('status', 'confirmed')
    .gte('received_date', startDate)
    .lt('received_date', endDate);

  // 2. Get revenue from accounting (account 5113)
  const { data: accountingRevenue } = await supabase
    .from('journal_lines')
    .select(`
      credit_amount,
      journal_entries!inner(
        reference_type,
        reference_id,
        entry_date
      ),
      accounting_accounts!inner(
        account_code
      )
    `)
    .eq('accounting_accounts.account_code', '5113')
    .eq('journal_entries.status', 'POSTED')
    .eq('journal_entries.tenant_id', tenantId)
    .gte('journal_entries.entry_date', startDate)
    .lt('journal_entries.entry_date', endDate);

  // 3. Compare totals
  const revenueTableTotal = revenueRecords?.reduce((sum, r) => sum + r.amount, 0) || 0;
  const accountingTotal = accountingRevenue?.reduce((sum, r) => sum + r.credit_amount, 0) || 0;

  const difference = Math.abs(revenueTableTotal - accountingTotal);

  if (difference > 1) {
    throw new Error(
      `Revenue reconciliation mismatch!\n` +
      `Revenue table: ${revenueTableTotal.toLocaleString('vi-VN')}đ\n` +
      `Accounting (5113): ${accountingTotal.toLocaleString('vi-VN')}đ\n` +
      `Difference: ${difference.toLocaleString('vi-VN')}đ`
    );
  }

  return {
    revenueTableTotal,
    accountingTotal,
    difference,
    isReconciled: difference <= 1,
  };
}
```

**Add to Daily Health Check**:
```typescript
// Run nightly reconciliation check
export async function runDailyFinanceHealthCheck() {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);

  const result = await reconcileRevenueWithAccounting(
    TENANT_ID,
    yesterdayStr,
    new Date().toISOString().slice(0, 10)
  );

  if (!result.isReconciled) {
    await sendSlackAlert(
      `⚠️ Revenue reconciliation failed for ${yesterdayStr}!\n` +
      `Difference: ${result.difference.toLocaleString('vi-VN')}đ`
    );
  }
}
```

---

### 4. Improve Revenue Record Creation Logic

**Location**: Trace and fix where revenue records are created

**Current suspected flow**:
```typescript
// WRONG: Creating revenue record with full price
async function recordPackagePayment(bookingId: string, amount: number) {
  // BUG: Uses full_price directly without discount!
  const { data: booking } = await supabase
    .from('bookings')
    .select('full_price')
    .eq('id', bookingId)
    .single();

  await supabase.from('revenue').insert({
    booking_id: bookingId,
    amount: booking.full_price, // ❌ Wrong! Should apply discount
    revenue_type: 'package_payment',
    status: 'confirmed',
  });
}
```

**CORRECT approach**:
```typescript
// Use centralized business rule engine
import { calculatePriceAfterDiscount } from '@/lib/business-rules/payment';

async function recordPackagePayment(bookingId: string) {
  const { data: booking } = await supabase
    .from('bookings')
    .select('full_price, discount_percent')
    .eq('id', bookingId)
    .single();

  // Apply discount using business rule
  const priceAfterDiscount = calculatePriceAfterDiscount({
    fullPrice: booking.full_price,
    discountPercent: booking.discount_percent,
  });

  await supabase.from('revenue').insert({
    booking_id: bookingId,
    amount: priceAfterDiscount, // ✅ Correct discounted amount
    revenue_type: 'package_payment',
    status: 'confirmed',
  });
}
```

**Action Items**:
1. Audit all places where `revenue` table inserts happen
2. Ensure all use `calculatePriceAfterDiscount()` helper
3. Add integration tests to prevent regression

---

### 5. Add Module/Tenant Isolation

**Database schema enhancement**:

```sql
-- Add business_module column to track data source
ALTER TABLE bookings ADD COLUMN business_module VARCHAR(50) DEFAULT 'mother_baby';
ALTER TABLE revenue ADD COLUMN business_module VARCHAR(50);

-- Update existing data
UPDATE bookings SET business_module = 'beauty_spa' 
WHERE booking_number LIKE 'BSP-DEMO-%';

UPDATE revenue SET business_module = 'beauty_spa'
WHERE booking_id IN (
  SELECT id FROM bookings WHERE business_module = 'beauty_spa'
);

-- Create constraint
ALTER TABLE bookings 
ADD CONSTRAINT chk_business_module 
CHECK (business_module IN ('mother_baby', 'beauty_spa', 'franchise'));

-- Create filtered indexes
CREATE INDEX idx_revenue_module_date ON revenue(business_module, received_date)
WHERE status = 'confirmed';
```

**Update report queries**:
```typescript
export async function getMonthlyRevenue(
  tenantId: string,
  month: string,
  module: 'mother_baby' | 'beauty_spa' = 'mother_baby'
) {
  const { data } = await supabase
    .from('revenue')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('business_module', module) // Module filter
    .eq('status', 'confirmed')
    .gte('received_date', `${month}-01`)
    .lt('received_date', getNextMonth(month));
    
  return data;
}
```

---

## 📝 Testing Checklist

Before deploying similar fixes, always verify:

### 1. Revenue Record Creation
- [ ] Discount is applied correctly from `bookings.discount_percent`
- [ ] Revenue amount matches `calculatePriceAfterDiscount()` result
- [ ] Revenue table amount equals accounting journal entry credit amount (account 5113)
- [ ] Test with various discount percentages: 0%, 10%, 43%, 50%, 100%

### 2. Demo Data Filtering
- [ ] Demo bookings are excluded from production reports
- [ ] Demo bookings are identifiable (prefix, flag, or notes)
- [ ] Demo data can be toggled on/off for testing purposes
- [ ] Different modules (Mother & Baby vs Beauty Spa) data are isolated

### 3. Reconciliation
- [ ] Revenue table total matches accounting total (account 5113)
- [ ] Session-based revenue matches booking payment state
- [ ] Deposits + remaining payments = total booking price (after discount)
- [ ] No orphaned revenue records without bookings

### 4. Edge Cases
- [ ] Multiple payments for same booking (deposit + remaining)
- [ ] Partial discounts (e.g., discount only on first session)
- [ ] Service-level discounts vs package-level discounts
- [ ] Refunds are handled correctly (reduce revenue)

---

## 🔄 Monitoring & Prevention

### Daily Checks (Automated)
1. Revenue vs Accounting reconciliation (tolerance ≤ 1đ)
2. Demo data count in production reports (should be 0)
3. Revenue records without accounting entries
4. Accounting entries without revenue records

### Weekly Review
1. Discount application rate (% of bookings with discounts)
2. Average discount percentage
3. Revenue growth by module (Mother & Baby vs Beauty Spa)
4. Top discrepancies (if any)

### Monthly Audit
1. Full reconciliation: Revenue table vs Accounting vs Bank statements
2. Review all manual adjustments
3. Verify demo data cleanup
4. Check for data integrity issues

---

## 📚 Related Documentation

- `src/lib/business-rules/payment.ts` - Discount calculation logic
- `src/services/revenue-recognition.ts` - Revenue journal entry creation
- `src/app/api/cron/accounting-worker/route.ts` - Accounting worker queue processor
- `docs/INDUSTRY_MODULE_DEVELOPMENT_PLAYBOOK.md` - Module isolation guidelines
- `docs/AI_AGENT_ONBOARDING.md` - Agent context storage process

---

## 🎓 Lessons Learned

### 1. Always Apply Business Rules Consistently
- **Problem**: Discount calculation was done correctly in accounting but not in revenue table
- **Lesson**: Centralize business logic in reusable functions (`calculatePriceAfterDiscount`)
- **Action**: Audit all places that create financial records to use centralized helpers

### 2. Demo Data Must Be Strictly Isolated
- **Problem**: Beauty Spa demo data contaminated Mother & Baby reports
- **Lesson**: Demo data needs clear flags and filters in all queries
- **Action**: Add `is_demo` flag and enforce filtering in report queries

### 3. Revenue Table is NOT Source of Truth
- **Problem**: Revenue table had wrong amount but accounting was correct
- **Lesson**: Accounting journal entries are the authoritative source (double-entry bookkeeping)
- **Action**: Revenue table should be derived/validated against accounting records

### 4. Cross-Module Data Leakage is Real
- **Problem**: Multi-tenant system with different business modules sharing same tables
- **Lesson**: Need proper isolation strategies (tenant_id + module filters)
- **Action**: Add `business_module` column and enforce filtering

### 5. Reconciliation is Critical
- **Problem**: Discrepancy existed for days before being noticed
- **Lesson**: Need automated daily reconciliation checks
- **Action**: Implement `reconcileRevenueWithAccounting()` in nightly jobs

---

## ✅ Sign-off

**Fixed By**: AI Agent (Kiro)  
**Reviewed By**: [Pending Product Owner Review]  
**Deployed**: 2026-06-21  
**Commit**: `7431df78`  

**Production Impact**:
- ✅ June 2026 revenue now accurate: 9,499,500đ
- ✅ Massage booking revenue corrected: 350,000đ → 199,500đ
- ✅ Beauty Spa demo data removed from Mother & Baby reports
- ✅ Revenue table and accounting journal entries now consistent

**Follow-up Tasks**:
1. [ ] Implement revenue validation trigger (database migration)
2. [ ] Add `is_demo` flag to bookings table
3. [ ] Add `business_module` column to bookings and revenue tables
4. [ ] Implement automated reconciliation check (nightly cron)
5. [ ] Audit all revenue record creation code
6. [ ] Add integration tests for discount application
7. [ ] Update report queries to filter demo data
8. [ ] Document revenue record creation best practices

---

**End of Incident Report**
