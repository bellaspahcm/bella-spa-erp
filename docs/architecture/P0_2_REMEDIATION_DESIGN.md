# P0.2: Remediation Design

**Date:** 2026-08-24  
**Phase:** Remediation Planning (DESIGN ONLY)  
**Status:** 🟡 AWAITING ARCHITECT REVIEW

**⚠️ CRITICAL: This document is DESIGN ONLY. NO EXECUTION without Architect Review and explicit approval.**

---

## 1. Executive Summary

### Current State (Evidence-Based)

**Confirmed gaps (Tier 1):**
- 🔴 C3: Developer has production DB credential on workstation
- 🔴 C4: AI can read credential files
- 🔴 C10: Production secrets on filesystem

**Infrastructure unknowns (Tier 2):**
- ⚠️ C7: Vault deployment status
- ⚠️ C8: Vault ACL enforcement
- ⚠️ C9: Vault audit trail
- ⚠️ C12: Network boundary enforcement

**Authority incomplete:**
- 🟡 C2: Effective PostgreSQL privileges not metadata-confirmed
- ⚠️ C5: CI credential authority not mapped

### Target State

**Developer boundary:**
```
Developer
  ├── Read-only credential (production)
  ├── DDL credential (test DB only)
  └── ✗ NO production DDL credential
```

**AI boundary:**
```
AI Runtime
  ✓ Application tools
  ✓ Source code access
  ✗ NO credential retrieval path (filesystem/environment/tool/service)
```

**CI boundary:**
```
CI Test/Build Workflows → Test DB only
Deployment Workflow → Vault → Production (authorized flow)
```

**Infrastructure boundary:**
```
Production DDL Credential
  ↓
Vault (ACL enforced, audit enabled)
  ↓
Deployment Service (unique identity, network-restricted)
  ↓
Production Database
```

---

## 2. Remediation Principles

### R1: Evidence-Driven Design

**Principle:** Do NOT assume infrastructure state from absence of workstation evidence.

**Application:**
- Vault status UNKNOWN → Design conditional approach
- Network policies UNKNOWN → Design verification-first approach
- CI authority INCOMPLETE → Design authority verification before access changes

### R2: Fail-Closed Default

**Principle:** When evidence insufficient, default to most restrictive design.

**Application:**
- IF Vault status unknown → Design as if not deployed (safest assumption)
- IF authority unconfirmed → Treat as potentially privileged (safest assumption)
- IF boundary unverified → Assume no boundary (safest assumption)

### R3: Incremental Verification

**Principle:** Each remediation step includes verification before next step.

**Application:**
- Remove credentials → Verify removal → THEN proceed
- Deploy Vault → Verify deployment → THEN migrate credentials
- Implement ACL → Verify enforcement → THEN open access

### R4: No Assumption Propagation

**Principle:** UNKNOWN state must NOT become assumed PASS/FAIL in design.

**Application:**
- C7 UNKNOWN → Design must handle both EXISTS and NOT EXISTS branches
- C12 UNPROVEN → Design must verify, not assume compliance

---

## 3. Remediation Areas

### Area 1: Developer Credential Boundary (C3, C10)

**Current truth:**
```
🔴 Production DB credential on developer workstation
  Location: .env.local, .env.production
  Credential: SUPABASE_DB_URL (postgres user)
  Effective authority: HIGH PROBABILITY DDL (not metadata-confirmed)
```

**Design target:**
```
Developer has no production DDL credential
  ✓ Read-only production credential (if needed)
  ✓ Test DB DDL credential (local/test environment)
  ✗ Production DDL credential
```

**Remediation steps (DESIGN):**

**Step 1: Credential Authority Verification**
```sql
-- MUST execute before removal to confirm what is being removed
-- READ-ONLY metadata query
SELECT rolname, rolsuper, rolcreatedb, rolcreaterole, rolbypassrls
FROM pg_roles
WHERE rolname = 'postgres';

-- Expected result: rolsuper = true
-- Confirms: Developer currently has superuser credential
```

