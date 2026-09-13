# P5.5 Manual Browser E2E Checklist

**Date:** 2026-09-11  
**Deployment:** https://bella-spa-jgx3zxonb-bella-spa-s-projects.vercel.app  
**Test Account:** loadtest-realestate@test.local / Test123456!  
**Tenant:** 1a6643da-3806-4793-a301-7a6d60b0d888

---

## Prerequisites

- ✅ Service-layer authorization implemented (commit `d679d181`)
- ✅ Vercel deployment includes latest code (commit `023ad690`)
- ✅ Admin-only RLS policy preserved on `real_estate_products`
- ✅ Test fixtures exist (Projects, Products, Customers)

---

## 7-Step Manual E2E Flow

### Step 1: Login

1. Open browser → https://bella-spa-jgx3zxonb-bella-spa-s-projects.vercel.app/login
2. Enter credentials:
   - Email: `loadtest-realestate@test.local`
   - Password: `Test123456!`
3. Click Login/Submit
4. **Verify:** Dashboard visible
5. **Capture:** Screenshot `p5-5-step-1-login.png`

**Expected:** ✅ Logged in successfully, Dashboard displayed

---

### Step 2: Create Reservation

1. Navigate to: `/dashboard/real-estate/reservations`
2. Click "Tạo đặt chỗ" or "Create Reservation" or "+" button
3. Fill form:
   - **Project:** Select any available project (e.g., "Bella Marina Bay")
   - **Product:** Select TEST-APT-001 or any available apartment
   - **Customer:** Select any customer
   - **Deposit Amount:** 50,000,000 VND
4. Click Submit/Save
5. **Verify:** Success message or redirect to list
6. **Capture:** Screenshot `p5-5-step-2-created.png`

**Expected:** ✅ Reservation created without errors

**Note product code selected for next steps.**

---

### Step 3: Verify Reservation in List

1. Navigate to: `/dashboard/real-estate/reservations` (if not already there)
2. **Verify:** New reservation appears in list
3. **Check:** Product code matches Step 2
4. **Check:** Status shows "pending_deposit" or equivalent
5. **Capture:** Screenshot `p5-5-step-3-list.png`

**Expected:** ✅ Reservation visible in list

---

### Step 4: Verify Product Status "Giữ chỗ" (Held/Booked)

1. Navigate to: `/dashboard/real-estate/apartments`
2. Find product row (use product code from Step 2)
3. **Verify:** Status badge shows "Giữ chỗ" or "Booked" or "Held"
4. **Verify:** NOT "Còn trống" or "Available"
5. **Capture:** Screenshot `p5-5-step-4-product-held.png`

**Expected:** ✅ Product status = Giữ chỗ/Booked/Held

**Critical:** If status shows "Available", STOP and report defect.

---

### Step 5: Reload → Verify Persistence

1. Press F5 or Ctrl+R to reload page
2. Wait for page to load completely
3. Find same product row again
4. **Verify:** Status still shows "Giữ chỗ" / "Booked" / "Held"
5. **Capture:** Screenshot `p5-5-step-5-persistence.png`

**Expected:** ✅ Product status persisted after reload

**Critical:** If status changed to "Available", STOP and report defect.

---

### Step 6: Cancel Reservation

1. Navigate to: `/dashboard/real-estate/reservations`
2. Find reservation from Step 2
3. Click Cancel/Hủy button (may be icon or menu)
4. Confirm cancellation if modal appears
5. Wait for operation to complete
6. **Verify:** Success message
7. **Verify:** NO error message (especially "INVALID STATE TRANSITION")
8. **Capture:** Screenshot `p5-5-step-6-cancelled.png`

**Expected:** ✅ Reservation cancelled without errors

**Critical:** If "INVALID STATE TRANSITION" error appears, STOP and report defect. This indicates service-layer authorization not working.

---

### Step 7: Verify Product Status "Còn trống" (Available)

