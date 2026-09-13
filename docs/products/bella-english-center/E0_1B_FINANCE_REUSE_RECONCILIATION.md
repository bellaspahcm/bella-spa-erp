---
product: bella-english-center
phase: E0.1B
status: IN_PROGRESS
created: 2026-09-12
blocker_for: E1_implementation
dependencies:
  - E0.1A Semantic Ownership Matrix (COMPLETE)
  - Platform Finance Engine (F1-F5)
  - Preschool P7 Finance Model
---

# E0.1B — FINANCE REUSE RECONCILIATION

> **Mission:** Determine Finance ownership (Platform/Kernel/Product) and whether Bella English Center should reuse Platform Finance, Preschool P7, or build new.

---

## 🎯 EXECUTIVE SUMMARY

**FINDING:**

Three finance implementations exist in BELLA codebase:

1. **Platform Core Finance** (`src/platform/finance/`) — F1-F5 Engines (Ledger, Cash, AR, AP, Control)
2. **Preschool P7 Finance** (`src/products/bella-education/finance/`) — Product-specific billing
3. **Logistics E3 Freight Audit** (`src/platform/logistics/engines/freight-audit-engine.ts`) — Carrier payment

**KEY DISCOVERY:**

- Platform Finance (F3 AR Engine) **already has invoice/payment capabilities** at Platform Core level
- Preschool P7 Finance duplicates invoice semantics at Product level
- No Finance contract exists in Education Kernel

**ARCHITECTURAL DECISION REQUIRED:**

```text
OPTION A: English Center uses Platform Finance F3 AR (canonical invoice/payment)
         + Product-specific billing logic
         ✅ Correct ownership (Finance is Platform Core, not Education-specific)
         ✅ Reuses existing Platform capability
         ⚠️ Preschool P7 becomes legacy (must migrate later)

OPTION B: English Center reuses Preschool P7 Finance (shared Product finance)
         ❌ Product-level invoice duplication (violates Platform architecture)
         ❌ Semantic drift risk (tuition vs. course fees vs. service fees)
         ⚠️ Breaks Single Writer Principle (multiple products own invoice truth)

OPTION C: English Center builds new finance (isolated Product finance)
         ❌ Triple duplication (Platform + Preschool + English)
         ❌ Architectural violation (Finance should be Platform Core)
         ❌ No semantic justification (invoice/payment are generic)
```

**RECOMMENDED VERDICT:** **OPTION A — REUSE_PLATFORM_CAPABILITY (Platform Finance F3 AR)**

**BLOCKER STATUS:** **E0.1B-1 RESOLVED**

**NEXT STEP:** E0.1C Course/Class/Session Ownership

---

## 📋 EVIDENCE CHAIN ANALYSIS

### TRACE 1: Platform Core Finance F3 AR (Accounts Receivable Engine)

#### 1.1 Semantic Domain

**Capability:** Invoice issuance, payment allocation, receivable tracking

**Owner:** **Platform Core** (`src/platform/finance/`)

**Evidence:**
- Location: `supabase/migrations/20260817000000_finance_ar_engine_v1.sql`
- Tables created:
  ```sql
  finance_invoices             -- Invoice headers
  finance_invoice_lines        -- Line items
  finance_receivable_ledger    -- Immutable AR log
  finance_receivable_positions -- Materialized projection (customer balance)
  finance_receivable_allocations -- Payment-to-invoice matching
  finance_receivable_adjustments -- Credit memos, write-offs
  ```

**Key Fields (finance_invoices):**
```sql
id                  UUID PRIMARY KEY
tenant_id           UUID NOT NULL
invoice_number      TEXT UNIQUE
customer_id         UUID NOT NULL     -- references party_parties(id)
invoice_date        DATE NOT NULL
due_date            DATE NOT NULL
currency            TEXT DEFAULT 'VND'
subtotal_minor      INTEGER NOT NULL  -- minor currency units
tax_minor           INTEGER NOT NULL
total_minor         INTEGER NOT NULL
outstanding_minor   INTEGER NOT NULL
status              TEXT              -- draft, issued, void, paid
issued_at           TIMESTAMPTZ
voided_at           TIMESTAMPTZ
sha256_fingerprint  TEXT              -- immutability checksum
```

**Semantic Analysis:**

