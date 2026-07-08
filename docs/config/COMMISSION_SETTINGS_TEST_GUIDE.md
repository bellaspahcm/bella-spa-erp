# Commission Settings Test Guide

**Version:** 1.0.0  
**Created:** 2026-06-22  
**Status:** Ready for Testing  
**Related:** Task #8 (Commission Settings UI), Task #9 (CommissionProvider Integration)

## Overview

This guide covers end-to-end testing of the Commission Settings feature, including:
- 4 commission strategies (Fixed, Tier, Percentage, Service)
- Settings UI configuration
- Provider integration in salary calculation engine
- Database persistence and loading

## Pre-requisites

✅ **Environment Setup:**
- `.env.local` has `USE_CONFIG_PROVIDERS=true`
- Dev server running: `npm run dev`
- Database has `tenant_payroll_config` table (migration applied)
- Test tenant with KTVs and completed sessions

✅ **Test Data Requirements:**
- At least 1 KTV with completed sessions this month
- Sessions with different package types (Basic, Happy, VIP)
- Bookings with `ktv_commission` values populated
- Access to Settings page (`/dashboard/settings`)

---

## Test Scenarios

### Scenario 1: Fixed Strategy - Flat Rate Commission

**Goal:** Test fixed rate per session configuration

**Steps:**
1. Navigate to Settings → Salary Configuration
2. Scroll to "Hoa Hồng Ca" (Commission) section
3. Verify toggle is ON (green)
4. Select strategy: **"Cố định (mỗi ca cố định X đồng)"**
5. Enter values:
   - Hoa hồng mỗi ca: `120000` (120k per session)
   - Số ca tối thiểu: `0` (no minimum)
6. Click **"Lưu cấu hình"** button
7. Wait for success toast: "Đã lưu cấu hình lương thành công!"

**Expected Results:**
- ✅ Form saves without errors
- ✅ Toast notification appears
- ✅ Page refresh preserves values (reload page to verify)
- ✅ Database `tenant_payroll_config` has record:
  ```sql
  SELECT * FROM tenant_payroll_config 
  WHERE provider_key = 'commission' 
  AND tenant_id = '<your-tenant-id>';
  ```
  Expected JSON:
  ```json
  {
    "enabled": true,
    "strategy": "fixed",
    "config": {
      "rate": 120000,
      "minSessions": 0
    }
  }
  ```

**Salary Calculation Verification:**
1. Go to Salary page
2. Trigger recalculation (manual recalc button or new month)
3. Check terminal logs for:
   ```
   [PHASE_2_ACTIVE] Commission - Using Provider Result:
   {
     ktvId: '...',
     provider_commission: 360000,  // 3 sessions × 120k
     old_logic_would_be: 450000,   // Sum of bookings.ktv_commission
     strategy: 'fixed',
     sessions: 3
   }
   ```
4. Verify KTV salary record:
   - `session_bonus` = sessions × 120000
   - Example: 3 sessions → 360,000đ

---

### Scenario 2: Tier Strategy - Tiered Session Rates

**Goal:** Test tiered commission based on session count ranges

**Steps:**
1. Navigate to Settings → Commission section
2. Select strategy: **"Bậc thang (0-10ca→100k, 11-20ca→120k)"**
3. Configure tiers:
   | Từ ca | Đến ca | Hoa hồng (VNĐ) |
   |-------|--------|----------------|
   | 0     | 10     | 100000         |
   | 11    | 20     | 120000         |
   | 21    | 999    | 150000         |
4. Click **"Lưu cấu hình"**

**Expected Results:**
- ✅ Tier rows display correctly
- ✅ Can add/remove tiers dynamically
- ✅ Database stores tier array:
  ```json
  {
    "enabled": true,
    "strategy": "tier",
    "config": {
      "tiers": [
        {"min": 0, "max": 10, "rate": 100000},
        {"min": 11, "max": 20, "rate": 120000},
        {"min": 21, "max": 999, "rate": 150000}
      ]
    }
  }
  ```

**Salary Calculation Verification:**
Test with KTVs at different session counts:

| Sessions | Expected Commission | Calculation |
|----------|---------------------|-------------|
| 5        | 500,000đ            | 5 × 100k (tier 1) |
| 15       | 1,800,000đ          | 15 × 120k (tier 2) |
| 25       | 3,750,000đ          | 25 × 150k (tier 3) |

