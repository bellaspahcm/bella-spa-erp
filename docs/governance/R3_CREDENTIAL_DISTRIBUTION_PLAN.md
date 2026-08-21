# R3 CREDENTIAL DISTRIBUTION PLAN

**Phase:** R3 Remediation (Database Role Separation)  
**Date:** 2026-08-20  
**Status:** PENDING EXECUTION

---

## 🎯 OBJECTIVE

Close 3 canonical mutation authorities identified by R1 through **infrastructure-level credential/role separation**.

**NOT:** Delete scripts or patch individual files  
**IS:** Establish role boundaries that make mutation impossible for developer credentials

---

## 🔐 ROLE ARCHITECTURE

```
┌─────────────────────────────────────────────────────────────────┐
│                      DATABASE ROLES                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  bella_developer (NON-MUTATING ROLE)                           │
│    ├─ Privileges: SELECT only                                  │
│    ├─ Purpose: Daily developer work (queries, debugging)       │
│    ├─ Credential: DATABASE_URL (developer .env)                │
│    └─ Mutation Capability: ❌ NONE                             │
│                                                                 │
│  bella_migration_executor (AUTHORIZED MUTATION ROLE)           │
│    ├─ Privileges: FULL DML + DDL                              │
│    ├─ Purpose: Execute approved migrations via BDGF            │
│    ├─ Credential: DATABASE_EXECUTOR_URL (BDGF only)           │
│    ├─ Requires: Valid Human GO approval (R2)                  │
│    └─ Mutation Capability: ✅ FULL (with approval)            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📋 CREDENTIAL MAPPING

### Current State (BEFORE R3)

| Credential | Used By | Current Role | Mutation Capability |
|------------|---------|--------------|---------------------|
| `DATABASE_URL` | Developer, BDGF, Scripts | `postgres` | ✅ FULL (bypass) |
| Supabase CLI | Developer | `postgres` (via project link) | ✅ FULL (bypass) |
| `SERVICE_ROLE_KEY` | API, Scripts | Service role | ✅ FULL (bypass) |

**Problem:** Developer has ALL 3 mutation authorities

### Target State (AFTER R3)

| Credential | Used By | New Role | Mutation Capability |
|------------|---------|----------|---------------------|
| `DATABASE_URL` | Developer | `bella_developer` | ❌ READ-ONLY |
| `DATABASE_EXECUTOR_URL` | BDGF only | `bella_migration_executor` | ✅ FULL (with R2 approval) |
| Supabase CLI | Developer | Restricted to dev project | ❌ NO PROD ACCESS |
| `SERVICE_ROLE_KEY` | API | (unchanged, but exec_sql gated) | ⚠️ GATED (see Authority #3) |

---

## 🚀 DEPLOYMENT SEQUENCE

### STEP 1: Apply Migration (CREATE ROLES)

```bash
# Apply migration to create bella_developer and bella_migration_executor roles
npx supabase db push
```

**What this does:**
- Creates `bella_developer` role with SELECT-only privileges
- Creates `bella_migration_executor` role with FULL DML+DDL privileges
- Sets default privileges for future tables
- Creates `role_usage_audit` table for monitoring

**What this does NOT do:**
- Does NOT change existing DATABASE_URL credential
- Does NOT revoke privileges from `postgres` role (yet)
- Does NOT break current developer/BDGF workflows

### STEP 2: Create Passwords for New Roles

```sql
-- Execute via Supabase dashboard or psql with admin credentials
ALTER ROLE bella_developer WITH PASSWORD '<strong-random-password-1>';
ALTER ROLE bella_migration_executor WITH PASSWORD '<strong-random-password-2>';
```

**Security Requirements:**
- Use cryptographically random passwords (min 32 characters)
- Store in secure secret management (1Password, AWS Secrets Manager, etc.)
- NEVER commit passwords to git
- Rotate passwords quarterly

### STEP 3: Update Developer Credentials

**File:** `.env` (developer local environment)

```bash
# BEFORE R3
DATABASE_URL=postgresql://postgres:<password>@<host>:<port>/postgres

# AFTER R3
DATABASE_URL=postgresql://bella_developer:<new-password>@<host>:<port>/postgres
```

**Distribution Method:**
- Share via secure channel (1Password, direct transfer)
- Each developer updates their local `.env`
- Test immediately: Developer should be able to SELECT but NOT INSERT/UPDATE/DELETE

### STEP 4: Update BDGF Executor Credentials

**File:** `.env` (BDGF executor environment - CI/CD or admin machine only)

```bash
# NEW CREDENTIAL (add this)
DATABASE_EXECUTOR_URL=postgresql://bella_migration_executor:<executor-password>@<host>:<port>/postgres

# KEEP EXISTING (for R2 approval checks - read-only usage)
DATABASE_URL=postgresql://bella_developer:<dev-password>@<host>:<port>/postgres
```

**Update BDGF Executor Script:**
- Modify `scripts/bdgf/execute-migration.mjs` to use `DATABASE_EXECUTOR_URL` for mutation operations
- Use `DATABASE_URL` only for pre-flight checks (verify_approval, etc.)

### STEP 5: Restrict Supabase CLI Access (Authority #2)

**Option A:** Separate Supabase Projects
- Create separate `bella-dev` and `bella-prod` Supabase projects
- Developer links only to `bella-dev` project
- Production deployments use `bella-prod` project (restricted access)

**Option B:** Team Role Restrictions (if using Supabase Teams)
- Set developer team role to "Read-only" on production project
- Only CI/CD service account has "Admin" role

**Implementation:**
```bash
# Developer machine: link to dev project only
npx supabase link --project-ref <dev-project-ref>

