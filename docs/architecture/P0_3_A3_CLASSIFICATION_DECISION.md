# P0.3-A3 CLASSIFICATION DECISION

**Decision Date:** 2026-08-25  
**Status:** LOCKED ✅  
**Previous Phase:** A2 Inventory Complete  
**Next Phase:** Phase 2 — Golden Path Contract

---

## 🎯 ARCHITECTURAL DECISION

### Selected: **OPTION A — CONTROL PLANE APPROACH**

```
┌─────────────────────┐
│   AI / Developer    │
│                     │
│  Code → git push    │
└──────────┬──────────┘
           ↓
   ┌───────────────┐
   │    GitHub     │
   └───────┬───────┘
           ↓
┌──────────────────────────┐
│  DEPLOYMENT CONTROL PLANE│
│      GitHub Actions      │
└────────────┬─────────────┘
             ↓
┌──────────────────────────┐
│ Automatic Classification │
│ Tests / Security / Guard │
│ Migration Safety         │
└────────────┬─────────────┘
             ↓
      ┌────────────┐
      │   BDGF     │
      │  POLICY    │
      │   ENGINE   │
      └─────┬──────┘
            ↓
┌────────────────────────┐
│ bella_migration_executor│
│     MUTATION ONLY       │
└───────────┬────────────┘
            ↓
       PostgreSQL
            ↓
   Database Verification
            ↓
       Vercel Deploy
            ↓
    Production Smoke
            ↓
       🟢 LIVE
```

### Rejected Options

- ❌ **Option B:** GitHub Actions → Supabase CLI (abandons R4.3.3 investment)
- ❌ **Option C:** Hybrid approach (introduces complexity, unclear boundaries)

### Rationale

**Why Option A:**
1. **Reuses R4.3.3 Investment:** BDGF gate tokens, migration-executor, audit already built
2. **Clear Separation:** Control Plane (GitHub Actions) ≠ Policy Engine (BDGF) ≠ Executor (bella_migration_executor)
3. **Avoids P0.2 Lesson:** Don't rebuild when existing architecture can be integrated
4. **Zero-Knowledge Deployment:** AI/developer needs no production credentials

**Why Not B:**
- Supabase CLI is a deployment tool, not a control plane
- No policy/governance layer (gate validation, approval workflow)
- Would require rebuilding security boundary that R4.3.3 already provides

**Why Not C:**
- "Hybrid" creates ambiguity: which path for which change?
- AI agents will struggle to classify "critical vs low-risk"
- Defeats purpose of single Golden Path

---

## 🔒 A3 ARTIFACT CLASSIFICATION

