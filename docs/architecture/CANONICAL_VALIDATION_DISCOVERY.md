# Canonical Validation Discovery — Pre-H2 Baseline

**Date:** 2026-09-15  
**Purpose:** Identify canonical validation gates enforced on `main` for H0/H1 baseline verification

---

## CI/CD Audit Results

### Architecture Gate Workflow
**File:** `.github/workflows/architecture-gate.yml`  
**Trigger:** `pull_request` + `push` to `main`  
**Enforced:** ✅ YES

**Jobs:**
1. **frozen-files** — Frozen File Check
   - Command: `node scripts/architecture/ci-frozen-check.js`
   - Enforced: YES (blocks PR/push)

2. **guard** — Architecture Guard Verification
   - Command: `npm run arch:guard`
   - Enforced: YES (blocks PR/push)

3. **dependency** — Dependency Boundary Check
   - Command: `node scripts/architecture/ci-dependency-check.js`
   - Enforced: YES (blocks PR/push)

4. **regression** — Logistics Kernel Regression
   - Command: `npm run logistics:verify`
   - Enforced: YES (blocks PR/push)
   - Runs: 547/547 Logistics kernel tests (E7.1, E7.2, E7.3)

---

### Architecture Guard Workflow (Constitution Enforcement)
**File:** `.github/workflows/architecture-guard.yml`  
**Trigger:** `pull_request` + `push` to `main`/`develop` (when `src/**/*.ts` changed)  
**Enforced:** ✅ YES (conditional on scope)

**Jobs:**
1. **detect_changes** — Scope Detection
   - Command: `node scripts/ci-scope-router.mjs --fail-on-block`
   - Output: OS/products affected, core_changed flag

2. **architecture-compliance** — Healthcare Constitution
   - Condition: IF Healthcare files changed
   - Commands:
     - `npx eslint --config .eslintrc.architecture.js`
     - `npm run healthcare:guard`
     - P1 boundary scan (grep direct engine imports)
     - `npm run healthcare:test`
   - Enforced: YES (if Healthcare scope)

3. **education-compliance** — Education Constitution
   - Condition: IF Education files changed
   - Commands:
     - `npm run education:architecture:ci`
     - `npm run education:conformance:ci`
   - Enforced: YES (if Education scope)

4. **core-freeze-guard** — Core Freeze Verification
   - Condition: IF Core files changed
   - Action: BLOCKS immediately (requires ARB approval)
   - Enforced: YES (hard block)

---

### CI Tests Workflow
**File:** `.github/workflows/ci-tests.yml`  
**Trigger:** `pull_request` + `push` to `main`/`develop`  
**Enforced:** ✅ YES

**Jobs (scope-dependent):**
1. **detect_changes** — Scope Detection
   - Command: `node scripts/ci-scope-router.mjs --fail-on-block`

2. **lint** — Changed-file Lint
   - Condition: IF needs_security_lightweight
   - Command: `node scripts/lint-changed-files.mjs`

3. **tests** — Unit + Integration Tests
   - Condition: IF needs_tests
   - Command: `node scripts/test-changed-files.mjs`

4. **real-db-e2e** — Real Database Business E2E
   - Condition: IF needs_real_db_e2e
   - Command: `npm run test:real-db-e2e`

5. **security** — Security Gates
   - Command: `npm run security:secrets`
   - Command (conditional): `npm run security:audit`

6. **migrations** — Migration Gates
   - Condition: IF needs_migration_gates
   - Commands:
     - `npm run db:migration:zero-downtime`
     - `npm run db:migration:check`

7. **build** — App Build
   - Condition: IF needs_build
   - Command: `npm run build`

8. **all-gates** — Summary Gate
   - Enforces: ALL required jobs must pass (success or skipped)

---

## Package.json Scripts Analysis

### Spa/Beauty-Specific Regression
**Status:** ❌ **NOT AVAILABLE**

**Search results:**
- `test:spa` — NOT FOUND
- `test:beauty` — NOT FOUND
- `beauty:verify` — NOT FOUND
- `spa:verify` — NOT FOUND

**Note:** No Spa/Beauty product-scoped regression suite exists in repo

---

### Platform Kernel Verification Commands

**Healthcare OS:**
```bash
npm run healthcare:verify
```
- Runs: `healthcare:guard` → `healthcare:architecture` → `healthcare:conformance` → `healthcare:test`
- Tests: H1-H12 kernel (52/52 test suites)
- Enforced by CI: YES (if Healthcare files changed)

**Logistics OS:**
```bash
npm run logistics:verify
```
- Runs: `arch:guard` → `npm test -- src/platform/logistics/domain`
- Tests: E7.1, E7.2, E7.3 kernel (547/547 tests)
- Enforced by CI: YES (always, via architecture-gate.yml)

