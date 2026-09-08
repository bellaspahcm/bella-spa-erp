# Bella AutoMove — Construction Kickoff

**Date:** 2026-09-06  
**Status:** 🚀 CONSTRUCTION APPROVED  
**Factory Test:** #3 — P0 Field Validation

---

## Construction Approval

**Discovery complete:** ✅  
**Existing foundation identified:** ✅  
**Product layer missing:** ✅ Confirmed  
**Factory P0 ready:** ✅ F-G1 + F-G3 implemented (33/33 tests)

**Authorization:** Proceed with Bella AutoMove Product construction

---

## Construction Principles

### 1. Evidence-Driven Reuse

**DO NOT estimate reuse percentage upfront.**

**DO measure during construction:**
- Which capabilities reused (with evidence: file paths, LOC, functions)
- Which capabilities built new (with rationale)
- Integration points created
- Refactoring required

**Record format:**
```
Capability: Vehicle Management
Reused: src/modules/bella-auto/services/VehicleStatusMachineService (234 LOC)
Integration: Product action wraps service, adds validation
New: Product-specific UI components (412 LOC)
Rationale: Service logic exists, UI layer needed
```

### 2. Product Boundary First

**Existing foundation → Product boundary → UI → Validation**

**NOT:** Rebuild capabilities that exist

**Product layer responsibilities:**
- Define public Product API (server actions)
- Wrap/integrate existing services
- Implement UI (pages, components)
- Product-level validation and error handling
- E2E user workflows

**Automotive foundation responsibilities (unchanged):**
- Business logic (services)
- Database operations
- Domain state machines
- Infrastructure

### 3. Factory P0 Field Validation

**This is NOT just "build AutoMove."**

**This IS:**
> **First real-world test of Factory P0 (F-G1 + F-G3) on actual Product construction**

**Measure:**
- F-G1: Issues caught before E2E (type, count, time saved)
- F-G3: False claims prevented (evidence)
- Integration: Blockers encountered (type, resolution)
- ROI: Actual time impact vs hypothesis (~90-135 min saved)

### 4. No Premature Abstraction

**DO NOT:**
- Create "Automotive Industry OS" prematurely
- Extract patterns before multi-Product evidence
- Build abstraction layers "just in case"
- Optimize for theoretical future Products

**DO:**
- Build working bella-automove Product
- Document patterns observed
- After Product complete, assess Industry OS classification
- Let evidence drive abstraction decisions

---

## Construction Phases

### Phase 1: Product Structure ⏳

**Goal:** Establish Product layer skeleton

**Tasks:**
1. Create `src/products/bella-automove/` directory
2. Product manifest (`product.config.ts`)
3. Product schema types (from database.types.ts)
4. Basic Product tests (architecture, structure)

**Success criteria:**
- Product recognized by system
- Architecture Guard passes
- Product manifest valid

**Evidence to collect:**
- Product boundary definition
- Reused types vs new types

---

### Phase 2: Server Actions

**Goal:** Product public API

**Tasks:**
1. Vehicle actions (list, get, create, update)
   - Wrap existing VehicleStatusMachineService
   - Add Product-level validation
   
2. Appointment actions (list, create, update status)
   - Reuse auto_service_appointments operations
   - Integrate existing services
   
3. Repair order actions (create, add items, update status, complete)
   - Wrap auto_repair_orders operations
   - Integrate existing workflow services
   
4. Invoice actions (generate, get, list)
   - Integrate Finance Kernel (if applicable)
   - OR implement minimal invoicing

**Success criteria:**
- Server actions callable
- Product tests pass (actions, DB integration)
- Tenant isolation verified

**Evidence to collect:**
- Service integration points (file paths, functions)
- New implementation vs reuse ratio
- Finance Kernel integration approach

---

### Phase 3: UI Layer

**Goal:** Auto shop user interface

**Tasks:**
1. Dashboard page (`/bella-automove` or `/`)
   - Overview metrics
   - Quick actions
   
2. Vehicles page (`/bella-automove/vehicles`)
   - List view (tenant vehicles)
   - Detail view (VIN, service history)
   - Create/edit form
   
3. Appointments page (`/bella-automove/appointments`)
   - Calendar/list view
   - Create appointment
   - Status workflow
   
