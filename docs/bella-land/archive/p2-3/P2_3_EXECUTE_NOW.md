# P2.3 — Execute B1-B10 Now

**Status:** ▶️ **READY TO EXECUTE**

---

## 🎯 Action Required: Manual Browser Test

You need to **personally execute** the browser test. I cannot interact with the protected preview deployment.

---

## Step-by-Step Execution

### 1. Access Preview Deployment

**Option A: Via GitHub PR**
1. Go to: https://github.com/bellaspahcm/bella-spa-erp/pull/74
2. Find Vercel bot comment
3. Click "Preview" link
4. You'll be authenticated via GitHub/Vercel

**Option B: Direct URL (if you have access)**
- https://bella-spa-erp-git-feat-bella-land-p-3a334c-bella-spa-s-projects.vercel.app

---

### 2. Execute B1-B10

**Follow:** `docs/bella-land/P2_3_MANUAL_EXECUTION_CHECKLIST.md`

**Quick workflow:**

#### B1: Login
- Navigate to preview URL
- Login: `loadtest-realestate@test.local` / `Test123456!`
- Verify redirect to dashboard

#### B2: Page Access
- Go to Real Estate → Apartments
- Or navigate: `/dashboard/real-estate/apartments`
- Verify page loads

#### B3: Button Visible
- Find "Tạo căn mới" button (blue, top area)
- Verify button is clickable

#### B4: Modal Opens
- Click "Tạo căn mới"
- Verify modal appears with form

#### B5: Form Binding
- Fill form with **unique code**:
  - Mã căn: `P2.3-PREVIEW-20260911-001` (or use current timestamp)
  - Loại căn: Căn hộ
  - Block: A
  - Tầng: 5
  - Diện tích: 100
  - Đơn giá: 50000000
  - Trạng thái: Khả dụng
- Verify values bind correctly

#### B6: Form Submission
- Click submit
- Wait for UI state change (not fixed time)
- Verify no errors

#### B7: Success Feedback
- Modal closes
- Success indication appears (toast/notification)
- Product visible in list

#### B8: Browser Runtime Health
- Open DevTools Console
- Check for errors during flow
- Verify no uncaught exceptions

#### B9: Correct Tenant Context
- Product appears under correct tenant
- No cross-tenant data visible
- Correct project context

#### B10: Database Persistence
**Run verification script:**

```bash
npx tsx scripts/bella-land/verify-p2-3-product.ts P2.3-PREVIEW-20260911-001
```

Replace with your actual product code from B5.

**Expected output:**
```
✅ Product found in database
✅ tenant_id:  1a6643da-3806-4793-a301-7a6d60b0d888
✅ project_id: 47685225-5b46-4cbc-a191-2426e6873cb7
✅ product_code: P2.3-PREVIEW-20260911-001
✅ Data integrity: block set, floor set, area set

🎉 B10 VERIFICATION: PASS
```

---

### 3. Document Results

**If 10/10 PASS:**
- Create: `docs/bella-land/P2_3_VERIFIED.md`
- Include: Screenshots, timestamps, DB verification output
- Update: P2.3 status → 🔒 VERIFIED

**If ANY FAIL:**
- Document: Exact failure with screenshots
- Run: Root cause analysis
- Fix: Implementation issue
- Re-deploy: New commit
- Re-test: Full B1-B10 on new deployment

---

## Commands Reference

### Run DB Verification (B10)
```bash
npx tsx scripts/bella-land/verify-p2-3-product.ts <your-product-code>
```

### Check Preview Deployment Status
```bash
gh pr view 74 --json statusCheckRollup
```

---

## Critical Reminders

1. **Use unique product code** with timestamp (e.g., `P2.3-PREVIEW-20260911-001`)
2. **Take screenshots** at each step (B1-B10)
3. **Run DB verification** independently (B10 primary evidence)
4. **Any code change → full re-test** (evidence must match deployment)
5. **10/10 only → VERIFIED** (no partial seal)

---

## After Test

### If 10/10 PASS

```text
P2.3 🔒 VERIFIED
        ↓
Cleanup:
- Remove /test-bella-land-product
- Remove temp test scripts
- Remove Playwright test file (if not needed)
        ↓
P2.4 Full Products Regression
        ↓
P2.5 Products Seal
        ↓
Products 🔒 CLOSED
```

### If ANY FAIL

```text
Freeze failure state
        ↓
Root cause analysis
        ↓
Fix implementation
        ↓
Deploy new commit
        ↓
Re-test FULL B1-B10
        ↓
Do NOT seal until 10/10
```

---

**Current State:**

```text
Preview deployment      ✅ READY
Execution checklist     ✅ READY
DB verification script  ✅ READY
Manual test execution   ▶️ YOUR ACTION REQUIRED

P2.3                    🟡 NOT VERIFIED
Products                🟡 NOT SEALED
```

---

**🎯 Action: Execute B1-B10 now on preview deployment**

