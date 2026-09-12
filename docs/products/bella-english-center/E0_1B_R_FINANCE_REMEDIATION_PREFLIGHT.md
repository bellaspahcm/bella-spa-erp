# E0.1B-R FINANCE REMEDIATION — PREFLIGHT RECONNAISSANCE

**Remediation ID:** E0.1B-R  
**Status:** 🔴 **PREFLIGHT**  
**Date Started:** 2026-09-12

---

## MISSION

**Objective:** Decouple Platform Finance (F3 Accounts Receivable) from legacy Person identity, establish Party as canonical identity for AR operations.

**Context:** E0.1A-R Identity remediation established pattern (Person → Party). E0.1B-R applies same pattern to Finance domain.

**Critical Path Position:**
```text
E0.1A-R Identity        🔒 CLOSED
E0.1B-R Finance         🔴 IN PROGRESS  ← CURRENT
E1 Readiness Gate       🚫 BLOCKED (waiting E0.1B-R)
E1 Chain Management     🚫 BLOCKED
```

---

## PREFLIGHT OBJECTIVES

**NOT Discovery:** E0 Foundation already defined F3 ownership and scope.

**VERIFY ACTUAL STATE:**
1. F3 Accounts Receivable schema (tables, FKs, current Person dependencies)
2. F3 Contract interface (methods, parameters, Person vs Party)
3. F3 Engine implementation (writers, Person usage paths)
4. English Center Finance integration (caller patterns)
5. Test coverage (fixtures, Person dependencies)

**AVOID:** Architectural speculation, premature execution plans

**GOAL:** Lock denominator before migration (same pattern as R0 Baseline)

---

## PREFLIGHT VERIFICATION CHECKLIST

### 1. Schema Reconnaissance

**Target:** `src/platform/finance/schema/`

**Verify:**
- [ ] F3 AR tables exist (`fin_invoices`, `fin_payments`, `fin_transactions`?)
- [ ] Person FK columns identified (`person_id`, `customer_id`, `payer_id`?)
- [ ] Party FK columns status (exist? canonical? backfill?)
- [ ] RLS policies (tenant isolation intact?)
- [ ] Current migration state

**Evidence Required:** Actual schema files, not assumptions

---

### 2. Contract Reconnaissance

**Target:** `src/platform/finance/contracts/`

**Verify:**
- [ ] F3 AR Contract interface exists
- [ ] Contract methods (invoice creation, payment recording, etc.)
- [ ] Input/output types (Person vs Party parameters)
- [ ] Public contract boundary compliance
- [ ] Contract implementation file location

**Evidence Required:** Actual contract code

---

### 3. Engine Reconnaissance

**Target:** `src/platform/finance/engines/`

**Verify:**
- [ ] F3 Engine implementation exists
- [ ] Person write paths (create/update operations)
- [ ] Party support status (partial? none? complete?)
- [ ] Service/repository layer structure
- [ ] Current Person usage count

**Evidence Required:** Actual engine code paths

---

### 4. Integration Reconnaissance

**Target:** `src/products/bella-english-center/`

**Verify:**
- [ ] English Center Finance integration points
- [ ] Caller patterns (direct Person? Contract-based?)
- [ ] Invoice/payment creation flows
- [ ] Student billing integration
- [ ] Person vs Party usage

**Evidence Required:** Actual product integration code

---

### 5. Test Reconnaissance

**Target:** `src/platform/finance/__tests__/`, `tests/platform/finance/`

**Verify:**
- [ ] F3 test coverage exists
- [ ] Test fixture patterns (Person-based?)
- [ ] Integration tests (contract/engine)
- [ ] E2E scenarios
- [ ] Person dependency count in tests

**Evidence Required:** Actual test files

---

## PREFLIGHT EXECUTION PLAN

### Phase 1: Schema Verification (5 min)

```bash
# Verify F3 schema files exist
ls src/platform/finance/schema/

# Search for Person FK columns
grep -r "person_id" src/platform/finance/schema/
grep -r "party_id" src/platform/finance/schema/
```

---

### Phase 2: Contract Verification (5 min)

```bash
# Verify F3 contract interface
ls src/platform/finance/contracts/

# Check Person vs Party parameters
grep -r "personId\|partyId" src/platform/finance/contracts/
```

---

### Phase 3: Engine Verification (10 min)

```bash
# Verify F3 engine structure
ls src/platform/finance/engines/

# Check Person usage
grep -r "PersonService\|person_id" src/platform/finance/engines/
```

---

### Phase 4: Integration Verification (5 min)

```bash
# Verify English Center Finance integration
grep -r "invoice\|payment" src/products/bella-english-center/
```