| Artifact | Decision | Rationale | Phase |
|----------|----------|-----------|-------|
| `.github/workflows/deploy-production.yml` | **🟢 REUSE** | Current production workflow, enhance with BDGF integration | Phase 4 |
| `scripts/bdgf/migration-executor.mjs` | **🟢 REUSE** | R4.3.3 security boundary, gate token validation | Phase 4 |
| `scripts/bdgf/execute-migration-wrapper.mjs` | **🟢 REUSE** | CLI wrapper for migration-executor | Phase 4 |
| `scripts/bdgf/gate-runner.mjs` | **🟢 REUSE** | Config-driven gate execution | Phase 4 |
| `scripts/bdgf/gate-token.mjs` | **🟢 REUSE** | Token validation/consumption logic | Phase 4 |
| `scripts/bdgf/r4-*.mjs` (17 files) | **🟢 KEEP** | R4 verification/adversarial testing | Retained |
| `scripts/bdgf/deploy-verify.mjs` | **🟢 KEEP** | Deployment verification utility | Retained |
| `scripts/backup-database.sh` | **🟢 KEEP** | Operational utility, not deployment | Retained |
| `scripts/bdgf/r3-*.mjs` (22 files) | **🟡 ARCHIVE** | P0.2 complete, historical evidence | Phase 7 cleanup |
| `scripts/bdgf/deploy-schema.mjs` | **🔴 DEPRECATE** | Direct deployment without gate validation | Phase 5 |
| `.github/workflows/decision-engine-deploy.yml` | **🔴 DEPRECATE** | Duplicate of deploy-production.yml, unclear usage | Phase 5 |
| `scripts/deploy-booking-engine-schema.sh` | **🔴 DEPRECATE** | Manual bash script, no CI integration | Phase 5 |
| `scripts/deploy-bella-auto-rpcs.sh` | **🔴 DEPRECATE** | Manual bash script, no gate validation | Phase 5 |
| `scripts/deploy-commission-system-staging.sh` | **🔴 DEPRECATE** | Manual staging deploy (keep staging fallback decision for Phase 5) | Phase 5 |
| `scripts/deploy-partner-portal-staging.sh` | **🔴 DEPRECATE** | Manual staging deploy | Phase 5 |
| `scripts/deploy-migration.js` | **🔴 DEPRECATE** | Generic manual deployer, replaced by BDGF | Phase 5 |
| `scripts/apply-surgery-migration.js` | **🔴 DEPRECATE** | Manual migration apply | Phase 5 |
| `scripts/apply-clinical-orders-migration.js` | **🟢 KEEP** | Local-only guard (rejects non-local), test artifact | Retained |
| `npx supabase db push` (production) | **🔴 DEPRECATE** | Bypass path, enforce Golden Path only | Phase 5 |
| `psql` (production mutation) | **🔴 RESTRICT** | Emergency break-glass only, must audit | Phase 5 |
| Supabase SQL Editor (production) | **🔴 RESTRICT** | Emergency break-glass only, must audit | Phase 5 |
| Vercel Git auto-deploy (production) | **🔴 RESTRICT** | Disable, enforce GitHub Actions only | Phase 5 |
| Test/local migration utilities | **🟢 KEEP** | Enforce LOCAL_ONLY boundary | Retained |
| `package.json` scripts (140+) | **🟡 AUDIT** | Classify each, integrate safe operations into Golden Path | Phase 4-5 |

### Classification Legend

- **🟢 REUSE:** Integrate into Golden Path (Phase 4)
- **🟢 KEEP:** Retain as-is (operational/test utility)
- **🟡 ARCHIVE:** Historical evidence, remove from workflows (Phase 7)
- **🟡 AUDIT:** Requires case-by-case classification (Phase 4-5)
- **🔴 DEPRECATE:** Mark obsolete, remove from documentation (Phase 5)
- **🔴 RESTRICT:** Emergency break-glass only, audit required (Phase 5)

---

## 🔐 ZERO-KNOWLEDGE DEPLOYMENT PRINCIPLE

### Developer/AI Knowledge Boundary

**What AI/Developer MUST know:**
```bash
git add .
git commit -m "feature: implement X"
git push
```

**What AI/Developer MUST NOT know:**
```
❌ DATABASE_URL
❌ DATABASE_EXECUTOR_URL
❌ Supabase password
❌ VERCEL_TOKEN
❌ PRODUCTION_SUPABASE_DB_URL
❌ psql commands
❌ supabase db push commands
❌ migration execution commands
❌ production SQL Editor access
❌ deployment mechanism selection
```

### Secret Boundary Enforcement

**GitHub Environment Secrets:**
- Stored in GitHub → Project → Settings → Secrets → Environments → Production
- Injected at runtime by GitHub Actions
- Masked in logs
- Zero access from repository code

**Runtime Injection:**
```yaml
# GitHub Actions (control plane)
env:
  DATABASE_EXECUTOR_URL: ${{ secrets.DATABASE_EXECUTOR_URL }}
  GATE_SIGNING_KEY: ${{ secrets.GATE_SIGNING_KEY }}
  VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }}
```

**Repository:**
- No production secrets in `.env`
- No production secrets in code
- No production secrets in documentation

---

## 🛑 PRODUCTION MUTATION — SINGLE PATH ONLY

### Enforced Production Database Mutation Path

```
GitHub Actions
      ↓
BDGF gate-runner
      ↓
migration-executor
      ↓
bella_migration_executor (PostgreSQL role)
      ↓
PostgreSQL
```

**NO OTHER PATH ALLOWED FOR PRODUCTION MUTATION.**

### Enforced Production Application Deployment Path