**Step 2: Create Read-Only Credential (if not exists)**
```sql
-- Check if read-only role exists
SELECT rolname FROM pg_roles WHERE rolname = 'bella_readonly';

-- If not exists, create (requires production admin access)
CREATE ROLE bella_readonly LOGIN PASSWORD 'secure_password';
GRANT CONNECT ON DATABASE postgres TO bella_readonly;
GRANT USAGE ON SCHEMA public TO bella_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO bella_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO bella_readonly;

-- Verify: NO DDL capability
SELECT has_schema_privilege('bella_readonly', 'public', 'CREATE'); -- Should return false
```

**Step 3: Remove Production DDL Credential from Developer Workstation**
```bash
# DESIGN: Removal procedure
1. Backup current .env files (for rollback)
2. Remove SUPABASE_DB_URL from .env.local
3. Remove SUPABASE_SERVICE_ROLE_KEY from .env.local
4. Remove credentials from .env.production
5. Update .env.example to use placeholders only
6. Provide DATABASE_URL_READ_ONLY for developer use
```

**Step 4: Verification**
```bash
# Verify no production DDL credentials remain
grep -r "SUPABASE_DB_URL" .env*
grep -r "SUPABASE_SERVICE_ROLE_KEY" .env*
grep -r "postgres:" .env* # Connection string with postgres user

# Expected: No matches (or only in .env.test for test DB)
```

**Step 5: Developer Communication**
```
Communicate to developers:
  - Production DDL credentials removed
  - Use DATABASE_URL_READ_ONLY for production queries
  - Use DATABASE_URL_TEST for development/testing
  - Production deployments via Deployment Service only
```

**Verification criteria:**
- ✅ No production DDL credentials in `.env*` files
- ✅ Read-only credential works for production SELECT queries
- ✅ Read-only credential fails for CREATE/ALTER/DROP
- ✅ Developer can still develop/test with test DB

---

### Area 2: AI Credential Isolation (C4)

**Current truth:**
```
🔴 AI can read credential files
  Tool: read_file (unrestricted)
  Files accessible: .env.local, .env.production
  Layer 1 (App Guard): ✅ Blocks deployment execution
  Layer 2 (Credential): 🔴 Isolation failed
```

**Design target:**
```
AI has no credential-retrieval path
  ✗ Filesystem access to credentials
  ✗ Environment variable access to credentials
  ✗ Tool binding to credential services
  ✗ CI artifact access to credentials
  ✗ Vault client access
  ✗ Service identity impersonation
```

**Remediation steps (DESIGN):**

**Step 1: Remove Credentials from Filesystem**
```
Prerequisites: Area 1 complete (credentials removed from .env*)
Result: No credentials for AI to read
```

**Step 2: AI Tool Access Restriction (CONDITIONAL)**

**Option A: File-based restriction**
```
Implement .env* file blacklist for AI read_file tool
  - Block read_file for files matching .env*
  - Block read_file for files containing credential patterns
  - Allow read_file for source code, documentation
```

**Option B: Credential-source elimination**
```
Remove all filesystem-based credentials
  - No .env* files with production credentials
  - Environment variables injected at runtime only
  - Credentials retrieved from Vault dynamically
```

**Recommendation: Option B (more robust)**

**Step 3: Verify AI Isolation**
```bash
# Test AI credential access paths
1. AI attempts to read .env files → Should fail (no credentials present)
2. AI attempts environment variable read → Should fail (no credentials in env)
3. AI attempts Vault client usage → Should fail (no Vault credentials in AI context)
4. AI attempts service identity → Should fail (no service binding)
```

**Step 4: Application Guard Verification**
```typescript
// Verify E8.0.4 Application Guard remains active
// File: src/platform/deployment/boundary/ai-guard.ts
// Should still block AI from deployment execution

const isAI = process.env.KIRO_AGENT === 'true';
if (isAI && attemptingDeployment) {
  throw new Error('AI cannot execute deployments');
}
```

**Critical distinction:**
```
Layer 1 (App Guard): Blocks deployment execution ✅
  - Still required
  - NOT sufficient alone

Layer 2 (Credential Isolation): Blocks credential access ⏳
  - Required in addition to Layer 1
  - Design target for this area
```

