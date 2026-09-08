# Retail OS Boundary Assessment

**Date:** 2026-09-06  
**Framework:** RETAIL_BOUNDARY_DECISION_FRAMEWORK.md  
**Evidence Source:** RETAIL_REFERENCE_PRODUCT_1_EVIDENCE.md  
**Assessment Order:** Tier 1 → Tier 2 → Tier 3

---

## Assessment Summary

| # | Capability | D1 Scope | D2 Invariance | D3 Reuse | D4 Coupling | D5 Ownership | Decision | Confidence |
|---|------------|----------|---------------|----------|-------------|--------------|----------|------------|
| 1 | Product Management | UNIVERSAL | STABLE | HIGH | WEAKLY COUPLED | STABLE | ✅ **EXTRACT** | HIGH |
| 2 | Inventory Movement | UNIVERSAL | STABLE | HIGH | DECOUPLED | STABLE | ✅ **EXTRACT** | HIGH |
| 3 | Sale Immutability | UNIVERSAL | INVARIANT | N/A | N/A | STABLE | 📋 **CONTRACT** | HIGH |
| 4 | Sales Transaction | UNIVERSAL | STABLE | HIGH | WEAKLY COUPLED | SEMI-STABLE | ⚠️ **PARTIAL** | MEDIUM |
| 5 | Stock Availability | COMMON | STABLE | MEDIUM | WEAKLY COUPLED | STABLE | ⚠️ **PARTIAL** | MEDIUM |
| 6 | Customer Management | COMMON | VARIANT | MEDIUM | COUPLED | VOLATILE | ❌ **KEEP** | MEDIUM |
| 7 | Pricing Management | NARROW | VARIANT | LOW | COUPLED | VOLATILE | ❌ **KEEP** | LOW |

---

## Tier 1: Clear Boundaries (Assessed First)

---

### Capability #1: Product Management

**Observable Behavior (Evidence):**
- Create product (SKU, name, category, pricing)
- Update product price
- Update product status (ACTIVE/DISCONTINUED/OUT_OF_STOCK)
- Get product by ID/SKU
- Track cost price vs base price
- Category-based organization

**Cross-Domain Interactions:**
- → Sale (products referenced in SaleItems)
- → Inventory (products have current_stock)
- → Pricing (products have base_price)

---

#### Dimension Assessment

**D1: Semantic Scope = UNIVERSAL**

Evidence:
- ✅ "Product" exists in ALL retail models (clinic: service, supermarket: goods, pharmacy: medicine)
- ✅ E-commerce has products
- ✅ Warehouse retail has products
- ✅ Concept meaningful without POS context

**D2: Industry Invariance = STABLE**

Evidence:
- ✅ SKU-based product identity universal
- ✅ Product status lifecycle standard (active → discontinued)
- ✅ Cost vs sale price distinction standard
- ⚠️ Category taxonomy varies BUT core concept stable

**D3: Reuse Potential = HIGH**

Test:
- Retail Store (POS): ✅ Uses product catalog
- E-commerce: ✅ Uses product catalog (same contract)
- Clinic: ✅ Uses service catalog (same pattern: SKU → Service Code)
- Warehouse: ✅ Uses product catalog (B2B products)

**Contract Test:**
```typescript
interface IProductCatalog {
  createProduct(sku, name, price, ...): Product
  updatePrice(productId, newPrice): Product
  getProduct(productId): Product
  updateStatus(productId, status): Product
}
```

**Assessment:** All 4 product types can inject same contract ✅

**D4: Product Coupling = WEAKLY COUPLED**

Evidence:
- ✅ Pure domain operations (CRUD + status transition)
- ✅ No POS-specific workflow
- ✅ No UI dependencies
- ⚠️ userId tracking minor coupling (acceptable)

**D5: Ownership Stability = STABLE**

Evidence:
- ✅ Product CRUD operations universal
- ✅ Unlikely to change with Product evolution
- ✅ Healthcare analogy: Service Catalog (stable contract)
- ✅ Finance analogy: Chart of Accounts (stable contract)

**Contract Stability Test:**
```text
Product #2 (E-commerce): Can use same Product contract?
  ✅ YES - E-commerce needs create/update/get products
  
Product #3 (Clinic): Can use same Product contract?
  ✅ YES - Clinic needs service catalog (same pattern)
```

---

#### Decision: ✅ **EXTRACT to Retail OS**

**Rationale:**
- 5/5 dimensions GREEN
- UNIVERSAL semantic scope
- HIGH reuse potential across retail models
- STABLE contract unlikely to break

**Confidence:** HIGH

**Proposed Retail OS Component:**

```text
Retail OS: R1 - Product Catalog Engine

Capabilities:
- Product lifecycle (create, update, status transition)
- SKU-based identity
- Pricing management (base price, cost price)
- Category organization

Contract: IProductCatalogContract (frozen)

Evidence: Universal retail pattern, stable semantics
```

**Risk Assessment:**
- ⚠️ Risk of premature abstraction: LOW (Product is universal concept)
- ⚠️ Risk of contract changes: LOW (CRUD operations stable)
- ✅ Risk acceptable for extraction

---

### Capability #2: Inventory Movement

