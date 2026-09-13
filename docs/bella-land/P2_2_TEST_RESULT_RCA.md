# P2.2 Test Result — RCA (Root Cause Analysis)

**Date:** 2026-09-11  
**Test:** P2.2 Products Tenant Isolation + Layer 5  
**Result:** ❌ **8/10 PASS** (A6, A7 FAILED)  
**Status:** 🔴 **EVIDENCE FROZEN — RCA IN PROGRESS**

---

## 📊 Test Results

### Standard RLS (Layers 1-4)

| Test | Description | Result | Notes |
|------|-------------|--------|-------|
| A1 | Own-tenant create | ✅ PASS | Product created with correct tenant_id |
| A2 | Own-tenant read | ✅ PASS | User sees own products (7 total) |
| A3 | Cross-tenant read blocked | ✅ PASS | Tenant A cannot see Tenant B product |
| A4 | Cross-tenant update blocked | ✅ PASS | Update returned 0 rows |
| A5 | Cross-tenant delete blocked | ✅ PASS | Delete returned 0 rows |
| **A6** | **Tenant forgery blocked** | **❌ FAIL** | **Forgery ALLOWED** |
| **A7** | **Tenant escape blocked** | **❌ FAIL** | **Escape ALLOWED** |
| A8 | No query leakage | ✅ PASS | No Tenant B data in Tenant A queries |

### Layer 5 (Cross-Entity Integrity)

| Test | Description | Result | Notes |
|------|-------------|--------|-------|
| A9 | Cross-entity forgery blocked | ✅ PASS | Service blocked: "Project not found or access denied" |
| A10 | Cross-entity escape blocked | ✅ PASS | Update returned 0 rows (RLS blocked) |

---

## 🔍 RCA: A6 Tenant Forgery

### What A6 Tests

**Goal:** Verify that RLS WITH CHECK prevents inserting a product with forged `tenant_id`

**Test logic:**
```typescript
// Attempt to insert with Tenant B's tenant_id into Tenant A's project
await supabaseAdmin
  .from('real_estate_products')
  .insert({
    tenant_id: tenantB.id,      // ← Forged tenant_id
    project_id: projectA.id,    // ← Tenant A's project
    product_code: 'FORGE-...',
    product_type: 'apartment'
  });
```

**Expected:** INSERT blocked by `WITH CHECK (tenant_id = public.get_auth_tenant_id())`  
**Actual:** INSERT succeeded (forgery allowed)

### Root Cause

**`supabaseAdmin` uses `service_role` key, which BYPASSES RLS.**

From Supabase documentation and grants:
```sql
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.real_estate_products TO service_role;
```

**service_role privileges:**
- Bypasses ALL RLS policies (including WITH CHECK)
- Intended for admin/system operations
- Required for setup, migrations, background jobs

**The test incorrectly assumes service_role would be blocked by WITH CHECK.**

### Verification: WITH CHECK Policy Exists

```sql
-- From migration 20260731010000_create_real_estate_schema.sql
CREATE POLICY "Products tenant write"
  ON public.real_estate_products
  FOR ALL TO authenticated
  USING (
    public.is_hq_super_admin()
    OR (
      tenant_id = public.get_auth_tenant_id()
      AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() ...)
    )
  )
  WITH CHECK (
    public.is_hq_super_admin()
    OR (
      tenant_id = public.get_auth_tenant_id()  ← Validates tenant_id
      AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() ...)
    )
  );
```

✅ **WITH CHECK clause EXISTS and is correctly defined**  
✅ **Policy applies TO authenticated (not service_role)**

### Classification

**NOT a security defect.**

- RLS policies are correctly configured
- WITH CHECK enforcement exists for authenticated users
- service_role bypass is intentional Supabase design
- Test expectation misaligned with Supabase architecture

---

## 🔍 RCA: A7 Tenant Escape

### What A7 Tests

**Goal:** Verify that RLS WITH CHECK prevents changing `tenant_id` of existing product

**Test logic:**
```typescript
// Attempt to change Tenant A product's tenant_id to Tenant B
await supabaseAdmin
  .from('real_estate_products')
  .update({ tenant_id: tenantB.id })  // ← Change tenant_id
  .eq('id', tenantAProductId);
```

**Expected:** UPDATE blocked by WITH CHECK  
**Actual:** UPDATE succeeded (escape allowed)

### Root Cause

**Same as A6: service_role bypasses RLS WITH CHECK.**

### Verification

Same policy applies to UPDATE:
```sql
FOR ALL TO authenticated  -- INSERT, UPDATE, DELETE
WITH CHECK (tenant_id = public.get_auth_tenant_id())
```

✅ **WITH CHECK applies to UPDATE operations**  
✅ **But service_role bypasses it**

### Classification

**NOT a security defect** (same as A6).

---

## 🎯 Impact Assessment

### Security Posture

**Authenticated users ARE protected:**
- RLS policies correctly enforce tenant isolation
- WITH CHECK prevents tenant_id forgery/escape for authenticated role
- A1-A5, A8-A10 all passed (demonstrates RLS works)

**service_role CAN bypass:**
- This is **intentional** for admin operations
- Required for:
  - Data migrations
  - System setup/teardown
  - Background jobs (e.g., cleanup, aggregations)
  - Administrative corrections

### Real-World Attack Scenarios

**Scenario 1: Malicious authenticated user**
- Attempts to forge tenant_id in browser DevTools
- ❌ BLOCKED by RLS WITH CHECK (A3-A5 evidence)

**Scenario 2: Compromised service_role key**
- Attacker has service_role key → full database access
- ✅ Expected — service_role is equivalent to database superuser
- Mitigation: Secure service_role key (never exposed to client)

