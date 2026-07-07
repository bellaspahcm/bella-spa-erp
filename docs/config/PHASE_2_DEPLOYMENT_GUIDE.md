# Phase 2: Feature Flag Deployment Guide

**Date:** June 22, 2026  
**Feature:** Configuration-Driven Payroll Providers  
**Status:** ✅ Ready for Production (with feature flag OFF by default)

---

## 🎯 WHAT IS PHASE 2?

Phase 2 enables **conditional usage** of configuration-driven provider results in salary calculations via a feature flag.

**Key Changes:**
- Added `USE_CONFIG_PROVIDERS` environment variable
- When `true`: Use provider results (KPI, Attendance, Rating)
- When `false` or unset: Continue Phase 1 comparison mode (safe default)

**Architecture:**
```
┌─────────────────────────────────────────────────────────────┐
│  USE_CONFIG_PROVIDERS Environment Variable                  │
├─────────────────────────────────────────────────────────────┤
│  false (default) │ true (feature enabled)                   │
│  ───────────────────────────────────────────────────────    │
│  Phase 1:        │ Phase 2:                                 │
│  Comparison Mode │ Active Provider Usage                    │
│  ✓ Old logic     │ ✓ Provider results used                 │
│  ✓ Providers log │ ✓ Old logic disabled                    │
│  ✓ Zero risk     │ ✓ [PHASE_2_ACTIVE] logs                 │
└─────────────────────────────────────────────────────────────┘
```

---

## 📦 FILES CHANGED

### 1. Salary Recalculation Engine
**File:** `src/modules/hr-salary/actions/salary-recalculation-engine.ts`

**Changes:**
- Added `USE_CONFIG_PROVIDERS` flag check at top
- Refactored 3 provider calls to conditionally use results:
  1. **Attendance Provider:** Uses `providerAttendanceAmount` for deductions when flag ON
  2. **KPI Provider:** Uses `providerKpiAmount` for KPI bonus when flag ON
  3. **Rating Provider:** Uses `providerRatingAmount` for rating bonus when flag ON
- Added `[PHASE_2_ACTIVE]` logs when flag is ON
- Kept `[PROVIDER_INTEGRATION]` comparison logs when flag is OFF

**Logic Flow:**
```typescript
// Flag check at top
const USE_CONFIG_PROVIDERS = process.env.USE_CONFIG_PROVIDERS === 'true';

// For each provider (KPI, Attendance, Rating):
try {
  const result = await provider.evaluate(context);
  
  if (USE_CONFIG_PROVIDERS) {
    console.log('[PHASE_2_ACTIVE] Using Provider Result:', { ... });
    // Use provider result in calculation
  } else {
    console.log('[PROVIDER_INTEGRATION] Comparison:', { old_logic, new_provider, diff });
    // Use old logic (comparison mode)
  }
} catch (error) {
  console.error('Provider failed (non-blocking):', error);
  // Fallback to old logic
}

// Final value selection
const finalKpiBonus = overrides?.kpi_bonus 
  ? overrides.kpi_bonus
  : (existing && !isDraft 
      ? existing.kpi_bonus 
      : (USE_CONFIG_PROVIDERS && providerKpiAmount !== null 
          ? providerKpiAmount 
          : dbKpiBonus)); // Old logic fallback
```

### 2. Environment Variables
**File:** `.env.example`

**Added:**
```bash
# Phase 2: Configuration-Driven Payroll (Feature Flag)
USE_CONFIG_PROVIDERS=false
```

**Documentation:** Comprehensive inline comments explaining:
- How to enable/disable
- Rollback plan
- Monitoring instructions

---

## 🚀 DEPLOYMENT STEPS

### Step 1: Deploy Code (Flag OFF by Default)
```bash
git add -A
git commit -m "feat(payroll): Phase 2 - Feature flag for provider integration"
git push origin main
```

**Expected:**
- Vercel auto-deploys
- Flag is OFF by default (no `USE_CONFIG_PROVIDERS` in Vercel env)
- System continues Phase 1 comparison mode
- Zero risk, zero behavior change

### Step 2: Monitor Phase 1 Logs (1-2 days)
**Check Vercel logs for:**
```
[PROVIDER_INTEGRATION] KPI Comparison:
  old_logic: 1000000
  new_provider: 1000000
  diff: 0
  diff_percent: 0.00%

[PROVIDER_INTEGRATION] Attendance Comparison:
  old_logic: 150000
  new_provider: 150000
  diff: 0
  diff_percent: 0.00%

[PROVIDER_INTEGRATION] Rating Comparison:
  old_logic: 50000
  new_provider: 50000
  diff: 0
  diff_percent: 0.00%
```