4. Repair Orders page (`/bella-automove/repair-orders`)
   - List view
   - Detail view (items, status)
   - Create from appointment
   - Add labor/parts
   
5. Invoices page (`/bella-automove/invoices`)
   - List view
   - Detail view
   - Generate from completed order

**Success criteria:**
- Pages render
- Navigation works
- Forms functional
- Data flows: UI → Actions → Services → DB

**Evidence to collect:**
- UI component reuse (from bella-auto/components or shared)
- New UI components created
- Page complexity (LOC, components)

---

### Phase 4: E2E Tests + F-G1 Integration

**Goal:** Browser validation + Preflight

**Tasks:**
1. **F-G1 Integration (Critical):**
   ```typescript
   // e2e/setup/bella-automove-setup.ts
   import { runPreflight } from '@/factory/preflight';
   
   beforeAll(async () => {
     const result = await runPreflight({
       product: 'bella-automove',
       checks: ['database', 'environment'],
       verbose: true
     });
     
     if (!result.passed) {
       throw new Error('Preflight failed - environment not ready');
     }
   });
   ```

2. **E2E Tests:**
   - Vehicle workflow (create → view → update)
   - Appointment workflow (create → confirm → check-in → complete)
   - Repair order workflow (create → add items → complete)
   - Invoice workflow (generate → view)
   
3. **Measure F-G1 effectiveness:**
   - Did preflight catch any issues?
   - What issues (DB privilege, env vars, etc.)?
   - Time saved vs E2E debugging
   - False positives encountered

**Success criteria:**
- E2E tests pass (target: 15+ tests)
- F-G1 runs successfully
- Evidence collected on F-G1 effectiveness

**Evidence to collect:**
- F-G1 execution results
- Issues caught (type, count)
- Time measurements (preflight vs E2E debug)
- False positive/negative analysis

---

### Phase 5: Factory Closure + F-G3 Integration

**Goal:** Evidence package + Integrity validation

**Tasks:**
1. **Run all gates:**
   - Product tests (architecture, conformance, actions, DB)
   - E2E tests (browser validation)
   - Architecture Guard (boundaries, Kernels)
   - Production build (route generation)
   - Tenant isolation (RLS verification)
   - TypeScript (type safety)

2. **F-G3 Integration (Critical):**
   ```typescript
   import { validateEvidence } from '@/factory/evidence';
   
   const gateResults = [
     { gate: 'Product Tests', status: 'PASS', evidence: [...] },
     { gate: 'E2E Tests', status: 'PASS', evidence: [...] },
     { gate: 'Architecture Guard', status: 'PASS', evidence: [...] },
     // ... all gates
   ];
   
   const result = await validateEvidence({
     product: 'bella-automove',
     gates: gateResults,
     enforceStatusPrecision: true,
     enforceClaimBinding: true
   });
   
   if (!result.passed) {
     throw new Error('Evidence integrity violated');
   }
   ```

3. **Measure F-G3 effectiveness:**
   - Did F-G3 prevent false claims?
   - Aggregated status accuracy
   - Evidence gaps identified
   - Integration issues

4. **Generate evidence package:**
   - Complete gate results
   - Evidence matrix
   - Aggregated status
   - Reuse measurements
   - Construction timeline

**Success criteria:**
- All required gates PASS or status documented accurately
- F-G3 validation PASS
- Evidence integrity maintained
- No TIMEOUT/SKIPPED hidden in "verified" claim

**Evidence to collect:**
- F-G3 execution results
- Violations prevented (if any)
- Status accuracy verification
- Evidence package completeness

---

## Success Criteria (Product)

### Functional Requirements

✅ **Vehicle Management:**
- Auto shop can list vehicles for their tenant
- Auto shop can view vehicle details (VIN, make, model, service history)
- Auto shop can register new vehicles

✅ **Service Appointments:**
- Auto shop can create appointments
- Auto shop can view appointment calendar/list
- Auto shop can update appointment status (workflow)

✅ **Repair Orders:**
- Auto shop can create repair orders
- Auto shop can add labor and parts
- Auto shop can track order status
- Auto shop can complete orders

✅ **Invoicing:**
- Auto shop can generate invoices from completed orders
- Auto shop can view invoice list and details

