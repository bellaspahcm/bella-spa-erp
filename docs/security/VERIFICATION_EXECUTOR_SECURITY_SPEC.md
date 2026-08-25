# Verification Executor Security Specification

**Version:** 1.0  
**Date:** 2026-08-25  
**Related:** ADR-001, Phase 4B.3 DirectPostgreSQLAdapter  
**Status:** 🔴 PROVISIONING REQUIRED  

---

## 🎯 PURPOSE

This document specifies the **exact security boundary** for the `verification_executor` database role used by Phase 4B.3 verification engine.

**Critical Principle:**

> verification_executor must have **minimum privilege** to perform Contract v1.0.0 verification checks 4.1-4.4, and **NOTHING MORE**.

---

## 🔐 SECURITY INVARIANTS

### Role Attributes (MANDATORY)

```sql
verification_executor:
  LOGIN:        YES   -- Must authenticate
  SUPERUSER:    NO    -- NEVER superuser
  BYPASSRLS:    NO    -- MUST respect RLS policies
  CREATEROLE:   NO    -- Cannot create roles
  CREATEDB:     NO    -- Cannot create databases
  REPLICATION:  NO    -- Not a replication user
  INHERIT:      YES   -- Standard inheritance (no special roles)
```

**Verification:**
```sql
SELECT 
  rolname,
  rolsuper,      -- MUST be FALSE
  rolbypassrls,  -- MUST be FALSE
  rolcreaterole, -- MUST be FALSE
  rolcreatedb,   -- MUST be FALSE
  rolreplication,-- MUST be FALSE
  rolinherit,
  rolcanlogin    -- MUST be TRUE
FROM pg_roles
WHERE rolname = 'verification_executor';
```

**Expected Result:**
```
 rolname               | rolsuper | rolbypassrls | rolcreaterole | rolcreatedb | rolreplication | rolinherit | rolcanlogin
-----------------------+----------+--------------+---------------+-------------+----------------+------------+-------------
 verification_executor | f        | f            | f             | f           | f              | t          | t
```

---

## 📋 MINIMUM PRIVILEGE SPECIFICATION

### 1. Application Schema Access

**Requirement:** Read-only introspection of `public` schema

```sql
-- GRANT schema usage
GRANT USAGE ON SCHEMA public TO verification_executor;

-- DENY schema modification
REVOKE CREATE ON SCHEMA public FROM verification_executor;
```

**Verification:**
```sql
SELECT has_schema_privilege('verification_executor', 'public', 'USAGE') as usage,
       has_schema_privilege('verification_executor', 'public', 'CREATE') as create;
-- Expected: usage = true, create = false
```

---

### 2. Application Tables (Read-Only)

**Requirement:** SELECT on application tables for verification checks

**Queries Needed (from Contract 4.1-4.4):**
- Table existence check
- Column metadata
- Constraint metadata  
- RLS status
- RLS policies

**GRANT:**
```sql
-- Grant SELECT on ALL current tables in public schema
GRANT SELECT ON ALL TABLES IN SCHEMA public TO verification_executor;

-- Grant SELECT on future tables (if needed)
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON TABLES TO verification_executor;

-- EXPLICITLY DENY write operations
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON ALL TABLES IN SCHEMA public FROM verification_executor;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLES FROM verification_executor;
```

**Verification (sample table):**
```sql
SELECT 
  has_table_privilege('verification_executor', 'public.runtime_tenant_registry', 'SELECT') as can_select,
  has_table_privilege('verification_executor', 'public.runtime_tenant_registry', 'INSERT') as can_insert,
  has_table_privilege('verification_executor', 'public.runtime_tenant_registry', 'UPDATE') as can_update,
  has_table_privilege('verification_executor', 'public.runtime_tenant_registry', 'DELETE') as can_delete;
-- Expected: SELECT=true, INSERT/UPDATE/DELETE=false
```

---

### 3. PostgreSQL System Catalogs (Introspection)

**Requirement:** Read-only access to specific system catalogs for schema introspection

**Catalogs Needed:**

#### 3.1 pg_tables (Table List)
```sql
-- Query: SELECT tablename FROM pg_tables WHERE schemaname = 'public'
-- Built-in view, SELECT granted by default to PUBLIC
-- No explicit GRANT needed
```