Check logs:
```
[PHASE_2_ACTIVE] Commission - Using Provider Result:
{
  provider_commission: 1800000,
  strategy: 'tier',
  sessions: 15
}
```

---

### Scenario 3: Percentage Strategy - Revenue-Based Commission

**Goal:** Test percentage of service revenue

**Steps:**
1. Select strategy: **"Phần trăm doanh thu (% giá trị booking)"**
2. Enter values:
   - Phần trăm doanh thu: `15` (15%)
   - Doanh thu tối thiểu: `0` (no minimum)
3. Click **"Lưu cấu hình"**

**Expected Results:**
- ✅ Database stores:
  ```json
  {
    "enabled": true,
    "strategy": "percentage",
    "config": {
      "percentage": 15,
      "minRevenue": 0
    }
  }
  ```

**Salary Calculation Verification:**
Assume KTV has 3 sessions with total revenue = 3,000,000đ:
- Expected commission: 3,000,000 × 15% = **450,000đ**

Check logs:
```
[PHASE_2_ACTIVE] Commission - Using Provider Result:
{
  provider_commission: 450000,
  strategy: 'percentage',
  total_revenue: 3000000
}
```

---

### Scenario 4: Service Strategy - Per-Service-Type Rates

**Goal:** Test different commission rates per service type

**Steps:**
1. Select strategy: **"Theo dịch vụ (massage→150k, facial→100k)"**
2. Configure service rates:
   | Loại dịch vụ | Hoa hồng (VNĐ) |
   |--------------|----------------|
   | massage      | 150000         |
   | facial       | 100000         |
   | waxing       | 80000          |
3. Use **"+ Thêm dịch vụ"** to add more rows
4. Use **"Xóa"** to remove a row
5. Click **"Lưu cấu hình"**

**Expected Results:**
- ✅ Service rows are dynamic (add/remove works)
- ✅ Database stores:
  ```json
  {
    "enabled": true,
    "strategy": "service",
    "config": {
      "rates": {
        "massage": 150000,
        "facial": 100000,
        "waxing": 80000
      }
    }
  }
  ```

**Salary Calculation Verification:**
Assume KTV completed:
- 2 massage sessions → 2 × 150k = 300k
- 1 facial session → 1 × 100k = 100k
- 1 waxing session → 1 × 80k = 80k
- **Total commission:** 480,000đ

Check logs:
```
[PHASE_2_ACTIVE] Commission - Using Provider Result:
{
  provider_commission: 480000,
  strategy: 'service',
  sessions: 4
}
```

---

## Test Scenario 5: Commission Toggle OFF

**Goal:** Verify commission can be disabled

**Steps:**
1. Toggle "Hoa Hồng Ca" switch to OFF (gray)
2. Verify warning appears: "⚠️ Hoa hồng ca hiện đang **tắt**"
3. Click **"Lưu cấu hình"**

**Expected Results:**
- ✅ Database `enabled = false`
- ✅ Provider returns 0 commission
- ✅ KTV salary has `session_bonus = 0`
- ✅ Logs show:
  ```
  Commission provider disabled, returning 0
  ```

---

## Test Scenario 6: Combined Provider Test (All 4 Providers Active)

**Goal:** Test all providers working together

**Configuration:**
1. **KPI:** Threshold strategy (30 sessions → 1M bonus)
2. **Attendance:** Combined deductions (late: 50k, absent: 200k)
3. **Rating:** Threshold strategy (≥4.5 stars → 50k bonus)
4. **Commission:** Fixed strategy (120k per session)

**Test KTV Profile:**
- Sessions: 35 (exceeds KPI target)
- Late days: 2
- Absent days: 1
- Avg rating: 4.7 (exceeds rating threshold)

**Expected Salary Calculation:**
- Base salary: 6,000,000đ
- Session bonus (Commission): 35 × 120k = **4,200,000đ**
- KPI bonus: **1,000,000đ** (hit target)
- Rating bonus: **50,000đ** (4.7 ≥ 4.5)
- Attendance deductions: (2 × 50k) + (1 × 200k) = **-300,000đ**
- **Total salary:** 6,000,000 + 4,200,000 + 1,000,000 + 50,000 - 300,000 = **10,950,000đ**

**Verification:**
1. Check terminal logs for all 4 providers:
   ```
   [PHASE_2_ACTIVE] Commission - Using Provider Result: { ... }
   [PHASE_2_ACTIVE] KPI - Using Provider Result: { ... }
   [PHASE_2_ACTIVE] Rating - Using Provider Result: { ... }
   [PHASE_2_ACTIVE] Attendance - Using Provider Result: { ... }
   ```
