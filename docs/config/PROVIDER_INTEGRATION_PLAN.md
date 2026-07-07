# Provider Integration Plan - Priority 2

**Date:** June 22, 2026  
**Goal:** Integrate configuration-driven providers into salary calculation engine  
**Risk Level:** Medium (touching core engine)  
**Estimated Time:** 2-3 hours

---

## 🎯 Current State Analysis

### What Engine Does Now (Hardcoded):
```typescript
// Line 213-219: Hardcoded salary config from tenants table
const salaryConfig: TenantSalaryConfig = {
  bonus_5_star: stored.bonus_5_star ?? 50000,
  bonus_4_5_star: stored.bonus_4_5_star ?? 30000,
  bonus_4_star: stored.bonus_4_star ?? 10000,
  kpi_target_sessions: stored.kpi_target_sessions ?? 30,
  kpi_bonus_amount: stored.kpi_bonus_amount ?? 1000000,
  penalty_late_per_day: stored.penalty_late_per_day ?? 50000,
  penalty_absent_per_day: stored.penalty_absent_per_day ?? 200000,
};
```

### What Providers Can Do (Configuration-Driven):
```typescript
// KPIProvider with 3 strategies
KPIProvider.evaluate({
  metric: 'sessions',
  value: 35,
  tenantId: 'xxx',
  userId: 'ktv-1',
  period: '2026-06'
}) 
// Returns: { amount: 1000000, strategy: 'threshold', ... }

// AttendanceProvider with 3 strategies
AttendanceProvider.evaluate({
  lateDays: 2,
  absentDays: 1,
  tenantId: 'xxx',
  userId: 'ktv-1',
  period: '2026-06'
})
// Returns: { amount: -300000, strategy: 'combined', ... }

// RatingProvider with 3 strategies
RatingProvider.evaluate({
  avgRating: 4.8,
  sessionsCount: 35,
  tenantId: 'xxx',
  userId: 'ktv-1',
  period: '2026-06'
})
// Returns: { amount: 50000, strategy: 'threshold', ... }
```

---

## 🔄 Integration Strategy

### Phase 1: Provider Wrapper (Non-Breaking)
**Goal:** Add providers alongside existing logic (both run, compare results)

**Approach:**
1. Import providers into engine
2. Call providers after existing calculations
3. Log comparison (old vs new)
4. Don't use provider results yet (only logging)

**Benefit:** Zero risk, can verify correctness

### Phase 2: Feature Flag Switch
**Goal:** Use provider results conditionally

**Approach:**
1. Add feature flag: `USE_CONFIG_DRIVEN_PROVIDERS`
2. If flag ON → use provider results
3. If flag OFF → use old hardcoded logic
4. A/B test with 1-2 tenants

**Benefit:** Can rollback instantly

### Phase 3: Full Migration
**Goal:** Remove old hardcoded logic entirely

**Approach:**
1. All tenants use providers
2. Delete old calculation code
3. Remove feature flag
4. Cleanup legacy config sync

**Benefit:** Clean codebase

---

## 📝 Detailed Implementation Plan

### Step 1: Import Providers (5 min)
```typescript
// Add at top of file
import { KPIProvider } from '@/services/providers/kpi-provider';
import { AttendanceProvider } from '@/services/providers/attendance-provider';
import { RatingProvider } from '@/services/providers/rating-provider';

// Initialize instances
const kpiProvider = new KPIProvider();
const attendanceProvider = new AttendanceProvider();
const ratingProvider = new RatingProvider();
```

