# Phase 2B - Runtime Verified (NOT Field Verified)

**Date:** 2026-09-11  
**Status:** 🟢 BACKEND RUNTIME VERIFIED ≠ 🟡 FIELD VERIFIED  

---

## ✅ What Was Verified

### Schema Compatibility Remediation
```text
✅ Enum conversion: re_reservation_status → reservation_status
✅ ADD deposit_amount (NUMERIC DEFAULT 0)
✅ ADD notes (TEXT)
✅ user_id: NOT NULL → nullable
✅ customer_id: nullable → NOT NULL
✅ expires_at: NOT NULL → nullable (discovered blocker)
✅ FK fix: customer_id → re_customers (was customers)
```

### Runtime Evidence
```text
✅ Reservation INSERT succeeds
✅ Record persists in database
✅ Status: 'pending_deposit' (canonical enum)
✅ Customer FK resolves correctly
✅ Tenant ID populated
✅ No constraint violations

Test: npx tsx scripts/bella-land/test-reservation-creation.ts
Result: ALL TESTS PASSED
Count: 3 reservations in DB
```

---

## ⚠️ What Was NOT Verified

### 1. deposit_amount Business Semantics
```text
RUNTIME: INSERT with deposit_amount = 0 ✅
FIELD VERIFICATION: ⏸️ PENDING

Questions not answered:
- Does service correctly send deposit amount?
- Is DEFAULT 0 correct business rule?
- Should initial reservation always be 0, then updated separately?
- Or should CREATE include actual deposit amount?

Evidence gap:
Test sent: deposit_amount = 0
DB stored: 0
Expected: ?

Action required:
- Verify service implementation
- Confirm business invariant
- Test with non-zero deposit amount
```

### 2. expires_at Calculation
```text
RUNTIME: INSERT with expires_at = NULL ✅ (nullable)
FIELD VERIFICATION: ⏸️ PENDING

Questions not answered:
- Should expires_at be calculated before INSERT?
- Or set by DB trigger/function?
- Or updated in separate transaction?
- What is valid expiry duration?

Evidence gap:
Test sent: expires_at not provided
DB stored: NULL
Expected: TIMESTAMPTZ (calculated)

Concern:
Reservation exists with NO expiry
→ Can it be reserved indefinitely?
→ Is this transient state valid?

Action required:
- Verify business invariant
- Check if trigger/function should set expires_at
- Test expiry enforcement
```

### 3. created_by / updated_by Auth Mapping
```text
RUNTIME: INSERT without created_by/updated_by ✅
FIELD VERIFICATION: ⏸️ PENDING

Questions not answered:
- Does production service send these fields?
- What user ID does auth provide?
- Does FK constraint match auth user table?

Evidence gap:
Test omitted: created_by/updated_by (to avoid FK error)
Real service: May send tenant_id or different user_id
FK constraint: Points to 'users' table

Concern:
Test bypassed FK by omitting fields
→ Production may fail with different FK violation

Action required:
- Check ReservationService implementation
- Verify auth user ID mapping
- Test with real auth context
```

### 4. Browser Workflow
```text
NOT VERIFIED:
- UI create reservation form
- Service action layer
- Auth context propagation
- Error handling
- User feedback
```

### 5. Status Transitions
```text
NOT VERIFIED:
pending_deposit → deposited
deposited → converted_to_contract
pending_deposit → cancelled

Action required:
- Test state machine
- Verify transition rules
- Check audit trail (deposited_at, converted_at, cancelled_at)
```

### 6. Tenant Isolation
```text
NOT VERIFIED:
- Tenant A cannot create reservation for Tenant B's customer
- Tenant A cannot create reservation for Tenant B's apartment
- RLS policies enforce isolation

Action required:
- Negative boundary tests (REQUIRED before RC)
```

### 7. Concurrency / Double Reservation
```text
🔴 CRITICAL NOT VERIFIED:
Two sales create reservation for same apartment simultaneously
→ Both transactions succeed?
→ Apartment has 2 active reservations?

This is HIGHER RISK than enum mismatch

Action required:
- Test concurrent reservation attempts
- Verify uniqueness constraint
- Check optimistic locking
```

---

## 📊 Evidence Boundaries

### INSERT Success ≠ Field Correct
```text
✅ Database accepts INSERT
≠ Field values match business requirements
≠ Calculated fields populated correctly
≠ Invariants enforced
```

### Runtime Test ≠ Production Service
```text
✅ Direct DB INSERT via Supabase client
≠ ReservationService.create() tested
≠ Service action layer tested
≠ Auth context tested
≠ Browser workflow tested
```

### Happy Path ≠ Edge Cases
```text
✅ Single reservation creation
≠ Concurrent reservations
≠ Invalid state transitions
≠ Cross-tenant attempts
≠ Duplicate reservations
```

---

## 🎯 Revised Status