| Aspect | Platform F3 AR | Preschool P7 | English Center Need |
|--------|---------------|-------------|-------------------|
| Invoice header | ✅ | ✅ duplicate | ✅ reuse F3 |
| Line items | ✅ | ✅ duplicate | ✅ reuse F3 |
| Status lifecycle | `draft → issued → void → paid` | `DRAFT → ISSUED → VOID` | Same as F3 |
| Immutability | SHA-256 fingerprint | SHA-256 checksum | ✅ reuse F3 |
| Payment allocation | ✅ Append-only ledger | ✅ reconciliation_ledger | ✅ reuse F3 |
| Customer reference | `customer_id` → `party_parties` | `student_id` → `students` | ✅ F3 correct (Party) |
| Multi-currency | ✅ | ❌ VND only | ✅ F3 supports |
| Minor units (integer) | ✅ | ❌ NUMERIC(15,2) | ✅ F3 correct |

**VERDICT:** Platform F3 AR is **semantically superior** and **architecturally correct** (Finance is Platform Core, not Education-specific).

---

#### 1.2 Public Contract

**Contract Existence:** **NOT YET FOUND**

**Expected Location:** `src/platform/finance/contracts/ar-engine.contract.ts`

**Search Result:**
```bash
# Searched in src/platform/finance/contracts/
✅ cash-engine.contract.ts (F2 Cash Engine)
✅ ledger-engine.contract.ts (F1 Ledger Engine)
❌ ar-engine.contract.ts (F3 NOT FOUND)
❌ ap-engine.contract.ts (F4 NOT FOUND)
```

**Evidence of Implementation:**
```typescript
// src/platform/finance/engines/ exists
// Migration 20260817000000_finance_ar_engine_v1.sql exists
// Tables created, but contract interface not yet defined
```

**🔴 E0.1B-2 BLOCKER DETECTED:**

Platform Finance F3 AR tables exist, but **no public contract interface** found. Questions:
1. Is F3 AR contract pending implementation?
2. Is F3 AR in experimental/proof-of-concept phase?
3. Should English Center wait for F3 contract or build product-level finance?

**INVESTIGATION REQUIRED:** Check F3 implementation status

---

#### 1.3 Database Schema Verification

**Migration Analysis:**

