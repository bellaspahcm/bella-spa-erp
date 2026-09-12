---
date: 2026-09-13
scope: E1 V6 UI Manual Test
progress: 0/19 → target 13/19
---

# E1 V6 UI MANUAL TEST CHECKLIST

**Purpose:** Verify E1 UI components render correctly in preview deployment  
**When:** After V1 semantic verification complete  
**Duration:** 5-10 minutes  
**Environment:** Vercel Preview URL

---

## 📋 PRE-TEST VERIFICATION

Before starting UI test, confirm:

- [x] Vercel preview deployment READY
- [ ] V1 semantic verification COMPLETE (12/19)
- [ ] Vercel SSO disabled OR bypass token set
- [ ] Browser: Chrome/Edge (latest)

**Preview URL:** `https://bella-spa-28uiqxh1h-bella-spa-s-projects.vercel.app`

---

## 🎯 TEST SCOPE

### V6 Coverage

E1 V6 focuses on **render verification**, not full E2E flows:

✅ **IN SCOPE:**
- Navigation to English Center section
- Branch list page renders
- Branch hierarchy page renders
- UI components display without errors
- Console shows no critical errors

❌ **OUT OF SCOPE (V7):**
- Creating/editing branches
- Permission checks
- Data mutations
- Full user flows

---

## 🧪 TEST PROCEDURE

### Step 1: Open Preview in Browser

```
URL: https://bella-spa-28uiqxh1h-bella-spa-s-projects.vercel.app
```

**Expected:**
- [ ] Page loads without redirect to Vercel SSO
- [ ] No infinite loading spinner
- [ ] Application shell renders

**If redirected to SSO:** Vercel Protection still enabled, must disable first

---

### Step 2: Navigate to English Center

**Path:** Home → English Center (or via direct URL)

**Direct URL (if navigation broken):**
```
<preview-url>/english-center
```

**Expected:**
- [ ] English Center section exists in navigation
- [ ] Clicking link navigates to English Center
- [ ] Page renders without errors

**Console Check:**
- [ ] No `404` errors for chunks/assets
- [ ] No `Failed to fetch` API errors (acceptable if no test data)
- [ ] No `TypeError` or `ReferenceError`

---

### Step 3: Branch List Page

**Path:** English Center → Branches

**Direct URL:**
```
<preview-url>/english-center/branches
```

**Visual Checks:**
- [ ] Page title/header displays "Branches" or similar
- [ ] Branch list component renders (table/cards/list)
- [ ] Empty state OR sample data displays
- [ ] No white screen / crash

**Console Check:**
- [ ] Open DevTools (F12)
- [ ] Check Console tab
- [ ] Record any errors (screenshot if possible)

**Expected API behavior:**
```
GET /api/english-center/branches?tenantId=...
- 200 with empty array: ✅ OK (no data yet)
- 200 with data: ✅ OK (test data exists)
- 401/403: ⚠️  Expected (no auth yet)
- 500: ❌ Server error (investigate)
```

---

### Step 4: Branch Hierarchy Page

**Path:** English Center → Branches → Hierarchy (or tab/view switch)

**Direct URL:**
```
<preview-url>/english-center/branches/hierarchy
```

**Visual Checks:**
- [ ] Hierarchy view renders
- [ ] Tree/nested structure visible (if data exists)
- [ ] Empty state message (if no data)
- [ ] No component crash

**Console Check:**
- [ ] Check for new errors
- [ ] Verify API call to `/api/english-center/branches/hierarchy`

---

### Step 5: Create Branch UI (If Exists)

**Path:** Branches → "Create" button/link

**Expected:**
- [ ] Create button/link exists
- [ ] Clicking opens form/modal/page
- [ ] Form fields render:
  - Branch name input
  - Parent branch selector (optional)
  - Other fields per spec
- [ ] Form validation works (required fields)

**Do NOT submit form** (out of scope for V6)

---

### Step 6: Console Error Review

**Open DevTools Console:**

**Acceptable (ignore these):**
```
- 401 Unauthorized (no auth yet)
- 403 Forbidden (RLS not configured)
- "No data" / empty responses
- Next.js development warnings
```

**Not Acceptable (must fix):**
```
❌ 404 for app bundles/chunks
❌ TypeError: Cannot read property of undefined
❌ ReferenceError: XYZ is not defined
❌ Failed to compile/render errors
❌ Infinite loops/crashes
```

**Action:** Screenshot any critical errors for investigation

---

### Step 7: Network Tab Review

