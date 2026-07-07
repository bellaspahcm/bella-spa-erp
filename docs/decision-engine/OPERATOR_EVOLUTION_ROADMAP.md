# Operator Evolution Roadmap

**Purpose:** Plan DSL extensions across sprints based on real business needs

**Rule:** Only add operators when policy actually needs them (not speculatively)

---

## Case Study Summary

| Case Study | Domain | New Operators | Reason |
|------------|--------|---------------|--------|
| Case 1 | Leave | Baseline: `>=, >, <, <=, ==, ===, and, or` | Foundation |
| Case 2 | Booking | **None** | Existing operators sufficient |
| Case 3 | Payroll | TBD (likely `formula`, `sum`) | Complex calculations - CRITICAL TEST |
| Case 4 | Promotion | TBD (likely `contains`, `in`) | Array/set membership |
| Case 5 | Membership | TBD (likely none) | Tier thresholds use existing |

**Key Change:** Payroll moved before Promotion to validate DSL early with hardest test.

---

## Operator Candidates

### High Priority (Case Study 3 - Payroll)

| Operator | Use Case | Example | Complexity | Decision |
|----------|----------|---------|------------|----------|
| `formula` | Complex calc | `(base / 26) * workDays` | High | 🔜 Payroll DSL design |
| `sum` | Aggregation | `sum(sessions.commission)` | Medium | 🔜 Wait for Payroll |
| `count` | Counting | `count(violations)` | Medium | 🔜 Wait for Payroll |
| `avg` | Average | `avg(ratings)` | Medium | 🔜 Wait for Payroll |

### Medium Priority (Case Study 4-5)

| Operator | Use Case | Example | Complexity | Decision |
|----------|----------|---------|------------|----------|
| `contains` | Array membership | `eligibleTiers contains tier` | Low | ⚠️ After Payroll |
| `in` | Set membership | `tier in ['gold','silver']` | Low | ⚠️ After Payroll |
| `between` | Range check | `age between 18 and 65` | Low | ⚠️ If needed |
| `exists` | Null check | `email exists` | Low | ⚠️ Can use `!== null` |

### Low Priority / Alternative Solutions

| Operator | Alternative | Why |
|----------|-------------|-----|
| `not` | Use `!==`, `!=` | Existing operators sufficient |
| `startsWith` | Service layer preprocessing | Too specific |
| `regex` | Service layer preprocessing | Too complex for policy DSL |
| `date_add` | Service layer calculation | Date logic outside DSL scope |

---

## Decision Criteria

### When to Add Operator

✅ **ADD if:**
1. Multiple policies need it (3+ use cases)
2. Pattern is common across domains
3. Implementation is simple (<50 LOC)
4. Makes policy more readable
5. Cannot be reasonably done in service layer

❌ **DON'T ADD if:**
1. Only 1 policy needs it
2. Service layer can handle easily
3. Too domain-specific
4. Adds significant complexity
5. Requires external dependencies

---

## Case Study 3: Payroll (Next - Critical DSL Test)

### Expected Needs

**Business Logic (Complex):**
- Base salary = `baseSalary / 26 * workDays` (prorata)
- Service commission = `sum(sessions.commission)`
- Product commission = `sum(sales.commission)`
- KPI bonus = `tier_based_amount`
- Total = `base + service + product + kpi - penalties`

**Knowledge Structure (predicted):**
```typescript
{
  "salary.baseSalary": 8000000,
  "salary.workDays": 22,
  "salary.totalDays": 26,
  "salary.serviceCommission": 2500000,  // Pre-computed by service
  "salary.productCommission": 1000000,  // Pre-computed by service
  "salary.kpiBonus": 500000,
  "salary.penalties": 200000
}
```

### Critical DSL Questions

**This is THE test for DSL expressiveness:**

1. **Can DSL express prorata?** `(baseSalary / 26) * workDays`
   - Option A: Service computes → knowledge has final number
   - Option B: DSL has `formula` operator

2. **Can DSL express sum?** `sum(sessions.commission)`
   - Option A: Service computes → knowledge has total
   - Option B: DSL has `sum` aggregation operator

3. **Can DSL express tiers?** `if sessions > 100 then 15% else 10%`
   - Option A: Service computes rate → knowledge has percentage
   - Option B: DSL has conditional evaluation

### Design Strategy

**Recommended Approach:**
1. Start with **Service Layer Does Everything** (Option A)
2. Only add DSL operators if policies become unreadable
3. Prefer simple DSL + smart service over complex DSL

**Example (Service First):**
```typescript
// Service computes all
const knowledge = {
  "salary.total": 11800000,  // Final computed value
  "salary.valid": true
}

// Policy just validates
if salary.valid === true → APPROVE
```

**Alternative (DSL with Formula):**
```typescript
// Policy has calculation logic
{
  type: 'formula',
  expression: '(baseSalary / 26 * workDays) + serviceCommission + ...',
  variables: { baseSalary, workDays, ... }
}
```

**Decision Point:** Will determine if DSL needs major extension or if service-first approach works.

---

## Case Study 4: Promotion (After Payroll)