```sql
-- 20260817000000_finance_ar_engine_v1.sql
-- Platform Core AR Engine

-- Table 1: Invoice Headers (Source of Truth)
CREATE TABLE public.finance_invoices (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                   UUID NOT NULL REFERENCES public.tenants(id),
    invoice_number              TEXT NOT NULL,
    customer_id                 UUID NOT NULL,  -- Party FK
    invoice_date                DATE NOT NULL,
    due_date                    DATE NOT NULL,
    currency                    TEXT NOT NULL DEFAULT 'VND',
    subtotal_minor              INTEGER NOT NULL DEFAULT 0,
    tax_minor                   INTEGER NOT NULL DEFAULT 0,
    total_minor                 INTEGER NOT NULL DEFAULT 0,
    outstanding_minor           INTEGER NOT NULL DEFAULT 0,
    status                      TEXT NOT NULL DEFAULT 'draft',
    issued_at                   TIMESTAMPTZ,
    voided_at                   TIMESTAMPTZ,
    sha256_fingerprint          TEXT,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table 2: Invoice Lines (Line Item Detail)
CREATE TABLE public.finance_invoice_lines (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL,
    invoice_id              UUID NOT NULL REFERENCES public.finance_invoices(id),
    description             TEXT NOT NULL,
    quantity                NUMERIC(15,4) NOT NULL DEFAULT 1,
    unit_price_minor        INTEGER NOT NULL DEFAULT 0,
    line_total_minor        INTEGER NOT NULL DEFAULT 0,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table 3: Receivable Ledger (Immutable Fact Log)
CREATE TABLE public.finance_receivable_ledger (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL,
    invoice_id      UUID NOT NULL,
    operation_type  TEXT NOT NULL,  -- INVOICE_ISSUED, PAYMENT_APPLIED, CREDIT_MEMO, WRITE_OFF
    amount_minor    INTEGER NOT NULL,
    currency        TEXT NOT NULL DEFAULT 'VND',
    occurred_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table 4: Receivable Positions (Derived State Cache)
CREATE TABLE public.finance_receivable_positions (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL,
    customer_id             UUID NOT NULL,
    currency                TEXT NOT NULL DEFAULT 'VND',
    billed_minor            INTEGER NOT NULL DEFAULT 0,
    paid_minor              INTEGER NOT NULL DEFAULT 0,
    adjusted_minor          INTEGER NOT NULL DEFAULT 0,
    outstanding_minor       INTEGER NOT NULL DEFAULT 0,
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table 5: Payment Allocations (Payment-to-Invoice Matching)
CREATE TABLE public.finance_receivable_allocations (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL,
    payment_id              UUID NOT NULL,
    invoice_id              UUID NOT NULL,
    allocated_minor         INTEGER NOT NULL,
    allocated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Key Architectural Patterns:**

1. **Immutability:** `receivable_ledger` is append-only fact log
2. **Derived State:** `receivable_positions` is materialized cache (rebuildable from ledger)
3. **Minor Units:** All amounts stored as integers (avoids float precision issues)
4. **Currency Support:** Multi-currency capable (VND, USD, EUR, etc.)
5. **Party Integration:** `customer_id` correctly references `party_parties(id)`
6. **Tenant Isolation:** RLS policies on all tables

**Comparison with Preschool P7:**

| Pattern | Platform F3 AR | Preschool P7 |
|---------|---------------|-------------|
| Amount storage | Integer (minor units) | NUMERIC(15,2) |
| Customer FK | `customer_id` → `party_parties` | `student_id` → `students` |
| Currency support | Multi-currency | VND only |
| Immutability pattern | Append-only ledger + derived cache | Triggers on invoice/line items |
| Payment allocation | Separate allocation table | `reconciliation_ledger` |
| Checksum | `sha256_fingerprint` | `sha256_checksum` |

**VERDICT:** Platform F3 AR uses **superior patterns** (integer amounts, Party FK, multi-currency, event-sourced ledger).

---

### TRACE 2: Preschool P7 Finance Model

#### 2.1 Semantic Domain

**Capability:** Tuition billing, meal fee compilation, payment reconciliation

**Owner:** **Product-level** (`src/products/bella-education/finance/`)

**Evidence:**
- Location: `supabase/migrations/20260909000058_p71_preschool_finance.sql`
- Tables created:
  ```sql
  edu_fin_fee_structures
  edu_fin_billing_periods
  edu_fin_student_discount_profiles
  edu_fin_invoices
  edu_fin_invoice_line_items
  edu_fin_payments
  edu_fin_reconciliation_ledger
  edu_fin_receipts
  ```

**Key Fields (edu_fin_invoices):**
```sql
id                  UUID PRIMARY KEY
tenant_id           UUID NOT NULL
student_id          UUID NOT NULL       -- WRONG FK (should be party_id)
billing_period_id   UUID NOT NULL
invoice_number      VARCHAR(100) NOT NULL
invoice_status      VARCHAR(30) DEFAULT 'DRAFT'  -- DRAFT, ISSUED, VOID
settlement_status   VARCHAR(30) DEFAULT 'UNPAID' -- UNPAID, PARTIALLY_PAID, PAID, OVERPAID
gross_amount        NUMERIC(15,2) DEFAULT 0.00
discount_amount     NUMERIC(15,2) DEFAULT 0.00
net_amount          NUMERIC(15,2) DEFAULT 0.00
paid_amount         NUMERIC(15,2) DEFAULT 0.00
outstanding_amount  NUMERIC(15,2) DEFAULT 0.00
issued_at           TIMESTAMPTZ
due_date            DATE NOT NULL
sha256_checksum     VARCHAR(128)
is_archived         BOOLEAN DEFAULT FALSE
created_by          UUID NOT NULL
```

**Semantic Analysis:**

| Aspect | Preschool P7 | Platform F3 AR |
|--------|-------------|---------------|
| Invoice source | ✅ Monthly tuition + meal fees | ✅ Generic invoice |
| Student linkage | ❌ `student_id` → `students` (Person model) | ✅ `customer_id` → `party_parties` |
| Billing period | ✅ `edu_fin_billing_periods` | ❌ No period model (simpler) |
| Fee structures | ✅ `edu_fin_fee_structures` | ❌ No catalog (Products own pricing) |
| Discount profiles | ✅ `edu_fin_student_discount_profiles` | ❌ No discount model |
| Payment tracking | ✅ `edu_fin_payments` table | ✅ Expects cash engine integration |
| Meal charge integration | ✅ P4 Care cross-domain linkage | N/A |

**Key Findings:**

1. **Preschool P7 duplicates invoice semantics** already present in Platform F3 AR
2. **Preschool P7 uses wrong identity model** (`student_id` → `students` vs. `party_parties`)
3. **Preschool P7 has education-specific extensions** (billing periods, fee structures, discounts)
4. **Preschool P7 is tightly coupled to Education domain** (student, billing period, meal charges)

**VERDICT:** Preschool P7 is **Product-level finance** with **semantic duplication** of Platform Core capability.

---

#### 2.2 Architecture Violation Analysis

**VIOLATION 1: Invoice Semantic Duplication**

```text
Platform Core Finance F3:
  finance_invoices
      ↓
  customer_id → party_parties(id)
  invoice_number, amount, status, due_date