### Reservations Capability
```text
Schema compatibility        ✅ VERIFIED
Canonical enum              ✅ VERIFIED
Backend runtime INSERT      ✅ VERIFIED
Database persistence        ✅ VERIFIED
Customer FK                 ✅ VERIFIED

Field semantics             ⏸️ PENDING
Business invariants         ⏸️ PENDING
Service layer               ⏸️ NOT TESTED
Browser workflow            ⏸️ NOT TESTED
Auth context                ⏸️ NOT TESTED
Status transitions          ⏸️ NOT TESTED
Tenant isolation            ⏸️ NOT TESTED
Concurrency safety          🔴 NOT TESTED (CRITICAL)

VERDICT: 🟢 BACKEND RUNTIME VERIFIED
         ≠ 🟡 FIELD VERIFIED
         ≠ ✅ WORKFLOW COMPLETE
```

### Overall Bella Land RC Status
```text
Projects       🟡 DB VERIFIED (browser workflow ⏸️)
Apartments     🟡 DB VERIFIED (browser workflow ⏸️)
Customers      🟡 BACKEND VERIFIED (UI gap identified)
Reservations   🟢 BACKEND RUNTIME VERIFIED
               🟡 FIELD VERIFICATION PENDING

RC Status:     🟡 HARDENING / RECONCILIATION
               NOT YET RESEALED
```

---

## 🔴 Critical Path to Field Verified

### Phase 2C: Field Verification (Required)

**1. Verify deposit_amount semantics**
```text
- Check ReservationService implementation
- Confirm DEFAULT 0 vs service-provided value
- Test with actual deposit amount (e.g., 50,000,000 VND)
- Verify business rule documented
```

**2. Verify expires_at invariant**
```text
- Check if service calculates expiry
- Check if DB trigger/function sets expiry
- Verify reservation_duration configuration
- Test that expired reservations are handled
```

**3. Verify created_by auth mapping**
```text
- Test ReservationService.create() with auth context
- Verify user_id from auth matches FK constraint
- Test that auth user exists in 'users' table
- OR fix FK to not require users table
```

**4. Test via service layer**
```text
- Call ReservationService.create() (not direct DB)
- Verify all fields populated correctly
- Check calculated fields
- Verify audit trail
```

**5. Browser workflow**
```text
- Navigate to apartment detail
- Click "Reserve" button
- Select customer
- Enter deposit amount (if required)
- Submit
- Verify success message
- Reload page
- Verify persistence
```

**6. Status transitions**
```text
- Create reservation (pending_deposit)
- Mark as deposited
- Verify deposited_at timestamp
- Convert to contract
- Verify converted_at timestamp
- Test cancellation
- Verify cancelled_at timestamp
```

**7. Tenant isolation (REQUIRED before RC)**
```text
- Create reservation as Tenant A
- Attempt to access as Tenant B
- Verify 403 or empty result
- Test all CRUD operations
```

**8. Concurrency test (CRITICAL)**
```text
- Two concurrent requests for same apartment
- Verify only ONE succeeds
- OR verify error on second attempt
- Check for uniqueness constraint
- Verify no double-reservation possible
```

---

## 📝 Migration Governance Debt

### Separate from Workflow Verification

**Issue:** 40+ migrations diverged (local ↔ remote)

**NOT "post-RC housekeeping"** if:
- New environment cannot reproduce schema from migrations
- Team members have different migration states
- Schema cannot be deterministically created

**Release reproducibility risk:**
```text
Production DB: Works ✅
New staging: Different schema? 🔴
Developer setup: Different schema? 🔴
```

**Action required:**
- Verify migrations can recreate current schema
- Test on clean environment
- Document canonical migration set
- If not reproducible: BLOCKS RC (not just debt)

---

## 🏭 Factory Candidate Rule

### Schema Contract Verification Gate

```text
SERVICE CONTRACT
      ↕
GENERATED TYPES
      ↕
MIGRATION CANONICAL SCHEMA
      ↕
DEPLOYED DATABASE

Any drift → BLOCK CI/CD
```

**Why this matters:**
- Bella Land defects #1, #2, #3 all involved contract drift
- Browser tests detected drift LATE (after development)
- Should be caught at PR time, not RC time

**Candidate implementation:**
```bash
# Pre-commit or CI
npm run verify:schema-contract

# Checks:
1. Generated types match deployed schema
2. Service code uses only generated types
3. No direct type assertions bypassing contract
4. Migrations reproduce deployed schema
```

---

## ✅ What Phase 2B Actually Delivered

**Schema compatibility unblocked:** ✅  
**Root cause identified:** Schema drift (code ↔ DB)  
**Minimal canonical fix applied:** 7 patches  
**Runtime INSERT verified:** ✅  
**Evidence boundaries maintained:** ✅  

**NOT delivered:**
- Field-level business verification
- Production service verification
- Browser workflow verification
- Concurrency safety verification

---

**Status:** 🟢 RUNTIME VERIFIED, 🟡 FIELD VERIFICATION PENDING

**Next:** Phase 2C (Field Verification) OR continue other RC critical path items

**Estimated time to Field Verified:** 2-4 hours (depending on findings)

**Blocks RC:** Concurrency test + Tenant isolation (minimum)
