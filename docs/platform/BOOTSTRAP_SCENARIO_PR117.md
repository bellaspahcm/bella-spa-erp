# Bootstrap Scenario — Infrastructure PR #117

**Status:** ✅ BOOTSTRAP LOGIC VERIFIED  
**Date:** 2026-09-18  
**Commit:** 822139b3

---

## Context

Infrastructure PR #117 introduces Identity-Aware No-New-Debt Baseline System, which requires a baseline file (`.github/ci/baselines/main.json`) to operate. However:

- **Circular dependency:** Baseline file can only be generated AFTER infrastructure is merged to `main`
- **Bootstrap problem:** Infrastructure PR cannot have baseline file during its own CI run

---

## Bootstrap Fix

**File:** `.github/workflows/baseline-no-new-debt.yml`  
**Commit:** 822139b3

### Implementation

```yaml
- name: Check if baseline exists
  id: baseline_check
  run: |
    if [ ! -f "$BASELINE_FILE" ]; then
      echo "exists=false" >> $GITHUB_OUTPUT
      echo "🔸️  Baseline not found (bootstrap scenario)"
    else
      echo "exists=true" >> $GITHUB_OUTPUT
    fi

- name: Skip baseline check (bootstrap)
  if: steps.baseline_check.outputs.exists == 'false'
  run: |
    echo "🔸️  BOOTSTRAP SCENARIO"
    echo "Baseline file not found: .github/ci/baselines/main.json"
    echo ""
    echo "This is expected for infrastructure PR #117 before baseline generation."
    echo "Baseline will be generated immediately after infrastructure merge."
    echo ""
    echo "✓ Skipping baseline comparison (documented bootstrap exception)"

- name: Run baseline comparison
  if: steps.baseline_check.outputs.exists == 'true'
  run: |
    npx tsx scripts/ci/baseline/compare-with-baseline.ts \
      --baseline "$BASELINE_FILE" \
      --pr-base "${{ github.event.pull_request.base.sha }}" \
      --pr-head "${{ github.event.pull_request.head.sha }}"
```

### Key Principles

1. **Explicit detection:** Check baseline existence, don't assume
2. **Documented skip:** Log clear message explaining bootstrap scenario
3. **NO silent bypass:** Evidence in CI log that bootstrap path was taken
4. **One-time only:** Only Infrastructure PR #117 should trigger this path

---

## CI Evidence

**PR #117:** https://github.com/bellaspahcm/bella-spa-erp/pull/117  
**Workflow Run:** https://github.com/bellaspahcm/bella-spa-erp/actions/runs/35344520581

### Result

```
✅ Identity-Aware No-New-Debt Baseline: SUCCESS (48s)

Log output:
🔸️ BOOTSTRAP SCENARIO
Baseline file not found: .github/ci/baselines/main.json

This is expected for infrastructure PR #117 before baseline generation.
Baseline will be generated immediately after infrastructure merge.

✓ Skipping baseline comparison (documented bootstrap exception)
```

### Other CI Results (PR #117)

**Total:** 47 checks  
**Status:** 29 ✅ | 4 ❌ | 11 skipped | 3 pending

