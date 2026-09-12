# P2.1 Blocker — Product Create Not Implemented

**Date:** 2026-09-11  
**Phase:** P2.1 Write Flow Testing  
**Status:** 🔴 **BLOCKED**

---

## 🔴 Blocker Discovery

**Finding:** Product create capability does NOT exist in codebase.

**Evidence:**

### 1. ProductService Analysis

**File:** `src/modules/real_estate/services/ProductService.ts`

**Methods found:**
- ✅ `getProducts()` — Read products
- ✅ `updateProductStatus()` — Update status
- ✅ `updateProductDetails()` — Update details
- ❌ `createProduct()` — **NOT FOUND**

### 2. ProductActions Analysis

**File:** `src/modules/real_estate/actions/productActions.ts`

**Actions found:**
- ✅ `fetchProductsAction()` — Read
- ✅ `updateProductStatusAction()` — Update
- ✅ `updateProductDetailsAction()` — Update
- ✅ `releaseExpiredBookingsAction()` — Maintenance
- ❌ `createProductAction()` — **NOT FOUND**

### 3. UI Analysis

**File:** `src/app/dashboard/real-estate/apartments/page.tsx`

**Functionality:**
- ✅ List products (filtered by project)
- ✅ Update product status (via modal)
- ✅ Matrix view / List view
- ❌ Create product button/modal — **NOT FOUND**

**Note:** UI has "Bulk Import" modal (demo data declaration), but NO production create flow.

---

## 📊 Impact Analysis

### P2.1 Test Requirements

**Baseline requirement:**
```text
P2.1: Production Write Flow (5 tests)
T1. Create product via ProductService
T2. Field semantics
T3. Reload/read-back
T4. Tenant injection
T5. Parent relationship
```

**Current state:**
```text
T1-T5: ❌ CANNOT EXECUTE (no create method)
```

### Products Evidence Status

**Before discovery:**
```text
Products evidence gap: 85-90%
├─ Database integrity: ✅ Verified
├─ Write flow: ❌ NOT TESTED
├─ RLS: ❌ NOT TESTED
└─ Browser runtime: ❌ NOT TESTED
```

**After discovery:**
```text
Products implementation status:
├─ Read: ✅ Implemented
├─ Update: ✅ Implemented
├─ Create: ❌ NOT IMPLEMENTED (RC BLOCKER)
└─ Delete: ⚪ Unknown

Classification: IMPLEMENTATION GAP / RC BLOCKER
Impact: P2.1 BLOCKED, cannot verify write flow
```

---

## 🎯 Decision Required

### Option A: Implement Product Create (Baseline Path)

**Scope:**
```text
1. Add ProductService.createProduct()
   ├─ Validate tenant_id required
   ├─ Validate project_id required
   ├─ Validate project ownership (Layer 5)
   ├─ Insert with tenant_id injection
   └─ Return created product

2. Add createProductAction()
   ├─ getCurrentUser() for auth
   ├─ Extract tenant_id from session
   ├─ Call ProductService.createProduct()
   └─ revalidatePath()

3. Update UI (optional for P2.1)
   ├─ Add create button
   ├─ Create modal
   └─ Form handling
```

**Timeline:** Implementation effort TBD (depends on schema/RLS requirements)

**Note:** Do NOT estimate as "~1.5 hours" - implementation may require:
- Service method + validation
- Server action + auth
- RLS policy verification/fixes
- UI components (optional for P2.1, required for P2.3)
- Tests verification

**Estimate after implementation plan complete.**

**Pros:**
- Completes capability
- Enables P2.1-P2.5 testing
- Follows Projects pattern

**Cons:**
- Adds new implementation before evidence
- May introduce bugs

---

### Option B: Test via Direct DB Insert (Workaround)

**Scope:**
```text
P2.1 tests use direct Supabase insert
├─ Test tenant isolation at DB level
├─ Test RLS enforcement
└─ Skip service/action layer testing
```

**Pros:**
- Can proceed with RLS testing (P2.2)
- No implementation needed

**Cons:**
- ❌ Violates baseline (P2.1 = production path test)
- ❌ Skips service layer verification
- ❌ Skips Layer 5 cross-entity validation
- ❌ Does not match Projects evidence standard

---

### Option C: Adjust RC Scope — Remove Products

**Rationale:**
- Products capability incomplete
- Cannot verify incomplete capability

**Impact:**
```text
Before: 4 capabilities (Projects, Products, Customers, Reservations)
After:  3 capabilities (Projects, Customers, Reservations)

Products removed from RC scope
Apartments feature documented as READ-ONLY
```

**Pros:**
- No implementation needed
- Clear scope reduction

**Cons:**
- RC scope reduced
- "Apartments" feature incomplete
- Business flow (Project → Product) broken

---

## 💡 Recommendation

**Option A: Implement Product Create (Full Vertical Slice)**

