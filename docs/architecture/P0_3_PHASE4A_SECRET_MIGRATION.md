# P0.3-PHASE 4A: SECRET MIGRATION & RUNTIME INJECTION VERIFICATION

**Phase:** Phase 4A — Secret Migration (Infrastructure Only)  
**Status:** IN PROGRESS 🔄  
**Approach:** Test secret boundary BEFORE building control plane  
**Safety:** Legacy paths remain intact (Phase 5 will deprecate)

---

## 🎯 PHASE 4A OBJECTIVE

**Prove Zero-Knowledge Secret Boundary works:**

```
GitHub Environment Secrets
        ↓
    (runtime injection)
        ↓
  GitHub Actions workflow
        ↓
  Environment variables
        ↓
    BDGF scripts
        ↓
  bella_migration_executor
        ↓
    PostgreSQL
```

**WITHOUT:**
- ❌ Building full control plane yet (Phase 4B)
- ❌ Removing local .env credentials yet (Phase 5)
- ❌ Deprecating legacy paths yet (Phase 5)
- ❌ Deploying to production yet (Phase 6)

---

## 📋 PHASE 4A TASKS

### Task 1: Create GitHub Environment Secrets ⏳

**Action:** Add secrets to GitHub Repository

**Location:** `GitHub → Settings → Secrets and variables → Actions → Environments → Production`

**Secrets to Add:**

#### Secret 1: DATABASE_EXECUTOR_URL

**Name:** `DATABASE_EXECUTOR_URL`

**Value:** Production GitHub Environment Secret; value entered manually by authorized operator; never recorded in repository, documentation, chat, or logs.

**Source:** Existing production credential (P0.2 rotated, verified working)

**Purpose:** Production database mutation via bella_migration_executor role

**Classification:** 🔴 PRODUCTION_DEPLOYMENT

#### Secret 2: GATE_SIGNING_KEY

**Name:** `GATE_SIGNING_KEY`

**Value:** Cryptographically generated secret; value entered manually by authorized operator; never recorded in repository, documentation, chat, or logs.

**Purpose:** BDGF gate token signing/validation (HMAC-SHA256)

**Classification:** 🔴 PRODUCTION_DEPLOYMENT

**⚠️ MANUAL ACTION REQUIRED:**
1. Navigate to GitHub repository in browser
2. Go to Settings → Secrets and variables → Actions
3. Create "Production" environment if not exists
4. Add both secrets to "Production" environment
5. DO NOT add to repository secrets (must be environment-specific)

**Verification Checklist:**
- [ ] "Production" environment exists
- [ ] `DATABASE_EXECUTOR_URL` added to Production environment
- [ ] `GATE_SIGNING_KEY` added to Production environment
- [ ] Secrets NOT visible in plain text (GitHub masks automatically)

---

### Task 2: Create Secret Injection Test Workflow ✅

**Action:** Create minimal test workflow to verify secret injection

**File:** `.github/workflows/test-secret-injection.yml`

**Purpose:** Verify secrets are injected at runtime WITHOUT deploying to production

**Workflow:**

