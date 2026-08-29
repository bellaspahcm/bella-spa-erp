# Gate C Security Findings — BLOCKED

**Date:** 2026-08-25  
**Phase:** Phase 1 Remediation R1-R3  
**Status:** 🔴 BLOCKED — Requires remediation before T1-T7  

---

## 🔴 FINDING 1: verification_evidence RLS Disabled

### Evidence
```
▶ Test 7a/7: queryRLSStatus()
  ⚠️  RLS enabled: false

▶ Test 7b/7: queryRLSPolicies()
  ✅ RLS policies: 0 found
```

### Analysis

**Observation:** `verification_evidence` table has RLS disabled.

**Security Context:**
- `verification_executor` role has `rolbypassrls = false` ✅
- Table privileges: INSERT + SELECT (no UPDATE/DELETE) ✅
- But RLS itself is disabled on the table

### Security Question

**Is this by design or configuration gap?**

**Option A: By Design (Acceptable)**
```
RLS disabled = accepted design
Isolation enforced through:
  - Dedicated role (verification_executor)
  - GRANT/REVOKE privileges only
  - No multi-tenant data in evidence table
  - Append-only INSERT + SELECT
```

**Option B: Configuration Gap (Must Fix)**
```
RLS should be enabled with policies:
  - INSERT: verification_executor can append
  - SELECT: verification_executor can read own records
  - UPDATE/DELETE: denied (already enforced by GRANT)
```

### Security Specification Review

**From:** `docs/security/VERIFICATION_EXECUTOR_SECURITY_SPEC.md`

**Step 4: Create evidence table**
```sql
CREATE TABLE IF NOT EXISTS verification_evidence (
  id BIGSERIAL PRIMARY KEY,
  ...
);
```

**Step 5: Grant evidence table privileges**
```sql
GRANT INSERT, SELECT ON verification_evidence TO verification_executor;
REVOKE UPDATE, DELETE, TRUNCATE ON verification_evidence FROM verification_executor;
```

**Finding:** Security Spec does NOT explicitly require RLS on verification_evidence.

### Recommendation

**If RLS not required:**
- Document: "RLS disabled by design - evidence table uses role-based isolation"
- Update Security Spec to clarify RLS exemption
- Gate C: UNBLOCK

**If RLS required:**
- Enable RLS: `ALTER TABLE verification_evidence ENABLE ROW LEVEL SECURITY;`
- Create policies for verification_executor
- Re-run security verification
- Gate C: Remains BLOCKED until fixed

### Decision Required

Human architect must decide:
- [ ] RLS disabled = accepted design (document + UNBLOCK)
- [ ] RLS required (fix + verify + UNBLOCK)

---

## 🔴 FINDING 2: SSL Certificate Bypass in Development

### Evidence
```typescript
const sslConfig = process.env.NODE_ENV === 'production'
  ? {
      rejectUnauthorized: true, // Strict verification
    }
  : {
      rejectUnauthorized: false, // ❌ CERTIFICATE BYPASS
    };
```

### Security Issue

**Problem:** `rejectUnauthorized: false` disables certificate verification in development.

**Impact:**
- Development: Man-in-the-middle attacks possible
- Verification runtime uses same code path as production
- Security regression introduced for "convenience"

### Required Remediation

**Remove ALL `rejectUnauthorized: false` paths.**

**Use CA bundle approach:**
```typescript
const sslConfig: any = {
  rejectUnauthorized: true, // ALWAYS verify (all environments)
};

// Optional: Explicit CA bundle for Supabase self-signed certs
if (process.env.DATABASE_CA_CERT) {
  const fs = await import('fs');
  sslConfig.ca = fs.readFileSync(process.env.DATABASE_CA_CERT).toString();
}
```

**For Supabase Development:**
1. Export CA certificate from Supabase dashboard
2. Save to file: `supabase-ca.pem`
3. Set env var: `DATABASE_CA_CERT=/path/to/supabase-ca.pem`
4. Connection now uses strict verification with trusted CA

**Result:**
```
Development  ─┐
Staging      ├── rejectUnauthorized: true (all environments)
Production  ─┘
```

**Status:** 🔴 BLOCKED — Must implement CA bundle approach

---

## 🟡 FINDING 3: TypeScript Compilation Not Verified

### Evidence
```
Full project tsc --noEmit: TIMEOUT (120s)
tsx --check database-adapter.ts: ✅ PASS
Adapter runtime smoke test: ✅ 8/8 PASS
```

### Analysis