**Reasoning:**

1. **Baseline principle:**
   ```text
   "Fix implementation to meet baseline"
   NOT "Change baseline for implementation gaps"
   ```

2. **RC integrity:**
   - Baseline requires production write path
   - Cannot seal capability without write verification
   - Direct DB insert ≠ production path
   - This is IMPLEMENTATION GAP, not evidence gap

3. **Business completeness:**
   - Project → Product relationship critical
   - Read-only products = incomplete feature
   - Phase 5 integration requires create

4. **Evidence standard:**
   - Projects verified WITH write path
   - Products MUST match same standard
   - Consistency across capabilities

5. **Discovery validation:**
   - RC review working correctly
   - Projects: evidence gap (implementation exists, needs proof)
   - Products: implementation gap (capability missing)
   - Cannot bypass with DB insert and call it "evidence"

**Implementation scope (FULL vertical slice required):**

```text
UI Create Product
      ↓
createProductAction (server action)
      ↓
authenticated tenant context (getCurrentUser)
      ↓
ProductService.createProduct
      ↓
validate Project ownership (Layer 5 - MANDATORY)
      ↓
explicit tenant_id injection
      ↓
re_products INSERT
      ↓
RLS WITH CHECK enforcement
      ↓
read-back / UI refresh
```

**Layer 5 enforcement (NON-NEGOTIABLE):**

```text
Product.tenant_id = A
Product.project_id → Project.tenant_id = A   ✅ ALLOW

Product.tenant_id = A
Product.project_id → Project.tenant_id = B   ❌ REJECT

Caller-supplied tenant_id                    ❌ NEVER TRUST
```

**Implementation approach:**

```typescript
// src/modules/real_estate/services/ProductService.ts

static async createProduct(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  projectId: string,
  data: {
    product_code: string;
    product_type: 'apartment' | 'townhouse' | 'shophouse' | 'villa';
    status?: 'available' | 'booked' | 'deposited' | 'contracted' | 'paid';
    area?: number;
    unit_price?: number;
    block?: string | null;
    floor?: string | null;
  }
): Promise<ProductRow> {
  if (!tenantId) throw new Error('Tenant ID required');
  if (!projectId) throw new Error('Project ID required');
  
  // Layer 5: Verify project ownership
  const { data: project } = await supabase
    .from('real_estate_projects')
    .select('tenant_id')
    .eq('id', projectId)
    .eq('tenant_id', tenantId)
    .single();
    
  if (!project) {
    throw new Error('Project not found or access denied');
  }
  
  const { data: product, error } = await supabase
    .from('real_estate_products')
    .insert({
      tenant_id: tenantId,
      project_id: projectId,
      product_code: data.product_code,
      product_type: data.product_type,
      status: data.status || 'available',
      area: data.area,
      unit_price: data.unit_price,
      block: data.block,
      floor: data.floor,
    })
    .select()
    .single();
    
  if (error) throw error;
  return product;
}
```

**Timeline:**
1. Implement ProductService.createProduct (with Layer 5)
2. Implement createProductAction (with auth)
3. Verify RLS policies (may need WITH CHECK fix)
4. Add basic UI (optional for P2.1, required for P2.3)
5. Verify full vertical slice
6. **Estimate after plan review**

**Then:** Resume P2.1 testing with implemented create method.

---

## 📋 Next Steps

**If Option A approved:**

```text
SESSION 3 ADJUSTED PLAN:

1. Implement ProductService.createProduct
   └─ Include Layer 5 parent ownership check

2. Implement createProductAction
   └─ Follow Projects action pattern

3. Resume P2.1 (test with new implementation)
   └─ Run T1-T5 tests

4. Continue P2.2-P2.5 as planned
```

**Baseline unchanged:**
- Evidence standard: SAME
- Test requirements: SAME
- Gate progression: SAME
- Only implementation added to meet baseline

---

## 🔒 Compliance Check

**Baseline v1.0 rules followed:**

✅ **Rule 2: Test first, fix second**
- Attempted to test → discovered missing implementation
- Documenting before fixing

✅ **Rule 3: Evidence integrity**
- Discovery documented (not hidden)
- Blocker clearly stated

✅ **Rule 4: No architecture changes for green tests**
- Not bypassing with direct DB insert
- Not removing capability from scope
- Implementing to meet existing baseline

❌ **Rule 1 violation: "No discovery re-do"**
- Technically discovered implementation gap during P2.1
- NOT a re-discovery of architecture (that was P2.0)
- Implementation gap ≠ architecture discovery

**Verdict:** Blocker legitimate, remediation within baseline rules.

---

**Status:** 🔴 **P2.1 BLOCKED**  
**Blocker:** Product create not implemented  
**Recommendation:** Implement createProduct (Option A)  
**Timeline:** ~1.5 hours  
**Baseline:** Unchanged (implementation fix, not baseline change)

