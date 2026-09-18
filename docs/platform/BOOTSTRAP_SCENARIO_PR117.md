# Bootstrap Scenario — PR #117 Infrastructure

**Date:** 2026-09-18  
**PR:** #117 (Infrastructure)  
**Status:** BOOTSTRAP CIRCULARITY DETECTED

---

## Problem Statement

Infrastructure PR #117 encounters circular dependency:

```
Infrastructure PR → needs baseline → to pass new CI workflow
Baseline generation → needs infrastructure merged → to exist
CIRCULAR DEPENDENCY
```

---

## Actual CI Results (PR #117)

**Run URL:** https://github.com/bellaspahcm/bella-spa-erp/actions/runs/35344076083

**Failures (7):**
```
❌ Identity-Aware No-New-Debt Baseline (NEW WORKFLOW)
❌ CI - Quality Gates / Affected Unit and Integration Tests
❌ CI - Quality Gates / All Required Gates Passed
❌ CI - Quality Gates / Changed-file Lint
❌ Real Estate Module - CI/CD / Code Quality & Security
❌ CI - Quality Gates / Migration Gates  
❌ Decision Engine Deploy / Test Decision Engine
```

**Root Causes:**

### 1. New Workflow Failure (Identity-Aware Baseline)

```
TypeError [ERR_UNKNOWN_FILE_EXTENSION]: Unknown file extension ".ts"
Location: scripts/ci/baseline/compare-with-baseline.ts
```

**Issue A:** Node.js cannot run TypeScript directly  
**Issue B:** Baseline file doesn't exist yet (`.github/ci/baselines/main.json`)

### 2. Historical Failures (Same as PR #116)

Same 6 failures affecting PR #116 also affect Infrastructure PR:
- Type checks, lint, tests, migrations (pre-existing debt)

---

## Bootstrap Solutions

### Solution A: Skip Baseline Check if Baseline Missing

Update `.github/workflows/baseline-no-new-debt.yml`:

```yaml
- name: Check if baseline exists
  id: baseline_check
  run: |
    if [ -f .github/ci/baselines/main.json ]; then
      echo "exists=true" >> $GITHUB_OUTPUT
    else
      echo "exists=false" >> $GITHUB_OUTPUT
    fi

- name: Run baseline comparison
  if: steps.baseline_check.outputs.exists == 'true'
  run: |
    npx tsx scripts/ci/baseline/compare-with-baseline.ts ...
    
- name: Skip baseline (bootstrap)
  if: steps.baseline_check.outputs.exists == 'false'
  run: |
    echo "⚠️  Baseline not found - skipping check (bootstrap scenario)"
    echo "This is expected for infrastructure PR before baseline generation"
```

### Solution B: Compile TypeScript or Use tsx

```yaml
- name: Run baseline comparison
  run: |
    npx tsx scripts/ci/baseline/compare-with-baseline.ts \
      --baseline $BASELINE_PATH \
      --pr-base $PR_BASE_SHA \
      --pr-head $PR_HEAD_SHA
```

---

## Governance Decision Required

**Option 1: Conditional Skip (Recommended)**
- Skip baseline check if baseline file missing
- Document as bootstrap scenario
- Merge infrastructure PR with evidence
- Generate baseline immediately after merge

**Option 2: Pre-generate Empty Baseline**
- Create minimal baseline on infrastructure branch
- Commit it with infrastructure
- Real baseline regenerated after merge

**Option 3: Manual Waiver**
- Human architect approves infrastructure PR
- Override required check
- Document as one-time bootstrap exception

---

## Recommended Path

1. **Fix TypeScript execution** (use `tsx`)
2. **Add conditional skip** for missing baseline
3. **Document bootstrap** in PR description
4. **Merge with evidence** (not bypass)
5. **Generate baseline immediately** after merge
6. **Never need bootstrap again** (baseline exists for all future PRs)

---

## Evidence-Based Decision

This is NOT "bypass CI because we want to."

This IS "infrastructure PR cannot use infrastructure that doesn't exist yet, handled with explicit bootstrap logic."

Key difference:
- ✅ Conditional skip WITH evidence
- ✅ One-time bootstrap scenario
- ✅ Documented in governance
- ❌ NOT silent bypass
- ❌ NOT permanent exemption

---

## Next Steps

1. Fix workflow (tsx + conditional skip)
2. Push fix to PR #117 branch
3. Wait for CI re-run
4. Review with bootstrap context
5. Merge infrastructure
6. Generate baseline from clean main
7. System operational for all future PRs

---

**Status:** AWAITING WORKFLOW FIX