**Education OS:**
```bash
npm run education:verify
```
- Runs: architecture + customization + extensions + conformance
- Tests: Education kernel + contracts
- Enforced by CI: YES (if Education files changed)

**Real Estate OS:**
```bash
npm run realestate:verify
```
- Runs: `realestate:architecture` + `realestate:conformance`
- Tests: Real Estate kernel
- Enforced by CI: YES (via ci-real-estate.yml)

**Full Platform:**
```bash
npm run platform:verify
```
- Runs: ALL platform kernels + security + reliability
- Tests: Healthcare + Real Estate + Education + Security + Reliability
- Enforced by CI: NO (not in any workflow, manual orchestration only)

---

### Critical Business Invariants

```bash
npm run test:critical
```
- Tests: Payment, accounting, finance, salary, auth, tenant, meta-ads, business-invariants
- Enforced by CI: NO (not in workflows, appears to be legacy/manual suite)

---

## Canonical Validation Gates for Docs-Only Commit

**Commit scope:** `docs/architecture/*.md` (22 files, H0/H1 documents)

**Files changed:** 
- `docs/architecture/H0*.md`
- `docs/architecture/H1*.md`
- `docs/architecture/H2*.md`
- `docs/architecture/adr/ADR-00*.md`

**CI scope detection result (expected):**
```
scope_status:                CLEAN
scope_level:                 docs
needs_tests:                 false
needs_build:                 false
needs_real_db_e2e:           false
needs_migration_gates:       false
```

**Gates triggered by docs-only commit:**
1. ✅ **Frozen files check** — Will run (checks if docs touch frozen kernel files)
2. ✅ **Architecture guard** — Will run (verifies guard integrity)
3. ✅ **Dependency boundary** — Will run (checks imports in docs? likely skip)
4. ⏭️ **Logistics regression** — Will run (enforced on all main pushes)
5. ⏭️ **Healthcare compliance** — SKIP (no Healthcare files changed)
6. ⏭️ **Education compliance** — SKIP (no Education files changed)
7. ⏭️ **Lint** — SKIP (needs_security_lightweight = false)
8. ⏭️ **Tests** — SKIP (needs_tests = false)
9. ⏭️ **Build** — SKIP (needs_build = false)

**Expected CI result:** ✅ GREEN (docs-only changes pass all triggered gates)

---

## Recommended Pre-H2 Baseline Validation Suite

**Purpose:** Verify canonical base (fae99ec3 + H0/H1 commit) is GREEN before H2 extraction starts

### Mandatory (Enforced by CI on main push)

```bash
# 1. Architecture Guard (always enforced)
npm run arch:guard

# 2. Logistics Kernel Regression (always enforced)
npm run logistics:verify
```

**Expected:** ✅ GREEN (547/547 tests PASS)

---

### Recommended (Not enforced by CI, but validates baseline health)

```bash
# 3. Critical business invariants
npm run test:critical

# 4. Healthcare kernel regression (if Haircut will reuse Healthcare contracts)
npm run healthcare:verify

# 5. Education kernel regression (if Haircut will reuse Education contracts)
npm run education:verify
```

**Note:** H0 assessment identified **8 contracts** from Healthcare (H1-H12) and potentially Education. Running these regressions confirms baseline kernels are GREEN before H2 starts.

---

### NOT Recommended (No Spa regression exists)

```bash
# ❌ npm run test:spa — DOES NOT EXIST
```

**Spa product regression:** NOT AVAILABLE in repo

**Workaround:** Rely on:
- Logistics kernel regression (E7.1-E7.3): ✅ AVAILABLE
- Healthcare kernel regression (H1-H12): ✅ AVAILABLE
- CI scope-based test selection: ✅ AVAILABLE

**Haircut H0 assessment shows 73.33% reuse from Spa.** To validate Spa baseline health, we can:
1. Run `npm run logistics:verify` (Spa depends on E7 logistics kernel)
2. Run `npm run healthcare:verify` (Spa may depend on H1-H12 contracts)
3. Trust CI scope detection to run affected tests on merge

---

## Final Canonical Validation Command

**For H0/H1 docs-only commit on `docs/haircut-h0-h1-canonicalization` branch:**

### Minimal (CI-enforced gates only)

```bash
# Architecture Guard
npm run arch:guard

# Logistics Kernel Regression (enforced on all main pushes)
npm run logistics:verify
```

**Expected:** ✅ GREEN  
**If GREEN:** Safe to merge H0/H1 to main

---

### Comprehensive (Baseline health verification)

```bash
# 1. Architecture Guard
npm run arch:guard

# 2. Logistics Kernel (E7.1-E7.3: 547 tests)
npm run logistics:verify

# 3. Healthcare Kernel (H1-H12: 52 suites) — Haircut will reuse 8 contracts
npm run healthcare:verify

# 4. Critical business invariants
npm run test:critical
```

**Expected:** All GREEN  
**Purpose:** Confirm canonical base is healthy before H2 timer starts

