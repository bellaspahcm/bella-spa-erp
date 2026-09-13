# Bella Land Projects - Manual Browser Verification Checklist

**URL:** http://localhost:3001/dashboard/real-estate/projects

**Status:** Level 3 ✅ PASSED (Database + Tenant Isolation)  
**Remaining:** Level 1 & 2 (Browser Workflow + Persistence)

---

## ✅ LEVEL 3: Database Verification (COMPLETED)

```text
✅ Total projects: 23
✅ Valid statuses: 23/23 (planning | active)
✅ Tenant isolation: ALL projects have tenant_id
✅ Unique tenants: 9
✅ NO invalid status values found
```

**Verified by:** `scripts/bella-land/verify-projects-workflow.ts`

---

## 🔴 LEVEL 1: User Completes Workflow (MANUAL REQUIRED)

### Test 1.1: Create Project with "Đang hoạt động" (Default)

**Steps:**
1. [ ] Navigate to http://localhost:3001/dashboard/real-estate/projects
2. [ ] Click "+ Thêm dự án mới" button
3. [ ] Modal opens with title "Thêm Dự Án Mới"
4. [ ] Verify status dropdown shows "Đang hoạt động" selected by default
5. [ ] Fill form:
   - **Tên Dự Án:** "Manual Test Active Project"
   - **Mô Tả:** "Manual verification test for active status"
   - **Trạng Thái:** Keep "Đang hoạt động" (default)
6. [ ] Click "Xác Nhận Tạo"
7. [ ] Success toast appears: "✅ Tạo dự án thành công!"
8. [ ] Project appears in list immediately
9. [ ] Status badge shows "Đang hoạt động" in **Teal color**

**Expected:**
- ✅ No browser console errors
- ✅ Workflow completes smoothly
- ✅ Project visible in list

---

### Test 1.2: Create Project with "Đang lập kế hoạch"

**Steps:**
1. [ ] Click "+ Thêm dự án mới"
2. [ ] Fill form:
   - **Tên Dự Án:** "Manual Test Planning Project"
   - **Mô Tả:** "Manual verification test for planning status"
   - **Trạng Thái:** Select "Đang lập kế hoạch"
3. [ ] Click "Xác Nhận Tạo"
4. [ ] Success toast appears
5. [ ] Project appears with **Amber badge** "Đang lập kế hoạch"

**Expected:**
- ✅ Status dropdown change works
- ✅ Amber badge displays correctly

---

### Test 1.3: Create Project with "Đã hoàn thành"

**Steps:**
1. [ ] Click "+ Thêm dự án mới"
2. [ ] Fill form:
   - **Tên Dự Án:** "Manual Test Completed Project"
   - **Trạng Thái:** Select "Đã hoàn thành"
3. [ ] Click "Xác Nhận Tạo"
4. [ ] Project appears with **Slate badge** "Đã hoàn thành"

---

### Test 1.4: Create Project with "Đã hủy"

**Steps:**
1. [ ] Click "+ Thêm dự án mới"
2. [ ] Fill form:
   - **Tên Dự Án:** "Manual Test Cancelled Project"
   - **Trạng Thái:** Select "Đã hủy"
3. [ ] Click "Xác Nhận Tạo"
4. [ ] Project appears with **Rose badge** "Đã hủy"

---

### Test 1.5: Required Name Validation

**Steps:**
1. [ ] Click "+ Thêm dự án mới"
2. [ ] Leave "Tên Dự Án" blank
3. [ ] Click "Xác Nhận Tạo"
4. [ ] Toast error appears: "Vui lòng điền tên dự án"
5. [ ] Modal stays open (not dismissed)

**Expected:**
- ✅ Validation prevents empty name submission

---

### Test 1.6: Status Dropdown Options

**Steps:**
1. [ ] Open create modal
2. [ ] Click status dropdown
3. [ ] Verify EXACTLY 4 options visible:
   - [ ] "Đang lập kế hoạch"
   - [ ] "Đang hoạt động" (selected by default)
   - [ ] "Đã hoàn thành"
   - [ ] "Đã hủy"