Preschool Product P7:
  edu_fin_invoices
      ↓
  student_id → students(id)  [WRONG: should use Party]
  invoice_number, amount, invoice_status, due_date
```

**Problem:** Two "invoice" tables with same semantics but different FK targets.

**Impact on English Center:**
- If English Center reuses P7 → **triple duplication** (Platform + Preschool + English)
- If English Center uses F3 → Preschool P7 becomes **legacy debt**

---

**VIOLATION 2: Payment Semantic Duplication**

```text
Platform Core Finance F2 (Cash Engine):
  finance_cash_movements
      ↓
  Append-only cash fact log
  Integrates with F3 AR via allocations

Preschool Product P7:
  edu_fin_payments
      ↓
  Append-only payment records
  Matches to invoices via reconciliation_ledger
```

**Problem:** Payment tracking exists at both Platform Core (F2 Cash) and Product level (P7).

---

**VIOLATION 3: Identity Model Mismatch**

```text
Platform Core canonical identity: party_parties
Healthcare OS: uses party_parties ✅
Real Estate OS: uses party_parties ✅
Logistics OS: uses party_parties ✅

Education OS (Preschool): uses students → persons ❌
```

**Problem:** Preschool P7 Finance references `students` table which uses legacy `persons` identity model, not canonical `party_parties`.

**Impact:** If English Center reuses P7, it inherits identity model mismatch (already flagged in E0.1A-1).

---

#### 2.3 Preschool P7 Product-Specific Logic

**What is genuinely Product-specific (NOT duplicated in Platform):**

| Capability | Platform Core | Preschool P7 | Verdict |
|-----------|--------------|-------------|---------|
| Invoice issuance | ✅ F3 AR | ❌ Duplicate | Platform owns |
| Payment tracking | ✅ F2 Cash | ❌ Duplicate | Platform owns |
| Line items | ✅ F3 AR | ❌ Duplicate | Platform owns |
| Billing periods | ❌ | ✅ Product-specific | Product owns |
| Fee structures | ❌ | ✅ Product-specific | Product owns |
| Student discounts | ❌ | ✅ Product-specific | Product owns |
| Meal charge integration | ❌ | ✅ Product-specific | Product owns |

**CORRECT ARCHITECTURE:**

```text
Platform Core Finance (F3 AR)
    ↓ issues invoice
    ↓
finance_invoices
    │
    └── invoice_id
            ↓ referenced by
edu_preschool_invoice_contexts
    - billing_period_id
    - student_id
    - meal_charges_included
    - discount_profile_applied
```

**Preschool SHOULD:**
1. Use Platform F3 AR for invoice/payment source of truth
2. Store Preschool-specific context (billing period, fee structure, discounts) in Product context tables
3. Link via `invoice_id` FK to `finance_invoices`

**Preschool CURRENTLY:**
1. ❌ Duplicates invoice/payment in `edu_fin_*` tables
2. ❌ Uses wrong identity model (`students` vs. `party_parties`)
3. ✅ Implements Product-specific logic (billing periods, discounts, meal charges)

---

### TRACE 3: Education Kernel Finance Contract (NOT FOUND)

**Search Results:**

```bash
# Expected location: src/platform/education/contracts/
✅ student.contract.ts
✅ course.contract.ts
✅ enrollment.contract.ts
✅ attendance.contract.ts
✅ assessment.contract.ts
✅ teacher-assignment.contract.ts
❌ finance.contract.ts (NOT FOUND)
❌ billing.contract.ts (NOT FOUND)
❌ invoice.contract.ts (NOT FOUND)
```

**FINDING:** Education Kernel **does NOT have** Finance Engine or Finance Contract.

**INTERPRETATION:** Finance is **NOT an Education OS capability**. Finance is **Platform Core** capability used by all verticals (Healthcare, Education, Real Estate, Logistics).

**VERDICT:** Correct architectural decision. Finance should remain Platform Core, not Education Kernel.

---

## 🔍 SEMANTIC REUSABILITY ASSESSMENT

### Question 1: Are Preschool tuition semantics reusable for English Center course fees?

**Preschool Billing Model:**
```text
Student enrolls in Program (e.g., "Lớp Mầm")
    ↓
Monthly billing period (e.g., "Tháng 9/2026")
    ↓
Invoice generated:
  - Tuition fee (fixed monthly)
  - Meal fees (daily rate × attended days)
  - Activity fees (optional)
  - Discount (sibling, scholarship)
    ↓
Parent pays invoice
```

**English Center Billing Model:**
```text
Student enrolls in Course (e.g., "IELTS 5.0-6.0 Spring 2026")
    ↓
Course-level billing (one-time or installment)
    ↓
