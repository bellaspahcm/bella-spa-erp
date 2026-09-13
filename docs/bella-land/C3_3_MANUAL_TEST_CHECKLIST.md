# C3.3: Manual Browser Test Checklist — B1-B11

**Date:** 2026-09-11  
**Tester:** [Your Name]  
**Environment:** Local Dev Server  
**User:** loadtest-realestate@test.local

---

## Pre-Test Setup

### Decision: Local Dev vs. Vercel Preview

**Option A: Local Development**
- Faster iteration
- Full dev tools access
- Requires stable local environment

**Option B: Vercel Preview Deployment**
- Production-like environment
- Proven path from Products P2.3
- Requires git commit + push

**Choose based on environment stability. If local dev unstable, use Option B.**

---

### Option A: Local Development Setup

#### 1. Start Dev Server
```bash
npm run dev
```

**Expected:** 
- ✓ Server starts on http://localhost:3000
- ✓ No compilation errors
- ✓ "ready" message appears

**Status:** [ ] PASS [ ] FAIL  
**Notes:**

---

### Option B: Vercel Preview Deployment (If Local Dev Unstable)

#### 1. Commit Changes
```bash
git add src/modules/real_estate/actions/customerActions.ts
git add src/app/dashboard/real-estate/customers/page.tsx
git commit -m "feat(customers): integrate createCustomerAction and fetchCustomersAction

- Fix import path: @/lib/supabase-server
- Add data fetching on mount
- Integrate create customer form with validation
- Add loading states and error handling
- Refs: C3.3 Browser Runtime"
```

**Status:** [ ] DONE  
**Commit SHA:** _______________

---

#### 2. Push to Branch
```bash
git push origin main
# Or your working branch
```

**Status:** [ ] DONE  
**Branch:** _______________

---

#### 3. Wait for Vercel Deployment
- Check Vercel dashboard or GitHub PR
- Wait for "Deployment Ready" status
- Copy preview URL

**Preview URL:** _______________  
**Status:** [ ] DEPLOYED [ ] FAILED

---

#### 4. Login to Preview
```
URL: [Preview URL]/login
Email: loadtest-realestate@test.local
Password: Test123456!
```

**Status:** [ ] LOGGED IN [ ] FAILED

---

### Common Setup (Both Options)

#### Final Step: Open Browser DevTools
- [x] Console tab open
- [x] Network tab open (optional)
- [x] Preserve log enabled

**Base URL Used:** [ ] http://localhost:3000 [ ] [Vercel Preview URL]

---

## Browser Test Gates (B1-B11)

**Note:** Replace `http://localhost:3000` with your Vercel Preview URL if using Option B.

### B1: Navigate to Customers Page

**Action:**
```
Visit: [BASE_URL]/dashboard/real-estate/customers
```

**Expected:**
- ✓ Page loads without errors
- ✓ URL shows /dashboard/real-estate/customers
- ✓ No console errors (red text)

**Result:** [ ] PASS [ ] FAIL  
**Console Errors:** (if any)

**Screenshot:** `C3_3_B1_page_load.png`

---

### B2: Page Displays UI

**Expected:**
- ✓ Header shows "Khách hàng & Nhà đầu tư"
- ✓ "Thêm khách hàng" button visible
- ✓ KPI cards display (6 cards: Tổng, Active, Nhu cầu, etc.)
- ✓ Customer list shows mock data (8 customers)
- ✓ Search box visible
- ✓ Filter tabs visible

**Result:** [ ] PASS [ ] FAIL  
**Missing Elements:** (if any)

**Screenshot:** `C3_3_B2_ui_rendered.png`

---

### B3: Console Shows Data Fetch

**Expected Console Output:**
```
[Customers] Loaded X real customers from database
```

**Check:**
- ✓ Console message appears
- ✓ X is a number (0 or more)
- ✓ No error messages

**Result:** [ ] PASS [ ] FAIL  
**Actual Console Output:**
```
(paste console output here)
```

**Screenshot:** `C3_3_B3_console_fetch.png`

---

### B4: Click "Thêm khách hàng"

**Action:**
```
Click button: "Thêm khách hàng" (blue button, top right)
```

**Expected:**
- ✓ Modal opens with overlay
- ✓ Form title: "Thêm Khách Hàng & Nhà Đầu Tư Mới"
- ✓ Form fields visible:
  - Họ và tên * (required)
  - Số điện thoại * (required)
  - Email (optional)
  - Dự án quan tâm (dropdown)
  - Nhu cầu & Ghi chú (textarea)