```
GitHub Actions
      ↓
Vercel CLI (via GitHub Actions)
      ↓
Vercel Production
```

**NO OTHER PATH ALLOWED FOR PRODUCTION APP DEPLOYMENT.**

### Emergency Break-Glass Protocol

**Allowed Emergency Paths (HUMAN AUTHORIZED ONLY):**
- Supabase SQL Editor (dashboard login required)
- `psql` (direct connection, must be audited)
- Supabase CLI (manual, must be audited)

**Emergency Requirements:**
1. ⚠️ NOT NORMAL DEPLOYMENT
2. 👤 HUMAN AUTHORIZATION REQUIRED
3. 📝 MUST BE AUDITED IN INCIDENT LOG
4. 🔍 POST-INCIDENT REVIEW REQUIRED

**Emergency Audit Log Format:**
```
Timestamp: 2026-08-25 14:30:00 UTC
Operator: human@example.com
Path: psql direct connection
Change: ALTER TABLE ... (description)
Reason: Production outage, Golden Path blocked
Authorization: CTO approval (ticket #1234)
Post-incident: Golden Path fixed, gap analysis complete
```

---

## 📋 P0.3 EXECUTION PHASES

### Phase 1: A3 Classification ✅ COMPLETE

**Deliverable:** This document  
**Status:** FROZEN  
**Output:** Artifact classification, architectural decision locked

### Phase 2: Golden Path Contract (NEXT)

**Objective:** Define exact contract (not implementation)

**Contract Elements:**
1. Entry point: `git push` → GitHub Actions
2. Detection: Code changes + DB migrations
3. Validation: Tests, security, architecture guard
4. Policy: BDGF gate-runner
5. Execution: migration-executor → bella_migration_executor
6. Verification: DB state validation
7. Deployment: Vercel (conditional on DB success)
8. Smoke: Production health check
9. Audit: Record all steps

**Deliverable:** `P0_3_GOLDEN_PATH_CONTRACT.md`

**Rules:**
- ✅ Define WHAT, not HOW
- ✅ Specify inputs/outputs for each step
- ✅ Define failure modes and rollback
- ❌ No implementation code yet

### Phase 3: Zero-Knowledge Secret Boundary

**Objective:** Isolate production secrets from repository/AI

**Tasks:**
1. Audit current secret usage (all files referencing production credentials)
2. Move production secrets to GitHub Environment Secrets
3. Remove production secrets from `.env` (already done in P0.2)
4. Update documentation to remove secret references
5. Verify logs mask secrets
6. Create secret rotation procedure

**Deliverable:** Secret boundary verification report

### Phase 4: Build Control Plane

**Objective:** Implement Golden Path in GitHub Actions

**Tasks:**
1. Enhance `deploy-production.yml` with BDGF integration
2. Create gate configuration for production deployment
3. Integrate `migration-executor.mjs` into workflow
4. Implement DB verification step
5. Implement conditional Vercel deployment (only if DB success)
6. Implement production smoke test
7. Implement audit logging

**Deliverable:** Working GitHub Actions workflow

### Phase 5: Kill the Bypass Paths

**Objective:** Make legacy paths non-viable

**Tasks:**
1. Mark `deploy-schema.mjs` as DEPRECATED (code comment + error if invoked)
2. Mark `decision-engine-deploy.yml` as DEPRECATED (disable workflow)
3. Mark bash deploy scripts as DEPRECATED (error message if executed)
4. Update documentation to remove legacy path references
5. Restrict Vercel Git auto-deploy (disable in Vercel project settings)
6. Document emergency break-glass protocol
7. Create audit log template for emergency usage

**Deliverable:** Legacy path deprecation report

### Phase 6: Adversarial Testing

**Objective:** Prove bypass paths are blocked

**Test Scenarios:**
1. AI attempts to use `deploy-schema.mjs` → **MUST FAIL**
2. AI attempts `supabase db push` in production → **MUST FAIL** (or document as emergency-only)
3. AI creates dangerous migration (drops RLS) → **MUST BLOCK**
4. AI uses wrong credential (DATABASE_URL instead of DATABASE_EXECUTOR_URL) → **MUST FAIL**
5. Migration fails midway → **MUST NOT DEPLOY APP**
6. DB success but app build fails → **MUST NOT PROMOTE VERCEL**
7. Missing gate token → **MUST BLOCK**
8. Forged gate token → **MUST DETECT AND BLOCK**
9. Already-consumed gate token → **MUST BLOCK**
10. Production smoke test fails → **MUST NOT PROMOTE** (or rollback)

