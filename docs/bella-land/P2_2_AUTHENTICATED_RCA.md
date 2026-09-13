# P2.2 Authenticated Security — RCA

**Date:** 2026-09-11  
**Session:** 5  
**Test Methodology:** Authenticated clients (NOT service_role)  
**Result:** ❌ **8/10 PASS** (A9, A10 FAILED)  
**Status:** 🔴 **REAL SECURITY DEFECT IDENTIFIED**

---

## 📊 Test Results Summary

```text
Standard RLS (Layers 1-4):        8/8 PASS ✅
Layer 5 (Cross-Entity Integrity): 0/2 PASS ❌

Overall: 8/10 PASS
```

### Detailed Results

| Test | Category | Result | Evidence |
|------|----------|--------|----------|
| A1 | Own-tenant create | ✅ PASS | Product created with correct tenant_id |
| A2 | Own-tenant read | ✅ PASS | User sees own products |
| A3 | Cross-tenant read | ✅ PASS | RLS blocks cross-tenant SELECT |
| A4 | Cross-tenant update | ✅ PASS | RLS blocks cross-tenant UPDATE (0 rows) |
| A5 | Cross-tenant delete | ✅ PASS | RLS blocks cross-tenant DELETE (0 rows) |
| A6 | Tenant forgery (INSERT) | ✅ PASS | RLS WITH CHECK blocked with error |
| A7 | Tenant escape (UPDATE) | ✅ PASS | RLS WITH CHECK blocked with error |
| A8 | Query leakage | ✅ PASS | No cross-tenant data in queries |
| **A9** | **Cross-entity forgery (Layer 5)** | **❌ FAIL** | **Tenant A product → Tenant B project ALLOWED** |
| **A10** | **Cross-entity escape (Layer 5)** | **❌ FAIL** | **Re-parent to cross-tenant project ALLOWED** |

---

## 🔍 RCA: A9 Cross-Entity Forgery Failure

### What Happened

**Test:** Tenant A user attempts to create Product with Tenant B's project

**Code:**
```typescript
// Authenticated clientA
await clientA
  .from('real_estate_products')
  .insert({
    tenant_id: TENANT_A.id,        // ← Own tenant
    project_id: TENANT_B.project_id // ← Cross-tenant project
    // ...
  });
```

**Expected:** INSERT blocked (Product cannot reference cross-tenant Project)

**Actual:** ✅ **INSERT SUCCEEDED** (product created with cross-tenant parent)

### Root Cause

**Foreign key constraint does NOT enforce tenant boundary.**

**Current schema:**
```sql
CREATE TABLE real_estate_products (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  project_id UUID NOT NULL REFERENCES real_estate_projects(id), ← Only checks existence
  ...
);
```

**What FK enforces:**
- ✅ `project_id` must exist in `real_estate_projects`

**What FK does NOT enforce:**
- ❌ Product.tenant_id = Project.tenant_id

**RLS on products table:**
```sql
CREATE POLICY "Products tenant write"
  ON real_estate_products
  FOR ALL TO authenticated
  USING (tenant_id = get_auth_tenant_id())
  WITH CHECK (tenant_id = get_auth_tenant_id());
```

**What RLS enforces:**
- ✅ User can only CREATE/UPDATE products with own `tenant_id`
- ✅ User can only see/modify products with own `tenant_id`

**What RLS does NOT enforce:**
- ❌ `project_id` must belong to same tenant as `tenant_id`

