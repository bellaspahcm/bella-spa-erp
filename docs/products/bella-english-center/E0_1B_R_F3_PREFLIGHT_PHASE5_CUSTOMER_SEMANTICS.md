# E0.1B-R F3 PREFLIGHT — PHASE 5: CUSTOMER SEMANTIC RECONCILIATION

**Phase:** 5/5 (FINAL)  
**Status:** ✅ **COMPLETE**  
**Date:** 2026-09-12

---

## OBJECTIVE

Determine `customer_id` semantic: **Identity proxy** vs **Commercial account aggregate**

**Decision Impact:** Determines if E0.1B-R needs customer→Party migration or just Contract implementation.

---

## EVIDENCE ANALYSIS

### 1. F3 Schema Evidence

**From Phase 1 findings:**

```sql
-- finance_invoices
customer_id UUID NOT NULL, -- Logical reference to vertical customer

-- finance_receivable_positions
customer_id UUID NOT NULL  -- Denormalized from invoice
```

**Characteristics:**
- ❌ NO FK constraint (not enforced by database)
- ❌ NO tenant scoping (not UNIQUE with tenant_id)
- ✅ Denormalized in positions (copied from invoice)
- ✅ Comment: "Logical reference to vertical customer"

**Interpretation:** F3 AR does NOT own customer entity. Expects Products to provide customer_id.

---

### 2. Test Evidence

**From Phase 3 findings:**

```typescript
// finance-f3-invoice-lifecycle.test.ts line 65
customerId = crypto.randomUUID();  // Just a UUID, no record created

// Line 119: Invoice creation
finance_create_draft_invoice(
  '${testTenantId}', 
  '${customerId}',  // ← UUID passed, no FK validation
  'INV-T01', 
  'VND', 
  '2026-08-15', 
  '2026-09-15'
)
```

**Observation:** Tests prove F3 accepts **any UUID** as customer_id. No customer record required.

**Conclusion:** customer_id is **Product-provided identifier**, NOT Platform-owned entity.

---

### 3. Legacy `customers` Table Evidence

**From Preflight investigation:**

```sql
-- supabase/migrations/20260511000000_initial_schema.sql
CREATE TABLE customers (
    id UUID PRIMARY KEY,
    phone TEXT UNIQUE NOT NULL,
    name_mother TEXT NOT NULL,
    name_baby TEXT,
    dob_baby DATE,
    dob_expected DATE,
    address TEXT,
    referrer_id UUID REFERENCES users(id),
    zalo_oa_id TEXT,
    status TEXT DEFAULT 'active',
    notes TEXT,
    tenant_id UUID REFERENCES tenants(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Characteristics:**
- ❌ NO `party_id` FK
- ❌ NO `person_id` FK
- 🟡 Phone-based identity (pre-Party system)
- 🟡 name_mother, name_baby (Bella Spa maternity context)

**Domain Context:** Bella Spa legacy CRM (maternity/baby care services)

**Verdict:** Legacy `customers` table is **pre-Party identity proxy** for Bella Spa domain only.

---

### 4. Real Estate Evidence

**From Preflight investigation:**

```typescript
// src/services/partner-actions.ts
party_parties:customer_id (
  id,
  display_name
)
```

**Schema evidence:**

```sql
-- supabase/migrations/20260811000000_migrate_owner_name_to_person_center.sql
ALTER TABLE real_estate_products 
ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES party_parties(id) ON DELETE SET NULL;
```

**Observation:** Real Estate uses `customer_id` field name but **references party_parties(id) directly**.

**Conclusion:** Real Estate reuses field name `customer_id` but semantic = Party (identity), NOT commercial account.

---

### 5. Preschool P71 Evidence

**From Preflight investigation:**

```sql
-- edu_fin_invoices (P71 Preschool)
student_id UUID NOT NULL,  -- Student entity (has party_id)
-- NO customer_id field

-- edu_fin_payments
payer_party_id UUID NOT NULL,  -- Party-native payment actor
```

**Observation:** Preschool P71 Finance does NOT use `customer_id` at all. Uses `student_id` + `payer_party_id` directly.

**Conclusion:** P71 bypassed `customers` table entirely, went Party-native.

---

## SEMANTIC CLASSIFICATION

### Hypothesis A: customer_id = Commercial Account Aggregate

**Pattern:**
```text
Party (identity)
  ↓ party_id FK
Customer (commercial account)
  ↓ customer_id FK
Invoice
```

**Evidence FOR:**
- ❌ NONE — No evidence of Customer as separate commercial lifecycle

**Evidence AGAINST:**
- ✅ Legacy `customers` table = identity proxy (phone, name)
- ✅ No account-specific fields (credit limit, payment terms, account status)
- ✅ No Party relationship (no party_id FK)

**Verdict:** ❌ REJECTED — customers is NOT commercial account aggregate

---

### Hypothesis B: customer_id = Party Identity (Direct Reference)

**Pattern:**
```text
Party (identity)
  ↓
Invoice (customer_id = party_id)
```

**Evidence FOR:**
- ✅ Real Estate uses `customer_id` referencing `party_parties(id)`
- ✅ F3 schema comment: "logical reference to vertical customer"
- ✅ No FK constraint (Products define semantic)

**Evidence AGAINST:**
- ⚠️ Legacy `customers` table exists (not Party)
- ⚠️ Legacy code may use `customers(id)` not `party_parties(id)`

**Verdict:** 🟡 PARTIALLY VALID — **Intended pattern**, but legacy `customers` creates ambiguity

---

### Hypothesis C: customer_id = Product-Specific Identifier

**Pattern:**
```text
Product Customer Entity (Product-owned)
  ↓
