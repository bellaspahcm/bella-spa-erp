# P0.2-E1: Evidence Findings

**Date:** 2026-08-24  
**Phase:** Execution Phase 1 — Evidence Gate  
**Status:** 🔴 INCOMPLETE (filesystem evidence complete, infrastructure proof incomplete)

---

## Executive Summary

**E1 Objective:** Determine if infrastructure provides proven safe path for replacement credentials before creating `bella_readonly`.

**E1 Outcome:** 🔴 **Replacement path NOT YET PROVEN**

**Critical Discovery:** Security boundary exists but misaligned — Environment "Production" protects Vercel promotion, NOT production database credential access.

**Blocking Issue:** Production DB credential accessible to CI without approval gate, same topology as GAP being remediated (C5).

**E2 Status:** 🔒 **BLOCKED** — Cannot create `bella_readonly` without verified storage path.

---

## Evidence Collection Status

| Evidence Type | Status | Confidence | Source |
|---------------|--------|------------|--------|
| **Filesystem Evidence** | ✅ COMPLETE | HIGH | Workflow files, scripts |
| **GitHub UI/API Evidence** | ⚠️ INCOMPLETE | N/A | Requires manual verification |
| **Supabase Dashboard Evidence** | ⚠️ INCOMPLETE | N/A | Requires manual verification |
| **Infrastructure Proof** | 🔴 INCOMPLETE | N/A | Blocked by evidence gaps |

---

## Part 1: Filesystem Evidence (COMPLETE)

### Finding 1.1: GitHub Environment "Production" Exists

**Evidence:**
```yaml
# .github/workflows/deploy-production.yml (line 136-139)
promote:
  environment:
    name: Production
    url: ${{ vars.PRODUCTION_BASE_URL || vars.E2E_BASE_URL || 'https://bella-spa-erp.vercel.app' }}
```

**Confirmed:**
- ✅ Environment "Production" referenced in workflow
- ✅ Applied to `promote` job only
- ✅ Has name and URL configuration

**Confidence:** HIGH (direct file evidence)

---

### Finding 1.2: Production DB Credential is Repository-Level Secret

**Evidence:**
```yaml
# .github/workflows/deploy-production.yml (line 38, 58)
validate:
  steps:
    - name: Require immutable deployment configuration
      env:
        PRODUCTION_SUPABASE_DB_URL: ${{ secrets.PRODUCTION_SUPABASE_DB_URL }}
    
    - run: npm run db:migration:check
      env:
        SUPABASE_DB_URL: ${{ secrets.PRODUCTION_SUPABASE_DB_URL }}
```

**Confirmed:**
- ✅ `PRODUCTION_SUPABASE_DB_URL` accessed via `secrets.*` (not `secrets.ENVIRONMENT_NAME.*`)
- ✅ Used in `validate` job
- ✅ `validate` job has NO `environment:` field

**Inference:** Secret is repository-level (accessible to any workflow job), NOT Environment-level.

**Confidence:** HIGH (workflow syntax indicates repository secret)

---

### Finding 1.3: Boundary Misalignment

**Evidence — Environment Protection:**
```yaml
# Only promote job has environment protection
promote:
  environment:
    name: Production
  env:
    VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }}
  steps:
    - run: npx vercel promote "$DEPLOYMENT_URL" --yes --token="$VERCEL_TOKEN"
```

**Evidence — DB Credential Access:**
```yaml
# validate job has NO environment protection
validate:
  # No environment: field
  env:
    PRODUCTION_SUPABASE_DB_URL: ${{ secrets.PRODUCTION_SUPABASE_DB_URL }}
```

**Critical Finding:**
```
Environment "Production" protects:
  - promote job ✓
  - Vercel promotion ✓
  
Environment "Production" does NOT protect:
  - validate job ✗
  - Production DB credential access ✗
```

**Conclusion:** Security boundary placed at wrong workflow step.

**Confidence:** HIGH (direct workflow structure evidence)

---

### Finding 1.4: Secret Topology Map