# CI/CD: link to prod project
npx supabase link --project-ref <prod-project-ref>
```

### STEP 6: Gate SERVICE_ROLE_KEY exec_sql (Authority #3)

**Option A:** Remove exec_sql Endpoint Usage
- Audit all uses of `/rest/v1/rpc/exec_sql` or similar
- Replace with stored procedures or proper API endpoints
- Deprecate direct SQL execution via API

**Option B:** Add RLS Policy to exec_sql Function
```sql
-- Example: Only allow exec_sql from trusted IPs or with additional auth
CREATE POLICY exec_sql_restriction ON ... 
  USING (auth.jwt()->>'role' = 'service_admin');
```

**Option C:** Rotate SERVICE_ROLE_KEY to Developer-Safe Key
- Create new `SERVICE_ROLE_KEY_LIMITED` with exec_sql privileges revoked
- Distribute to developers
- Keep full `SERVICE_ROLE_KEY` only in CI/CD

**Recommended:** Option A (remove exec_sql usage) + Option C (rotate keys)

---

## ✅ VERIFICATION CHECKLIST

After deployment, verify each authority is closed:

### Authority #1: DATABASE_URL → ❌ BLOCKED

```bash
# Test with developer credentials
psql $DATABASE_URL -c "INSERT INTO tenants (name) VALUES ('test-bypass');"
# Expected: ERROR: permission denied for table tenants
```

### Authority #2: Supabase CLI → ❌ BLOCKED

```bash
# Test with developer Supabase link
npx supabase db push
# Expected: Permission denied or "Not linked to production project"
```

### Authority #3: SERVICE_ROLE_KEY → ❌ BLOCKED

```bash
# Test exec_sql with developer's SERVICE_ROLE_KEY
curl -X POST https://<project>.supabase.co/rest/v1/rpc/exec_sql \
  -H "apikey: $SERVICE_ROLE_KEY" \
  -d '{"query": "INSERT INTO tenants (name) VALUES (\"bypass\");"}'
# Expected: 403 Forbidden or function not found
```

### Controlled Path: BDGF + Human GO → ✅ ALLOWED

```bash
# Test BDGF with valid Human GO approval
node scripts/bdgf/record-human-go-approval.mjs <migration-id> production
node scripts/bdgf/execute-migration.mjs <migration-id> production
# Expected: SUCCESS (uses bella_migration_executor credentials)
```

---

## 🔒 SECURITY CONSIDERATIONS

### Credential Storage

**Developer Credentials (`bella_developer`):**
- Local `.env` file (git-ignored)
- Personal password manager
- Can be shared within team (read-only risk is low)

**Executor Credentials (`bella_migration_executor`):**
- CI/CD secret management (GitHub Secrets, AWS Secrets Manager, etc.)
- Access restricted to DevOps/Platform team
- NEVER shared with general developers
- Rotation: Quarterly or after team member departure

### Break-Glass Scenario

**Q:** What if BDGF fails and we need emergency production access?

**A:** Keep `postgres` role credentials in emergency break-glass procedure:
1. Stored in separate secure vault (only accessible to CTO/Lead Architect)
2. Usage triggers incident report
3. Must be followed by post-incident review and approval retroactively

**Emergency Access Process:**
1. Incident declared in #incidents channel
2. CTO retrieves `postgres` credentials from vault
3. Execute emergency fix
4. Log all queries executed
5. Post-incident: Create retroactive Human GO approval
6. Document in `migration_governance.approvals` with type = 'EMERGENCY'

### Audit Trail

All role usage is logged to `migration_governance.role_usage_audit`:
- Monitor for unauthorized mutation attempts
- Alert on bella_developer attempting INSERT/UPDATE/DELETE
- Weekly review of bella_migration_executor usage against approved migrations

---

## 📊 ROLLBACK PLAN

If R3 deployment causes issues:

### Immediate Rollback (< 24 hours)

```bash
# Restore developer mutation capability
ALTER ROLE bella_developer WITH CREATEDB;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO bella_developer;
```

### Full Rollback (revert migration)

```sql
-- Drop roles and revert privileges
DROP ROLE IF EXISTS bella_developer;
DROP ROLE IF EXISTS bella_migration_executor;
DROP TABLE IF EXISTS migration_governance.role_usage_audit;
```

Then revert developer `.env` to original `DATABASE_URL`.

**Warning:** Rollback re-opens all 3 bypass authorities. Only use if R3 causes critical blocker.

---

## 🎯 SUCCESS CRITERIA (R3 PASS)

R3 is considered **COMPLETE** only when:

1. ✅ Migration applied and roles created
2. ✅ Passwords set for both roles
3. ✅ Developer credentials distributed (`bella_developer`)
4. ✅ Executor credentials distributed (`bella_migration_executor`)
5. ✅ Supabase CLI access restricted
6. ✅ SERVICE_ROLE_KEY usage gated or rotated
7. ✅ All 4 verification tests pass (see next document: `R3_VERIFICATION_TESTS.md`)

**Evidence Required:**
- Executable test results showing 3 authorities blocked
- Executable test showing governed path works
- Audit log showing no mutation attempts by bella_developer

---

## 📝 NOTES

- This plan assumes Supabase-hosted PostgreSQL
- For self-hosted, adjust credential distribution method
- Passwords must be rotated after any team member with executor access leaves
- Consider implementing automatic password rotation (90-day cycle)

---

**Next Document:** `scripts/bdgf/test-credential-enforcement.mjs` (R3 Verification Tests)
