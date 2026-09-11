# C3.0: Customers Discovery — COMPLETE

**Status:** 🔒 CLOSED  
**Date:** 2026-09-11  
**Session:** 8  
**Phase:** Phase 3 — Customers Evidence Closure

---

## Purpose

Elicit requirements, define scope, and establish test approach for Customers capability evidence closure in Bella Land v2 RC.

---

## Entity Analysis

### Table: `re_customers`

**Location:** `supabase/migrations/20260802150000_real_estate_core_schema.sql`

**Schema:**
```sql
CREATE TABLE IF NOT EXISTS re_customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  
  -- Customer360 extended info
  family_members JSONB DEFAULT '[]'::jsonb,
  co_owners JSONB DEFAULT '[]'::jsonb,
  investment_profile JSONB,
  tags TEXT[] DEFAULT '{}',
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID,
  updated_by UUID,
  deleted_at TIMESTAMPTZ,
  
  CONSTRAINT unique_phone_per_tenant UNIQUE (tenant_id, phone)
);
```

---

## Relationship Analysis

### Parent Relationships
**NONE — Customers is a root entity**

Customers has:
- ✅ `tenant_id` (NOT NULL)
- ❌ NO foreign key to `tenants` table
- ❌ NO parent project/product relationship
- ❌ NO composite FK to any parent entity

### Child Relationships
Customers is referenced by:
1. **`re_reservations.customer_id`** → FK to `re_customers(id)`
2. **`re_bookings.customer_id`** → FK to `re_customers(id)`
3. **`re_contracts.customer_id`** → FK to `re_customers(id)`
4. **`re_transactions.customer_id`** → FK to `re_customers(id)`

---

## Layer 5 Requirement Assessment

### Question: Does Customers need Layer 5 composite FK enforcement?

**ANSWER: ❌ NO (at C3 capability level)**

**Rationale:**
1. **No parent entity ownership:** Customers is a root entity, not owned by Project or Product
2. **Domain semantics:** Customers exist independently; they CAN be interested in multiple projects/products
3. **Business logic:** A customer in Tenant A can inquire about different projects within same tenant
4. **Comparison to Products:**
   - Products belong to a specific Project (parent ownership)
   - Products need Layer 5: `FOREIGN KEY (project_id, tenant_id) REFERENCES real_estate_projects(id, tenant_id)`
   - Customers do NOT have such parent ownership

**Classification:** **Customers = Tenant-Scoped Root Aggregate**

---

### Layer 5 Scope Boundary

**C3 Capability Level:**
- ❌ NO local parent FK check (no composite FK needed)
- ✅ Standard RLS only (Layers 1-4)

**Phase 5 Integration Level:**
- ✅ REQUIRED: Cross-entity Customer ↔ Reservation linkage verification
- ✅ REQUIRED: Tenant consistency across Reservation → Customer → Product → Project chain

**Evidence Chain:**
```
C3.2: Customers RLS (tenant isolation)  → VERIFIED at C3
Phase 5: Reservation → Customer tenant match → VERIFY at Phase 5
```

**Note:** Customer-Reservation tenant invariant is NOT re-opened in C3; it belongs to Phase 5 integration testing.

---

## Security Model

### Required Layers

**Layers 1-4: Standard RLS (Tenant Isolation)**
- ✅ Row-level security ENABLED
- ❌ Policies NOT YET DEFINED (critical gap!)
- ✅ Application layer enforces `.eq('tenant_id', user.tenant_id)`

**Layer 5: Cross-Entity Integrity**
- ❌ NOT APPLICABLE (no parent ownership)

### Current RLS Status

**Schema Status:**
```sql
ALTER TABLE re_customers ENABLE ROW LEVEL SECURITY;
-- ⚠️ NO POLICIES DEFINED YET
```

**Critical Gap:** RLS enabled but no policies = **ALL operations blocked for authenticated users!**

**Required Policies:**
1. SELECT: Own-tenant read
2. INSERT: Own-tenant create (WITH CHECK on tenant_id)
3. UPDATE: Own-tenant update (USING + WITH CHECK)
4. DELETE: Own-tenant soft delete (or hard delete if allowed)

---

## Current Implementation

### Action Layer
**File:** `src/modules/real_estate/actions/customerActions.ts`

**Available Actions:**
1. `createCustomerAction(dto)` — Create customer
2. `fetchCustomersAction()` — List customers
3. `updateCustomerAction(id, updates)` — Update customer
4. `deleteCustomerAction(id)` — Soft delete