| Secret | Location | Used In | Environment Protection | Purpose |
|--------|----------|---------|------------------------|---------|
| `PRODUCTION_SUPABASE_DB_URL` | Repository | deploy-production.yml (validate) | ❌ NO | Production migration check |
| `SUPABASE_DB_URL` | Repository | ci-tests.yml, quality-security.yml | ❌ NO | CI migration check (likely test DB) |
| `STAGING_SUPABASE_DB_URL` | Repository | deploy-staging.yml | ❌ NO | Staging deployment |
| `VERCEL_TOKEN` | Repository | Multiple workflows | ❌ NO (🟡 PARTIAL in promote) | Vercel operations |

**Pattern Identified:** All database credentials are repository-level secrets, accessible without approval.

**Confidence:** HIGH (comprehensive workflow grep)

---

### Finding 1.5: DB Command Authority Requirements

**Evidence:**
```javascript
// scripts/check-supabase-migrations.cjs
function getSupabaseMigrationListArgs() {
  const dbUrl = process.env.SUPABASE_DB_URL || process.env.SUPABASE_DATABASE_URL;
  return ['--yes', 'supabase', 'migration', 'list', '--db-url', dbUrl];
}
```

**Command executed:**
```bash
npx supabase migration list --db-url "$SUPABASE_DB_URL"
```

**Authority Analysis:**
- **Minimum:** SELECT on `supabase_migrations.schema_migrations`
- **Possible:** Additional metadata access depending on Supabase CLI implementation
- **Not required:** DDL privileges (read-only operation)

**Implication:** Migration check does NOT require production DDL authority, could use read-only credential if properly isolated.

**Confidence:** MEDIUM (code analysis, actual CLI privilege requirements unverified)

---

### Finding 1.6: Workflow Permission Model

**Evidence:**
```yaml
# .github/workflows/deploy-production.yml (line 8-9)
permissions:
  contents: read
```

**Confirmed:**
- ✅ Workflow has read-only repository access
- ✅ No elevated GitHub token permissions

**NOT Confirmed from Filesystem:**
- ⚠️ Who can trigger `workflow_dispatch`
- ⚠️ Who can modify workflow files
- ⚠️ Branch protection on main
- ⚠️ Required reviews before merge

**Potential Access Paths (UNVERIFIED):**

**Path 1: Workflow Modification**
```
Developer with write access
  ↓
Modify deploy-production.yml
  ↓
Add step: echo "$PRODUCTION_SUPABASE_DB_URL"
  ↓
Commit and trigger workflow
  ↓
Read secret from logs
```
**Mitigation (unverified):** Branch protection with required reviews

**Path 2: Workflow Trigger**
```
Developer
  ↓
Trigger deploy-production.yml via gh CLI or GitHub UI
  ↓
Workflow executes validate job
  ↓
Indirect production DB access via migration check
```
**Mitigation:** None identified (workflow_dispatch accessible by default)

**Path 3: AI via GitHub Token**
```
AI with GitHub token + workflow dispatch permission
  ↓
Execute: gh workflow run deploy-production.yml
  ↓
Workflow executes with secrets
  ↓
Indirect access
```
**Mitigation (unverified):** AI does not have GitHub token (from P0.2 Section 2 evidence)

**Confidence:** LOW (permission model requires GitHub UI/API verification)

---

### Finding 1.7: Comparison to Remediation Target (C5)

**From P0.2 Gap Analysis:**
```
C5: CI has production credentials
  Status: CONFIRMED GAP
  Location: Repository secrets (inferred)
  Authority: Unknown (requires infrastructure verification)
  Risk: Credential accessible to workflows without approval
```

**Current Finding:**
```
PRODUCTION_SUPABASE_DB_URL:
  Location: Repository secret (confirmed)
  Accessible to: validate job (confirmed)
  Approval required: NO (confirmed)
  Environment protection: NO (confirmed)
```

**Assessment:** Current topology IS the GAP being remediated (C5).

**Implication:** Creating `bella_readonly` in same location = credential proliferation without boundary improvement.

**Confidence:** HIGH (direct match to gap definition)

---

## Part 2: Evidence Gaps (INCOMPLETE)

### Gap 2.1: GitHub Environment Protection Configuration

**Required Evidence:**
- Environment "Production" protection rules
- Required reviewers (number, who)
- Deployment branch restrictions
- Wait timer configuration
- Which secrets stored at Environment level vs Repository level

**Source:** Repository Settings → Environments → Production

**Status:** ⚠️ **NOT VERIFIED** (requires GitHub UI/API access)

