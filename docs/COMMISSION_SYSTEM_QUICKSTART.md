# ⚡ Commission System - Quick Start Guide

**For:** Developers continuing commission system implementation  
**Time to read:** 5 minutes  
**Prerequisites:** Basic understanding of Bella ERP architecture

---

## 🎯 What's Already Done (MVP)

✅ Database schema (6 migrations)  
✅ Business logic engine (`commission.ts`)  
✅ Salary engine integration  
✅ Settings UI for admin config  
✅ Unit tests (29 tests)  

**What's NOT done:** UI forms for data entry (booking, product sales, adjustments)

---

## 🚀 Quick Start

### Step 1: Run Migrations

```bash
# Make sure you're in the project root
cd /path/to/bella-erp

# Run all 6 migrations
supabase db push

# Or run individually if needed
psql -f supabase/migrations/20260622163000_create_booking_service_items.sql
psql -f supabase/migrations/20260622164000_create_product_sales.sql
psql -f supabase/migrations/20260622165000_create_salary_adjustments.sql
psql -f supabase/migrations/20260622170000_extend_salary_records_commission.sql
psql -f supabase/migrations/20260622171000_extend_users_position_tier.sql
psql -f supabase/migrations/20260622172000_extend_tenants_commission_config.sql
```

### Step 2: Verify Database

```sql
-- Check tables exist
\dt booking_service_items
\dt product_sales
\dt salary_adjustments

-- Check new columns
\d salary_records
\d users
\d tenants
```

### Step 3: Configure Commission Settings

1. Start dev server: `npm run dev`
2. Login as admin
3. Go to Settings → Commission (Beauty Spa) tab
4. Configure commission defaults
5. Save


### Step 4: Test with Sample Data

```sql
-- 1. Insert test service item
INSERT INTO booking_service_items (
  ktv_id, 
  booking_id, 
  tenant_id, 
  service_name,
  quantity, 
  unit_price, 
  subtotal,
  override_commission_type, 
  override_commission_value,
  calculated_commission, 
  status, 
  completed_date
) VALUES (
  (SELECT id FROM users WHERE role = 'ktv' LIMIT 1),
  (SELECT id FROM bookings LIMIT 1),
  (SELECT id FROM tenants LIMIT 1),
  'Test Massage Service',
  1, 
  500000, 
  500000,
  'fixed', 
  150000,
  150000, 
  'completed', 
  '2026-06-15'
);

-- 2. Trigger salary recalculation
-- (via UI: Dashboard → Salary → Recalculate button)

-- 3. Check result
SELECT 
  ktv_id,
  month_year,
  service_commission,
  total_salary
FROM salary_records
WHERE month_year = '2026-06-01'
  AND service_commission > 0;
```

---

## 📂 Key Files to Know

### Business Logic
```
src/lib/business-rules/
├── commission.ts              ← Core commission calculation
├── salary.ts                  ← Salary formula (extended)
└── __tests__/
    └── commission.test.ts     ← Unit tests
```

### Salary Engine
```
src/modules/hr-salary/actions/
└── salary-recalculation-engine.ts  ← Integration point
```

### UI Components
```
src/app/dashboard/
├── settings/
│   └── components/
│       └── CommissionSettingsTab.tsx  ← Admin config
└── salary/
    └── page.tsx                        ← Salary dashboard (TODO: add commission display)
```

### Database
```
supabase/migrations/
├── 20260622163000_create_booking_service_items.sql
├── 20260622164000_create_product_sales.sql
├── 20260622165000_create_salary_adjustments.sql
├── 20260622170000_extend_salary_records_commission.sql
├── 20260622171000_extend_users_position_tier.sql
└── 20260622172000_extend_tenants_commission_config.sql
```


---

## 🔧 Common Tasks

### Task 1: Add Commission to Booking Form

**File:** `src/app/dashboard/bookings/[id]/page.tsx` (or create new)

**Steps:**
1. Read current booking form structure
2. Add "Service Items" section
3. Create `ServiceItemRow` component:
   - Service name input
   - Quantity/price inputs
   - Commission override (type + value)
4. Calculate commission on save
5. Insert into `booking_service_items` table

**Reference:** Check `CommissionSettingsTab.tsx` for commission input UI pattern

### Task 2: Display Commission in Salary Dashboard

**File:** `src/app/dashboard/salary/page.tsx`

**Steps:**
1. Fetch `salary_records` with commission columns
2. Add commission breakdown section:
   - Service commission
   - Product sales commission
   - Position bonus
   - Seniority bonus
   - Manual adjustments
3. Show total calculation formula
4. Add tooltips explaining each component

### Task 3: Create Manual Adjustments UI

**File:** `src/app/dashboard/salary/adjustments/page.tsx` (new)

**Steps:**
1. Create adjustments list page (table)
2. Add "New Adjustment" button
3. Create adjustment modal:
   - KTV selector
   - Month selector
   - Type (bonus/deduction)
   - Amount input
   - Category dropdown
   - Reason textarea
4. Implement approval workflow
5. Show in salary detail

---

## 🧪 Testing Guide

### Run Unit Tests
```bash
# Run all tests
npm test

# Run commission tests only
npm test -- commission.test.ts

# Run with coverage
npm test -- --coverage
```

### Test Commission Calculation Manually

