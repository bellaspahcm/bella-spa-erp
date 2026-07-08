# Provider Activation Test Plan
**Date:** June 22, 2026  
**Status:** ✅ Phase 2 Activation Ready  
**Feature Flag:** `USE_CONFIG_PROVIDERS=true` enabled in `.env.local`

---

## 🎯 Test Objective
Verify that KPIProvider, AttendanceProvider, and RatingProvider calculate salary components correctly and match expected behavior when feature flag is ON.

**IMPORTANT:** Salary recalculation in Bella ERP is **NOT per-KTV manual button**. It is triggered by:
1. **Payroll Wizard** - Batch recalculation for entire month (Main method)
2. **AI Copilot Salary Reconciliation** - "Đồng bộ" button to sync legacy vs AI calculations
3. **Manual API calls** - Direct server action invocation (for advanced testing)

---

## ✅ Prerequisites
- [x] `.env.local` has `USE_CONFIG_PROVIDERS=true`
- [x] Dev server running (`npm run dev`)
- [x] Access to localhost:3000
- [x] Admin/Manager credentials for salary module

---

## 📋 Test Scenarios

### **Test Case 1: KPI Bonus Calculation**
**Goal:** Verify KPIProvider applies correct strategy from tenant config

**HOW TO TRIGGER RECALCULATION:**
The salary recalculation is **automatic** and triggered by:
- **Payroll Wizard Run** (Dashboard > Payroll > "Chạy Payroll Wizard" button at top)
- **Or manual API call** via Postman/Thunder Client (see Test Case 6)
- **Or via AI Copilot Salary Reconciliation** (Dashboard > AI Copilot > Salary Reconciliation > "Đồng bộ" button)

**Steps:**
1. **Open DevTools Console FIRST** (F12) before any action
2. Navigate to **Dashboard > Payroll** (URL: `/dashboard/payroll`)
3. Find the **"Chạy Payroll Wizard"** button (usually at top right, blue/primary color)
4. Select current month (June 2026) in date picker
5. Click "Chạy Payroll Wizard" → triggers `recalculateAndSaveSalaryRecord` for ALL KTVs
6. Watch console logs scroll:
   - Look for: `[PHASE_2_ACTIVE] Using provider-calculated KPI bonus: XXX`
   - Should appear for EACH KTV being processed
7. After wizard completes, check Salary Table to verify KPI bonus amounts

**Expected Console Logs:**
```
[RECALC_ENGINE] Starting salary recalculation for KTV: [name], Month: 2026-06
[RECALC_ENGINE] Feature flag USE_CONFIG_PROVIDERS: true
[KPIProvider] Strategy: tier
[KPIProvider] Evaluating KPI for employee XXX, KPI: 92%
[KPIProvider] Matched tier: 90-100% → 500,000 VNĐ
[PHASE_2_ACTIVE] Using provider-calculated KPI bonus: 500000 (Old logic would be: 500000)
[RECALC_ENGINE] Final salary components: base=X, session=Y, kpi=500000, rating=Z
[RECALC_ENGINE] Salary record saved successfully
```

**Expected Result:**
- Log shows `[PHASE_2_ACTIVE]` (not `[PROVIDER_INTEGRATION]`)
- KPI bonus amount is correct per strategy
- Old hardcoded logic NOT used

**Rollback Test:**
- Change `.env.local` to `USE_CONFIG_PROVIDERS=false`
- Restart dev server
- Recalculate same KTV
- Log should show `[PROVIDER_INTEGRATION]` (comparison mode)
- Old logic used, provider result only logged

---

### **Test Case 2: Attendance Deductions**
**Goal:** Verify AttendanceProvider applies penalty rules correctly

**Steps:**
1. Navigate to **Settings > Salary Config > Attendance Settings**
2. Check deduction rules (e.g., "Đi muộn: -50k", "Nghỉ không phép: -100k")
3. Find a KTV with attendance violations this month (use **HR > Attendance Report**)
4. Trigger salary recalculation
5. Check console log: `[PHASE_2_ACTIVE] Using provider-calculated attendance deduction: -XXX`
6. Verify deduction amount = sum of all violations × penalty amounts

**Expected Result:**
- Deductions match configured penalty amounts
- Multiple violations summed correctly
- Old hardcoded penalties NOT used

**Edge Cases:**
- KTV with 0 violations → deduction = 0
- KTV with partial-day violations → pro-rated deduction (if strategy supports)

---