#### 3.2 pg_class (Table Metadata & RLS Status)
```sql
-- Query: SELECT relrowsecurity FROM pg_class WHERE oid = 'public.table_name'::regclass
-- System catalog, SELECT granted by default to PUBLIC
-- No explicit GRANT needed
```

#### 3.3 pg_attribute (Column Attributes)
```sql
-- Query: SELECT attname FROM pg_attribute JOIN pg_index...
-- System catalog, SELECT granted by default to PUBLIC
-- No explicit GRANT needed
```

#### 3.4 pg_index (Primary Key)
```sql
-- Query: SELECT ... FROM pg_index WHERE indrelid = ...
-- System catalog, SELECT granted by default to PUBLIC
-- No explicit GRANT needed
```

#### 3.5 pg_policy (RLS Policies)
```sql
-- Query: SELECT polname, polcmd, pg_get_expr(polqual, polrelid)...
-- System catalog, SELECT granted by default to PUBLIC
-- No explicit GRANT needed
```

#### 3.6 information_schema Views

**Required Views:**
- `information_schema.tables`
- `information_schema.columns`
- `information_schema.table_constraints`
- `information_schema.key_column_usage`
- `information_schema.constraint_column_usage`

```sql
-- These are SQL standard views built on pg_catalog
-- SELECT is granted by default to PUBLIC
-- No explicit GRANT needed

-- BUT: Verify access is NOT revoked
SELECT has_table_privilege('verification_executor', 'information_schema.tables', 'SELECT');
-- Expected: true
```

**IMPORTANT:** Do NOT grant blanket access to ALL information_schema or pg_catalog tables. Default PUBLIC grants are sufficient for verification needs.

---

### 4. Evidence Table (Append-Only)

**Requirement:** INSERT-only access to `verification_evidence` table

```sql
-- Create evidence table (if not exists)
CREATE TABLE IF NOT EXISTS verification_evidence (
  id BIGSERIAL PRIMARY KEY,
  verification_id UUID NOT NULL,
  migration_id TEXT NOT NULL,
  commit_sha TEXT NOT NULL,
  environment TEXT NOT NULL,
  overall_result TEXT NOT NULL,
  deployment_eligible BOOLEAN NOT NULL,
  evidence_json JSONB NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Grant INSERT-only (append-only)
GRANT INSERT ON verification_evidence TO verification_executor;

-- Grant SELECT (to read own evidence)
GRANT SELECT ON verification_evidence TO verification_executor;

-- EXPLICITLY DENY modification
REVOKE UPDATE, DELETE, TRUNCATE ON verification_evidence FROM verification_executor;

-- Grant USAGE on sequence (for BIGSERIAL)
GRANT USAGE ON SEQUENCE verification_evidence_id_seq TO verification_executor;

-- DENY ALTER on sequence
-- (Implicit: only owner can ALTER SEQUENCE)
```

**Verification:**
```sql
SELECT 
  has_table_privilege('verification_executor', 'verification_evidence', 'SELECT') as can_select,
  has_table_privilege('verification_executor', 'verification_evidence', 'INSERT') as can_insert,
  has_table_privilege('verification_executor', 'verification_evidence', 'UPDATE') as can_update,
  has_table_privilege('verification_executor', 'verification_evidence', 'DELETE') as can_delete;
-- Expected: SELECT=true, INSERT=true, UPDATE/DELETE=false
```

---

## 🛡️ SECURITY BOUNDARIES

### What verification_executor CAN Do

✅ **Read application table data** (respecting RLS policies)  
✅ **Query PostgreSQL system catalogs** (pg_tables, pg_class, pg_policy, etc.)  
✅ **Query information_schema views** (tables, columns, constraints)  
✅ **Insert verification evidence** (append to verification_evidence table)  
✅ **Read verification evidence** (query verification_evidence table)  

### What verification_executor CANNOT Do

❌ **Modify application data** (INSERT/UPDATE/DELETE/TRUNCATE)  
❌ **Create/drop tables** (DDL operations)  
❌ **Create/drop schemas** (schema modification)  
❌ **Bypass RLS policies** (BYPASSRLS = false)  
❌ **Create roles or databases** (CREATEROLE/CREATEDB = false)  
❌ **Become superuser** (SUPERUSER = false)  
❌ **Modify verification evidence** (UPDATE/DELETE on verification_evidence)  
❌ **Execute migrations** (no DDL privileges)  