```typescript
import {
  calculateServiceCommission,
  calculatePositionBonus,
} from '@/lib/business-rules/commission';

// Test service commission
const result = calculateServiceCommission({
  subtotal: 500000,
  overrideType: 'fixed',
  overrideValue: 150000,
});
console.log(result); // Should be 150000

// Test position bonus
const bonus = calculatePositionBonus({
  baseCommission: 1000000,
  positionTier: 'senior',
});
console.log(bonus); // Should be 200000 (20% of 1M)
```


---

## 🐛 Troubleshooting

### Issue: TypeScript errors for commission tables

**Error:** `Property 'booking_service_items' does not exist`

**Solution:**
```bash
# Regenerate types after running migrations
supabase gen types typescript --local > src/types/database.types.ts
```

**Temporary workaround:**
```typescript
// Cast to any
const { data } = await (supabase as any)
  .from('booking_service_items')
  .select('*');
```

### Issue: Commission not showing in salary

**Checklist:**
1. ✅ Migrations ran successfully?
2. ✅ Commission data exists in tables?
3. ✅ Status is 'completed'?
4. ✅ Date range correct (within month)?
5. ✅ Salary recalculated after adding commission?

**Debug query:**
```sql
-- Check commission data
SELECT * FROM booking_service_items 
WHERE ktv_id = 'your-ktv-id' 
  AND completed_date >= '2026-06-01' 
  AND completed_date < '2026-07-01';

-- Check salary record
SELECT 
  service_commission,
  product_sales_commission,
  position_bonus,
  seniority_bonus,
  manual_adjustments,
  total_salary
FROM salary_records
WHERE ktv_id = 'your-ktv-id'
  AND month_year = '2026-06-01';
```

### Issue: Commission calculation incorrect

**Steps:**
1. Check commission config in Settings
2. Verify input type (fixed vs percentage)
3. Check position tier (users.position_tier)
4. Check hire date (users.hire_date)
5. Verify manual adjustments status (approved only)

**Debug in console:**
```typescript
// In salary-recalculation-engine.ts, add logs:
console.log('Service commission:', finalServiceCommission);
console.log('Position bonus:', finalPositionBonus);
console.log('Seniority bonus:', finalSeniorityBonus);
console.log('Manual adjustments:', finalManualAdjustments);
console.log('Total salary:', calculatedTotalSalary);
```

---

## 📖 API Reference

### Commission Calculation Functions

```typescript
// Parse commission input
parseCommissionInput(
  type: 'fixed' | 'percentage',
  value: number,
  baseAmount: number
): number

// Calculate service commission
calculateServiceCommission({
  subtotal: number,
  overrideType?: 'fixed' | 'percentage',
  overrideValue?: number,
  defaultType?: 'fixed' | 'percentage',
  defaultValue?: number
}): number

// Calculate position bonus
calculatePositionBonus({
  baseCommission: number,
  positionTier: 'junior' | 'senior' | 'lead',
  multipliers?: { junior: number, senior: number, lead: number }
}): number

// Calculate seniority bonus
calculateSeniorityBonus({
  baseSalary: number,
  hireDate?: Date | string | null,
  bonusRates?: {
    '0_to_1_year': number,
    '1_to_3_years': number,
    '3_to_5_years': number,
    '5_plus_years': number
  }
}): number

// Aggregate manual adjustments
aggregateManualAdjustments({
  adjustments: Array<{
    adjustment_type: 'bonus' | 'deduction',
    amount: number,
    status: string
  }>
}): number
```


---

## 🎓 Learning Resources

### Understanding the Commission System

**Read these in order:**
1. `docs/COMMISSION_SYSTEM_MVP_SUMMARY.md` - Complete overview
2. `src/lib/business-rules/commission.ts` - Business logic implementation
3. `src/lib/business-rules/__tests__/commission.test.ts` - Test examples

### Understanding the Salary System

1. `src/lib/business-rules/salary.ts` - Salary formula
2. `src/modules/hr-salary/actions/salary-recalculation-engine.ts` - Integration
3. `AGENTS.md` - Critical development rules

### Database Schema

```sql
-- Explore commission tables
\d+ booking_service_items
\d+ product_sales
\d+ salary_adjustments

-- See relationships
SELECT
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_name IN ('booking_service_items', 'product_sales', 'salary_adjustments')
  AND tc.constraint_type = 'FOREIGN KEY';
```

---

## 🔗 Related Documentation

- `docs/INDUSTRY_MODULE_DEVELOPMENT_PLAYBOOK.md` - Module development guidelines
- `docs/AI_AGENT_ONBOARDING.md` - Onboarding for new developers
- `AGENTS.md` - Critical development & testing rules
- `README.md` - Project setup and overview

---

## 💬 Getting Help

**Questions about:**
- Business logic → Check `commission.ts` source code + JSDoc
- Database schema → Check migration files
- Testing → Check `commission.test.ts` examples
- UI patterns → Check `CommissionSettingsTab.tsx`

**Still stuck?**
1. Search existing code for similar patterns
2. Check AGENTS.md for development rules
3. Review test cases for usage examples
4. Ask team for clarification

---

## ✅ Next Steps Checklist

After reading this guide, you should be able to:

- [ ] Run migrations successfully
- [ ] Configure commission settings
- [ ] Insert test commission data
- [ ] Verify commission in salary calculation
- [ ] Run unit tests
- [ ] Debug commission issues

**Ready to continue implementation?**

Start with Task 10: Update booking form to add service items input.

---

**Document Version:** 1.0  
**Last Updated:** 2026-06-22  
**Estimated Reading Time:** 5 minutes

_Happy coding! 🚀_