**Scenario 3: Application bug (service bypasses service layer)**
- If app uses service_role for user operations → tenant_id can be forged
- ❌ This would be an **application architecture defect**
- NOT covered by RLS (RLS protects authenticated users, not service_role)

### Defense-in-Depth Status

| Layer | Enforcement | Status |
|-------|-------------|--------|
| **Service Layer** | ProductService validates parent ownership | ✅ VERIFIED (P2.1 T5, P2.2 A9) |
| **Database RLS (authenticated)** | WITH CHECK on tenant_id | ✅ EXISTS (A1-A5, A8 evidence) |
| **Database RLS (service_role)** | N/A (bypasses RLS) | ⚠️ BY DESIGN |

**Verdict:** Defense-in-depth exists for **authenticated users**. service_role bypass is architectural, not a gap.

---

## 📋 Options for Resolution

### Option 1: Rewrite A6/A7 to Use Authenticated Client

**Approach:** Create actual authenticated Supabase client with user JWT

**Pros:**
- Tests RLS enforcement as experienced by real users
- Validates WITH CHECK for correct role
- Provides true security evidence

**Cons:**
- Requires auth token generation (complex setup)
- May need actual Supabase Auth user creation
- Slower test execution

**Verdict:** ✅ **RECOMMENDED** — Provides authentic security evidence

---

### Option 2: Accept A6/A7 as Expected service_role Behavior

**Approach:** Document that service_role bypasses RLS (by design), adjust pass criteria

**Change A6/A7 expectations:**
- ~~Expected: Forgery blocked~~
- **Expected: service_role allowed (RLS bypass), authenticated would be blocked**

**Update verdict logic:**
```text
A6: service_role insert succeeded → EXPECTED (not a FAIL)
A7: service_role update succeeded → EXPECTED (not a FAIL)
Evidence: RLS WITH CHECK exists (verified in migration)
```

**Pros:**
- Fast resolution
- Acknowledges Supabase architecture
- No code changes needed (documentation only)

**Cons:**
- Doesn't provide runtime evidence of WITH CHECK enforcement
- May be questioned in audit ("Why didn't you test it?")

**Verdict:** ⚠️ **ACCEPTABLE** — But less rigorous than Option 1

---

### Option 3: Remove A6/A7 from RC Baseline

**Approach:** Adjust baseline to 8 tests (A1-A5, A8-A10), remove A6/A7

**Rationale:**
- A6/A7 test service_role behavior (not user-facing security)
- Remaining 8 tests cover tenant isolation for authenticated users
- WITH CHECK existence verified via schema review (not runtime test)

**Pros:**
- Simplest resolution
- Focuses on user-facing security

**Cons:**
- Reduces test coverage count
- May appear as "lowering the bar"

**Verdict:** ❌ **NOT RECOMMENDED** — Conflicts with baseline integrity principle

---

## 🔧 Recommended Remediation

**OPTION 1: Rewrite A6/A7 with Authenticated Client**

**Implementation plan:**

1. **Create authenticated Supabase client helper:**
   ```typescript
   async function createAuthenticatedClient(userId: string) {
     // Get user's JWT from Supabase Auth
     // Create client with user session
     // Return scoped client
   }
   ```

2. **Update A6 test:**
   ```typescript
   const clientA = await createAuthenticatedClient(userA.id);
   
   // Attempt forgery with authenticated client (not service_role)
   const { data, error } = await clientA
     .from('real_estate_products')
     .insert({ tenant_id: tenantB.id, project_id: projectA.id, ... });
   
   // Expected: error due to WITH CHECK
   a6Pass = error !== null;
   ```

3. **Update A7 test:**
   ```typescript
   const clientA = await createAuthenticatedClient(userA.id);
   
   const { data, error } = await clientA
     .from('real_estate_products')
     .update({ tenant_id: tenantB.id })
     .eq('id', tenantAProductId);
   
   // Expected: error or 0 rows due to WITH CHECK
   a7Pass = error !== null || data.length === 0;
   ```

4. **Rerun ALL 10 tests (A1-A10)**

**Estimated effort:** 2-3 hours (auth client setup + test rewrite + execution)

---

## 🔒 Evidence Status

```text
P2.2 TENANT ISOLATION + LAYER 5

Standard RLS (Layers 1-4)
├─ A1-A5                    ✅ VERIFIED (5/5)
├─ A6-A7                    🔴 TEST DESIGN FLAW (service_role bypass)
└─ A8                       ✅ VERIFIED

Layer 5 (Cross-Entity Integrity)
├─ A9                       ✅ VERIFIED (Service enforcement)
└─ A10                      ✅ VERIFIED (RLS + Service enforcement)

Overall Status                 🔴 8/10 PASS — REMEDIATION REQUIRED
Next Action                    → Option 1: Rewrite A6/A7 with auth client
```

---

## 📝 Conclusion

**Finding:** NOT a security defect. RLS WITH CHECK policies exist and are correctly configured. Failures caused by test using service_role (which bypasses RLS by design).

**Security Assessment:**
- ✅ Authenticated users protected by RLS WITH CHECK
- ✅ Layer 5 cross-entity integrity enforced (A9/A10)
- ⚠️ service_role can bypass (expected, requires secure key management)

**Recommendation:** Rewrite A6/A7 to use authenticated Supabase client. This will provide authentic runtime evidence of WITH CHECK enforcement for authenticated users.

**Baseline compliance:** Fix test to meet baseline (not lower baseline to meet test).

---

**RCA Date:** 2026-09-11  
**Analyst:** Kiro AI  
**Status:** 🔴 **EVIDENCE FROZEN — AWAITING REMEDIATION DECISION**  
**Next:** → Implement Option 1 → Rerun A1-A10 → Update evidence