---

## 🔧 PROVISIONING PROCEDURE

### Step 1: Create Role (Database Administrator)

**Executor:** Database Administrator or Infrastructure Provisioning System

**Script:**
```sql
-- Create role with secure password
CREATE ROLE verification_executor WITH 
  LOGIN 
  PASSWORD 'GENERATE_SECURE_PASSWORD_HERE'  -- Use password generator
  NOSUPERUSER 
  NOCREATEDB 
  NOCREATEROLE 
  NOREPLICATION 
  INHERIT;

COMMENT ON ROLE verification_executor IS 'Phase 4B.3 Verification Engine - Read-only introspection + append-only evidence';
```

---

### Step 2: Grant Schema Privileges

```sql
-- Schema access
GRANT USAGE ON SCHEMA public TO verification_executor;
REVOKE CREATE ON SCHEMA public FROM verification_executor;
```

---

### Step 3: Grant Table Privileges

```sql
-- Read-only on application tables
GRANT SELECT ON ALL TABLES IN SCHEMA public TO verification_executor;

-- Apply to future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON TABLES TO verification_executor;

-- Explicitly deny writes
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON ALL TABLES IN SCHEMA public FROM verification_executor;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLES FROM verification_executor;
```

---

### Step 4: Create Evidence Table

```sql
-- Create evidence table
CREATE TABLE IF NOT EXISTS verification_evidence (
  id BIGSERIAL PRIMARY KEY,
  verification_id UUID NOT NULL UNIQUE,
  migration_id TEXT NOT NULL,
  commit_sha TEXT NOT NULL,
  approval_id TEXT,
  environment TEXT NOT NULL,
  overall_result TEXT NOT NULL CHECK (overall_result IN ('PASS', 'WARNING', 'FAIL', 'ERROR')),
  deployment_eligible BOOLEAN NOT NULL,
  evidence_json JSONB NOT NULL,
  execution_time_ms INTEGER,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_verification_evidence_migration ON verification_evidence(migration_id);
CREATE INDEX idx_verification_evidence_commit ON verification_evidence(commit_sha);
CREATE INDEX idx_verification_evidence_timestamp ON verification_evidence(timestamp DESC);

COMMENT ON TABLE verification_evidence IS 'Phase 4B.3 Verification Evidence - Immutable audit trail';
```

---

### Step 5: Grant Evidence Table Privileges

```sql
-- Append-only access
GRANT INSERT, SELECT ON verification_evidence TO verification_executor;
REVOKE UPDATE, DELETE, TRUNCATE ON verification_evidence FROM verification_executor;

-- Sequence usage
GRANT USAGE ON SEQUENCE verification_evidence_id_seq TO verification_executor;
```

---

### Step 6: Verify Configuration

**Run verification script:**
```bash
npx tsx scripts/security/verify-executor-role.ts
```

**Expected Output:**
```
🔐 Pre-Approval Security Verification

✅ CHECK 1: verification_executor role EXISTS
CHECK 2: rolsuper = FALSE ✅
CHECK 3: rolbypassrls = FALSE ✅
CHECK 4: rolcreaterole = FALSE ✅
CHECK 5: rolcreatedb = FALSE ✅
CHECK 6: Application table permissions...
  ✅ runtime_tenant_registry: Read-only
  ✅ healthcare_patients: Read-only
  ...
CHECK 7: verification_evidence permissions...
  SELECT: ✅
  INSERT: ✅
  UPDATE: ✅
  DELETE: ✅
CHECK 8: Schema CREATE privilege...
  CREATE on public schema: ✅

============================================================
✅ ALL SECURITY CHECKS PASSED

verification_executor role is properly configured as:
  - Read-only on application tables
  - Append-only on evidence table
  - No superuser or RLS bypass
  - No schema modification privileges
```

---

## 🔑 CREDENTIAL MANAGEMENT

### Connection String Format

```bash
DATABASE_EXECUTOR_URL=postgresql://verification_executor:PASSWORD@HOST:5432/DATABASE?sslmode=require
```

