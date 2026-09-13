---
date: 2026-09-13
status: READY TO EXECUTE
type: Test Plan
---

# GIT WORKFLOW CONSTITUTION — ADVERSARIAL TEST PLAN

**Purpose:** Prove enforcement works via adversarial testing before declaring system "operational"

**Status:** 🟡 **READY TO EXECUTE**

---

## 🎯 TEST OBJECTIVES

Verify that Git Workflow Constitution enforcement:
1. **BLOCKS** invalid PRs (multi-scope contamination)
2. **ALLOWS** valid PRs (single-scope, clean)
3. **HANDLES** edge cases (legitimate large PRs, dependency-coupled changes)
4. **RUNS** daily reconciliation automatically
5. **AUTO-CLEANS** branches after merge
6. **PROTECTS** main branch from direct push

---

## 📋 TEST CASES

### Test Case 1: BLOCK Scenario ❌
**Goal:** Prove multi-scope PR is blocked

**Setup:**
```bash
git checkout -b test/multi-scope-violation

# Simulate PR #74 contamination
echo "test" > src/products/bella-english-center/test-e1.ts
echo "test" > src/products/bella-land/test-p5.ts
echo "test" > src/platform/finance/test-f3.ts

git add .
git commit -m "test: intentional multi-scope violation"
git push origin test/multi-scope-violation

gh pr create \
  --title "TEST: Multi-scope contamination" \
  --body "Adversarial test: simulating PR #74 multi-product violation"
```

**Expected Results:**
- ❌ GitHub Actions detects scopes: English Center, Bella Land, Finance
- ❌ PR comment: "MULTI-PRODUCT PR: Product English Center, Product Bella Land"
- ❌ CI status: BLOCKED
- ❌ Cannot merge until fixed

**Pass Criteria:**
- [ ] Violation detected
- [ ] Clear error message
- [ ] PR blocked from merge
- [ ] Suggests split into separate PRs

**Cleanup:**
```bash
gh pr close [PR_NUMBER] --delete-branch
```

---

### Test Case 2: ALLOW Scenario ✅
**Goal:** Prove valid single-scope PR is allowed

**Setup:**
```bash
git checkout -b product/english-center-test-valid

# Single product scope only
echo "export const testFeature = true;" > src/products/bella-english-center/test-feature.ts
echo "test('feature', () => expect(true).toBe(true));" > src/products/bella-english-center/test-feature.test.ts

git add .
git commit -m "feat(e-center): add test feature"
git push origin product/english-center-test-valid

gh pr create \
  --title "E2: Test Valid Single-Scope Feature" \
  --body "Valid PR following Git Workflow Constitution"
```

**Expected Results:**
- ✅ GitHub Actions detects: Product English Center ONLY
- ✅ PR comment: "All Checks Passed"
- ✅ File count: 2 files ✅
- ✅ Single scope detected ✅
- ✅ CI status: PASS
- ✅ Can merge

**After Merge:**
- ✅ Branch auto-deleted
- ✅ PR comment: "Branch auto-deleted after merge"

**Pass Criteria:**
- [ ] PR allowed to proceed
- [ ] CI passes
- [ ] Merge succeeds
- [ ] Branch auto-deleted
- [ ] Cleanup comment posted

**Cleanup:**
```bash
# After merge, branch should be auto-deleted
# Verify: git branch -r | grep test-valid  # should be empty
```

---

### Test Case 3: EXCEPTION Scenario (Platform + Product Coupled) ⚠️
**Goal:** Prove legitimate dependency-coupled PR gets warning, not block

**Setup:**
```bash
git checkout -b platform/org-unit-test-coupled

# Platform contract
echo "export interface BranchContract { id: string; }" > src/platform/org-unit/test-contract.ts

# Product using contract
echo "import { BranchContract } from '@/platform/org-unit/test-contract';" > src/products/bella-english-center/test-use-contract.ts

git add .
git commit -m "feat: org-unit contract + product integration (coupled)"
git push origin platform/org-unit-test-coupled

gh pr create \
  --title "Platform: Org-Unit Contract + Product Integration" \
  --body "**Exception Justification:**

This PR contains both Platform (org-unit) and Product (english-center) changes because they are dependency-coupled and cannot be safely split:

1. Platform change: New BranchContract interface
2. Product change: Use BranchContract interface

Attempting to split would create:
- PR #1: Platform contract → merges to main → no usage yet
- PR #2: Product usage → builds, but references contract from PR #1

This creates temporary broken state. Bundling is justified."
```

