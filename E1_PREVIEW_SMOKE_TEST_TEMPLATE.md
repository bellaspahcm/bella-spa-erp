---
date: 2026-09-13
type: E1 Preview Smoke Test
status: READY TO EXECUTE (needs preview URL)
---

# E1 PREVIEW SMOKE TEST

> **Quick runtime verification checklist. Execute when preview URL is ready.**

---

## 📋 PREREQUISITES

- [x] Preview deployment status: `Ready`
- [ ] Preview URL: `_______________________________` ← **FILL THIS**
- [ ] Commit verified: `6d991700` or later (includes 3fbe5c24 E1 code)
- [ ] Branch verified: `feat/bella-land-p2-3-production-create-ui`

---

## 🧪 V1 PARTIAL: API ENDPOINT SMOKE

### Setup
```bash
# Set preview URL (replace with actual)
export PREVIEW_URL="___________________________"  # ← FILL THIS
export TENANT_ID="test-tenant-1"  # Or your actual tenant ID
```

### Test 1: Branches List Endpoint
```bash
curl -i "${PREVIEW_URL}/api/english-center/branches?tenantId=${TENANT_ID}"
```

**Expected responses:**
- ✅ `200` + JSON array → Full success (DB connected, data exists)
- ⚠️ `200` + `[]` → Success but no data (OK for preview)
- ⚠️ `404` → Route exists, no data found (acceptable)
- ⚠️ `401/403` → Auth required (expected without token)
- ⚠️ `500` → Server error (check logs, likely no migration in preview DB)
- ❌ Connection error → Preview not deployed or wrong URL

**Actual result:**
- Status code: `_______`
- Response body: `_______________________________`
- Verdict: ✅ PASS / ⚠️ ENVIRONMENT-LIMITED / ❌ FAIL

---

### Test 2: Hierarchy Endpoint
```bash
curl -i "${PREVIEW_URL}/api/english-center/branches/hierarchy?tenantId=${TENANT_ID}"
```

**Expected responses:** Same as Test 1

**Actual result:**
- Status code: `_______`
- Response body: `_______________________________`
- Verdict: ✅ PASS / ⚠️ ENVIRONMENT-LIMITED / ❌ FAIL

---

### Test 3: Single Branch Endpoint
```bash
curl -i "${PREVIEW_URL}/api/english-center/branches/branch-test-id?tenantId=${TENANT_ID}"
```

