# NAIL E2E VERIFICATION GUIDANCE

**Checkpoint:** b83cef4d (Day 2 complete)  
**Goal:** Prove Nail works end-to-end in browser with real user flows  
**Scope:** Representative journeys only (not exhaustive testing)

---

## PRINCIPLE

**Do NOT re-test everything.**

Day 2 already verified 5 workflows at integration level. E2E only needs to prove:
1. Browser UI connects to backend correctly
2. User can complete critical journeys
3. Multi-resource and disruption patterns work in full stack

**NOT needed:**
- Exhaustive test coverage
- Every edge case
- Performance benchmarking
- Load testing

**This is product verification, not QA certification.**

---

## CRITICAL USER JOURNEYS (3)

### Journey #1: Manicure Booking with Multi-Resource

**User story:**
Customer books pedicure → System allocates station + foot spa → Technician completes service

**Steps:**
1. Customer selects "Pedicure" service
2. Chooses technician
3. Picks time slot
4. Confirms booking
5. Verify: 2 resources allocated (backend check)
6. Technician starts session
7. Records outcome with nail health + polish details
8. Session completes

**Success criteria:**
- [ ] Booking created
- [ ] 2 allocations visible in admin (station + foot spa)
- [ ] Session outcome includes nail metadata
- [ ] 0 contract/schema changes needed

**Evidence type:** Screenshot + backend query showing 2 allocations

---

### Journey #2: Capacity Conflict → Waitlist → Promotion

**User story:**
All stations full → Customer added to waitlist → Cancellation happens → Customer promoted

**Steps:**
1. Attempt booking when all stations at capacity
2. System shows "fully booked"
3. Customer added to waitlist
4. Simulate cancellation (admin action)
5. Waitlist promotion logic triggers
6. Customer notified (log check)

**Success criteria:**
- [ ] Capacity check prevents overbooking
- [ ] Waitlist entry created
- [ ] Promotion logic works
- [ ] 0 contract/schema changes needed

**Evidence type:** Screenshot + waitlist table query

---

### Journey #3: Technician Reassignment (Disruption Recovery)

**User story:**
Technician unavailable → Manager reassigns → History preserved → Service continues

**Steps:**
1. Booking exists with technician A
2. Manager receives notification: technician A unavailable
3. Manager reassigns to technician B
4. Verify history shows disruption reason
5. Technician B starts session
6. Session completes normally

**Success criteria:**
- [ ] Reassignment UI works
- [ ] History preserved in `beauty_professional_assignment_history`
- [ ] Session tracks actual performer (technician B)
- [ ] 0 contract/schema changes needed

**Evidence type:** Screenshot + history table query

---

## E2E VERIFICATION SCOPE

**What to verify:**
- ✅ 3 critical user journeys complete end-to-end
- ✅ Multi-resource allocation visible in UI/admin
- ✅ Disruption/recovery patterns work
- ✅ Nail metadata captured correctly

**What NOT to verify:**
- ❌ Every permutation of booking flows
- ❌ Performance under load
- ❌ Security penetration testing
- ❌ Browser compatibility matrix
- ❌ Accessibility audit

**Verification = product works. NOT = production-ready certification.**

---

## EVIDENCE COLLECTION

For each journey, capture:

1. **Screenshot:** User-facing UI showing completion
2. **Backend query:** Database state proving correct data
3. **Log excerpt:** Key events logged correctly

Example evidence for Journey #1:

```sql
-- Verify multi-resource allocation
SELECT 
  id, 
  service_commitment_id, 
  resource_id, 
  status 
FROM beauty_resource_allocations 
WHERE service_commitment_id = 'commitment-pedicure-123';

-- Expected: 2 rows with different resource_id
```

**No new test framework needed.** Manual verification with SQL queries is sufficient.

---

## SUCCESS CRITERIA (E2E COMPLETE)

- [ ] 3/3 journeys complete successfully
- [ ] Multi-resource allocation works in full stack
- [ ] Disruption/recovery works in full stack
- [ ] Nail metadata captured and displayed
- [ ] 0 contract changes
- [ ] 0 schema changes
- [ ] 0 ACR raised

**Then:** E2E COMPLETE. Proceed to Factory measurement.

---

## IF ISSUES FOUND

Use same classification as Day 2:

### Product Bug
- UI logic error
- Incorrect API call
- Missing validation

**Action:** Fix bug. No governance.

---

### Extension
- Need UI field for new metadata
- Missing config option
- Business rule variation

**Action:** Extend within existing schema/contracts.

---

### Semantic Gap
**ONLY IF:** Beauty OS contracts cannot express required capability

**Action:** Document gap. Raise ACR. PAUSE.

---

## IMPLEMENTATION APPROACH

**Option A: Manual verification**
- Run local dev server
- Execute 3 journeys manually
- Capture screenshots + SQL queries
- Document in evidence file

**Time estimate:** 1-2 hours

**Option B: Automated E2E (Playwright/Cypress)**
- Write 3 test scripts
- Run against local/staging
- Generate test report

**Time estimate:** 4-6 hours

**Recommendation:** Start with Option A. Only do Option B if manual verification finds issues requiring iteration.

---

## AFTER E2E COMPLETE

**Next step: Factory Measurement**

Compile metrics:
- Elapsed time (Day 1 start → E2E complete)
- Active development time
- Contracts created (target: 0)
- Tables created (target: 0)
- Schema changes (target: 0)
- ACRs raised (target: 0)
- Test reuse % (formal calculation)
- Code reuse % (LOC analysis)

**Then: Nail RC candidate**

If metrics show:
- 0 new contracts
- 0 new tables
- 0 ACRs
- Elapsed time < Haircut H3-H9

**Conclusion validated:**
> **Haircut paid upfront architecture cost. Nail proves Beauty OS reduces marginal work for product #2.**

---

**Owner:** Nail development team  
**Timeline:** After Day 2 complete  
**Dependencies:** None (Day 2 evidence sufficient to proceed)