1. Navigate to: `/dashboard/real-estate/apartments`
2. Find same product row
3. **Verify:** Status badge shows "Còn trống" or "Available"
4. **Verify:** NOT "Giữ chỗ" or "Booked" or "Held"
5. **Capture:** Screenshot `p5-5-step-7-product-available.png`

**Expected:** ✅ Product status returned to Available

**Critical:** If status still shows "Giữ chỗ", STOP and report defect. This indicates product release not working.

---

## Evidence Required

**All 7 screenshots required:**
1. `p5-5-step-1-login.png` - Dashboard visible
2. `p5-5-step-2-created.png` - Reservation form submitted
3. `p5-5-step-3-list.png` - Reservation in list
4. `p5-5-step-4-product-held.png` - Product status "Giữ chỗ"
5. `p5-5-step-5-persistence.png` - After reload, still "Giữ chỗ"
6. `p5-5-step-6-cancelled.png` - Cancellation success
7. `p5-5-step-7-product-available.png` - Product status "Còn trống"

**Partial evidence = P5.5 NOT VERIFIED.**

---

## Binary Verdict

```text
7/7 PASS
    ↓
P5.5 🔒 VERIFIED
    ↓
P5.6 Full Regression

ANY FAIL
    ↓
Freeze evidence at failure point
    ↓
RCA (Root Cause Analysis)
    ↓
Fix → Redeploy → Rerun full 7-step flow
```

**No partial credit.** All 7 steps must PASS for P5.5 VERIFIED.

---

## Failure Classification

### Step 1-3 Fail
**Classification:** Environment/fixture issue (not P5.5 defect unless proven)
- Login fails → Check Supabase auth
- Navigation fails → Check deployment
- No products available → Check test fixtures

### Step 4 Fail: Product Status Still "Available"
**Classification:** PRODUCT DEFECT
- Service-layer authorization not applied
- Check deployment includes commit `d679d181`
- Verify `createServiceClient()` used in actions

### Step 6 Fail: "INVALID STATE TRANSITION" Error
**Classification:** PRODUCT DEFECT
- Service-layer authorization not working
- Product status not updated during reservation
- RCA required

### Step 7 Fail: Product Status Still "Giữ chỗ"
**Classification:** PRODUCT DEFECT
- Product release not working
- Check `releaseProduct()` service method
- Verify service client permissions

---

## Critical Assertions

**Step 4:** Product MUST show "Giữ chỗ" after reservation created
- If "Available" → Defect: Reservation did not update product status

**Step 6:** Cancellation MUST complete without "INVALID STATE TRANSITION" error
- If error appears → Defect: Service-layer authorization failed

**Step 7:** Product MUST return to "Còn trống" after cancellation
- If still "Giữ chỗ" → Defect: Product release failed

---

## What This Test Proves

**Browser E2E verifies:**
- ✅ Production flow executes end-to-end
- ✅ UI displays correct state
- ✅ User can complete full reservation lifecycle
- ✅ No blocking errors
- ✅ DB state matches UI display

**Browser E2E does NOT prove service-layer authorization:**
- Service-layer auth proven by code review (canonical wiring) ✅
- Browser E2E only confirms **production runtime behavior works**

---

## Playwright Follow-Up

**Status:** Playwright test exists but selector maintenance required

**Files:**
- `e2e/tests/bella-land/p5-5-reservation-workflow.spec.ts`
- Step 1 (Login): ✅ PASS
- Step 2-7: 🟡 Selector alignment needed

**Action:** Keep as automation debt
- Fix selectors after P5.5 manual verification
- Integrate into CI/CD regression suite
- Does NOT block P5.5 verdict

---

## Execution

**Perform manual 7-step flow** on production deployment.

**Share:** All 7 screenshots for P5.5 verdict.

**Status after manual execution:**
- 7/7 PASS → P5.5 🔒 VERIFIED → P5.6
- Any fail → Freeze → RCA → Fix → Redeploy → Rerun

---

**Ready to execute.** Awaiting manual browser E2E results.
