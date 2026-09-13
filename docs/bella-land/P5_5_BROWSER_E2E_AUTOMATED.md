# P5.5 Browser E2E - Automated Test with Playwright

**Status:** Test created, ready to run  
**Test File:** `e2e/tests/bella-land/p5-5-reservation-workflow.spec.ts`  
**Purpose:** Automated verification of P5.5 Reservation workflow after service-layer authorization fix

---

## Test Coverage

**Full 7-step E2E flow:**
1. ✅ Login with test account
2. ✅ Create Reservation (Project → Product → Customer)
3. ✅ Verify reservation appears in list
4. ✅ Verify Product status "Giữ chỗ" (Held/Booked)
5. ✅ Reload page → verify persistence
6. ✅ **Cancel Reservation** (critical - was failing before fix)
7. ✅ **Verify Product status returns to "Còn trống" (Available)** (critical - was failing before fix)

**Security verification:**
- Service-layer authorization working
- Admin-only RLS policy preserved
- No "INVALID STATE TRANSITION" error on cancel
- Product status lifecycle correct

---

## Running the Test

### Option 1: Against Production Deployment

```bash
# Set production URL
export E2E_BASE_URL=https://bella-spa-jgx3zxonb-bella-spa-s-projects.vercel.app

# Run test
npx playwright test p5-5-reservation-workflow --headed

# Or run in UI mode for debugging
npx playwright test p5-5-reservation-workflow --ui
```

### Option 2: Against Localhost

```bash
# Start dev server
npm run dev

# Run test (will use localhost:3000)
npx playwright test p5-5-reservation-workflow --headed
```

### Option 3: CI Mode (Headless)

```bash
npx playwright test p5-5-reservation-workflow
# Screenshots saved to test-results/
# Report: npx playwright show-report
```

---

## Test Configuration

**Test Account:**
- Email: loadtest-realestate@test.local
- Password: Test123456!
- Tenant: 1a6643da-3806-4793-a301-7a6d60b0d888

**Browser:** Chromium (Chrome)

**Timeout:** 120 seconds for full flow

**Screenshots:** Captured at each step in `test-results/`

**Artifacts:**
- `test-results/p5-5-step-1-login.png`
- `test-results/p5-5-step-2-form-filled.png`
- `test-results/p5-5-step-3-list.png`
- `test-results/p5-5-step-4-product-held.png`
- `test-results/p5-5-step-5-persistence.png`
- `test-results/p5-5-step-6-cancelled.png`
- `test-results/p5-5-step-7-product-available.png`

---

## Expected Results

### ✅ All Steps PASS

```text
Step 1: Login...
✅ Step 1 PASS: Logged in successfully

Step 2: Create Reservation...
✅ Step 2 PASS: Reservation created

Step 3: Verify reservation in list...
✅ Step 3 PASS: Reservation visible in list

Step 4: Verify Product status Held/Booked...
   Product status: Giữ chỗ
✅ Step 4 PASS: Product status shows Held/Booked

Step 5: Reload page and verify persistence...
✅ Step 5 PASS: Product status persisted after reload

Step 6: Cancel Reservation...
✅ Step 6 PASS: Reservation cancelled without errors

Step 7: Verify Product status returns to Available...
   Product status: Còn trống
✅ Step 7 PASS: Product status returned to Available

🎉 P5.5 Full Browser E2E: ALL 7 STEPS PASS
   Service-layer authorization working correctly
   Admin-only RLS policy preserved
   Product status lifecycle verified
```

**Key assertions:**
- No "INVALID STATE TRANSITION" error (was failing before fix)
- Product status transitions: available → booked → available
- Reservation cancel completes successfully
- DB state matches UI display

---

## Troubleshooting

### Test fails at Step 1 (Login)

**Symptom:** Cannot find login elements

**Fixes:**
1. Check if deployment is up: `curl ${E2E_BASE_URL}/login`
2. Verify Supabase auth is configured
3. Check test account exists in database

### Test fails at Step 6 (Cancel)

**Symptom:** "INVALID STATE TRANSITION" error

**Root cause:** Service-layer authorization not applied

**Verify fix:**
1. Check commit `d679d181` or later deployed
2. Verify `createServiceClient()` used in reservationActions.ts
3. Check RLS policy: only admin-only policy exists, no generic UPDATE

### Test fails at Step 7 (Product status)

**Symptom:** Product still shows "Giữ chỗ" after cancel

**Root cause:** Product release not working

**Verify:**
1. Check `releaseProduct()` service method called
2. Verify service client has permissions
3. Check DB: Product status should be 'available'

---

## Manual Verification (If Automated Test Cannot Run)

If Playwright cannot run (missing dependencies, browser issues), perform manual browser E2E:

1. Open browser → navigate to deployment URL
2. Login with test account
3. Follow 7-step checklist in `P5_5_BROWSER_E2E_CHECKLIST.md`
4. Capture screenshots at each step
5. Document results

---

## Integration with CI/CD

### GitHub Actions Example

```yaml
name: P5.5 Browser E2E

on:
  push:
    branches: [feat/bella-land-p2-3-production-create-ui]

jobs:
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      
      - name: Install dependencies
        run: npm ci
      
      - name: Install Playwright browsers
        run: npx playwright install chromium
      
      - name: Run P5.5 E2E test
        run: npx playwright test p5-5-reservation-workflow
        env:
          E2E_BASE_URL: ${{ secrets.E2E_DEPLOYMENT_URL }}
      
      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-results
          path: |
            test-results/
            playwright-report/
```

---

## Success Criteria

P5.5 can be marked **VERIFIED** when:

- ✅ Automated test runs successfully (all 7 steps PASS)
- ✅ OR manual browser E2E completed with screenshot evidence
- ✅ No "INVALID STATE TRANSITION" error on cancel
- ✅ Product status lifecycle verified (available → booked → available)
- ✅ Screenshots/evidence captured

---

## Relation to Security Fix

This test verifies the **service-layer authorization** fix (Option B):

**Before fix:**
- Generic UPDATE policy for all authenticated users ❌
- ktv could UPDATE product price/area ❌
- Privilege expansion ❌

**After fix:**
- Admin-only RLS policy preserved ✅
- Service client used for controlled mutations ✅
- Only Product.status affected, not price/area ✅
- Reservation workflow works correctly ✅

This test proves the workflow works WITHOUT compromising security boundaries.

---

## Related Documents

- `docs/bella-land/P5_5_BROWSER_E2E_CHECKLIST.md` - Manual test checklist
- `docs/architecture/FACTORY_RULE_CANONICAL_FIRST_DEVELOPMENT.md` - Test methodology principles
- `src/lib/supabase-service.ts` - Service client implementation
- `src/modules/real_estate/actions/reservationActions.ts` - Refactored actions

---

## Status

```text
Test Created             ✅ COMPLETE
Browsers Installed       ✅ COMPLETE (Chromium)
Test Execution           ⏸️ READY TO RUN
P5.5 Verification        🟡 PENDING TEST RESULTS
```

**Next:** Run test against production deployment and capture results.
