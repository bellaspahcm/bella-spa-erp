# Phase 5: Final Cross-Capability Business Flow

**Product:** Bella Land v2  
**Phase:** 5 (Final Integration Verification)  
**Timing:** After all 4 capabilities sealed  
**Status:** ⚪ **PLANNED**

---

## 🎯 Purpose

Verify that all sealed capabilities work together as an integrated real estate sales workflow, not just as isolated modules.

**Why necessary:**
- Individual capability tests verify each entity in isolation
- Does NOT prove cross-capability integration works
- Does NOT prove business workflow integrity
- Real estate sales requires Project → Product → Customer → Reservation chain

**Analogy:** Unit tests PASS ≠ Integration tests PASS

---

## 🔗 Scope: End-to-End Real Estate Sales Flow

### Business Flow Under Test

```text
╔═══════════════════════════════════════════════════════════╗
║      BELLA LAND V2 — REAL ESTATE SALES WORKFLOW            ║
╚═══════════════════════════════════════════════════════════╝

STEP 1: Project Setup
       Create Project (Tenant A)
              ↓
       Project.tenant_id = A
       Project.status = active

STEP 2: Inventory Declaration
       Create Product/Apartment (Tenant A)
              ↓
       Product.tenant_id = A
       Product.project_id → Project A
       Product.product_type = 'apartment'
       Product.status = 'available'

STEP 3: Customer Onboarding
       Create Customer (Tenant A)
              ↓
       Customer.tenant_id = A
       Customer.name, phone, email

STEP 4: Reservation Creation
       Customer reserves Product
              ↓
       Reservation.tenant_id = A
       Reservation.customer_id → Customer A
       Reservation.product_id → Product A
       Reservation.status = 'pending_deposit'

STEP 5: State Transitions
       Product.status: available → booked
       Reservation lifecycle: pending → deposited → converted

───────────────────────────────────────────────────────────

VERIFY AT EACH STEP:
✅ Entity created with correct tenant_id
✅ Foreign keys reference correct parent entities
✅ Parent entities belong to same tenant
✅ Status transitions valid
✅ Data persists after each step
✅ Tenant B cannot see/modify any entity in chain
```

---

## 📋 Test Plan: P5.1 Authenticated End-to-End Flow

### Test Method

**Execution:** Authenticated multi-step workflow  
**Users:** 2 tenants (A and B) for isolation testing  
**Tools:** Script-based + browser verification

### Test Script: `scripts/bella-land/test-final-business-flow.ts`

**Structure:**

```typescript
// SETUP PHASE
const tenantA = await authenticateUser('tenant-a-admin');
const tenantB = await authenticateUser('tenant-b-admin');

// STEP 1: PROJECT (Tenant A)
const projectA = await createProject(tenantA, {
  name: 'Integration Test Project',
  description: 'Phase 5 business flow verification',
  status: 'active'
});
assert(projectA.tenant_id === tenantA.tenant_id);

// STEP 2: PRODUCT (Tenant A)
const productA = await createProduct(tenantA, {
  project_id: projectA.id,
  product_code: 'INT-001',
  product_type: 'apartment',
  status: 'available',
  area: 85.5,
  unit_price: 2500000000
});
assert(productA.tenant_id === tenantA.tenant_id);
assert(productA.project_id === projectA.id);

// STEP 3: CUSTOMER (Tenant A)
const customerA = await createCustomer(tenantA, {
  name: 'Integration Test Customer',
  phone: '0901234567',
  email: 'test@example.com'
});
assert(customerA.tenant_id === tenantA.tenant_id);

// STEP 4: RESERVATION (Tenant A)
const reservationA = await createReservation(tenantA, {
  customer_id: customerA.id,
  product_id: productA.id,
  deposit_amount: 50000000,
  status: 'pending_deposit'
});
assert(reservationA.tenant_id === tenantA.tenant_id);
assert(reservationA.customer_id === customerA.id);
assert(reservationA.product_id === productA.id);

// STEP 5: STATE TRANSITION
const updatedProduct = await getProduct(tenantA, productA.id);
assert(updatedProduct.status === 'booked'); // Should transition from 'available'

// STEP 6: CROSS-TENANT ISOLATION
const tenantBView = await queryAllEntities(tenantB);
assert(tenantBView.projects.length === 0 || !tenantBView.projects.some(p => p.id === projectA.id));
assert(tenantBView.products.length === 0 || !tenantBView.products.some(p => p.id === productA.id));
assert(tenantBView.customers.length === 0 || !tenantBView.customers.some(c => c.id === customerA.id));
assert(tenantBView.reservations.length === 0 || !tenantBView.reservations.some(r => r.id === reservationA.id));

// CLEANUP
await deleteTestData(tenantA, [projectA.id, productA.id, customerA.id, reservationA.id]);
```