Invoice (customer_id = product_customer.id)
```

**Evidence FOR:**
- ✅ F3 schema: NO FK constraint (Product defines entity)
- ✅ Tests: arbitrary UUID accepted
- ✅ Comment: "vertical customer" (implies Product-specific)

**Evidence AGAINST:**
- ⚠️ No clear guidance on what "vertical customer" means
- ⚠️ Creates Product→Product coupling if not standardized

**Verdict:** 🟡 CURRENT STATE — F3 allows any UUID, no semantic enforcement

---

## RECONCILIATION DECISION

### Correct Architecture Pattern

**Target:**
```text
Party (P0 Canonical Identity)
  ↓
Product Customer Context (IF NEEDED)
  ↓ OR direct reference
Invoice (customer_id)
```

**Two valid approaches:**

#### Approach 1: Direct Party Reference (RECOMMENDED)

```sql
-- F3 invoice references Party directly
finance_invoices.customer_id → party_parties.id
```

**Pros:**
- Simplest pattern
- Party-native from day 1
- No intermediate customer entity
- Matches Preschool P71 pattern

**Cons:**
- Legacy `customers` table orphaned (needs migration)
- Breaks existing Bella Spa code (if any uses customers)

---

#### Approach 2: Customer→Party Mapping

```sql
-- Add FK to legacy customers table
customers.party_id → party_parties.id

-- F3 invoice continues using customer_id
finance_invoices.customer_id → customers.id
```

**Pros:**
- Preserves legacy `customers` table
- Gradual migration (customers gets Party FK)
- Bella Spa code continues working

**Cons:**
- Adds intermediate layer (Party → Customer → Invoice)
- Not Party-canonical (adds indirection)
- Increases complexity

---

### RECOMMENDATION

**Adopt Approach 1: Direct Party Reference**

**Rationale:**
1. Preschool P71 already uses Party-native pattern (payer_party_id)
2. Real Estate already uses Party directly (customer_id = party_id)
3. F3 AR schema already designed for "logical reference" (no FK)
4. Legacy `customers` is Bella Spa-specific (not Education domain)
5. English Center should use Party from day 1 (not inherit Bella Spa legacy)

**Implementation:**
```typescript
// F3 AR Contract
interface CreateInvoiceInput {
  tenantId: string;
  partyId: string;      // ← Party canonical identity
  invoiceNumber: string;
  currency: string;
  issueDate: string;
  dueDate: string;
}

// Engine maps to RPC
engine.createInvoice(input) {
  return finance_create_draft_invoice(
    input.tenantId,
    input.partyId,  // ← customer_id = partyId
    input.invoiceNumber,
    ...
  );
}
```

**F3 Schema Interpretation:**
- `finance_invoices.customer_id` = `party_parties.id` (logical FK)
- "Customer" in schema comments = **Party** (identity)
- No separate customer entity needed

---

### Legacy `customers` Table Disposition

**Status:** Bella Spa legacy CRM table (pre-Party)

**Action:** OUT OF E0.1B-R SCOPE

**Rationale:**
- `customers` table is Bella Spa domain-specific
- English Center does NOT use Bella Spa CRM
- E0.1B-R scope = Enable English Center Finance (not Bella Spa migration)

**Future Work:**
- Bella Spa Product may need `customers.party_id` migration (separate remediation)
- E0.1B-R establishes pattern: F3 AR uses Party identity

---

## PHASE 5 EXIT CRITERIA

**PASS:**
- [x] customer_id semantic classified: **Product-provided Party identifier**
- [x] Architecture pattern decided: **Direct Party Reference**
- [x] Legacy `customers` disposition: **OUT OF SCOPE** (Bella Spa-specific)
- [x] F3 Contract design locked: **partyId input parameter**
- [x] No customer→Party migration required for E0.1B-R

**BLOCK:** None

---

## F3 AR CONTRACT IDENTITY DESIGN

### Input Parameters

**CreateInvoice:**
```typescript
{
  tenantId: string;
  partyId: string;        // ← Party canonical identity (maps to customer_id)
  invoiceNumber: string;
  currency: string;
  issueDate: string;
  dueDate: string;
}
```

**AddInvoiceLine:**
```typescript
{
  tenantId: string;
  invoiceId: string;
  serviceId?: string;
  description: string;
  quantity: number;
  unitPriceMinor: number;
  taxRate: number;
  revenueAccountCode: string;
}
```

**No customer entity required** — partyId is sufficient.

---

## PREFLIGHT COMPLETE

**All 5 phases complete:**
1. ✅ F3 Schema Reconciliation
2. ✅ F3 RPC Reconciliation
3. ✅ F3 Test Reconciliation
4. ✅ Single Writer Ownership Verification
5. ✅ Customer Semantic Reconciliation

**Key Findings:**
- F3 AR schema operational (6 tables, 4 RPCs, 24 tests)
- customer_id = Party identifier (Product-provided)
- Single Writer ownership established
- F1 GL required dependency
- F2 Cash partial integration (allocation missing)
- Contract/Engine layer missing (E0.1B-R work)

**Next Step:** R0 F3 Baseline Assessment → Lock capability inventory, proceed Contract/Engine implementation

---

**Phase 5 complete. Preflight COMPLETE. Ready for R0 Baseline Assessment.**
