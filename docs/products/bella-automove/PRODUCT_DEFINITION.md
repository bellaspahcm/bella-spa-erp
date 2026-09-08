# Bella AutoMove — Product Definition

**Date:** 2026-09-06  
**Status:** 🔄 DISCOVERY  
**Factory Test:** #3 — First P0 field validation

---

## Product Identity

**Name:** Bella AutoMove  
**Domain:** Automotive Service & Repair  
**Customer Segment:** Auto repair shops, car service centers, dealership service departments

---

## Business Context

### Customer Need

Auto repair shops need to:
- Track vehicles in service
- Manage repair orders and service appointments
- Track parts inventory and usage
- Manage technician assignments
- Generate service invoices
- Maintain service history for vehicles

### Core Operations

1. **Vehicle Management**
   - Vehicle registration (VIN, make, model, year, owner)
   - Service history tracking
   - Current status tracking

2. **Service Orders**
   - Create repair/service orders
   - Assign technicians
   - Track labor hours
   - Parts usage tracking
   - Order status workflow (pending, in-progress, completed)

3. **Parts Inventory**
   - Track parts stock
   - Record parts usage on service orders
   - Low stock alerts

4. **Invoicing**
   - Labor charges
   - Parts charges
   - Tax calculation
   - Payment tracking

---

## Discovery Questions

### Platform Core Assessment

**Q1: Tenant isolation?**
- Each auto shop is a separate tenant
- Service orders, vehicles, parts isolated by tenant

**Q2: Authentication/Authorization?**
- Shop manager, technicians, front desk staff
- Role-based access to service orders

**Q3: Multi-currency?**
- Initially single currency (VND)
- May need USD for imported parts

### Industry OS Assessment

**Q4: Existing Industry OS applicable?**
- Retail OS? (Parts inventory has similarities)
- Spa OS? (Service appointments similar to spa bookings)
- Healthcare OS? (Service orders similar to patient visits)
- Real Estate OS? (No clear overlap)

**Q5: New Industry OS needed?**
- Automotive OS for vehicle-specific patterns?
- Service Order OS for repair/maintenance workflows?

### Kernel Assessment

**Q6: Applicable Kernels?**
- Finance Kernel? (Invoicing, payments)
- Spa Kernel? (Appointments, service tracking)
- Inventory Kernel? (Parts stock management)

---

## Initial Classification (Hypothesis)

**Product Layer:**
- Bella AutoMove (this Product)
- UI for auto shop operations
- Vehicle/service order specific logic

**Industry OS Layer (TBD):**
- Option A: Reuse Spa OS (service/appointment patterns)
- Option B: New Automotive OS (vehicle-specific patterns)
- Option C: Service Order OS (repair workflow patterns)

**Kernel Layer (Likely reuse):**
- Finance Kernel (invoicing, payments)
- Inventory patterns (parts tracking)
- Appointment patterns (if Spa OS applicable)

**Platform Core:**
- Tenant isolation (reuse)
- Auth/RLS (reuse)
- Audit (reuse)

---

## Factory P0 Field Validation Goals

### Primary: Build Full Product

Deliver working Bella AutoMove with:
- Vehicle management
- Service orders
- Parts inventory
- Invoicing
- Multi-tenant
- Full E2E validation

### Secondary: Validate Factory P0

**F-G1 Environment Preflight:**
- Does it catch DB configuration issues?
- Does it save time vs E2E debugging?
- What false positives occur?

**F-G3 Evidence Integrity:**
- Does it prevent false "verified" claims?
- Does aggregated status accurately reflect gates?
- Does it integrate smoothly into closure?

**Measurement targets:**
- Time saved: >30 min (hypothesis)
- Issues caught: >0
- False positives: <10%
- Status accuracy: 100%

---

## Architecture Boundaries (Enforce)

### Platform Core Boundaries

**MUST reuse:**
- Tenant model (no new tenant concept)
- Auth (RLS policies, role system)
- Audit (change tracking)

**CANNOT:**
- Create new auth mechanism
- Bypass RLS
- Introduce new tenant isolation approach