**Observable Behavior (Evidence):**
- Record stock movements (SALE, RESTOCK, ADJUSTMENT, DAMAGE, TRANSFER, RETURN)
- Track previous_stock → new_stock transitions
- Link movements to source (Sale ID, manual adjustment)
- Detect reorder needs (current_stock < reorder_point)
- Audit trail for all stock changes

**Cross-Domain Interactions:**
- → Product (inventory belongs to product)
- → Sale (sale triggers inventory decrease)
- ← Stock Availability (reads current_stock)

---

#### Dimension Assessment

**D1: Semantic Scope = UNIVERSAL**

Evidence:
- ✅ "Inventory tracking" exists in ALL retail models
- ✅ E-commerce tracks stock
- ✅ Warehouse retail core competency
- ✅ Clinic tracks consumables/supplies
- ✅ Concept meaningful without POS

**D2: Industry Invariance = STABLE**

Evidence:
- ✅ Stock movement types standard (SALE, RESTOCK, ADJUSTMENT)
- ✅ Audit trail universal requirement
- ✅ Reorder detection standard pattern
- ✅ previous → new stock transition invariant

**D3: Reuse Potential = HIGH**

Test:
- Retail Store: ✅ Tracks store inventory
- E-commerce: ✅ Tracks fulfillment center inventory
- Clinic: ✅ Tracks medical supplies
- Warehouse: ✅ Core domain (inventory management)

**Contract Test:**
```typescript
interface IInventoryMovement {
  recordMovement(productId, type, quantity, reference): Movement
  getMovements(productId): Movement[]
  getCurrentStock(productId): number
  detectReorderNeeds(tenantId): Product[]
}
```

**Assessment:** All 4 product types can inject same contract ✅

**D4: Product Coupling = DECOUPLED**

Evidence:
- ✅ Pure domain logic (stock arithmetic + audit)
- ✅ No workflow dependencies
- ✅ No UI/session context
- ✅ Stateless operations on movement records

**D5: Ownership Stability = STABLE**

Evidence:
- ✅ Inventory movement operations universal
- ✅ Audit trail requirement unlikely to change
- ✅ Standard accounting practice (inventory reconciliation)
- ✅ Healthcare analogy: Supply Movement (stable)

**Contract Stability Test:**
```text
Product #2: Can use same Inventory contract?
  ✅ YES - All retail models track inventory movements
  
Product #3: Can use same Inventory contract?
  ✅ YES - Clinic supply tracking uses same pattern
```

---

#### Decision: ✅ **EXTRACT to Retail OS**

**Rationale:**
- 5/5 dimensions GREEN
- UNIVERSAL semantic (inventory tracking standard in retail)
- HIGH reuse potential
- DECOUPLED pure domain logic
- STABLE contract (audit trail universal requirement)

**Confidence:** HIGH

**Proposed Retail OS Component:**

```text
Retail OS: R2 - Inventory Movement Engine

Capabilities:
- Stock movement recording (typed movements)
- Audit trail (previous → new stock)
- Reorder detection
- Movement history queries

Contract: IInventoryMovementContract (frozen)

Evidence: Universal retail pattern, accounting standard
```

**Risk Assessment:**
- ⚠️ Risk of premature abstraction: LOW (inventory tracking universal)
- ⚠️ Risk of contract changes: LOW (audit trail stable requirement)
- ✅ Risk acceptable for extraction

---

### Capability #3: Sale Immutability

**Observable Behavior (Evidence):**
- Draft sale: Mutable (add items, apply discount, cancel)
- Completed sale: Immutable (no modifications allowed)
- Status transition: One-way (DRAFT → COMPLETED, no reversal)
- Immutability enforced at service level (throws error on mutation attempt)

**Cross-Domain Interactions:**
- ← Sale Transaction (immutability applies to sales)
- → Inventory (completion triggers movements)
- → Audit (immutability enables audit trail)

---

#### Dimension Assessment

**D1: Semantic Scope = UNIVERSAL**

Evidence:
- ✅ "Transaction immutability" universal in retail/accounting
- ✅ Accounting standards require immutable completed transactions
- ✅ E-commerce orders immutable after processing
- ✅ Clinic appointments immutable after completion

**D2: Industry Invariance = INVARIANT**

Evidence:
- ✅ **Accounting principle:** Completed transactions must not be modified
- ✅ **Audit requirement:** Immutable records for compliance
- ✅ **Finance analogy:** Posted journal entries immutable
- ✅ **Healthcare analogy:** Finalized encounters immutable

**Critical Observation:**

This is NOT a "capability" in the sense of a domain engine.

This is a **CONTRACT INVARIANT** that applies to Sale Transaction capability.

**D3-D5: Not Applicable (This is a constraint, not a capability)**

---

#### Decision: 📋 **CONTRACT INVARIANT** (Not a separate engine)

**Rationale:**
- Sale Immutability is NOT an independent capability
- It's a **constraint** on Sale Transaction lifecycle
- Should be expressed as Retail OS contract rule, not separate engine

**Confidence:** HIGH

**Proposed Implementation:**

