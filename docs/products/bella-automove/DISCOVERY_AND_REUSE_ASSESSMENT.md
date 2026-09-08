# Bella AutoMove — Discovery & Reuse Assessment

**Date:** 2026-09-06  
**Status:** 🔍 DISCOVERY COMPLETE  
**Finding:** Significant automotive foundation exists, Product layer missing

---

## Discovery Summary

### What Exists

**✅ Database Schema (Complete):**
- `auto_service_appointments` — Service booking
- `auto_repair_orders` + `auto_repair_order_items` — Repair workflow
- `auto_service_history` — Service tracking
- `auto_warranty_claims` — Warranty management
- `auto_vehicles` — Vehicle registry
- `auto_customer_profiles` — Customer automotive data
- Tenant isolation via RLS (already configured)

**✅ Business Logic Services:**
- `VehicleStatusMachineService` — Vehicle state management
- `CustomerJourneyService` — Journey tracking
- `AutoCustomerProvider` — Customer 360
- `AutoSalesProvider` — Sales workflow
- `NPSSurveyService` + `CSISurveyService` — Experience tracking
- Rollback engines for business transactions

**✅ Tests:**
- Phase 5-8 database tests (service center, finance, trade-in)
- Integration tests for journey, sales, experience
- Unit tests for business services

**❌ Product Layer (MISSING):**
- No `src/products/bella-auto` or `bella-automove`
- No UI pages/components for auto shop operations
- No Product-level server actions
- No Product tests (architecture, conformance)
- No E2E tests
- No Product manifest

---

## Architecture Classification

### Existing Implementation Is NOT a Product

**What exists:** Infrastructure + Business Logic (Module layer)

**What's missing:** Product Assembly

```
Desired State:
─────────────
Product Layer (bella-automove)        ← MISSING
    │
    ├── UI (pages, components)        ← MISSING
    ├── Server Actions                ← MISSING
    ├── Product Tests                 ← MISSING
    └── E2E Tests                     ← MISSING

Module Layer (bella-auto)             ← EXISTS ✅
    │
    ├── Services (business logic)     ← EXISTS ✅
    ├── Components (shared UI)        ← PARTIAL
    └── Lib (utilities)               ← EXISTS ✅

Database Schema                       ← EXISTS ✅
```

### Why This Is Important

**Current state:** 
- Database + services exist
- Can be used programmatically
- **Cannot be used by end users** (no UI/Product)

**Target state:**
- Full Product (bella-automove)
- Auto shop can login and use the system
- Service orders, vehicles, invoices accessible via UI

---

## Reuse Assessment

### Platform Core — Full Reuse ✅

**Tenant isolation:**
- All automotive tables have `tenant_id`
- RLS policies configured
- Multi-tenant ready

**Auth/Authorization:**
- User roles already support automotive (shop manager, technician, etc.)
- RLS policies enforce tenant boundaries

**Audit:**
- Change tracking via Platform audit system

**Assessment:** **Full reuse confirmed, no changes needed**

---

### Existing Automotive Foundation — Reuse TBD

**What exists:**
- Database schema (vehicles, appointments, repair orders, service history, etc.)
- Business services (`src/modules/bella-auto/services/`)
- Database tests (Phase 5-8)
- Integration tests (journey, sales, experience)

**Reuse ratio:** **To be measured during construction**

**Approach:**
- Product layer will consume existing capabilities where applicable
- Document each reuse decision (why reuse vs rebuild)
- Measure actual reuse at completion
- **Do NOT estimate percentage upfront** (violates evidence-first principle)

**Evidence to collect:**
- LOC reused vs LOC new
- Capabilities reused (list with evidence)
- Integration points created
- Refactoring required (if any)

---

### Kernel Assessment

**Finance Kernel:**
- Invoicing, payments, financial tracking
- **Status:** Integration required (to be assessed during construction)

**Other Kernels:**
- Assessment during construction (reuse where applicable)

**Assessment:** **Integration needs to be measured, not estimated**

---

## Product Scope Definition

### Core Features (MVP)

**1. Vehicle Management**
- List vehicles for tenant
- View vehicle details (VIN, make, model, service history)
- Register new vehicle
- **Reuse:** `auto_vehicles` table + existing services

**2. Service Appointments**
- Create appointment
- View appointment list
- Update appointment status (pending → confirmed → checked-in → in-service → completed)
- **Reuse:** `auto_service_appointments` table + services

**3. Repair Orders**
- Create repair order from appointment
- Add repair items (labor + parts)
- Track order status
- **Reuse:** `auto_repair_orders` + `auto_repair_order_items`

**4. Parts Inventory (Basic)**
- View parts list
- Track parts usage on repair orders
- **Reuse:** Existing parts tables (if available) or minimal implementation

**5. Invoicing**
- Generate invoice from completed repair order
- Labor charges + parts charges
- Payment tracking
- **Reuse:** Finance Kernel patterns

### Non-MVP (Defer)

- Advanced inventory management
- Multi-location support
- Technician scheduling optimization
- Customer portal
- SMS/email notifications
- Analytics dashboard

---

## Factory P0 Integration Plan

### F-G1: Environment Preflight

**Required checks for AutoMove:**

**Database:**
- Connection to bella-auto database
- Required tables exist:
  - `auto_vehicles`
  - `auto_service_appointments`
  - `auto_repair_orders`
  - `auto_repair_order_items`
  - `auto_service_history`
- RLS policies enabled
- Table privileges for anon/authenticated roles