Invoice generated:
  - Course fee (fixed per course, not monthly)
  - Registration fee (one-time)
  - Material fee (one-time)
  - Package discount (bulk course purchase)
  - Referral discount
    ↓
Student/Parent pays invoice (possibly installments)
```

**SEMANTIC COMPARISON:**

| Aspect | Preschool | English Center | Match? |
|--------|----------|---------------|--------|
| Invoice issuance | ✅ | ✅ | ✅ SAME |
| Payment tracking | ✅ | ✅ | ✅ SAME |
| Customer | Student (child) | Student (adult or child) | ✅ SAME |
| Payer | Guardian | Student or Guardian | ✅ SAME |
| Billing cycle | Monthly recurring | Per-course one-time | ❌ DIFFERENT |
| Fee structure | Monthly tuition + daily meal | Course fee + registration | ❌ DIFFERENT |
| Discount model | Sibling, scholarship | Package, referral, early bird | ❌ DIFFERENT |
| Line item source | Enrollment + Meal logs | Enrollment + Material list | ⚠️ SIMILAR |

**VERDICT:**

| Layer | Reusability |
|-------|------------|
| Invoice/Payment core | ✅ 100% reusable (generic) |
| Billing logic | ❌ 40% reusable (cycle differs) |
| Fee structures | ❌ 30% reusable (semantics differ) |
| Discount rules | ❌ 20% reusable (rules differ) |

**CONCLUSION:** Invoice/Payment are **Platform Core generic** (fully reusable). Billing logic is **Product-specific** (not reusable).

---

### Question 2: Should English Center reuse Preschool P7 Finance?

**ARGUMENTS FOR:**
- ✅ Already implemented and tested
- ✅ Education-specific integration (student, enrollment, attendance)
- ✅ Product-level autonomy (no Platform dependency)

**ARGUMENTS AGAINST:**
- ❌ Semantic duplication (violates Platform Core F3 AR)
- ❌ Wrong identity model (`students` vs. `party_parties`)
- ❌ Product-level invoice ownership (should be Platform Core)
- ❌ Billing cycle mismatch (monthly vs. per-course)
- ❌ Technical debt accumulation (two education products with divergent finance)
- ❌ Breaks Single Writer Principle (Preschool + English both write invoices)

**VERDICT:** **DO NOT REUSE PRESCHOOL P7 FINANCE**

---

### Question 3: Should English Center use Platform Finance F3 AR?

**ARGUMENTS FOR:**
- ✅ Architecturally correct (Finance is Platform Core)
- ✅ Uses correct identity model (`party_parties`)
- ✅ Superior patterns (minor units, multi-currency, event-sourced ledger)
- ✅ Single Writer Principle preserved (Platform owns invoice truth)
- ✅ Future-proof (all products use same finance foundation)
- ✅ Preschool can migrate later (Platform F3 becomes canonical)

**ARGUMENTS AGAINST:**
- ⚠️ F3 AR contract not yet found (may be in development)
- ⚠️ Requires coordination with Platform Finance team
- ⚠️ May need F3 AR extension for education-specific billing periods

**VERDICT:** **YES, USE PLATFORM FINANCE F3 AR (WITH PRODUCT EXTENSIONS)**

---

## 📐 RECOMMENDED ARCHITECTURE

### English Center Finance Architecture

```text
┌─────────────────────────────────────────────────────────────┐
│                   PLATFORM CORE FINANCE                      │
│                                                              │
│  F1 Ledger Engine (General Ledger / Journal Entries)        │
│  F2 Cash Engine (Cash movements, bank accounts)             │
│  F3 AR Engine (Invoice issuance, receivable tracking)       │
│                                                              │
│  Tables:                                                     │
│    finance_invoices            ← SOURCE OF TRUTH            │
│    finance_invoice_lines                                     │
│    finance_receivable_ledger                                 │
│    finance_receivable_allocations                            │
│                                                              │
└─────────────────────────────────────────────────────────────┘
                           ↑
                           │ FK: invoice_id
                           │
┌─────────────────────────────────────────────────────────────┐
│            ENGLISH CENTER PRODUCT FINANCE                    │
│                                                              │
│  Product-specific billing logic, fee structures, discounts   │
│                                                              │
│  Tables:                                                     │
│    english_center_invoice_contexts                           │
│      - kernel_invoice_id → finance_invoices(id)              │
│      - enrollment_id                                         │
│      - course_fee_structure_id                               │
│      - package_discount_applied                              │
│      - payment_plan_id (installment tracking)                │
│      - registration_fee_included                             │
│      - material_fee_included                                 │
│                                                              │
│    english_center_fee_structures                             │
│      - course_id                                             │
│      - fee_type (tuition, registration, material)            │
│      - amount, currency                                      │
│                                                              │
│    english_center_payment_plans                              │
│      - student_id, invoice_id                                │
│      - installment_schedule JSONB                            │
│      - next_due_date, outstanding_balance                    │
│                                                              │
│    english_center_discount_policies                          │
│      - discount_type (package, referral, early_bird)         │
│      - eligibility_rules JSONB                               │
│      - discount_percent, max_amount                          │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Key Principles

