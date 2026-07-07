# Settings UI - E2E Test Guide

**Purpose:** Verify configuration-driven payroll system works end-to-end  
**Date:** June 22, 2026  
**Branch:** feature/policy-registry-v2  
**Tester:** QA / Product Owner

---

## Prerequisites

- ✅ RLS fix SQL executed in Supabase Dashboard
- ✅ Dev server running at http://localhost:3000
- ✅ Admin user logged in (email: admin@bellaspa.vn or similar)
- ✅ Tenant has data in `tenant_payroll_config` table

---

## Test Scenario 1: Threshold Strategy (Default)

**Goal:** Verify basic enable/disable and threshold strategy works

### Steps:

1. Navigate to Settings page:
   ```
   http://localhost:3000/dashboard/settings?tab=salary
   ```

2. **KPI Section - Enable & Configure:**
   - Toggle "Thưởng KPI" → **ON** (green)
   - Strategy dropdown should show: **"Ngưỡng đơn (đạt X ca → nhận Y thưởng)"**
   - Verify icon: 🎯 Target icon appears
   - Set "Mục tiêu (số ca)" = `30`
   - Set "Thưởng (VNĐ)" = `1000000`

3. **Attendance Section - Keep Default:**
   - Toggle should be **ON** (red)
   - "Phạt đi trễ" = `50000`
   - "Phạt vắng" = `200000`
   - "Dung sai" = `15` phút

4. **Rating Section - Disable:**
   - Toggle "Thưởng Chất Lượng" → **OFF** (gray)
   - Verify warning message: "⚠️ Thưởng chất lượng hiện đang **tắt**"

5. **Save:**
   - Click "LƯU CẤU HÌNH" button at bottom
   - Wait for toast notification
   - Expected: ✅ "Đã lưu cấu hình lương thành công!"

6. **Reload & Verify:**
   - Hard refresh: `Ctrl + Shift + R`
   - Check KPI toggle: Should be **ON**
   - Check KPI strategy: Should be **"Ngưỡng đơn..."**
   - Check values: 30 ca, 1M VNĐ
   - Check Rating toggle: Should be **OFF**

7. **Database Verification (Optional):**
   ```sql
   SELECT provider_key, enabled, strategy, config
   FROM tenant_payroll_config
   WHERE tenant_id = '<your-tenant-id>'
     AND provider_key IN ('kpi', 'attendance', 'rating')
   ORDER BY provider_key;
   ```
   
   Expected:
   ```
   kpi        | true  | threshold | {"target":30,"bonus":1000000,"metric":"sessions"}
   attendance | true  | combined  | {"latePenalty":50000,"absentPenalty":200000,...}
   rating     | false | threshold | {"minRating":4.5,"bonus":50000}
   ```

### ✅ Pass Criteria:
- [ ] Toggle states persist after reload
- [ ] Strategy dropdown shows correct option
- [ ] Input values persist after reload
- [ ] Database has correct JSON config
- [ ] No errors in browser console

---

## Test Scenario 2: Linear Strategy

**Goal:** Verify linear strategy with per-session rate

### Steps:

1. Navigate to Settings → Salary tab

2. **KPI Section - Switch to Linear:**
   - Click strategy dropdown
   - Select: **"Tuyến tính (mỗi ca thêm → +Z đồng)"**
   - Verify icon changes to: 📈 TrendingUp
   - Verify form changes: 2 inputs disappear, 1 input appears
   - New input label: "Thưởng mỗi ca (VNĐ)"
   - Set value = `50000`
   - Placeholder should show: "Ví dụ: 50000 (50k mỗi ca)"

3. **Save & Reload:**
   - Click "LƯU CẤU HÌNH"
   - Wait for success toast
   - Hard refresh page
   - Verify strategy = "Tuyến tính..."
   - Verify value = `50000`

4. **Database Verification:**
   ```sql
   SELECT config
   FROM tenant_payroll_config
   WHERE tenant_id = '<your-tenant-id>'
     AND provider_key = 'kpi';
   ```
   
   Expected:
   ```json
   {
     "ratePerSession": 50000,
     "metric": "sessions"
   }
   ```