- ✓ "Tạo khách hàng" button visible
- ✓ "Hủy" button visible

**Result:** [ ] PASS [ ] FAIL  
**Missing Fields:** (if any)

**Screenshot:** `C3_3_B4_modal_open.png`

---

### B5: Form Validation (Empty Submit)

**Action:**
```
1. Leave all fields empty
2. Click "Tạo khách hàng" button
```

**Expected:**
- ✓ Browser shows validation error (red border or popup)
- ✓ "Họ và tên" field shows required indicator
- ✓ Form does NOT submit
- ✓ Modal stays open

**Result:** [ ] PASS [ ] FAIL  
**Validation Behavior:**

**Screenshot:** `C3_3_B5_validation.png`

---

### B6: Fill Form with Valid Data

**Action:**
```
Fill form:
  Họ và tên: Test Customer B6
  Số điện thoại: 0901111111
  Email: (leave empty - optional)
```

**Expected:**
- ✓ Form accepts input
- ✓ Fields show typed values
- ✓ "Tạo khách hàng" button enabled
- ✓ No errors appear

**Result:** [ ] PASS [ ] FAIL  
**Form Values:**
- Name: _______________
- Phone: _______________
- Email: _______________

**Screenshot:** `C3_3_B6_form_filled.png`

---

### B7: Submit Form

**Action:**
```
Click "Tạo khách hàng" button
```

**Expected Immediate Behavior:**
- ✓ Button text changes to "Đang tạo..."
- ✓ Spinner icon appears (rotating)
- ✓ Form inputs become disabled (grayed out)
- ✓ "Hủy" button becomes disabled
- ✓ Button shows `disabled:opacity-50` style

**Expected Network:**
- ✓ Network tab shows POST request to /api/... or similar
- ✓ Request payload includes: { name, phone, email }

**Result:** [ ] PASS [ ] FAIL  
**Button Behavior:**  
**Network Request:** [ ] YES [ ] NO

**Screenshot:** `C3_3_B7_submitting.png`

---

### B8: Success Feedback

**Expected After ~1-2 seconds:**
- ✓ Toast notification appears: "✅ Đã tạo khách hàng thành công!"
- ✓ Modal closes automatically
- ✓ Form is no longer visible
- ✓ Console shows: "[Customers] Loaded X+1 real customers"
- ✓ No error toast appears

**Result:** [ ] PASS [ ] FAIL  
**Toast Message:** (if different)  
**Console Output:**
```
(paste new console output here)
```

**Screenshot:** `C3_3_B8_success_toast.png`

---

### B9: Real Customer Count Increased

**Check Console:**
- ✓ Previous count: X customers
- ✓ New count: X+1 customers
- ✓ Count incremented by exactly 1

**Expected:**
```
[Customers] Loaded 0 real customers  (before create)
[Customers] Loaded 1 real customers  (after create)
```

**Result:** [ ] PASS [ ] FAIL  
**Before Count:** ___  
**After Count:** ___  
**Difference:** ___

---

### B10: Reload Page (Persistence Check)

**Action:**
```
1. Press F5 (or Ctrl+R / Cmd+R)
2. Wait for page to fully reload
3. Check console for data fetch
```

**Expected:**
- ✓ Page reloads successfully
- ✓ Console shows: "[Customers] Loaded X real customers"
- ✓ Count still shows X (customer persisted)
- ✓ Mock customer list still visible (UI may not show real customer yet - this is OK)

**Result:** [ ] PASS [ ] FAIL  
**Console Count After Reload:** ___

**Screenshot:** `C3_3_B10_after_reload.png`

---

### B11: Independent DB Verification

**Action:**
```sql
-- Run in Supabase SQL Editor or psql
SELECT 
  id, 
  tenant_id, 
  name, 
  phone, 
  email,
  created_at,
  created_by
FROM re_customers
WHERE phone = '0901111111'
  AND deleted_at IS NULL
ORDER BY created_at DESC
LIMIT 1;
```

**Expected Result:**
- ✓ 1 row returned
- ✓ name = "Test Customer B6"
- ✓ phone = "0901111111"
- ✓ email = null (or empty)
- ✓ tenant_id = "1a6643da-3806-4793-a301-7a6d60b0d888" (Tenant A)
- ✓ created_at = recent timestamp
- ✓ created_by = loadtest user ID

**Result:** [ ] PASS [ ] FAIL  
**Query Result:**
```
id: _______________
tenant_id: _______________
name: _______________
phone: _______________
email: _______________
created_at: _______________
created_by: _______________
```

**Screenshot:** `C3_3_B11_db_query.png`