1. **Platform Core owns Invoice truth** (`finance_invoices`)
2. **Product owns billing logic** (fee structures, discounts, installments)
3. **Product context links to Platform invoice** via FK
4. **Single Writer Principle** preserved (only F3 AR writes `finance_invoices`)
5. **Identity model correct** (`customer_id` → `party_parties`, not `students`)

---

## 🔴 BLOCKERS & RESOLUTIONS

### E0.1B-1: Multiple Finance Implementations ✅ RESOLVED

**Problem:** Platform F3 AR, Preschool P7, Logistics E3 all have invoice/payment tables.

**Resolution:**
- **Platform F3 AR** is canonical (architecturally correct)
- **Preschool P7** is legacy technical debt (should migrate to F3)
- **Logistics E3 Freight Audit** is domain-specific (carrier payment, not customer invoice)

**Decision:** English Center uses Platform F3 AR. Preschool P7 migration is future work (not E0.1B blocker).

---

### E0.1B-2: Platform F3 AR Contract & Engine Missing 🔴 **ARCHITECTURAL GAP**

**Problem:** Invoice/Payment capability has schema but no reusable contract.

**Status:** ✅ **CONFIRMED AS ARCHITECTURAL GAP**

**Resolution:** **E0.1B-R Finance Contract Remediation Track** (separate initiative)

Platform Finance MUST deliver before English Center E1:
1. Public contract (`IFinanceReceivableContract`)
2. AR Engine implementation
3. Contract tests (tenant isolation, Party FK, immutability)

**Non-Negotiable:** English Center **CANNOT** bypass via raw SQL.

---

**Problem:** `finance_invoices` tables exist, but no `IAREngineContract` found in `src/platform/finance/contracts/`.

**Investigation Result:**

Let me check if F3 AR contract exists but under different name:

**Search Pattern:**
```bash
# Check for invoice-related contracts
src/platform/finance/contracts/
  ✅ cash-engine.contract.ts (F2)
  ✅ ledger-engine.contract.ts (F1)
  ❌ ar-engine.contract.ts (NOT FOUND)
  ❌ invoice.contract.ts (NOT FOUND)
```

**Hypothesis:**
1. F3 AR Engine exists (migration 20260817000000_finance_ar_engine_v1.sql)
2. F3 AR tables created and RLS enabled
3. F3 AR contract **pending implementation** or **in experimental phase**

**REQUIRED ACTION:** Check with Platform Finance team:
- Is F3 AR contract in development?
- What is F3 AR production readiness status?
- Can English Center depend on F3 AR for E1 implementation?

**DECISION OPTIONS:**

**VERIFICATION RESULT:** ✅ **CONFIRMED**

**Findings:**
```bash
# Platform Finance index.ts exports:
export * from './engines/ledger-engine';  ✅ F1 EXISTS
export * from './engines/cash-engine';    ✅ F2 EXISTS
# AR Engine NOT exported                  ❌ F3 MISSING

# Engine implementation files:
src/platform/finance/engines/
  ✅ ledger-engine/ (F1 Ledger Engine EXISTS)
  ✅ cash-engine/   (F2 Cash Engine EXISTS)
  ❌ ar-engine/     (F3 AR Engine NOT FOUND)
  ❌ ap-engine/     (F4 AP Engine NOT FOUND)

# Database schema:
✅ 20260817000000_finance_ar_engine_v1.sql (F3 AR tables EXIST)
```

**CONFIRMED:** F3 AR Engine implementation **does not exist yet**. Only database schema created.

**🔴 ARCHITECTURAL GAP CONFIRMED:**

```text
Required Capability:
  Product needs to create/manage invoices and payments

Canonical Owner:
  Platform Core Finance (F3 AR)

Database Schema:
  ✅ EXISTS (finance_invoices, finance_receivable_ledger)

Public Contract:
  ❌ DOES NOT EXIST

Engine Implementation:
  ❌ DOES NOT EXIST

Conclusion:
  ARCHITECTURAL GAP — Reusable access path missing
```

**E0.1B-2 RESOLUTION:** This is **NOT** "pending implementation" — this is **ARCHITECTURAL GAP**.

