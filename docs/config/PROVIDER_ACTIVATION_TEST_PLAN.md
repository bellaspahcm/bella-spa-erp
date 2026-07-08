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


---

## **Test Case 7: Commission Provider - Fixed Strategy** (Task #9)
**Goal:** Verify CommissionProvider applies fixed rate per session correctly

**Steps:**
1. Navigate to **Settings > Salary Config > Commission Settings**
2. Verify "Hoa Hồng Ca" toggle is ON (emerald green)
3. Select strategy: **"Cố định (mỗi ca cố định X đồng)"**
4. Set: Hoa hồng mỗi ca = `120,000 VNĐ`, Số ca tối thiểu = `0`
5. Save config
6. Trigger salary recalculation (via Payroll Wizard)
7. Check console log: `[PHASE_2_ACTIVE] Commission - Using Provider Result: { provider_commission: XXX, strategy: 'fixed', sessions: N }`
8. Verify `session_bonus` = sessionsCount × 120,000

**Expected Result:**
- Commission calculated as: sessions × fixed rate (e.g., 10 sessions → 1,200,000đ)
- Old `calculateSessionCommissionBonus()` NOT used
- Log shows `strategy: 'fixed'`

---

## **Test Case 8: Commission Provider - Tier Strategy** (Task #9)
**Goal:** Verify tiered commission rates work correctly

**Steps:**
1. Select strategy: **"Bậc thang (0-10ca→100k, 11-20ca→120k)"**
2. Configure tiers:
   - 0-10 sessions → 100k/session
   - 11-20 sessions → 120k/session
   - 21+ sessions → 150k/session
3. Save config
4. Test with KTVs having different session counts:
   - KTV A: 5 sessions → 500,000đ (5 × 100k)
   - KTV B: 15 sessions → 1,800,000đ (15 × 120k)
   - KTV C: 25 sessions → 3,750,000đ (25 × 150k)
5. Verify logs show correct tier matching

**Expected Result:**
- Commission uses rate from matching tier
- Tier boundaries work correctly (10→11 transitions properly)
- Log shows `strategy: 'tier'` and matched tier details

---

## **Test Case 9: Commission Provider - Percentage Strategy** (Task #9)
**Goal:** Verify percentage-based commission on service revenue

**Steps:**
1. Select strategy: **"Phần trăm doanh thu (% giá trị booking)"**
2. Set: Phần trăm = `15%`, Doanh thu tối thiểu = `0`
3. Save config
4. Find KTV with known total session revenue (e.g., 5,000,000đ from bookings)
5. Trigger recalculation
6. Verify commission = totalRevenue × 15% = 750,000đ
7. Check log: `[PHASE_2_ACTIVE] Commission ... total_revenue: 5000000`

**Expected Result:**
- Commission = totalRevenue × percentage
- Revenue correctly summed from all sessions
- Log shows `strategy: 'percentage'` and total_revenue

---

## **Test Case 10: Commission Provider - Service Strategy** (Task #9)
**Goal:** Verify different rates per service type

**Steps:**
1. Select strategy: **"Theo dịch vụ (massage→150k, facial→100k)"**
2. Configure service rates:
   - massage → 150,000đ
   - facial → 100,000đ
   - waxing → 80,000đ
3. Save config
4. Find KTV with mixed service sessions:
   - 3 massage sessions → 450,000đ
   - 2 facial sessions → 200,000đ
   - 1 waxing session → 80,000đ
   - **Total:** 730,000đ
5. Verify commission matches sum of service-specific rates

**Expected Result:**
- Each session uses its service type's commission rate
- Unknown service types fallback to 0 or default
- Log shows `strategy: 'service'` and service breakdown

---

## **Test Case 11: All 4 Providers Active (Complete System Test)** (Task #10)
**Goal:** Verify all providers (KPI, Attendance, Rating, Commission) work together

**Configuration:**
- **KPI:** Threshold (30 sessions → 1M)
- **Attendance:** Combined (late: 50k, absent: 200k)
- **Rating:** Threshold (≥4.5⭐ → 50k)
- **Commission:** Fixed (120k/session)

**Test Profile:**
- KTV: "Quang"
- Sessions: 35 (exceeds KPI)
- Late days: 2, Absent days: 1
- Avg rating: 4.7⭐
- Base salary: 6,000,000đ

**Expected Calculation:**
- Base: 6,000,000đ
- Commission (35 × 120k): 4,200,000đ
- KPI (hit target): 1,000,000đ
- Rating (4.7 ≥ 4.5): 50,000đ
- Deductions (2×50k + 1×200k): -300,000đ
- **Total:** 10,950,000đ

**Verification:**
1. Check console for all 4 provider logs:
   ```
   [PHASE_2_ACTIVE] Commission - Using Provider Result: { provider_commission: 4200000, ... }
   [PHASE_2_ACTIVE] KPI - Using Provider Result: { provider_bonus: 1000000, ... }
   [PHASE_2_ACTIVE] Rating - Using Provider Result: { provider_bonus: 50000, ... }
   [PHASE_2_ACTIVE] Attendance - Using Provider Result: { provider_deduction: 300000, ... }
   ```