**Tenant Injection:**
- ✅ Automatic via `user.tenant_id` from session
- ✅ Explicit `.eq('tenant_id', user.tenant_id)` in queries
- ✅ Auth check: `if (!user) return unauthorized`

**Validation:**
- ✅ Required fields: `name`, `phone`
- ✅ Unique constraint: `(tenant_id, phone)` enforced at DB level
- ✅ Error handling: Unique violation returns user-friendly message

### UI Layer
**Status:** ❌ NOT IMPLEMENTED

**Expected Location:** `src/app/dashboard/real-estate/customers/page.tsx`

**Required Components:**
- Customer list view
- Create customer modal/form
- Update customer capability
- Soft delete capability

---

## Scope Definition

### In Scope (C3.1 - C3.5)

**C3.1: Customers Write Flow (~5 gates)**
- Create customer via action → Supabase
- Field semantics validation
- Tenant injection verification
- Read-back verification
- Unique constraint enforcement

**C3.2: Authenticated Security (~8-10 gates)**
- Own-tenant create
- Own-tenant read
- Cross-tenant read blocked
- Cross-tenant update blocked
- Cross-tenant delete blocked
- Tenant forgery blocked (INSERT WITH CHECK)
- Tenant escape blocked (UPDATE WITH CHECK)
- No query leakage
- *(NO Layer 5 gates — not applicable)*

**C3.3: Browser Production Runtime (~10 gates)**
- Navigate to customers page
- Open create customer modal
- Fill form (name, phone, email)
- Client-side validation
- Form submission
- Success feedback
- Customer appears in list
- Tenant context maintained
- Browser console clean
- Independent DB verification

**C3.4: Full Regression (~15-20 tests)**
- C3.1 write flow regression
- C3.2 security regression
- Read/update flow tests
- Browser smoke test

**C3.5: Customers Seal**
- Freeze all evidence
- Document complete chain
- Mark Customers 🔒 CLOSED

### Out of Scope

- ❌ Customer details page (not required for RC)
- ❌ Customer-product relationship management (handled by Reservations)
- ❌ Customer search/filtering (basic list only)
- ❌ Customer merge/dedupe (not in scope)
- ❌ Customer import/export (not in scope)

---

## Critical Gaps Identified

### GAP 1: Missing RLS Policies ⚠️ BLOCKING

**Current State:**
```sql
ALTER TABLE re_customers ENABLE ROW LEVEL SECURITY;
-- NO POLICIES DEFINED
```

**Impact:** With RLS enabled but no policies, **authenticated users cannot access re_customers at all**. Application layer `.eq('tenant_id', ...)` is NOT sufficient when RLS is enabled.

**Required Fix:**
```sql
-- Read policy
CREATE POLICY "re_customers_tenant_read"
  ON re_customers
  FOR SELECT
  TO authenticated
  USING (
    tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid())
  );

-- Write policy
CREATE POLICY "re_customers_tenant_write"
  ON re_customers
  FOR ALL
  TO authenticated
  USING (
    tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid())
  )
  WITH CHECK (
    tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid())
  );
```

**Priority:** 🔴 P0 — Must fix before C3.1 testing

---

### GAP 2: Missing UI ⚠️ BLOCKING P2.3

**Current State:** No UI page at `/dashboard/real-estate/customers`

**Required:** 
- Customer list page
- Create customer form/modal
- Basic CRUD operations

**Priority:** 🟡 P1 — Required for C3.3 Browser Runtime

---

### GAP 3: Missing tenant_id FK

**Current State:** `tenant_id UUID NOT NULL` with no FK constraint

**Expected:** `tenant_id UUID NOT NULL REFERENCES tenants(id)`

**Impact:** Data integrity risk (orphaned customers if tenant deleted)

**Priority:** 🟢 P2 — Nice to have, not blocking

---

## Test Approach

### Methodology
**Gate-based evidence (not averaging)**

Same approach as Projects and Products:
1. Write test scripts for automated verification
2. Manual browser testing for UI flows
3. Independent DB queries for verification
4. Binary PASS/FAIL per gate
5. Full regression after browser implementation

### Test Tenants
Reuse existing load test tenants:
- **Tenant A:** K6 Load Test — Real Estate (`1a6643da...`)
- **Tenant B:** K6 Load Test — Healthcare (`60135a61...`)

