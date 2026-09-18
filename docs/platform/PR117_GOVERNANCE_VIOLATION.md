# PR #117 Governance Violation — Multi-Scope Contamination

**Status:** 🛑 BLOCKED — SCOPE VIOLATION DETECTED  
**Date:** 2026-09-18  
**Discovery:** During Type Check (full) failure attribution investigation

---

## Violation Summary

**PR #117 Claimed Scope:** Infrastructure (Identity-Aware No-New-Debt Baseline System)

**Actual Scope in Diff:**

```
✅ Infrastructure (approved):
   scripts/ci/baseline/**
   tests/baseline/**
   .github/workflows/baseline-no-new-debt.yml
   docs/platform/BASELINE_*.md
   docs/platform/BOOTSTRAP_*.md
   docs/platform/IDENTITY_AWARE_*.md

❌ Healthcare (out-of-scope):
   src/platform/healthcare/**
   50+ commits of Healthcare P1 hardening work

❌ Education (out-of-scope):
   src/app/dashboard/education/**
   3 Education UI page modifications

❌ Hospital (out-of-scope):
   References to Hospital UI in commit history
```

**Violation:** Git Workflow Constitution Rule 1 — Single-Scope Mandate

---

## Evidence

### PR Metadata

```
PR: #117
Title: "feat(ci): Identity-Aware No-New-Debt Baseline System"
Branch: infra/identity-aware-baseline
Base: main @ cfd00513
Head: 822139b3
Commits: 50+
```

### Diff Analysis

```bash
git diff cfd00513..822139b3 --name-only | grep "src/"
```

**Result:** Multiple product scopes detected

- Healthcare Kernel: `src/platform/healthcare/**`
- Education UI: `src/app/dashboard/education/**`
- Infrastructure: `scripts/ci/baseline/**`

### Commit History Evidence

```bash
git log cfd00513..822139b3 --oneline
```

**Sample commits showing scope contamination:**

```
c30df1aa fix(healthcare): remove 8 unimplemented contract imports from Service Locator
dd0d94dc fix(healthcare): Batch 23 Laboratory cluster - EventBus boundary fix (19→10)
2f7f825c fix(healthcare): Batch 22 Bed cluster - contract alignment (28→19)
fb77de9d 🔴 Cluster E CLOSED — Healthcare Scope Leak Fixed (231 → 177)
ec445d53 feat(hardening): P1-T1 scoped verification - Healthcare Kernel has 211 diagnostics
822139b3 fix(ci): bootstrap exception handling for missing baseline
```

**Pattern:** Infrastructure PR contains 50+ commits spanning multiple work streams, NOT pure infrastructure.

---

## Type Check Failure Attribution

### Previous Hypothesis

```
Type Check (full): ❌ FAIL
Initial assumption: Pre-existing debt on main
Rationale: Infrastructure-only PR shouldn't introduce Healthcare errors
```

### Discovery

```
Base commit (main @ cfd00513):
  Type Check (full): ✅ SUCCESS
  Date: 2026-09-16
  
PR #117 head (822139b3):
  Type Check (full): ❌ FAIL
  Errors in: Healthcare/Hospital UI pages
  
Conclusion: Failure introduced somewhere in PR #117 branch history
```

### Attribution Correction

```
❌ PREVIOUS CLAIM: "Pre-existing on main"
   Evidence: main/cfd00513 passed Type Check
   Status: FALSE

🟡 CURRENT SIGNAL: "Introduced in PR #117 branch"
   Evidence: Base ✅ → Head ❌
   Status: STRONG SIGNAL
   
❓ NOT YET PROVEN: Exact introducing commit
   Method: Bisect required
   
❓ NOT YET PROVEN: Infrastructure code directly caused errors
   Note: Healthcare changes present, causation unclear
```

**Critical finding:** Initial attribution logic assumed "#117 is infrastructure-only, therefore Healthcare errors must be pre-existing." This assumption was **invalidated by scope contamination discovery**.

---

## Impact on CI Results

### Type Check (full) Errors

```
Diagnostics found in:
- src/app/dashboard/healthcare/queue/tv/page.tsx (TS2322)
- src/app/dashboard/healthcare/salary/page.tsx (TS2345, TS18046 x2)
- src/app/dashboard/healthcare/schedules/page.tsx (TS2322 x2)
- src/app/dashboard/hospital/admissions/page.tsx (TS2741 x3, TS2322 x2)

All errors: Healthcare/Hospital scope
Infrastructure scope diagnostics: 0 observed
```

**Analysis:** Errors align with contaminated scope, NOT infrastructure scope.

### Other CI Failures

4 previously observed failures + 2 unidentified Quality Gates failures remain under investigation. Multi-scope contamination complicates attribution of ALL failures.

---

## Governance Decision

**BLOCKED** 🛑

PR #117 cannot proceed in current form because:

