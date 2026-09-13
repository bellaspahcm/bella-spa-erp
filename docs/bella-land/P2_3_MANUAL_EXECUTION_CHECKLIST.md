# P2.3 Manual Execution Checklist

**Date:** 2026-09-11  
**Preview URL:** https://bella-spa-erp-git-feat-bella-land-p-3a334c-bella-spa-s-projects.vercel.app  
**Executor:** [Your name]  
**Status:** ⏸️ **READY FOR EXECUTION**

---

## Pre-Execution

### Environment Check

- [ ] Preview URL accessible
- [ ] Browser ready: Chrome/Firefox
- [ ] DevTools open: F12 → Console tab
- [ ] Screenshot tool ready
- [ ] Test credentials confirmed

### Evidence Type

**Since deployment contains fresh code (commit 5413569a):**

- [x] **Execute FULL B1-B10** (not combined evidence)
- [ ] ~~Combined evidence~~ (not applicable - fresh deployment)

**Rationale:** Fresh deployment requires clean evidence chain.

---

## Full B1-B10 Execution

### B1: Login

**Time:** ___:___ 

- [ ] Navigate: https://bella-spa-erp-git-feat-bella-land-p-3a334c-bella-spa-s-projects.vercel.app
- [ ] Click login or navigate to `/login`
- [ ] Email: `loadtest-realestate@test.local`
- [ ] Password: `Test123456!`
- [ ] Click login button
- [ ] Redirected to dashboard
- [ ] Screenshot: `P2_3_B1_login.png`

**Result:** [ ] PASS [ ] FAIL

**Notes:**
```


```

---

### B2: Page Access

**Time:** ___:___

- [ ] Navigate to Real Estate section
- [ ] Click "Apartments" or navigate to `/dashboard/real-estate/apartments`
- [ ] Page loads completely
- [ ] Project selector visible
- [ ] Apartment matrix/list visible
- [ ] No console errors
- [ ] Screenshot: `P2_3_B2_page_loaded.png`

**Result:** [ ] PASS [ ] FAIL

**Notes:**
```


```

---

### B3: Button Visible

**Time:** ___:___

- [ ] "Tạo căn mới" button visible (blue, top area)
- [ ] Button has correct styling
- [ ] Button enabled (not disabled)
- [ ] Button clickable (hover shows pointer cursor)
- [ ] Screenshot: `P2_3_B3_button_visible.png`

**Result:** [ ] PASS [ ] FAIL

**Notes:**
```


```

---

### B4: Modal Opens

**Time:** ___:___

- [ ] Click "Tạo căn mới" button
- [ ] Modal/dialog appears
- [ ] Modal overlay visible
- [ ] Form fields rendered
- [ ] Project context shown in modal header
- [ ] Screenshot: `P2_3_B4_modal_open.png`

**Result:** [ ] PASS [ ] FAIL

**Notes:**
```


```

### B5: Form Fields Bind Correctly

**Time:** ___:___ 

- [ ] Form visible in modal
- [ ] Fill form with unique product code:
  - [ ] Mã căn: `P2.3-PREVIEW-{timestamp}` (e.g., `P2.3-PREVIEW-20260911-001`)
  - [ ] Loại căn: Select "Căn hộ" (apartment)
  - [ ] Block: `A`
  - [ ] Tầng: `5`
  - [ ] Diện tích: `100`
  - [ ] Đơn giá: `50000000`
  - [ ] Trạng thái: "Khả dụng" (available)
- [ ] Verify all values appear correctly in form fields
- [ ] Form validation works (if any)
- [ ] Screenshot: `P2_3_B5_form_filled.png`

**Product code used:** ___________________

**Result:** [ ] PASS [ ] FAIL

**Notes:**
```


```

---

### B6: Form Submission

**Time:** ___:___

- [ ] Console clear and visible in DevTools
- [ ] Click submit button ("Tạo căn" or similar)
- [ ] Button shows loading state (if implemented)
- [ ] Wait for UI state change or action completion (not fixed time)
- [ ] Submission completes without exception
- [ ] Screenshot: `P2_3_B6_submission.png`

**Result:** [ ] PASS [ ] FAIL

**Notes:**
```


```

---

### B7: Success Feedback

**Time:** ___:___

- [ ] Modal closes (automatically or manually)
- [ ] Successful user-visible state (toast, notification, or UI update)
- [ ] No error messages visible
- [ ] Product data appears in list/matrix
- [ ] Screenshot: `P2_3_B7_success_toast.png`

**Note:** Exact toast wording not required; successful state + data appearance is acceptance.

**Result:** [ ] PASS [ ] FAIL

**Notes:**
```


```

---

### B8: Browser Runtime Health

**Time:** ___:___

- [ ] Open browser DevTools Console (if not already open)
- [ ] Review console output from submission
- [ ] No uncaught browser errors (red errors)
- [ ] No failed request/action relevant to create flow
- [ ] Submission completed without runtime exception
- [ ] Screenshot: `P2_3_B8_console_clean.png`

**Result:** [ ] PASS [ ] FAIL

**Notes:**
```


```

---

### B9: Correct Tenant Context

**Time:** ___:___