**Acceptance Criteria:**
- ✅ All diffs < 5% (acceptable rounding differences)
- ✅ No provider errors
- ✅ Salary records unchanged (using old logic)

### Step 3: Enable Flag in Vercel (Test with 1 KTV)
**Vercel Dashboard:**
1. Go to: https://vercel.com/bellaspahcm/bella-spa-erp/settings/environment-variables
2. Add new variable:
   - **Key:** `USE_CONFIG_PROVIDERS`
   - **Value:** `true`
   - **Environment:** Production
3. Click **Save**
4. Redeploy: `git commit --allow-empty -m "chore: trigger redeploy" && git push`

### Step 4: Monitor Phase 2 Active Logs
**Check Vercel logs for:**
```
[PHASE_2_ACTIVE] KPI - Using Provider Result:
  provider_bonus: 1000000
  old_logic_would_be: 1000000
  strategy: threshold

[PHASE_2_ACTIVE] Attendance - Using Provider Result:
  provider_deduction: 150000
  old_logic_would_be: 150000
  strategy: combined

[PHASE_2_ACTIVE] Rating - Using Provider Result:
  provider_bonus: 50000
  old_logic_would_be: 50000
  strategy: threshold
```

### Step 5: Verify Salary Records (Manual Check)
**Test Case:**
1. Pick 1 KTV with known salary data
2. Run salary calculation for current month
3. Check `salary_records` table:
   - `kpi_bonus` should match provider calculation
   - `violations_deduction` should match provider calculation
   - `rating_bonus` should match provider calculation
4. Compare with old logic (should be same if configs match)

**SQL Query:**
```sql
SELECT 
  ktv_id,
  month_year,
  kpi_bonus,
  violations_deduction,
  rating_bonus,
  total_salary,
  status
FROM salary_records
WHERE month_year = '2026-06-01'
  AND ktv_id = 'test-ktv-id'
ORDER BY updated_at DESC
LIMIT 1;
```

### Step 6: Rollback Plan (If Needed)
**Immediate Rollback:**
1. Go to Vercel environment variables
2. Set `USE_CONFIG_PROVIDERS=false` or delete variable
3. Redeploy: `git commit --allow-empty -m "chore: rollback Phase 2" && git push`
4. Wait 2-3 minutes for deploy
5. Verify `[PROVIDER_INTEGRATION]` comparison logs resume

**Database Rollback (if incorrect records saved):**
```sql
-- Backup current records
CREATE TABLE salary_records_backup_june_22 AS
SELECT * FROM salary_records
WHERE month_year = '2026-06-01';

-- Restore from backup if needed
-- (Requires manual SQL execution with proper WHERE clause)
```

---

## 🔍 MONITORING & VERIFICATION

### Log Patterns to Monitor

**Phase 1 (Flag OFF - Comparison Mode):**
```
[PROVIDER_INTEGRATION] KPI Comparison: { old_logic: X, new_provider: Y, diff: Z }
[PROVIDER_INTEGRATION] Attendance Comparison: { ... }
[PROVIDER_INTEGRATION] Rating Comparison: { ... }
```

**Phase 2 (Flag ON - Active Usage):**
```
[PHASE_2_ACTIVE] KPI - Using Provider Result: { provider_bonus: X, old_logic_would_be: Y }
[PHASE_2_ACTIVE] Attendance - Using Provider Result: { ... }
[PHASE_2_ACTIVE] Rating - Using Provider Result: { ... }
```

**Errors to Watch For:**
```
[PROVIDER_INTEGRATION] KPI Provider failed (non-blocking): Error: ...
[PROVIDER_INTEGRATION] Attendance Provider failed (non-blocking): Error: ...
[PROVIDER_INTEGRATION] Rating Provider failed (non-blocking): Error: ...
```

**If errors appear:**
- Check `tenant_payroll_config` table: configs may be missing
- Check provider code: may have bugs
- Rollback flag immediately if recurring errors

### Metrics to Track

| Metric | Expected | Action if Deviation |
|--------|----------|---------------------|
| Provider KPI diff % | < 5% | Investigate config mismatch |
| Provider Attendance diff % | < 5% | Check penalty rates |
| Provider Rating diff % | < 5% | Check rating thresholds |
| Provider errors | 0 per day | Fix provider code or config |
| Salary record changes | Predictable | Verify against old logic |

---

## ✅ ACCEPTANCE CRITERIA (Before Full Rollout)

**Phase 2 is considered successful when:**

1. **Build & Deploy:**
   - ✅ Code compiles with 0 TypeScript errors
   - ✅ All 119 routes build successfully
   - ✅ Vercel deployment succeeds

