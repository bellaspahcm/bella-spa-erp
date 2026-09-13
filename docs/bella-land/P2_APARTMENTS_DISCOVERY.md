# P2.0 Apartments Discovery — CRITICAL FINDING

**Phase:** P2 — Apartments  
**Date:** 2026-09-11  
**Status:** 🔴 **SCOPE REDEFINITION REQUIRED**

---

## 🔴 Critical Discovery

**"Apartments" trong Bella Land v2 KHÔNG phải bảng riêng.**

### Architecture Reality

```text
ASSUMPTION (initial):
real_estate_projects (1)
         ↓
real_estate_apartments (N)  ← DOES NOT EXIST
         ↓
real_estate_products (N)

REALITY (discovered):
real_estate_projects (1)
         ↓
real_estate_products (N)
         └── product_type: 'apartment' | 'townhouse' | 'shophouse' | 'villa' | ...
```

**"Apartments" là filtered view của `re_products` table**, không phải entity riêng.

---

## 📊 Evidence

### 1. Database Schema

**Search result:** No `real_estate_apartments` or `re_apartments` table exists

**Confirmed via:**
- Grep search across codebase: 0 matches
- File search for ApartmentService: Not found
- File search for apartmentActions: Not found

### 2. Type Definitions

**From `src/types/database.types.ts`:**

```typescript
product_type: "apartment" | "townhouse" | "shophouse" | "villa"
re_product_type: "apartment" | "townhouse" | "shophouse" | "villa"
```

**"apartment" is an enum value**, not a table name.

### 3. UI Implementation

**File:** `src/app/dashboard/real-estate/apartments/page.tsx`

```typescript
// Line 123
export default function RealEstateApartmentsPage() {
  
  // Uses fetchProductsAction, NOT fetchApartmentsAction
  const [products, setProducts] = useState<ProductRow[]>([]);
  
  // Filters by project, not by separate apartment entity
  const loadInitialData = useCallback(async () => {
    const resProjects = await fetchProjectsAction();
    const resProducts = await fetchProductsAction(projectId);
    // Then filters by product_type = 'apartment' in UI
  });
}
```

**Key observations:**
- Uses `ProductRow` type (from `re_products`)
- Calls `fetchProductsAction()` (not apartments-specific action)
- No ApartmentService layer
- UI filters products by `product_type`

### 4. Navigation References

**From Projects page:**

```typescript
// Line 541
onClick={() => { 
  window.location.href = `/dashboard/real-estate/apartments?projectId=${proj.id}`; 
}}
```

**Query param:** `projectId` — confirms apartments are filtered products under a project.

### 5. Service Layer

**Confirmed layers:**
- ✅ `ProjectService.ts` exists
- ✅ `ProductService.ts` exists
- ❌ `ApartmentService.ts` does NOT exist

**Actions:**
- ✅ `projectActions.ts` exists
- ✅ `productActions.ts` exists
- ❌ `apartmentActions.ts` does NOT exist

---

## 🏗️ Actual Data Model

### Entity Hierarchy

```text
┌─────────────────────────────────────┐
│ real_estate_projects                │
│ ├── id (PK)                         │
│ ├── tenant_id (FK → tenants)       │
│ ├── name                            │
│ └── status                          │
└────────────┬────────────────────────┘
             │ 1:N
             ↓
┌─────────────────────────────────────┐
│ real_estate_products                │
│ ├── id (PK)                         │
│ ├── project_id (FK → projects)     │
│ ├── tenant_id (FK → tenants)       │
│ ├── product_code                    │
│ ├── product_type ← 'apartment'     │  ← DISCRIMINATION FIELD
│ ├── block, floor, area             │
│ ├── unit_price                      │
│ └── status                          │
└─────────────────────────────────────┘
```

**Design pattern:** **Single Table Inheritance** (discriminated by `product_type`)

---

## 🔄 Scope Impact Analysis

### Original Plan (Assumption)

```text
Phase 1: Projects          (entity: real_estate_projects)
Phase 2: Apartments        (entity: real_estate_apartments) ← WRONG
Phase 3: Customers         (entity: re_customers)
Phase 4: Products          (entity: real_estate_products)
Phase 5: Reservations      (entity: re_reservations)
```

### Corrected Plan (Reality)

```text
Phase 1: Projects          ✅ SEALED
Phase 2: Products          ← ALREADY VERIFIED (includes all product_types)
Phase 3: Customers         🟡 PENDING
Phase 4: Reservations      ✅ VERIFIED

"Apartments" = Products filtered by product_type
```

---

## 📋 Products Verification Status

### Prior Work Evidence

**From context summary:**
> Phase 4: Products ✅ VERIFIED (prior work)

**Question:** Did prior Products verification include:
1. Write flow testing for `product_type = 'apartment'`?
2. Tenant isolation testing for products?
3. Parent-child relationship integrity (project_id)?
4. Cross-entity tenant integrity?

**Need to verify:** Product evidence quality matches Projects standard.

---

## 🎯 Decision Point

### Option A: Accept Products as "Apartments" ✅

**Rationale:**
- Products entity already verified (per context)
- "Apartments" is just a UI view filter
- No separate apartment entity exists
- Would make RC 80% complete immediately (4/5 → adjusted to 3/3 actual entities)

