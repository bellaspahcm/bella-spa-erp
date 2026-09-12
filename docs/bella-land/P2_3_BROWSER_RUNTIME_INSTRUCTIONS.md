# P2.3 Browser Runtime — Evidence Collection Instructions

**Status:** ▶️ READY FOR EXECUTION  
**Objective:** Verify browser UI invokes hardened create path

---

## Test Page Created

**URL:** `/test-bella-land-product`

**Purpose:** Evidence-only page (NOT production UI)

**What it does:**
- Form to create product via `createProductAction`
- Console logging to trace execution path
- Shows success/error response

---

## Evidence Collection Steps

### 1. Start Development Server

```bash
npm run dev
```

### 2. Login as Tenant A User

**Credentials:**
- Email: `loadtest-realestate@test.local`
- Password: `Test123456!`

**Tenant:** K6 Load Test — Real Estate (Tenant A)

### 3. Navigate to Test Page

```
http://localhost:3000/test-bella-land-product
```

### 4. Open Browser DevTools

Press `F12` or right-click → "Inspect"

Go to **Console** tab

### 5. Create Product

**Project ID (Tenant A):**
```
47685225-5b46-4cbc-a191-2426e6873cb7
```

**Product Code:**
```
P2.3-TEST-01
```

Click **"Create Product (via Action)"**

### 6. Capture Console Evidence

Expected console output:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[P2.3 Evidence] Starting product creation
[P2.3 Evidence] Project ID: 47685225-5b46-4cbc-a191-2426e6873cb7
[P2.3 Evidence] Product Code: P2.3-TEST-01
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[P2.3 Evidence] createProductAction() invoked from browser
[P2.3 Evidence] Calling ProductService.createProduct()...
[P2.3 Evidence] ProductService.createProduct() invoked
[P2.3 Evidence] Tenant ID: 1a6643da-3806-4793-a301-7a6d60b0d888
[P2.3 Evidence] Project ID: 47685225-5b46-4cbc-a191-2426e6873cb7
[P2.3 Evidence] Product Code: P2.3-TEST-01
[P2.3 Evidence] Layer 5 validation: Verifying parent project ownership...
[P2.3 Evidence] ✅ Layer 5 validation PASSED - Project belongs to tenant
[P2.3 Evidence] ✅ Product created successfully
[P2.3 Evidence] Product ID: <uuid>
[P2.3 Evidence] ProductService.createProduct() completed
[P2.3 Evidence] ✅ createProductAction() completed successfully
[P2.3 Evidence] Response received: {success: true, data: {...}}
✅ [P2.3 Evidence] Product created successfully
   Product ID: <uuid>
   Tenant ID: 1a6643da-3806-4793-a301-7a6d60b0d888
   Project ID: 47685225-5b46-4cbc-a191-2426e6873cb7
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ VERIFIED: Browser → createProductAction → ProductService.createProduct
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 7. Verify Response on Page

UI should show:
- ✅ Success message
- JSON response with created product
- Product appears in list below form

### 8. Take Screenshot

Capture:
- Browser URL showing `/test-bella-land-product`
- Console output (scrolled to show full invocation path)
- Success response on page

---

## What This Proves

### B1: Browser Invocation Path ✅

**Evidence:**
1. Browser form submission → `createProductAction` (server action)
2. `createProductAction` → `ProductService.createProduct` (hardened service)
3. `ProductService.createProduct` → Layer 5 validation → DB insert
4. Success response with correct tenant_id

**Conclusion:**
UI uses the hardened path verified in P2.1 and P2.2.  
NOT bypassing to direct DB access or unvalidated path.

---

## Acceptance Criteria

```text
✅ Browser form submits to createProductAction
✅ Action calls ProductService.createProduct
✅ Service executes Layer 5 validation
✅ Product created with correct tenant_id
✅ Success response returned to browser

Result: B1 PASS
```

---

## Next Steps After Evidence

1. **Document result:** Create `P2_3_BROWSER_RUNTIME_VERDICT.md`
2. **Save screenshot:** `docs/bella-land/evidence/P2_3_console_trace.png`
3. **Proceed to P2.4:** Regression testing
4. **Then P2.5:** Products seal

---

## Cleanup (Optional)

After evidence collection, you can:

- Remove test page: `src/app/test-bella-land-product/page.tsx`
- Remove console logs from ProductService and productActions (or keep for debugging)
- Delete test product from database (or leave for regression)

**Recommendation:** Keep test page and logs until Products fully sealed, then remove.

---

**Status:** ▶️ READY  
**Next:** Execute steps 1-8 → Capture evidence → Document verdict