2. Check database `salary_records`:
   ```sql
   SELECT 
     session_bonus,
     kpi_bonus,
     rating_bonus,
     violations_deduction,
     total_salary
   FROM salary_records
   WHERE ktv_id = '<test-ktv-id>'
   AND month_year = '2026-06-01';
   ```
3. Verify UI displays all components correctly

---

## Edge Cases & Error Handling

### Edge Case 1: No Commission Config (Default Behavior)

**Scenario:** Tenant has never saved commission config

**Expected:**
- Provider loads default config from `PayrollConfigService`
- If no default, falls back to old `calculateSessionCommissionBonus()`
- No errors, salary calculation continues

### Edge Case 2: Invalid Tier Configuration

**Scenario:** Admin saves overlapping tier ranges (e.g., 0-10, 5-15)

**Expected:**
- Provider should log warning
- Use first matching tier
- OR validate on save (prevent invalid config)

### Edge Case 3: Provider Failure

**Scenario:** CommissionProvider throws error during evaluation

**Expected:**
- ✅ Error logged to console:
  ```
  [PROVIDER_INTEGRATION] Commission Provider failed (non-blocking): <error>
  ```
- ✅ Salary calculation continues with old logic
- ✅ No crash, no silent failures
- ✅ `providerCommissionAmount = null`, uses `liveSessionBonus`

### Edge Case 4: Non-Draft Salary Record

**Scenario:** Salary record is `pending_approval` or `published`

**Expected:**
- ✅ Provider does NOT overwrite `session_bonus`
- ✅ Uses stored value: `existing.session_bonus`
- ✅ Only recalculates if admin provides `overrides`

---

## Rollback Plan

If Commission Provider causes issues in production:

### Option 1: Disable Feature Flag (Recommended)
```bash
# In .env.local or production environment
USE_CONFIG_PROVIDERS=false
```
- Reverts to old hardcoded logic
- Providers continue logging for comparison
- No code changes needed

### Option 2: Disable Commission Provider Only
```typescript
// In salary-recalculation-engine.ts
const USE_COMMISSION_PROVIDER = false; // Add this flag

// Then in commission evaluation:
if (USE_COMMISSION_PROVIDER && USE_CONFIG_PROVIDERS) {
  // Use provider
} else {
  // Use old logic
}
```

### Option 3: Full Rollback via Git
```bash
git revert c644e5fb  # Revert Task #9 commit
git push
```

---

## Success Criteria

✅ **Task #10 is complete when:**

1. All 4 commission strategies tested successfully
2. Settings UI saves/loads correctly for all strategies
3. Salary calculation uses provider results when `USE_CONFIG_PROVIDERS=true`
4. Combined provider test (all 4 providers) passes
5. Edge cases handled gracefully (no crashes, proper fallbacks)
6. Documentation complete (this guide + test plan)
7. User confirms readiness for production deployment

---

## Deployment Checklist

Before deploying to production:

- [ ] All test scenarios passed on localhost
- [ ] Feature flag `USE_CONFIG_PROVIDERS=true` verified in production `.env`
- [ ] Database migration `20260622_create_tenant_payroll_config.sql` applied to production
- [ ] Default commission config seeded for existing tenants
- [ ] Monitoring in place for provider logs (check for errors/warnings)
- [ ] Rollback plan communicated to team
- [ ] User acceptance testing (UAT) completed
- [ ] Performance tested with production data volume

---

## Next Steps

After Task #10:
1. **Phase 3:** Remove old hardcoded logic entirely (YAGNI cleanup)
2. **Add More Providers:** Bonus, Deduction, Insurance, Tax, etc.
3. **Admin Audit Log:** Track who changed what config and when
4. **Config Versioning:** Allow rollback to previous config versions
5. **Tenant Templates:** Pre-configured strategies for different spa types

---

**Document Status:** ✅ Ready for Testing  
**Last Updated:** 2026-06-22 by AI Agent  
**Related Files:**
- `src/services/providers/commission-provider.ts`
- `src/app/dashboard/settings/components/SalaryConfigTab.tsx`
- `src/modules/hr-salary/actions/salary-recalculation-engine.ts`
- `docs/config/PROVIDER_ACTIVATION_TEST_PLAN.md`
