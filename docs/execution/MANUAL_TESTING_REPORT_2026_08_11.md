# Manual Testing Report - owner_name → customer_id Migration

**Ngày:** 2026-08-11  
**Tester:** Platform Architecture Team  
**Scope:** Verify migration không chỉ đúng database mà đúng trong sản phẩm vận hành  
**Status:** 🔄 IN PROGRESS

---

## Test Principle

> **"Build pass ≠ Nghiệp vụ hoạt động đúng"**

Migration có thể đúng về mặt kỹ thuật nhưng sai về mặt tích hợp. Cần verify:
- UI hiển thị đúng owner từ Person Center
- Fallback owner_name hoạt động cho legacy data
- NULL owner display đúng (placeholder products)
- Filter/search owner hoạt động
- Performance JOIN acceptable

---

## Test Environment

**Database:** Production Supabase (Dev tenant)  
**Tenant:** `2eb42ea0-913e-47dc-8f16-49b9f11d88ac`  
**URL:** http://localhost:3000/dashboard/real-estate/apartments  
**Migration Status:** ✅ Executed (4 parties, 4 products linked, 2 NULL)

**Test Data:**
- 4 owners với customer_id: Phạm Minh Đức, Nguyễn Văn An, Hoàng Kim Khánh, Nguyễn Thị Hoa
- 2 products với NULL customer_id: "Chưa có chủ sở hữu"
- Total: 6 products

---

## Test Cases

### TC-01: Page Load
**Objective:** Verify page loads without errors after migration

**Steps:**
1. Navigate to `/dashboard/real-estate/apartments`
2. Check browser console for errors
3. Check network tab for failed API calls

**Expected:**
- ✅ Page loads successfully
- ✅ No console errors
- ✅ API call to fetch products returns 200
- ✅ Products display in grid/list view

**Actual:**
- [ ] Status: PENDING
- [ ] Console errors: 
- [ ] API status: 
- [ ] Notes:

---

### TC-02: Owner Display (Person Center Data)
**Objective:** Verify products với customer_id hiển thị display_name từ party_parties

**Steps:**
1. Locate products: Phạm Minh Đức, Nguyễn Văn An, Hoàng Kim Khánh, Nguyễn Thị Hoa
2. Check owner name displayed in grid view
3. Hover over product to check tooltip
4. Check owner column in table view

**Expected:**
- ✅ Owner name = `party_parties.display_name` (NOT owner_name TEXT)
- ✅ Hover tooltip shows owner name with UserCheck icon
- ✅ Table column shows owner name
- ✅ No console warnings about missing data

**Test Data:**
| Product | Expected Owner | Source |
|---------|---------------|--------|
| Product 1 | Phạm Minh Đức | party_parties |
| Product 2 | Nguyễn Văn An | party_parties |
| Product 3 | Hoàng Kim Khánh | party_parties |
| Product 4 | Nguyễn Thị Hoa | party_parties |

**Actual:**
- [ ] Status: PENDING
- [ ] Grid view display:
- [ ] Tooltip display:
- [ ] Table view display:
- [ ] Notes:

---

### TC-03: NULL Owner Display (Placeholder Products)
**Objective:** Verify products với NULL customer_id display "—" correctly

**Steps:**
1. Locate 2 products with "Chưa có chủ sở hữu" in legacy owner_name
2. Check owner display in grid view
3. Check hover tooltip (should NOT show owner section)
4. Check table column (should show "—")

**Expected:**
- ✅ Grid view: No owner display (owner section hidden)
- ✅ Hover tooltip: No UserCheck icon section
- ✅ Table column: "—" in gray color
- ✅ No "null" or "undefined" text displayed

**Actual:**
- [ ] Status: PENDING
- [ ] Grid view display:
- [ ] Tooltip display:
- [ ] Table view display:
- [ ] Notes:

---

### TC-04: Fallback to owner_name (If Any)
**Objective:** Verify graceful fallback nếu có products không có customer_id nhưng có owner_name

**Steps:**
1. Check if any products have owner_name but NULL customer_id
2. Verify display falls back to owner_name TEXT
3. Verify no console errors

**Expected:**
- ✅ Display: owner_name TEXT (legacy)
- ✅ No console errors
- ✅ Tooltip shows owner name

**Actual:**
- [ ] Status: PENDING (depends on actual data)
- [ ] Products found with fallback case:
- [ ] Display correct:
- [ ] Notes:

---

### TC-05: Owner Column Sort (If Implemented)
**Objective:** Verify owner column sort hoạt động với customer_display_name

**Steps:**
1. Click on "Chủ sở hữu" column header (if sortable)
2. Verify products sort by owner name
3. Check NULL owners appear at top/bottom

**Expected:**
- ✅ Sort alphabetically by display_name
- ✅ NULL owners grouped at end (or start, depending on sort direction)

**Actual:**
- [ ] Status: PENDING
- [ ] Sort functionality exists:
- [ ] Sort correct:
- [ ] Notes:

---