### **Test Case 3: Rating Bonus**
**Goal:** Verify RatingProvider calculates star rating bonus correctly

**Steps:**
1. Navigate to **Settings > Salary Config > Rating Settings**
2. Note tier thresholds (e.g., ≥4.5⭐ → 300k, ≥4.0⭐ → 200k)
3. Find KTV with recent customer ratings (check **Operations > KTV Performance**)
4. Trigger salary recalculation
5. Check console log: `[PHASE_2_ACTIVE] Using provider-calculated rating bonus: XXX`
6. Verify bonus matches:
   - Average rating ≥4.5 → highest tier amount
   - Average rating 4.0-4.4 → middle tier
   - Average rating <4.0 → lower tier or 0

**Expected Result:**
- Rating bonus correctly tiered
- Average rating calculation accurate
- Old `calculateRatingBonus()` function NOT called

---

### **Test Case 4: Combined Salary Calculation**
**Goal:** Verify all 3 providers work together correctly

**Steps:**
1. Select KTV with:
   - Active KPI record (has KPI percentage)
   - Some attendance violations
   - Customer ratings available
2. Trigger full salary recalculation
3. Check all 3 logs in console:
   - `[PHASE_2_ACTIVE] Using provider-calculated KPI bonus: XXX`
   - `[PHASE_2_ACTIVE] Using provider-calculated attendance deduction: -XXX`
   - `[PHASE_2_ACTIVE] Using provider-calculated rating bonus: XXX`
4. Verify final `total_salary` = base_salary + session_bonus + kpi_bonus + rating_bonus - violations_deduction - service_percentage_bonus
5. Open **Dashboard > Salary > Adjustments** and verify displayed components match

**Expected Result:**
- All components calculated by providers
- Total salary mathematically correct
- UI displays match backend calculations
- No discrepancies between "AI Tính" vs actual saved amounts

---

### **Test Case 5: Draft vs Non-Draft Behavior**
**Goal:** Verify providers respect salary record status lifecycle

**Steps:**
1. Find KTV with salary record in **draft** status
2. Trigger recalculation → all providers should recalculate dynamically
3. Approve/publish that salary record (change status to `pending_approval` or `published`)
4. Trigger recalculation again → providers should NOT overwrite base_salary/kpi_bonus unless forced
5. Check console logs for `[RECALC_ENGINE] Record status: draft` vs `Record status: published`

**Expected Result:**
- **Draft status:** Providers recalculate all components dynamically
- **Non-draft status:** Providers preserve manual adjustments, only update session-based components (session_bonus)
- KPI bonus from saved `kpi_records` table preserved (not overwritten)

---

### **Test Case 6: Provider Config Changes (Live Test)**
**Goal:** Verify salary recalculations reflect updated provider configs

**Steps:**
1. Record current KPI bonus for Test KTV (e.g., "Quang")
2. Navigate to **Settings > Salary Config > KPI Settings**
3. Change strategy from "Tier" → "Fixed 1,000,000 VNĐ"
4. Save config (wait for 5min config cache to expire, or restart dev server)
5. Trigger recalculation for same KTV
6. Verify new KPI bonus = 1,000,000 (ignoring tier/performance)

**Expected Result:**
- Config changes immediately affect new calculations
- Old cached results NOT used (PayrollConfigService has 5min TTL)
- Logs show new strategy being applied

---

## 🚨 Error Scenarios to Test

### **Scenario A: Invalid Config**
- Manually edit `payroll_configs` table to set invalid strategy (e.g., `strategy: "invalid_strategy"`)
- Trigger recalculation
- **Expected:** Provider should throw error OR fallback to default strategy (check logs)
- System should NOT crash or save corrupted salary records

### **Scenario B: Missing Config**
- Delete all rows from `payroll_configs` for test tenant
- Trigger recalculation
- **Expected:** Providers use default strategies (from provider class `getDefaultConfig()` methods)
- Salary calculation continues without crash