---

### Phase 5: Test Verification (5 min)

```bash
# Verify F3 test coverage
ls src/platform/finance/__tests__/
ls tests/platform/finance/

# Check test Person dependencies
grep -r "PersonService\.createPerson" src/platform/finance/**/*.test.ts
```

---

## PREFLIGHT EXIT CRITERIA

**PASS:**
- [ ] All 5 reconnaissance areas verified with ACTUAL code evidence
- [ ] Person dependency count locked (denominator known)
- [ ] Current schema/contract/engine state documented
- [ ] Gap analysis complete (what exists vs what E0.1B requires)
- [ ] Execution plan lockable (phases R0-R7 scoped)

**BLOCK:**
- [ ] F3 implementation not found
- [ ] Schema fundamentally different from assumptions
- [ ] Person dependencies unknown/unbounded
- [ ] Contract layer missing/incomplete

---

## PREFLIGHT STATUS

**Started:** 2026-09-12  
**Current Phase:** Schema Verification COMPLETE  
**Status:** 🔴 **CRITICAL FINDING**

---

## CRITICAL FINDING: Finance Already Uses Party (Not Person)

### Schema Evidence

**P71 Preschool Finance Migration (`20260909000058_p71_preschool_finance.sql`):**

```sql
-- edu_fin_payments table (line 96-113)
CREATE TABLE IF NOT EXISTS public.edu_fin_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id),
    payer_party_id UUID NOT NULL,  -- ✅ PARTY (NOT person_id)
    student_id UUID NOT NULL,
    payment_number VARCHAR(100) NOT NULL,
    ...
);

-- edu_fin_reconciliation_ledger (line 116-126)
CREATE TABLE IF NOT EXISTS public.edu_fin_reconciliation_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id),
    payment_id UUID NOT NULL REFERENCES public.edu_fin_payments(id),
    invoice_id UUID NOT NULL REFERENCES public.edu_fin_invoices(id),
    allocated_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    allocation_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reconciled_by_party_id UUID NOT NULL,  -- ✅ PARTY (NOT person_id)
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Key Tables

| Table | Party FK | Person FK | Status |
|-------|----------|-----------|--------|
| `edu_fin_payments` | `payer_party_id` ✅ | None | Party-native |
| `edu_fin_reconciliation_ledger` | `reconciled_by_party_id` ✅ | None | Party-native |
| `edu_fin_invoices` | None | None | Uses `customer_id` |

**Invoice Table Note:** `edu_fin_invoices` uses `customer_id` (NOT `person_id` or `party_id`). Need to verify `customers` table identity system.

---

## ARCHITECTURAL VERDICT

**E0.1B-R Finance Remediation MAY NOT BE REQUIRED.**

**Reason:** Finance schema already designed with Party canonical identity (no Person dependencies found).

**Next Investigation:**
1. Verify `customers` table references (`person_id` or `party_id`?)
2. Verify F3 Contract interface (Party-based or Person-based?)
3. Verify F3 Engine implementation (Party usage?)
4. Determine if E0.1B-R scope is:
   - **NULL** (no remediation needed, Finance already Party-based)
   - **MINIMAL** (customers table migration only)
   - **CONTRACT-ONLY** (schema correct, contracts need Party parameters)

---

## NEXT STEPS AFTER PREFLIGHT

**If PASS:**
1. Create E0.1B-R execution plan (R0-R7 phases)
2. Lock denominator (exact Person dependency count)
3. Begin R0 Finance Baseline
4. Execute remediation (same pattern as E0.1A-R)

**If BLOCK:**
1. Document gaps
2. Escalate to Architecture Team
3. Resolve blockers before proceeding

---

**Preflight started. Verifying actual F3 state before locking execution plan.**


## PREFLIGHT EVIDENCE (INCOMPLETE)

**Status:** 🟡 **IN PROGRESS** (3 layers need reconciliation)

---

### Evidence Layer 1: Payment Actor Identity ✅

**Confirmed:**
```sql
edu_fin_payments.payer_party_id UUID NOT NULL        ✅ Party-native
edu_fin_reconciliation_ledger.reconciled_by_party_id ✅ Party-native
```

**Verdict:** Payment/reconciliation actor paths use Party canonical identity.

---

### Evidence Layer 2: Invoice Commercial Counterparty 🟡

**Observed:**
```sql
edu_fin_invoices.customer_id UUID NOT NULL
    ↓
References: customers(id)  -- legacy CRM table
    ↓