---

## 🔐 P5.2 Cross-Entity Tenant Integrity

### Critical Validations

**V1: Project → Product Integrity**

```text
Product.tenant_id = A
Product.project_id → Project WHERE Project.tenant_id = A   ✅

Product.tenant_id = A
Product.project_id → Project WHERE Project.tenant_id = B   ❌ BLOCK
```

**How tested:** P2.2 A9/A10 (Products phase)

---

**V2: Customer → Reservation Integrity**

```text
Reservation.tenant_id = A
Reservation.customer_id → Customer WHERE Customer.tenant_id = A   ✅

Reservation.tenant_id = A
Reservation.customer_id → Customer WHERE Customer.tenant_id = B   ❌ BLOCK
```

**Test:**

```typescript
// Negative test: Cross-tenant customer reference
const tenantAReservation = await createReservation(tenantA, {
  customer_id: customerB.id,  // Tenant B customer
  product_id: productA.id,    // Tenant A product
  deposit_amount: 50000000
});

assert(tenantAReservation === null || tenantAReservation.error);
// Expected: BLOCKED by service validation or RLS
```

---

**V3: Product → Reservation Integrity**

```text
Reservation.tenant_id = A
Reservation.product_id → Product WHERE Product.tenant_id = A   ✅

Reservation.tenant_id = A
Reservation.product_id → Product WHERE Product.tenant_id = B   ❌ BLOCK
```

**Test:**

```typescript
// Negative test: Cross-tenant product reference
const tenantAReservation = await createReservation(tenantA, {
  customer_id: customerA.id,  // Tenant A customer
  product_id: productB.id,    // Tenant B product
  deposit_amount: 50000000
});

assert(tenantAReservation === null || tenantAReservation.error);
// Expected: BLOCKED by service validation or RLS
```

---

**V4: Multi-Hop Tenant Integrity**

```text
Reservation.customer_id → Customer.tenant_id = A   ✅
Reservation.product_id → Product.tenant_id = A     ✅
Product.project_id → Project.tenant_id = A         ✅

Full chain integrity verified: A → A → A → A
```

**Test:**

```typescript
// Verify entire chain belongs to same tenant
const reservation = await getReservation(tenantA, reservationA.id);
const customer = await getCustomer(tenantA, reservation.customer_id);
const product = await getProduct(tenantA, reservation.product_id);
const project = await getProject(tenantA, product.project_id);

assert(reservation.tenant_id === tenantA.tenant_id);
assert(customer.tenant_id === tenantA.tenant_id);
assert(product.tenant_id === tenantA.tenant_id);
assert(project.tenant_id === tenantA.tenant_id);
// Expected: All entities share same tenant_id (no chain break)
```

---

## 🖥️ P5.3 Browser End-to-End Workflow

### Manual Integration Test

**Purpose:** Verify UI workflow completes full business flow without errors

**Flow:**

```text
1. Login as Tenant A admin

2. Create Project
   Navigate: /dashboard/real-estate/projects
   Action: Create new project
   Verify: Project appears in list

3. Create Product/Apartment
   Navigate: /dashboard/real-estate/apartments
   Select: Project from step 2
   Action: Create apartment
   Verify: Apartment appears in inventory matrix

4. Create Customer
   Navigate: /dashboard/real-estate/customers
   Action: Create new customer
   Verify: Customer appears in list

5. Create Reservation
   Navigate: /dashboard/real-estate/apartments (or reservations page)
   Select: Apartment from step 3
   Action: Reserve for Customer from step 4
   Verify: Reservation created
   Verify: Apartment status changed (available → booked)

6. Reload All Pages
   Navigate: Each page from steps 2-5
   Verify: All data persists

7. Cross-Tenant Check
   Logout Tenant A
   Login as Tenant B
   Navigate: All pages
   Verify: Tenant A data NOT visible
```

**Evidence:** Screenshots at each step + final state verification

---

## 📊 P5.4 State Transition Verification

### Product Status Lifecycle

```text
available → booked → deposited → contracted → paid → handed_over
            ↑
            └─ cancelled (from any state)
```

**Test transitions:**

1. **Available → Booked:** Create reservation (pending_deposit)
2. **Booked → Deposited:** Update reservation (deposited)
3. **Deposited → Contracted:** Convert reservation to contract
4. **Any → Cancelled:** Cancel reservation

**Verification:**

