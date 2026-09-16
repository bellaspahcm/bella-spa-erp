# BEAUTY FACTORY RULE — MARGINAL COST REDUCTION

**Status:** ACTIVE  
**Authority:** Post-H9 Haircut Closure  
**Effective Date:** 2026-09-16  
**Scope:** All future Beauty OS products (Nail, Massage, Facial, etc.)

---

## PROBLEM STATEMENT

**Haircut trải qua H3 → H4 → H5 → H6 → H7 → H8 → H9** với chi phí kiến trúc cao vì nó **xây nền Beauty OS lần đầu**:
- Xác định ownership (Platform vs Product)
- Loại bỏ contract inheritance thừa
- Tách rõ IAppointment, IServiceCatalog, IAssignment, IAllocation, IWaitlist, ISession
- Xây Professional Assignment + Resource Allocation patterns
- Xác định source of truth, RLS, tenant isolation
- Recovery/history/audit infrastructure
- Migration + runtime verification

**Chi phí này là UNAVOIDABLE cho sản phẩm đầu tiên xây OS mới.**

Nhưng nếu **Bella Nail, Bella Massage cũng mất gần bằng Haircut để governance kiến trúc**, thì Factory đang **over-engineer và không tạo lợi thế biên**.

---

## FACTORY RULE — CORE PRINCIPLE

```text
HAIRCUT = XÂY KHUÔN (chi phí kiến trúc cao, unavoidable)
NAIL / MASSAGE / FACIAL = DÙNG KHUÔN (chi phí biên phải giảm mạnh)
```

**Beauty OS Foundation đã có:**
1. ✅ 6 frozen contracts (IAppointment, IServiceCatalog, IAssignment, IAllocation, IWaitlist, ISession)
2. ✅ Professional assignment + resource allocation patterns
3. ✅ Application services + adapters structure
4. ✅ Persistence mapping (booking_resources, session_logs, waitlist)
5. ✅ Test patterns (invariants, adapters, workflow integration, E2E)
6. ✅ Migration + RLS baseline

**Nail không được xây lại:**
- ❌ Không tạo INailAppointment contract mới (reuse IAppointment)
- ❌ Không re-investigate ownership (Platform contracts đã frozen)
- ❌ Không tạo nail_appointments table mới (reuse bookings + session_logs)
- ❌ Không rewrite assignment/allocation logic từ đầu
- ❌ Không tạo H3 → H9 checkpoint sequence mới

---

## NAIL DEVELOPMENT PATH (EXAMPLE)

### Phase 0: Delta Analysis (1-2 days max)
**Question:** What is DIFFERENT between Nail and Haircut at business level?

**Example deltas:**
- Nail services có polish selection (color/brand) → Service catalog extension
- Nail có nail art packages (multi-session treatment) → Treatment package logic
- Nail technician specialization (acrylic vs gel) → Resource metadata extension
- Nail health assessment required before service → Pre-service validation

**Output:** Delta specification document (NOT full H3-H9 sequence)

---

### Phase 1: Reuse Verification (2-3 days)
**Checklist:**
1. ✅ Can Nail services map to IServiceCatalog? → YES (extend metadata for polish/art)
2. ✅ Can Nail appointments use IAppointment? → YES (same booking workflow)
3. ✅ Can Nail tech assignment use IAssignment? → YES (resource = nail tech)
4. ✅ Can capacity management use IAllocation? → YES (tech capacity = 1 or 2 hands)
5. ✅ Can waitlist use IWaitlist? → YES (no change needed)
6. ✅ Can session execution use ISession? → YES (record actual performer)

**If ALL YES → proceed to Phase 2 directly.**  
**If ANY NO → raise Architecture Change Request (ACR), do NOT reopen H4-H9.**

---

### Phase 2: Product Skeleton Generation (3-5 days)
**Use Haircut as template:**

```typescript
// Copy structure, replace domain terms
src/platform/beauty/
  contracts/              // REUSE (no changes)
  application/
    adapters/
      nail.adapter.ts     // Copy haircut.adapter.ts, replace domain logic
    services/
      nail-booking.service.ts
      nail-session.service.ts
    __tests__/
      nail.adapters.test.ts
      nail.workflow.test.ts
```

**AI Coding instruction:**
```
"Generate Bella Nail product skeleton using Haircut as template.
Reuse all 6 Beauty OS contracts without modification.
Adapter changes:
- Service catalog: add polish_selection, nail_art_type to metadata
- Resource type: 'nail_tech' instead of 'stylist'
- Session validation: add nail_health_assessment_passed check
Keep all persistence, RLS, tenant isolation patterns identical."
```

**Duration:** 3-5 days (not 3 weeks like Haircut H3-H7)

---

### Phase 3: Integration Test + E2E (2-3 days)
**Copy Haircut test patterns:**
- Invariant tests (contracts unchanged, skip)
- Adapter tests (verify Nail-specific logic)
- Workflow integration tests (appointment → session with nail deltas)
- E2E smoke tests (tenant isolation + double-booking prevention)

**Reuse E2E harness:** Duplicate 13-tenant-isolation-smoke.spec.ts → 15-nail-smoke.spec.ts

**Duration:** 2-3 days (not 1 week like H8-H9)

---

### Phase 4: Deployment (1-2 days)
**Reuse migration patterns:**
- No new tables (use existing bookings, session_logs, booking_resources)
- Add `module_key = 'nail'` to packages
- Verify RLS policies cover `enabled_modules.nail = true`
- Run architecture guard (should pass without Nail-specific changes)

**Duration:** 1-2 days

---

## TOTAL NAIL TIMELINE: 9-15 DAYS (vs 6+ weeks for Haircut)