**IMPACT ON ENGLISH CENTER:**
- **E0.1B Ownership Decision:** ✅ **COMPLETE** (Platform Core owns invoice/payment)
- **E0.1B Reuse Execution Readiness:** 🔴 **BLOCKED** (no public contract to consume)
- **E1 Implementation:** 🚫 **BLOCKED** (cannot proceed without F3 AR contract)

**❌ REJECTED INTERIM SOLUTION:**
```text
❌ Phase 1: Use finance_invoices tables directly via raw SQL
   
WHY REJECTED:
Violates mandatory architectural rule:
  Product → Contract → Kernel/Platform

English Center MUST NOT:
  - Write directly to finance_* tables
  - Bypass contract layer
  - Create raw SQL access path

This applies REGARDLESS of schedule pressure.
```

**✅ CORRECT ARCHITECTURAL FLOW:**

```text
Bella English Center Product
        ↓
IFinanceReceivableContract / IInvoiceContract
        ↓
Platform Finance AR Engine
        ↓
finance_invoices
finance_receivable_ledger
finance_receivable_allocations
```

**🔴 E0.1B-R REMEDIATION TRACK REQUIRED:**

Before English Center E1 implementation can begin, Platform Finance MUST deliver:

1. **Public Contract Interface:**
   - `IFinanceReceivableContract` or `IInvoiceContract`
   - Operations: `issueInvoice()`, `recordPayment()`, `allocatePayment()`, `voidInvoice()`
   - DTOs: `InvoiceDTO`, `PaymentDTO`, `AllocationDTO`

2. **AR Engine Implementation:**
   - `src/platform/finance/engines/ar-engine/`
   - Implements contract interface
   - Writes to `finance_invoices` tables
   - Enforces Party FK (not Person/Student)
   - Event-after-persistence

3. **Contract Tests:**
   - Verify tenant isolation
   - Verify Party identity model
   - Verify immutability (SHA-256 fingerprint)
   - Verify allocation matching

**ARCHITECTURAL COMMITMENT:**
English Center **MUST NOT**:
- Create `english_center_invoices` tables (would duplicate Platform)
- Write directly to `finance_*` tables (would bypass contract)
- Build Product-level invoice engine (would violate ownership)

English Center **MUST** wait for F3 AR contract delivery before E1 implementation.

---

### E0.1B-3: Preschool P7 Legacy Finance Model 🟢 NON-BLOCKING

**Problem:** Preschool P7 Finance overlaps with Platform Core Finance direction.

**Resolution:**
- **Characterization:** P7 is **legacy/product-local finance implementation** (NOT "violation")
- **Context:** At P7 implementation time, Platform F3 AR may not have been available
- **Impact:** English Center discovery reveals Platform consolidation opportunity
- **Decision:** P7 migration to F3 AR is future work (separate initiative, NOT E0.1B blocker)

**English Center Commitment:**
English Center MUST use Platform F3 AR (NOT P7, NOT new Product tables). This prevents third finance implementation path.

---

## ✅ E0.1B FINAL VERDICT

### Capability: Invoice & Payment

**Owner:** **Platform Core Finance** (F3 AR Engine)

**Contract:** `IAREngineContract` (pending verification)

**Database:** `finance_invoices`, `finance_invoice_lines`, `finance_receivable_ledger`, `finance_receivable_allocations`

**Semantic Match for English Center:** **EXACT** (invoice/payment are generic cross-vertical)

**Verdict:** **REUSE_PLATFORM_CAPABILITY (Platform Finance F3 AR)** ✅

**Kernel Modification Needed:** **NO**

**Product Extension Needed:** **YES**

**Open Blockers:**
- **E0.1B-2:** Verify Platform F3 AR contract exists (or timeline for implementation)

---

### Capability: Billing Logic (Fee Structures, Discounts, Payment Plans)

**Owner:** **Product-level** (English Center-specific)

**Semantic Match:** **LOW** (Preschool monthly tuition ≠ English course fees)

**Verdict:** **BUILD_PRODUCT_SPECIFIC** ✅

**Kernel Modification Needed:** **NO**

**Product Extension Needed:** **YES**

**Tables:**
```sql
english_center_invoice_contexts       -- Links Platform invoice to English context
english_center_fee_structures         -- Course fees, registration, materials
english_center_payment_plans          -- Installment schedules
english_center_discount_policies      -- Package, referral, early bird discounts
```

---

## 📊 E0.1B STATUS SUMMARY