```text
Retail OS: Sale Transaction Contract

Invariant: IMMUTABILITY_AFTER_COMPLETION

Rule:
  WHEN sale.status = 'DRAFT'
    THEN mutations allowed (add items, discount, cancel)
    
  WHEN sale.status = 'COMPLETED'
    THEN mutations FORBIDDEN
    AND status transition one-way (DRAFT → COMPLETED only)
    AND completion timestamp immutable

Contract:
  interface ISaleTransaction {
    createDraftSale(...): Sale  // status = DRAFT
    addItem(saleId, ...): Sale  // ONLY if status = DRAFT
    completeSale(saleId): Sale  // DRAFT → COMPLETED transition
    // NO updateCompletedSale() method (enforces immutability)
  }

Evidence: Universal accounting/audit requirement
```

**Classification Corrected:**

```text
BEFORE: "Capability #3: Sale Immutability"
AFTER:  "Contract Invariant: Sale Transaction Immutability"

NOT extracted as separate engine.
Embedded as constraint in Sale Transaction contract.
```

**Risk Assessment:**
- ⚠️ Risk if treated as separate engine: HIGH (unnecessary complexity)
- ✅ Risk if treated as contract rule: LOW (clear constraint)
- ✅ Approach: Embed in Sale Transaction contract

---

## Tier 2: Moderate Ambiguity (Assessed Second)

---

### Capability #4: Sales Transaction

**Observable Behavior (Evidence):**
- Start sale (create DRAFT)
- Add sale items (product, quantity, unit_price, discount)
- Apply sale-level discount
- Calculate total (subtotal + tax - discount)
- Complete sale (DRAFT → COMPLETED + immutability boundary)
- Optional customer association

**Cross-Domain Interactions:**
- → Customer (optional sale-customer link)
- → Product (sale items reference products)
- → Inventory (completion triggers movement)
- → Payment (payment_method + payment_status)
- ← Sale Immutability (enforces draft/completed rules)

---

#### Dimension Assessment

**D1: Semantic Scope = UNIVERSAL**

Evidence:
- ✅ "Sale transaction" exists in ALL retail models
- ✅ E-commerce has orders (same semantic)
- ✅ Clinic has service transactions
- ✅ Warehouse has B2B transactions

**D2: Industry Invariance = STABLE**

Evidence:
- ✅ Draft → Complete lifecycle universal
- ✅ Line items + totals calculation standard
- ⚠️ **BUT:** Payment processing varies significantly (POS: immediate, E-commerce: gateway, Clinic: insurance)
- ⚠️ **AND:** Checkout workflow varies (POS: scan+pay, E-commerce: cart+checkout, Clinic: appointment+billing)

**Critical Observation:**

```text
Core semantic STABLE:
- Create transaction
- Add line items
- Calculate total
- Complete transaction (immutability boundary)

Orchestration VARIES:
- Payment processing (immediate vs deferred vs insurance)
- Checkout workflow (POS vs online vs appointment-based)
- Customer interaction (cashier vs self-service vs staff-initiated)
```

**D3: Reuse Potential = HIGH (for core) / LOW (for orchestration)**

Test:
- Retail Store: ✅ Uses sale transaction (POS checkout flow)
- E-commerce: ✅ Uses order transaction (online checkout flow)
- Clinic: ✅ Uses service transaction (appointment billing flow)
- Warehouse: ✅ Uses B2B transaction (order management flow)

**Contract Test (Core):**
```typescript
interface ISaleTransaction {
  createDraft(tenantId, customerId?): Sale
  addItem(saleId, productId, quantity, price, discount): SaleItem
  calculateTotal(saleId): Amount
  completeSale(saleId, paymentMethod): Sale
}
```

**Assessment:** Core contract reusable ✅

**Contract Test (Orchestration):**
```typescript
// POS-specific orchestration
scanProduct → addItem → calculateTotal → processPayment → completeSale → printReceipt

// E-commerce-specific orchestration
addToCart → viewCart → checkout → selectPayment → processPayment → confirmOrder → sendEmail

// Different workflows = NOT reusable as single contract
```

**Assessment:** Orchestration NOT reusable ❌

**D4: Product Coupling = WEAKLY COUPLED (core) / COUPLED (orchestration)**

Evidence:
- ✅ Core operations: Weakly coupled (createDraft, addItem, complete)
- ❌ Orchestration: Coupled to product workflow (POS checkout sequence)

**D5: Ownership Stability = SEMI-STABLE**

Evidence:
- ✅ Core semantic stable (draft → complete universal)
- ⚠️ Payment methods evolve (new payment types added)
- ⚠️ Tax calculation rules business-dependent
- ⚠️ Discount rules business-dependent

**Contract Stability Test:**
```text
Core operations stable:
  createDraft, addItem, completeSale → Unlikely to change

Extensions likely:
  Payment methods → New types added (cryptocurrency, BNPL)
  Discount rules → Business-specific rules
  Tax calculation → Regional variations

Assessment: Core STABLE, Extensions SEMI-STABLE
```

---

#### Decision: ⚠️ **PARTIAL EXTRACTION** (Core primitives to Retail OS, Orchestration in Product)

**Rationale:**
- Core sale transaction semantic UNIVERSAL + STABLE
- Orchestration workflows PRODUCT-SPECIFIC
- Extract core, keep orchestration in Product

**Confidence:** MEDIUM (requires careful contract design)

**Proposed Structure:**