**Deliverable:** Adversarial test report (all scenarios PASS)

### Phase 7: Production Lock

**Objective:** Freeze Golden Path, enforce architecture guard

**Tasks:**
1. Freeze Golden Path contract (no changes without ADR)
2. Enable architecture guard to enforce Golden Path
3. Archive R3 scripts (move to `scripts/bdgf/archive/r3/`)
4. Remove deprecated scripts (after 30-day deprecation period)
5. Update all documentation to reference Golden Path only
6. Create runbook for emergency break-glass
7. Train team on new deployment workflow

**Deliverable:** `P0_3_PRODUCTION_LOCK_COMPLETE.md`

---

## 🎯 END STATE (POST-P0.3)

### Developer/AI Workflow

```bash
# Developer/AI only needs to know:
git add .
git commit -m "feature: add X"
git push
```

### Platform Workflow (Automatic)

```
git push
   ↓
GitHub Actions DETECTS:
  - Application code changes
  - Database migration files
   ↓
VALIDATES:
  - Static analysis (linting, type-check)
  - Unit tests
  - Integration tests
  - Architecture guard (healthcare, logistics frozen layers)
  - Security scan (secrets, vulnerabilities)
   ↓
ANALYZES MIGRATION:
  - Zero-downtime check
  - RLS invariant check
  - Breaking change detection
   ↓
POLICY ENGINE (BDGF):
  - Generate gate token
  - Bind to migration hash
  - Record approval (human or automated)
   ↓
EXECUTE MIGRATION:
  - Validate gate token
  - Consume token (single-use)
  - Execute via bella_migration_executor
  - Verify DB state
   ↓
DEPLOY APPLICATION (conditional on DB success):
  - Build Vercel preview
  - Smoke test preview
  - Promote to production (manual approval)
   ↓
PRODUCTION SMOKE:
  - Health check
  - Critical path verification
   ↓
AUDIT:
  - Record deployment
  - Record migration
  - Record gate token usage
   ↓
🟢 LIVE
```

### Failure Handling

**If validation fails:**
```
❌ BLOCKED
   ↓
GitHub Actions fails
   ↓
AI sees: "Tests failed" or "Architecture guard rejected"
   ↓
AI fixes → pushes again → retry
```

**If migration fails:**
```
❌ DB MUTATION FAILED
   ↓
Rollback migration (if transactional)
   ↓
DO NOT DEPLOY APP
   ↓
Production state: SAFE (unchanged)
   ↓
AI sees: "Migration failed: {reason}"
   ↓
AI fixes → pushes again → retry
```

**If app build fails:**
```
✅ DB MUTATION SUCCESS
   ↓
❌ APP BUILD FAILED
   ↓
DO NOT PROMOTE VERCEL
   ↓
DB state: MIGRATED (forward-only)
   ↓
App state: OLD VERSION (still serving)
   ↓
AI sees: "App build failed: {reason}"
   ↓
AI fixes → pushes again → retry (DB migration already applied, idempotent)
```

**If smoke test fails:**
```
✅ DB MIGRATION SUCCESS
✅ APP DEPLOYED (preview)
❌ SMOKE TEST FAILED
   ↓
DO NOT PROMOTE TO PRODUCTION
   ↓
Production state: OLD VERSION (still serving)
   ↓
AI sees: "Smoke test failed: {reason}"
   ↓
AI fixes → pushes again → retry
```

---

## 🔒 ARCHITECTURAL INVARIANTS (FROZEN)

### Invariant 1: Single Production Mutation Path

**Only ONE mechanism for production database mutation:**
```
GitHub Actions → BDGF → migration-executor → bella_migration_executor → PostgreSQL
```

**Enforcement:**
- Architecture guard MUST reject any direct `psql`, `supabase db push`, `deploy-schema.mjs` invocation in CI
- Emergency paths MUST log to audit trail

