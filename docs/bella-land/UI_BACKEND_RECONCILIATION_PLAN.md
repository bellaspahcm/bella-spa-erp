# Bella Land — UI ↔ Backend Reconciliation Plan

**Goal:** Pragmatic reconciliation of critical user workflows  
**NOT Goal:** Architectural perfectionism, service layer normalization, domain framework  
**Principle:** Fix what's broken, not what looks imperfect

---

## 🎯 Evidence Standard

### 3-Level Verification (Minimum)

```text
PASS Criteria:
1. User completes workflow            ✅
2. Data persisted correctly           ✅
3. Critical ownership/tenant intact   ✅

FAIL:
- Browser works but data wrong
- Browser works but tenant leaked
- Code looks correct but not tested
```

### Evidence Boundary

```text
✅ PASS = Workflow actually works + data correct
🔴 FAIL = Runtime error OR data corruption
⏸️ DEFER = Read-only / low-risk / non-critical
```

**NOT PASS:**
- Code review looks good
- Static types align
- No compile errors
- "It should work"

---

## 📋 Reconciliation Scope

### Critical Workflows (Priority Order)

| Workflow | Priority | Reason |
|----------|----------|--------|
| Reservations | 🔴 HIGHEST | Core business transaction, highest data corruption risk |
| Apartments | 🔴 HIGH | Inventory management, required for reservations |
| Customers | 🔴 HIGH | Contact data, tenant isolation critical |
| Projects | ✅ FIXED | Status enum mismatch resolved |
| Reports/Analytics | ⏸️ DEFER | Read-only, lower risk |

### Verification Method

**For each workflow:**

```text
Step 1: Browser Workflow Test
- Navigate to screen
- Complete create/update flow
- Observe success/error

Step 2: Data Persistence Check
- Refresh page
- Verify data appears
- Check database (if mismatch suspected)

Step 3: Ownership/Tenant Check
- Verify tenant_id correct
- Check RLS enforcement (if write operation)
- Cross-tenant isolation (if critical)

IF all 3 pass:
→ Mark ✅ VERIFIED
→ Move on

IF any fails:
→ Identify mismatch
→ Minimal fix
→ Regression test
→ Re-verify
```

---

## 🔍 Workflow Inventory

### 1. Projects (✅ COMPLETED)

**Status:** 🟢 FIXED

**Issue Found:**
- Frontend: `status: "on_sale" | "presale" | "sold_out"`
- Database: `CHECK (status IN ('planning', 'active', 'completed', 'cancelled'))`
- Result: System error on create

**Fix Applied:**
- Frontend adapted to database enum
- Status dropdown added
- Badge display updated

**Verification:**
- [x] User can create project
- [ ] **TODO:** Data persisted correctly
- [ ] **TODO:** Tenant isolation verified

**Next:** Browser persistence check

---

### 2. Apartments (🔴 NEXT)

**Workflows to Test:**

#### 2.1 Create Apartment
```text
UI Path: Bella Land → Bảng hàng → + Thêm căn hộ
Test:
- Fill: product_code, floor, block, area, unit_price, status
- Submit
- Verify: Success toast + appears in list
- Refresh: Data persists
- Database: tenant_id, project_id correct
```

**Potential Risks:**
- product_type enum mismatch
- status enum mismatch (similar to projects)
- Required field mismatch
- project_id foreign key constraint
- Unique constraint (tenant_id, project_id, product_code)

#### 2.2 Update Apartment
```text
Test:
- Edit existing apartment
- Change status/price
- Save
- Verify: Updates persist
```

#### 2.3 List/Filter Apartments
```text
Test:
- Status filter tabs work
- Project filter works
- Data displays correctly
```

**Verification Checklist:**
- [ ] Create workflow completes
- [ ] Data persisted correctly
- [ ] tenant_id matches current user
- [ ] project_id foreign key valid
- [ ] Unique constraint enforced
- [ ] Status filter works
- [ ] No cross-tenant leakage

