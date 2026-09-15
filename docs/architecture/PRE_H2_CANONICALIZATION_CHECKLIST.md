# Pre-H2 Canonicalization Checklist

**Purpose:** Establish immutable canonical checkpoint BEFORE H2 execution  
**Objective:** Lock H2 baseline from `origin/main` (NOT local uncommitted state)

---

## Canonicalization Protocol

### Step 1: Verify Working Tree State

```bash
git status
```

**Expected:** `working tree clean` OR only H0/H1 architecture documents uncommitted

**IF working tree dirty with non-H0/H1 changes:**
- ❌ DO NOT proceed with canonicalization
- Clean up uncommitted code (commit, stash, or discard)
- Reconcile diverged state BEFORE establishing H2 baseline

---

### Step 2: Fetch Remote State

```bash
git fetch origin
```

**Purpose:** Ensure local has latest `origin/main` state

---

### Step 3: Compare Local vs Remote

```bash
# Check local HEAD
git rev-parse HEAD

# Check origin/main
git rev-parse origin/main

# Check divergence
git log --oneline HEAD..origin/main  # Commits in remote not in local
git log --oneline origin/main..HEAD  # Commits in local not in remote
```

**Expected Scenarios:**

**Scenario A: Local = Remote (Ideal)**
```
Local HEAD:     abc123
origin/main:    abc123
Divergence:     None
Action:         Verify H0/H1 docs committed → Push if needed → Canonicalize
```

**Scenario B: Local Ahead of Remote**
```
Local HEAD:     def456
origin/main:    abc123
Divergence:     Local has H0/H1 docs not yet pushed
Action:         Verify commits are H0/H1 only → Push → Canonicalize
```

**Scenario C: Remote Ahead of Local**
```
Local HEAD:     abc123
origin/main:    def456
Divergence:     Remote has commits local doesn't have
Action:         Pull → Verify working tree clean → Canonicalize
```

**Scenario D: Diverged (Both have unique commits)**
```
Local HEAD:     ghi789
origin/main:    jkl012
Divergence:     Both branches diverged
Action:         ❌ RECONCILE FIRST (merge/rebase) → DO NOT canonicalize until converged
```

---

### Step 4: Verify H0/H1 Documents Committed

```bash
# Check if H0/H1 documents exist and are committed
git ls-files docs/architecture/ | grep -E "H0|H1"

# Check for uncommitted H0/H1 documents
git status docs/architecture/
```

**Required Documents (MUST be committed):**
- ✅ `H0_BELLA_HAIRCUT_CAPABILITY_REUSE_ASSESSMENT.md`
- ✅ `H0_ARCHITECTURE_RECONCILIATION_SUMMARY.md`
- ✅ `H0_COMPLETION_SUMMARY.md`
- ✅ `H0_QUICK_REFERENCE.md`
- ✅ `H0.5_REUSE_DECISION_GATE.md`
- ✅ `H1_ARCHITECTURE_GATE.md`
- ✅ `H1_FINAL_GATE_REVIEW.md`
- ✅ `H1_CONTRACT_EXTRACTION_ROADMAP.md`
- ✅ `adr/ADR-002-contract-extraction-strategy.md`
- ✅ `adr/ADR-003-beauty-services-platform-formalization.md`
- ✅ `adr/ADR-004-walkin-queue-scope.md`
- ✅ `adr/ADR-005-service-inventory-source.md`
- ✅ `H2_CONTRACT_EXTRACTION_AND_PRODUCT_SKELETON.md`
- ✅ `H2_BASELINE.md`
- ✅ `H2_EXECUTION_READINESS.md`
- ✅ `CHECKPOINT_H1_APPROVED.md`
- ✅ `PRE_H2_CANONICALIZATION_CHECKLIST.md` (this file)

**IF uncommitted H0/H1 documents exist:**
- Commit with message: `docs(architecture): seal Haircut H1 and authorize H2`
- Include ALL H0/H1/H2-prep documents in single commit
- DO NOT commit non-architecture changes in this checkpoint

---

### Step 5: Run Architecture Guard (Pre-Push Validation)

```bash
# Run Healthcare OS architecture guard
npm run healthcare:verify

# Run Logistics OS architecture guard
npm run logistics:verify
```

**Expected:** Both GREEN (547/547 tests PASS)

**IF RED:**
- ❌ DO NOT push canonical checkpoint with RED architecture guard
- Investigate frozen kernel violations
- Fix violations BEFORE establishing H2 baseline
- Re-run architecture guard until GREEN

---

### Step 6: Run Spa Regression (Pre-Push Validation)

```bash
# Run full Spa regression suite
npm run test:spa
```

**Expected:** 100% PASS

