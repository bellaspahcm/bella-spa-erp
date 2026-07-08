# Provider Integration Activation Plan
**Date:** June 22, 2026  
**Status:** 🟡 Ready for User Approval  
**Risk Level:** 🔴 HIGH (affects salary calculations)

---

## Executive Summary

The config-driven providers (KPI, Attendance, Rating) have been **implemented and running in comparison mode since Phase 1**. They are currently logging results alongside the old hardcoded logic but NOT affecting actual salary calculations.

**To activate them, we need to:**
1. Set environment variable: `USE_CONFIG_PROVIDERS=true`
2. Verify calculations match expected results
3. Monitor for discrepancies

**Current State:** Phase 1 Complete (Comparison Mode)  
**Next Step:** Phase 2 Activation (Conditional Usage)  
**ETA:** 2-3 hours of testing + deployment

---

## What Will Change

### Before (Current - Old Hardcoded Logic):
```typescript
// KPI Bonus: Fetches from kpi_records table
const dbKpiBonus = kpiRecordsTyped.reduce((acc, k) => acc + Number(k.bonus_amount || 0), 0);
finalKpiBonus = dbKpiBonus; // Always uses database value

// Attendance: Hardcoded penalties
const autoAttendancePenalty = lateDays * 50000 + absentDays * 200000;
deductions = autoAttendancePenalty;

// Rating: Hardcoded tier logic
const oldLogicRatingBonus = calculateRatingBonus(sessionsCount, avgRating, salaryConfig);
finalRatingBonus = oldLogicRatingBonus;
```

### After (Phase 2 - Config-Driven):
```typescript
// KPI Bonus: Uses provider result when flag ON
finalKpiBonus = USE_CONFIG_PROVIDERS && providerKpiAmount !== null
  ? providerKpiAmount  // ← NEW: Config-driven
  : dbKpiBonus;        // ← OLD: Fallback

// Attendance: Uses provider result when flag ON
deductions = USE_CONFIG_PROVIDERS && providerAttendanceAmount !== null
  ? Math.abs(providerAttendanceAmount)  // ← NEW: Config-driven
  : autoAttendancePenalty;              // ← OLD: Fallback

// Rating: Uses provider result when flag ON
finalRatingBonus = USE_CONFIG_PROVIDERS && providerRatingAmount !== null
  ? providerRatingAmount  // ← NEW: Config-driven
  : oldLogicRatingBonus;  // ← OLD: Fallback
```

---

## Integration Status by Provider

### 1. KPIProvider ✅
**Location:** `salary-recalculation-engine.ts` lines 405-450  
**Status:** ✅ Integrated, ⏳ Disabled by flag  
**Strategies Supported:**
- Threshold: 30 sessions → 1M bonus
- Linear: 50k per session above baseline
- Tier: 0-20: 0, 21-30: 500k, 31+: 1.5M

**Current Behavior:**
```typescript
// Phase 1: Comparison logging active
console.log('[PROVIDER_INTEGRATION] KPI Comparison:', {
  old_logic: dbKpiBonus,
  new_provider: kpiProviderResult.amount,
  diff: kpiProviderResult.amount - dbKpiBonus,
  diff_percent: '...'
});
```

**After Activation:**
```typescript
// Phase 2: Provider result used
console.log('[PHASE_2_ACTIVE] KPI - Using Provider Result:', {
  provider_bonus: kpiProviderResult.amount,
  old_logic_would_be: dbKpiBonus,
  strategy: 'threshold'
});
```

---

### 2. AttendanceProvider ✅
**Location:** `salary-recalculation-engine.ts` lines 340-390  
**Status:** ✅ Integrated, ⏳ Disabled by flag  
**Strategies Supported:**
- Late Deduction: 50k per late day
- Absent Deduction: 200k per absent day
- Combined: Both penalties

**Current Behavior:**
```typescript
// Phase 1: Comparison logging active
console.log('[PROVIDER_INTEGRATION] Attendance Comparison:', {
  old_logic: autoAttendancePenalty,
  new_provider: providerDeduction,
  diff: providerDeduction - autoAttendancePenalty
});
```

---

### 3. RatingProvider ✅
**Location:** `salary-recalculation-engine.ts` lines 490-550  
**Status:** ✅ Integrated, ⏳ Disabled by flag  
**Strategies Supported:**
- Threshold: ≥4.5★ → 50k
- Linear: 10k per 0.1★ above 4.0★
- Tier: 4.0-4.4: 0, 4.5-4.7: 50k, 4.8+: 150k

**Current Behavior:**
```typescript
// Phase 1: Comparison logging active
console.log('[PROVIDER_INTEGRATION] Rating Comparison:', {
  old_logic: oldLogicRatingBonus,
  new_provider: ratingProviderResult.amount,
  diff: ratingProviderResult.amount - oldLogicRatingBonus
});
```

