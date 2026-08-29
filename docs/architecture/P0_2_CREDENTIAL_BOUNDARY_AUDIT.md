# P0.2: Credential Boundary Audit

**Date:** 2026-08-24  
**Status:** 🟡 IN PROGRESS  
**Prerequisite:** P0.2 for E8 Deployment Governance

---

## Objective

**NOT:** Test psql → permission denied

**YES:** Prove production DDL credential topology:
- Developer/AI CANNOT access production DDL
- Only Deployment Service can retrieve via Vault
- Infrastructure-enforced boundary (not policy-only)

---

## G12 Verification Requirements

### Layer 1: Application Guard ✅
**Status:** IMPLEMENTED (E8.0.4)

```typescript
if (actor.type === 'AI_AGENT') {
  throw new Error('AI DEPLOYMENT BLOCKED');
}
```

**Evidence:** Code exists, tests pass

---

### Layer 2: Credential Isolation ⏳
**Status:** TO BE PROVEN

**Must prove:**
- Production DDL credential NOT in developer environment
- Production DDL credential NOT in AI process environment
- Production DDL credential NOT in CI/CD (except deployment job)
- Production DDL credential ONLY in Vault

**Evidence needed:**
- Environment variable audit
- Vault access logs
- Credential inventory

---

### Layer 3: Infrastructure Boundary ⏳
**Status:** TO BE PROVEN

**Must prove:**
- Developer CANNOT retrieve production DDL from Vault
- AI CANNOT retrieve production DDL from Vault
- Only Deployment Service can retrieve from Vault
- Network policies enforce boundary

**Evidence needed:**
- Vault ACL configuration
- Network policy configuration
- Access attempt logs (failed attempts)

---

## Audit Steps

### Step 1: Inventory All Credentials

**Locations to check:**
```
Local Development:
  - .env
  - .env.local
  - .env.production
  - ~/. supabase/
  - Local credential stores

Repository:
  - .env.example
  - .env.template
  - GitHub Secrets
  - CI/CD configuration

Infrastructure:
  - Supabase project member roles
  - Database roles
  - Vault secrets
  - Service account keys
```

**For each credential found:**
- What is it? (connection string, API key, service role key)
- What permissions? (READ / DDL / ADMIN)
- Who has access? (Developer / CI / Deployment Service)
- Where stored? (Environment / Vault / Hardcoded)

**Deliverable:** `CREDENTIAL_INVENTORY.md`

---

### Step 2: Classify by Permission Level

**Permission levels:**

| Level | Permissions | Allowed For |
|-------|-------------|-------------|
| **READ** | SELECT only | Developer, AI, CI |
| **TEST** | Full access to test DB | Developer, CI |
| **DDL_PRODUCTION** | CREATE/ALTER/DROP production | Deployment Service ONLY |
| **ADMIN** | All permissions + user management | Platform Admin ONLY |

**Current state assessment:**
- [ ] Developer has READ production?
- [ ] Developer has DDL production?
- [ ] AI has READ production?
- [ ] AI has DDL production?
- [ ] CI/CD has DDL production?
- [ ] Deployment Service has DDL production?

**Deliverable:** `CREDENTIAL_CLASSIFICATION.md`

---

### Step 3: Remove Developer/AI DDL Access

**Actions:**

**3.1: Remove from Environment**
```bash
# Developer .env (current — if exists)
DATABASE_URL=postgresql://postgres:[password]@...  # Full DDL access ❌

# Developer .env (target)
DATABASE_URL_READ_ONLY=postgresql://bella_readonly:...  # Read-only ✅
DATABASE_URL_TEST=postgresql://postgres:...@.../test  # Test DB ✅
# NO DATABASE_URL with production DDL
```

**3.2: Revoke Supabase Project Roles**
```
Developer role (current):
  - View tables: ✅
  - Execute SQL: ✅ (includes DDL) ❌
  
Developer role (target):
  - View tables: ✅
  - Execute SELECT: ✅
  - Execute DDL: ❌
```

**3.3: Remove from CI/CD**
```yaml
# GitHub Secrets (current — if exists)
DATABASE_URL: ${{ secrets.DATABASE_URL }}  # Full access ❌

# GitHub Secrets (target)
DATABASE_URL_READ_ONLY: ${{ secrets.DATABASE_URL_READ_ONLY }}  # Read-only ✅
# Only deployment workflow has DDL access via Vault
```

**Deliverable:** Evidence of removal (screenshots, config diffs)

---

### Step 4: Create Read-Only Credential

**If production read access needed:**

```sql
-- Create read-only role
CREATE ROLE bella_readonly WITH LOGIN PASSWORD '[secure_password]';

-- Grant SELECT on all tables
GRANT SELECT ON ALL TABLES IN SCHEMA public TO bella_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA supabase_migrations TO bella_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA deployment TO bella_readonly;

-- Grant SELECT on future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO bella_readonly;

-- Verify no DDL permissions
-- bella_readonly should NOT be able to:
--   - CREATE TABLE
--   - ALTER TABLE
--   - DROP TABLE
--   - INSERT/UPDATE/DELETE
```

**Expose to developers:**
```bash
# .env
DATABASE_URL_READ_ONLY=postgresql://bella_readonly:[password]@.../bella_prod
```

**Deliverable:** `READ_ONLY_ROLE.sql`, verification script

---

### Step 5: Vault Configuration

**Vault path structure:**
```
secret/bella/
  ├── production/
  │   ├── database_ddl       ← Production DDL credential
  │   └── deployment_key     ← Deployment service key
  ├── staging/
  │   └── database_ddl
  └── development/
      └── database_url        ← Dev database (not production)
```