**Expected Results:**
- ⚠️ GitHub Actions detects: Platform Org-Unit + Product English Center
- ⚠️ PR comment: "Platform + Product in same PR" (WARNING, not ERROR)
- ⚠️ Requests justification in description
- ✅ CI status: PASS (warning, but not blocked)
- ✅ Human reviewer can approve
- ✅ Can merge after approval

**Pass Criteria:**
- [ ] Warning issued (not error)
- [ ] Clear guidance to justify
- [ ] Not hard-blocked
- [ ] Can merge with approval

**Cleanup:**
```bash
gh pr close [PR_NUMBER] --delete-branch
```

---

### Test Case 4: Large File Count (Edge Case) ⚠️
**Goal:** Prove 100+ file PR requires justification but isn't auto-blocked

**Setup:**
```bash
git checkout -b migration/test-large-seed

# Create 120 small migration files
mkdir -p supabase/migrations/test-seed
for i in {1..120}; do
  echo "-- Test seed data part $i" > supabase/migrations/test-seed/seed_part_$i.sql
done

git add .
git commit -m "migration: large test seed data (120 files)"
git push origin migration/test-large-seed

gh pr create \
  --title "Migration: Large Test Seed Data" \
  --body "**Large File Count Justification:**

120 files, all migration-related seed data.
Each file is a separate seed script for modularity.

Valid exception: Large migration."
```

**Expected Results:**
- ⚠️ GitHub Actions detects: 120 files (> 100)
- ⚠️ PR comment: "PR VERY LARGE: 120 files changed (limit: 100)"
- ⚠️ Requests justification
- ⚠️ Lists valid exceptions: migrations, generated code, coupled changes
- ✅ CI status: PASS with warning (not blocked after workflow update)
- ✅ Can merge with approval

**Pass Criteria:**
- [ ] Large file count detected
- [ ] Warning issued
- [ ] Justification requested
- [ ] Not hard-blocked (after workflow fix)
- [ ] Human can approve exception

**Cleanup:**
```bash
gh pr close [PR_NUMBER] --delete-branch
rm -rf supabase/migrations/test-seed
```

---

### Test Case 5: Daily Reconciliation Cron ⏰
**Goal:** Prove daily reconciliation runs automatically

**Verification Method:**
```bash
# Check if workflow exists
gh workflow view branch-protection.yml

# Check cron schedule
cat .github/workflows/branch-protection.yml | grep -A 2 "schedule:"

# Manual trigger to test immediately (don't wait for midnight)
gh workflow run branch-protection.yml

# Wait 1-2 minutes for run to complete
sleep 120

# Check run status
gh run list --workflow=branch-protection.yml --limit 5

# View latest run logs
gh run view --log

# Check if artifact uploaded
gh run view [RUN_ID]  # should show "branch-reconciliation-report" artifact

# Download and verify report
gh run download [RUN_ID]
cat branch-reconciliation-report/BRANCH_RECONCILIATION_REPORT.md
```

**Expected Results:**
- ✅ Workflow runs (manual trigger or midnight cron)
- ✅ Fetches all remote branches
- ✅ Classifies branches (ACTIVE, STALE, SUPERSEDED, etc.)
- ✅ Generates report
- ✅ Uploads artifact
- ✅ Creates GitHub issue if stale branches found (currently: 7 stale → YES)

**Pass Criteria:**
- [ ] Manual trigger works
- [ ] Cron schedule configured (midnight UTC)
- [ ] Report generated successfully
- [ ] Artifact uploaded
- [ ] Issue created (if stale branches exist)

---

### Test Case 6: Branch Protection Settings 🛡️
**Goal:** Verify main branch protection configured

**Verification Method:**
```bash
# Check via GitHub CLI
gh api repos/:owner/:repo/branches/main/protection

# Or via web UI:
# https://github.com/[owner]/[repo]/settings/branches
# → Branch protection rules for 'main'
```