## Case Study 4: Promotion (After Payroll)

### Expected Needs

**Business Logic:**
- Customer qualifies if total spending >= threshold
- AND membership tier in eligible tiers
- AND promotion is active
- AND quota remaining

**Knowledge Structure (predicted):**
```typescript
{
  "customer.totalSpending": 5000000,
  "customer.tier": "gold",
  "promotion.minSpending": 3000000,
  "promotion.tierEligible": true,  // Service computed membership check
  "promotion.isActive": true,
  "promotion.quotaRemaining": 50
}
```

### Operator Analysis

**If Payroll used service-first approach:**
- Promotion likely follows same pattern
- Service checks tier membership → boolean
- Policy evaluates simple conditions
- **Prediction: No new operators needed**

**If Payroll added `formula` operator:**
- Might consider `contains` for elegance
- But service-first still preferred
- **Prediction: Evaluate after Payroll**

---

## Case Study 5: Membership (After Payroll)

## Case Study 5: Membership (After Payroll)

### Expected Needs

**Business Logic:**
- UPGRADE if spending >= gold threshold AND current != gold
- MAINTAIN if within current tier range
- DOWNGRADE if spending < current tier minimum

**Knowledge Structure (predicted):**
```typescript
{
  "customer.totalSpending": 8000000,
  "customer.currentTier": "silver",
  "tier.goldThreshold": 10000000,
  "tier.silverThreshold": 5000000,
  "tier.bronzeThreshold": 0
}
```

### Operator Analysis

**Prediction: No new operators needed**
- All logic uses existing comparison (`>=`, `<`, `!==`)
- Tier classification = range checks
- Service layer doesn't need to pre-compute

---

## Sprint 6+: Payroll

**Note:** This section is obsolete. Payroll moved to Case Study 3.

See "Case Study 3: Payroll" above for current plan.

### Expected Needs

**Business Logic (Complex):**
- Base salary = `baseSalary / 26 * workDays` (prorata)
- Service commission = `sum(sessions.commission)`
- Product commission = `sum(sales.commission)`
- KPI bonus = `tier_based_amount`
- Total = `base + service + product + kpi - penalties`

**Knowledge Structure (predicted):**
```typescript
{
  "salary.baseSalary": 8000000,
  "salary.workDays": 22,
  "salary.totalDays": 26,
  "salary.serviceCommission": 2500000,  // Pre-computed by service
  "salary.productCommission": 1000000,  // Pre-computed by service
  "salary.kpiBonus": 500000,
  "salary.penalties": 200000
}
```

### Operator Analysis

| Check | Current Solution | Need New Operator? |
|-------|------------------|-------------------|
| Prorata calculation | Service layer | ✅ Maybe `formula`? |
| Sum commissions | Service layer | ✅ Maybe `sum`? |
| Tier-based bonus | Existing `>=` rules | ❌ Existing |
| Addition/subtraction | Service layer | ✅ Maybe `formula`? |

**Decision Strategy:**

**Option A: Service Layer Does Everything** (Recommended)
```typescript
// Service computes all
knowledge = {
  "salary.total": 11800000  // Final number
}

// Policy just validates
if salary.total > 0 → VALID
```

**Option B: Policy Does Calculation** (Only if needed)
```typescript
// Add formula operator
{
  type: 'formula',
  expression: '(baseSalary / 26 * workDays) + serviceCommission + ...',
  variables: { ... }
}
```

**Recommendation:** 
- Start with Option A (service layer)
- Only add `formula` operator if policies become too complex
- Re-evaluate after Sprint 5

---

## Design Principles

### 1. Service Layer First

```
Complex Logic → Service Layer → Simple Knowledge → Policy
```

**Example:**
```typescript
// Service layer
const isEligible = checkTierMembership(tier, eligibleTiers);
const hasQuota = quotaRemaining > 0;

// Knowledge
knowledge = {
  "promotion.tierEligible": isEligible,
  "promotion.hasQuota": hasQuota
}

// Policy (simple)
if tierEligible === true AND hasQuota === true → ELIGIBLE
```

### 2. DSL Evolution Pace

- Sprint 2-3: Baseline operators only
- Sprint 4-5: Add 1-2 operators if pattern clear
- Sprint 6+: Major evaluation (formula? aggregation?)

**Target:** <10 total operators by Payroll sprint

### 3. Readability Over Power

Prefer:
```json
{
  "field": "customer.tierEligible",
  "operator": "===",
  "value": true
}
```

Over:
```json
{
  "type": "complex_check",
  "function": "checkTierMembership",
  "args": ["tier", "eligibleTiers"]
}
```

---

## Review Schedule

- **After Case Study 3 (Payroll):** CRITICAL - Review DSL expressiveness, decide if formula/sum needed
- **After Case Study 4 (Promotion):** Review if Payroll decisions held, any new patterns
- **After Case Study 5 (Membership):** Final validation - is DSL stable? (<12 operators?)
- **Production Deployment:** All 5 case studies validated, ready for real usage

---

**Last Updated:** Case Study 2 complete (June 2026)  
**Next Review:** After Case Study 3 (Payroll) - Critical DSL validation