**IF RED:**
- ❌ DO NOT push canonical checkpoint with RED Spa regression
- Investigate test failures
- Fix failures BEFORE establishing H2 baseline
- Re-run regression until GREEN

---

### Step 7: Commit Checkpoint (If Needed)

**IF uncommitted H0/H1 documents exist:**

```bash
# Stage all H0/H1/H2-prep architecture documents
git add docs/architecture/H0*.md
git add docs/architecture/H1*.md
git add docs/architecture/H2*.md
git add docs/architecture/adr/ADR-002*.md
git add docs/architecture/adr/ADR-003*.md
git add docs/architecture/adr/ADR-004*.md
git add docs/architecture/adr/ADR-005*.md
git add docs/architecture/CHECKPOINT*.md
git add docs/architecture/PRE_H2*.md

# Verify only architecture documents staged
git diff --cached --name-only

# Commit with semantic message
git commit -m "docs(architecture): seal Haircut H1 and authorize H2

H0 Capability Reuse Assessment: SEALED
- 3.75× reuse leverage
- 73.33% capability reuse
- 8 contracts identified

H1 Architecture Gate: APPROVED + CLOSED
- Final review: 5/5 PASS
- ADR-002: APPROVED (Hybrid contract extraction)
- ADR-003: APPROVED (3-phase platform formalization, terminology corrected)
- ADR-004: APPROVED (Walk-in Queue = product feature)
- ADR-005: APPROVED — INVESTIGATION FIRST (E7 investigation gate enhanced)

H2 Contract Extraction & Product Skeleton: AUTHORIZED TO START
- Baseline template ready
- Execution readiness checklist ready
- Pre-H2 canonicalization protocol ready

Next: Lock H2 baseline from origin/main → Begin Contract #1 extraction"
```

**IF working tree already clean:**
- No checkpoint commit needed (H0/H1 already committed)
- Proceed to push existing `main`

---

### Step 8: Push Canonical Main

```bash
# Push to canonical remote
git push origin main
```

**Expected:** Push succeeds (fast-forward)

**IF push rejected (non-fast-forward):**
- Remote has new commits local doesn't have
- Pull → Verify working tree clean → Resolve conflicts if any
- Re-run architecture guard + Spa regression
- Push again

---

### Step 9: Fetch and Confirm Canonical SHA

```bash
# Fetch to ensure local has pushed state
git fetch origin

# Get canonical SHA from origin/main
git rev-parse origin/main

# Verify local HEAD = origin/main
git rev-parse HEAD
```

**Expected:** Both SHAs match

**Record Canonical SHA:**
```
PRE-H2 CANONICAL CHECKPOINT

origin/main SHA:    <SHA from git rev-parse origin/main>
local HEAD:         <SHA from git rev-parse HEAD>
Match:              ✅ (MUST match)

Lock Date:          <YYYY-MM-DD HH:MM>
Locked By:          <Name>
```

---

### Step 10: Lock H2 Baseline

```bash
# Write canonical SHA to H2 baseline file
git rev-parse origin/main > docs/architecture/H2_BASELINE_COMMIT.txt

# Display full commit info
git log -1 --format="%H%n%ai%n%s%n%b" origin/main
```

**Update `H2_BASELINE.md`:**
```markdown
## Baseline Commit

**Canonical Commit SHA:** `<SHA from origin/main>`  
**Branch:** `origin/main` (canonical remote)  
**Lock Date:** <YYYY-MM-DD>  
**Lock Time:** <HH:MM>

**Baseline Locked By:** <Name>  
**Baseline Status:** 🔒 LOCKED (immutable)

## Pre-H2 State Validation

### Spa Regression Test Results
**Result:** PASS  
**Test Count:** <X> tests  
**Pass Rate:** 100%  
**Duration:** <Y> seconds  
**Baseline:** GREEN ✅

### Architecture Guard Results
**Healthcare OS:** PASS (547/547 tests)  
**Logistics OS:** PASS (547/547 tests)  
**Baseline:** GREEN ✅

## H2 Timer

**H2 Start Time:** <YYYY-MM-DD HH:MM>  
**Forecast Duration:** 6 weeks  
**Actual Duration:** TIMER STARTED ⏱️
```

---

### Step 11: Create H2 Development Branch

```bash
# Create H2 branch from canonical main
git checkout -b feat/haircut-h2-contract-extraction origin/main

# Verify branch points to canonical SHA
git rev-parse HEAD

# Verify branch is clean
git status
```

**Expected:**
```
Branch: feat/haircut-h2-contract-extraction
HEAD:   <canonical SHA> (same as origin/main)
Status: working tree clean
```

**H2 Development Policy:**
- ✅ ALL H2 work happens on `feat/haircut-h2-contract-extraction` branch
- ✅ Contract #1, #2, #3, ... committed to this branch
- ✅ Merge to `main` ONLY after Contract evidence GREEN
- ❌ DO NOT develop H2 directly on `main`