**Result:**
- RLS allows INSERT because `tenant_id = TENANT_A` (correct)
- FK allows INSERT because `project_id` exists (doesn't check tenant)
- **No constraint validates Product.tenant_id = Project.tenant_id**

### Why This Wasn't Caught in Session 4

**Session 4 used service_role for ALL tests:**
- service_role bypasses RLS (by design)
- A9/A10 appeared to "pass" but weren't actually testing RLS
- We measured "can service_role bypass" not "does RLS enforce"

**Session 5 uses authenticated clients:**
- Real RLS enforcement tested
- A9/A10 revealed actual gap

---

## 🔍 RCA: A10 Cross-Entity Escape Failure

### What Happened

**Test:** Tenant A user attempts to UPDATE own Product's `project_id` to Tenant B's project

**Code:**
```typescript
// Authenticated clientA, updating own product
await clientA
  .from('real_estate_products')
  .update({ project_id: TENANT_B.project_id }) // ← Change to cross-tenant project
  .eq('id', tenantAProductId);
```

**Expected:** UPDATE blocked (cannot re-parent to cross-tenant project)

**Actual:** ✅ **UPDATE SUCCEEDED** (product re-parented to cross-tenant project)

### Root Cause

**Same as A9: FK and RLS do not validate tenant match.**

**RLS evaluation for UPDATE:**
1. **USING clause:** `tenant_id = get_auth_tenant_id()`
   - Product has `tenant_id = TENANT_A`
   - User is Tenant A → Product is visible ✅

2. **WITH CHECK clause:** `tenant_id = get_auth_tenant_id()`
   - New row still has `tenant_id = TENANT_A` (not being changed)
   - User is Tenant A → WITH CHECK passes ✅

3. **FK constraint:** `project_id REFERENCES real_estate_projects(id)`
   - Tenant B project exists → FK satisfied ✅

4. **Missing validation:** No constraint checks `Product.tenant_id = Project.tenant_id`

**Result:** UPDATE allowed, Product now points to cross-tenant Project

---

## 🎯 Security Impact Assessment

### Severity: **HIGH**

**What attackers can do:**

1. **Cross-tenant data linkage:**
   - Tenant A can link Products to Tenant B's Projects
   - Violates parent-child tenant isolation
   - Data integrity broken

2. **Potential data exfiltration path:**
   - Tenant A creates Product → Tenant B Project
   - If queries join Product → Project, might expose Project data
   - Depends on query patterns and RLS on joined tables

3. **Audit trail corruption:**
   - Product reports show cross-tenant relationships
   - Business logic may produce incorrect results
   - Financial/operational data compromised

### Attack Scenario

```text
Tenant A (Attacker):
1. Discovers Tenant B project ID (e.g., via brute force UUIDs or leaked data)
2. Creates Product with tenant_id=A, project_id=B
3. Product now appears in Tenant A's product list
4. If Product queries join Project data → potential info leak
5. Business reports show Product under wrong Project

Impact:
- Data integrity: VIOLATED
- Tenant isolation: PARTIAL BREACH (parent-child boundary)
- Confidentiality: DEPENDS (on query patterns)
```

### Defense-in-Depth Status

| Layer | Status | Notes |
|-------|--------|-------|
| **Application (Service)** | ⚠️ **BYPASSED** | Direct DB access from authenticated client |
| **RLS (tenant_id)** | ✅ **ENFORCED** | A1-A8 evidence |
| **RLS (cross-entity)** | ❌ **GAP** | No policy validates parent tenant match |
| **FK (existence)** | ✅ **ENFORCED** | Project must exist |
| **FK (tenant match)** | ❌ **GAP** | No constraint validates tenant boundary |

**Current protection:**
- ✅ ProductService.createProduct() validates parent ownership (IF called)
- ❌ Direct authenticated DB access bypasses service layer
- ❌ No DB-level enforcement of cross-entity tenant match

---

## 📋 Remediation Options

### Option 1: Database Trigger (CHECK Constraint Alternative)

**Add trigger to validate parent tenant match:**

```sql
CREATE OR REPLACE FUNCTION validate_product_project_tenant()
RETURNS TRIGGER AS $$
BEGIN
  -- Validate that project belongs to same tenant
  IF NOT EXISTS (
    SELECT 1 FROM real_estate_projects
    WHERE id = NEW.project_id
      AND tenant_id = NEW.tenant_id
  ) THEN
    RAISE EXCEPTION 'Product project must belong to same tenant'
      USING ERRCODE = '23503'; -- Foreign key violation
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_product_project_tenant
  BEFORE INSERT OR UPDATE OF project_id, tenant_id
  ON real_estate_products
  FOR EACH ROW
  EXECUTE FUNCTION validate_product_project_tenant();
```

**Pros:**
- ✅ Enforces at DB level (defense-in-depth)
- ✅ Works for ALL access patterns (service layer, direct DB, bulk operations)
- ✅ Cannot be bypassed by authenticated users

**Cons:**
- ⚠️ Performance: Extra SELECT on every INSERT/UPDATE
- ⚠️ Complexity: Additional trigger maintenance

---

### Option 2: RLS Policy Extension (READ-ONLY validation)

**Add RLS policy to validate project is visible:**

```sql
-- Additional WITH CHECK to ensure project is accessible
CREATE POLICY "Products cross-entity validation"
  ON real_estate_products
  FOR ALL TO authenticated
  WITH CHECK (
    tenant_id = get_auth_tenant_id()
    AND EXISTS (
      SELECT 1 FROM real_estate_projects
      WHERE id = real_estate_products.project_id
        AND tenant_id = get_auth_tenant_id() -- Project must be own-tenant
    )
  );
```

**Pros:**
- ✅ Uses RLS mechanism (consistent with existing policies)
- ✅ Cannot be bypassed by authenticated users

**Cons:**
- ⚠️ Performance: Subquery on every write
- ⚠️ Only enforces for authenticated role (service_role still bypasses)
- ⚠️ Complex RLS (harder to audit)

---

### Option 3: Composite Foreign Key (IDEAL but requires schema change)

**Change FK to validate both id AND tenant_id:**

```sql
-- Step 1: Add unique constraint on projects (id, tenant_id)
ALTER TABLE real_estate_projects
  ADD CONSTRAINT real_estate_projects_id_tenant_unique
  UNIQUE (id, tenant_id);

-- Step 2: Change FK to reference both columns
ALTER TABLE real_estate_products
  DROP CONSTRAINT real_estate_products_project_id_fkey;

ALTER TABLE real_estate_products
  ADD CONSTRAINT real_estate_products_project_tenant_fkey
  FOREIGN KEY (project_id, tenant_id)
  REFERENCES real_estate_projects(id, tenant_id);
```

**Pros:**
- ✅ Native FK enforcement (most performant)
- ✅ Standard SQL pattern
- ✅ Cannot be bypassed (even by service_role with FK checks enabled)
- ✅ No triggers, no RLS complexity

**Cons:**
- ⚠️ Schema migration required
- ⚠️ Existing data must be validated first
- ⚠️ All application code must provide both columns

---

## 🎯 Recommended Remediation

**OPTION 1: Database Trigger**

**Why:**
1. No schema changes (faster deployment)
2. Works with existing FK structure
3. Provides DB-level enforcement (defense-in-depth)
4. Clear error messages for violations

**Implementation:**
1. Create validation trigger function
2. Apply to real_estate_products table
3. Test with A9/A10 scenarios
4. Rerun P2.2 A1-A10 (authenticated)
5. Pass criteria: 10/10 PASS

**Migration safety:**
- Check existing products for violations
- Fix any cross-tenant products before applying trigger
- Document as Layer 5 enforcement

---

## 📊 Comparison: Session 4 vs Session 5

| Aspect | Session 4 | Session 5 |
|--------|-----------|-----------|
| **Methodology** | service_role | Authenticated clients |
| **A1-A8 (RLS)** | 6/8 (A6-A7 fail) | 8/8 PASS ✅ |
| **A9-A10 (Layer 5)** | 2/2 (false positive) | 0/2 FAIL ❌ |
| **Overall** | 8/10 (test design flaw) | 8/10 (real defect) |
| **Finding** | TEST FLAW | SECURITY GAP |

**Key insight:** Service_role bypass masked the real security gap.

---

## ✅ Verified (Authenticated Evidence)

**Standard RLS (Layers 1-4):** 🔒 **RUNTIME VERIFIED**

- ✅ A1-A2: Own-tenant operations ALLOWED
- ✅ A3-A5: Cross-tenant operations BLOCKED
- ✅ A6-A7: tenant_id forgery/escape BLOCKED (WITH CHECK enforced)
- ✅ A8: No query leakage

**Evidence:** RLS USING and WITH CHECK clauses enforce tenant isolation for authenticated users.

**Layer 5 (Cross-Entity Integrity):** 🔴 **DEFECT IDENTIFIED**

- ❌ A9: Cross-entity forgery NOT blocked
- ❌ A10: Cross-entity escape NOT blocked

**Evidence:** No DB constraint validates Product.tenant_id = Project.tenant_id.

---

## 🔒 Next Steps

**Immediate:**
1. Freeze P2.2 evidence (DONE)
2. Implement remediation (Option 1: Trigger)
3. Validate no existing violations
4. Apply trigger to real_estate_products
5. Rerun P2.2 A1-A10 (authenticated)

**Pass criteria:** 10/10 PASS → P2.2 VERIFIED

**If 10/10 PASS:**
- P2.2 🔒 VERIFIED
- Proceed to P2.3 Browser Runtime

**If ANY FAIL:**
- New RCA cycle
- Deeper defect investigation

---

**RCA Date:** 2026-09-11  
**Session:** 5  
**Analyst:** Kiro AI  
**Classification:** 🔴 **SECURITY DEFECT — LAYER 5 GAP**  
**Severity:** HIGH  
**Status:** ⏸️ **REMEDIATION REQUIRED**

