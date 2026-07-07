# Policy Model Validation

**Mục tiêu:** Chứng minh **Policy DSL đủ expressive** để xử lý nhiều loại bài toán khác nhau mà KHÔNG CẦN sửa engine.

**KPI:** `DSL expressiveness = sufficient` qua tất cả case studies

**Focus:**
- **DSL** (sống 10 năm, quyết định mọi policy) > RuleReasoner (~100 LOC, ít thay đổi)
- Payroll = hardest test → validate DSL sớm nhất

**Được phép:** DSL evolution (thêm operators khi cần: BETWEEN, CONTAINS, SUM, FORMULA)
**KHÔNG được phép:** Domain-specific code trong engine (if booking..., if payroll...)

---

## Case Study Progress

| Case Study | Domain | Problem Type | Status | Engine Sửa | DSL Sửa | Operators Mới |
|------------|--------|--------------|--------|-----------|---------|---------------|
| Case 1 | Leave Approval | Permission Check | ✅ Complete | 0 | 0 (baseline) | 0 |
| Case 2 | Booking Capacity | Resource Constraint | ✅ Complete | **0** ✅ | **0** ✅ | 0 |
| Case 3 | Payroll | Complex Calculation | 🔜 Next | ? | ? | formula? sum? |
| Case 4 | Promotion | Eligibility Check | 🔜 Planned | ? | ? | contains? |
| Case 5 | Membership | Tier Classification | 🔜 Planned | ? | ? | 0? |

**Why Payroll before Promotion?**
- Payroll = hardest DSL test (formula, aggregation, prorata)
- If DSL passes Payroll → Promotion/Membership likely easy
- Early validation prevents costly refactoring later

---

## Case Study 1: Leave Approval (Baseline)

**Problem Type:** Permission check (approve/reject/escalate workflow)

**Operators Used:**
- Comparison: `>=`, `<`, `>`, `==`, `===`
- Logical: `and`, `or`

**Operators Added:** None (baseline)

**Knowledge Structure:**
```typescript
{
  "employee.id": string,
  "employee.role": string,
  "leave.type": string,
  "leave.hoursNotice": number,
  "leave.balance": number,
  "leave.reason": string,
  "attendance.violations": number,
  "context.hasConflict": boolean,
  "context.isWeekend": boolean
}
```

**Decision Outcomes:** `APPROVE | REJECT | ESCALATE`

**Rules:** 6 rules (declarative, JSON-serializable)

**LOC:**
- Policy: ~150 LOC
- Service: ~200 LOC
- Tests: ~180 LOC

**Success Criteria:**
- ✅ Policy = pure data (no functions)
- ✅ Knowledge = dictionary
- ✅ RuleReasoner evaluates correctly

---

## Case Study 2: Booking Capacity ✅

**Problem Type:** Resource constraint check (capacity/availability)

**Operators Used:**
- Comparison: `>`, `<=`, `===`
- Logical: `and`, `or`

**Operators Added:** **NONE** (existing operators sufficient)

**Knowledge Structure:**
```typescript
{
  "booking.id": string,
  "booking.remainingSessions": number,
  "booking.completedSessions": number,
  "booking.totalSessions": number,
  "booking.isActive": boolean,
  "booking.status": string,
  "ktv.id": string,
  "ktv.hasConcurrentSession": boolean,
  "resource.roomAvailable": boolean,
  "resource.equipmentAvailable": boolean,
  "time.requestedDate": string,
  "time.requestedTime": string,
  "time.hasConflict": boolean,
  "time.concurrentSessionCount": number
}
```

**Decision Outcomes:** `BOOKABLE | FULL | ESCALATE`

**Rules:** 7 rules (declarative, JSON-serializable)

**LOC:**
- Policy: ~170 LOC
- Service: ~220 LOC
- Tests: ~280 LOC

**Success Criteria:**
- ✅ Policy = pure data (JSON-serializable verified)
- ✅ Knowledge = dictionary (no typed interfaces)
- ✅ **No domain-specific code in engine** (same engine handles both Leave and Booking)
- ✅ **DSL unchanged** (existing operators sufficient)
- ✅ Different problem type works (resource constraint vs permission)
- ✅ Different outcomes work (BOOKABLE/FULL vs APPROVE/REJECT)
- ✅ Service layer handles business logic (time overlap, counting)
- ✅ **Policy doesn't know DB schema** (knowledge builder maps DB fields to policy fields)
- ✅ **Beautiful boundary**: Service computes `overlap` → Knowledge has `hasConflict: boolean` → Policy evaluates boolean

**Key Insight:**
> Engine không biết "overlap", "calendar", "time range". Engine chỉ biết boolean. Đó là generic thực sự.