**Impact:** Cannot confirm whether Environment protection is configured to create sufficient boundary.

---

### Gap 2.2: Secret Storage Verification

**Required Evidence:**
- List of Repository-level secrets
- List of Environment "Production" secrets
- Actual location of `PRODUCTION_SUPABASE_DB_URL`

**Source:** Repository Settings → Secrets and variables → Actions

**Status:** ⚠️ **NOT VERIFIED** (requires GitHub UI access)

**Impact:** Cannot confirm secret topology beyond workflow syntax inference.

---

### Gap 2.3: Branch Protection Configuration

**Required Evidence:**
- Protection rules on `main` branch
- Required reviews before merge
- Dismiss stale reviews
- Require status checks
- Restrict who can push
- Restrict workflow file modifications

**Source:** Repository Settings → Branches → main

**Status:** ⚠️ **NOT VERIFIED** (requires GitHub UI access)

**Impact:** Cannot assess effectiveness of workflow modification mitigation.

---

### Gap 2.4: Repository Permissions

**Required Evidence:**
- Collaborator list with roles (Admin, Maintain, Write, Triage, Read)
- Which users/teams can trigger workflows
- Which users/teams can modify workflows
- Which users/teams can read/write secrets

**Source:** Repository Settings → Collaborators and teams

**Status:** ⚠️ **NOT VERIFIED** (requires GitHub UI access)

**Impact:** Cannot assess developer access paths.

---

### Gap 2.5: Deployment Identity

**Required Evidence:**
- GitHub Actions runner identity
- OIDC configuration (if used)
- Service account configuration (if used)
- Identity isolation from human developers

**Source:** GitHub Actions execution context, infrastructure documentation

**Status:** ⚠️ **PARTIALLY KNOWN** (GitHub Actions runner by default, but not verified as unique identity)

**Impact:** Cannot confirm deployment identity is separate from developer identity.

---

### Gap 2.6: Audit Trail Completeness

**Required Evidence:**
- GitHub Actions log retention policy
- What is captured in logs (who, when, approval chain, secret access)
- Supabase audit log configuration
- E8.0.4 provenance table retention

**Source:** Repository settings, Supabase dashboard, database schema

**Status:** 🟡 **PARTIALLY VERIFIED** (logs exist, completeness and retention unverified)

**Impact:** Cannot confirm comprehensive audit trail for credential access.

---

### Gap 2.7: Supabase Project Secrets

**Required Evidence:**
- Whether Supabase Project Secrets feature is available for this project
- Access control model (project member roles)
- How secrets are retrieved (CLI, API)
- Current project member roles and permissions
- Audit logging configuration

**Source:** Supabase Dashboard → Project Settings → Secrets

**Status:** ⚠️ **NOT VERIFIED** (requires Supabase dashboard access)

**Impact:** Cannot assess Supabase Project Secrets as alternative path.

---

## Part 3: Architectural Analysis

### 3.1: GitHub Environment Path Assessment

**What EXISTS:**
- ✅ GitHub Environment "Production" configured in workflow
- ✅ Environment applied to `promote` job

**What is MISSING:**
- ✗ Environment protection NOT applied to production DB credential access
- ✗ Production DB credential NOT stored at Environment level
- ✗ `validate` job does NOT reference Environment

**What is UNKNOWN:**
- ⚠️ Environment protection rules configuration
- ⚠️ Branch protection effectiveness
- ⚠️ Developer permission boundaries

**To establish this path:**
1. Verify Environment protection rules via GitHub UI
2. Move `PRODUCTION_SUPABASE_DB_URL` from Repository to Environment secrets
3. Add `environment: Production` to jobs that need production DB access
4. Verify branch protection on main
5. Re-audit credential access paths

**Assessment:** 🟡 **FEASIBLE but requires remediation work**

---

### 3.2: Supabase Project Secrets Path Assessment

**What EXISTS:**
- ✅ Supabase Project infrastructure (production database exists)

**What is MISSING:**
- ⚠️ Project Secrets feature not verified
- ⚠️ Access control model not verified
- ⚠️ Retrieval mechanism not implemented

**What is UNKNOWN:**
- ⚠️ Feature availability
- ⚠️ Project member roles
- ⚠️ Audit logging