---

## Summary

### Gate Results

| Gate | Description | Status | Notes |
|------|-------------|--------|-------|
| B1 | Navigate to page | [ ] PASS / [ ] FAIL | |
| B2 | UI displays | [ ] PASS / [ ] FAIL | |
| B3 | Console fetch log | [ ] PASS / [ ] FAIL | |
| B4 | Modal opens | [ ] PASS / [ ] FAIL | |
| B5 | Validation works | [ ] PASS / [ ] FAIL | |
| B6 | Form accepts input | [ ] PASS / [ ] FAIL | |
| B7 | Submit loading state | [ ] PASS / [ ] FAIL | |
| B8 | Success feedback | [ ] PASS / [ ] FAIL | |
| B9 | Count incremented | [ ] PASS / [ ] FAIL | |
| B10 | Reload persists | [ ] PASS / [ ] FAIL | |
| B11 | DB record exists | [ ] PASS / [ ] FAIL | |

**Total:** ___ / 11 PASS

---

### Verdict

**If 11/11 PASS:**
```
✅ C3.3 VERIFIED — Browser runtime proven
→ Proceed to C3.4 Regression
```

**If ANY FAIL:**
```
❌ C3.3 BLOCKED — Root cause analysis required
→ Document failure evidence
→ Fix implementation
→ Rerun full B1-B11
```

---

## Failure Troubleshooting

### B1-B2 Failures (Page Load Issues)
**Possible Causes:**
- Dev server not running
- Route not found (404)
- Auth session expired
- Compilation error

**Fix:**
1. Check `npm run dev` output for errors
2. Verify route exists: `src/app/dashboard/real-estate/customers/page.tsx`
3. Re-login if session expired
4. Check for TypeScript errors

---

### B3 Failure (No Console Log)
**Possible Causes:**
- `fetchCustomersAction` not imported
- `useEffect` not executing
- Auth context missing

**Fix:**
1. Check imports at top of page.tsx
2. Verify `useEffect(() => { loadRealCustomers(); }, [loadRealCustomers]);` exists
3. Check browser console for errors

---

### B7-B8 Failures (Submit Issues)
**Possible Causes:**
- `createCustomerAction` not called
- Network error (401, 403, 500)
- RLS policy blocking insert
- Tenant context missing

**Fix:**
1. Check Network tab for failed requests
2. Check response error message
3. Verify RLS policies exist: `SELECT * FROM pg_policies WHERE tablename = 're_customers';`
4. Verify user has tenant_id: `SELECT id, tenant_id FROM users WHERE email = 'loadtest-realestate@test.local';`

---

### B11 Failure (No DB Record)
**Possible Causes:**
- Insert failed silently
- RLS blocked insert without error
- Wrong tenant_id
- Phone unique constraint violation

**Fix:**
1. Check for existing phone: `SELECT * FROM re_customers WHERE phone = '0901111111';`
2. Try different phone number
3. Check RLS policies allow INSERT
4. Verify `created_by` user has correct tenant_id

---

## Evidence Artifacts

**Required Files:**
- Screenshots: B1, B2, B4, B6, B7, B8, B10, B11 (8 total)
- Console logs: Copy full console output
- DB query result: Copy SQL output
- Network tab: (optional) HAR export if errors occur

**Storage:**
```
docs/bella-land/evidence/C3_3/
  ├─ C3_3_B1_page_load.png
  ├─ C3_3_B2_ui_rendered.png
  ├─ C3_3_B3_console_fetch.png
  ├─ C3_3_B4_modal_open.png
  ├─ C3_3_B5_validation.png
  ├─ C3_3_B6_form_filled.png
  ├─ C3_3_B7_submitting.png
  ├─ C3_3_B8_success_toast.png
  ├─ C3_3_B10_after_reload.png
  ├─ C3_3_B11_db_query.png
  └─ console_output.txt
```

---

## Post-Test Actions

### If All Gates PASS:
1. Create `C3_3_VERIFIED.md` document
2. Copy this checklist with filled results
3. Attach evidence screenshots
4. Update program status: C3.3 🔒 VERIFIED
5. Proceed to C3.4 Regression

### If Any Gate FAILS:
1. Document failure in detail
2. Create RCA document
3. Fix implementation
4. Rerun FULL B1-B11 (not just failed gates)
5. Only mark VERIFIED when all 11 PASS

---

**Tester:** _______________  
**Date Executed:** _______________  
**Duration:** ___ minutes  
**Final Verdict:** [ ] VERIFIED [ ] BLOCKED

---

_End of Manual Test Checklist_