4. [ ] Verify NO old options: "on_sale", "presale", "sold_out"

**Expected:**
- ✅ Only 4 valid statuses
- ✅ No legacy status values

---

## 🔴 LEVEL 2: Data Persisted Correctly (MANUAL REQUIRED)

### Test 2.1: Persistence Check After Reload

**Steps:**
1. [ ] After creating "Manual Test Active Project" in Test 1.1
2. [ ] Press F5 or Ctrl+R (reload page)
3. [ ] Wait for page to fully load
4. [ ] Verify "Manual Test Active Project" still appears in list
5. [ ] Verify status badge still shows "Đang hoạt động" (Teal)
6. [ ] Verify description displays correctly

**Expected:**
- ✅ Data persists after browser reload
- ✅ Status badge renders correctly
- ✅ All fields match input

---

### Test 2.2: Project Detail View

**Steps:**
1. [ ] Find "Manual Test Active Project" in list
2. [ ] Click "Xem chi tiết" button
3. [ ] Modal opens with project name as title
4. [ ] Verify description displays correctly
5. [ ] Verify statistics section appears

**Expected:**
- ✅ Detail modal works
- ✅ All data displays correctly

---

### Test 2.3: Filter Tabs Functionality

**Steps:**
1. [ ] Click "Tất cả" tab → All projects show (should see test projects)
2. [ ] Click "Đang hoạt động" tab → Only active projects show
3. [ ] Click "Đang lập kế hoạch" tab → Only planning projects show
4. [ ] Click "Đã hoàn thành" tab → Only completed projects show

**Expected:**
- ✅ Each tab filters correctly
- ✅ Created test projects appear in correct tabs

---

### Test 2.4: Search Functionality

**Steps:**
1. [ ] In search box, type "Manual Test"
2. [ ] Verify all 4 test projects appear
3. [ ] Type "Active" → Only "Manual Test Active Project" shows
4. [ ] Clear search → All projects reappear

**Expected:**
- ✅ Search filters by name
- ✅ Real-time filtering works

---

## 📊 Verification Summary

### Level 1: User Completes Workflow
- [ ] Create with each status (4 tests)
- [ ] Required validation works
- [ ] Status dropdown correct
- [ ] NO console errors

### Level 2: Data Persisted Correctly
- [ ] Reload persistence verified
- [ ] Detail view works
- [ ] Filter tabs work
- [ ] Search works

### Level 3: Tenant Isolation Intact
- ✅ **VERIFIED** by database script
- ✅ 23/23 projects have tenant_id
- ✅ NO invalid status values
- ✅ 9 unique tenants

---

## ✅ Pass Criteria

**ALL must be checked:**
- [ ] Level 1: All 6 workflow tests pass
- [ ] Level 2: All 4 persistence tests pass
- [x] Level 3: Database verification passed

**FAIL if:**
- 🔴 Any test step fails
- 🔴 Browser console errors during workflow
- 🔴 Data disappears after reload
- 🔴 Wrong status values appear
- 🔴 Old "on_sale" / "presale" options visible

---

## 🎯 After Manual Verification

**If ALL tests pass:**

1. Update `UI_BACKEND_RECONCILIATION_PLAN.md`:
   ```text
   1. Projects
      Status: ✅ VERIFIED (3/3 levels)
      - Level 1: User workflow ✅
      - Level 2: Persistence ✅
      - Level 3: Tenant isolation ✅
   ```

2. Move to next workflow:
   ```text
   2. Apartments → 🔴 NEXT
   ```

**If ANY test fails:**

1. Document exact failure
2. Create minimal fix
3. Re-run verification
4. Do NOT proceed to Apartments until Projects pass

---

## 🛠️ Quick Commands

**Database verification (repeat anytime):**
```bash
npx tsx scripts/bella-land/verify-projects-workflow.ts
```

**Dev server (if stopped):**
```bash
npm run dev
```

**Check browser console:**
- F12 → Console tab
- Look for red errors during workflow

---

**Status:** Awaiting manual browser verification  
**Estimated time:** 10-15 minutes  
**Blocker:** None (Level 3 already passed)