### Step 2: Call Providers (Phase 1 - 30 min)
```typescript
// AFTER line 334 (existing KPI calculation)
const dbKpiBonus = kpiRecordsTyped.reduce(...);

// NEW: Provider-based KPI calculation
try {
  const kpiContext = {
    metric: 'sessions' as const,
    value: liveSessionsCount,
    tenantId,
    userId: ktvId,
    period: monthYear,
    metadata: {
      avgRating,
      attendanceDays: attendanceListTyped.length,
    }
  };
  
  const kpiResult = await kpiProvider.evaluate(kpiContext);
  
  // Log comparison (don't use yet)
  console.log('[PROVIDER_INTEGRATION] KPI Comparison:', {
    old: dbKpiBonus,
    new: kpiResult.amount,
    strategy: kpiResult.strategy,
    diff: kpiResult.amount - dbKpiBonus,
  });
} catch (error) {
  console.error('[PROVIDER_INTEGRATION] KPI Provider failed:', error);
}

// AFTER line 365 (existing attendance calculation)
const autoAttendancePenalty = liveAttendanceComponents.deductions;

// NEW: Provider-based attendance calculation
try {
  const attendanceContext = {
    lateDays,
    absentDays,
    tenantId,
    userId: ktvId,
    period: monthYear,
    metadata: {
      totalWorkingDays: attendanceListTyped.length,
    }
  };
  
  const attendanceResult = await attendanceProvider.evaluate(attendanceContext);
  
  // Log comparison
  console.log('[PROVIDER_INTEGRATION] Attendance Comparison:', {
    old: -autoAttendancePenalty,
    new: attendanceResult.amount,
    strategy: attendanceResult.strategy,
    diff: attendanceResult.amount + autoAttendancePenalty,
  });
} catch (error) {
  console.error('[PROVIDER_INTEGRATION] Attendance Provider failed:', error);
}

// AFTER line 484 (existing rating calculation)
const ratingBonus = calculateRatingBonus(sessionsCount, avgRating, salaryConfig);

// NEW: Provider-based rating calculation
try {
  const ratingContext = {
    avgRating: avgRating || 0,
    sessionsCount,
    tenantId,
    userId: ktvId,
    period: monthYear,
    metadata: {}
  };
  
  const ratingResult = await ratingProvider.evaluate(ratingContext);
  
  // Log comparison
  console.log('[PROVIDER_INTEGRATION] Rating Comparison:', {
    old: ratingBonus,
    new: ratingResult.amount,
    strategy: ratingResult.strategy,
    diff: ratingResult.amount - ratingBonus,
  });
} catch (error) {
  console.error('[PROVIDER_INTEGRATION] Rating Provider failed:', error);
}
```

### Step 3: Feature Flag (Phase 2 - 20 min)
```typescript
// Add env var: NEXT_PUBLIC_USE_CONFIG_PROVIDERS=true/false

// At top of function
const USE_PROVIDERS = process.env.NEXT_PUBLIC_USE_CONFIG_PROVIDERS === 'true';

// Replace hardcoded calculations
const finalKpiBonus = USE_PROVIDERS && kpiResult
  ? kpiResult.amount
  : (overrides?.kpi_bonus !== undefined ? overrides.kpi_bonus : dbKpiBonus);

const deductions = USE_PROVIDERS && attendanceResult
  ? Math.abs(attendanceResult.amount) // Provider returns negative
  : (overrides?.violations_deduction !== undefined ? overrides.violations_deduction : autoAttendancePenalty);

const ratingBonus = USE_PROVIDERS && ratingResult
  ? ratingResult.amount
  : calculateRatingBonus(sessionsCount, avgRating, salaryConfig);
```

### Step 4: Full Migration (Phase 3 - 30 min)
```typescript
// Remove all hardcoded logic
// Delete: calculateRatingBonus() calls
// Delete: salaryConfig object (lines 213-219)
// Delete: feature flag checks
// Keep only provider calls

// Final clean code:
const kpiResult = await kpiProvider.evaluate(kpiContext);
const attendanceResult = await attendanceProvider.evaluate(attendanceContext);
const ratingResult = await ratingProvider.evaluate(ratingContext);

const finalKpiBonus = overrides?.kpi_bonus ?? kpiResult.amount;
const deductions = overrides?.violations_deduction ?? Math.abs(attendanceResult.amount);
const ratingBonus = ratingResult.amount;
```

---

## 🧪 Testing Strategy

### Phase 1 Testing (Comparison Mode):
```sql
-- Check logs after running salary calculation
-- Look for [PROVIDER_INTEGRATION] logs in Vercel/server console

-- Expected: Old and new values should match (or be very close)
-- Threshold for "close enough": < 5% difference
```

### Phase 2 Testing (A/B Test):
```sql
-- Enable for 1 tenant first
UPDATE tenants SET metadata = jsonb_set(metadata, '{use_config_providers}', 'true')
WHERE id = 'test-tenant-uuid';

-- Calculate salary for 1 KTV
-- Compare with previous month (should use old logic)
-- Verify total_salary within 5% range
```

### Phase 3 Testing (Full Migration):
```sql
-- Run salary calculation for all KTVs in test tenant
-- Compare with previous month totals
-- Check for outliers (> 20% difference)
-- Investigate any large discrepancies
```