```typescript
// Test: Product status follows reservation lifecycle
const product = await createProduct(tenantA, { status: 'available' });
const reservation = await createReservation(tenantA, { product_id: product.id });

const productAfterReserve = await getProduct(tenantA, product.id);
assert(productAfterReserve.status === 'booked');

await updateReservation(tenantA, reservation.id, { status: 'deposited' });
const productAfterDeposit = await getProduct(tenantA, product.id);
assert(productAfterDeposit.status === 'deposited');

await cancelReservation(tenantA, reservation.id);
const productAfterCancel = await getProduct(tenantA, product.id);
assert(productAfterCancel.status === 'available'); // Returns to available
```

---

## 📋 Success Criteria

| Criterion | Requirement | Verification |
|-----------|-------------|--------------|
| **SC1** | End-to-end flow completes | Script executes without errors |
| **SC2** | All entities created with correct tenant | Assert tenant_id at each step |
| **SC3** | Foreign keys valid | All parent references exist |
| **SC4** | Cross-entity integrity | No cross-tenant parent references |
| **SC5** | State transitions correct | Product status follows reservation |
| **SC6** | Data persistence | Reload/re-query returns same data |
| **SC7** | Cross-tenant isolation | Tenant B sees 0 Tenant A entities |
| **SC8** | Browser workflow completes | Manual test PASS |
| **SC9** | No console errors | Browser devtools clean |
| **SC10** | Evidence documented | Screenshots + script results |

**Result required:** 10/10 success criteria met

---

## 🎯 Deliverables

### Test Scripts (1 file)

1. `scripts/bella-land/test-final-business-flow.ts`
   - End-to-end authenticated workflow
   - Multi-step entity creation
   - Cross-tenant isolation verification
   - State transition validation

### Documentation (1 file)

1. `FINAL_BUSINESS_FLOW_VERIFICATION.md`
   - Test execution results
   - Screenshots (browser flow)
   - Cross-entity integrity evidence
   - State transition trace
   - Final RC readiness declaration

---

## 🔒 RC Final Seal Criteria

**After Phase 5 completion:**

```text
╔═══════════════════════════════════════════════════════════╗
║      BELLA LAND V2 — RC FINAL SEAL CRITERIA                ║
╚═══════════════════════════════════════════════════════════╝

Capability Evidence:
├─ Projects            🔒 SEALED (P1.0-P1.5 ✅)
├─ Products            🔒 SEALED (P2.0-P2.5 ✅)
├─ Customers           🔒 SEALED (P3.0-P3.5 ✅)
└─ Reservations        🔒 SEALED (Prior ✅)

Integration Evidence:
└─ Business Flow       🔒 SEALED (P5.1-P5.4 ✅)

Security Model:
├─ Row-level isolation     ✅ Verified all capabilities
├─ Cross-entity integrity  ✅ Verified hierarchical data
└─ Defense-in-depth        ✅ 5 layers verified

Evidence Quality:
├─ Test scripts            ✅ All capabilities + integration
├─ Browser runtime         ✅ All capabilities + integration
├─ Documentation           ✅ Complete
└─ Regression              ✅ No breaks

───────────────────────────────────────────────────────────
VERDICT:                   ✅ RC READY
FINAL RC STATUS:           🔒 SEALED
───────────────────────────────────────────────────────────
```

**Final seal document:** `BELLA_LAND_V2_RC_FINAL_SEAL.md`

---

## 📍 Execution Timeline

**Prerequisites:**
- ✅ Projects Phase 1 sealed
- 🟡 Products Phase 2 sealed (in progress)
- ⚪ Customers Phase 3 sealed (pending)
- ✅ Reservations Phase 4 sealed

**Estimated effort:** 2-3 hours
- Script development: 1 hour
- Test execution: 30 minutes
- Browser verification: 30 minutes
- Documentation: 30-60 minutes

**Timing:** Immediately after Customers Phase 3 sealed

---

## 🎉 Why This Matters

**Individual capability tests prove:**
- Projects create/read works ✅
- Products create/read works ✅
- Customers create/read works ✅
- Reservations create/read works ✅

**Does NOT prove:**
- Can I create Project → Product → Customer → Reservation in sequence?
- Do foreign keys resolve correctly across capabilities?
- Do tenant isolation rules hold across entity boundaries?
- Do state transitions propagate correctly?
- Does the actual business workflow work?

**Phase 5 proves:** **"Bella Land v2 works as a cohesive real estate sales platform, not just a collection of isolated features."**

---

**Phase 5:** ⚪ **PLANNED**  
**Execution:** → **After Customers (Phase 3) sealed**  
**Purpose:** → **Final integration verification before RC seal**