**To establish this path:**
1. Verify Supabase Project Secrets feature via dashboard
2. Verify project member roles and secret access permissions
3. Implement Supabase CLI authentication in workflow
4. Store credentials in Supabase Project Secrets
5. Update workflow to retrieve via CLI
6. Verify audit logging

**Assessment:** ⚠️ **UNKNOWN feasibility, requires verification and implementation**

---

### 3.3: Split Credential Architecture (RECOMMENDED)

**Design:**
```
PR/CI Validation Path:
  Repository Secret: TEST_DATABASE_URL
    ↓
  ci-tests.yml, deploy-production.yml (validate)
    ↓
  Test Database
    ↓
  NO approval required
  Fast feedback

Production Deployment Path:
  Environment Secret: PRODUCTION_DATABASE_URL
    ↓
  environment: Production (approval required)
    ↓
  deploy-production.yml (deploy job, not validate)
    ↓
  E8.0.4 Deployment Adapter
    ↓
  Production Database
```

**Principle:**
```
Production credential should NOT exist in validate job
just because validation needs A database.

Validation should use test database.
Production credential only in deployment path with approval.
```

**Advantages:**
- ✅ Clean separation of test vs production
- ✅ CI validation remains fast (no approval needed)
- ✅ Production credential properly protected by Environment
- ✅ Reduces production credential exposure surface
- ✅ Aligns boundary with authority requirement

**Requirements:**
1. Test database with same schema as production
2. Workflow modification to split credential usage
3. Environment protection verification
4. Test data management for validation

**Assessment:** ✅ **RECOMMENDED** — cleanest boundary alignment

---

## Part 4: Conclusions

### 4.1: Replacement Path Status

**Question:** Is there a proven infrastructure path for replacement credential?

**Answer:** 🔴 **NO — Replacement path NOT YET PROVEN**

**Reasons:**

1. **GitHub Environment path:**
   - Infrastructure exists ✓
   - Currently NOT protecting DB credential ✗
   - Protection rules unverified ⚠️
   - Requires remediation work 📋

2. **Supabase Project Secrets path:**
   - Infrastructure existence unverified ⚠️
   - Access control unverified ⚠️
   - Requires implementation work 📋

3. **Both paths:**
   - Have evidence gaps ⚠️
   - Require additional verification 📋
   - Require remediation or implementation work 📋

**Blocking Issue:** Cannot create `bella_readonly` without verified safe storage location. Risk of credential proliferation in GAP being remediated.

---

### 4.2: Evidence Quality Assessment

| Evidence Type | Quality | Gaps | Actionable |
|---------------|---------|------|-----------|
| Filesystem | ✅ HIGH | None | Yes |
| Workflow structure | ✅ HIGH | None | Yes |
| Secret topology | 🟡 MEDIUM | Actual storage location | Partially |
| Permission model | 🔴 LOW | Roles, protection rules | No |
| Infrastructure config | 🔴 LOW | GitHub/Supabase UI | No |

**Overall Confidence:** 🟡 **MEDIUM** for problems identified, 🔴 **LOW** for solutions verified.

---

### 4.3: Risk Assessment if E2 Proceeds Without E1 Complete

**Scenario:** Create `bella_readonly` before infrastructure proof complete

**Risks:**

1. **Credential in wrong boundary:**
   ```
   bella_readonly → Repository Secret
     ↓
   Same GAP as current credential (C5)
     ↓
   No boundary improvement
   ```

2. **Credential proliferation:**
   ```
   Before: 1 credential in GAP
   After: 2 credentials in GAP
     ↓
   More credentials to migrate later
   ```

3. **Remediation complexity:**
   ```
   Must move bella_readonly AFTER creation
     ↓
   Rotation/revocation on two credentials
     ↓
   More audit points to verify
   ```

4. **False sense of security:**
   ```
   "bella_readonly created" ≠ "credential boundary improved"
     ↓
   Appears remediated, actually not
   ```

**Assessment:** 🔴 **HIGH RISK** — P0.2 correctly blocks E2 until E1 complete.

---

### 4.4: P0.2 Value Confirmation

**P0.2 designed to prevent:**
```
Credential proliferation without boundary improvement
Creating credentials before storage path verified
Assumption-based remediation
```

