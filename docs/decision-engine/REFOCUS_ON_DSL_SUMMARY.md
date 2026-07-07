# Refocus on DSL - Summary of Changes

**Date:** June 22, 2026  
**Trigger:** User feedback after Case Study 2 completion  
**Score:** 9.5/10 → Key insight provided

---

## What Changed

### 1. KPI Shifted: Engine → DSL

**Old KPI:**
```
RuleReasoner modifications = 0
```

**New KPI:**
```
DSL expressiveness = sufficient
DSL modifications = minimal (generic extensions only)
```

**Why:**
- RuleReasoner: ~100 LOC, rarely changes
- **DSL: Lives 10 years, decides all future policies**
- Real question: "Can DSL express business logic?" not "Did engine change?"

---

### 2. Roadmap Reordered: Payroll First

**Old Order:**
```
Leave → Booking → Promotion → Membership → Payroll
```

**New Order:**
```
Leave → Booking → Payroll → Promotion → Membership
```

**Why:**
- Payroll = hardest DSL test (formula, aggregation, dependencies)
- If DSL passes Payroll → confidence in architecture
- If DSL fails Payroll → refactor early, before building on weak foundation
- Promotion/Membership likely easier if Payroll works

---

### 3. Terminology: Sprint → Case Study

**Old:** Sprint 2, Sprint 3, Sprint 4...

**New:** Case Study 1, Case Study 2, Case Study 3...

**Why:**
- "Sprint" implies time-boxed iteration
- "Case Study" implies learning and validation
- Focus on "What did we learn?" not "What did we build?"

---

### 4. Architecture Focus: Engine → DSL Expressiveness

**Old Questions:**
- Did RuleReasoner change?
- Is engine generic?

**New Questions:**
- Is DSL expressive enough?
- Can DSL express Payroll formulas?
- Can DSL express eligibility checks?
- Should service layer handle complexity?

---

### 5. Success Metrics

**Old:**
| Metric | Target |
|--------|--------|
| RuleReasoner sửa | 0 |
| New operators | <2 per sprint |

**New:**
| Metric | Target |
|--------|--------|
| Domain code in engine? | Never |
| **DSL expressive?** | **Always** |
| DSL operators count | <12 by Payroll |
| Service handles complexity? | Always |

---

## 5 Questions After Each Case Study

Replacing old checklist with focused questions:

1. **Có sửa RuleReasoner không?** (target: No)
2. **Có sửa DSL không?** (acceptable: Yes, if generic operators)
3. **Có sửa Knowledge model không?** (target: No)
4. **DSL đủ expressive không?** (target: Yes) ← **KEY QUESTION**
5. **Có operator mới không?** (acceptable: Yes, if needed)

**If most = "No" or "Generic extension" → Architecture stable**

---

## Key Insights from User

### 1. DSL > Engine

> "RuleReasoner chỉ khoảng 100 dòng. Thứ sống 10 năm sẽ là DSL."

- Engine rarely changes
- DSL determines what policies can be expressed
- Focus validation on DSL expressiveness

### 2. Beautiful Boundary (Case Study 2)

> "Engine không biết overlap. Engine không biết calendar. Engine chỉ biết boolean. Đó là generic thực sự."

**Pattern:**
```
Service: overlap detection (complex)
    ↓
Knowledge: hasConflict: boolean (simple)
    ↓
Policy: === comparison (declarative)
```

### 3. Payroll = Real Test

> "Nếu DSL chịu nổi Payroll thì Promotion và Membership gần như là bài toán dễ hơn."

- Payroll: formula, aggregation, dependencies
- 10-20x more complex than Leave/Booking
- Early validation prevents costly refactoring

### 4. Don't Prove Engine Generic, Prove DSL Expressive

> "Đừng cố chứng minh RuleReasoner = generic cho mọi domain. Hãy chứng minh Policy DSL đủ expressive."

- Different focus
- Different validation criteria
- DSL expressiveness matters more than engine purity

---

## What Stayed the Same (Good)

✅ Policy = Data (JSON-serializable)  
✅ Knowledge = Dictionary (no typed interfaces)  
✅ Engine = Generic (no domain-specific code)  
✅ Service = Complex Logic (business logic in service layer)  
✅ Policy ≠ DB Schema (knowledge builder abstracts)

**These principles don't change. Only focus/metrics changed.**

---

## Documents Updated

1. **POLICY_MODEL_VALIDATION.md**
   - Changed KPI to DSL expressiveness
   - Reordered case studies (Payroll before Promotion)
   - Added "5 Questions" framework
   - Renamed Sprint → Case Study

2. **OPERATOR_EVOLUTION_ROADMAP.md**
   - Reordered priorities (Payroll operators first)
   - Added Payroll design questions
   - Updated review schedule

3. **SPRINT3_SUMMARY.md**
   - Emphasized DSL focus
   - Added "Beautiful Boundary" insight
   - Updated next steps (Payroll next)

4. **DECISION_DSL_SPEC_V1.md**
   - (No changes needed - already DSL-focused)

---

## Impact on Case Study 3 (Payroll)

### Critical Questions to Answer

1. **Can DSL express prorata calculation?**
   - `(baseSalary / 26) * workDays`
   - Option A: Service computes → knowledge has number
   - Option B: DSL has `formula` operator

2. **Can DSL express aggregation?**
   - `sum(sessions.commission)`
   - Option A: Service computes → knowledge has total
   - Option B: DSL has `sum` operator

3. **Can DSL express conditional tiers?**
   - `if sessions > 100 then rate = 15% else 10%`
   - Option A: Service computes rate → knowledge has percentage
   - Option B: DSL has conditional evaluation

### Design Philosophy

**Prefer:** Simple DSL + Smart Service  
**Over:** Complex DSL + Dumb Service

**Goal:** Keep DSL <12 operators by Payroll case study

---

## Score

**Before Refocus:** Good execution (9/10), wrong focus (RuleReasoner purity)  
**After Refocus:** **9.5/10** - Correct focus (DSL expressiveness)

**Remaining 0.5:** Will be answered by Payroll case study
- If DSL passes Payroll elegantly → 10/10
- If DSL needs major refactoring → need architecture revision

---

**Status:** Refocus complete ✅  
**Next:** Begin Case Study 3 (Payroll DSL Design)  
**Timeline:** Start when ready (not time-boxed)
