# R2 Evidence: verification_evidence RLS Finding Resolution

**Date:** 2026-08-25  
**Finding:** verification_evidence table has RLS disabled  
**Status:** ✅ RESOLVED — RLS disabled by design  

---

## Finding Summary

**Observed State:**
```
queryRLSStatus('verification_evidence'):
  enabled: false

queryRLSPolicies('verification_evidence'):
  policies: [] (none)
```

---

## Security Specification Analysis

**Document:** `docs/security/VERIFICATION_EXECUTOR_SECURITY_SPEC.md`

### RLS Requirements

**For verification_executor role:**
- ✅ BYPASSRLS = false (MUST respect RLS policies on application tables)
- ✅ Role must query application table RLS status/policies for verification

**For verification_evidence table:**
- ❌ **NO explicit RLS requirement found**
- Security enforced via role-based privileges (GRANT/REVOKE)

### Evidence Table Security Model

**From Security Spec Steps 4-5:**

```sql
-- Step 4: Create evidence table
CREATE TABLE IF NOT EXISTS verification_evidence (
  id BIGSERIAL PRIMARY KEY,
  verification_id UUID NOT NULL UNIQUE,
  ...
);
-- NO "ENABLE ROW LEVEL SECURITY" directive

-- Step 5: Grant evidence table privileges
GRANT INSERT, SELECT ON verification_evidence TO verification_executor;
REVOKE UPDATE, DELETE, TRUNCATE ON verification_evidence FROM verification_executor;
-- Security enforced via GRANT/REVOKE, not RLS
```

**Security Boundary:**
- verification_executor can INSERT (append evidence)
- verification_executor can SELECT (read evidence)
- verification_executor CANNOT UPDATE/DELETE (enforced by REVOKE)
- No multi-tenant isolation needed (evidence is not tenant-specific)

---

## Decision

**RLS disabled = ACCEPTED BY DESIGN**

**Rationale:**

1. **Security Spec Does Not Require RLS**
   - Spec extensively covers RLS for application tables
   - Spec does NOT require RLS on verification_evidence
   - Evidence security enforced via role privileges

2. **No Multi-Tenant Data**
   - Evidence table contains verification results
   - Not tenant-specific data (unlike application tables)
   - No cross-tenant leakage risk

3. **Role-Based Isolation Sufficient**
   - Dedicated role (verification_executor)
   - Append-only semantics (INSERT+SELECT, no UPDATE/DELETE)
   - Role cannot bypass RLS on application tables (BYPASSRLS=false)

4. **Contract v1.0.0 Compliance**
   - Contract focuses on application table RLS verification
   - Evidence table is infrastructure (not application data)
   - No Contract requirement for evidence table RLS

---

## Security Boundary Documentation

### verification_evidence Security Model

**Isolation Method:** Role-based privileges (not RLS)

**Privileges:**
```
verification_executor role:
├─ GRANT INSERT   → Can append evidence ✅
├─ GRANT SELECT   → Can read evidence ✅
├─ REVOKE UPDATE  → Cannot modify evidence ✅
├─ REVOKE DELETE  → Cannot delete evidence ✅
└─ REVOKE TRUNCATE → Cannot truncate evidence ✅
```

**Why RLS Not Required:**
- Evidence table is single-purpose (verification results)
- No tenant isolation needed (evidence belongs to system, not tenants)
- verification_executor is dedicated role (not shared)
- Append-only semantics prevent tampering

### Application Tables Security Model (Different)

**Isolation Method:** RLS policies

**Requirements:**
```
Application tables (e.g., runtime_tenant_registry):
├─ RLS ENABLED ✅ (Contract requirement)
├─ Policies enforce tenant isolation ✅
├─ verification_executor BYPASSRLS=false ✅
└─ Verification engine checks RLS status ✅
```

**Why RLS Required:**
- Multi-tenant data
- Tenant isolation critical
- verification_executor must respect policies
- Contract v1.0.0 mandates RLS verification

---

## Verification Evidence

### Gate A Security Checks (Already Passed)

```
✅ CHECK 3: rolbypassrls = FALSE
   → verification_executor respects RLS on application tables

✅ CHECK 7: verification_evidence permissions
   → INSERT+SELECT granted, UPDATE/DELETE/TRUNCATE revoked
```

### Adapter Smoke Test (Already Passed)

```
✅ Test 7a: queryRLSStatus('verification_evidence')
   → Returns: enabled=false (expected)

✅ Test 7b: queryRLSPolicies('verification_evidence')
   → Returns: [] (expected, no policies needed)
```

### Security Spec Compliance

| Requirement | Spec | Implementation | Status |
|-------------|------|----------------|--------|
| verification_executor BYPASSRLS=false | Required | ✅ false | PASS |
| Evidence INSERT privilege | Required | ✅ Granted | PASS |
| Evidence SELECT privilege | Required | ✅ Granted | PASS |
| Evidence UPDATE/DELETE denied | Required | ✅ Revoked | PASS |
| Evidence RLS enabled | **NOT Required** | ❌ Disabled | **BY DESIGN** |
| Application table RLS verification | Required | ✅ Adapter supports | PASS |

---

## Conclusion

**Finding Status:** ✅ RESOLVED

**Resolution:** RLS disabled on verification_evidence is **BY DESIGN**, not a configuration gap.

**Security Boundary:**
- Application tables: RLS-based isolation (Contract requirement)
- Evidence table: Role-based privileges (sufficient for single-purpose audit table)

**Contract v1.0.0:** ✅ UNCHANGED (no modification needed)

**Gate C Impact:** ✅ UNBLOCKED (RLS finding resolved)

---

## Audit Trail

**Evidence Generated:**
- Security Spec analysis (no RLS requirement found)
- Gate A security checks (rolbypassrls=false verified)
- Adapter smoke test (RLS queries functional)
- Security boundary documentation (role-based vs RLS-based)

**Verification:**
```bash
# Confirm verification_executor BYPASSRLS=false
SELECT rolname, rolbypassrls FROM pg_roles WHERE rolname = 'verification_executor';
# Result: rolbypassrls = false ✅

# Confirm evidence table privileges
SELECT 
  has_table_privilege('verification_executor', 'verification_evidence', 'INSERT'),
  has_table_privilege('verification_executor', 'verification_evidence', 'SELECT'),
  has_table_privilege('verification_executor', 'verification_evidence', 'UPDATE'),
  has_table_privilege('verification_executor', 'verification_evidence', 'DELETE');
# Result: INSERT=true, SELECT=true, UPDATE=false, DELETE=false ✅

# Confirm RLS status
SELECT relrowsecurity FROM pg_class WHERE relname = 'verification_evidence';
# Result: relrowsecurity = false ✅ (by design)
```

---

**Document Status:** ✅ COMPLETE

**R2 Status:** ✅ RESOLVED — RLS disabled by design, security enforced via role privileges