### Industry OS Boundaries

**MUST determine:**
- Which existing OS (if any) applies
- What new patterns need Industry OS vs Product-specific
- Where reuse stops and new capability begins

**CANNOT:**
- Duplicate existing OS patterns in Product
- Skip OS layer and go straight to Product
- Create Industry OS without multi-Product evidence

### Kernel Boundaries

**MUST leverage:**
- Finance Kernel for accounting/invoicing patterns
- Existing inventory patterns (if available)
- Existing service/appointment patterns (if available)

**CANNOT:**
- Rebuild financial logic in Product
- Skip Kernel and implement from scratch
- Create Kernel prematurely (need multi-Industry evidence)

---

## Success Criteria

### Product Success

✅ **Functional:**
- Vehicle CRUD operations
- Service order workflow (create, assign, complete)
- Parts inventory tracking
- Invoice generation
- Tenant isolation verified

✅ **Quality:**
- Product tests PASS
- E2E tests PASS
- Architecture Guard PASS
- Production build SUCCESS

✅ **Evidence:**
- Complete evidence package
- All gates documented
- No TIMEOUT/SKIPPED gates hidden in "verified" claim

### Factory P0 Success

✅ **F-G1 Effectiveness:**
- Catches ≥1 environment issue before E2E
- Saves measurable time (>15 min)
- False positive rate <10%

✅ **F-G3 Effectiveness:**
- Prevents ≥1 false "verified" claim
- Aggregated status accurately represents gates
- No status hiding (TIMEOUT preserved as TIMEOUT)

✅ **Integration:**
- F-G1 + F-G3 run smoothly in workflow
- No blocking issues introduced
- Evidence package generated automatically

---

## Non-Goals

### NOT Building

❌ Customer relationship management (CRM)
❌ Marketing automation
❌ Fleet management (multiple vehicles per customer)
❌ Advanced scheduling optimization
❌ Mobile app for customers

### NOT Proving

❌ Factory LOC autonomy percentage
❌ AI agent speed benchmarks
❌ Framework abstraction elegance
❌ Every possible Industry OS pattern

---

## Next Steps

### Discovery Phase

1. ✅ Product definition (this document)
2. ⏳ **Platform capability audit**
   - What exists in Platform Core?
   - What exists in Industry OS layer?
   - What exists in Kernels?
3. ⏳ **Reuse assessment**
   - Can Spa OS patterns apply? (service/appointment)
   - Can Retail OS patterns apply? (parts inventory)
   - Can Finance Kernel apply? (invoicing)
4. ⏳ **Architecture decision**
   - Product-specific vs Industry OS vs Kernel
   - New capability vs extension vs reuse
5. ⏳ **Construction plan**
   - Phase boundaries
   - Validation gates
   - F-G1/F-G3 integration points

### Construction Phase

1. Database schema (migrations)
2. Repository layer (data access)
3. Server actions (business logic)
4. Product tests (architecture, conformance)
5. UI (Next.js pages/components)
6. E2E tests (browser validation)
7. F-G1 Preflight (environment validation)
8. F-G3 Evidence Guard (claim integrity)
9. Evidence package (complete documentation)

---

## Risk Assessment

### Technical Risks

**High:**
- Industry OS classification unclear (Spa? Service Order? New?)
- Parts inventory may not fit Retail patterns
- Service order workflow complexity

**Medium:**
- Vehicle schema design
- Multi-tenant vehicle ownership
- Invoice tax calculation

**Low:**
- Basic CRUD operations
- Platform Core integration (proven patterns)

### Factory P0 Risks

**High:**
- First field validation (unknown issues)
- Integration may reveal P0 design gaps
- False positive rate unknown

**Medium:**
- F-G1 may miss issue types not in Bella Land
- F-G3 may over-constrain legitimate workflows

**Low:**
- Unit tests all pass (implementation solid)

---

## Status

**Current:** Discovery phase initiated  
**Next:** Platform capability audit + reuse assessment  
**Blocked:** None

**This is Factory Test #3 — First field validation of P0 guards (F-G1 + F-G3)**