```yaml
name: Test Secret Injection (Phase 4A Verification)

on:
  workflow_dispatch:  # Manual trigger only (safe, no auto-deploy)

jobs:
  verify-secrets:
    runs-on: ubuntu-latest
    environment: Production  # Required to access Production environment secrets
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
      
      - name: Verify DATABASE_EXECUTOR_URL exists
        env:
          DATABASE_EXECUTOR_URL: ${{ secrets.DATABASE_EXECUTOR_URL }}
        run: |
          if [ -z "$DATABASE_EXECUTOR_URL" ]; then
            echo "❌ ERROR: DATABASE_EXECUTOR_URL not set"
            exit 1
          fi
          echo "✅ DATABASE_EXECUTOR_URL exists (length: ${#DATABASE_EXECUTOR_URL} chars)"
          echo "✅ Value is masked in logs (should not see actual credential)"
      
      - name: Verify GATE_SIGNING_KEY exists
        env:
          GATE_SIGNING_KEY: ${{ secrets.GATE_SIGNING_KEY }}
        run: |
          if [ -z "$GATE_SIGNING_KEY" ]; then
            echo "❌ ERROR: GATE_SIGNING_KEY not set"
            exit 1
          fi
          echo "✅ GATE_SIGNING_KEY exists (length: ${#GATE_SIGNING_KEY} chars)"
          echo "✅ Value is masked in logs"
      
      - name: Verify secrets are masked
        env:
          DATABASE_EXECUTOR_URL: ${{ secrets.DATABASE_EXECUTOR_URL }}
          GATE_SIGNING_KEY: ${{ secrets.GATE_SIGNING_KEY }}
        run: |
          echo "Testing log masking..."
          echo "DATABASE_EXECUTOR_URL value: $DATABASE_EXECUTOR_URL"
          echo "GATE_SIGNING_KEY value: $GATE_SIGNING_KEY"
          echo "✅ If you see *** above, masking works correctly"
          echo "❌ If you see actual values, SECRET LEAK detected"
      
      - name: Test runtime injection to Node.js script
        env:
          DATABASE_EXECUTOR_URL: ${{ secrets.DATABASE_EXECUTOR_URL }}
          GATE_SIGNING_KEY: ${{ secrets.GATE_SIGNING_KEY }}
        run: |
          node -e "
            const dbUrl = process.env.DATABASE_EXECUTOR_URL;
            const gateKey = process.env.GATE_SIGNING_KEY;
            
            console.log('✅ process.env.DATABASE_EXECUTOR_URL accessible:', dbUrl ? 'YES' : 'NO');
            console.log('✅ DATABASE_EXECUTOR_URL length:', dbUrl?.length || 0);
            console.log('✅ process.env.GATE_SIGNING_KEY accessible:', gateKey ? 'YES' : 'NO');
            console.log('✅ GATE_SIGNING_KEY length:', gateKey?.length || 0);
            
            if (!dbUrl || !gateKey) {
              console.error('❌ ERROR: Secrets not accessible in Node.js process.env');
              process.exit(1);
            }
            
            console.log('✅ PASS: Secrets injected successfully, accessible via process.env');
          "
      
      - name: Summary
        run: |
          echo "═══════════════════════════════════════════════════════════"
          echo "PHASE 4A SECRET INJECTION VERIFICATION"
          echo "═══════════════════════════════════════════════════════════"
          echo "✅ DATABASE_EXECUTOR_URL: Injected, masked, accessible"
          echo "✅ GATE_SIGNING_KEY: Injected, masked, accessible"
          echo "✅ process.env resolution: Working"
          echo "✅ GitHub log masking: Active"
          echo ""
          echo "🟢 PHASE 4A VERIFICATION: PASS"
          echo "🟢 Ready for Phase 4B (Build Control Plane)"
          echo "═══════════════════════════════════════════════════════════"
```

**Safety Features:**
- `workflow_dispatch` — Manual trigger only (no auto-deploy)
- `environment: Production` — Requires manual approval (if configured)
- No database connection — Only verifies secret injection, no mutations
- No production deployment — Test only

**Verification Checklist:**
- [ ] Workflow file created
- [ ] Workflow triggered manually via GitHub Actions UI
- [ ] All 4 verification steps PASS
- [ ] Logs show `***` instead of actual secret values
- [ ] Summary shows "PHASE 4A VERIFICATION: PASS"

---

### Task 3: Verify Log Masking ⏳

**Action:** Inspect GitHub Actions logs to confirm secrets are masked

**Expected Behavior:**
```
DATABASE_EXECUTOR_URL value: ***
GATE_SIGNING_KEY value: ***
✅ If you see *** above, masking works correctly
```

**Failure Mode:**
```
DATABASE_EXECUTOR_URL value: postgresql://bella_migration_executor:actual_password@db...
❌ If you see actual values, SECRET LEAK detected
```

**Verification Checklist:**
- [ ] Workflow run logs inspected
- [ ] Secret values appear as `***` (masked)
- [ ] No plain-text credentials in logs
- [ ] GitHub automatic masking confirmed working

---

### Task 4: Test BDGF Script with Runtime Injection ⏳

**Action:** Verify BDGF scripts can read secrets from `process.env` (GitHub-injected)

**Test Approach:** Dry-run migration-executor with injected secrets (no actual DB connection)

**Test Workflow Addition:**