### Invariant 2: Zero-Knowledge Deployment

**Developer/AI has ZERO production credential access:**
- No `DATABASE_EXECUTOR_URL` in repository code
- No `VERCEL_TOKEN` in repository code
- All production secrets in GitHub Environment Secrets only

**Enforcement:**
- Secret scanning in CI (already exists: `npm run security:secrets`)
- Code review blocks PRs with hardcoded secrets

### Invariant 3: Control Plane Separation

**GitHub Actions is Control Plane:**
- Orchestrates deployment
- Enforces policy
- Injects secrets at runtime

**BDGF is Policy Engine:**
- Gate token generation/validation
- Approval workflow
- Audit logging

**bella_migration_executor is Execution Identity:**
- PostgreSQL role with mutation permission
- No direct access from AI/developer
- Only accessible via BDGF gate

**Enforcement:**
- No code outside GitHub Actions should invoke BDGF for production
- No code should connect with bella_migration_executor except migration-executor.mjs

### Invariant 4: Forward-Only Migrations

**Database migrations are forward-only:**
- No rollback of applied migrations
- Rollback = new forward migration to undo changes

**Enforcement:**
- BDGF tracks applied migrations
- Duplicate application detected and blocked

### Invariant 5: App Conditional on DB

**Application deployment conditional on database success:**
- If DB migration fails → DO NOT DEPLOY APP
- If DB migration succeeds but app fails → OLD APP STILL SERVES (safe state)

**Enforcement:**
- GitHub Actions workflow dependency: `deploy-app` job depends on `migrate-db` job

---

## 📊 SUCCESS CRITERIA (P0.3 COMPLETE)

### ✅ Gate 1: Architectural

- [x] Option A selected and locked
- [ ] Golden Path contract defined
- [ ] Control Plane / Policy Engine / Executor separation documented
- [ ] Zero-Knowledge principle documented

### ✅ Gate 2: Implementation

- [ ] GitHub Actions workflow enhanced with BDGF
- [ ] migration-executor.mjs integrated
- [ ] Secret boundary enforced (production secrets in GitHub only)
- [ ] Vercel deployment conditional on DB success

### ✅ Gate 3: Deprecation

- [ ] Legacy paths marked DEPRECATED
- [ ] Documentation updated (no legacy path references)
- [ ] Emergency break-glass protocol documented
- [ ] Audit log template created

### ✅ Gate 4: Adversarial

- [ ] 10 adversarial test scenarios executed
- [ ] All bypass attempts blocked
- [ ] Failure modes validated (DB fail → no app deploy)
- [ ] Emergency path audit verified

### ✅ Gate 5: Production

- [ ] Golden Path frozen (contract immutable)
- [ ] Architecture guard enforces Golden Path
- [ ] R3 scripts archived
- [ ] Deprecated scripts removed (after grace period)
- [ ] Team trained on new workflow

---

## 🚀 IMMEDIATE NEXT ACTION

**Phase 2 Start:** Define Golden Path Contract

**Deliverable:** `P0_3_GOLDEN_PATH_CONTRACT.md`

**Content:**
1. Entry: git push trigger
2. Detection: Changes identified (code, migrations, config)
3. Validation: Test suite, security, architecture guard
4. Analysis: Migration safety analysis
5. Policy: BDGF gate token generation/validation
6. Approval: Human or automated approval gate
7. Execution: migration-executor → bella_migration_executor
8. Verification: DB state validation (RLS, permissions, data integrity)
9. Deployment: Vercel preview → smoke → promote
10. Audit: Record all steps in audit log

**Contract Format:**
- Each step: Input → Process → Output → Failure Mode
- No implementation details (WHAT, not HOW)
- Specify failure rollback behavior
- Define idempotency requirements

**Rules:**
- ❌ No code implementation in Phase 2
- ✅ Contract must be verifiable (each step testable)
- ✅ Contract must be immutable after Phase 7

---

**END OF A3 CLASSIFICATION DECISION**

**Status:** LOCKED ✅  
**Next:** Phase 2 — Golden Path Contract  
**Blocked By:** None  
**Decision Authority:** User (approved Option A)