- [ ] Product appears in list/matrix
- [ ] Product created under correct tenant (K6 Load Test)
- [ ] Production UI does not expose foreign-tenant context
- [ ] No cross-tenant data leakage visible in UI
- [ ] Product belongs to test project (47685225-5b46-4cbc-a191-2426e6873cb7)
- [ ] (RLS enforcement already verified in P2.2 - 10/10 PASS)
- [ ] Screenshot: `P2_3_B9_tenant_context.png`

**Result:** [ ] PASS [ ] FAIL

**Notes:**
```


```

---

### B10: Database Persistence & Ownership

**Time:** ___:___

**PRIMARY EVIDENCE: Independent DB query**

**Method: Direct database verification (required)**

- [ ] Open separate terminal or database client
- [ ] Execute independent query:

```sql
-- PostgreSQL/Supabase query
SELECT 
  id, tenant_id, project_id, product_code, 
  block, floor, area, unit_price, status, created_at
FROM real_estate_products
WHERE product_code = 'P2.3-PREVIEW-{your-code}'
ORDER BY created_at DESC
LIMIT 1;
```

**Acceptance criteria:**
- [ ] Query returns exactly 1 row
- [ ] `tenant_id` = `1a6643da-3806-4793-a301-7a6d60b0d888`
- [ ] `project_id` = `47685225-5b46-4cbc-a191-2426e6873cb7`
- [ ] `product_code` matches your unique code from B5
- [ ] Field semantics correct (block, floor, area, price match input)
- [ ] `created_at` is recent (within test execution time)

**SECONDARY EVIDENCE: Network inspection (optional)**

- [ ] Open Network tab in DevTools
- [ ] Reload page to capture product fetch
- [ ] Inspect response for product data
- [ ] Verify tenant_id and project_id in JSON (if visible)
- [ ] Screenshot: `P2_3_B10_network_verification.png` (optional)

**Note:** Server Actions may not expose JSON like REST APIs. Independent DB query is primary acceptance.

**Result:** [ ] PASS [ ] FAIL

**Notes:**
```


```

---

## Evidence Summary

**Test Date:** _______________  
**Test Time:** ___:___ - ___:___  
**Executor:** _______________  
**Environment:** Vercel Preview  
**URL:** https://bella-spa-erp-git-feat-bella-land-p-3a334c-bella-spa-s-projects.vercel.app

**Evidence Type:** [x] Full B1-B10 (fresh deployment)

### Results

- [ ] B1: Login
- [ ] B2: Page access
- [ ] B3: Button visible
- [ ] B4: Modal opens
- [ ] B5: Form binding
- [ ] B6: Form submission
- [ ] B7: Success feedback
- [ ] B8: Browser runtime health
- [ ] B9: Correct tenant context
- [ ] B10: Database persistence & ownership

**Total:** ___/10 PASS

**Verdict:** [ ] 10/10 PASS → P2.3 VERIFIED [ ] ANY FAIL → RCA required

---

## Screenshots Captured

- [ ] `P2_3_B1_login.png`
- [ ] `P2_3_B2_page_loaded.png`
- [ ] `P2_3_B3_button_visible.png`
- [ ] `P2_3_B4_modal_open.png`
- [ ] `P2_3_B5_form_filled.png`
- [ ] `P2_3_B6_submission.png`
- [ ] `P2_3_B7_success_toast.png`
- [ ] `P2_3_B8_console_clean.png`
- [ ] `P2_3_B9_tenant_context.png`
- [ ] `P2_3_B10_network_verification.png`

---

## Post-Execution

### If 10/10 PASS

- [ ] Create `P2_3_BROWSER_RUNTIME_VERIFIED.md` using verdict template
- [ ] Attach all screenshots
- [ ] Document product code used
- [ ] Update status: P2.3 → 🔒 VERIFIED
- [ ] Proceed to cleanup phase:
  - Remove `/test-bella-land-product` test page
  - Remove temporary test scripts
  - Remove Playwright test file (if not needed)
- [ ] P2.4 Full Products Regression
- [ ] P2.5 Products Seal

### If ANY FAIL

- [ ] Freeze failure state on preview deployment
- [ ] Document exact failure with screenshots
- [ ] Root cause analysis
- [ ] Fix implementation if needed
- [ ] Re-deploy if code changes required
- [ ] Rerun FULL B1-B10 (not just failed steps)
- [ ] Do NOT seal until 10/10

---

**Checklist Status:** ✅ Ready for execution on Vercel preview

**Preview URL:** https://bella-spa-erp-git-feat-bella-land-p-3a334c-bella-spa-s-projects.vercel.app

**Test credentials:**
- Email: `loadtest-realestate@test.local`
- Password: `Test123456!`

⚠️ **Security Note:** These credentials are exposed in documentation. After RC complete, rotate password or disable test account.

**Target:** `/dashboard/real-estate/apartments` → "Tạo căn mới"

**Critical:** Use unique product code with timestamp (e.g., `P2.3-PREVIEW-20260911-001`)

---

## Acceptance Summary

**B1-B8:** Browser/UI runtime verification  
**B9:** Correct tenant context in production flow  
**B10:** Independent DB persistence + project/tenant ownership (PRIMARY EVIDENCE)

**10/10 PASS required for P2.3 VERIFIED**