```text
Retail OS: R3 - Sale Transaction Engine

Core Capabilities (EXTRACT):
- Create draft sale
- Add/remove line items
- Calculate totals (subtotal, tax, discount, final)
- Complete sale (DRAFT → COMPLETED transition)
- Enforce immutability invariant

Contract: ISaleTransactionContract (frozen core operations)

Extensions (DEFERRED to Product):
- Payment processing (Product integrates payment gateway)
- Checkout workflow (Product defines sequence)
- Receipt generation (Product-specific format)
- Customer notification (Product-specific channels)

Evidence: Core transaction pattern universal, orchestration varies
```

**Architecture:**

```text
Product Layer (POS):
  POS Checkout Service
    ↓ (orchestrates)
  Retail OS: Sale Transaction Contract
    ├─ createDraft()
    ├─ addItem()
    ├─ calculateTotal()
    └─ completeSale()
    ↓
  Sale Transaction Engine (Retail OS)

Product Layer (E-commerce):
  E-commerce Cart Service
    ↓ (orchestrates)
  Retail OS: Sale Transaction Contract (SAME interface)
    └─ [reuses engine]
```

**Risk Assessment:**
- ⚠️ Risk of complex boundary: MEDIUM (partial extraction harder than full extract/keep)
- ⚠️ Risk of orchestration leakage: MEDIUM (Product must NOT bypass contract)
- ⚠️ Risk of contract instability: LOW (core operations stable)

**Warning:** PARTIAL extraction adds complexity. Only justified if core reuse HIGH + orchestration clearly Product-specific.

**Assessment:** Justified ✅ (transaction core universal, checkout workflow varies)

---

### Capability #5: Stock Availability

**Observable Behavior (Evidence):**
- Check product availability for requested quantity
- Validate sufficient stock before sale completion
- Detect reorder needs (current_stock < reorder_point)
- Return availability result (boolean + current stock + reorder flag)

**Cross-Domain Interactions:**
- → Product (reads current_stock, track_inventory flag)
- → Sale (validates stock before completion)
- ← Inventory Movement (stock changes affect availability)

---

#### Dimension Assessment

**D1: Semantic Scope = COMMON**

Evidence:
- ✅ Stock availability exists in MOST retail models
- ✅ E-commerce shows "In Stock" / "Out of Stock"
- ✅ Clinic checks supply availability
- ⚠️ B2B warehouse may not enforce stock checks (backorder allowed)
- ⚠️ Digital products (e.g., software) have no inventory

**D2: Industry Invariance = STABLE**

Evidence:
- ✅ Availability check semantic standard (quantity available?)
- ✅ Reorder detection universal pattern
- ⚠️ **BUT:** Availability rules vary (real-time vs reserved vs allocated)
- ⚠️ **AND:** Multi-location availability complex (store vs warehouse)

**Critical Observation:**

```text
Core operation STABLE:
- "Is quantity X available for product Y?"
  
Availability semantic VARIES:
- POS: Real-time stock check (current_stock ≥ quantity)
- E-commerce: Reserved stock (allocated but not yet shipped)
- Multi-location: Aggregated availability (store + warehouse)
- B2B: Backorder allowed (availability = unlimited)
```

**D3: Reuse Potential = MEDIUM**

Test:
- Retail Store: ✅ Real-time stock check
- E-commerce: ⚠️ Reserved stock (different semantic)
- Clinic: ✅ Supply availability check
- Warehouse: ⚠️ Backorder logic (no hard enforcement)

**Contract Test:**
```typescript
interface IStockAvailability {
  checkAvailability(productId, quantity): AvailabilityResult
  detectReorderNeeds(tenantId): Product[]
}
```

**Assessment:** Contract reusable for 2-3 products, requires variants for others ⚠️

**D4: Product Coupling = WEAKLY COUPLED**

Evidence:
- ✅ Simple query operation (no workflow)
- ✅ No UI dependencies
- ⚠️ Depends on Product context (track_inventory flag)

**D5: Ownership Stability = STABLE (for simple check) / VOLATILE (for complex availability)**

Evidence:
- ✅ Simple availability check (current_stock ≥ quantity) stable
- ⚠️ Reserved stock, allocated stock, multi-location logic business-dependent
- ⚠️ Availability rules evolve (e.g., safety stock, lead time)

---

#### Decision: ⚠️ **PARTIAL EXTRACTION** (Simple check to Retail OS, Complex rules in Product)

**Rationale:**
- Simple availability check (current_stock ≥ quantity) UNIVERSAL + STABLE
- Complex availability rules (reservation, allocation, multi-location) PRODUCT-SPECIFIC
- Extract simple primitive, defer complex rules

**Confidence:** MEDIUM (boundary risk)

**Proposed Structure:**

```text
Retail OS: R2 - Inventory Movement Engine (extend)

Add Capability: Simple Stock Check
- getCurrentStock(productId): number
- checkSimpleAvailability(productId, quantity): boolean
- detectReorderNeeds(tenantId, reorderPoint): Product[]

Contract: IInventoryContract (extended with availability primitives)

Complex Availability (KEEP in Product):
- Reserved stock tracking (E-commerce)
- Allocated stock (fulfillment)
- Multi-location aggregation (store + warehouse)
- Backorder logic (B2B)

Evidence: Simple check universal, complex rules business-specific
```

