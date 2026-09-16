# NAIL DAY 2 — INTEGRATION GUIDANCE

**Checkpoint:** 9024bf6e  
**Day 1 result:** Reuse is POSSIBLE (skeleton + 7/7 tests, 0 new contracts/tables)  
**Day 2 goal:** Prove reuse is SUFFICIENT (integration workflows pass)

---

## SINGLE QUESTION TO ANSWER

> **Can Beauty OS (6 contracts + 6 tables) handle Nail business workflows end-to-end?**

**If YES:** Continue to Day 3 (migration + E2E)  
**If NO:** Classify issue → fix/extend/ACR

---

## ISSUE CLASSIFICATION FRAMEWORK

**When integration test fails or workflow doesn't work:**

### 1. PRODUCT BUG (fix immediately)
- Test logic error
- Incorrect adapter implementation
- Missing error handling
- Wrong metadata extraction

**Action:** Fix bug. No governance.

---

### 2. EXTENSION (add metadata/config/logic)
- Need more metadata fields
- Business logic variation
- UI/UX difference
- Configuration option

**Action:** Extend within existing schema. No contract/table change.

**Examples:**
- Add `nail_health_assessment_result` to `beauty_sessions.metadata`
- Support `capacity = 2` for stations (already in schema)
- Multi-resource allocation logic

---

### 3. SEMANTIC GAP (raise ACR)
**ONLY IF:** Beauty OS contracts CANNOT express required Nail capability

**Examples of real semantic gaps:**
- Contract missing essential lifecycle state
- Table schema cannot store required fact
- Business invariant cannot be enforced

**NOT semantic gaps:**
- Domain terminology difference (technician vs stylist)
- Metadata extension (polish options)
- Business logic variation (capacity N)

**Action:** Raise ACR. Architecture Council review required.

---

## WORKFLOWS TO VERIFY

### 1. Appointment Booking Workflow
```
Customer → Select Nail Service → Choose Technician → Pick Time → Confirm
```

**Contracts used:**
- IServiceCatalog (get nail services)
- IProfessionalAssignment (assign technician)
- IAppointment (create booking)
- IResourceAllocation (allocate station)

**Expected:** Workflow completes. Booking created in `beauty_appointments`.

**If fails:** Classify → fix/extend/gap

---

### 2. Capacity Conflict → Waitlist
```
All stations full → Customer requests slot → Added to waitlist → Cancellation happens → Promotion logic
```

**Contracts used:**
- IResourceAllocation (detect capacity conflict)
- IWaitlist (add to waitlist, promote)

**Expected:** Waitlist entry created. Promotion works.

**If fails:** Classify → fix/extend/gap

---

### 3. Session Execution + Outcome Recording
```
Technician starts session → Health check → Polish applied → Nail art → Complete → Record outcome
```

**Contracts used:**
- ISession (session lifecycle + actual performer)

**Expected:** Session completed. Outcome in `beauty_sessions.metadata` with nail-specific details.

**If fails:** Classify → fix/extend/gap

---

### 4. Multi-Resource Allocation (Pedicure) — CRITICAL TEST
```
Pedicure service → Requires station + foot spa → Allocate both
```

**Contracts used:**
- IResourceAllocation (allocate 2x with same service_commitment_id)

**Why critical:** Tests whether Resource Allocation contract is truly general-purpose or just Haircut-specific.

**Expected:** 
- Two allocations created with same `service_commitment_id`
- Capacity/conflict checks work for both resources
- Resource reallocation handles multi-resource scenarios
- No contract modification needed

**This is strong evidence for Beauty OS generality.**

**If fails:** Classify → fix/extend/gap

---

### 5. Technician Reassignment
```
Original tech unavailable → Reassign to different tech → History preserved
```

**Contracts used:**
- IProfessionalAssignment (reassignment + history)

**Expected:** New assignment created. History in `beauty_professional_assignment_history`.

**If fails:** Classify → fix/extend/gap

---

## TEST APPROACH

**Copy from Haircut integration tests:**
- Read: `src/platform/beauty/application/__tests__/workflow.integration.test.ts`
- Pattern: Setup → Execute workflow → Assert state
- Reuse: Tenant isolation, history immutability, conflict detection

**Nail-specific assertions:**
- Nail metadata extracted correctly
- Capacity N works
- Multi-resource allocation creates 2 records
- Health check validation enforced

**DO NOT:**
- Create new H3-H9 governance
- Re-investigate ownership
- Reopen contract design
- Add new tables unless proven semantic gap

---

## SUCCESS CRITERIA (DAY 2)

**Integration tests PASS if:**
- [ ] All 5 workflows complete end-to-end
- [ ] No contract modifications needed
- [ ] No table schema changes needed
- [ ] Extensions fit within metadata/config/logic only

**Test reuse metric:** Measure actual % (target >80% as indicator, not requirement)

**Then:** Day 2 COMPLETE. Proceed to browser/E2E + Factory measurement.

**If semantic gap found:**
- Document gap with evidence (which workflow, which contract, why insufficient)
- Raise ACR
- PAUSE Nail until gap resolved

---

## DAY 2 → DAY 3 PATH

**If 5 workflows PASS:**
- ✅ Skip architecture phase
- ✅ Go directly to: Browser/E2E product verification + Factory metrics measurement
- ✅ Goal: Ship Nail using existing foundation, not study foundation

**NOT recommended:**
- ❌ Create Day 3 architecture phase
- ❌ Additional governance checkpoints
- ❌ Re-verify contracts already proven

---

## EXPECTED RESULT

Delta Scan suggested 100% coverage. Day 2 tests will prove or disprove empirically.

**No probability claims.** Results speak for themselves.

---

**Day 2 owner:** Nail development team  
**Review authority:** Semantic gap classification only if needed  
**Next checkpoint:** Integration tests complete