2. **Flag OFF (Default State):**
   - ✅ Comparison logs show < 5% diff
   - ✅ No provider errors in logs
   - ✅ Salary records unchanged (old logic used)

3. **Flag ON (Test with 1 KTV):**
   - ✅ `[PHASE_2_ACTIVE]` logs appear
   - ✅ Provider results used in calculations
   - ✅ Salary records match provider calculations
   - ✅ No unexpected changes in total salary

4. **Rollback Test:**
   - ✅ Setting flag to `false` resumes comparison mode
   - ✅ Old logic immediately takes effect
   - ✅ No errors during switch

5. **User Acceptance:**
   - ✅ Test KTV confirms salary is correct
   - ✅ Admin verifies calculation breakdown
   - ✅ No complaints from other KTVs

---

## 🎓 TRAINING & COMMUNICATION

### For Admins

**What Changed:**
- Salary engine now supports **configuration-driven calculations**
- Old hardcoded logic is being replaced by **flexible providers**
- Providers read from **Settings > Salary Config** (added in earlier sprint)

**How to Verify:**
1. Run salary calculation for June 2026
2. Check Vercel logs for `[PHASE_2_ACTIVE]` prefix
3. Compare salary records with expected values
4. If wrong, contact tech team immediately

**Rollback Trigger:**
- If total salary differs by > 10% from expected
- If multiple KTVs report incorrect salary
- If provider errors appear in logs

### For KTVs

**What Changed:**
- Nothing visible! Salary calculations use same rules
- Backend architecture improved for flexibility
- Calculations now match Settings UI configuration

**What to Watch For:**
- KPI bonus should match target achievement
- Penalties should match attendance violations
- Rating bonus should match star average

**If Salary Wrong:**
- Report to Admin immediately
- Provide: Month, expected amount, actual amount, reason
- Admin will investigate and adjust if needed

---

## 📊 SUCCESS METRICS

**Technical Metrics:**
- Provider error rate: 0%
- Diff % between old and new: < 5%
- Rollback time: < 5 minutes
- Deploy time: < 3 minutes

**Business Metrics:**
- KTV complaints: 0 (salary matches expected)
- Admin workload: Same or lower (no manual adjustments needed)
- Configuration flexibility: 100% (all rules configurable via UI)

---

## 🚦 GO/NO-GO CHECKLIST

**Before Enabling Flag in Production:**

- [ ] Phase 1 comparison logs show < 5% diff for 2+ days
- [ ] No provider errors in Vercel logs
- [ ] Test KTV salary verified manually (matches old logic)
- [ ] Rollback plan tested and confirmed working
- [ ] Admin trained on how to verify calculations
- [ ] KTVs informed of backend update (no visible change)
- [ ] Vercel environment variable ready to set
- [ ] On-call engineer available for 24h monitoring

**Go Decision Criteria:**
- ✅ All checkboxes above checked
- ✅ Tech Lead approval
- ✅ PM approval
- ✅ Test KTV confirms salary correct

**No-Go Decision Criteria:**
- ❌ Any provider diff > 10%
- ❌ Recurring provider errors
- ❌ Test KTV reports incorrect salary
- ❌ Rollback test failed

---

## 📝 POST-DEPLOYMENT TASKS

**After 24 hours (Flag ON):**
1. Review all salary records created
2. Compare with old logic (should match)
3. Check for any KTV complaints
4. Document any issues found

**After 1 week (Flag ON):**
1. Consider full rollout to all tenants
2. Document lessons learned
3. Plan Phase 3: Remove old logic entirely

**Phase 3 Planning:**
- Remove old hardcoded logic
- Keep only provider-based calculations
- Update tests to use providers only
- Archive legacy calculation functions

---

## 🔗 RELATED DOCUMENTATION

- **Phase 1:** `docs/config/PROVIDER_INTEGRATION_PLAN.md`
- **Settings UI:** `docs/config/SETTINGS_UI_E2E_TEST.md`
- **Roadmap:** `docs/config/ROADMAP_NEXT_STEPS.md`
- **Sprint Summary:** `docs/config/SPRINT_SUMMARY_JUNE_22.md`

---

## 📞 SUPPORT CONTACTS

**Technical Issues:**
- Kiro AI Agent (this session)
- Tech Lead: [Your Name]

**Business Issues:**
- PM: [PM Name]
- Admin: [Admin Name]

**Emergency Rollback:**
1. Set `USE_CONFIG_PROVIDERS=false` in Vercel
2. Redeploy immediately
3. Notify PM and Tech Lead

---

**Last Updated:** June 22, 2026  
**Version:** 1.0.0  
**Status:** ✅ Ready for Production Deployment