### ✅ Pass Criteria:
- [ ] Dropdown icon changes to TrendingUp
- [ ] Form shows only 1 input (rate per session)
- [ ] Value persists after reload
- [ ] Database config matches strategy
- [ ] No console errors

---

## Test Scenario 3: Tier Strategy (Multi-Level)

**Goal:** Verify tier strategy with multiple bonus levels

### Steps:

1. Navigate to Settings → Salary tab

2. **KPI Section - Switch to Tier:**
   - Click strategy dropdown
   - Select: **"Bậc thang (nhiều mức 20/30/40 ca)"**
   - Verify icon changes to: 📊 BarChart3
   - Verify form changes to tier editor with 3 default rows:
     - Row 1: 0 - 29 ca → 0 VNĐ
     - Row 2: 30 - 49 ca → 1,000,000 VNĐ
     - Row 3: 50 - 999 ca → 2,000,000 VNĐ

3. **Edit Tiers:**
   - Row 1: Change to `20 - 29 ca → 500,000 VNĐ`
   - Row 2: Change to `30 - 39 ca → 1,000,000 VNĐ`
   - Row 3: Change to `40 - 99 ca → 2,000,000 VNĐ`

4. **Add New Tier:**
   - Click "➕ Thêm mức thưởng" button
   - New row appears: `100 - 109 ca → 0 VNĐ`
   - Change to: `100 - 999 ca → 3,000,000 VNĐ`

5. **Remove Tier:**
   - Click "Xóa" button on Row 1
   - Verify row is removed
   - Should have 3 rows now (30-39, 40-99, 100-999)

6. **Save & Reload:**
   - Click "LƯU CẤU HÌNH"
   - Wait for success toast
   - Hard refresh page
   - Verify strategy = "Bậc thang..."
   - Verify 3 tier rows display correctly

7. **Database Verification:**
   ```sql
   SELECT config
   FROM tenant_payroll_config
   WHERE tenant_id = '<your-tenant-id>'
     AND provider_key = 'kpi';
   ```
   
   Expected:
   ```json
   {
     "tiers": [
       {"min": 30, "max": 39, "bonus": 1000000},
       {"min": 40, "max": 99, "bonus": 2000000},
       {"min": 100, "max": 999, "bonus": 3000000}
     ],
     "metric": "sessions"
   }
   ```

### ✅ Pass Criteria:
- [ ] Dropdown icon changes to BarChart3
- [ ] Tier editor shows dynamic rows
- [ ] Add tier button works
- [ ] Remove tier button works (min 1 row remains)
- [ ] All tier values persist after reload
- [ ] Database JSON array matches UI
- [ ] No console errors

---

## Test Scenario 4: Rating Strategy (Same Pattern)

**Goal:** Verify rating section follows same pattern as KPI

### Steps:

1. **Rating Section - Enable:**
   - Toggle "Thưởng Chất Lượng" → **ON** (yellow/amber)

2. **Test Threshold:**
   - Strategy = "Ngưỡng đơn (≥ X sao → nhận Y thưởng)"
   - Set "Đánh giá tối thiểu" = `4.5`
   - Set "Thưởng" = `50000`
   - Save & verify

3. **Test Linear:**
   - Switch to "Tuyến tính (mỗi 0.1 sao thêm → +Z đồng)"
   - Set "Thưởng mỗi 0.1 sao" = `10000`
   - Save & verify

4. **Test Tier:**
   - Switch to "Bậc thang (4.0-4.4 / 4.5-4.9 / 5.0)"
   - Default tiers:
     - 4.0 - 4.4 → 30,000
     - 4.5 - 4.9 → 50,000
     - 5.0 - 5.0 → 100,000
   - Add new tier: `4.8 - 5.0 → 80,000`
   - Save & verify

### ✅ Pass Criteria:
- [ ] Rating section mirrors KPI section behavior
- [ ] All 3 strategies work correctly
- [ ] Tier editor supports decimal values (4.5, 4.8)
- [ ] Database config structure matches