1. ✅ **Scope violation proven** — Multi-scope contamination documented
2. ❌ **Attribution invalidated** — Initial "pre-existing" hypothesis was based on false assumption
3. ❌ **Merge would legitimize contamination** — Accepting this PR sets precedent for multi-scope PRs
4. ❌ **Fix-in-place would worsen violation** — Adding more Healthcare fixes to infrastructure PR deepens contamination

---

## Remediation Path

### Option A: Reconstruct Clean Infrastructure PR (RECOMMENDED)

**Steps:**

```bash
# 1. Checkout clean main
git checkout main
git pull origin main

# 2. Create new clean branch
git checkout -b infra/identity-aware-baseline-v2

# 3. Cherry-pick ONLY infrastructure commits
git cherry-pick <baseline-implementation-commits>
git cherry-pick <bootstrap-fix-commit>
git cherry-pick <verification-docs-commits>

# 4. Verify scope purity
git diff main..HEAD --name-only

# Expected ONLY:
# scripts/ci/baseline/**
# tests/baseline/**
# .github/workflows/baseline-no-new-debt.yml
# docs/platform/BASELINE_*.md
# docs/platform/BOOTSTRAP_*.md
# docs/platform/IDENTITY_AWARE_*.md

# 5. If ANY Healthcare/Education files appear → ABORT, review cherry-picks

# 6. Re-run local verification
npm test -- tests/baseline/

# 7. Push clean branch
git push origin infra/identity-aware-baseline-v2

# 8. Create new PR
gh pr create --title "feat(ci): Identity-Aware No-New-Debt Baseline System" \
  --body "Pure infrastructure PR reconstructed from #117 with scope contamination removed" \
  --base main

# 9. Close contaminated PR #117 with explanation
```

**Expected outcome:**
- Pure infrastructure diff
- Type Check (full) should PASS (if Healthcare errors not in infrastructure code)
- Clean attribution for all CI results
- Validates Single-Scope Mandate

### Option B: Split Into Multiple PRs (ALTERNATIVE)

```
PR A: Healthcare P1 Hardening (50+ commits)
   → Scope: Healthcare Kernel only
   → Base: main @ cfd00513
   → Merge first
   
PR B: Education UI Updates (3 commits)
   → Scope: Education UI only
   → Base: main after PR A merge
   → Merge second
   
PR C: Infrastructure Baseline System (clean)
   → Scope: Infrastructure only
   → Base: main after PR A + B merge
   → Merge last
```

**Drawback:** More complex sequencing, higher risk of rebase conflicts.

---

## Lessons for Factory

### New Rule Required

**Pre-CI Scope Validation Gate:**

```yaml
# .github/workflows/scope-validation.yml
name: Validate PR Scope

on: pull_request

jobs:
  scope-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      
      - name: Analyze changed files
        run: |
          CHANGED_FILES=$(git diff --name-only ${{ github.event.pull_request.base.sha }}...${{ github.event.pull_request.head.sha }})
          
          # Detect product scopes
          HAS_HEALTHCARE=$(echo "$CHANGED_FILES" | grep -c "src/platform/healthcare" || true)
          HAS_EDUCATION=$(echo "$CHANGED_FILES" | grep -c "src/app/dashboard/education" || true)
          HAS_INFRA=$(echo "$CHANGED_FILES" | grep -c "scripts/ci\|.github/workflows" || true)
          
          SCOPE_COUNT=$((HAS_HEALTHCARE + HAS_EDUCATION + HAS_INFRA))
          
          if [ $SCOPE_COUNT -gt 1 ]; then
            echo "❌ MULTI-SCOPE DETECTED"
            echo "Healthcare: $HAS_HEALTHCARE"
            echo "Education: $HAS_EDUCATION"
            echo "Infrastructure: $HAS_INFRA"
            exit 1
          fi
```

**Benefit:** Catches scope contamination BEFORE expensive CI runs.

### Attribution Principle

**Before this incident:**
```
"Infrastructure PR → Healthcare errors → Must be pre-existing"
```

**After this incident:**
```
"Verify scope purity FIRST, then attribute failures"
"PR title/description ≠ PR actual scope"
"Always check diff, not just branch name"
```

---

## Evidence-Based Conclusion

> PR #117 violates Single-Scope Mandate with proven multi-scope contamination (Infrastructure + Healthcare + Education). Type Check failures initially attributed as "pre-existing" were based on false assumption of scope purity. Remediation requires clean reconstruction of infrastructure-only PR, NOT fix-in-place.

**Status:** GOVERNANCE VIOLATION — RECONSTRUCTION REQUIRED  
**Blocker:** Multi-scope contamination proven  
**Action:** Reconstruct clean infrastructure PR from main  
**DO NOT:** Fix Healthcare errors in current PR #117  
**DO NOT:** Merge current PR #117 in any state

---

**Authority:** Git Workflow Constitution Rule 1 (Single-Scope Mandate)  
**Reference:**  
- `docs/platform/PR117_FINAL_CI_SNAPSHOT.md`  
- `.kiro/steering/git-workflow-enforcement.md`