---

## Testing Plan

### Pre-Activation Verification (Manual - 30 min)

**Scenario 1: Verify Comparison Mode Logs**
```bash
# Check Vercel production logs for provider comparison data
# Search for: "[PROVIDER_INTEGRATION]"
# Verify: old_logic vs new_provider match expectations
```

**Scenario 2: Check Default Configs**
```sql
-- Verify all tenants have default configs
SELECT tenant_id, provider_key, enabled, strategy 
FROM tenant_payroll_config 
WHERE provider_key IN ('kpi', 'attendance', 'rating');

-- Expected result: 6 tenants × 3 providers = 18 rows
```

**Scenario 3: Test Config Changes**
```typescript
// Settings UI: Change KPI strategy from threshold → linear
// Verify: Database updates correctly
// Verify: PayrollConfigService cache invalidates (5min TTL)
```

---

### Post-Activation Testing (Critical - 1 hour)

**Test Case 1: Threshold Strategy (Default)**
```typescript
// KTV: 35 sessions, KPI threshold: 30
// Expected: 1,000,000đ bonus (threshold strategy)
// Old logic: Query kpi_records table
// New logic: KPIProvider.evaluate() with threshold config

// ✅ Pass Criteria: Results match exactly
// ❌ Fail Criteria: Diff > 1,000đ (0.1% tolerance)
```

**Test Case 2: Linear Strategy**
```typescript
// KTV: 35 sessions, baseline: 20, bonusPerUnit: 50k
// Expected: (35 - 20) × 50,000 = 750,000đ
// Old logic: N/A (not supported)
// New logic: KPIProvider with linear config

// ✅ Pass Criteria: 750,000đ bonus
// ❌ Fail Criteria: Any deviation
```

**Test Case 3: Tier Strategy**
```typescript
// KTV: 25 sessions
// Tiers: 0-20: 0, 21-30: 500k, 31+: 1.5M
// Expected: 500,000đ (falls in tier 2)
// Old logic: N/A (not supported)
// New logic: KPIProvider with tier config

// ✅ Pass Criteria: 500,000đ bonus
// ❌ Fail Criteria: Wrong tier selected
```

**Test Case 4: Attendance Deductions**
```typescript
// KTV: 3 late days, 1 absent day
// Config: 50k late, 200k absent
// Expected: -(3 × 50k + 1 × 200k) = -350,000đ
// Old logic: autoAttendancePenalty
// New logic: AttendanceProvider

// ✅ Pass Criteria: Results match exactly
// ❌ Fail Criteria: Any diff > 1,000đ
```

**Test Case 5: Rating Bonus**
```typescript
// KTV: avgRating 4.7★, 25 sessions
// Config: threshold 4.5★, bonus 50k
// Expected: 50,000đ
// Old logic: calculateRatingBonus()
// New logic: RatingProvider

// ✅ Pass Criteria: 50,000đ bonus
// ❌ Fail Criteria: Wrong amount
```

**Test Case 6: Combined Salary Calculation**
```typescript
// Full salary with all 3 providers active:
// Base: 7,000,000đ
// Session bonus: 3,000,000đ
// KPI bonus: 1,000,000đ (provider)
// Rating bonus: 50,000đ (provider)
// Attendance deduction: -350,000đ (provider)
// Expected total: 10,700,000đ

// ✅ Pass Criteria: Total matches
// ❌ Fail Criteria: Any component wrong
```

---

## Rollback Plan

### Option 1: Feature Flag (Instant - Recommended)
```bash
# In Vercel Dashboard:
# Environment Variables > USE_CONFIG_PROVIDERS
# Change: true → false (or delete variable)
# Redeploy: Automatic trigger
# Downtime: ~30 seconds
```

### Option 2: Git Revert (5 min)
```bash
git revert <commit-hash> -m 1
git push origin main
# Vercel auto-deploy: ~2-3 min
```

### Option 3: Manual Override (Emergency)
```typescript
// In salary-recalculation-engine.ts line 43:
const USE_CONFIG_PROVIDERS = false; // Force disable
// Commit + push
```

---

## Activation Procedure

### Step 1: Pre-Flight Checks ✅
- [ ] Verify all 3 providers compiled without errors
- [ ] Check comparison mode logs show reasonable diffs
- [ ] Confirm default configs exist for all tenants
- [ ] Backup production database (RDS snapshot)

### Step 2: Staging Test (30 min)
- [ ] Set `USE_CONFIG_PROVIDERS=true` in Vercel Staging
- [ ] Deploy to staging environment
- [ ] Run Test Cases 1-6 (see above)
- [ ] Verify logs show `[PHASE_2_ACTIVE]` prefix
- [ ] Check no errors in Vercel logs