---

## Test Scenario 5: Edge Cases

**Goal:** Verify error handling and validation

### Edge Case 1: Disable Provider Mid-Session
1. Enable KPI → Set values → Save
2. Disable KPI (toggle OFF)
3. Save again
4. Reload → Verify KPI is OFF
5. Database: `enabled = false` but config preserved

### Edge Case 2: Invalid Tier Ranges
1. Tier mode: Set overlapping ranges
   - Row 1: 20 - 40
   - Row 2: 35 - 50 (overlaps!)
2. Save → Should succeed (no validation yet)
3. Note: Future improvement = add validation

### Edge Case 3: Extremely Large Values
1. Set KPI bonus = `999999999` (1 billion)
2. Save → Should succeed
3. Reload → Verify value persists

### Edge Case 4: Switch Strategy Multiple Times
1. Start with Threshold
2. Switch to Linear → Save
3. Switch to Tier → Save
4. Switch back to Threshold → Save
5. Verify each save overwrites previous config correctly

### ✅ Pass Criteria:
- [ ] Toggle off preserves config (doesn't delete)
- [ ] Large numbers handled correctly
- [ ] Strategy switches don't corrupt data
- [ ] No errors when switching rapidly

---

## Test Scenario 6: Mobile Responsive

**Goal:** Verify UI works on mobile viewport

### Steps:

1. Open Chrome DevTools (F12)
2. Toggle device toolbar (Ctrl + Shift + M)
3. Select: iPhone 12 Pro (390 x 844)
4. Navigate to Settings → Salary tab

### Visual Checks:
- [ ] Strategy dropdown readable (not cut off)
- [ ] Tier editor rows stack vertically on small screen
- [ ] Save button accessible (not hidden)
- [ ] Toggles work on touch
- [ ] No horizontal scroll

---

## Bug Report Template

If any test fails, report using this format:

```markdown
### Bug: [Short Description]

**Test Scenario:** [1, 2, 3, 4, 5, or 6]
**Step:** [Which step failed]

**Expected:**
[What should happen]

**Actual:**
[What actually happened]

**Screenshot:**
[Attach screenshot if possible]

**Console Errors:**
[Copy any errors from browser console]

**Database State:**
[Copy output of SQL query if relevant]

**Severity:** [Critical / High / Medium / Low]
```

---

## Regression Tests

After each fix, re-run these critical paths:

1. **Smoke Test (2 min):**
   - Enable KPI → Save → Reload → Verify ON

2. **Strategy Test (3 min):**
   - Switch Threshold → Linear → Tier → Verify each saves

3. **Full Flow (5 min):**
   - Configure all 3 providers → Save → Reload → Verify all

---

## Success Criteria (Full Pass)

✅ **All 6 scenarios pass**  
✅ **0 console errors**  
✅ **Database state matches UI**  
✅ **Mobile responsive**  
✅ **No data loss on reload**  
✅ **Toggles work correctly**  
✅ **Strategy switches work correctly**  
✅ **Tier editor add/remove works**

---

## Known Limitations (Not Bugs)

1. **No tier validation:** Can create overlapping ranges (future improvement)
2. **No preview calculator:** Can't see salary impact before save (future feature)
3. **No undo:** Once saved, can't rollback (use config history in future)
4. **Attendance strategy selector missing:** Only KPI/Rating have dropdowns (by design for now)

---

## Next Steps After Testing

### If All Tests Pass ✅:
1. Update `ROADMAP_NEXT_STEPS.md` → Mark "Priority 1" as DONE
2. Create PR: `feature/policy-registry-v2` → `main`
3. Deploy to staging
4. Production deploy after PM sign-off

### If Tests Fail ❌:
1. Report bugs using template above
2. Fix bugs in priority order (Critical → High → Medium)
3. Re-run regression tests
4. Repeat until all pass

---

**Last Updated:** June 22, 2026  
**Status:** Ready for QA Testing 🧪