**Verification criteria:**
- ✅ AI cannot read credentials from filesystem
- ✅ AI cannot retrieve credentials from environment
- ✅ AI cannot access Vault
- ✅ Application Guard still active
- ✅ AI can still perform safe development operations

---

### Area 3: CI Credential Boundary (C5)

**Current truth:**
```
⚠️ CI references production DB secret (authority incomplete)
  Workflows: deploy-production.yml, ci-tests.yml
  Secrets: PRODUCTION_SUPABASE_DB_URL, SUPABASE_DB_URL
  Authority: NOT MAPPED
```

**Design target:**
```
Only explicitly authorized deployment workflow may access production DDL
  ✓ CI test workflows → Test DB only
  ✓ Deployment workflow → Vault → Production (authorized path)
  ✗ General CI workflows → Production DB
```

**Remediation steps (DESIGN):**

**Step 1: CI Credential Authority Verification**
```
Evidence required:
  1. Inspect GitHub secret values (requires repository admin)
  2. Map secret → connection string → username → role
  3. Determine effective authority (DDL? DML? READ?)
  
Evidence gate: Cannot proceed without authority verification
```

**Step 2: CI Workflow Classification**
```yaml
# Classify workflows by credential need
Test/Lint workflows:
  - ci-tests.yml (unit/integration tests)
  - quality-security.yml
  - Credential need: Test DB only OR read-only production

Deployment workflows:
  - deploy-production.yml
  - Credential need: Production DDL (via Vault)

Build workflows:
  - No database access needed
```

**Step 3: Secret Segregation Design**

**Option A: Separate secrets by workflow**
```yaml
# Test workflows
env:
  TEST_DATABASE_URL: ${{ secrets.TEST_DATABASE_URL }}
  # OR
  PRODUCTION_DATABASE_URL_READ_ONLY: ${{ secrets.PRODUCTION_DATABASE_URL_READ_ONLY }}

# Deployment workflow ONLY
env:
  VAULT_TOKEN: ${{ secrets.VAULT_TOKEN }}
  # Retrieves production DDL from Vault at runtime
```

**Option B: Environment-based secret access**
```yaml
# GitHub Environments with approval
environments:
  production:
    protection_rules:
      - required_reviewers: 1
    secrets:
      VAULT_TOKEN: <vault_access_token>
```

**Recommendation: Option B (stronger isolation + approval gate)**

**Step 4: Vault Integration Design**
```yaml
# deploy-production.yml
jobs:
  deploy:
    environment: production # Requires approval
    steps:
      - name: Retrieve production credential from Vault
        env:
          VAULT_TOKEN: ${{ secrets.VAULT_TOKEN }}
        run: |
          # Design: Vault retrieval script
          vault login -method=github -token=$VAULT_TOKEN
          export PRODUCTION_DB_URL=$(vault kv get -field=connection_string secret/bella/production/database)
          # Use credential for deployment only
          # Credential NOT exposed to logs or artifacts
```

**Verification criteria:**
- ✅ Test workflows have NO production DDL access
- ✅ Deployment workflow retrieves from Vault with approval
- ✅ Production secrets removed from GitHub Actions secrets
- ✅ Vault token has limited scope (production secret read only)
- ✅ Deployment requires approval before accessing credentials

---

### Area 4: Vault Infrastructure (C7, C8, C9)

**Current truth:**
```
⚠️ Vault deployment status: UNKNOWN
⚠️ Vault ACL enforcement: UNKNOWN
⚠️ Vault audit trail: UNKNOWN
```

**Design target:**
```
Vault holds production DDL secret
  ✓ Secret stored in Vault
  ✓ ACL enforced (Deployment Service only)
  ✓ Audit trail enabled
  ✓ Credential rotation capability
```

**Conditional remediation approach:**

### Branch A: IF Vault EXISTS

**Evidence required:**
```bash
# Verify Vault deployment from authorized environment
vault status
curl https://vault.production.internal/v1/sys/health

# Expected: Vault is initialized and unsealed
```