**Access Control List (ACL):**
```hcl
# Deployment Service can read production DDL
path "secret/bella/production/database_ddl" {
  capabilities = ["read"]
  allowed_parameters = {
    "deployment_service_id" = ["bella_deployment_engine"]
  }
}

# Developers CANNOT read production DDL
path "secret/bella/production/*" {
  capabilities = ["deny"]
  identity {
    groups = ["developers"]
  }
}

# Developers CAN read development database
path "secret/bella/development/*" {
  capabilities = ["read"]
  identity {
    groups = ["developers"]
  }
}
```

**Deliverable:** Vault policy configuration, ACL verification

---

### Step 6: Deployment Service Integration

**Deployment Service must:**
1. Authenticate to Vault
2. Retrieve production DDL credential at runtime
3. Use credential for deployment ONLY
4. Never expose credential in logs/environment

**Implementation:**
```typescript
// src/platform/deployment/boundary/credentials.ts

async function getProductionDDLCredential(): Promise<string> {
  // Verify running as deployment service
  if (process.env.DEPLOYMENT_ENGINE_SERVICE !== 'true') {
    throw new Error('Only deployment service can retrieve production credentials');
  }
  
  // Retrieve from Vault (NOT environment)
  const vault = new VaultClient({
    address: process.env.VAULT_ADDR,
    token: process.env.VAULT_TOKEN  // Service token, not personal
  });
  
  const secret = await vault.read('secret/bella/production/database_ddl');
  
  // Audit log
  console.log('[AUDIT] Production DDL credential retrieved by deployment service');
  
  return secret.data.connection_string;
}
```

**Deliverable:** Vault integration code, audit log verification

---

### Step 7: Verification Tests

**Test 1: Developer CANNOT access production DDL**
```bash
# Developer terminal
echo $DATABASE_URL
# Expected: undefined OR read-only connection string

# Attempt DDL
psql "$DATABASE_URL_READ_ONLY" -c "CREATE TABLE test (id int);"
# Expected: ERROR: permission denied for schema public
```

**Test 2: AI CANNOT access production DDL**
```typescript
// AI process environment
process.env.DATABASE_URL  // undefined
process.env.SERVICE_ROLE_KEY  // undefined

// Attempt to access
const credential = getProductionDDLCredential();
// Expected: throw Error (not deployment service)
```

**Test 3: Deployment Service CAN access via Vault**
```bash
# Set deployment service flag
export DEPLOYMENT_ENGINE_SERVICE=true
export VAULT_ADDR=https://vault.bella.internal
export VAULT_TOKEN=[service_token]

# Retrieve credential
node -e "require('./boundary/credentials').getProductionDDLCredential()"
# Expected: Returns connection string
# Audit log: "[AUDIT] Production DDL credential retrieved"
```

**Test 4: Vault ACL blocks unauthorized access**
```bash
# Developer attempts to read production secret
vault read secret/bella/production/database_ddl
# Expected: Error: permission denied
```

**Deliverable:** Test results, screenshots, audit logs

---

## Evidence Requirements

### For G12 PASS:

**1. Credential Inventory Complete**
- [  ] All credential locations documented
- [  ] All credentials classified by permission level

**2. Developer DDL Access Removed**
- [  ] No DATABASE_URL with DDL in developer environment
- [  ] Supabase project role downgraded to read-only
- [  ] .env files updated

**3. Read-Only Credential Created (if needed)**
- [  ] bella_readonly role created
- [  ] Permissions verified (SELECT only)
- [  ] Exposed to developers safely

**4. Vault Integration Complete**
- [  ] Production DDL credential stored in Vault
- [  ] ACL configured (deployment service ONLY)
- [  ] Developers CANNOT access production secrets

**5. Deployment Service Integration**
- [  ] Retrieves credential from Vault at runtime
- [  ] Never exposes credential in environment
- [  ] Audit logging enabled

**6. Verification Tests PASS**
- [  ] Developer DDL attempt → BLOCKED
- [  ] AI DDL attempt → BLOCKED
- [  ] Deployment Service → ALLOWED via Vault
- [  ] Vault ACL → Enforces boundary

---

## Acceptance Criteria

**P0.2 PASS requires:**

| Criterion | Status |
|-----------|--------|
| Credential inventory complete | ⏳ |
| Developer DDL access removed | ⏳ |
| AI DDL access impossible | ⏳ |
| Vault integration working | ⏳ |
| Deployment Service retrieves from Vault | ⏳ |
| Verification tests PASS | ⏳ |
| Infrastructure boundary proven | ⏳ |

**ALL criteria MUST be met for G12 PASS.**

---

## Deliverables

1. `CREDENTIAL_INVENTORY.md` — All credentials documented
2. `CREDENTIAL_CLASSIFICATION.md` — Permission levels classified
3. `READ_ONLY_ROLE.sql` — Read-only database role
4. `VAULT_POLICY.hcl` — Vault ACL configuration
5. Updated `boundary/credentials.ts` — Vault integration
6. `VERIFICATION_TESTS.md` — Test results + evidence
7. `G12_EVIDENCE.md` — Complete proof of infrastructure boundary

---

## Constraints

**DO NOT:**
- ❌ Test DDL on production database
- ❌ Expose production credential during testing
- ❌ Use actual production credential in examples
- ❌ Bypass Vault for "testing convenience"

**ONLY:**
- ✅ Inventory existing credentials
- ✅ Remove/revoke developer DDL access
- ✅ Configure Vault properly
- ✅ Verify boundary with test attempts (that fail)

---

## Status

**P0.2:** 🟡 IN PROGRESS (Audit plan defined)

**Next:** Execute audit steps 1-7

**After P0.2 COMPLETE:**
- P0.3: Provenance Design
- Then E8.1: Qualification

---

**G12 = Infrastructure-enforced boundary, not policy-only. ✅**