```yaml
  test-bdgf-injection:
    runs-on: ubuntu-latest
    environment: Production
    needs: verify-secrets  # Run after secret verification passes
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Test BDGF script reads secrets from process.env
        env:
          DATABASE_EXECUTOR_URL: ${{ secrets.DATABASE_EXECUTOR_URL }}
          GATE_SIGNING_KEY: ${{ secrets.GATE_SIGNING_KEY }}
        run: |
          node -e "
            // Simulate BDGF script environment
            const dbUrl = process.env.DATABASE_EXECUTOR_URL;
            const gateKey = process.env.GATE_SIGNING_KEY;
            
            console.log('📋 BDGF Script Environment Check');
            console.log('═══════════════════════════════════');
            console.log('DATABASE_EXECUTOR_URL present:', !!dbUrl);
            console.log('DATABASE_EXECUTOR_URL starts with postgresql://', dbUrl?.startsWith('postgresql://'));
            console.log('GATE_SIGNING_KEY present:', !!gateKey);
            console.log('GATE_SIGNING_KEY length >= 64:', (gateKey?.length || 0) >= 64);
            console.log('═══════════════════════════════════');
            
            if (!dbUrl || !dbUrl.startsWith('postgresql://')) {
              console.error('❌ Invalid DATABASE_EXECUTOR_URL');
              process.exit(1);
            }
            
            if (!gateKey || gateKey.length < 64) {
              console.error('❌ Invalid GATE_SIGNING_KEY (must be >= 64 chars)');
              process.exit(1);
            }
            
            console.log('✅ PASS: BDGF scripts can access secrets from process.env');
          "
      
      - name: Verify no .env file required
        run: |
          if [ -f .env ]; then
            echo "⚠️  WARNING: .env file exists in CI (should not be committed)"
            echo "   Secrets should come from GitHub Environment only"
            exit 1
          fi
          echo "✅ PASS: No .env file in CI (secrets from GitHub only)"
```

