# P2.3 Browser Runtime — Verification Checklist

**Date:** 2026-09-11  
**Status:** ▶️ READY FOR VERIFICATION

---

## Implementation Complete

**Production UI:** `/dashboard/real-estate/apartments`

**Added:**
- ✅ "Tạo căn mới" button (blue, next to bulk import)
- ✅ Create modal with full form
- ✅ `handleCreateProduct()` calling `createProductAction`
- ✅ Console logging for evidence
- ✅ Success feedback + list refresh

---

## B1-B10 Acceptance Checklist

### Setup

**Login:**
- Email: `loadtest-realestate@test.local`
- Password: `Test123456!`
- Tenant: K6 Load Test — Real Estate (Tenant A)

**Navigate:** `http://localhost:3000/dashboard/real-estate/apartments`

**Open Console:** F12 → Console tab

---

### Verification Steps

**B1: Open production Apartments UI**
- [ ] Navigate to `/dashboard/real-estate/apartments`
- [ ] Page loads successfully
- [ ] Project selector shows Tenant A projects

**B2: Open Create dialog**
- [ ] Click "Tạo căn mới" (blue button, top right of matrix grid)
- [ ] Modal opens with form
- [ ] Project name shows in modal header

**B3: Select same-tenant Project**
- [ ] Project pre-selected from current view (should be Tenant A project)
- [ ] Verify project ID: `47685225-5b46-4cbc-a191-2426e6873cb7`

**B4: Fill valid Product/Apartment**
- [ ] Mã căn: `P2.3-PROD-01`
- [ ] Loại căn: Căn hộ (apartment)
- [ ] Block: `A`
- [ ] Tầng: `5`
- [ ] Diện tích: `100`
- [ ] Đơn giá: `50000000`
- [ ] Trạng thái: Khả dụng

**B5: Submit via production UI**
- [ ] Click "Tạo căn" button
- [ ] Button shows loading state ("Đang tạo...")
- [ ] Check console logs for invocation path:
  ```
  [P2.3 Production UI] Creating product via createProductAction
  [P2.3 Production UI] Project: 47685225-...
  [P2.3 Production UI] Product Code: P2.3-PROD-01
  [P2.3 Evidence] createProductAction() invoked from browser
  [P2.3 Evidence] Calling ProductService.createProduct()...
  [P2.3 Evidence] ProductService.createProduct() invoked
  [P2.3 Evidence] Layer 5 validation: Verifying parent project ownership...
  [P2.3 Evidence] ✅ Layer 5 validation PASSED
  [P2.3 Evidence] ✅ Product created successfully
  [P2.3 Production UI] ✅ Product created successfully
  ```

**B6: Successful UI state**
- [ ] Modal closes automatically
- [ ] Toast notification: "✅ Tạo căn P2.3-PROD-01 thành công"
- [ ] No error messages

**B7: New row visible in list**
- [ ] Product `P2.3-PROD-01` appears in apartment matrix
- [ ] Correct block (A), floor (5) shown
- [ ] Status badge shows "Khả dụng" (green/emerald)

**B8: Reload page → row persists**
- [ ] Press F5 or navigate away and back
- [ ] Product `P2.3-PROD-01` still visible
- [ ] Data persisted (not just local state)

**B9: DB tenant_id correct**
- [ ] Open browser network tab
- [ ] Check product data in response
- [ ] Verify `tenant_id`: `1a6643da-3806-4793-a301-7a6d60b0d888` (Tenant A)

**B10: DB project_id correct**
- [ ] Verify `project_id`: `47685225-5b46-4cbc-a191-2426e6873cb7` (Tenant A Project)

---

## Expected Console Output

```
[P2.3 Production UI] Creating product via createProductAction
[P2.3 Production UI] Project: 47685225-5b46-4cbc-a191-2426e6873cb7
[P2.3 Production UI] Product Code: P2.3-PROD-01
[P2.3 Evidence] createProductAction() invoked from browser
[P2.3 Evidence] Calling ProductService.createProduct()...
[P2.3 Evidence] ProductService.createProduct() invoked
[P2.3 Evidence] Tenant ID: 1a6643da-3806-4793-a301-7a6d60b0d888
[P2.3 Evidence] Project ID: 47685225-5b46-4cbc-a191-2426e6873cb7
[P2.3 Evidence] Product Code: P2.3-PROD-01
[P2.3 Evidence] Layer 5 validation: Verifying parent project ownership...
[P2.3 Evidence] ✅ Layer 5 validation PASSED - Project belongs to tenant
[P2.3 Evidence] ✅ Product created successfully
[P2.3 Evidence] Product ID: <uuid>
[P2.3 Evidence] ProductService.createProduct() completed
[P2.3 Evidence] ✅ createProductAction() completed successfully
[P2.3 Production UI] ✅ Product created successfully
[P2.3 Production UI] Product ID: <uuid>
```

---

## Pass Criteria

**All B1-B10 must PASS** to close P2.3.

If ANY step fails:
1. Document exact failure
2. Fix implementation
3. Rerun full B1-B10

No partial credit. No averaging.

---

## After Verification

### If B1-B10 PASS:

1. **Document verdict:** Create `P2_3_BROWSER_RUNTIME_VERIFIED.md`
2. **Take screenshot:** Save console output as evidence
3. **Update status:**
   ```text
   P2.3 Browser Runtime        🔒 VERIFIED
   ```
4. **Proceed to P2.4:** Regression testing

### If ANY step FAILS:

1. **Status:** `P2.3 🔴 FAIL`
2. **Document:** Exact failure + RCA
3. **Fix:** Implementation issue
4. **Rerun:** Full B1-B10

---

## Cleanup After P2.3 Closes

**Optional cleanup (can wait until Products seal):**
- Remove `/test-bella-land-product` test page
- Remove `[P2.3 Evidence]` console logs from:
  - `productActions.ts`
  - `ProductService.ts`
  - `/apartments/page.tsx`

**Keep production UI:** The "Tạo căn mới" modal is real feature, not test code.

---

**Status:** ▶️ READY FOR MANUAL VERIFICATION  
**Next:** Execute B1-B10 → Document result → P2.4 or fix