---

### 3. Customers (🔴 HIGH PRIORITY)

**Workflows to Test:**

#### 3.1 Create Customer
```text
UI Path: Bella Land → Khách hàng đầu tư → + Thêm khách hàng
Test:
- Fill: name, phone, email, etc.
- Submit
- Verify: Customer created
- Refresh: Data persists
- Database: tenant_id correct
```

**Potential Risks:**
- Phone number format validation
- Email validation
- Required field mismatch
- Duplicate detection (phone/email)
- Tenant isolation

#### 3.2 Customer Detail View
```text
Test:
- View customer detail
- Verify: All data displays
- Check: Related reservations appear
```

**Verification Checklist:**
- [ ] Create workflow completes
- [ ] Data persisted correctly
- [ ] tenant_id isolation enforced
- [ ] Phone/email validation works
- [ ] Duplicate detection (if implemented)
- [ ] No cross-tenant leakage

---

### 4. Reservations (🔴 HIGHEST PRIORITY)

**Workflows to Test:**

#### 4.1 Create Reservation
```text
UI Path: Bella Land → Bảng hàng → Select apartment → Đặt chỗ
Test:
- Select customer
- Set deposit amount
- Set dates
- Submit
- Verify: Reservation created
- Verify: Apartment status changes
- Database: tenant_id, project_id, product_id correct
```

**Potential Risks:**
- Status workflow (available → booked → deposited → paid)
- Apartment availability check
- Deposit amount validation
- Date validation
- Customer-apartment-project relationship
- Tenant isolation (CRITICAL)
- Transaction consistency

#### 4.2 Update Reservation Status
```text
Test:
- Change status: booked → deposited
- Update deposit amount
- Verify: Status updated
- Verify: Apartment status synced
```

#### 4.3 Cancel Reservation
```text
Test:
- Cancel reservation
- Verify: Reservation cancelled
- Verify: Apartment released (available)
```

**Verification Checklist:**
- [ ] Create workflow completes
- [ ] Data persisted correctly
- [ ] Apartment status synced
- [ ] tenant_id isolation enforced
- [ ] Customer-apartment link correct
- [ ] Deposit amount validation
- [ ] Date validation
- [ ] Transaction atomicity
- [ ] No cross-tenant leakage
- [ ] Cancellation workflow correct

---

## 🚫 Anti-Patterns (DO NOT DO)

### ❌ Architectural Over-Engineering

```text
DON'T:
- Create bounded context diagram
- Build domain model abstraction
- Normalize all enum definitions
- Refactor service layer for "cleanliness"
- Add state machine for status
- Implement event sourcing
- Create central validation framework
```

### ❌ Premature Testing

```text
DON'T:
- Unit test every service method
- Aim for X% coverage target
- Test all validation rules
- Test happy path + edge cases for everything
- Mock entire database layer
```

### ❌ Gold-Plating

```text
DON'T:
- Add features "for consistency"
- Refactor working code
- Create abstraction "for future"
- Optimize performance without evidence
- Add audit log "just in case"
```

---

## ✅ Decision Rules

### When Mismatch Found

```text
1. Identify exact contract mismatch
   Frontend expects: X
   Backend provides: Y

2. Choose cheapest fix:
   Option A: Frontend adapt to backend (PREFERRED)
   Option B: Backend expand constraint (if business justified)
   Option C: Both change (if fundamental design flaw)

3. Apply minimal fix
   - Change ONE thing
   - Do NOT refactor related code
   - Do NOT normalize similar patterns

4. Add ONE regression test
   - Test the EXACT mismatch
   - Do NOT test entire module

5. Re-verify 3 levels
   - Workflow completes
   - Data correct
   - Ownership intact

6. Move on
   - Do NOT polish
   - Do NOT optimize
   - Do NOT refactor
```

### When No Mismatch Found