**This is the Factory advantage:**
- **Haircut:** 6+ weeks (H3 → H9) — paid architecture cost
- **Nail:** 9-15 days — marginal product development
- **Massage:** 7-12 days — reuse Nail patterns + deltas
- **Facial:** 5-10 days — mature factory workflow

**Marginal cost reduction: 70-80%**

---

## WHEN TO REOPEN ARCHITECTURE GOVERNANCE

**Only if:**
1. **Capability gap:** Nail requires capability NOT in 6 frozen contracts (e.g., subscription billing, inventory reservation)
2. **Performance bottleneck:** Current architecture cannot scale to Nail requirements
3. **Security/compliance:** Nail has regulatory requirements not covered by existing RLS/audit

**Process:**
1. Create **Architecture Change Request (ACR)** with evidence of gap
2. Architecture Council reviews ACR (not full H3-H9 reopening)
3. If approved → targeted fix (e.g., add 7th contract, extend IAllocation)
4. Update Beauty OS baseline
5. ALL products (Haircut, Nail, future) benefit from enhancement

**Do NOT:**
- ❌ Reopen H4-H9 just because Nail has different UI
- ❌ Create parallel governance just for Nail
- ❌ Bypass frozen contracts without ACR

---

## ANTI-PATTERNS TO AVOID

### ❌ Anti-Pattern 1: "Nail is different, we need NailOS"
**Why wrong:** Creates parallel governance, defeats Factory purpose  
**Correct:** Identify deltas, extend Beauty OS if needed, ACR for gaps

### ❌ Anti-Pattern 2: "Let's do H3-H9 again to be safe"
**Why wrong:** Repeats architecture cost, no marginal benefit  
**Correct:** Delta analysis + reuse verification, governance only for proven gaps

### ❌ Anti-Pattern 3: "Nail has special flow, bypass contracts"
**Why wrong:** Breaks platform integrity, creates technical debt  
**Correct:** If contract cannot accommodate Nail, file ACR to fix contract (benefits all products)

### ❌ Anti-Pattern 4: "Copy-paste Haircut code, rename variables"
**Why wrong:** Creates divergence, loses platform benefits  
**Correct:** Generate from template with explicit delta specification

---

## SUCCESS METRICS

**Factory is working if:**
1. ✅ Product N+1 takes < 30% time of Product N (first 3 products)
2. ✅ Product N+1 introduces < 5% new code (rest is reuse/generation)
3. ✅ Architecture governance triggered < 1 time per 3 products
4. ✅ Test patterns reused > 80% across products

**Factory is failing if:**
- ❌ Each product re-investigates ownership
- ❌ Each product creates new contracts/tables
- ❌ Each product has custom H3-H9 sequence
- ❌ Governance cost remains constant per product

---

## IMPLEMENTATION CHECKLIST FOR NAIL (EXAMPLE)

**Week 1:**
- [ ] Delta analysis document (business differences from Haircut)
- [ ] Reuse verification checklist (6 contracts + persistence)
- [ ] Generate Nail product skeleton from Haircut template
- [ ] Implement delta-specific logic (polish selection, nail art)

**Week 2:**
- [ ] Adapter tests PASS
- [ ] Workflow integration tests PASS
- [ ] E2E smoke tests PASS (tenant isolation + Nail-specific scenarios)
- [ ] Architecture guard PASS (no frozen boundary violations)

**Week 3 (optional):**
- [ ] Production deployment preparation
- [ ] BabyCare + Haircut regression green
- [ ] Deploy to pilot tenant
- [ ] Smoke test + monitoring

**Total: 2-3 weeks for Nail (vs 6+ weeks for Haircut)**

---

## AUTHORITY & ENFORCEMENT

**This rule is MANDATORY for all Beauty OS products post-Haircut.**

**Violations (reopen H3-H9 without ACR) require:**
1. Written justification to Architecture Council
2. Demonstration that Factory Rule was attempted and failed
3. Evidence of capability gap not solvable by extension

**Enforcement:**
- Pre-commit architecture guard blocks frozen contract modifications
- CI gate requires reuse metrics (% code generation vs new code)
- Product review includes "Factory Rule compliance" checkpoint

---

## LEGACY REFERENCE

**Haircut paid the architecture cost:**
- H3: Ownership resolution
- H4: Contract inventory + elimination
- H5: Contract design + freeze
- H6: Persistence mapping
- H7: Implementation patterns
- H8: Runtime verification + migration
- H9: Integration + regression

**Nail, Massage, Facial inherit the benefits without repeating the cost.**

This is the **entire purpose** of platform investment.

---

**Created:** 2026-09-16  
**Owner:** Bella Architecture Council  
**Applies to:** All Beauty OS products (Nail, Massage, Facial, Waxing, Makeup, etc.)  
**Review Cycle:** After every 3 new products (verify marginal cost reduction)

---

## APPENDIX: FROZEN BEAUTY OS ARTIFACTS

**Contracts (src/platform/beauty/contracts/):**
1. IAppointment — scheduling & booking
2. IServiceCatalog — service/package management
3. IAssignment — staff-to-booking assignment
4. IAllocation — resource capacity management
5. IWaitlist — waitlist & promotion
6. ISession — session execution & performer tracking

**Tables:**
- bookings (appointments)
- packages (service catalog)
- booking_resources (staff/equipment resources)
- session_logs (session execution records)
- waitlist (capacity overflow management)
- timeline_events (audit trail)

**Test Patterns:**
- Contract invariant tests
- Adapter tests
- Workflow integration tests
- E2E tenant isolation smoke tests
- Migration shape tests

**All of these are REUSABLE for Nail/Massage/Facial without modification or re-investigation.**