**P0.2 actually prevented:**
```
WITHOUT E1:
  "Let's create bella_readonly"
    ↓
  Store in GitHub Repository Secret
    ↓
  Same GAP as current credential (C5)
    ↓
  More credentials, no boundary ✗

WITH E1:
  "Prove replacement path first"
    ↓
  Evidence shows boundary misalignment
    ↓
  Block credential creation
    ↓
  Require infrastructure remediation
    ↓
  Prevent credential proliferation ✓
```

**Assessment:** ✅ **P0.2 working as intended** — E1 caught exact scenario design was meant to prevent.

---

## Part 5: Recommended Next Steps

### Step 1: Gather GitHub Evidence (REQUIRED)

**Manual verification by Architect or Repository Owner:**

1. **Environment Protection Rules:**
   - Navigate to: Repository Settings → Environments → Production
   - Document: Required reviewers, branch restrictions, wait timer
   - Screenshot: Protection rules configuration

2. **Secret Storage Topology:**
   - Navigate to: Repository Settings → Secrets and variables → Actions
   - List: All repository-level secrets
   - List: All Environment "Production" secrets
   - Confirm: Actual location of `PRODUCTION_SUPABASE_DB_URL`

3. **Branch Protection:**
   - Navigate to: Repository Settings → Branches → main
   - Document: Required reviews, status checks, restrictions
   - Confirm: Workflow file modification protection

4. **Repository Permissions:**
   - Navigate to: Repository Settings → Collaborators and teams
   - List: Users/teams with Write or Admin access
   - Document: Who can trigger/modify workflows

**Deliverable:** GitHub Evidence Appendix (screenshots + documentation)

---

### Step 2: Select Architectural Path (DECISION REQUIRED)

**Recommended:** Split Credential Architecture with GitHub Environment

**Design:**
```
CI Validation:
  TEST_DATABASE_URL (repository or environment secret, test DB)
    ↓
  validate job (no production access)
    ↓
  Fast feedback, no approval

Production Deployment:
  PRODUCTION_DATABASE_URL (environment secret)
    ↓
  environment: Production (approval required)
    ↓
  Deployment job only
    ↓
  E8.0.4 Deployment Adapter
```

**Alternative:** Supabase Project Secrets (requires verification first)

**Decision Point:** Architect must choose path based on:
- Operational complexity acceptable
- Workflow friction acceptable
- Infrastructure availability
- Evidence feasibility

---

### Step 3: Complete E1 Infrastructure Proof

**After GitHub evidence gathered:**

1. Update E1 with verified evidence
2. Assess whether selected path meets requirements:
   - Storage: ✓
   - Identity: ✓
   - Retrieval: ✓
   - Developer isolation: ✓
   - AI isolation: ✓
   - Audit: ✓

3. If ALL requirements met:
   ```
   E1 Infrastructure Proof: ✅ COMPLETE
   E2: 🔓 UNLOCKED
   ```

4. If ANY requirement not met:
   ```
   E1: 🔴 INCOMPLETE
   E2: 🔒 BLOCKED
   Design remediation
   ```

---

### Step 4: Infrastructure Remediation (if required)

**For Split Credential + GitHub Environment path:**

1. **Create or configure test database**
   - Provision test database with production schema
   - Populate with test data for validation

2. **Update GitHub Secrets:**
   - Create `TEST_DATABASE_URL` (repository or environment for test)
   - Move `PRODUCTION_SUPABASE_DB_URL` to Environment "Production" secrets
   - OR create new `PRODUCTION_DATABASE_URL` in Environment "Production"

3. **Modify workflows:**
   - `ci-tests.yml`: Use `TEST_DATABASE_URL`
   - `deploy-production.yml` (validate): Use `TEST_DATABASE_URL`
   - `deploy-production.yml` (new deploy job): Use `PRODUCTION_DATABASE_URL` with `environment: Production`

4. **Verify:**
   - Test CI runs use test DB
   - Production deployment requires approval
   - Production credential not accessible to validate job

5. **Re-audit:**
   - Verify boundary effective
   - Update E1 status
   - Unlock E2

---

### Step 5: Proceed to E2 (only after E1 complete)

**When E1 Infrastructure Proof = COMPLETE:**

```
E2: Create bella_readonly
  ↓
PostgreSQL role creation (metadata-verified authority)
  ↓
Store credential in VERIFIED safe storage (Environment "Production")
  ↓
Metadata verification (no DDL testing)
  ↓
Provide to developers via approved retrieval mechanism
```