**Key Learnings:**
1. **DSL expressive enough:** Không cần thêm `overlap`, `between`, `count` operators. Service layer xử lý logic phức tạp, chỉ pass kết quả boolean/number vào knowledge.
2. **Pattern consistent:** buildKnowledge() → RuleReasoner.evaluate() → structured logging pattern works well.
3. **Outcome extensibility:** Thêm outcome types mới (BOOKABLE, FULL) không ảnh hưởng engine hoặc DSL.
4. **Boundary clarity:** Service = complex logic (overlap detection), Policy = simple evaluation (boolean check). Engine stays domain-agnostic.

---

## Case Study 3: Payroll (Next - Critical DSL Test)

**Problem Type:** Complex calculation with multiple policies

**Why This is THE Critical Test:**
- Payroll is 10-20x more complex than Leave/Booking
- Multiple policy pipeline (base salary → commissions → bonuses → penalties → tax)
- Requires aggregation (`sum`, `count`, `avg`)
- Requires formula evaluation (`prorata`, `progressive tiers`)
- Has dependencies between policies

**This validates DSL expressiveness, not just engine genericity.**

**Expected Operators:**
- Potential: `sum`, `count`, `avg`, `max`, `min` (aggregation)
- Potential: `formula` type condition (for complex calculations)
- Alternative: Service layer handles ALL calculations, only pass results to knowledge

**Design Questions:**
1. Can DSL express prorata calculation? `(baseSalary / 26) * workDays`
2. Can DSL express commission tiers? `if sessions > 100 then rate = 15% else 10%`
3. Can DSL express sum? `sum(sessions.commission)`
4. Or should service pre-compute everything?

**Hypothesis:** 
- RuleReasoner core logic unchanged
- MAY need DSL extensions (`formula` condition type)
- Service layer solution preferred if feasible

**This is the REAL test:** If DSL survives Payroll without major refactoring, architecture is validated.

---

## Case Study 4: Promotion (After Payroll)

**Problem Type:** Eligibility check (customer qualifies for promotion?)

**Expected Operators:** Existing (comparison, and, or) should be sufficient

**Expected Knowledge Fields:**
- `customer.totalSpending`: number
- `customer.visitCount`: number
- `customer.membershipTier`: string
- `promotion.minSpending`: number
- `promotion.eligibleTiers`: array (service handles `.includes()` → boolean)
- `promotion.isActive`: boolean
- `promotion.hasQuotaRemaining`: boolean

**Expected Outcomes:** `ELIGIBLE | INELIGIBLE | ESCALATE`

**Hypothesis:** DSL unchanged (existing operators sufficient if Payroll passed)

---

## Case Study 5: Membership (After Payroll)

**Problem Type:** Tier classification (upgrade/maintain/downgrade)

**Expected Operators:** Existing (comparison, and, or) should be sufficient

**Expected Knowledge Fields:**
- `customer.totalSpending`: number
- `customer.visitFrequency`: number
- `customer.lifetimeValue`: number
- `tier.goldThreshold`: number
- `tier.silverThreshold`: number
- `tier.current`: string

**Expected Outcomes:** `UPGRADE | MAINTAIN | DOWNGRADE`

**Hypothesis:** DSL unchanged (tier logic uses existing comparison operators)

---

## Sprint 6+: Payroll (Critical Validation)

**Note:** This section is obsolete. Payroll moved to Case Study 3 (before Promotion/Membership).

See "Case Study 3: Payroll" above for current plan.

---

## Architecture Principles (Must Hold)

### 1. Policy = Data (Never functions)

**Rule:** All policies must be JSON-serializable

**Test:**
```typescript
const serialized = JSON.stringify(policy);
const deserialized = JSON.parse(serialized);
// Should work without errors
```

**Why:** Enables:
- Database storage
- Version control
- Visual policy editor UI
- Remote policy updates

### 2. Knowledge = Dictionary (Never typed interfaces at engine level)

**Rule:** `Knowledge = Record<string, unknown>`

**Test:**
```typescript
const knowledge: Knowledge = {
  "domain.field": value,
  "another.field": value
};
// Engine doesn't know about "Leave" or "Booking" types
```

**Why:** Enables:
- Generic engine (domain-agnostic)
- Easy extension (add fields without changing engine)
- Service layer owns business logic

### 3. Engine = Generic (No Domain Code)

**Rule:** Core evaluation logic never has domain-specific branches

**Allowed:**
```typescript
// ✅ Generic operator extension
case 'between':
  return value >= condition.min && value <= condition.max;

case 'formula':
  return evaluateFormula(condition.expression, knowledge);
```

