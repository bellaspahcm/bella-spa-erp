# C3.4 — Canonical Customer Lifecycle Verdict

**Date:** 2026-09-11  
**Session:** 11  
**Phase:** Canonical Lifecycle Check (Step 1 of C3.4)

---

## 🔍 Investigation Summary

Inspected 4 evidence sources to determine canonical customer lifecycle:

1. ✅ **customerActions.ts** — Server actions
2. ✅ **Database schema** — `re_customers` table
3. ✅ **Production UI** — customers page implementation
4. ❌ **CustomerService.ts** — does not exist (actions used directly)

---

## 📋 Evidence Collected

### Source 1: customerActions.ts

**Location:** `src/modules/real_estate/actions/customerActions.ts`

**Operations Found:**

```typescript
✅ createCustomerAction(dto: CreateCustomerDTO)
   - Creates new customer
   - Tenant isolation via user.tenant_id
   - Validates name + phone required
   - Unique constraint: phone per tenant

✅ fetchCustomersAction()
   - Fetches all customers for tenant
   - Filters: .is('deleted_at', null) ← SOFT DELETE FILTER
   - Orders by created_at descending

✅ updateCustomerAction(customerId, updates)
   - Updates customer fields (name, phone, email)
   - Tenant isolation enforced
   - Sets updated_by + updated_at

✅ deleteCustomerAction(customerId)
   - SOFT DELETE implementation
   - Sets deleted_at timestamp
   - Does NOT physically delete row
   - Tenant isolation enforced
```

### Source 2: Database Schema

**Location:** `supabase/migrations/20260802150000_real_estate_core_schema.sql`

**Table Structure:**

```sql
CREATE TABLE IF NOT EXISTS re_customers (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  
  -- Extended fields
  family_members JSONB,
  co_owners JSONB,
  investment_profile JSONB,
  tags TEXT[],
  metadata JSONB,
  
  -- Audit fields
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID,
  updated_by UUID,
  deleted_at TIMESTAMPTZ,  ← SOFT DELETE FIELD
  
  CONSTRAINT unique_phone_per_tenant UNIQUE (tenant_id, phone)
);

CREATE INDEX idx_re_customers_deleted ON re_customers(deleted_at);
```

**Key Findings:**
- ✅ `deleted_at` field exists (TIMESTAMPTZ nullable)
- ✅ Index on `deleted_at` for efficient filtering
- ❌ NO `status` field (Active/Inactive/Archived)
- ❌ NO `archived_at` field
- ❌ NO `is_active` boolean

### Source 3: Production UI

**Location:** `src/app/dashboard/real-estate/customers/page.tsx`

**UI Operations:**
```typescript
✅ Create customer modal (uses createCustomerAction)
✅ Fetch customers list (uses fetchCustomersAction)
✅ Display customer details
❓ Update operation UI — not visible in loaded portion
❓ Delete operation UI — not visible in loaded portion
```

**Note:** UI uses mock data (`CUSTOMER_DATA`) for display, real data loaded via `fetchCustomersAction()` counted separately.

### Source 4: CustomerService

**Status:** ❌ Does not exist

Actions layer is used directly without service layer abstraction.

---

## ✅ CANONICAL LIFECYCLE VERDICT

### Operations Found in Evidence

```
CREATE       ✅ CANONICAL — createCustomerAction
READ         ✅ CANONICAL — fetchCustomersAction
UPDATE       ✅ CANONICAL — updateCustomerAction
SOFT DELETE  ✅ CANONICAL — deleteCustomerAction (sets deleted_at)
```

### Operations NOT Found

```
HARD DELETE  ❌ NOT EXPOSED
ARCHIVE      ❌ NOT FOUND
STATUS FLOW  ❌ NOT FOUND
RESTORE      ❌ NOT FOUND
```

### Canonical Pattern Observed

```
deleted_at field present in schema
fetchCustomersAction filters: .is('deleted_at', null)
deleteCustomerAction sets: deleted_at = timestamp
```