**Expected Configuration:**
```yaml
Require pull request before merging: ✅
  Required approvals: 0 or 1
  Require review from Code Owners: optional

Require status checks before merging: ✅
  Require branches to be up to date before merging: ✅
  Status checks required:
    - Healthcare Constitution
    - Architecture Guard
    - Migration Gates
    - Gitleaks
    - Build
    - Tests
    - PR Scope Validation (from branch-protection.yml)

Require conversation resolution before merging: ✅

Do not allow bypassing the above settings: ⚠️ (allow admin override for emergencies)

Rules applied to administrators: ❌ (allow emergency fixes)

Allow force pushes: ❌
Allow deletions: ❌
```

**Test Direct Push:**
```bash
# Try to push directly to main (should fail)
git checkout main
echo "test" > test-direct-push.txt
git add test-direct-push.txt
git commit -m "test: direct push (should fail)"
git push origin main

# Expected: ERROR: main is protected
```

**Pass Criteria:**
- [ ] Branch protection rules exist
- [ ] Required status checks configured
- [ ] Direct push to main blocked
- [ ] Force push disabled
- [ ] PR required for all changes

---

## ✅ SUCCESS CRITERIA

System is **PROVEN OPERATIONAL** when:

```
Test Case 1: BLOCK        ✅ Multi-scope PR blocked
Test Case 2: ALLOW        ✅ Valid PR allowed + auto-cleaned
Test Case 3: EXCEPTION    ✅ Coupled PR warned, not blocked
Test Case 4: LARGE PR     ✅ Requires justification, allows override
Test Case 5: DAILY CRON   ✅ Runs automatically, generates report
Test Case 6: PROTECTION   ✅ Main branch protected, direct push blocked
```

**Claim After All Pass:**
> **Git Workflow Constitution — ENFORCEMENT PROVEN ✅**
> 
> Runtime behavior verified through adversarial testing.
> System operational and ready for production use.

---

## 🚫 FAILURE HANDLING

If any test case fails:

1. **Document failure:**
   - What was expected
   - What actually happened
   - Error messages / logs

2. **Root cause analysis:**
   - Workflow logic error?
   - GitHub permissions issue?
   - Configuration missing?

3. **Fix and re-test:**
   - Update workflow YAML
   - Update scripts
   - Update documentation
   - Re-run ALL test cases (not just failed one)

4. **Only claim "PROVEN" after:**
   - All 6 test cases pass
   - No false positives
   - No false negatives
   - Edge cases handled correctly

---

## 📊 TEST EXECUTION LOG

**Date:** [to be filled during execution]  
**Executor:** [AI agent or human]  
**Environment:** GitHub Actions + main repository

| Test Case | Status | Notes | Evidence |
|-----------|--------|-------|----------|
| 1. BLOCK | 🟡 PENDING | | |
| 2. ALLOW | 🟡 PENDING | | |
| 3. EXCEPTION | 🟡 PENDING | | |
| 4. LARGE PR | 🟡 PENDING | | |
| 5. DAILY CRON | 🟡 PENDING | | |
| 6. PROTECTION | 🟡 PENDING | | |

**Overall Status:** 🟡 **NOT YET EXECUTED**

---

## 🎯 EXECUTION TIMELINE

**Phase 1: Setup (5 minutes)**
- Verify GitHub Actions enabled
- Check branch protection settings
- Ensure workflows deployed

**Phase 2: Test Execution (30 minutes)**
- Run Test Cases 1-4 (PR scenarios)
- Trigger Test Case 5 (manual cron)
- Verify Test Case 6 (protection settings)

**Phase 3: Validation (15 minutes)**
- Review all PR comments
- Check CI status checks
- Verify auto-cleanup worked
- Download reconciliation report
- Confirm branch protection blocks

**Phase 4: Documentation (10 minutes)**
- Fill test execution log
- Update status in GIT_WORKFLOW_IMPLEMENTATION_COMPLETE.md
- Create ENFORCEMENT_PROVEN.md if all pass

**Total Time:** ~1 hour

---

## 📖 RELATED DOCUMENTS

- `docs/architecture/GIT_WORKFLOW_CONSTITUTION.md` — Rules
- `docs/architecture/GIT_WORKFLOW_IMPLEMENTATION_COMPLETE.md` — Implementation
- `.github/workflows/branch-protection.yml` — Enforcement workflow
- `scripts/branch-reconciliation.js` — Reconciliation script

---

**Status:** 🟡 **READY TO EXECUTE**  
**Next Action:** Run Test Cases 1-6, document results

