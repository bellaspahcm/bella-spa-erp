# BRANCH PROTECTION CONFIGURATION

**Status:** ⏳ **REQUIRES MANUAL CONFIGURATION**  
**Reason:** Current GitHub token has READ-only access  
**Required Permission:** ADMIN access to repository

---

## 🎯 REQUIRED CONFIGURATION

### Step 1: Access Branch Protection Settings

1. Go to: https://github.com/bellaspahcm/bella-spa-erp/settings/branches
2. Click "Add rule" or "Add branch protection rule"
3. Branch name pattern: `main`

### Step 2: Configure Protection Rules

**Check the following options:**

#### ✅ Require a pull request before merging
- [x] Require a pull request before merging
- [x] Require approvals: **1**
- [x] Dismiss stale pull request approvals when new commits are pushed
- [ ] Require review from Code Owners (optional)

#### ✅ Require status checks to pass before merging
- [x] Require status checks to pass before merging
- [x] Require branches to be up to date before merging

**Add these 4 required status checks:**
1. `Frozen File Check`
2. `Architecture Guard Verification`
3. `Dependency Boundary Check`
4. `Logistics Kernel Regression`

**How to add:**
- Type the check name in the search box
- Click on it when it appears
- All 4 must be added

#### ✅ Enforce for administrators
- [x] Do not allow bypassing the above settings

#### ❌ Disable force pushes and deletions
- [ ] Allow force pushes (LEAVE UNCHECKED)
- [ ] Allow deletions (LEAVE UNCHECKED)

### Step 3: Save Configuration

Click **"Create"** or **"Save changes"**

---

## 📋 VERIFICATION

After configuration, verify:

1. **Try direct push to main:**
   ```bash
   echo "test" >> README.md
   git add README.md
   git commit -m "test: direct push"
   git push origin main
   ```
   
   **Expected:** ❌ Push rejected (requires PR)

2. **Check status checks:**
   - Go to: https://github.com/bellaspahcm/bella-spa-erp/settings/branches
   - Verify all 4 checks are listed under "Status checks that are required"

3. **Check branch protection indicator:**
   - Branch `main` should show a lock icon 🔒
   - Hovering shows "Branch is protected"

---

## 🎯 WHY THIS IS CRITICAL

**Without branch protection:**
- Developers can push directly to main (bypassing Layer 4)
- PRs can be merged without CI passing
- Layer 3 can be bypassed with `--no-verify`
- Architecture Guard is NOT enforced at repository level

**With branch protection:**
- ALL changes MUST go through PR
- CI MUST pass before merge
- Even `--no-verify` bypass is caught by CI
- Repository-level enforcement is proven

---

## 📊 TEST 3 DEPENDENCY

**Test 3 (--no-verify bypass) CANNOT be validated without branch protection.**

**Why:**
```
Developer: git commit --no-verify (Layer 3 bypassed)
           git push origin branch
           Create PR to main
           
Without branch protection:
    → PR can be merged even if CI fails
    → Bypass successful ❌
    
With branch protection:
    → PR BLOCKED until CI passes
    → CI detects frozen file violation
    → Bypass FAILED ✅
```

**This is the CRITICAL test that proves repository-level enforcement.**

---

## 🔧 CURRENT STATUS

**Attempted automated configuration:**
```bash
gh api repos/bellaspahcm/bella-spa-erp/branches/main/protection -X PUT
```

**Result:** `HTTP 404: Not Found`

**Root Cause:** Current GitHub token has `READ` permission only.

**Permission needed:** `ADMIN` access to repository.

**Resolution:** Manual configuration by repository owner/admin.

---

## 📅 NEXT STEPS

**After branch protection configured:**

1. ✅ Verify protection is active (try direct push → blocked)
2. ✅ Execute Test 1: Legitimate PR (should pass)
3. ✅ Execute Test 2: Frozen file modification (should block)
4. ✅ Execute Test 3: --no-verify bypass (should block) ← CRITICAL
5. ✅ Execute Test 4: Guard modification (should block)
6. ✅ Execute Test 5: E7.1 → E7.2 dependency (should block)
7. ✅ Execute Test 6: Regression failure (should block)
8. ✅ Execute Test 7: Multiple violations (should block)

**All 7 tests must pass to complete Step ① validation.**

---

**Configuration Required By:** Repository Owner/Admin  
**Blocker Type:** Permission (not technical)  
**Est. Configuration Time:** 5-10 minutes  
**Current Token Permission:** READ (insufficient)