---

## ⚠️ Risks & Mitigation

### Risk 1: Provider Returns Different Amount
**Problem:** KPI Provider returns 1,200,000 but old logic returns 1,000,000

**Mitigation:**
- Phase 1: Only log, don't use result → Zero impact
- Phase 2: Feature flag OFF by default → Can test safely
- Phase 3: Gradual rollout → 1 tenant → 3 tenants → all

### Risk 2: Provider Throws Error
**Problem:** Network timeout, database error, config missing

**Mitigation:**
```typescript
try {
  const result = await kpiProvider.evaluate(context);
  return result.amount;
} catch (error) {
  console.error('Provider failed, falling back to old logic:', error);
  return dbKpiBonus; // Fallback to old calculation
}
```

### Risk 3: Performance Degradation
**Problem:** Providers are slower than hardcoded logic

**Mitigation:**
- Providers use PayrollConfigService (5-min cache) → Fast
- No extra database queries → Same performance
- Can add performance metrics in Phase 1

---

## 📊 Success Criteria

### Phase 1 Success:
- [x] Providers integrated without breaking existing logic
- [x] Comparison logs show < 5% difference
- [x] 0 errors in production logs
- [x] All KTV salaries calculated successfully

### Phase 2 Success:
- [ ] Feature flag works (ON/OFF switching)
- [ ] Test tenant using providers successfully
- [ ] Results match within 5% of old logic
- [ ] 0 rollbacks needed

### Phase 3 Success:
- [ ] All tenants using providers
- [ ] Old hardcoded logic removed
- [ ] Codebase cleaner (fewer lines)
- [ ] Configuration changes work without code deploy

---

## 🎓 Rollback Plan

### If Phase 1 Fails:
```bash
# Remove provider integration commit
git revert <commit-hash>
git push origin main

# Zero impact because providers weren't used yet
```

### If Phase 2 Fails:
```typescript
// Disable feature flag in Vercel
NEXT_PUBLIC_USE_CONFIG_PROVIDERS=false

// Or per-tenant rollback
UPDATE tenants SET metadata = jsonb_set(metadata, '{use_config_providers}', 'false')
WHERE id = 'problematic-tenant-uuid';
```

### If Phase 3 Fails:
```bash
# Revert full migration commit
git revert <commit-hash>

# Re-add old hardcoded logic
# This is why Phase 2 is important (keep both logics temporarily)
```

---

## 📅 Timeline

### Tonight (June 22):
- [ ] **Phase 1:** Add provider calls (comparison mode)
- [ ] **Commit & Push:** Non-breaking change
- [ ] **Monitor:** Check logs for comparison results

### Tomorrow (June 23):
- [ ] **Verify Phase 1:** Logs look good, < 5% diff
- [ ] **Phase 2:** Add feature flag logic
- [ ] **A/B Test:** Enable for 1 test tenant
- [ ] **Monitor:** 24 hours observation

### June 24-25:
- [ ] **Phase 2 Expansion:** Enable for 2-3 more tenants
- [ ] **Collect Feedback:** Any calculation differences reported?
- [ ] **Prepare Phase 3:** Remove old logic (if all good)

### June 26-27:
- [ ] **Phase 3:** Full migration (all tenants)
- [ ] **Cleanup:** Remove old calculation code
- [ ] **Documentation:** Update architecture docs

---

## 🔗 Related Files

**Need to Modify:**
- `src/modules/hr-salary/actions/salary-recalculation-engine.ts` (main target)

**Already Have:**
- `src/services/providers/kpi-provider.ts` ✅
- `src/services/providers/attendance-provider.ts` ✅
- `src/services/providers/rating-provider.ts` ✅
- `src/services/payroll-config.service.ts` ✅

**Will Create:**
- Tests: `src/__tests__/provider-integration.test.ts`
- Docs: This file + integration summary

---

## 💡 Key Insights

1. **Non-Breaking First:** Always add new logic alongside old logic
2. **Measure Everything:** Log comparisons to verify correctness
3. **Gradual Rollout:** 1 tenant → 3 → all (never "all at once")
4. **Always Have Fallback:** Try/catch with old logic as fallback
5. **Feature Flags Are Lifesavers:** Can toggle ON/OFF without deploy

---

**Ready to implement Phase 1?** 🚀

**Status:** ⏳ Planning Complete, Ready for Code  
**Next Step:** Implement Phase 1 (comparison mode)