**Alternative Decision: ❌ KEEP (Defer to Product)**

**Rationale (Alternative):**
- Availability semantic varies significantly across retail models
- Risk of contract instability if complex rules added later
- Simple check can be implemented in Product layer without duplication

**Trade-off:**
```text
PARTIAL extraction:
  + Reuses simple availability primitive
  - Adds boundary complexity
  - Risk of contract bloat if extended
  
KEEP in Product:
  + Simpler boundary (no partial extraction)
  + Product controls availability rules
  - Minor duplication across products (simple check logic)
```

**Assessment:** Lean toward **KEEP** unless Product #2 demonstrates clear reuse need.

**Revised Decision: ❌ KEEP in Product (Defer extraction)**

**Rationale:** Availability rules too variable, simple check not worth extraction complexity.

---

## Tier 3: High Ambiguity (Assessed Last)

---

### Capability #6: Customer Management

**Observable Behavior (Evidence):**
- Register customer (email/phone identity)
- Loyalty tier management (BRONZE/SILVER/GOLD/PLATINUM)
- Customer status (ACTIVE/INACTIVE/BLOCKED)
- Optional customer association with sales

**Cross-Domain Interactions:**
- ← Sale (sales optionally link to customer)
- → Loyalty program (tier + points)

---

#### Dimension Assessment

**D1: Semantic Scope = COMMON**