---

## Part 6: Status Summary

### Current P0.2 Status

```
P0.2 Credential Boundary Audit
│
├── Evidence Collection       ✅ COMPLETE
├── Gap Analysis              ✅ COMPLETE
├── Remediation Design        ✅ COMPLETE
├── Architect Review          ✅ APPROVED
│
├── Execution Phase 1 (E1)
│   ├── Filesystem Evidence   ✅ COMPLETE (high confidence)
│   ├── Infrastructure Proof  🔴 INCOMPLETE (evidence gaps)
│   └── Status                🔴 INCOMPLETE
│
├── Execution Phase 2 (E2)
│   ├── bella_readonly        🔒 BLOCKED (E1 incomplete)
│   └── Status                🔒 BLOCKED
│
├── Credential Migration      🔒 BLOCKED (E2 incomplete)
├── Credential Removal        🔒 BLOCKED (migration incomplete)
└── Re-Audit                  ⏸ DEFERRED (execution incomplete)
```

### Execution Restrictions

**NOT PERMITTED until E1 complete:**
- ❌ `bella_readonly` creation
- ❌ Credential migration
- ❌ Credential deletion/rotation
- ❌ Workflow modification (production)
- ❌ Secret storage/movement
- ❌ Production database operations

**ONLY PERMITTED:**
- ✅ Evidence collection (READ-ONLY)
- ✅ Documentation
- ✅ Architecture design
- ✅ Manual verification (GitHub UI/API)

### Next Action

⏸ **PAUSED** — Awaiting Architect to:
1. Provide GitHub UI/API evidence
2. Select architectural path
3. Approve infrastructure remediation scope
4. Authorize E1 continuation

---

## Appendices

### Appendix A: Language Precision

**Regarding potential access paths:**

**AVOID absolute claims:**
- ✗ "Developer CAN access secret"
- ✗ "AI CAN access secret"

**USE evidence-based language:**
- ✓ "A potential credential-exfiltration path exists through workflow modification/execution"
- ✓ "Effective exploitability requires GitHub permission evidence"
- ✓ "Access path POSSIBLE if developer has write permission AND branch protection not configured"

**Rationale:** `Potential path ≠ Proven effective authority`

---

### Appendix B: Evidence Sources

**Filesystem Evidence:**
- `.github/workflows/deploy-production.yml`
- `.github/workflows/deploy-staging.yml`
- `.github/workflows/ci-tests.yml`
- `.github/workflows/quality-security.yml`
- `scripts/check-supabase-migrations.cjs`
- `package.json`

**Required UI/API Evidence:**
- Repository Settings → Environments → Production
- Repository Settings → Secrets and variables → Actions
- Repository Settings → Branches → main
- Repository Settings → Collaborators and teams
- Supabase Dashboard → Project Settings → Secrets

---

### Appendix C: Key Definitions

**Boundary misalignment:**
```
Security control exists BUT not applied to asset being protected.

Example:
  Environment "Production" exists (control)
  Production DB credential accessed outside Environment (asset)
  Control not protecting asset = misalignment
```

**Credential proliferation:**
```
Creating additional credentials without improving security boundary.

Example:
  Old credential in repository secret (GAP)
  New credential in repository secret (same GAP)
  More credentials, no boundary improvement
```

**Evidence gap:**
```
Information required to prove security property but not yet available.

Example:
  Claim: "Environment protection blocks developer access"
  Evidence gap: Environment protection rules not verified
  Cannot prove claim without evidence
```

---

## Document Control

**Version:** 1.0  
**Status:** FINAL  
**Author:** AI (Kiro) under P0.2 E1 Evidence Collection  
**Reviewed:** Awaiting Architect Review  
**Next Review:** After GitHub evidence gathered

**Change Log:**
- 2026-08-24: Initial evidence findings documented
- Evidence complete from filesystem, infrastructure proof incomplete
- E2 remains blocked pending E1 completion

---

**END OF EVIDENCE FINDINGS**

**E1 Status:** 🔴 INCOMPLETE (filesystem evidence complete, infrastructure proof requires GitHub/Supabase verification)

**E2 Status:** 🔒 BLOCKED

**Next:** Architect provides GitHub evidence OR selects alternative path