---

## Canonicalization Verification

### Pre-H2 Canonical State (MUST be TRUE)

```
✅ origin/main SHA:           <SHA> (recorded)
✅ local HEAD:                 <same SHA> (matches origin/main)
✅ working tree:               CLEAN
✅ H0 documents:               COMMITTED
✅ H1 documents:               COMMITTED
✅ H2 prep documents:          COMMITTED
✅ Spa regression:             GREEN
✅ Architecture guard:         GREEN
✅ H2 baseline locked:         YES (H2_BASELINE_COMMIT.txt exists)
✅ H2 timer started:           YES
✅ H2 branch created:          feat/haircut-h2-contract-extraction
```

**IF ALL ✅ → H2 Baseline LOCKED, ready for Contract #1 extraction**

---

## H2 Baseline Authority

**Canonical Authority Point:**
```
Repository:     origin (canonical remote)
Branch:         main
Commit SHA:     <SHA from Step 9>
Lock Date:      <YYYY-MM-DD HH:MM>
Status:         🔒 IMMUTABLE

This SHA represents:
- H0 SEALED (3.75×, 73.33%, 8 contracts)
- H1 APPROVED + CLOSED (5/5 PASS, 4 ADRs APPROVED)
- H2 AUTHORIZED TO START

All H2 measurements (actual reuse, actual duration, extraction cost)
are measured RELATIVE TO THIS BASELINE.

Evidence Trail:
Pre-H2 canonical → Contract #1 → Contract #2 → ... → Contract #8 → H2 Final
```

---

## Exception Handling

### Exception 1: Working Tree Has Uncommitted Code (Non-H0/H1)

**Symptom:** `git status` shows uncommitted files not in `docs/architecture/`

**Action:**
1. ❌ DO NOT commit non-architecture code in H1 checkpoint
2. Stash uncommitted code: `git stash push -m "WIP before H2 baseline"`
3. Complete canonicalization with clean working tree
4. After H2 baseline locked, apply stash to H2 branch: `git stash pop`

---

### Exception 2: Spa Regression RED

**Symptom:** `npm run test:spa` has failures

**Action:**
1. ❌ DO NOT establish H2 baseline with RED regression
2. Fix Spa test failures FIRST
3. Re-run regression until GREEN
4. THEN establish canonical checkpoint

---

### Exception 3: Architecture Guard RED

**Symptom:** `npm run healthcare:verify` OR `npm run logistics:verify` RED

**Action:**
1. ❌ DO NOT establish H2 baseline with RED architecture guard
2. Investigate frozen kernel violations
3. Fix violations (likely requires ACR if frozen kernel must change)
4. Re-run architecture guard until GREEN
5. THEN establish canonical checkpoint

---

### Exception 4: Local/Remote Diverged

**Symptom:** `git log HEAD..origin/main` AND `git log origin/main..HEAD` both show commits

**Action:**
1. ❌ DO NOT push without reconciling divergence
2. Review divergence: `git log --oneline --graph --all`
3. Decide: Merge (`git merge origin/main`) OR Rebase (`git rebase origin/main`)
4. Resolve conflicts if any
5. Re-run architecture guard + Spa regression (verify GREEN)
6. THEN establish canonical checkpoint

---

### Exception 5: Push Rejected (Non-Fast-Forward)

**Symptom:** `git push origin main` rejected "non-fast-forward"

**Action:**
1. Remote has new commits local doesn't have
2. Pull: `git pull origin main` (or `git fetch + git merge`)
3. Re-run architecture guard + Spa regression (verify GREEN)
4. Push again: `git push origin main`

---

## Canonicalization Confirmation

**I confirm that:**
- [ ] Working tree is CLEAN (or only H0/H1 docs uncommitted)
- [ ] H0/H1/H2-prep documents are COMMITTED
- [ ] Spa regression is GREEN (100% PASS)
- [ ] Architecture guard is GREEN (healthcare + logistics)
- [ ] Local HEAD = origin/main (no divergence)
- [ ] Canonical checkpoint pushed to `origin/main`
- [ ] Canonical SHA recorded in `H2_BASELINE_COMMIT.txt`
- [ ] H2 timer started
- [ ] H2 branch `feat/haircut-h2-contract-extraction` created from canonical SHA
- [ ] Ready to begin Contract #1 extraction

**Canonical SHA:** `___________________________`  
**Locked By:** `___________________________`  
**Lock Date:** `___________________________`

---

**Pre-H2 Canonicalization Version:** 1.0.0  
**Status:** ✅ **PROTOCOL READY**  
**Next Action:** Execute Steps 1-11 → Lock H2 Baseline → Begin Contract #1 Extraction