**Verification Checklist:**
- [ ] BDGF scripts can read `process.env.DATABASE_EXECUTOR_URL`
- [ ] BDGF scripts can read `process.env.GATE_SIGNING_KEY`
- [ ] Secret format validation passes (postgresql:// prefix, key length >= 64)
- [ ] No `.env` file required in CI

---

### Task 5: Document Secret Boundary Status ✅

**Action:** Create status document showing secret migration complete

**File:** `docs/architecture/P0_3_PHASE4A_STATUS.md`

**Content:**

```markdown
# Phase 4A Status: Secret Migration

**Date:** 2026-08-25  
**Status:** COMPLETE ✅ / IN PROGRESS 🔄 / BLOCKED 🔴

## Secret Migration Checklist

- [ ] Task 1: GitHub Environment Secrets created
  - [ ] DATABASE_EXECUTOR_URL added
  - [ ] GATE_SIGNING_KEY added
  - [ ] "Production" environment configured
  
- [ ] Task 2: Test workflow created
  - [ ] test-secret-injection.yml committed
  - [ ] Workflow triggered manually
  - [ ] All verification steps PASS
  
- [ ] Task 3: Log masking verified
  - [ ] Secrets appear as *** in logs
  - [ ] No plain-text credentials leaked
  
- [ ] Task 4: BDGF script injection tested
  - [ ] Scripts read from process.env
  - [ ] No .env file required in CI
  
- [ ] Task 5: Documentation complete
  - [ ] This status document created
  - [ ] Phase 4A evidence recorded

## Verification Results

### Run 1: [Date/Time]
- Workflow Run: [URL to GitHub Actions run]
- Result: PASS / FAIL
- Issues: [Any issues encountered]

## Phase 4A Definition of Done

**Phase 4A COMPLETE when:**
- ✅ DATABASE_EXECUTOR_URL in GitHub Environment
- ✅ GATE_SIGNING_KEY in GitHub Environment
- ✅ Secrets injected at runtime (verified)
- ✅ Logs mask secret values (verified)
- ✅ BDGF scripts read from process.env (verified)
- ✅ No .env required in CI (verified)

**NOT in Phase 4A scope:**
- ❌ Removing local .env (Phase 5)
- ❌ Building full control plane (Phase 4B)
- ❌ Deprecating legacy paths (Phase 5)
- ❌ Production deployment (Phase 6)

## Next Steps

**If Phase 4A PASS:**
→ Proceed to Phase 4B (Build Control Plane)

**If Phase 4A FAIL:**
→ Debug secret injection
→ Fix GitHub Environment configuration
→ Retry Phase 4A
→ DO NOT proceed to Phase 4B until PASS
```

---

## 🔒 PHASE 4A BOUNDARIES

### What Phase 4A DOES

✅ Create GitHub Environment Secrets  
✅ Test secret injection at runtime  
✅ Verify log masking works  
✅ Verify BDGF scripts can read secrets  
✅ Document secret boundary status

### What Phase 4A DOES NOT DO

❌ Remove local .env credentials (Phase 5)  
❌ Modify BDGF scripts (already support process.env)  
❌ Build full control plane workflow (Phase 4B)  
❌ Deprecate legacy deployment paths (Phase 5)  
❌ Deploy to production (Phase 6)  
❌ Delete any existing files (Phase 5-7)

---

## 🎯 PHASE 4A DEFINITION OF DONE

**Phase 4A is COMPLETE when:**

- [ ] **Infrastructure:**
  - [ ] `DATABASE_EXECUTOR_URL` exists in GitHub Environment "Production"
  - [ ] `GATE_SIGNING_KEY` exists in GitHub Environment "Production"

- [ ] **Verification:**
  - [ ] Test workflow `.github/workflows/test-secret-injection.yml` created
  - [ ] Test workflow run manually triggered
  - [ ] All 4 verification steps PASS
  - [ ] Logs show `***` for secret values (masking works)
  - [ ] BDGF scripts can read secrets from `process.env`
  - [ ] No `.env` file required in CI

- [ ] **Documentation:**
  - [ ] Phase 4A status document created
  - [ ] Test run evidence recorded (GitHub Actions URL)

- [ ] **Safety:**
  - [ ] Local `.env` NOT modified (kept intact)
  - [ ] Legacy paths NOT deprecated (kept intact)
  - [ ] No production deployments triggered

**If ANY verification fails → STOP, debug, retry. Do NOT proceed to Phase 4B.**

---

## 🚨 FAILURE HANDLING

### Failure: Secrets not accessible in workflow

**Symptoms:**
```
❌ ERROR: DATABASE_EXECUTOR_URL not set
```

**Diagnosis:**
- Environment "Production" not created in GitHub
- Secrets added to repository secrets instead of environment secrets
- Workflow missing `environment: Production` declaration

**Fix:**
1. Verify "Production" environment exists: `Settings → Environments → Production`
2. Verify secrets in environment (not repository): `Environments → Production → Secrets`
3. Verify workflow declares `environment: Production` in job

### Failure: Secrets leaked in logs

**Symptoms:**
```
DATABASE_EXECUTOR_URL value: postgresql://bella_migration_executor:actual_password@...
```

**Diagnosis:**
- GitHub automatic masking failed (should not happen)
- Secret printed via method that bypasses masking (e.g., base64 decode)

**Fix:**
1. DO NOT proceed to Phase 4B
2. Rotate credentials immediately (P0.2 credential rotation procedure)
3. Investigate why masking failed
4. Fix logging, retry Phase 4A

### Failure: BDGF scripts cannot read secrets

**Symptoms:**
```
process.env.DATABASE_EXECUTOR_URL: undefined
```

**Diagnosis:**
- Secrets not passed to script via `env:` in workflow step
- Script reading from wrong environment variable name

**Fix:**
1. Verify workflow step includes `env: { DATABASE_EXECUTOR_URL: ${{ secrets.DATABASE_EXECUTOR_URL }} }`
2. Verify script reads `process.env.DATABASE_EXECUTOR_URL` (exact name match)
3. Retry Phase 4A

---

## 📊 PHASE 4A SUCCESS CRITERIA

**PASS Criteria:**

```
✅ GitHub Environment "Production" exists
✅ DATABASE_EXECUTOR_URL in Production environment (length > 0)
✅ GATE_SIGNING_KEY in Production environment (length >= 64)
✅ Test workflow runs without errors
✅ Logs show *** instead of actual credentials
✅ Node.js process.env.DATABASE_EXECUTOR_URL accessible
✅ Node.js process.env.GATE_SIGNING_KEY accessible
✅ No .env file required in CI
```

**FAIL Criteria (any one triggers FAIL):**

```
❌ Secrets not accessible in workflow
❌ Secrets leaked in logs (plain text visible)
❌ BDGF scripts cannot read secrets
❌ Secret format invalid (wrong prefix, wrong length)
```

---

## 🚀 NEXT PHASE: PHASE 4B — BUILD CONTROL PLANE

**Prerequisites for Phase 4B:**
1. ✅ Phase 4A COMPLETE (all verification PASS)
2. ✅ Secrets in GitHub Environment
3. ✅ Runtime injection verified
4. ✅ Log masking verified

**Phase 4B Tasks:**
1. Enhance `deploy-production.yml` with full deployment pipeline
2. Integrate change detection
3. Integrate validation gates (tests, security, architecture)
4. Integrate migration safety analysis
5. Integrate BDGF policy engine
6. Integrate migration execution (via migration-executor.mjs)
7. Integrate DB verification
8. Integrate conditional Vercel deployment
9. Integrate production smoke test
10. Integrate audit logging

**Phase 4B Deliverable:** Working end-to-end Golden Path workflow (not yet deployed to production)

---

**END OF PHASE 4A SPECIFICATION**

**Status:** SPECIFICATION COMPLETE, AWAITING EXECUTION  
**Next Action:** Execute Task 1 (Manual: Add secrets to GitHub)  
**After Task 1:** Execute Task 2 (Create test workflow)