✅ **Tenant Isolation:**
- Multi-tenant verified (RLS policies)
- Cross-tenant data access blocked

### Quality Requirements

✅ **Tests:**
- Product tests PASS (target: 20+)
- E2E tests PASS (target: 15+)
- No test skips or timeouts hidden

✅ **Architecture:**
- Architecture Guard PASS
- Product boundaries respected
- No Kernel violations

✅ **Build:**
- Production build SUCCESS
- Routes generated correctly
- TypeScript compilation passes (or status accurately preserved)

✅ **Evidence:**
- Complete evidence package
- All gates documented
- Aggregated status accurate

---

## Success Criteria (Factory P0)

### F-G1 Environment Preflight

✅ **Effectiveness:**
- Catches ≥1 environment issue before E2E
- Saves measurable time (target: >15 min)
- False positive rate <10%

✅ **Integration:**
- Runs smoothly in E2E setup
- No blocking issues
- Clear diagnostic output

### F-G3 Evidence Integrity

✅ **Effectiveness:**
- Prevents ≥1 false "verified" claim
- Aggregated status = accurate (VERIFIED / PARTIALLY_VERIFIED / etc.)
- No status hiding (TIMEOUT preserved as TIMEOUT)

✅ **Integration:**
- Runs smoothly in closure workflow
- Generates evidence report
- No blocking issues

### Overall Factory Impact

✅ **Measured outcomes:**
- Total time saved (hypothesis: ~90-135 min)
- Human intervention points (count, type)
- Autonomous construction percentage (measured, not estimated)
- Construction quality (tests, architecture, evidence)

---

## Measurement Framework

### Construction Metrics

**Record throughout construction:**

| Metric | How to Measure | Evidence Type |
|--------|---------------|---------------|
| **Reuse ratio** | LOC reused / (LOC reused + LOC new) | Source code analysis |
| **Capabilities reused** | List of services/functions consumed | Integration points |
| **Capabilities built new** | List of new implementations | Source code |
| **Integration effort** | Time spent on integration vs new code | Time tracking |
| **Refactoring required** | Changes to existing foundation | Git diff |

### Factory P0 Metrics

**Measure during field validation:**

| Metric | How to Measure | Target |
|--------|---------------|--------|
| **F-G1 issues caught** | Count preflight failures | >0 |
| **F-G1 time saved** | (E2E debug time) - (preflight time) | >15 min |
| **F-G1 false positives** | Invalid failures / total checks | <10% |
| **F-G3 false claims blocked** | Violations prevented | >0 |
| **F-G3 status accuracy** | Aggregated = actual | 100% |
| **F-G3 integration issues** | Blockers encountered | 0 |

---

## Evidence Package Template

**Create at completion:** `BELLA_AUTOMOVE_CONSTRUCTION_EVIDENCE.md`

**Required sections:**

1. **Construction Summary**
   - Timeline (start → finish)
   - Phases completed
   - Human intervention points

2. **Reuse Analysis**
   - Capabilities reused (list with evidence)
   - Capabilities built new (list with rationale)
   - Measured reuse ratio
   - Integration approach

3. **Gate Results**
   - Product tests (count, status)
   - E2E tests (count, status)
   - Architecture Guard (status)
   - Production build (status)
   - Tenant isolation (status)
   - TypeScript (status)

4. **F-G1 Field Validation**
   - Execution results
   - Issues caught (type, count)
   - Time saved (measured)
   - False positives (count, type)

5. **F-G3 Field Validation**
   - Execution results
   - Violations prevented (type, count)
   - Status accuracy (verified)
   - Evidence package completeness

6. **Factory P0 Assessment**
   - Overall effectiveness
   - Hypothesis vs actual (time saved, issues caught)
   - Integration quality
   - Recommendations for P1/P2

---

## Construction Authorization

**Approved:** ✅ Bella AutoMove Product construction  
**Approved:** ✅ Factory P0 field validation  
**Approved:** ✅ Evidence-driven measurement

**NOT Approved:**
- ❌ Premature Industry OS classification
- ❌ Estimated reuse percentages
- ❌ Building capabilities that exist
- ❌ Skipping P0 integration

**Start:** Phase 1 — Product Structure

**Status:** 🚀 CONSTRUCTION BEGINS