**Expected responses:**
- ⚠️ `404` → Expected (branch-test-id doesn't exist)
- ✅ Route exists and responds correctly

**Actual result:**
- Status code: `_______`
- Response body: `_______________________________`
- Verdict: ✅ PASS / ⚠️ ENVIRONMENT-LIMITED / ❌ FAIL

---

### V1 Summary
- [ ] Endpoints exist: YES/NO
- [ ] Routes respond: YES/NO
- [ ] Build includes E1 routes: YES/NO
- [ ] Database needed: YES (for full test) / NO (route-only check OK)

**V1 Verdict:** ✅ PASS / ⚠️ ENVIRONMENT-LIMITED / ❌ FAIL

---

## 🎨 V6 PARTIAL: UI COMPONENT RENDERING

### Test 4: English Center Route Exists
```bash
# Open in browser
open "${PREVIEW_URL}/english-center"
# Or manually navigate to: [preview-url]/english-center
```

**Expected:**
- ✅ Page loads
- ⚠️ 404 → Route not configured (check next.config.js)
- ❌ 500 → Server error

**Actual result:**
- Page loads: YES/NO
- Status code: `_______`
- Screenshot: [attach if possible]

---

### Test 5: UI Components Render

**Manual checks (open DevTools: F12 → Console):**

1. **Navigation/Menu:**
   - [ ] English Center menu item visible
   - [ ] Clicking navigates to English Center section

2. **Page Structure:**
   - [ ] Page header renders
   - [ ] No white screen / blank page
   - [ ] Loading states (if any) display correctly

3. **E1 Components (if visible):**
   - [ ] BranchSelector component present (even if empty)
   - [ ] BranchHierarchyTree renders (even if "No data")
   - [ ] Components gracefully handle missing data

4. **Console Errors:**
   - [ ] No JavaScript errors
   - [ ] No unhandled promise rejections
   - [ ] No "Cannot read property of undefined"
   - [ ] Network errors acceptable (if no staging DB)

**Actual results:**
- Components render: YES/NO
- Console errors: [list any]
- Screenshots: [attach]

---

### Test 6: Route Configuration

**Check route files exist in build:**

In Vercel deployment logs, verify:
- [ ] `api/english-center/branches/route.ts` compiled
- [ ] `api/english-center/branches/[id]/route.ts` compiled
- [ ] `api/english-center/branches/hierarchy/route.ts` compiled
- [ ] No build errors related to English Center routes

**Actual result:**
- Routes compiled: YES/NO
- Build errors: [list if any]

---

### V6 Summary
- [ ] English Center route exists: YES/NO
- [ ] UI renders without crashes: YES/NO
- [ ] Components handle empty state: YES/NO
- [ ] Console errors: [count]

**V6 Verdict:** ✅ PASS / ⚠️ PARTIAL / ❌ FAIL

---

## 📊 OVERALL PREVIEW SMOKE TEST RESULTS

### Summary
- **V1 API Endpoints:** ✅ PASS / ⚠️ ENVIRONMENT-LIMITED / ❌ FAIL
- **V6 UI Components:** ✅ PASS / ⚠️ PARTIAL / ❌ FAIL

### Evidence Collected
- [ ] API endpoint responses recorded
- [ ] UI screenshots captured
- [ ] Console logs saved
- [ ] Vercel build logs reviewed

### Verdict
- ✅ **PASS** — Routes exist, UI renders, ready for staging verification
- ⚠️ **ENVIRONMENT-LIMITED** — Routes work but need DB for data
- ❌ **FAIL** — Critical errors, code needs fixes

---

## 🎯 NEXT STEPS BASED ON RESULTS

### IF PASS or ENVIRONMENT-LIMITED

**Preview proved:**
- ✅ Build compiles successfully
- ✅ E1 routes exist in deployment
- ✅ UI components render
- ✅ No critical runtime errors

**Next actions:**
1. Document results in `DEPLOYMENT_STATUS_2026_09_13.md`
2. Setup E1 runtime environment (staging/local)
3. Apply migrations to staging DB
4. Seed test data
5. Execute V1-V8 full verification suite
6. Reconcile E1 seal criteria: 11/19 → 19/19

**Ready for:** Full E1 runtime verification (V1-V8)

---

### IF FAIL

**Preview showed critical issues:**
- ❌ Routes don't exist (build problem)
- ❌ UI crashes on load (runtime error)
- ❌ Console errors prevent functionality

**Next actions:**
1. Review Vercel build logs
2. Identify root cause:
   - TypeScript errors → Fix types
   - Build configuration → Fix next.config.js
   - Runtime errors → Debug and fix
   - Missing dependencies → Update package.json
3. Fix locally
4. Test: `npm run build:prod` + `npm run dev`
5. Commit fix
6. Push
7. Wait for new preview deployment
8. Re-run smoke tests

---

## 📝 EXECUTION LOG

**Executed by:** _______________________  
**Date/Time:** _______________________  
**Preview URL:** _______________________  
**Commit verified:** _______________________  

**V1 Results:**
- Test 1: _______
- Test 2: _______
- Test 3: _______
- Verdict: _______

**V6 Results:**
- Test 4: _______
- Test 5: _______
- Test 6: _______
- Verdict: _______

**Overall Verdict:** _______

**Next Action:** _______________________

---

## 🔗 REFERENCES

- Deployment Status: `docs/products/bella-english-center/DEPLOYMENT_STATUS_2026_09_13.md`
- Full E1 Verification: `docs/products/bella-english-center/E1_RUNTIME_VERIFICATION_PLAN.md`
- Vercel Dashboard: https://vercel.com/bellaspahcm/bella-spa-erp/deployments

---

**Status:** 📋 Template ready, awaiting preview URL  
**When ready:** Fill in preview URL and execute tests above