**Not a blocker, but accuracy issue:**
- Cannot claim "TypeScript compilation PASS"
- Timeout is due to large project size (not adapter issue)
- Targeted syntax check passed
- Runtime validation passed

### Correct Status

```
TypeScript Compilation:
├─ Full project (tsc --noEmit)        ⚠️  TIMEOUT (not verified)
├─ Targeted adapter syntax check      ✅ PASS
└─ Runtime validation                 ✅ 8/8 PASS

Conclusion: Syntax valid, runtime functional, full compile not blocking
```

### Recommendation

**Option A:** Increase timeout or use targeted typecheck on migration-governance module only

**Option B:** Accept "full project compile not verified" as non-blocking finding

**Status:** 🟡 NON-BLOCKING — Document accurately, don't claim PASS

---

## 🚧 GATE C STATUS

```
Gate C: T1-T7 Validation Approval
├─ Finding 1: RLS on verification_evidence    🔴 DECISION REQUIRED
├─ Finding 2: SSL certificate bypass          🔴 MUST FIX
├─ Finding 3: TypeScript full compile         🟡 NON-BLOCKING
│
└─ Status: 🔴 BLOCKED

Blockers:
1. Resolve RLS finding (by design or fix)
2. Implement CA bundle SSL (no rejectUnauthorized:false)

After remediation:
- Re-run adapter smoke test
- Re-run security verification
- Submit evidence for Gate C review
```

---

## 📋 REMEDIATION TASKS

### R1: SSL Certificate Verification (CA Bundle)

**Task:** Replace `rejectUnauthorized: false` with CA bundle approach

**Implementation:**
1. Remove NODE_ENV-based SSL branching
2. Always use `rejectUnauthorized: true`
3. Support `DATABASE_CA_CERT` env var for custom CAs
4. Update error messages with CA bundle instructions
5. Document Supabase CA export procedure

**Verification:**
```bash
# Without CA bundle (should fail with cert error)
DATABASE_CA_CERT= npx tsx test/phase4b3/test-direct-adapter.ts

# With CA bundle (should pass)
DATABASE_CA_CERT=/path/to/supabase-ca.pem npx tsx test/phase4b3/test-direct-adapter.ts
```

---

### R2: RLS on verification_evidence

**Task:** Resolve RLS disabled finding

**Option A: Document as By Design**
```markdown
## verification_evidence RLS Status

**Decision:** RLS disabled by design

**Rationale:**
- Evidence table is not multi-tenant
- Isolation enforced via dedicated role (verification_executor)
- Role privileges (INSERT+SELECT only) sufficient
- No cross-tenant data leakage risk

**Security Boundary:**
- verification_executor cannot UPDATE/DELETE evidence
- verification_executor cannot access application tables (write)
- verification_executor respects RLS on application tables
```

**Option B: Enable RLS + Policies**
```sql
-- Enable RLS
ALTER TABLE verification_evidence ENABLE ROW LEVEL SECURITY;

-- Policy: verification_executor can INSERT
CREATE POLICY evidence_insert ON verification_evidence
  FOR INSERT
  TO verification_executor
  WITH CHECK (true);

-- Policy: verification_executor can SELECT all
CREATE POLICY evidence_select ON verification_evidence
  FOR SELECT
  TO verification_executor
  USING (true);
```

---

### R3: Targeted TypeScript Check

**Task:** Verify TypeScript compilation of migration-governance module

**Commands:**
```bash
# Option 1: Targeted module check
npx tsc --noEmit src/platform/migration-governance/**/*.ts

# Option 2: Individual file checks
npx tsx --check src/platform/migration-governance/verification/database-adapter.ts
npx tsx --check src/platform/migration-governance/verification/verification-engine.ts
```

**Acceptance:** Either full module compile OR all individual file checks PASS

---

## 📤 NEXT STEPS

**Awaiting Human Architect Decision:**

1. **RLS Finding:** By design or configuration gap?
2. **SSL Remediation Approval:** Implement CA bundle approach?
3. **TypeScript Status:** Accept "not verified" or require targeted pass?

**After decisions made:**
- Implement approved remediations
- Re-run all verification tests
- Submit evidence for final Gate C review

**DO NOT PROCEED TO:**
- ❌ T1-T7 execution
- ❌ SupabaseAdapter removal
- ❌ RPC cleanup
- ❌ Contract modifications
- ❌ Phase 2/3/4/5

---

**Document Status:** 🔴 AWAITING ARCHITECT DECISIONS

**Gate C Status:** 🔴 BLOCKED ON SECURITY FINDINGS