**Failures (pattern matching PR #116):**
```
❌ CI - Quality Gates / Affected Unit and Integration Tests  
   → Same failure pattern as PR #116 (Payroll failures)
   
❌ Real Estate Module - CI/CD / Code Quality & Security  
   → CASCADE from unit test failures
   
❌ CI - Quality Gates / Migration Gates  
   → Same failure pattern as PR #116 (20260511500000 blocking-index violation)
   
❌ Decision Engine Deploy / Test Decision Engine  
   → Same failure pattern as PR #116 (Payroll Provider Expected: 150000, Received: 200000)
```

**Observation:** Same 4 failures affect BOTH PR #116 (Logistics) and PR #117 (Infrastructure). Manual evidence supports PRE-EXISTING classification, but machine-proven attribution requires canonical baseline + comparison run.

---

## Post-Merge Protocol

After Infrastructure PR #117 merges to `main`:

### Step 1: Checkout Clean Main

```bash
git checkout main
git pull origin main
git log -1 --oneline  # Record exact SHA
```

**Record:**
```
baseline_source_branch = main
baseline_source_commit = <SHA>
generated_at           = <timestamp>
generator_version      = <version/commit>
```

### Step 2: Generate Canonical Baseline

```bash
node scripts/ci/baseline/generate-baseline.ts \
  --output .github/ci/baselines/main.json
```

### Step 3: Review Baseline

```bash
# Check finding counts by adapter
cat .github/ci/baselines/main.json | jq '.findings | group_by(.adapter) | map({adapter: .[0].adapter, count: length})'

# Verify provenance metadata
cat .github/ci/baselines/main.json | jq '{baseline_source_branch, baseline_source_commit, generated_at, generator_version}'
```

### Step 4: Commit + Freeze

```bash
git add .github/ci/baselines/main.json
git commit -m "chore(ci): Generate canonical baseline from clean main

Provenance:
- Branch: main
- Commit: <SHA>
- Generated: <timestamp>
- Generator: <version>

This baseline describes historical debt on main as of <date>.
Baseline MUST NOT be regenerated to mask new findings.
Ratchet governance: scripts/ci/baseline/ratchet-governance.ts"

git push origin main
```

### Step 5: Rebase PR #116

```bash
git checkout platform/logistics-p1-typescript-hardening
git rebase main
```

### Step 6: Local Verification

```bash
node scripts/ci/baseline/compare-with-baseline.ts \
  --baseline .github/ci/baselines/main.json \
  --pr-base main \
  --pr-head HEAD
```

**Expected:**
```
NEW = 0 (Logistics introduces NO violations beyond baseline)
RESOLVED = ? (if Logistics fixed any historical findings)
```

**If NEW > 0:**
- ❌ STOP immediately
- Investigate each NEW finding
- Fix code OR prove fingerprint/policy implementation bug
- DO NOT regenerate baseline to make NEW = 0

### Step 7: Push + CI

```bash
git push origin platform/logistics-p1-typescript-hardening --force-with-lease
```

CI will now run with baseline system active. Monitor:
```
✅ Identity-Aware No-New-Debt Baseline
   → Should show: "Baseline found, running comparison"
   → Should show: "NEW = 0"
   → Should show: "✓ No new violations"
```

### Step 8: Merge PR #116

Only if:
- `NEW = 0` proven by CI
- All other gates PASS OR proven to be historical debt

Post-merge verification:
```bash
git checkout main
git pull origin main

npx tsc --noEmit --project tsconfig.logistics-domain.json
# Expected: 0 diagnostics

npm test -- src/platform/logistics/domain
# Expected: 547/547 PASS

echo "✅ LOGISTICS P1 MAIN SEALED"
```

---

## Governance

### Critical Rules

1. **Baseline describes main's debt, NOT exemption list for new debt**
2. **NEW > 0 → Fix code, NOT regenerate baseline**
3. **PR #116 must remain unchanged during Infrastructure PR review**
4. **No baseline regeneration to achieve NEW = 0**

### Bootstrap Exception Closure (MANDATORY)

After canonical baseline is committed to `main`, bootstrap exception MUST be explicitly closed:

**File:** `.github/workflows/baseline-no-new-debt.yml`

```yaml
- name: Check if baseline exists
  id: baseline_check
  run: |
    if [ ! -f "$BASELINE_FILE" ]; then
-     echo "exists=false" >> $GITHUB_OUTPUT
-     echo "🔸️  Baseline not found (bootstrap scenario)"
+     echo "❌ BASELINE MISSING"
+     echo "Baseline file required: .github/ci/baselines/main.json"
+     echo "Bootstrap period closed. This is a CI configuration error."
+     exit 1
    else
      echo "exists=true" >> $GITHUB_OUTPUT
    fi

- name: Skip baseline check (bootstrap)
- if: steps.baseline_check.outputs.exists == 'false'
- run: |
-   echo "🔸️  BOOTSTRAP SCENARIO"
-   [... bootstrap message ...]
+ # REMOVED - Bootstrap period closed after baseline generation
```

**Why mandatory:**

Without explicit closure, system maintains a **false-green path**: any PR that accidentally lacks baseline would pass. This violates the core principle that baseline comparison is NOT optional.

**Verification after closure:**

```bash
# Simulate missing baseline
mv .github/ci/baselines/main.json .github/ci/baselines/main.json.backup

# CI should FAIL with clear error
# NOT skip with "bootstrap scenario"
```

---

## Verification Checkpoint

**Status:** BOOTSTRAP EXECUTION VERIFIED ON CI

```
PR #117 — SHA 822139b3

Identity-Aware workflow       ✅ CI VERIFIED
TypeScript execution via tsx  ✅ VERIFIED
Missing-baseline detection    ✅ VERIFIED
Bootstrap exception path      ✅ VERIFIED
Documented skip execution     ✅ VERIFIED

Baseline comparison on CI     ⏳ NOT YET VERIFIED (requires canonical baseline)
Canonical baseline            ⏳ NOT CREATED
Machine-proven attribution    ⏳ NOT PROVEN
Full PR #117 CI               ⏳ 3 CHECKS PENDING
```

**Evidence-based conclusion:**

> Identity-Aware Infrastructure has been proven locally (15/15 scenarios) and bootstrap execution has been proven on GitHub CI. Baseline comparison on CI and machine attribution of historical debt are NOT YET PROVEN.

**Next:**
1. Await 3 pending checks completion
2. Document final CI snapshot @ SHA 822139b3
3. Human review PR #117
4. If approved: Merge → Generate canonical baseline → Close bootstrap path

---

**Authority:** Identity-Aware No-New-Debt Baseline System  
**Reference:** `docs/platform/IDENTITY_AWARE_BASELINE_DEPLOYMENT.md`