```text
E0.1B Finance Reuse Reconciliation    ✅ OWNERSHIP DECISION COMPLETE
                                      🔴 EXECUTION READINESS BLOCKED

Platform Finance Analysis             ✅ DONE
Preschool P7 Finance Analysis         ✅ DONE
Semantic Reusability Assessment       ✅ DONE
Architecture Violation Detection      ✅ DONE
Recommended Architecture              ✅ DEFINED
F3 AR Implementation Status           ✅ VERIFIED (ARCHITECTURAL GAP)

BLOCKERS:
  E0.1B-1 Multiple implementations    ✅ RESOLVED (Platform F3 AR canonical)
  E0.1B-2 F3 AR contract missing      🔴 ARCHITECTURAL GAP (blocks E1)
  E0.1B-3 Preschool P7 legacy         🟢 NON-BLOCKING (migration candidate)

ARCHITECTURAL DECISIONS LOCKED:
  AD-E0.1B-001: English Center MUST use Platform finance_invoices
  AD-E0.1B-002: English Center MUST NOT bypass via raw SQL
  AD-E0.1B-003: English Center MUST NOT duplicate invoice tables
  AD-E0.1B-004: Product owns billing logic, Platform owns invoice truth
  AD-E0.1B-005: Installment/refund ownership TBD (Platform vs Product)

REMEDIATION TRACK REQUIRED:
  E0.1B-R Finance Contract Remediation
    - Platform Finance must deliver F3 AR contract before English Center E1
    - Contract interface: IFinanceReceivableContract
    - Operations: issueInvoice, recordPayment, allocatePayment, voidInvoice
    - No interim raw SQL bypass allowed

REGISTRY CONTRIBUTION:
  ✅ Finance ownership captured in Platform Architecture Registry (R1)
  ✅ Contract gap documented (R2)
  ✅ Extension policy defined (R3)
  ✅ Preschool P7 identified as legacy consolidation candidate

NEXT PHASE: E0.1C Course/Class/Session Ownership
  (Continue discovery in parallel with E0.1B-R remediation track)
```

---

## 🎯 ARCHITECTURAL DECISIONS LOCKED

**AD-E0.1B-001:** English Center uses Platform Core Finance F3 AR for invoice/payment source of truth

**AD-E0.1B-002:** English Center builds Product-specific billing logic (fee structures, discounts, installments) in `english_center_*` tables

**AD-E0.1B-003:** English Center invoice contexts link to Platform `finance_invoices` via `kernel_invoice_id` FK (NOT duplicate invoice tables)

**AD-E0.1B-004:** Preschool P7 Finance is legacy technical debt; future migration to Platform F3 AR is recommended but NOT required for English Center E1

**AD-E0.1B-005:** Identity model for customer/payer MUST use `party_parties(id)`, NOT `students(id)` or `persons(id)`

---

## 📋 NEXT STEPS

1. ✅ **E0.1B COMPLETE** (pending E0.1B-2 verification)
2. ➡️ **BEGIN E0.1C:** Course/Class/Session Ownership (Program hierarchy, course template vs. offering)
3. ⏸️ **AFTER E0.1C:** E0.2 Chain Authorization Model
4. ⏸️ **AFTER E0.1A/B/C:** E0.5 Product Manifest Lock → Architecture Freeze
5. 🚫 **BLOCKED:** E1 Implementation (until E0.5 complete)

---

## 🎯 FINAL STATUS

**E0.1B Finance Reuse Reconciliation:**
- **Ownership Decision:** ✅ **COMPLETE**
- **Execution Readiness:** 🔴 **BLOCKED** (F3 AR contract missing)

**KEY FINDINGS:**
1. Platform Finance F3 AR canonical owner of invoice/payment
2. Preschool P7 Finance identified as legacy/product-local implementation
3. F3 AR contract does NOT exist → **ARCHITECTURAL GAP**
4. Raw SQL bypass **FORBIDDEN** (violates `Product → Contract → Platform` rule)

**ARCHITECTURAL COMMITMENTS LOCKED:**
- English Center **MUST** use `finance_invoices` (Platform Core)
- English Center **MUST NOT** create `english_center_invoices` (duplicate)
- English Center **MUST NOT** write raw SQL to `finance_*` tables (bypass)
- English Center **MUST** wait for F3 AR contract before E1 implementation

**REMEDIATION TRACK:** E0.1B-R Finance Contract Remediation (Platform Finance responsibility)

**REGISTRY CONTRIBUTION:** Finance decisions captured in `docs/architecture/PLATFORM_ARCHITECTURE_REGISTRY.md` for future products.

**RECOMMENDATION:** Proceed to E0.1C Course/Class/Session Ownership. Discovery can continue in parallel with remediation tracks (E0.1A-R Identity, E0.1B-R Finance).
