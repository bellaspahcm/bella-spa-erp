# P5.0 — Canonical Workflow Discovery

**Date:** 2026-09-11  
**Session:** 12 (Start)  
**Phase:** Phase 5 Cross-Capability Integration  
**Step:** P5.0 Canonical Workflow Discovery

---

## 🎯 Objective

Map actual cross-capability relationships from schema → identify integration invariants.

**Critical Principle:**  
4/4 capabilities CLOSED = each part works in isolation.  
Phase 5 = prove parts work together as integrated system.

---

## 📋 Schema Evidence

**Source:** `supabase/migrations/20260802150000_real_estate_core_schema.sql`

### Entity Relationship Map

```
┌─────────────────────────────────────────────────────────┐
│ PROJECTS (Project Catalog Context)                      │
│ - id, tenant_id, project_code, project_name            │
└──────────────────┬──────────────────────────────────────┘
                   │
                   │ project_id FK
                   ↓
┌─────────────────────────────────────────────────────────┐
│ PRODUCTS (Product Catalog Aggregate)                    │
│ - id, tenant_id, project_id                            │
│ - REFERENCES real_estate_projects(id) CASCADE          │
└──────┬──────────────────────────────────────────────────┘
       │
       │ product_id FK (RESTRICT)
       ↓
┌─────────────────────────────────────────────────────────┐
│ RESERVATIONS (Sales Context - Reservation Domain Model) │
│ - id, tenant_id                                         │
│ - product_id → REFERENCES products(id) RESTRICT        │
│ - customer_id → REFERENCES customers(id) RESTRICT      │
│ - status: pending_deposit → deposited → converted      │
└──────┬──────────────────────────────────────────────────┘
       │
       ├─────────────────────────────────────┐
       │                                     │
       │ product_id FK                       │ customer_id FK
       │ (RESTRICT)                          │ (RESTRICT)
       ↓                                     ↓
┌─────────────────────────┐      ┌──────────────────────────┐
│ PRODUCTS                │      │ CUSTOMERS                │
│ (verified capability)   │      │ (verified capability)    │
└─────────────────────────┘      └──────────────────────────┘
```

### Detailed Foreign Key Relationships

**re_reservations:**
```sql
product_id UUID NOT NULL REFERENCES real_estate_products(id) ON DELETE RESTRICT
customer_id UUID NOT NULL REFERENCES re_customers(id) ON DELETE RESTRICT
```

**re_bookings:**
```sql
product_id UUID NOT NULL REFERENCES real_estate_products(id) ON DELETE RESTRICT
customer_id UUID NOT NULL REFERENCES re_customers(id) ON DELETE RESTRICT
reservation_id UUID REFERENCES re_reservations(id) ON DELETE SET NULL
```

**re_contracts:**
```sql
product_id UUID NOT NULL REFERENCES real_estate_products(id) ON DELETE RESTRICT
customer_id UUID NOT NULL REFERENCES re_customers(id) ON DELETE RESTRICT
booking_id UUID REFERENCES re_bookings(id) ON DELETE SET NULL
```

---

## 🔗 Canonical Workflow

### Primary Flow

```
1. PROJECT created
        ↓
2. PRODUCT created (references PROJECT)
        ↓
3. CUSTOMER created (independent)
        ↓
4. RESERVATION created (references PRODUCT + CUSTOMER)
        ↓
   Status: pending_deposit → deposited → converted_to_contract
        ↓
5. BOOKING created (references PRODUCT + CUSTOMER + RESERVATION)
        ↓
   State: DRAFT → PENDING_APPROVAL → CONFIRMED
        ↓
6. CONTRACT created (references PRODUCT + CUSTOMER + BOOKING)
        ↓
   State: DRAFT → PENDING_APPROVAL → ACTIVE
```

### Dependency Chain

```
Projects (root)
    ↓ CASCADE
Products (depends on Projects)
    ↓ RESTRICT
Reservations (depends on Products + Customers)
    ↓ SET NULL (optional link)
Bookings (depends on Products + Customers, optional Reservation)
    ↓ SET NULL (optional link)
Contracts (depends on Products + Customers, optional Booking)
```