**Integration steps:**
1. Verify Vault accessibility
2. Create secret path: `secret/bella/production/database_ddl`
3. Store production credential in Vault
4. Configure ACL policy
5. Enable audit backend
6. Test retrieval from Deployment Service

### Branch B: IF Vault NOT EXISTS

**Deployment steps:**
1. Deploy Vault infrastructure
   - Cloud: AWS Secrets Manager / GCP Secret Manager / Azure Key Vault
   - Self-hosted: HashiCorp Vault on Kubernetes/VM
2. Initialize Vault
3. Configure authentication (service identity, GitHub OIDC, etc.)
4. Create secret path
5. Store production credential
6. Configure ACL
7. Enable audit
8. Test retrieval

### Branch C: Evidence Gate (RECOMMENDED if UNKNOWN)

**Before proceeding:**
```
Step 1: Determine Vault deployment status
  Method: Request production infrastructure access
  OR: Review infrastructure documentation
  OR: Contact platform team

Step 2: Based on evidence
  IF EXISTS → Follow Branch A
  IF NOT EXISTS → Follow Branch B
  IF STILL UNKNOWN → Block remediation pending evidence
```

**Design components (applicable to both branches):**

**Vault Secret Structure:**
```
secret/bella/
  ├── production/
  │   ├── database_ddl (superuser connection string)
  │   └── metadata (secret version, rotation date, owner)
  ├── staging/
  │   └── database_ddl
  └── development/
      └── database_ddl (test DB)
```

**Vault ACL Policy:**
```hcl
# bella-deployment-policy
path "secret/bella/production/database_ddl" {
  capabilities = ["read"]
}

# Only Deployment Service identity can assume this policy
# Developer identities: DENIED
# AI identities: DENIED
# General CI identities: DENIED
```

**Vault Audit Configuration:**
```hcl
# Enable audit logging
audit "file" {
  type = "file"
  path = "/var/log/vault/audit.log"
  
  # OR cloud audit
  # type = "cloudwatch"
  # region = "us-east-1"
}

# Log all secret access
# Includes: who, when, which secret, from where
```

**Verification criteria:**
- ✅ Vault accessible from authorized environment
- ✅ Production secret stored in Vault
- ✅ ACL policy blocks unauthorized access
- ✅ Deployment Service can retrieve secret
- ✅ Developer cannot retrieve secret
- ✅ Audit log captures all access attempts

---

### Area 5: Infrastructure Boundary (C12)

**Current truth:**
```
🔴 Infrastructure boundary: UNPROVEN
  Layer 1 (App Guard): ✅ Verified (E8.0.4)
  Layer 2 (Credential): 🔴 Gaps confirmed
  Layer 3 (Infrastructure): ⚠️ Unverified
```

**Design target:**
```
End-to-end infrastructure boundary proven
  ✓ Network policies enforce access restrictions
  ✓ Service identity required for production access
  ✓ Audit trail captures all access
  ✓ Deployment Service is ONLY path to production DDL
```

**Remediation steps (DESIGN):**

**Step 1: Network Boundary Design**

**Production database access rules:**
```
ALLOW:
  - Deployment Service identity (specific IP/identity)
  - Read-only endpoint (for developer SELECT queries)

DENY:
  - Developer workstation IPs (direct DDL access)
  - General CI runner IPs
  - AI runtime (if separate infrastructure)
```

**Vault access rules:**
```
ALLOW:
  - Deployment Service identity

DENY:
  - All other identities
```

**Step 2: Service Identity Design**

**Deployment Service identity:**
```
Platform: Kubernetes / Cloud Run / ECS / VM
Identity: Service Account / IAM Role / Workload Identity

Example (Kubernetes):
  ServiceAccount: bella-deployment-service
  Namespace: bella-platform
  Bound to: Deployment pods only

Example (AWS):
  IAM Role: bella-deployment-service-role
  Bound to: ECS task definition
  Policies: Secrets Manager read (production secret only)
```

**Step 3: Audit Trail Design**

**Components:**
```
1. Vault audit log
   - Who accessed production secret
   - When
   - From where

2. Database audit log
   - Which role executed DDL
   - Which statements
   - Timestamp

3. Deployment provenance (E8.0.4)
   - Who initiated deployment
   - Which migration
   - Approval chain
```