customers table schema:
  - id UUID PRIMARY KEY
  - phone TEXT UNIQUE NOT NULL
  - name_mother TEXT
  - NO party_id FK observed ❌
  - NO person_id FK observed ❌
```

**Unresolved Questions:**
1. **Customer semantics:** Is `customers` an identity (Person/Org proxy) or a commercial account aggregate?
2. **Party linkage:** Does code elsewhere create customer→Party mappings?
3. **Invoice ownership:** Does `edu_fin_invoices` belong to Platform F3 or Preschool Product P71?
4. **Customer lifecycle:** Who creates customers? Who owns customer-party relationship?

**Cannot conclude:** Customer migration scope unknown until semantics reconciled.

---

### Evidence Layer 3: F3 AR Contract/Engine 🟡

**E0 Foundation claim:**
> Platform Finance → F3 Accounts Receivable Contract → Invoice/Payment canonical operations

**Preflight findings:**
- ✅ `edu_fin_*` schema exists (8 tables, Party-native payment actors)
- 🟡 F3 Contract interface: NOT FOUND in `src/platform/finance/contracts/`
- 🟡 F3 Engine: NOT FOUND in `src/platform/finance/engines/` (only Cash/Ledger engines exist)
- ❌ F3 Invoice Contract: NO evidence of Platform F3 AR contract exporting invoice operations
- ❌ F3 AR Engine: NO evidence of F3.2 Invoice engine implementation

**Found instead:**
- Cash Engine contract + implementation ✅
- Ledger Engine contract + implementation ✅
- F3 invoice lifecycle RPCs (DB-level, `finance_create_draft_invoice()`)
- F3 invoice lifecycle tests (integration test calling RPCs directly)

**Critical gap:** Platform F3 AR **Contract/Engine layer may not exist yet**, only schema + DB RPCs.

---

## PREFLIGHT RECONCILIATION REQUIRED

### Question A: Invoice Source of Truth

**Identify canonical F3 invoice table:**
```text
finance_invoices ?          (Platform F3 canonical?)
edu_fin_invoices ?          (Preschool P71 product context?)
```

**Evidence needed:**
- Which table is Platform F3 canonical invoice?
- Is `edu_fin_invoices` Preschool-specific or shared?
- Does Platform F3 have separate `finance_invoices` table?

---

### Question B: Customer Semantics

**Trace customer aggregate:**
```text
customers table:
├─ Created by: ?
├─ Represents: Person / Organization / Account?
├─ Party mapping exists: ? (check code, not just schema)
├─ invoice.customer_id FK: actual target?
└─ Commercial account lifecycle: separate from identity?
```

**Two valid patterns:**
1. **Customer = Identity proxy** → Needs party_id FK, migrate to Party
2. **Customer = Commercial account** → Keep customer.id, add customer.party_id (customer belongs to party)

**Cannot decide migration until semantics clear.**

---

### Question C: F3 Contract/Engine Existence

**Verify Platform F3 AR operational layer:**
```text
F3 AR Contract interface:
├─ File location: src/platform/finance/contracts/ar-*.contract.ts ?
├─ Methods: createInvoice / recordPayment / ... ?
├─ Parameters: Party-based or Customer-based?
└─ Exports wired: Platform Finance public API?

F3 AR Engine:
├─ File location: src/platform/finance/engines/ar-* ?
├─ Implementation: Invoice/Payment writers?
├─ Tests: Contract/Engine integration tests?
└─ Operational: Can Products call F3 AR via Contract?
```

**If Contract/Engine missing:** E0.1B-R = **Implement F3 AR Contract + Engine** (not migration)

**If Contract/Engine exists but Person-based:** E0.1B-R = **Migrate Contract to Party**

---

### Question D: Single Writer Ownership

**Who owns invoice/payment creation:**
```text
Invoice creation:
├─ Platform F3 Engine? (via Contract)
├─ Preschool Product P71? (direct DB RPC)
├─ English Center Product? (TBD)
└─ Multiple writers? (architecture violation)

Payment recording:
├─ Platform F3 Engine?
├─ Product-level?
└─ Shared responsibility?