---

## 🔒 C3.4 EXACT REGRESSION MATRIX

### Group 1: C3.1 Write Flow Regression (5 gates)
| Gate | Test | Must PASS |
|------|------|-----------|
| W1 | Create customer service-role | ✓ |
| W2 | Field semantics validation | ✓ |
| W3 | Reload/read-back | ✓ |
| W4 | Tenant injection | ✓ |
| W5 | Error handling | ✓ |

**Script:** `test-customer-creation.ts` (rerun)

### Group 2: C3.2 Security Regression (9 gates)
| Gate | Test | Must PASS |
|------|------|-----------|
| A1 | Own-tenant create | ✓ |
| A2 | Own-tenant read | ✓ |
| A3 | Own-tenant update | ✓ |
| A4 | Cross-tenant read blocked | ✓ |
| A5 | Cross-tenant update blocked | ✓ |
| A6 | Cross-tenant delete blocked | ✓ |
| A7 | Tenant forgery create | ✓ |
| A8 | Tenant forgery update | ✓ |
| A9 | No query leakage | ✓ |

**Script:** `test-customer-authenticated-security.ts` (rerun)

### Group 3: Read Operations (4 gates)
| Gate | Test | Must PASS |
|------|------|-----------|
| R1 | Fetch customer list (own tenant) | ✓ |
| R2 | Deleted customers excluded from list | ✓ |
| R3 | List returns only own-tenant | ✓ |
| R4 | Empty result for tenant with no customers | ✓ |

**Script:** `test-customer-read-operations.ts` (new)

### Group 4: Update Operations (5 gates)
| Gate | Test | Must PASS |
|------|------|-----------|
| U1 | Update customer name | ✓ |
| U2 | Update customer phone | ✓ |
| U3 | Update customer email | ✓ |
| U4 | Update sets updated_by/updated_at | ✓ |
| U5 | Cannot update other tenant's customer | ✓ |

**Script:** `test-customer-update-operations.ts` (new)

### Group 5: Soft Delete Operations (4 gates)
| Gate | Test | Must PASS |
|------|------|-----------|
| D1 | Soft delete sets deleted_at | ✓ |
| D2 | Deleted customer excluded from fetch | ✓ |
| D3 | Row still exists in database | ✓ |
| D4 | Cannot delete other tenant's customer | ✓ |

**Script:** `test-customer-delete-operations.ts` (new)

---

## 📊 C3.4 SCOPE FROZEN

```
Group 1: C3.1 Regression      5 gates
Group 2: C3.2 Regression      9 gates
Group 3: Read Operations      4 gates
Group 4: Update Operations    5 gates
Group 5: Soft Delete Ops      4 gates
───────────────────────────────────────
TOTAL C3.4:                  27 gates
```

**All 27 gates must PASS. No partial acceptance.**

---

## 🚫 Out of Scope

The following operations are NOT in canonical design and MUST NOT be tested:

- ❌ Physical delete (hard delete from database)
- ❌ Archive operation (no canonical support)
- ❌ Status-based lifecycle (no status field exists)
- ❌ Bulk operations (not in canonical design)
- ❌ Restore deleted customers (no restore operation exists)

---

## ✅ Canonical Pattern Confirmed

**Evidence-based findings only:**
- `deleted_at` field exists in schema
- Actions use `deleted_at` for soft delete
- Fetch queries filter `deleted_at IS NULL`
- No hard delete operation exposed

---

## ⏭️ Next Step: Regression Execution

With scope frozen, proceed to:
1. Create test scripts for read/update/soft-delete
2. Execute full regression (C3.1 + C3.2 + new operations)
3. Browser smoke tests
4. Document results
5. C3.4 verification

---

**Canonical Lifecycle Check: ✅ COMPLETE**  
**C3.4 Scope: 🔒 FROZEN (27 gates exact)**  
**Ready: Test script creation + regression execution**