**Risks:**
- Products verification may not have covered:
  - `product_type` discrimination
  - Parent project relationship integrity
  - Cross-entity tenant isolation (product → project)
  - Browser runtime for apartment-specific flow

**Action:**
```text
1. Review Products prior verification evidence
2. Identify gaps vs. Projects standard
3. If gaps exist: targeted testing for those gaps only
4. If no gaps: mark Apartments ✅ (conceptually covered)
5. Adjust RC scope: Projects + Products + Customers (not 5 phases)
```

---

### Option B: Test "Apartments" as Products Subset ⚠️

**Rationale:**
- Verify product_type discrimination works
- Verify apartment-specific UI flow
- Verify parent relationship integrity
- Maintain evidence consistency

**Scope:**
```text
P2.1  Products Write Flow (apartment-specific)
      ├── Create product with product_type = 'apartment'
      ├── Verify parent project_id relationship
      ├── Verify tenant inheritance (product.tenant_id = project.tenant_id)
      └── 5 tests minimum

P2.2  Products Tenant Isolation (10 tests, apartment focus)
      ├── A1-A8: Standard RLS tests
      ├── A9: Cross-entity forgery (create under other tenant's project)
      └── A10: Cross-entity escape (move to other tenant's project)

P2.3  Browser Runtime (Apartments UI)
      ├── Manual test via /dashboard/real-estate/apartments
      ├── Create apartment (product) via UI
      └── Verify full path

P2.4  Regression
P2.5  Seal
```

**Risks:**
- May duplicate prior Products verification
- Adds time without new entity coverage
- But ensures consistent evidence standard

---

### Option C: Reframe RC Scope 🔄

**Rationale:**
- Original scope assumed 5 separate entities
- Reality is 3-4 entities (Projects, Products, Customers, Reservations)
- "Apartments" is Products filtered view
- Bella Land v2 RC should reflect actual architecture

**Revised scope:**
```text
BELLA LAND V2 — FULL CAPABILITIES RC
(Corrected Entity Model)

Core Entities:
1. Projects           🔒 SEALED
2. Products           ✅ VERIFIED (includes apartments)
3. Customers          🟡 PENDING
4. Reservations       ✅ VERIFIED

UI Views:
- /projects          → Projects entity
- /apartments        → Products (filtered by product_type)
- /customers         → Customers entity
- /reservations      → Reservations entity

RC Readiness: 75% (3/4 entities sealed)
```

**Action:**
```text
1. Verify Products evidence covers apartment scenarios
2. If yes: skip P2 entirely, move to Customers (P3)
3. If gaps: targeted gap closure only (not full phase)
4. Update RC tracker with corrected scope
```

---

## 🔍 Recommended Action

**OPTION C — Reframe + Verify Products Evidence**

**Reasoning:**
1. **Architectural truth:** Apartments = Products view, not separate entity
2. **Efficiency:** Don't duplicate Products verification
3. **Evidence integrity:** Verify Products covers apartment scenarios
4. **RC accuracy:** Scope should match actual architecture

**Next steps:**

```text
STEP 1: LOCATE PRODUCTS PRIOR VERIFICATION
├── Search for Products test scripts
├── Search for Products evidence documents
└── Identify what was verified

STEP 2: GAP ANALYSIS
├── Compare Products evidence vs. Projects standard
├── Check if product_type discrimination tested
├── Check if parent relationship (project_id) tested
├── Check if cross-entity tenant integrity tested
└── Document gaps

STEP 3: DECISION
├── IF no gaps → Mark Apartments ✅ (covered by Products)
├── IF minor gaps → Targeted gap tests only (not full P2)
├── IF major gaps → Full Products re-verification required
└── Update RC scope document

STEP 4: PROCEED
├── Either: Move to Customers (P3) immediately
├── Or: Close Products gaps first
└── Adjust RC % based on actual entity count (3-4, not 5)
```

---

## 🚨 Critical Invariants (Still Apply)

Even though "Apartments" = Products, **cross-entity tenant integrity still critical**:

```text
❌ MUST BLOCK:
Tenant A creates Product (apartment)
  ├── product.tenant_id = Tenant A  (valid)
  └── product.project_id = Project B (Tenant B)  ❌ VIOLATION

Tenant A moves Product A → Project B (Tenant B)  ❌ VIOLATION
```

**This MUST be verified**, either in:
- Prior Products verification (need to check)
- OR targeted gap test (if not covered)

---

## 📍 Status

```text
P2.0 Discovery                 ✅ COMPLETE
├── Confirmed: No apartments table
├── Confirmed: Apartments = Products view
└── Decision required: Reframe RC scope

P2.1-P2.5                      ⏸️ ON HOLD
├── Depends on Option A/B/C decision
└── May not be needed if Products covers it

NEXT ACTION                    → Review Products prior evidence
├── Locate Products test scripts/docs
├── Gap analysis vs. Projects standard
└── Decide Option A/B/C
```

---

**Discovery:** 🔴 **ARCHITECTURE MISMATCH DETECTED**  
**Impact:** 🟡 **RC SCOPE REDEFINITION REQUIRED**  
**Blocker:** ❌ **NONE** (decision needed, not technical block)  
**Next:** → **Locate & review Products prior verification evidence**