**For Supabase:**
```bash
DATABASE_EXECUTOR_URL=postgresql://verification_executor:PASSWORD@db.xxx.supabase.co:5432/postgres?sslmode=require
```

**For Self-Hosted:**
```bash
DATABASE_EXECUTOR_URL=postgresql://verification_executor:PASSWORD@10.0.1.5:5432/bella_production?sslmode=require
```

### Storage

**GitHub Actions (CI/CD):**
```bash
gh secret set DATABASE_EXECUTOR_URL --body "postgresql://verification_executor:...?sslmode=require"
```

**Local Development (.env.local):**
```bash
# .env.local (DO NOT COMMIT)
DATABASE_EXECUTOR_URL=postgresql://verification_executor:...?sslmode=require
```

**Security Requirements:**
- ✅ TLS/SSL REQUIRED (`sslmode=require`)
- ✅ Never logged or exposed in artifacts
- ✅ Stored in secure secret manager (GitHub Secrets / Vault)
- ✅ Rotated every 90 days

---

## 🔄 CREDENTIAL ROTATION PROCEDURE

### Rotation Schedule

**Frequency:** Every 90 days  
**Owner:** Database Administrator  
**Notification:** 7 days before expiration  

### Rotation Steps

**1. Generate new password:**
```bash
NEW_PASSWORD=$(openssl rand -base64 32)
```

**2. Update database role:**
```sql
ALTER ROLE verification_executor WITH PASSWORD 'NEW_PASSWORD';
```

**3. Update GitHub Secrets:**
```bash
gh secret set DATABASE_EXECUTOR_URL --body "postgresql://verification_executor:NEW_PASSWORD@...?sslmode=require"
```

**4. Update local .env.local (if applicable):**
```bash
# Update .env.local with new password
```

**5. Verify connection:**
```bash
npx tsx scripts/security/verify-executor-role.ts
```

**6. Document rotation:**
```
Date: YYYY-MM-DD
Rotated by: [Name]
Next rotation: YYYY-MM-DD (90 days)
```

---

## ✅ APPROVAL GATE CRITERIA

### Security Gate Status

```
Provisioning Gate Checklist:
├─ [ ] verification_executor role created by DB admin
├─ [ ] Role attributes verified (SUPERUSER=false, BYPASSRLS=false, etc.)
├─ [ ] Application table privileges: SELECT-only
├─ [ ] Evidence table privileges: INSERT+SELECT only (no UPDATE/DELETE)
├─ [ ] Schema privileges: USAGE only (no CREATE)
├─ [ ] System catalog access: Default PUBLIC grants sufficient
├─ [ ] TLS enforced (sslmode=require)
├─ [ ] Connection string stored in GitHub Secrets
├─ [ ] Rotation procedure documented (90-day cycle)
└─ [ ] verify-executor-role.ts script passes all checks

Status: 🔴 BLOCKED (role not provisioned)

Next Action: Database Administrator provisions role using this specification
```

### After Provisioning

**When all checks PASS:**

```
🔴 BLOCKED → 🟢 APPROVED FOR IMPLEMENTATION

Gate unlocked:
- DirectPostgreSQLAdapter implementation may proceed (Phase 1)
- T1-T7 validation can begin
- Certificate eligibility assessment enabled
```

---

## 📚 REFERENCES

- Contract v1.0.0: `docs/architecture/P0_3_PHASE4B_3_CONTRACT.md` (commit 37ae4544)
- ADR-001: `docs/architecture/ADR_001_ADAPTER_DEVIATION.md`
- Direct Adapter Proposal: `docs/architecture/PHASE4B3_DIRECT_ADAPTER_PROPOSAL.md`
- Verification Script: `scripts/security/verify-executor-role.ts`

---

## 🚨 SECURITY CONTACT

**For security-related questions or provisioning:**
- Database Administrator: [Contact]
- Security Team: [Contact]
- Phase 4B.3 Owner: [Contact]

**DO NOT:**
- Use superuser credentials for verification
- Share `verification_executor` password outside secure channels
- Disable security checks to "make tests pass"
- Grant privileges beyond this specification

---

**Document Status:** 🔴 AWAITING DB ADMIN PROVISIONING

**Next Update:** After role provisioning complete and verification script passes