### Step 3: Production Deployment (5 min)
- [ ] Set `USE_CONFIG_PROVIDERS=true` in Vercel Production
- [ ] Vercel auto-deploys (~2 min)
- [ ] Monitor deployment logs for errors
- [ ] Verify app starts successfully

### Step 4: Smoke Test (15 min)
- [ ] Open Settings UI → Salary Config tab
- [ ] Verify configs load correctly
- [ ] Trigger salary recalculation for 1 test KTV
- [ ] Check Vercel logs for `[PHASE_2_ACTIVE]` entries
- [ ] Verify salary record saved with correct amounts

### Step 5: Monitoring (24 hours)
- [ ] Watch Vercel error rate (should be <1%)
- [ ] Check Supabase logs for RLS permission errors
- [ ] Monitor salary calculation diffs in logs
- [ ] Collect user feedback (admin + accountant)

---

## Success Criteria

### Must Pass (Blocking):
- [ ] ✅ Zero critical bugs in 24 hours
- [ ] ✅ Salary calculations match expected results (99%+ accuracy)
- [ ] ✅ No RLS permission errors
- [ ] ✅ Settings UI loads and saves correctly
- [ ] ✅ Vercel error rate <1%

### Nice to Have:
- [ ] Admin feedback collected (NPS >50)
- [ ] 3+ tenants test new providers
- [ ] Comparison mode logs show <5% diffs on average

---

## Risk Assessment

### 🔴 HIGH RISK: Salary Calculation Changes
**Impact:** Affects payroll for all KTVs  
**Mitigation:**
- ✅ Feature flag for instant rollback
- ✅ Comparison mode logs validated first
- ✅ Default configs match old behavior exactly
- ✅ Comprehensive test cases before activation

### 🟡 MEDIUM RISK: Cache Invalidation
**Impact:** Config changes may not reflect immediately (5min TTL)  
**Mitigation:**
- ✅ PayrollConfigService has cache TTL
- ✅ Admin can force reload by changing config

### 🟢 LOW RISK: Performance
**Impact:** Provider calls add ~50-100ms per salary calc  
**Mitigation:**
- ✅ Config cache reduces DB queries
- ✅ Providers use efficient algorithms

---

## Dependencies

### Code Dependencies:
- ✅ KPIProvider, AttendanceProvider, RatingProvider
- ✅ PayrollConfigService (with cache)
- ✅ Feature flag check in engine
- ✅ Comprehensive logging

### Database Dependencies:
- ✅ `tenant_payroll_config` table exists
- ✅ Default configs inserted for all tenants
- ✅ RLS policies fixed

### Environment Dependencies:
- ⏳ `USE_CONFIG_PROVIDERS=true` in Vercel (not set yet)
- ✅ All other env vars unchanged

---

## Communication Plan

### Internal Team:
- [ ] Email engineering team (deployment notice)
- [ ] Alert product team (feature now active)
- [ ] Notify support team (troubleshooting guide)

### External Users:
- [ ] No user-facing changes (calculations use same defaults)
- [ ] Admin: Optional email about new Settings UI strategies

---

## Next Steps After Activation

### Week 1: Monitoring & Validation
1. ✅ Monitor Vercel logs daily
2. ✅ Collect salary calculation diffs
3. ✅ Fix any edge cases discovered
4. ✅ Update documentation

### Week 2: Strategy Enablement
1. Enable linear & tier strategies in Settings UI
2. Train admins on how to configure strategies
3. Migrate 1-2 tenants to non-default configs
4. Validate new strategies work correctly

### Week 3: Cleanup (Task #5)
1. Remove hardcoded KPI/attendance/rating constants
2. Delete old `calculateRatingBonus()` function
3. Delete `calculateLiveAttendanceSalaryComponents()` logic
4. Remove `kpi_records` table dependency (if not used elsewhere)

---

## Questions for User

### 🚨 CRITICAL - Requires User Decision:

**Q1: Ready to activate providers in production?**
- [ ] ✅ Yes, enable `USE_CONFIG_PROVIDERS=true` now
- [ ] ⏳ Not yet, need more testing
- [ ] ❌ No, requires business approval first

**Q2: Deploy to staging first or straight to production?**
- [ ] Staging only (safer, +30min testing time)
- [ ] Production directly (faster, higher risk)

**Q3: Monitoring period before cleanup?**
- [ ] 24 hours (aggressive)
- [ ] 1 week (balanced)
- [ ] 2 weeks (conservative)

---

**Current Status:** ⏳ Awaiting User Approval  
**Recommended Action:** Deploy to Staging → Test → Production  
**ETA After Approval:** 2-3 hours total