### **Scenario C: Database Error**
- Temporarily break Supabase connection (pause internet)
- Trigger recalculation
- **Expected:** Error thrown, operation halted (no silent failures per AGENTS.md Rule #1)
- User sees error message, salary record NOT saved with incorrect data

---

## 📊 Success Criteria

### ✅ **Activation Success:**
1. All console logs show `[PHASE_2_ACTIVE]` (not `[PROVIDER_INTEGRATION]`)
2. KPI, Attendance, Rating components calculated by providers
3. Salary totals match expected values (no discrepancies)
4. Old hardcoded logic NOT executed
5. UI displays correct components

### ✅ **Rollback Success:**
1. Setting `USE_CONFIG_PROVIDERS=false` immediately reverts to old logic
2. Logs show `[PROVIDER_INTEGRATION]` (comparison mode)
3. Provider results logged but NOT used
4. System stable, no data corruption

### ✅ **Config-Driven Validation:**
1. Changing provider strategy in Settings UI → recalculations reflect new strategy
2. Multiple tenants can have different configs (test multi-tenant isolation)
3. Config cache expires correctly (5min TTL)

---

## 🔧 Rollback Procedure

If any test fails critically:

1. **Immediate Rollback (Local):**
   ```bash
   # Edit .env.local
   USE_CONFIG_PROVIDERS=false
   
   # Restart dev server
   npm run dev
   ```

2. **Immediate Rollback (Production):**
   - Go to Vercel Dashboard → Project Settings → Environment Variables
   - Change `USE_CONFIG_PROVIDERS` to `false` or delete variable
   - Redeploy: `git commit --allow-empty -m "rollback: disable providers" && git push`

3. **Verify Rollback:**
   - Check logs show `[PROVIDER_INTEGRATION]` (comparison mode resumed)
   - Trigger test recalculation → should use old logic
   - No salary records corrupted

---

## 📝 Test Log Template

```
### Test Run: [Date/Time]
Tester: [Your Name]
Environment: localhost:3000 / production

---

**Test Case 1: KPI Bonus**
- Status: ✅ PASS / ❌ FAIL
- Expected: 500,000 VNĐ (Tier strategy, 92% KPI)
- Actual: 500,000 VNĐ
- Notes: Log showed [PHASE_2_ACTIVE], correct tier applied

**Test Case 2: Attendance Deductions**
- Status: ✅ PASS / ❌ FAIL
- Expected: -150,000 VNĐ (3 late arrivals × 50k)
- Actual: -150,000 VNĐ
- Notes: All violations counted correctly

**Test Case 3: Rating Bonus**
- Status: ✅ PASS / ❌ FAIL
- Expected: 300,000 VNĐ (4.6⭐ avg → highest tier)
- Actual: 300,000 VNĐ
- Notes: Rating calculation accurate

**Test Case 4: Combined Calculation**
- Status: ✅ PASS / ❌ FAIL
- Expected total_salary: 8,750,000 VNĐ
- Actual total_salary: 8,750,000 VNĐ
- Notes: All components summed correctly, UI matches backend

**Test Case 5: Draft vs Non-Draft**
- Status: ✅ PASS / ❌ FAIL
- Notes: Draft recalculates dynamically, published preserves manual edits

**Test Case 6: Config Changes**
- Status: ✅ PASS / ❌ FAIL
- Notes: Changed KPI strategy → immediate effect after cache expiry

---

**Overall Result:** ✅ ALL PASS / ⚠️ PARTIAL / ❌ FAILED
**Recommendation:** 🚀 Deploy to production / 🔧 Fix issues first / 🚨 Rollback
```

---

## 🔜 Next Steps After Successful Local Testing

1. **Commit Changes:**
   ```bash
   git add .env.local docs/config/PROVIDER_ACTIVATION_TEST_PLAN.md
   git commit -m "feat(payroll): enable USE_CONFIG_PROVIDERS flag for Phase 2 activation"
   git push origin main
   ```

2. **Deploy to Vercel:**
   - Add environment variable `USE_CONFIG_PROVIDERS=true` in Vercel Dashboard
   - Deploy automatically via GitHub push

3. **Monitor Production (24-48 hours):**
   - Check Vercel logs for `[PHASE_2_ACTIVE]` entries
   - Verify no spike in errors
   - Compare salary records before/after activation (run SQL audit query)

4. **After Validation (Task #5):**
   - Remove old hardcoded logic:
     * Delete `calculateRatingBonus()` function in `salary-attendance-calculation.ts`
     * Remove hardcoded penalties in `calculateLiveAttendanceSalaryComponents`
     * Clean up `kpi_records` direct queries (if not used elsewhere)
   - Keep comparison logs for 1 more sprint, then remove

5. **Documentation:**
   - Update `docs/config/ROADMAP_NEXT_STEPS.md` with completion status
   - Add "Provider Activation Complete" entry to changelog
   - Notify team in Telegram/Slack about new config-driven payroll system

---

**Last Updated:** June 22, 2026  
**Owner:** AI Agent (Kiro)  
**Reviewers:** Quang (Product Owner)