### Test Scripts (to be created)
1. `scripts/bella-land/test-customer-creation.ts` — C3.1 write flow
2. `scripts/bella-land/test-customer-authenticated-security.ts` — C3.2 RLS
3. `scripts/bella-land/test-customer-read-update.ts` — C3.4 regression
4. `scripts/bella-land/verify-c3-3-customer.ts` — C3.3 DB verification

---

## Dependencies

### Immediate Blockers
1. ✅ Schema exists (`re_customers` table)
2. ✅ Actions implemented (`customerActions.ts`)
3. ❌ **RLS policies MISSING** → Must create before C3.1
4. ❌ **UI page MISSING** → Must create before C3.3

### No External Dependencies
- ❌ No Layer 5 required (no parent ownership)
- ❌ No new migrations needed (schema complete)
- ❌ No service layer gaps (actions sufficient)

---

## Estimated Effort

| Phase | Gates | Scripts | UI | Estimated |
|-------|-------|---------|----|----|
| C3.1 Write Flow | 5 | 1 | No | 30 min |
| C3.2 Security | 8 | 1 | No | 45 min |
| C3.3 Browser | 10 | 1 | **YES** | 90 min |
| C3.4 Regression | 15 | 1 | No | 30 min |
| C3.5 Seal | — | — | No | 15 min |
| **TOTAL** | **~38** | **4** | **1 page** | **~3.5 hours** |

---

## Risk Assessment

### Low Risk
✅ Schema complete and stable  
✅ Actions already implemented  
✅ No Layer 5 complexity  
✅ Simpler than Products (no parent ownership)

### Medium Risk
⚠️ RLS policies missing (critical for C3.1)  
⚠️ UI missing (required for C3.3)

### Mitigation
- Fix RLS policies immediately (before C3.1)
- Create UI page before C3.3 execution
- Reuse Projects/Products UI patterns

---

## Success Criteria

**C3.5 Customers Seal:**
- ✅ All ~38 gates PASS
- ✅ RLS policies implemented and verified
- ✅ UI page functional (create, list, update)
- ✅ Full regression PASS
- ✅ Zero open defects
- ✅ Complete audit trail

**Then:** Customers 🔒 CLOSED

---

## Next Steps

### Immediate (Session 8)

**Step 1: Fix RLS Policies (P0)**
- Create migration: `20260911010000_add_re_customers_rls_policies.sql`
- Define read policy (SELECT)
- Define write policy (INSERT/UPDATE/DELETE with WITH CHECK)
- Apply migration
- Verify policies active

**Step 2: C3.1 Write Flow Testing**
- Create `test-customer-creation.ts`
- Execute C3.1 gates (5/5)
- Document evidence

**Step 3: C3.2 Security Testing**
- Create `test-customer-authenticated-security.ts`
- Execute C3.2 gates (~8/8)
- Verify RLS enforcement
- Document evidence

### Session 9

**Step 4: C3.3 Browser Runtime**
- Create UI page: `src/app/dashboard/real-estate/customers/page.tsx`
- Implement create customer form
- Deploy to Vercel preview
- Execute C3.3 gates (10/10)
- Document evidence

**Step 5: C3.4 Regression**
- Create `test-customer-read-update.ts`
- Rerun C3.1, C3.2
- Execute read/update tests
- Browser smoke test
- Document regression results

**Step 6: C3.5 Customers Seal**
- Freeze evidence
- Document complete chain
- Mark Customers 🔒 CLOSED

---

## Comparison to Products

| Aspect | Products | Customers |
|--------|----------|-----------|
| Parent ownership | ✅ YES (belongs to Project) | ❌ NO (root entity) |
| Layer 5 needed | ✅ YES (composite FK) | ❌ NO |
| RLS complexity | Standard + Layer 5 | Standard only |
| Total gates | 35 | ~38 |
| UI complexity | Medium | Simple |
| Test effort | High | Medium |

**Key Difference:** Customers is simpler (no Layer 5), but still requires full RLS + browser evidence.

---

## Discovery Conclusion

**Customers entity:**
- ✅ Schema complete (`re_customers`)
- ✅ Actions implemented
- ❌ RLS policies MISSING (critical)
- ❌ UI MISSING (required for C3.3)
- ❌ NO Layer 5 required (root entity)

**Classification:** **Tenant-Scoped Root Aggregate (Standard RLS only)**

**Estimated gates:** ~38 (5 + 8 + 10 + 15)

**Ready to proceed:** After fixing RLS policies

---

**C3.0 Discovery: 🔒 CLOSED**

Next: Fix RLS policies → C3.1 Write Flow Testing

---

_End of C3.0 Customers Discovery_
