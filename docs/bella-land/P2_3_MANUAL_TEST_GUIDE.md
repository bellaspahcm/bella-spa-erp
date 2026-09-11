# P2.3 Manual Browser Test Guide

**Status:** Data flow verified, manual UI testing required

---

## Automated Verification Result

```text
✅ B3:  Project context is same-tenant
✅ B4:  Valid product data accepted  
✅ B5:  Product creation via action path
✅ B6:  Successful UI state (simulated)
✅ B7:  New product appears in list
✅ B8:  Product persists after reload
✅ B9:  DB tenant_id correct (1a6643da-3806-4793-a301-7a6d60b0d888)
✅ B10: DB project_id correct (47685225-5b46-4cbc-a191-2426e6873cb7)
```

**Data flow mechanically sound. Manual UI verification remaining.**

---

## Manual Browser Test Steps

### 1. Start Development Server

```bash
npm run dev
```

### 2. Login

**URL:** `http://localhost:3000/login`

**Credentials:**
- Email: `loadtest-realestate@test.local`
- Password: `Test123456!`

### 3. Navigate to Apartments Page

**URL:** `http://localhost:3000/dashboard/real-estate/apartments`

**Expected:** Page loads, shows project selector and apartment matrix

### 4. Open Browser Console

Press `F12` → Console tab

### 5. Click "Tạo căn mới" Button

**Location:** Top right of apartment matrix grid (blue button)

**Expected:** Modal opens with create form

### 6. Fill Form

**Test data:**
- Mã căn: `P2.3-MANUAL-01`
- Loại căn: `Căn hộ` (apartment)
- Block: `A`
- Tầng: `5`
- Diện tích: `100`
- Đơn giá: `50000000`
- Trạng thái: `Khả dụng`

### 7. Submit Form

Click "Tạo căn" button

**Expected console output:**
```
[P2.3 Production UI] Creating product via createProductAction
[P2.3 Production UI] Project: 47685225-5b46-4cbc-a191-2426e6873cb7
[P2.3 Production UI] Product Code: P2.3-MANUAL-01
[P2.3 Evidence] createProductAction() invoked from browser
[P2.3 Evidence] Calling ProductService.createProduct()...
[P2.3 Evidence] ProductService.createProduct() invoked
[P2.3 Evidence] Tenant ID: 1a6643da-3806-4793-a301-7a6d60b0d888
[P2.3 Evidence] Project ID: 47685225-5b46-4cbc-a191-2426e6873cb7
[P2.3 Evidence] Product Code: P2.3-MANUAL-01
[P2.3 Evidence] Layer 5 validation: Verifying parent project ownership...
[P2.3 Evidence] ✅ Layer 5 validation PASSED - Project belongs to tenant
[P2.3 Evidence] ✅ Product created successfully
[P2.3 Evidence] Product ID: <uuid>
[P2.3 Evidence] ProductService.createProduct() completed
[P2.3 Evidence] ✅ createProductAction() completed successfully
[P2.3 Production UI] ✅ Product created successfully
```

**Expected UI:**
- Modal closes
- Toast: "✅ Tạo căn P2.3-MANUAL-01 thành công"
- Product appears in matrix

### 8. Verify Product in List

**Expected:**
- Product `P2.3-MANUAL-01` visible in Block A, Floor 5
- Status badge shows "Khả dụng" (green/emerald)

### 9. Reload Page

Press `F5`

**Expected:**
- Product `P2.3-MANUAL-01` still visible
- Data persists (proves DB write)

### 10. Inspect Network Tab

Open Network tab → Find response with product data

**Verify:**
- `tenant_id`: `1a6643da-3806-4793-a301-7a6d60b0d888`
- `project_id`: `47685225-5b46-4cbc-a191-2426e6873cb7`

---

## Manual Verification Checklist

```text
[ ] B1: Production page loads
[ ] B2: "Tạo căn mới" button opens modal
[ ] B3: Project is same-tenant (verified in data)
[ ] B4: Form accepts valid data
[ ] B5: Console shows full invocation path
[ ] B6: Modal closes + toast notification
[ ] B7: Product appears in list immediately
[ ] B8: Reload → product still visible
[ ] B9: tenant_id correct (network inspection)
[ ] B10: project_id correct (network inspection)
```

---

## After Manual Verification

### If All Pass (10/10):

**Create verdict document:**

```bash
# Document result
docs/bella-land/P2_3_BROWSER_RUNTIME_VERIFIED.md

# Status update
P2.3 Browser Runtime → 🔒 VERIFIED
```

**Cleanup:**

```bash
# Remove test page
rm src/app/test-bella-land-product/page.tsx

# Remove debug logs from:
# - src/modules/real_estate/actions/productActions.ts
# - src/modules/real_estate/services/ProductService.ts
# - src/app/dashboard/real-estate/apartments/page.tsx
```

**Proceed to P2.4 Regression**

### If Any Fail:

**Document failure:**
- Exact step that failed
- Error message
- Screenshot

**RCA → Fix → Rerun full B1-B10**

---

## Quick Test (Alternative)

If you can't run dev server, you can accept the automated verification as sufficient evidence that:
- Data flow works (B3-B10 verified)
- UI implementation correct (code review confirms button/modal/handler)
- Full path exists (createProductAction → ProductService → Layer 5)

**Decision:** Accept automated + code review OR require full manual browser test?

---

**Current Status:** Data flow ✅ / Manual UI ⏸️  
**Next:** Execute manual browser test OR accept automated evidence