**Step 4: End-to-End Verification**

**Test scenario:**
```
1. Developer attempts direct production DDL
   → BLOCKED (no credential, network policy)

2. AI attempts credential retrieval
   → BLOCKED (no filesystem credentials, no Vault access)

3. Unauthorized CI workflow attempts production access
   → BLOCKED (no Vault token, environment protection)

4. Deployment Service retrieves credential
   → ALLOWED (service identity, Vault ACL, network policy)
   → AUDITED (Vault log, database log, provenance record)
```

**Verification criteria:**
- ✅ Network policies enforced (tested)
- ✅ Service identity required (tested)
- ✅ Unauthorized access blocked (tested)
- ✅ Authorized access allowed and audited (tested)
- ✅ All 3 layers verified (App + Credential + Infrastructure)

---

## 4. Architect Review Questions

**MUST answer before execution approval:**

### Q1: Credential Ownership

**Question:** Who is the ONLY authority allowed to retrieve production DDL credential?

**Answer required:**
- Identity type (service account, IAM role, workload identity)
- Authentication method (GitHub OIDC, Kubernetes SA, IAM role assumption)
- Scope limitation (production secret read only, no other permissions)

**Evidence:** Vault ACL policy, service identity configuration

---

### Q2: Developer Boundary

**Question:** After remediation, does developer have ANY credential that can directly reach production DB with DDL capability?

**Answer required:**
- Enumerate all developer-accessible credentials
- Verify each credential authority (read-only, test DB, no production DDL)
- Confirm no alternate paths (backup files, sync tools, CI artifacts)

**Evidence:** Developer workstation audit, credential authority verification

---

### Q3: AI Boundary (EXPANDED)

**Question:** After remediation, does AI have ANY path to retrieve production credentials via:
- Filesystem (`.env*` files)?
- Environment variables?
- Tool binding to credential services?
- CI artifacts?
- Vault client access?
- Service identity impersonation?

**Answer required:**
- Enumerate all AI-accessible paths
- Verify each path blocked
- Confirm no credential leakage through alternate channels

**Evidence:** AI tool access audit, environment isolation verification, service binding review

---

### Q4: CI Boundary

**Question:** Which workflows ACTUALLY need production credentials?

**Answer required:**
- List workflows requiring production access (specific names)
- Justify need for each workflow
- Confirm all other workflows use test DB or read-only

**Evidence:** Workflow classification, secret mapping, approval requirements

---

### Q5: Infrastructure Boundary

**Question:** What evidence proves Vault + Deployment Service + network boundary exist and enforce policy?

**Answer required:**
- Vault deployment verification (health check, accessibility)
- Service identity configuration (documented, tested)
- Network policy enforcement (firewall rules, security groups)
- Audit trail validation (logs exist, capture access)

**Evidence:** Infrastructure audit, policy verification, test results

---

### Q6: Revocation

**Question:** After migration, how are old credentials revoked/rotated? How is verification performed?

**Answer required:**
- Revocation procedure (who can revoke, how)
- Rotation schedule (frequency, automation)
- Verification method (test old credential fails, new credential works)
- Rollback plan (if revocation causes issues)

**Evidence:** Credential lifecycle documentation, test results

**IF CANNOT ANSWER ANY QUESTION → DO NOT EXECUTE REMEDIATION**

---

## 5. Execution Sequence (BLOCKED until Architect Review)

**⚠️ This section is DESIGN ONLY. NO execution without approval.**

### Phase 1: Evidence Gathering
1. Verify Vault deployment status
2. Verify current credential authority (metadata query)
3. Map CI secret → authority chain
4. Document infrastructure topology

### Phase 2: Preparation
1. Create read-only production credential (if not exists)
2. Test read-only credential (SELECT works, DDL fails)
3. Deploy Vault (if not exists) OR verify existing Vault
4. Configure Vault ACL policy
5. Enable Vault audit logging