---

## 📊 Cross-Capability Relationships

### Verified Capabilities

**Projects:** 🔒 CLOSED (10 invariants)
- Can exist standalone
- Root of dependency tree

**Products:** 🔒 CLOSED (35 invariants)
- **Depends on:** Projects (project_id FK CASCADE)
- Cannot exist without Project

**Customers:** 🔒 CLOSED (38 invariants)
- Can exist standalone
- Independent of Projects/Products

**Reservations:** 🔒 CLOSED (count not reconciled)
- **Depends on:** Products (product_id FK RESTRICT)
- **Depends on:** Customers (customer_id FK RESTRICT)
- **Links:** Products ↔ Customers

### Integration Points

**1. Project → Product Integration**
- **Type:** Parent-child (CASCADE)
- **Invariant:** Product cannot exist without Project
- **Delete behavior:** Deleting Project cascades to Products
- **Already verified?** YES (P2 Products capability tested with project_id)

**2. Product + Customer → Reservation Integration**
- **Type:** Many-to-many junction (RESTRICT)
- **Invariant:** Reservation requires both Product AND Customer
- **Delete behavior:** Cannot delete Product/Customer with active Reservations
- **Already verified?** PARTIAL (individual capabilities verified, cross-capability not)

**3. Product Status ↔ Reservation Status Integration**
- **Type:** State synchronization
- **Invariant:** Product status should reflect Reservation state
- **Example:** Reserved Product → cannot create duplicate Reservation
- **Already verified?** NO (cross-capability invariant)

---

## 🧪 Phase 5 Scope (Preliminary)

### Cross-Capability Invariants to Verify

**Integration Invariants (NEW):**
1. **I1:** Cannot create Reservation for non-existent Product
2. **I2:** Cannot create Reservation for non-existent Customer
3. **I3:** Product status updates when Reservation created
4. **I4:** Cannot delete Product with active Reservations (FK RESTRICT)
5. **I5:** Cannot delete Customer with active Reservations (FK RESTRICT)
6. **I6:** Reservation respects Product tenant isolation
7. **I7:** Reservation respects Customer tenant isolation
8. **I8:** Cross-tenant Reservation blocked (Product from Tenant A + Customer from Tenant B)
9. **I9:** Reservation workflow: pending → deposited → converted
10. **I10:** Product availability check before Reservation

**Workflow Invariants (NEW):**
11. **W1:** End-to-end: Create Project → Product → Customer → Reservation
12. **W2:** Product cascade: Delete Project → Products deleted → Reservations blocked
13. **W3:** Reservation lifecycle: Create → Deposit → Convert → Product sold

**Tenant Boundary Invariants (NEW):**
14. **T1:** Cross-tenant Product access blocked in Reservation
15. **T2:** Cross-tenant Customer access blocked in Reservation
16. **T3:** Reservation tenant_id matches Product tenant_id
17. **T4:** Reservation tenant_id matches Customer tenant_id

**Deduplication Analysis:**
- I1-I2: Database FK constraints (already enforced, need verification)
- I6-I7, T1-T4: Tenant isolation (similar to existing capability RLS, but cross-capability)
- I3, I9-I10: Business logic invariants (NEW, not tested in capabilities)

---

## 🔒 FREEZE P5 SCOPE

**Total Preliminary Invariants:** 17

**Deduplication Needed:**
- Compare with Projects (10 invariants)
- Compare with Products (35 invariants)
- Compare with Customers (38 invariants)
- Compare with Reservations (count TBD)

**Next Step:** Map to existing capability evidence → identify TRUE new invariants.

---

## ⏭️ Next: P5.1 Scope Freeze

**Tasks:**
1. Review Projects/Products/Customers test evidence
2. Identify which P5 invariants already covered
3. Deduplicate and freeze EXACT P5 unique invariants
4. Create integration test scripts

**Do NOT proceed with testing until scope frozen.**

---

**P5.0 Discovery: ✅ COMPLETE**

_Canonical workflow mapped — ready for deduplication and scope freeze_