Evidence:
- ✅ Customer registration exists in MANY retail models (POS, E-commerce, Clinic)
- ⚠️ B2B warehouse may use Account/Company instead of Customer
- ⚠️ Some retail models anonymous (no customer registration)
- ⚠️ Loyalty programs NOT universal (many stores don't use tiers)

**D2: Industry Invariance = VARIANT**

Evidence:
- ⚠️ "Customer" semantic varies significantly:
  - POS: In-store customer (loyalty program, purchase history)
  - E-commerce: Online account (shipping address, wishlist, reviews)
  - Clinic: Patient (medical records, appointments)
  - B2B: Corporate account (credit terms, contracts)
- ⚠️ Registration workflow varies (self-service vs staff-initiated vs automatic)
- ⚠️ Loyalty tier semantic business-specific (points vs spend vs visits)

**Critical Observation:**

```text
Core identity STABLE:
- "Customer identified by email/phone"

Everything else VARIES:
- Loyalty program (store-specific rules)
- Registration workflow (POS vs online vs clinic)
- Customer attributes (shipping address vs medical history vs credit terms)
- Customer-sale relationship (optional vs required vs anonymous)
```

**D3: Reuse Potential = MEDIUM (identity) / LOW (loyalty, attributes)**

Test:
- Retail Store: ✅ Customer registration + loyalty
- E-commerce: ⚠️ User account (different attributes: shipping, password, wishlist)
- Clinic: ⚠️ Patient (different attributes: medical history, insurance)
- Warehouse: ❌ Corporate account (completely different semantic)

**Contract Test (Identity):**
```typescript
interface ICustomerIdentity {
  registerCustomer(email, phone, name): Customer
  getCustomer(customerId): Customer
}
```

**Assessment:** Identity contract reusable ⚠️

**Contract Test (Loyalty):**
```typescript
interface ILoyaltyProgram {
  getLoyaltyTier(customerId): Tier
  awardPoints(customerId, points): void
  redeemPoints(customerId, points): void
}
```

**Assessment:** Loyalty contract NOT reusable (business-specific rules) ❌

**D4: Product Coupling = COUPLED**

Evidence:
- ⚠️ Registration workflow Product-specific (POS staff vs online self-service)
- ⚠️ Loyalty tier rules business-specific (points calculation varies)
- ⚠️ Customer attributes vary by product type

**D5: Ownership Stability = VOLATILE**

Evidence:
- ✅ Customer identity stable (email/phone)
- ❌ Loyalty program rules business-negotiable (frequent changes)
- ❌ Customer attributes evolve per business needs
- ⚠️ Customer-sale relationship varies (optional POS, required e-commerce)

**Contract Stability Test:**
```text
Product #2 (E-commerce): Can use same Customer contract?
  Identity: ✅ YES (email/phone registration)
  Loyalty: ❌ NO (different loyalty program)
  Attributes: ❌ NO (needs shipping address, not loyalty tier)
  
Product #3 (Clinic): Can use same Customer contract?
  Identity: ⚠️ PARTIAL (Patient vs Customer semantic)
  Loyalty: ❌ NO (clinics don't use loyalty tiers)
  Attributes: ❌ NO (needs medical records, not purchase history)
```

---

#### Decision: ❌ **KEEP in Product**

**Rationale:**
- Customer semantic VARIES significantly across retail models
- Loyalty program rules BUSINESS-SPECIFIC and VOLATILE
- Registration workflow PRODUCT-SPECIFIC
- Contract instability HIGH (attributes evolve per business)

**Confidence:** MEDIUM (some reuse possible for identity, but not worth extraction)

**Why NOT extract identity only?**

```text
Customer Identity (email/phone):
  Reuse potential: MEDIUM
  Complexity: LOW
  
BUT:
  Platform already has Party/Identity primitives
  Customer identity → Party identity mapping
  No value in Retail-specific customer identity layer
  
Decision: Use Platform Party primitives, keep retail-specific attributes in Product
```

**Recommendation:**

```text
Product Layer (POS):
  Customer Management Service
    ↓ (uses)
  Platform: Party Identity (email/phone)
    ↓
  Product-specific: Loyalty tier, purchase history

Product Layer (E-commerce):
  User Account Service
    ↓ (uses)
  Platform: Party Identity (SAME primitives)
    ↓
  Product-specific: Shipping address, wishlist

NO Retail OS Customer Engine needed
```

**Risk Assessment:**
- ⚠️ Risk of duplication: MEDIUM (loyalty logic may duplicate)
- ✅ Risk acceptable: Business rules too variable for shared contract
- ✅ Platform Party primitives sufficient for identity reuse

---

### Capability #7: Pricing Management

**Observable Behavior (Evidence):**
- Base price vs cost price (product-level)
- Line-level discounts (sale item discount)
- Sale-level discounts (applied to subtotal)
- Tax calculation (10% hardcoded)
- Final amount = subtotal + tax - sale discount

**Cross-Domain Interactions:**
- → Product (base_price, cost_price)
- → Sale Item (unit_price, line_discount)
- → Sale (sale_discount, tax_amount, total_amount)

---

#### Dimension Assessment

**D1: Semantic Scope = NARROW**

Evidence:
- ⚠️ Multi-level pricing (product + line + sale) common in SOME retail
- ⚠️ E-commerce uses different pricing (promo codes, cart-level coupons)
- ⚠️ Clinic uses service pricing (insurance rates, patient copay)
- ⚠️ B2B uses contract pricing (volume discounts, negotiated rates)
- ❌ Tax calculation rules HIGHLY variable (region, product type, business rules)

**D2: Industry Invariance = VARIANT**

Evidence:
- ❌ Pricing rules vary significantly:
  - POS: Base price + manual discount
  - E-commerce: Dynamic pricing + promo codes + abandoned cart discounts
  - Clinic: Insurance rate + copay + adjustment
  - B2B: Contract pricing + volume tiers + payment terms discount
- ❌ Tax calculation business-dependent (flat rate vs tiered vs exempt)
- ❌ Discount rules business-negotiable (loyalty discount, seasonal, clearance)

**Critical Observation:**

```text
NO stable pricing semantic across retail models.

POS Pricing:
  base_price - manual_discount + tax

E-commerce Pricing:
  list_price - promo_code - cart_discount + shipping + tax

Clinic Pricing:
  insurance_rate + copay - adjustment (no tax)

B2B Pricing:
  contract_rate - volume_discount - early_payment_discount (VAT varies)
```

**D3: Reuse Potential = LOW**

Test:
- Retail Store: ✅ Uses POS pricing (base + discount + tax)
- E-commerce: ❌ Uses promo code system (different rules)
- Clinic: ❌ Uses insurance pricing (completely different)
- Warehouse: ❌ Uses contract pricing (negotiated rates)

**Contract Test:**
```typescript
interface IPricingEngine {
  calculatePrice(basePrice, lineDiscount, saleDiscount, taxRate): Amount
}
```

**Assessment:** Contract NOT reusable (pricing rules too variable) ❌

**D4: Product Coupling = COUPLED**

Evidence:
- ⚠️ Pricing rules embedded in business workflow
- ⚠️ Discount logic business-specific (who can apply? when? how much?)
- ⚠️ Tax calculation region/product-dependent

**D5: Ownership Stability = VOLATILE**

Evidence:
- ❌ Pricing rules frequently change per business needs
- ❌ Discount strategies business-negotiable (promotions, seasons, clearance)
- ❌ Tax rules region-dependent and change frequently
- ❌ Contract would break with every pricing strategy change

**Contract Stability Test:**
```text
Product #2: Can use same Pricing contract?
  ❌ NO - E-commerce uses promo codes, not line/sale discounts
  
Product #3: Can use same Pricing contract?
  ❌ NO - Clinic uses insurance rates, not base price + discount

Assessment: Pricing semantic NOT universal
```

---

#### Decision: ❌ **KEEP in Product**

**Rationale:**
- Pricing semantic VARIES across retail models (no invariance)
- Pricing rules VOLATILE (business-negotiable, frequent changes)
- Tax calculation region/business-dependent
- Discount strategies business-specific
- Contract instability VERY HIGH

**Confidence:** LOW (but decision clear: do NOT extract)

**Why NOT extract pricing primitives?**

```text
Could extract: calculateSubtotal(items), applyDiscount(amount, rate), addTax(amount, rate)

BUT:
  - These are trivial arithmetic functions (amount * rate)
  - No business value in "Pricing Primitives Engine"
  - Pricing LOGIC (rules, when to apply, who can apply) is business-specific
  - Extracting arithmetic without logic = premature abstraction

Decision: Keep pricing logic in Product layer
```

**Recommendation:**

```text
Product Layer (POS):
  POS Pricing Service
    - Business rules: base price + manual discount + flat tax
    - Implements POS-specific pricing workflow

Product Layer (E-commerce):
  E-commerce Pricing Service
    - Business rules: list price + promo codes + dynamic tax
    - Implements e-commerce-specific pricing workflow

NO Retail OS Pricing Engine
```

**Risk Assessment:**
- ⚠️ Risk of duplication: HIGH (pricing logic in every product)
- ✅ Risk acceptable: Pricing rules too variable for shared contract
- ✅ Duplication preferred over brittle abstraction

---

## Assessment Summary & Recommendations

### Classification Results

| Decision | Count | Capabilities |
|----------|-------|--------------|
| ✅ **EXTRACT** | 2 | Product Management, Inventory Movement |
| ⚠️ **PARTIAL** | 1 | Sales Transaction (core only) |
| 📋 **CONTRACT** | 1 | Sale Immutability (constraint, not engine) |
| ❌ **KEEP** | 3 | Stock Availability, Customer Management, Pricing Management |
| ⏸️ **DEFER** | 0 | None |

---

### Recommended Retail OS Structure

Based on assessment, recommend **MINIMAL Retail OS** with 2-3 core engines:

```text
Retail OS (Kernel)
├── R1: Product Catalog Engine ✅
│   - Product CRUD operations
│   - SKU-based identity
│   - Status lifecycle
│   - Pricing attributes
│
├── R2: Inventory Movement Engine ✅
│   - Stock movement recording
│   - Audit trail
│   - Reorder detection
│   - Simple availability check (extend from R2)
│
└── R3: Sale Transaction Engine ⚠️
    - Draft sale creation
    - Line item management
    - Total calculation
    - Sale completion
    - Immutability enforcement (contract invariant)

NOT extracted:
- ❌ Customer Management → Product layer
- ❌ Pricing Management → Product layer
- ❌ Stock Availability → Product layer (or extend R2 minimally)
```

---

### Confidence Assessment

| Engine | Confidence | Risk | Justification |
|--------|-----------|------|---------------|
| R1: Product Catalog | **HIGH** | LOW | Universal semantic, stable contract |
| R2: Inventory Movement | **HIGH** | LOW | Universal semantic, audit requirement |
| R3: Sale Transaction | **MEDIUM** | MEDIUM | Core stable, orchestration varies (partial extraction) |

---

### Decision Recommendation

**Option A: Extract R1 + R2 + R3 (Minimal Retail OS)**

**Pros:**
- 2 HIGH-confidence engines (R1, R2)
- 1 MEDIUM-confidence engine (R3) with careful boundary
- Minimal complexity (3 engines, not 7)
- Clear Product layer responsibilities (customer, pricing)

**Cons:**
- R3 partial extraction adds boundary complexity
- Single Product validation (no Product #2 yet)

**Confidence:** MEDIUM-HIGH

---

**Option B: Extract R1 + R2 only, Defer R3**

**Pros:**
- Both HIGH-confidence engines
- Simpler boundary (no partial extraction)
- R3 deferred until Product #2 validates orchestration separation

**Cons:**
- Sale Transaction duplication in Product #2 (if built)
- Missed reuse opportunity for core transaction semantic

**Confidence:** HIGH

---

**Option C: Build Product #2 before extracting**

**Pros:**
- Validates reuse across 2 products
- Clarifies R3 orchestration boundary
- Reduces risk of premature abstraction

**Cons:**
- Delays Retail OS extraction
- R1 + R2 already HIGH-confidence (Product #2 unlikely to change assessment)

**Confidence:** HIGH (but slower)

---

### My Recommendation: **Option A** (Extract R1 + R2 + R3)

**Rationale:**

1. ✅ **R1 Product Catalog:** HIGH confidence, universal semantic, LOW risk
2. ✅ **R2 Inventory Movement:** HIGH confidence, audit requirement, LOW risk
3. ⚠️ **R3 Sale Transaction:** MEDIUM confidence, but core semantic stable
   - Extract core operations (create, add item, complete)
   - Product orchestrates (checkout flow, payment)
   - Boundary clear: Contract defines core primitives, Product composes workflow

4. ❌ **Customer, Pricing, Stock Availability:** Keep in Product
   - Semantic too variable OR too simple to extract
   - Platform primitives sufficient (Party for identity)

**Risk Mitigation for R3:**

```text
Retail OS: R3 Sale Transaction Engine

Contract: FROZEN core operations only
  - createDraft(tenantId, customerId?): Sale
  - addItem(saleId, productId, quantity, price): SaleItem
  - calculateTotal(saleId): Amount
  - completeSale(saleId, paymentMethod): Sale

Product: Orchestration layer
  - Checkout workflow (POS: scan → pay → receipt)
  - Payment processing (integrate gateway)
  - Business rules (discount approval, refund policy)

Boundary Rule:
  Product MUST NOT bypass Sale Transaction contract
  Product MUST use contract primitives for all sale operations
```

---

### Alternative Recommendation: **Option B** (Extract R1 + R2 only)

If you prefer **maximum safety** and **minimal boundary complexity**:

```text
Retail OS (Initial):
├── R1: Product Catalog Engine ✅
└── R2: Inventory Movement Engine ✅

Deferred to Product #2:
⏸️ R3: Sale Transaction Engine (validate orchestration separation first)

Keep in Product:
❌ Customer Management
❌ Pricing Management
❌ Stock Availability
```

**This is the LEAN option:** Extract only what's proven universal, defer R3 until validated.

---

## Next Decision Gate

**Human Architect must choose:**

1. **Option A:** Extract R1 + R2 + R3 (Minimal Retail OS with 3 engines)
2. **Option B:** Extract R1 + R2 only (Ultra-minimal, defer R3)
3. **Option C:** Build Product #2 before extracting (Maximum validation)

**My recommendation:** **Option A** (balanced: proven engines + careful R3 boundary)

**Conservative recommendation:** **Option B** (safest: only HIGH-confidence engines)

---

**Assessment Status:** ✅ COMPLETE  
**Decision Authority:** Human Architect  
**Blocking:** None (awaiting decision)  
**Author:** Kiro AI Agent  
**Date:** 2026-09-06
omer Management → Product layer
- ❌ Pricing Management → Product layer
- ❌ Stock Availability → Product layer (or extend R2 minimally)
```

---

### Confidence Assessment

| Engine | Confidence | Risk | Justification |
|--------|-----------|------|---------------|
| R1: Product Catalog | **HIGH** | LOW | Universal semantic, stable contract |
| R2: Inventory Movement | **HIGH** | LOW | Universal semantic, audit requirement |
| R3: Sale Transaction | **MEDIUM** | MEDIUM | Core stable, orchestration varies (partial extraction) |

---

### Decision Recommendation

**Option A: Extract R1 + R2 + R3 (Minimal Retail OS)**

**Pros:**
- 2 HIGH-confidence engines (R1, R2)
- 1 MEDIUM-confidence engine (R3) with careful boundary
- Minimal complexity (3 engines, not 7)
- Clear Product layer responsibilities (customer, pricing)

**Cons:**
- R3 partial extraction adds boundary complexity
- Single Product validation (no Product #2 yet)

**Confidence:** MEDIUM-HIGH

---

**Option B: Extract R1 + R2 only, Defer R3**

**Pros:**
- Both HIGH-confidence engines
- Simpler boundary (no partial extraction)
- R3 deferred until Product #2 validates orchestration separation

**Cons:**
- Sale Transaction duplication in Product #2 (if built)
- Missed reuse opportunity for core transaction semantic

**Confidence:** HIGH

---

**Option C: Build Product #2 before extracting**

**Pros:**
- Validates reuse across 2 products
- Clarifies R3 orchestration boundary
- Reduces risk of premature abstraction

**Cons:**
- Delays Retail OS extraction
- R1 + R2 already HIGH-confidence (Product #2 unlikely to change assessment)

**Confidence:** HIGH (but slower)

---

### My Recommendation: **Option A** (Extract R1 + R2 + R3)

**Rationale:**

1. ✅ **R1 Product Catalog:** HIGH confidence, universal semantic, LOW risk
2. ✅ **R2 Inventory Movement:** HIGH confidence, audit requirement, LOW risk
3. ⚠️ **R3 Sale Transaction:** MEDIUM confidence, but core semantic stable
   - Extract core operations (create, add item, complete)
   - Product orchestrates (checkout flow, payment)
   - Boundary clear: Contract defines core primitives, Product composes workflow

4. ❌ **Customer, Pricing, Stock Availability:** Keep in Product
   - Semantic too variable OR too simple to extract
   - Platform primitives sufficient (Party for identity)

**Risk Mitigation for R3:**

```text
Retail OS: R3 Sale Transaction Engine

Contract: FROZEN core operations only
  - createDraft(tenantId, customerId?): Sale
  - addItem(saleId, productId, quantity, price): SaleItem
  - calculateTotal(saleId): Amount
  - completeSale(saleId, paymentMethod): Sale

Product: Orchestration layer
  - Checkout workflow (POS: scan → pay → receipt)
  - Payment processing (integrate gateway)
  - Business rules (discount approval, refund policy)

Boundary Rule:
  Product MUST NOT bypass Sale Transaction contract
  Product MUST use contract primitives for all sale operations
```

---

### Alternative Recommendation: **Option B** (Extract R1 + R2 only)

If you prefer **maximum safety** and **minimal boundary complexity**:

```text
Retail OS (Initial):
├── R1: Product Catalog Engine ✅
└── R2: Inventory Movement Engine ✅

Deferred to Product #2:
⏸️ R3: Sale Transaction Engine (validate orchestration separation first)

Keep in Product:
❌ Customer Management
❌ Pricing Management
❌ Stock Availability
```

**This is the LEAN option:** Extract only what's proven universal, defer R3 until validated.

---

## Next Decision Gate

**Human Architect must choose:**

1. **Option A:** Extract R1 + R2 + R3 (Minimal Retail OS with 3 engines)
2. **Option B:** Extract R1 + R2 only (Ultra-minimal, defer R3)
3. **Option C:** Build Product #2 before extracting (Maximum validation)

**My recommendation:** **Option A** (balanced: proven engines + careful R3 boundary)

**Conservative recommendation:** **Option B** (safest: only HIGH-confidence engines)

---

**Assessment Status:** ✅ COMPLETE  
**Decision Authority:** Human Architect  
**Blocking:** None (awaiting decision)  
**Author:** Kiro AI Agent  
**Date:** 2026-09-06