### Phase 3: Credential Migration
1. Store production DDL credential in Vault
2. Update Deployment Service to retrieve from Vault
3. Test Deployment Service credential retrieval
4. Verify Vault ACL blocks unauthorized access

### Phase 4: Developer Remediation
1. Remove production DDL credentials from developer workstation
2. Provide read-only credentials to developers
3. Verify developers can query production (read-only)
4. Verify developers cannot execute DDL

### Phase 5: CI Remediation
1. Remove production DDL secrets from GitHub Actions
2. Add Vault token to deployment workflow (environment-protected)
3. Update deployment workflow to retrieve from Vault
4. Test deployment workflow with Vault integration

### Phase 6: Network Boundary
1. Implement network policies (if not exists)
2. Restrict production DB access to Deployment Service identity
3. Test unauthorized access blocked
4. Test authorized access works

### Phase 7: Verification
1. Re-run P0.2 inventory (all sections)
2. Verify C3, C4, C10 gaps closed
3. Verify C7, C8, C9 now PASS
4. Verify C12 infrastructure boundary proven
5. Document evidence for G12 qualification

---

## 6. Verification Plan

### After Each Phase

**Verification criteria:**
- ✅ Expected state achieved
- ✅ No regressions introduced
- ✅ Rollback plan tested (if applicable)
- ✅ Evidence documented

### Final Verification

**C1-C12 re-assessment:**
- C1: Inventory complete ✅
- C2: Authority metadata-confirmed ✅
- C3: Developer DDL removed ✅
- C4: AI isolation verified ✅
- C5: CI authority mapped + restricted ✅
- C6: Read-only boundary proven ✅
- C7: Vault verified ✅
- C8: Vault ACL verified ✅
- C9: Vault audit enabled ✅
- C10: Filesystem credentials removed ✅
- C11: App Guard verified ✅
- C12: Infrastructure boundary proven ✅

**G12 qualification:**
- Layer 1 (App Guard): ✅ VERIFIED
- Layer 2 (Credential): ✅ ISOLATED
- Layer 3 (Infrastructure): ✅ ENFORCED

**G12 status:** 🟢 PASS (if all criteria met)

---

## 7. Risk Mitigation

### Rollback Plan

**If remediation causes issues:**
1. Restore credentials from backup (temporary measure)
2. Identify root cause
3. Fix issue
4. Re-attempt remediation
5. Verify fix

**Rollback triggers:**
- Deployment fails to access database
- Developer workflow blocked unexpectedly
- Production access unavailable

### Monitoring

**During remediation:**
- Monitor deployment success rate
- Monitor database connection errors
- Monitor developer support requests
- Monitor Vault access logs

**After remediation:**
- Continue monitoring for 2 weeks
- Review audit logs for anomalies
- Verify no credential-related incidents

---

## 8. Success Criteria

**Remediation considered successful when:**

1. ✅ No production DDL credentials on developer workstation
2. ✅ AI cannot retrieve credentials via any path
3. ✅ Only authorized deployment workflow accesses production DDL
4. ✅ Vault holds production secret with ACL enforced
5. ✅ Network boundary prevents unauthorized access
6. ✅ All access audited
7. ✅ Developers can still query production (read-only)
8. ✅ Deployment workflow functions correctly
9. ✅ P0.2 re-audit shows all gaps closed
10. ✅ G12 can be qualified as PASS

---

## 9. Dependencies

**Before execution can proceed:**

- ⏸ Architect Review COMPLETE
- ⏸ All 6 review questions answered
- ⏸ Execution approval granted
- ⏸ Rollback plan approved
- ⏸ Infrastructure access secured (if needed for Vault verification)

**Blocked by:**
- P0.3 is NOT blocked by this (P0.2 and P0.3 can proceed in parallel after design approval)
- E8.1 IS blocked until P0.2 + P0.3 complete

---

## 10. Status

**Remediation Design:** ✅ COMPLETE  
**Architect Review:** ⏸ PENDING  
**Execution Approval:** ⏸ BLOCKED  
**Execution:** 🔒 LOCKED (until approval)

**Next:** Architect Review of this design document

**Do NOT proceed to execution without explicit approval. ✅**