```text
Workflow passes 3-level verification?
→ Mark ✅ VERIFIED
→ Do NOT refactor
→ Do NOT add tests "just in case"
→ Move on to next workflow
```

### When Workflow Not Critical

```text
Read-only screen?
Low business risk?
Not blocking RC?
→ Mark ⏸️ DEFER
→ Move on
```

---

## 📊 Success Criteria

### Phase Complete When:

```text
✅ Projects: Verified (create + persist + tenant)
✅ Apartments: Verified (CRUD + tenant)
✅ Customers: Verified (CRUD + tenant)
✅ Reservations: Verified (full workflow + atomicity + tenant)

All critical write workflows:
- Complete without error
- Persist data correctly
- Maintain tenant isolation
```

### NOT Required:

```text
❌ Perfect type safety
❌ 100% test coverage
❌ Zero code smells
❌ Beautiful architecture
❌ Normalized domain model
❌ All validation rules tested
❌ Performance optimization
❌ Audit logging
❌ State machines
❌ Event sourcing
```

---

## 🎯 Execution Plan

### Immediate Next Steps

**1. Complete Projects Verification**
- [ ] Browser: Create project with each status
- [ ] Persistence: Refresh page, verify data
- [ ] Tenant: Check database tenant_id
- [ ] Mark ✅ or fix if fails

**2. Apartments Workflow**
- [ ] Browser: Create apartment
- [ ] Persistence: Refresh, verify
- [ ] Tenant: Check isolation
- [ ] IF mismatch → minimal fix → regression test
- [ ] IF pass → mark ✅

**3. Customers Workflow**
- [ ] Browser: Create customer
- [ ] Persistence: Refresh, verify
- [ ] Tenant: Check isolation
- [ ] IF mismatch → minimal fix → regression test
- [ ] IF pass → mark ✅

**4. Reservations Workflow (CRITICAL)**
- [ ] Browser: Full booking flow
- [ ] Persistence: Verify all data
- [ ] Tenant: Check isolation
- [ ] Transaction: Verify atomicity
- [ ] Status: Verify apartment sync
- [ ] IF mismatch → minimal fix → regression test
- [ ] IF pass → mark ✅

### Timeline

```text
Expected: 2-4 hours (pragmatic)
NOT: 2-4 days (perfectionist)

Method: Fast iteration
- Test workflow
- Fix if broken
- Move on if working
```

---

## 📝 Reporting

### Per-Workflow Status

```text
Workflow: [Name]
Status: ✅ VERIFIED / 🔴 MISMATCH FOUND / ⏸️ DEFERRED

IF VERIFIED:
- [x] User completes workflow
- [x] Data persisted correctly
- [x] Tenant isolation intact

IF MISMATCH:
- Issue: [exact mismatch]
- Fix: [minimal change applied]
- Test: [regression test added]
- Re-verify: [3 levels pass]

IF DEFERRED:
- Reason: [read-only / low-risk / non-critical]
```

### Phase Summary

```text
Critical workflows verified: X/4
Mismatches found: Y
Minimal fixes applied: Y
Regression tests added: Y

Ready for RC: [YES/NO]
Blockers: [list if any]
```

---

## 🔒 Governance Note

**This is pragmatic reconciliation, not architectural redesign.**

**Principle:**
- Fix actual bugs
- Verify critical workflows
- Maintain tenant isolation
- Ship RC

**Anti-principle:**
- Perfect architecture
- Complete test coverage
- Zero technical debt
- Beautiful abstractions

**Evidence standard:**
- Workflow works ✅
- Data correct ✅
- Tenant safe ✅

**NOT evidence:**
- Code looks good
- Types align
- No compile errors

---

**Phase:** UI ↔ Backend Reconciliation  
**Type:** Pragmatic, minimal, evidence-based  
**Goal:** Working product, not perfect architecture  
**Timeline:** Hours, not days