### TC-06: Owner Filter (If Implemented)
**Objective:** Verify owner filter/search hoạt động

**Steps:**
1. Look for owner filter/search input
2. Type owner name (e.g., "Phạm Minh Đức")
3. Verify products filter correctly
4. Clear filter, verify all products return

**Expected:**
- ✅ Filter by customer_display_name
- ✅ Results match filter criteria
- ✅ Clear filter restores full list

**Actual:**
- [ ] Status: PENDING
- [ ] Filter exists:
- [ ] Filter works:
- [ ] Notes:

---

### TC-07: Product Detail Page (If Exists)
**Objective:** Verify product detail displays owner correctly

**Steps:**
1. Click on a product with owner
2. Navigate to detail page
3. Check owner display
4. Check owner contact info (if displayed)

**Expected:**
- ✅ Owner name displayed from party_parties
- ✅ Detail page loads without errors
- ✅ Contact info accessible (if implemented)

**Actual:**
- [ ] Status: PENDING
- [ ] Detail page exists:
- [ ] Owner display:
- [ ] Notes:

---

### TC-08: Product Edit Page (If Exists)
**Objective:** Verify product edit form handles customer_id correctly

**Steps:**
1. Click edit on a product
2. Check owner field display
3. Try changing owner (if editable)
4. Save and verify

**Expected:**
- ✅ Owner field displays current owner
- ✅ Owner change persists correctly
- ✅ customer_id FK updated in database

**Actual:**
- [ ] Status: PENDING
- [ ] Edit page exists:
- [ ] Owner field editable:
- [ ] Save works:
- [ ] Notes:

---

### TC-09: Performance Check
**Objective:** Verify JOIN với party_parties không làm chậm page load

**Steps:**
1. Open Network tab in browser DevTools
2. Refresh `/dashboard/real-estate/apartments`
3. Check API call time for products query
4. Compare with baseline (if known)

**Expected:**
- ✅ API response time < 1 second (acceptable for 6 products)
- ✅ No N+1 query issues
- ✅ JOIN efficient

**Actual:**
- [ ] Status: PENDING
- [ ] API response time:
- [ ] Query performance:
- [ ] Notes:

---

### TC-10: Console & Network Errors
**Objective:** Verify no errors in browser console or network requests

**Steps:**
1. Open browser DevTools (F12)
2. Check Console tab for errors/warnings
3. Check Network tab for failed requests (red status)
4. Navigate through all Real Estate pages

**Expected:**
- ✅ Zero console errors
- ✅ Zero failed API calls
- ✅ No TypeScript type errors
- ✅ No missing data warnings

**Actual:**
- [ ] Status: PENDING
- [ ] Console errors:
- [ ] Network errors:
- [ ] Notes:

---

## Test Summary

### Overall Status: 🔄 IN PROGRESS

| Category | Test Cases | Passed | Failed | Blocked | Skipped |
|----------|-----------|--------|--------|---------|---------|
| Display | TC-02, TC-03, TC-04 | 0 | 0 | 0 | 0 |
| Functionality | TC-05, TC-06 | 0 | 0 | 0 | 0 |
| Detail/Edit | TC-07, TC-08 | 0 | 0 | 0 | 0 |
| Performance | TC-09 | 0 | 0 | 0 | 0 |
| Stability | TC-01, TC-10 | 0 | 0 | 0 | 0 |

**Total:** 0/10 tests completed

---

## Critical Issues Found

_None yet - testing in progress_

---

## Non-Critical Issues Found

_None yet - testing in progress_

---

## Pass/Fail Criteria

### ✅ PASS Criteria:
- All TC-01, TC-02, TC-03, TC-10 MUST pass (critical path)
- Owner display correct for all scenarios
- No console errors
- Performance acceptable

### ❌ FAIL Criteria:
- Any critical test case fails
- Console errors related to migration
- API calls fail
- Owner display incorrect
- NULL handling broken

### ⚠️ Conditional:
- TC-05, TC-06, TC-07, TC-08 may not exist → SKIP if not implemented
- Non-critical issues can be deferred to backlog

---

## Next Steps After Testing

### If ALL Tests PASS:
1. ✅ Update this document with PASS status
2. ✅ Run Jest integration tests
3. ✅ Deploy to staging
4. ✅ Re-measure baseline (structural reuse, architectural compliance)
5. ✅ Update Executive Summary

### If ANY Test FAILS:
1. ❌ Document failure details
2. ❌ Debug and fix issue
3. ❌ Re-run failed test
4. ❌ **DO NOT proceed** to staging until all critical tests pass

---

## Manual Testing Log

_Will be filled during testing session_

**Started:** [TIME]  
**Completed:** [TIME]  
**Tester:** [NAME]  
**Environment:** Dev (localhost:3000)

---

**Testing Principle:**
> "Không đo baseline khi chưa chứng minh migration hoạt động đúng trong sản phẩm vận hành."

---

**Document Status:** 🔄 Template Ready  
**Next:** Fill in actual test results  
**Owner:** Platform Architecture Team