Customer/Account linkage:
├─ Platform Party System?
├─ Product CRM?
└─ F3 AR owns customer aggregate?
```

**Single Writer Rule:** Only one component can create/mutate invoices. Must identify before defining remediation.

---

## PREFLIGHT STATUS (CORRECTED)

**Confirmed Evidence:**
- ✅ Payment actor paths use Party
- ✅ Preschool Finance schema exists (8 tables)
- ✅ Invoice lifecycle DB RPCs exist
- ✅ Integration tests exist (F3.2)

**Unresolved:**
- 🟡 Customer semantics (identity vs account)
- 🟡 Canonical invoice table (Platform vs Product)
- 🟡 F3 Contract existence/readiness
- 🟡 F3 Engine existence/readiness
- 🟡 Single Writer ownership

**Architectural Gap:** NOT YET CLASSIFIED

**Remediation Scope:** NOT YET FROZEN

**Authorization:** 🚫 **NOT READY** (need A/B/C/D answers first)

---

## NEXT PREFLIGHT STEPS

1. **Reconcile invoice source of truth** (Platform `finance_invoices` vs Product `edu_fin_invoices`)
2. **Trace customer semantics** (identity proxy vs commercial account aggregate)
3. **Verify F3 Contract/Engine** (exists? Party-based? operational?)
4. **Identify Single Writer** (who creates invoices/payments?)
5. **Lock remediation scope** after reconciliation complete

---

**Preflight incomplete. Continue reconciliation (A/B/C/D) before authorizing remediation scope.**


---

## RECONCILIATION FINDINGS

### Question A: Invoice Source of Truth ✅ ANSWERED

**Platform F3 Canonical Invoice:**
- Table: `finance_invoices` (migration `20260817000000_finance_ar_engine_v1.sql`)
- Schema: 6 tables (invoices, lines, ledger, positions, allocations, adjustments)
- Identity: `customer_id UUID NOT NULL` ❌ (NOT party_id)

**Product P71 Preschool Invoice:**
- Table: `edu_fin_invoices` (migration `20260909000058_p71_preschool_finance.sql`)
- Schema: 8 tables (fee structures, billing periods, invoices, payments, etc.)
- Identity: `student_id UUID NOT NULL` + indirect customer via payment `payer_party_id`

**Verdict:** Two separate invoice systems coexist:
1. Platform F3 AR (`finance_invoices`) — uses `customer_id`
2. Preschool P71 (`edu_fin_invoices`) — uses `student_id` + `payer_party_id`

**Architecture Issue:** Platform F3 and Product P71 have **duplicate invoice domains** with different identity patterns.

---

### Question B: Customer Semantics 🟡 PARTIALLY ANSWERED

**customers table status:**
```sql
-- Legacy schema (20260511000000_initial_schema.sql)
CREATE TABLE customers (
    id UUID PRIMARY KEY,
    phone TEXT UNIQUE NOT NULL,
    name_mother TEXT NOT NULL,
    name_baby TEXT,
    -- NO party_id FK ❌
    -- NO person_id FK ❌
    ...
);
```

**Observed usage:**
- Bella Spa legacy: phone-based CRM identity
- Real Estate: `real_estate_products.customer_id` references `party_parties(id)` directly (NOT customers table)
- Finance F3: `finance_invoices.customer_id` — logical reference (no FK constraint)
- Finance P71: Does NOT use customers table (uses student_id + payer_party_id)

**Customer semantics:**
1. **Legacy CRM identity** (Bella Spa) — phone-based person proxy
2. **NOT a commercial account aggregate** (no account lifecycle, no party linkage)
3. **Real Estate reuses field name** but references Party directly (different semantic)

**Verdict:** `customers` table is **legacy identity proxy** (pre-Party system), NOT a commercial account.

---

### Question C: F3 Contract/Engine Existence 🔴 CRITICAL GAP

**Platform F3 AR Contract:**
- Location: `src/platform/finance/contracts/` ❌ NOT FOUND
- Expected: `ar-engine.contract.ts` or `invoice.contract.ts`
- Actual: Only `cash-engine.contract.ts` and `ledger-engine.contract.ts` exist

**Platform F3 AR Engine:**
- Location: `src/platform/finance/engines/` ❌ NOT FOUND
- Expected: `ar-engine/` subdirectory
- Actual: Only `cash-engine/` and `ledger-engine/` exist

**What EXISTS:**
- ✅ F3 AR schema (`finance_invoices` + 5 related tables)
- ✅ F3 AR DB RPCs (`finance_create_draft_invoice`, `finance_finalize_invoice`, `finance_void_invoice`)
- ✅ F3 AR integration tests (`finance-f3-invoice-lifecycle.test.ts` — 24 test targets)

**What is MISSING:**
- ❌ F3 AR Contract interface (Platform → Product boundary)
- ❌ F3 AR Engine implementation (business logic layer)
- ❌ Product-facing API exports

**Verdict:** **Platform F3 AR has database + RPCs but NO Contract/Engine layer.** Products would need to call DB RPCs directly (architecture violation).

---

### Question D: Single Writer Ownership 🟡 PARTIALLY ANSWERED

**Invoice creation patterns:**

1. **Platform F3 AR:**
   - Writer: DB RPC `finance_create_draft_invoice()`
   - Caller: Integration tests (direct RPC calls)
   - Production usage: UNKNOWN (no Contract exports found)

2. **Preschool P71:**
   - Writer: Product-level (P71-specific tables)
   - Owner: Preschool Product domain
   - Separate from Platform F3

**Payment recording patterns:**

1. **Platform F3:** Allocation via `finance_receivable_allocations` + ledger
2. **Preschool P71:** Payment via `edu_fin_payments` (payer_party_id) + reconciliation

**Customer/Account linkage:**
- NOT owned by F3 AR
- Legacy `customers` table has no clear owner
- Real Estate uses Party directly (bypasses customers table)

**Verdict:** 
- Platform F3 AR **intended** as Single Writer (DB RPCs exist)
- Contract/Engine layer **missing** prevents Product usage
- Preschool P71 built **separate finance domain** (not using Platform F3)

---

## PREFLIGHT ARCHITECTURAL VERDICT

### Critical Findings

1. **Platform F3 AR incomplete** ❌
   - Schema + RPCs exist ✅
   - Contract/Engine missing ❌
   - Product-facing API missing ❌

2. **Platform F3 uses `customer_id` (not `party_id`)** ❌
   - Breaks Party canonical identity pattern
   - Same issue as Education (Person → Party migration)

3. **Legacy `customers` table orphaned** ❌
   - No party_id FK
   - No person_id FK
   - No clear ownership
   - Real Estate bypasses it (uses Party directly)

4. **Preschool P71 built duplicate Finance domain** 🟡
   - Separate invoice/payment tables
   - Uses Party for payments (`payer_party_id`) ✅
   - Does NOT use Platform F3 AR

---

### E0.1B-R Scope Determination (FINAL)

**E0.1B-R Finance Remediation consists of TWO tracks:**

#### Track 1: Platform F3 AR Contract/Engine Implementation

**Gap:** Schema exists, Contract/Engine missing

**Work Required:**
1. Create F3 AR Contract interface (`InvoiceContract`)
2. Implement F3 AR Engine (wrap existing RPCs)
3. Export Contract to Products
4. Migrate `customer_id` → `party_id` + customer compatibility
5. Write Contract/Engine tests

**Pattern:** NOT migration, but **new implementation** using existing schema

---

#### Track 2: Legacy customers Table Remediation

**Gap:** No Party linkage, orphaned identity

**Work Required:**
1. Add `customers.party_id` FK
2. Backfill existing customers → Party mappings
3. Deprecate direct customers usage
4. Migrate callers to use Party + optional customer reference

**Pattern:** Same as E0.1A-R (Party migration)

---

### Remediation Decision Matrix

**Option A: Implement Track 1 + Track 2 (Complete F3 AR)**
- Pros: Closes F3 AR gap completely, Party-canonical
- Cons: Large scope, two parallel tracks
- Timeline: Longest

**Option B: Track 1 only (F3 AR operational, defer customer migration)**
- Pros: Unblocks English Center Finance integration
- Cons: Leaves customer→Party debt
- Timeline: Medium

**Option C: Simplify — Use Preschool P71 pattern**
- Pros: P71 already Party-native for payments
- Cons: Duplicate finance domains persist
- Timeline: Shortest (reuse P71)

---

### Recommended Path Forward

**Recommendation:** **Option C + Focused cleanup**

**Rationale:**
1. Preschool P71 Finance (`edu_fin_*`) already operational with Party-native payments
2. Platform F3 AR incomplete (missing Contract/Engine)
3. English Center needs billing NOW, not after F3 AR implementation

**Execution:**
1. Use P71 pattern for English Center billing (reuse `edu_fin_*` tables)
2. Add `edu_fin_invoices.party_id` (canonical payer identity)
3. Keep `student_id` for Student domain linkage
4. Defer Platform F3 AR Contract/Engine (post-E1)
5. Defer legacy `customers` cleanup (post-E1)

**E0.1B-R Scope (REVISED):**
```text
E0.1B-R: English Center Finance Integration

R0 Baseline: Verify P71 schema compatibility
R1 Schema Extension: Add party_id to edu_fin_invoices
R2 Contract Creation: English Center Finance Contract
R3 Billing Integration: Student → Invoice → Payment flow
R4 Verification: End-to-end billing tests
```

**NOT a remediation — a Product Finance integration using existing P71 foundation.**

---

**Preflight verdict: E0.1B-R scope = Pragmatic P71 reuse, NOT Platform F3 AR migration. Awaiting authorization decision.**