**Open DevTools Network tab:**

**Check API calls:**
```
✅ GET /api/english-center/branches → 200/401/403
✅ GET /api/english-center/branches/hierarchy → 200/401/403
⚠️  Excessive calls (100+) → possible infinite loop
❌ 404 for API routes → routing broken
❌ 500 errors → server crash
```

**Action:** Record any unexpected patterns

---

## 📊 TEST RESULTS TEMPLATE

```markdown
# E1 V6 UI Manual Test Results
Date: YYYY-MM-DD HH:MM
Tester: [Name]
Preview URL: [URL]

## Summary
- Status: PASS / FAIL / PARTIAL
- Critical Issues: [count]
- Warnings: [count]

## Test Results

### Step 1: Preview Access
- [ ] ✅ / ❌ Page loads without SSO redirect
- [ ] ✅ / ❌ App shell renders

### Step 2: Navigation
- [ ] ✅ / ❌ English Center section accessible
- [ ] ✅ / ❌ Navigation works

### Step 3: Branch List
- [ ] ✅ / ❌ Page renders
- [ ] ✅ / ❌ Components display
- Console errors: [list or "none"]

### Step 4: Branch Hierarchy
- [ ] ✅ / ❌ Page renders
- [ ] ✅ / ❌ Hierarchy view works
- Console errors: [list or "none"]

### Step 5: Create UI (if exists)
- [ ] ✅ / ❌ / N/A Form renders
- [ ] ✅ / ❌ / N/A Fields display

### Step 6: Console Review
Critical errors: [list or "none"]
Warnings (acceptable): [list]

### Step 7: Network Review
API calls: [summary]
Issues: [list or "none"]

## Screenshots
[Attach screenshots of any errors]

## Verdict
- V6 Status: PASS / FAIL
- Reason: [explanation]
- Next: [V7 if pass, fix if fail]
```

---

## ✅ SUCCESS CRITERIA

**V6 PASS if:**
- ✅ Pages load without crashes
- ✅ Components render (even if empty)
- ✅ No critical console errors
- ✅ API routes return expected status (200/401/403)
- ✅ UI matches expected structure

**V6 FAIL if:**
- ❌ White screen of death
- ❌ Critical console errors
- ❌ 404 for API routes
- ❌ Components fail to render
- ❌ App crashes on navigation

**Partial credit:**
- Some pages work, others crash
- Non-critical errors but functional
- → Record details, proceed with caution

---

## 🎯 AFTER V6 COMPLETE

**If PASS:**
```
Progress: 13/19 (68%)
Next: Setup staging/test DB for V2-V8 full suite
Remaining: V2 (isolation), V3 (authz), V4 (access), V5 (migrations), V7 (E2E), V8 (compliance)
```

**If FAIL:**
```
Status: BLOCKED
Action: 
1. Document failures
2. Root cause analysis
3. Fix critical issues
4. Re-test V6
5. Only proceed after PASS
```

---

## 📝 TESTING NOTES

### Browser Requirements
- Use latest Chrome or Edge
- Enable DevTools console
- Disable browser extensions that might interfere

### Network Conditions
- Test on stable connection
- Slow 3G testing optional (out of scope for V6)

### Device Testing
- Desktop browser sufficient for V6
- Mobile testing optional (V7 scope)

### Authentication
- V6 tests rendering only
- Auth flows tested in V3/V7
- 401/403 expected and acceptable

---

## 🔄 RETESTING

**When to retest:**
- After fixing V6 failures
- After modifying UI components
- Before E1 seal (19/19 verification)

**Quick retest checklist:**
1. Clear browser cache
2. Hard reload (Ctrl+Shift+R)
3. Navigate to each page
4. Check console for new errors
5. Verify fixes applied

---

## 📋 QUICK START

**After V1 semantic PASS:**

1. Open browser: `https://bella-spa-28uiqxh1h-bella-spa-s-projects.vercel.app`
2. Open DevTools (F12)
3. Navigate: Home → English Center → Branches
4. Check: Page renders, no critical errors
5. Navigate: Branches → Hierarchy
6. Check: Page renders, no critical errors
7. Review: Console + Network tabs
8. Document: Results in `E1_V6_UI_TEST_RESULTS.md`
9. Report: PASS/FAIL status

**Expected time:** 5-10 minutes

---

**Current Status:** Ready to execute after V1 semantic complete  
**Blocker:** V1 must PASS first (API semantics verified)  
**Next:** V6 manual test → 13/19 → V2-V8 planning