**Environment:**
- SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY
- Next.js config valid

**Configuration:**
- Automotive module manifest present
- Server actions registered
- Routes configuration

**Expected outcome:**
- F-G1 runs before E2E
- Catches DB configuration issues (like Bella Land)
- Saves time vs E2E debugging

### F-G3: Evidence Integrity

**Gates for AutoMove:**
- Product Tests (architecture, conformance, actions, DB)
- Browser E2E (vehicles, appointments, repair orders, invoices)
- Architecture Guard (boundaries, frozen Kernels)
- Production Build (route generation)
- Tenant Isolation (RLS verification)
- TypeScript (type safety)

**Expected outcome:**
- F-G3 validates at closure
- Prevents "fully verified" if any gate TIMEOUT/SKIPPED
- Accurate aggregated status (VERIFIED / PARTIALLY_VERIFIED / etc.)
- Evidence package generated automatically

---

## Construction Strategy

### Phase 1: Product Structure

**Goal:** Establish Product layer skeleton

**Tasks:**
1. Create `src/products/bella-automove/` directory
2. Product manifest (`product.config.ts`)
3. Product schema (`schema.ts` — types from DB)
4. Product tests skeleton (architecture, conformance)

**Validation:** Architecture Guard passes, Product recognized

### Phase 2: Server Actions

**Goal:** Product-specific business logic

**Tasks:**
1. Vehicle actions (list, get, create)
2. Appointment actions (list, create, update status)
3. Repair order actions (create, add items, complete)
4. Invoice actions (generate, get)

**Reuse:**
- Wrap existing `bella-auto` services
- Add Product-specific validation
- Implement Finance Kernel integration for invoicing

**Validation:** Product tests pass (actions, DB integration)

### Phase 3: UI Layer

**Goal:** Auto shop user interface

**Tasks:**
1. Dashboard page (overview)
2. Vehicles page (list + detail)
3. Appointments page (calendar + list)
4. Repair orders page (workflow)
5. Invoices page (list + detail)

**Validation:** Pages render, navigation works

### Phase 4: E2E Tests

**Goal:** Browser validation

**Tasks:**
1. F-G1 Preflight integration (beforeAll hook)
2. Vehicle workflow E2E
3. Appointment workflow E2E
4. Repair order workflow E2E
5. Invoice generation E2E

**Validation:** 17/17 E2E tests pass (target)

### Phase 5: Factory Closure

**Goal:** Evidence package + F-G3 validation

**Tasks:**
1. Run all gates (tests, E2E, build, Architecture Guard)
2. F-G3 Evidence Integrity validation
3. Generate evidence report
4. Document effectiveness (F-G1 issues caught, F-G3 claims validated)

**Validation:** Evidence integrity PASS, aggregated status accurate

---

## Success Metrics

### Product Success

**Functional:**
- ✅ Auto shop can manage vehicles
- ✅ Auto shop can create/track service appointments
- ✅ Auto shop can manage repair orders
- ✅ Auto shop can generate invoices
- ✅ Tenant isolation verified

**Quality:**
- ✅ Product tests PASS (target: 20+)
- ✅ E2E tests PASS (target: 15+)
- ✅ Architecture Guard PASS
- ✅ Production build SUCCESS
- ✅ No TIMEOUT/SKIPPED gates hidden in "verified"

### Factory P0 Success

**F-G1 Effectiveness:**
- ✅ Catches ≥1 environment issue before E2E
- ✅ Saves >15 min vs E2E debugging
- ✅ False positive rate <10%

**F-G3 Effectiveness:**
- ✅ Prevents ≥1 false "verified" claim
- ✅ Aggregated status = accurate
- ✅ Evidence package complete
- ✅ Integration smooth (no blockers)

### Factory Evolution Evidence

**Measure:**
- Time saved (F-G1 preflight vs E2E debug)
- Issues caught early
- False positives encountered
- Evidence integrity violations prevented
- Overall Product construction time

**Document:**
- `BELLA_AUTOMOVE_P0_FIELD_VALIDATION.md`
- Effectiveness measurements
- Iteration recommendations

---

## Risk Mitigation

### Technical Risks

**Risk: Existing services not Product-ready**
- Mitigation: Wrap services in Product actions, add validation layer

**Risk: Finance Kernel integration complex**
- Mitigation: Start with minimal invoicing, iterate based on complexity

**Risk: RLS policies incomplete**
- Mitigation: F-G1 will catch missing policies before E2E

### Factory P0 Risks

**Risk: F-G1 false positives high**
- Mitigation: Refine checks based on automotive-specific needs

**Risk: F-G3 over-constrains workflow**
- Mitigation: Document issues, iterate guards if needed

**Risk: Integration blockers**
- Mitigation: P0 design allows iteration (not production-critical yet)

---

## Decision: Proceed with AutoMove Construction

### Rationale

1. **Significant reuse opportunity:** Database + services exist
2. **Clear Product gap:** No UI/Product layer
3. **Perfect P0 test:** Real Product, real demand, real validation
4. **Measurable impact:** Can compare with/without P0

### Scope

**Build:** Full Bella AutoMove Product (MVP features)

**Test:** F-G1 + F-G3 field validation

**Measure:** P0 effectiveness (time saved, issues caught, evidence integrity)

**Document:** Evidence for Factory evolution decision (P1/P2)

### Next Action

**Start Phase 1:** Product structure + manifest

**Status:** Discovery complete, construction approved ✅