**Time estimate:** 10-15 minutes (depending on test suite performance)

---

## Validation Decision Matrix

| Scenario | Command | Required? | Rationale |
|----------|---------|-----------|-----------|
| **Docs-only commit** | `arch:guard` | ✅ YES | CI enforced on all main pushes |
| **Docs-only commit** | `logistics:verify` | ✅ YES | CI enforced on all main pushes |
| **Docs-only commit** | `healthcare:verify` | ⚠️ RECOMMENDED | Haircut reuses 8 Healthcare contracts |
| **Docs-only commit** | `test:critical` | ⚠️ RECOMMENDED | Validates business invariant baseline |
| **Docs-only commit** | `test:spa` | ❌ N/A | Does not exist in repo |
| **Before H2 code** | All above | ✅ YES | Establish GREEN baseline authority |

---

## Canonical Validation Summary

```
CANONICAL VALIDATION DISCOVERY

Architecture Guard
├─ Command:           npm run arch:guard
├─ Source:            .github/workflows/architecture-gate.yml
├─ Enforced:          YES (all main pushes)
└─ Status:            ✅ MANDATORY

Logistics Kernel Regression
├─ Command:           npm run logistics:verify
├─ Tests:             547/547 (E7.1, E7.2, E7.3)
├─ Source:            .github/workflows/architecture-gate.yml
├─ Enforced:          YES (all main pushes)
└─ Status:            ✅ MANDATORY

Healthcare Kernel Regression
├─ Command:           npm run healthcare:verify
├─ Tests:             52/52 suites (H1-H12)
├─ Source:            .github/workflows/architecture-guard.yml
├─ Enforced:          YES (if Healthcare files changed)
└─ Status:            ⚠️ RECOMMENDED (Haircut reuses 8 contracts)

Critical Business Invariants
├─ Command:           npm run test:critical
├─ Tests:             Payment, accounting, finance, salary, auth, tenant
├─ Source:            package.json
├─ Enforced:          NO (not in CI)
└─ Status:            ⚠️ RECOMMENDED (baseline health check)

Spa Product Regression
├─ Command:           N/A
├─ Status:            ❌ NOT AVAILABLE
└─ Note:              No Spa-scoped test suite exists
```

---

## Next Actions

### 1. Run Mandatory Validation (CI-enforced gates)

```bash
# On branch: docs/haircut-h0-h1-canonicalization

# Gate 1: Architecture Guard
npm run arch:guard

# Gate 2: Logistics Kernel Regression
npm run logistics:verify
```

**Expected:** ✅ GREEN (both gates pass)

---

### 2. Run Recommended Validation (Baseline health)

```bash
# Gate 3: Healthcare Kernel (Haircut dependency)
npm run healthcare:verify

# Gate 4: Critical business invariants
npm run test:critical
```

**Expected:** ✅ GREEN (confirms canonical base healthy)

---

### 3. IF All GREEN → Merge to Main

```bash
git switch main
git merge --no-ff docs/haircut-h0-h1-canonicalization
git push origin main
```

---

### 4. Verify Canonical SHA

```bash
git fetch origin
git rev-parse HEAD
git rev-parse origin/main
git status
```

**Expected:** `HEAD == origin/main` and working tree clean

---

### 5. Lock H2 Baseline

```bash
# Get canonical SHA (this is H2 baseline)
git rev-parse origin/main > .h2-baseline.tmp

# Create H2 branch
git checkout -b feat/haircut-h2-contract-extraction origin/main

# Record baseline in H2 branch first commit
git commit --allow-empty -m "chore(H2): lock baseline from origin/main

H2 Baseline SHA: $(cat .h2-baseline.tmp)
Lock date: $(date -Iseconds)

H0: SEALED (3.75×, 73.33%, 8 contracts)
H1: APPROVED + CLOSED
H2: TIMER STARTED"

# Clean up temp file
rm .h2-baseline.tmp
```

---

## Validation Evidence Template

```
H0/H1 CANONICAL VALIDATION EVIDENCE

Date:                    2026-09-15
Branch:                  docs/haircut-h0-h1-canonicalization
Commit:                  21d3c883
Canonical base:          fae99ec3 (origin/main)

Mandatory Gates (CI-enforced)
├─ arch:guard            [PASS/FAIL]
└─ logistics:verify      [PASS/FAIL]

Recommended Gates (Baseline health)
├─ healthcare:verify     [PASS/FAIL/SKIP]
└─ test:critical         [PASS/FAIL/SKIP]

Result:                  [GREEN/RED]
Merge authorized:        [YES/NO]
H2 baseline ready:       [YES/NO]
```

---

**Canonical Validation Discovery Version:** 1.0.0  
**Status:** ✅ **AUDIT COMPLETE**  
**Next:** Run validation gates → Merge → Lock H2 baseline