2. Verify database record matches expected total
3. UI displays all components correctly
4. No discrepancies in AI Copilot Salary Reconciliation

**Expected Result:**
- ✅ All 4 providers execute successfully
- ✅ Total salary = 10,950,000đ (exact match)
- ✅ Each component logged with `[PHASE_2_ACTIVE]`
- ✅ No errors in console
- ✅ UI reflects all provider-calculated values

---

## **Test Case 12: Commission Provider OFF (Disable Test)** (Task #10)
**Goal:** Verify commission can be disabled without breaking salary calculation

**Steps:**
1. Navigate to Commission Settings
2. Toggle "Hoa Hồng Ca" OFF (switch turns gray)
3. Verify warning: "⚠️ Hoa hồng ca hiện đang **tắt**"
4. Save config
5. Trigger recalculation
6. Verify `session_bonus = 0` in salary record
7. Check log: `Commission provider disabled, returning 0`

**Expected Result:**
- KTV receives 0 commission (session_bonus = 0)
- Other providers (KPI, Rating) still work normally
- No errors or crashes
- Old `calculateSessionCommissionBonus()` NOT called

---

## 📋 Complete Test Matrix (All 12 Scenarios)

| # | Test Case | Provider | Status | Priority |
|---|-----------|----------|--------|----------|
| 1 | KPI Bonus Calculation | KPI | ⏳ Pending | High |
| 2 | Attendance Deductions | Attendance | ⏳ Pending | High |
| 3 | Rating Bonus | Rating | ⏳ Pending | High |
| 4 | Combined Salary (KPI+Att+Rating) | All 3 | ⏳ Pending | High |
| 5 | Draft vs Non-Draft Status | All | ⏳ Pending | High |
| 6 | Provider Config Changes | All | ⏳ Pending | Medium |
| 7 | Commission - Fixed Strategy | Commission | ⏳ Pending | High |
| 8 | Commission - Tier Strategy | Commission | ⏳ Pending | High |
| 9 | Commission - Percentage Strategy | Commission | ⏳ Pending | Medium |
| 10 | Commission - Service Strategy | Commission | ⏳ Pending | Medium |
| 11 | **All 4 Providers Active** | **All 4** | ⏳ Pending | **Critical** |
| 12 | Commission Provider OFF | Commission | ⏳ Pending | Low |

**Testing Priority:**
1. **Critical (Test #11):** All 4 providers working together - this is the ultimate integration test
2. **High (Tests #1-5, #7-8):** Core functionality per provider
3. **Medium (Tests #6, #9-10):** Config changes and alternative strategies
4. **Low (Test #12):** Edge case (disabled provider)

---

## 🚀 Deployment Decision Matrix

### ✅ **Deploy to Production IF:**
- [ ] All HIGH priority tests (1-5, 7-8) pass
- [ ] Test #11 (Critical - all 4 providers) passes
- [ ] No console errors or warnings during testing
- [ ] UI displays match backend calculations (no discrepancies)
- [ ] Rollback procedure verified (toggle flag OFF works)
- [ ] At least 1 production-like salary cycle tested (full month)

### ⚠️ **Deploy with Caution IF:**
- [ ] 1-2 MEDIUM priority tests fail (can fix post-deploy)
- [ ] Minor UI inconsistencies found (display-only issues)
- [ ] Performance acceptable but not optimal (<500ms per KTV)

### 🚨 **DO NOT Deploy IF:**
- [ ] Any HIGH priority test fails
- [ ] Test #11 (Critical) fails
- [ ] Data corruption observed in test records
- [ ] Silent failures detected (no error logs but wrong calculations)
- [ ] Rollback procedure doesn't work
- [ ] Total salary calculations have discrepancies >1% from expected

---

## 📊 Task #10 Success Criteria Checklist

**End-to-End Testing Complete:**
- [ ] Commission Settings UI tested (all 4 strategies)
- [ ] CommissionProvider integration tested (salary engine)
- [ ] Combined provider test passed (all 4 active together)
- [ ] Edge cases handled (disabled, invalid config, errors)
- [ ] Documentation complete (this plan + test guide)

**Production Readiness:**
- [ ] Feature flag verified in production environment
- [ ] Database migration applied to production
- [ ] Monitoring in place (logs, error tracking)
- [ ] Rollback plan communicated to team
- [ ] User acceptance testing (UAT) completed

**Code Quality:**
- [ ] No TypeScript errors
- [ ] All providers follow same pattern (consistency)
- [ ] Error handling is non-blocking (no silent failures)
- [ ] Logging is comprehensive (PHASE_2_ACTIVE tags present)

---

**Task #10 Status:** 🟡 Testing Documentation Complete, Awaiting Execution  
**Next Action:** User needs to execute all 12 test scenarios manually  
**Estimated Test Time:** 2-3 hours for complete test suite  
**Related Docs:** `COMMISSION_SETTINGS_TEST_GUIDE.md`, `ROADMAP_NEXT_STEPS.md`

