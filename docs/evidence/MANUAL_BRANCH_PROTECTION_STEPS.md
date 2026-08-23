# MANUAL BRANCH PROTECTION CONFIGURATION

**Purpose:** Complete Step ① Architecture Guard to 100%  
**Requires:** Repository Admin access  
**Duration:** 10-15 minutes

---

## 🎯 OBJECTIVE

Enable GitHub branch protection to ENFORCE Architecture Guard checks, not just detect violations.

**Current State:** CI detects violations but cannot block PR merge  
**Target State:** CI detections automatically block PR merge

---

## 📋 STEP-BY-STEP INSTRUCTIONS

### Step 1: Access Branch Protection Settings

1. Navigate to: https://github.com/bellaspahcm/bella-spa-erp/settings/branches
2. Click **"Add rule"** or **"Add branch protection rule"**
3. In **"Branch name pattern"**, enter: `main`

### Step 2: Configure Pull Request Requirements

**Section: "Protect matching branches"**

☑️ **Require a pull request before merging**
- ☑️ Require approvals: **1**
- ☑️ Dismiss stale pull request approvals when new commits are pushed
- ☐ Require review from Code Owners *(optional - leave unchecked for now)*

### Step 3: Configure Status Check Requirements

**Critical Section for Architecture Guard Enforcement:**

☑️ **Require status checks to pass before merging**
- ☑️ Require branches to be up to date before merging

**In the search box below, add these 4 checks (one by one):**

1. Type: `Frozen File Check` → Click when it appears
2. Type: `Architecture Guard Verification` → Click when it appears
3. Type: `Dependency Boundary Check` → Click when it appears
4. Type: `Logistics Kernel Regression` → Click when it appears

**Important:** All 4 checks MUST be added and visible in the "Status checks found in the last week for this repository" list.

**If checks don't appear:**
- Ensure at least one PR has been created (we did: PR #30, #31)
- Checks need to have run at least once to be selectable
- Wait a few minutes and refresh the page

### Step 4: Additional Protection Settings

☑️ **Do not allow bypassing the above settings**
- This ensures even admins must follow the rules

☐ **Allow force pushes** *(leave unchecked)*
☐ **Allow deletions** *(leave unchecked)*

### Step 5: Save Configuration

Click **"Create"** (or **"Save changes"** if editing existing rule)

You should see: "Branch protection rule created" or "Branch protection rule updated"

---

## ✅ VERIFICATION CHECKLIST

After configuration, verify:

### Verification 1: Branch Protection Active

1. Go to: https://github.com/bellaspahcm/bella-spa-erp
2. Look for 🔒 icon next to `main` branch
3. Hover over it - should show "Branch is protected"

### Verification 2: Status Checks Listed

1. Go back to: https://github.com/bellaspahcm/bella-spa-erp/settings/branches
2. Click on `main` rule (if it exists)
3. Scroll to "Require status checks to pass before merging"
4. Verify all 4 checks are listed:
   - ✓ Frozen File Check
   - ✓ Architecture Guard Verification
   - ✓ Dependency Boundary Check
   - ✓ Logistics Kernel Regression

### Verification 3: Test with Mock PR (Optional Quick Test)

**Try to merge PR #31 (the one with frozen file violation):**

1. Go to: https://github.com/bellaspahcm/bella-spa-erp/pull/31
2. Click "Reopen" (since we closed it earlier)
3. Look for merge button status

**Expected Result:** 
- Merge button should be **BLOCKED** or show **"Merging is blocked"**
- Message should indicate: "Required status check 'Frozen File Check' is failing"

**If you see this - SUCCESS!** Branch protection is working.

---

## 🧪 COMPLETE VALIDATION TESTS

After branch protection configured, run this command to execute full validation:

```bash
# This will create test PRs and verify enforcement
npm run step1:validate-enforcement
```

Or manually:

### Test A: Legitimate PR (Should Pass & Merge)

```bash
git checkout -b test/legitimate-a
echo "export const test = 'a';" > src/products/test-a.ts
git add .
git commit -m "test: legitimate change A"
git push origin test/legitimate-a
gh pr create --title "Validation Test A: Legitimate" --body "Should PASS all checks and be mergeable" --base main
```

**Expected:**
- ✅ All 4 Architecture Gate jobs PASS
- ✅ Merge button enabled
- ✅ Can merge successfully

### Test B: Frozen File Violation (Should Block)

```bash
git checkout main
git checkout -b test/frozen-b
echo "// violation" >> src/platform/logistics/domain/inventory.types.ts
git add .
git commit --no-verify -m "test: frozen violation B"
git push origin test/frozen-b
gh pr create --title "Validation Test B: Frozen Violation" --body "Should FAIL Frozen File Check and BLOCK merge" --base main
```

**Expected:**
- ❌ Frozen File Check FAILS
- ✅ Other checks may pass
- ❌ Merge button BLOCKED
- ❌ Cannot merge (enforcement working!)

**This is the critical test that proves 100% enforcement.**

---

## 📊 SUCCESS CRITERIA

**Branch protection is correctly configured when:**

1. ✅ Branch protection rule visible in settings
2. ✅ All 4 Architecture Gate checks required
3. ✅ Test A (legitimate) can be merged
4. ✅ Test B (violation) is BLOCKED from merging
5. ✅ Block message references the failing check

**When all 5 criteria met → Step ① = 100% ✅**

---

## 🚨 TROUBLESHOOTING

### Issue: Checks don't appear in search box

**Cause:** Checks haven't run on this repository yet

**Solution:**
- Checks need at least one run to be selectable
- PR #30 and #31 already ran these checks
- Try refreshing the page
- If still not appearing, create a new PR to trigger checks

### Issue: "Not Found" or 404 when trying to configure

**Cause:** Insufficient permissions

**Solution:**
- Only repository admins can configure branch protection
- Verify you're logged in as repository owner (`bellaspahcm`)
- Check repository settings access

### Issue: Merge button still enabled despite check failure

**Cause:** Status checks not required, or wrong check names

**Solution:**
- Verify exact check names match (case-sensitive)
- Ensure "Require status checks to pass" is checked
- Ensure specific checks are added (not just the option enabled)

### Issue: Can't merge even with passing checks

**Cause:** Other branch protection rules may be active

**Solution:**
- Check if "Require pull request reviews" is blocking
- Verify approval count is set to 1 (not higher)
- Check if branch is up to date requirement

---

## 📝 AFTER CONFIGURATION COMPLETE

**Update these files with evidence:**

1. `docs/evidence/LAYER_4_TEST_EVIDENCE.md`
   - Add Test A and Test B results
   - Include PR numbers, commit SHAs
   - Screenshot of blocked merge (optional)

2. `docs/evidence/STEP_1_FINAL_STATUS.md`
   - Change "CI Enforcement: 0% ⏳" to "CI Enforcement: 100% ✅"
   - Change "Overall: 90%" to "Overall: 100%"
   - Update status from OPEN to COMPLETE

3. Create `docs/evidence/STEP_1_COMPLETION_CERTIFICATE.md`
   - Document all evidence
   - Sign off on completion
   - Reference all PRs and test results

---

## 🎯 ESTIMATED TIME

- **Branch protection config:** 10 minutes
- **Verification tests:** 15-20 minutes
- **Documentation update:** 10 minutes
- **Total:** ~35-40 minutes

---

**Configuration By:** Repository Owner (bellaspahcm)  
**Validation Support:** Can be automated after config  
**Completion Target:** Step ① → 100% before Step ② begins