**NOT Allowed:**
```typescript
// ❌ Domain-specific logic
if (domain === 'booking') {
  // special booking logic
}

if (domain === 'payroll') {
  // special payroll logic
}
```

**Why:** Proves architecture is truly generic. DSL can evolve (add operators), but engine stays domain-agnostic.

### 4. DSL = Expressive (Can express business logic)

**Rule:** DSL must be expressive enough for business needs

**Test Questions:**
- Can DSL express Payroll formulas? (prorata, tiers, commissions)
- Can DSL express eligibility checks? (array membership, set operations)
- Can DSL express tier classification? (range checks, thresholds)

**Why:** If DSL too limited → policies become unreadable or impossible to express

**Balance:** DSL expressiveness vs complexity (aim for <10 operators by Payroll)

---

## Validation Metrics

### Code Metrics

| Metric | Case 1 | Case 2 | Case 3 | Case 4 | Target |
|--------|--------|--------|--------|--------|--------|
| RuleReasoner LOC | 90 | 90 | ? | ? | <150 |
| Policy LOC | 150 | 170 | ? | ? | <300 per policy |
| Service LOC | 200 | 220 | ? | ? | <400 per domain |
| Test LOC | 180 | 280 | ? | ? | >100 per policy |
| Test Pass Rate | 100% | 100% | ? | ? | 100% |

### Architecture Metrics (The Real KPIs)

| Metric | Case 1 | Case 2 | Case 3 | Case 4 | Target |
|--------|--------|--------|--------|--------|--------|
| Domain code in engine? | No | **No** ✅ | ? | ? | Never |
| DSL expressive? | Yes | **Yes** ✅ | ? | ? | Always |
| DSL operators count | 8 | 8 | ? | ? | <12 by Payroll |
| Service handles complexity? | Yes | **Yes** ✅ | ? | ? | Always |
| Policy serializable? | ✅ | ✅ | ? | ? | Always |
| Knowledge typed at engine? | ❌ | ❌ | ? | ? | Never |

---

## Decision: Go/No-Go for Case Study 3 (Payroll)

**Current Status:** Case Study 2 PASS ✅

**Evidence:**
- ✅ Engine unchanged (no domain code)
- ✅ DSL expressive (existing operators sufficient)
- ✅ Policy = data (JSON-serializable verified)
- ✅ Knowledge = dictionary (no interfaces)
- ✅ 2 problem types validated (permission check, resource constraint)
- ✅ Beautiful boundary (service handles complexity, policy evaluates simple values)
- ✅ All tests pass (21/21 total)

**Decision:** **GO for Case Study 3 (Payroll)**

**Why Payroll Next (Not Promotion):**
1. Payroll = hardest DSL test (formula, aggregation, dependencies)
2. If DSL passes Payroll → confidence in architecture
3. If DSL fails Payroll → refactor early, before building Promotion/Membership on weak foundation
4. Promotion/Membership likely easier if Payroll works

**Rationale:**
- DSL validated for 2 different problem types (permission, resource)
- No architectural issues found
- Pattern proven scalable
- Early Payroll validation prevents costly refactoring later

---

## 5 Questions After Each Case Study

After completing each case study, answer:

1. **Có sửa RuleReasoner không?** (target: No)
2. **Có sửa DSL không?** (acceptable: Yes, if adds generic operators)
3. **Có sửa Knowledge model không?** (target: No)
4. **DSL đủ expressive không?** (target: Yes)
5. **Có operator mới không?** (acceptable: Yes, if needed)

**If most answers = "No" or "Generic extension" → Architecture stable**

---

## Next Steps

1. **Case Study 3:** Design Payroll DSL (critical phase)
2. **Payroll Design:** Define formula syntax, aggregation operators
3. **Payroll Implementation:** Build policy (~300-500 LOC estimate)
4. **Validation:** Verify DSL expressiveness with real payroll scenarios
5. **Case Study 4-5:** Promotion, Membership (if Payroll passes)

---

## References

- Case Study 1 Implementation: `src/lib/decision-engine/policies/leave-approval-v1.ts`
- Case Study 2 Implementation: `src/lib/decision-engine/policies/booking-capacity-v1.ts`
- RuleReasoner: `src/lib/decision-engine/RuleReasoner.ts`
- Types: `src/lib/decision-engine/types.ts`
- Tests: `src/__tests__/decision-engine/`
- DSL Spec: `docs/decision-engine/DECISION_DSL_SPEC_V1.md`
- Operator Roadmap: `docs/decision-engine/OPERATOR_EVOLUTION_ROADMAP.md`
