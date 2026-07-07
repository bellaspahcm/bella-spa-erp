# Case Study 3: Payroll DSL Requirements Analysis

**Date:** 2026-06-22  
**Status:** In Progress  
**Goal:** Validate DSL expressiveness với complex payroll calculations

---

## Executive Summary

**Current System:** Bella Payroll uses `recalculateAndSalaryRecordEngine` (~400 LOC) to calculate KTV salaries with 10+ components including:
- Pro-rata base salary calculations
- Package-based session multipliers (1.0x, 1.5x, 2.0x)
- Rating bonuses (tier-based)
- KPI bonuses (threshold-based)
- Service/product commissions (fixed OR percentage)
- Position bonuses (multiplier-based)
- Seniority bonuses (year-based tiers)
- Attendance penalties (late/absent)
- Manual adjustments (approved only)

**Challenge:** Can the Policy DSL express these calculations elegantly without:
1. Adding domain-specific code to RuleReasoner
2. Making the DSL overly complex (>12 operators)
3. Sacrificing policy-as-data principle (JSON-serializable)

---

## Payroll Calculation Patterns

### 1. Pro-Rata Base Salary (Proportional Calculation)

**Formula:**
```typescript
baseSalary = (rawBaseSalary / 26) * actualWorkDays
```

**Business Logic:**
- 26 = standard working days per month (BUSINESS_RULES.PAYROLL.WORKING_DAYS_PER_MONTH)
- `actualWorkDays` = count of attendance records where `status !== 'absent'`
- If employee resigned mid-month → cap at resignation date prorata

**Example:**
```
Raw base: 6,000,000 VND
Worked: 24/26 days
Pro-rata: (6,000,000 / 26) × 24 = 5,538,462 VND
```

**DSL Challenge:** Can DSL express division and multiplication with variables?

---

### 2. Weighted Session Count (Package Multipliers)

**Formula:**
```typescript
weightedSessions = sum(sessions.map(s => packageMultiplier[s.package_name]))
```

**Multipliers:**
- Combo Mẹ & Bé Tiết Kiệm (Basic): 1.0x
- Combo Mẹ & Bé Hạnh Phúc (Happy): 1.5x
- Combo Mẹ & Bé VIP Toàn Diện (VIP): 2.0x

**Example:**
```
10 Basic sessions (1.0x): 10.0
3 Happy sessions (1.5x): 4.5
2 VIP sessions (2.0x): 4.0
Total: 18.5 sessions (quy đổi)
```

**DSL Challenge:** Can DSL express array aggregation with multipliers?


---

### 3. Session Commission Bonus (Simple Aggregation)

**Formula:**
```typescript
sessionBonus = sum(sessions.map(s => s.bookings.ktv_commission || 150000))
```

**Business Logic:**
- Each session has commission (default: 150,000 VND)
- Commission can vary by package tier or booking type

**Example:**
```
Session 1: 200,000 VND
Session 2: 150,000 VND
Session 3: null → 150,000 VND (default)
Total: 500,000 VND
```

**DSL Challenge:** Can DSL express array sum with fallback values?

---

### 4. Rating Bonus (Tiered Calculation)

**Formula:**
```typescript
ratingBonus = weightedSessions × bonusPerSession(averageRating)
```

**Bonus Tiers:**
- 5.0 stars (exact): 50,000 VND/session
- ≥ 4.5 stars: 30,000 VND/session
- ≥ 4.0 stars: 10,000 VND/session
- < 4.0 stars: 0 VND

**Example:**
```
15.5 weighted sessions × 30,000 VND (4.7-star tier) = 465,000 VND
```

**DSL Challenge:** Can DSL express:
1. Tiered lookup (rating → bonus tier)
2. Multiplication with decimal session count

---

### 5. KPI Bonus (Threshold-Based)

**Formula:**
```typescript
kpiBonus = weightedSessions >= targetSessions ? kpiBonusAmount : 0
```

**Business Logic:**
- Target: 30 sessions/month
- Bonus: 1,000,000 VND (if target met)
- All-or-nothing (no partial credit)

**Example:**
```
Sessions: 35 → 1,000,000 VND (target met)
Sessions: 28 → 0 VND (target not met)
```

**DSL Challenge:** Can DSL express conditional assignment based on threshold?

---

### 6. Service Commission (Fixed OR Percentage)

**Formula:**
```typescript
commission = type === 'fixed' 
  ? fixedValue 
  : (percentageValue / 100) × subtotal
```

**Priority:**
1. Override commission (transaction-level)
2. Tenant default (tenant config)
3. System default (150,000 VND fixed)

**Example:**
```
Service subtotal: 1,000,000 VND
Type: 'percentage'
Value: 15
Commission: (15 / 100) × 1,000,000 = 150,000 VND
```

**DSL Challenge:** Can DSL express:
1. Type-conditional calculation (fixed vs percentage)
2. Multi-level fallback (override → default → system)

---

### 7. Product Sales Commission (Fixed OR Percentage)

**Same pattern as Service Commission** but different default:
- System default: 10% percentage (instead of fixed 150k)
- Priority: Override → Tenant default → System default

**Example:**
```
Sales amount: 500,000 VND
Default: 10% percentage
Commission: (10 / 100) × 500,000 = 50,000 VND
```

---

### 8. Position Bonus (Multiplier-Based)

**Formula:**
```typescript
positionBonus = baseCommission × (multiplier - 1.0)
```

**Multipliers:**
- Junior: 1.0x → 0% bonus
- Senior: 1.2x → 20% bonus
- Lead: 1.5x → 50% bonus

**Example:**
```
Base commission: 1,000,000 VND
Position: Senior (1.2x)
Position bonus: 1,000,000 × (1.2 - 1.0) = 200,000 VND
```

**DSL Challenge:** Can DSL express lookup + multiplication?

---

### 9. Seniority Bonus (Year-Based Tiers)

**Formula:**
```typescript
seniorityBonus = baseSalary × bonusRate(yearsOfService)
```

**Bonus Tiers:**
- 0-1 year: 0%
- 1-3 years: 5%
- 3-5 years: 10%
- 5+ years: 15%

**Example:**
```
Base salary: 6,000,000 VND
Years of service: 4.2 years → 10% tier
Seniority bonus: 6,000,000 × 0.10 = 600,000 VND
```

**DSL Challenge:** Can DSL express:
1. Years calculation from hire date
2. Tiered rate lookup
3. Percentage multiplication

---

### 10. Attendance Penalties (Late + Absent)

**Formula:**
```typescript
penalties = (lateDays × penaltyLatePerDay) + (absentDays × penaltyAbsentPerDay)
```

**Typical Config:**
- Late penalty: 50,000 VND/day
- Absent penalty: 200,000 VND/day

**Example:**
```
Late: 1 day × 50,000 = 50,000 VND
Absent: 1 day × 200,000 = 200,000 VND
Total penalties: 250,000 VND
```

**DSL Challenge:** Can DSL express multiplication + addition?

---

### 11. Manual Adjustments (Approved Only)

**Formula:**
```typescript
netAdjustments = sum(bonuses.approved) - sum(deductions.approved)
```

**Business Logic:**
- Only include adjustments with `status === 'approved'`
- Bonuses add, deductions subtract
- Can be positive or negative net

**Example:**
```
Approved bonuses: [500k, 200k]
Approved deductions: [100k]
Draft bonuses: [300k] (ignored)
Net: 500k + 200k - 100k = 600k
```

**DSL Challenge:** Can DSL express:
1. Filtered aggregation (only approved)
2. Conditional sum (bonus vs deduction)


---

### 12. Total Salary (Final Calculation)

**Formula (Extended with Advanced Commission):**
```typescript
totalSalary = Math.max(0,
  baseSalary 
  + sessionBonus 
  + ratingBonus 
  + kpiBonus
  + serviceCommission 
  + productSalesCommission
  + positionBonus 
  + seniorityBonus
  + manualAdjustments
  - deductions 
  - advances
)
```

**Business Logic:**
- Total can never be negative (floor at 0)
- All components calculated separately
- Simple arithmetic aggregation

**DSL Challenge:** Can DSL express:
1. Multi-component addition/subtraction
2. Floor at 0 (max constraint)

---

## DSL Design Options

### Option A: Service-First (Recommended)

**Philosophy:** Keep DSL simple, push complexity to service layer

**Service Layer:**
- Computes all 12 salary components
- Passes FINAL VALUES to knowledge dictionary

**Knowledge Structure:**
```typescript
{
  "salary.baseSalary": 5538462,
  "salary.sessionBonus": 500000,
  "salary.ratingBonus": 465000,
  "salary.kpiBonus": 1000000,
  "salary.serviceCommission": 150000,
  "salary.productCommission": 50000,
  "salary.positionBonus": 200000,
  "salary.seniorityBonus": 600000,
  "salary.manualAdjustments": 600000,
  "salary.deductions": 250000,
  "salary.advances": 0,
  "salary.totalSalary": 8853462
}
```

**Policy Rules (Example):**
```typescript
{
  id: "rule-1",
  priority: 1,
  condition: { field: "salary.totalSalary", operator: ">=", value: 10000000 },
  outcome: "SALARY_HIGH",
  explanation: "Lương cao > 10tr, cần approve cấp cao"
}
```

**Pros:**
- ✅ DSL stays minimal (no new operators)
- ✅ Service layer handles ALL calculation logic
- ✅ Knowledge = simple dictionary of numbers
- ✅ Policy evaluates results, not formulas

- ✅ Beautiful boundary: Service = compute, Policy = validate/decide
- ✅ Matches Booking pattern (overlap computed → knowledge has boolean)

**Cons:**
- ❌ Can't express "what-if" scenarios (e.g., "if KPI = 2M, would salary exceed threshold?")
- ❌ Policy can't adjust calculation parameters (only evaluate results)

---

### Option B: DSL-Extension (Not Recommended)

**Philosophy:** Make DSL expressive enough to encode calculations

**New Operators Needed:**
```typescript
// Arithmetic
{ field: "salary.baseSalary", operator: "multiply", value: 0.15 }
{ field: "salary.sessionCount", operator: "divide", value: 26 }

// Aggregation
{ field: "sessions", operator: "sum", expression: "ktv_commission" }
{ field: "sessions", operator: "count", condition: { status: "completed" } }

// Conditional
{ 
  operator: "if_then_else",
  condition: { field: "sessions", operator: ">=", value: 30 },
  then: 1000000,
  else: 0
}

// Tier lookup
{
  field: "rating",
  operator: "lookup_tier",
  tiers: [
    { min: 5.0, max: 5.0, value: 50000 },
    { min: 4.5, max: 4.99, value: 30000 },
    { min: 4.0, max: 4.49, value: 10000 }
  ]
}
```

**Pros:**
- ✅ Policy becomes "executable" (can compute, not just validate)
- ✅ Enables "what-if" scenarios
- ✅ More transparent (formula visible in policy)

**Cons:**
- ❌ DSL becomes complex (15+ operators)
- ❌ RuleReasoner must handle expression evaluation
- ❌ Policy = code disguised as data
- ❌ Violates YAGNI (no production need yet)
- ❌ Makes policy harder to edit via UI
- ❌ Risks becoming domain-specific (payroll-aware DSL)

---

## Recommendation: Option A (Service-First)

**Rationale:**

1. **Matches Booking Pattern:**
   - Booking: Overlap logic in service → knowledge has `hasConflict: boolean`
   - Payroll: Calculation logic in service → knowledge has `totalSalary: number`
   - **Consistency = good architecture**

2. **Preserves Beautiful Boundary:**
   - Service = Domain expert (knows formulas, pro-rata, tiers)
   - Knowledge = Flat dictionary (simple values)
   - Policy = Decision maker (evaluates thresholds, validates results)
   - Engine = Domain-agnostic (doesn't know "salary", "commission", "bonus")

3. **YAGNI Principle:**
   - No production use case for "formula in policy" yet
   - Current need: Validate salary results, flag anomalies, route approvals
   - Don't build features speculatively

4. **Testability:**
   - Service-first: Test calculation separately from policy evaluation
   - DSL-extension: Must test DSL operators + policy logic together

5. **Maintainability:**
   - Service-first: Change formulas without touching DSL
   - DSL-extension: Formula changes require policy migrations

---

## Proposed Payroll Policy Use Cases

### Use Case 1: High Salary Approval

**Business Rule:** Salaries > 15,000,000 VND require CFO approval

**Knowledge:**
```typescript
{ "salary.totalSalary": 16500000 }
```

**Policy:**
```typescript
{
  id: "payroll-high-salary",
  priority: 1,
  condition: { field: "salary.totalSalary", operator: ">", value: 15000000 },
  outcome: "REQUIRES_CFO_APPROVAL",
  explanation: "Lương vượt 15tr, cần CFO phê duyệt"
}
```

---

### Use Case 2: Negative Component Detection

**Business Rule:** Flag salaries with negative components (data integrity)

**Knowledge:**
```typescript
{
  "salary.baseSalary": 5500000,
  "salary.deductions": -100000  // Invalid!
}
```

**Policy:**
```typescript
{
  id: "payroll-negative-component",
  priority: 0,
  condition: { field: "salary.deductions", operator: "<", value: 0 },
  outcome: "DATA_ERROR",
  explanation: "Deductions không được âm"
}
```

---

### Use Case 3: Low Base Salary Alert

**Business Rule:** Base salary < 50% of raw salary → flag for review

**Knowledge:**
```typescript
{
  "salary.rawBaseSalary": 6000000,
  "salary.baseSalary": 2500000,  // Only 42% of raw
  "salary.actualDays": 11
}
```

**Policy:**
```typescript
{
  id: "payroll-low-prorata",
  priority: 2,
  condition: {
    operator: "and",
    conditions: [
      { 
        field: "salary.baseSalary", 
        operator: "<", 
        value: 3000000  // < 50% of 6M
      },
      {
        field: "salary.actualDays",
        operator: "<",
        value: 13  // < half month
      }
    ]
  },
  outcome: "LOW_ATTENDANCE_ALERT",
  explanation: "Cong < 50%, kiểm tra nghỉ việc hoặc lỗi chấm công"
}
```

---

### Use Case 4: KPI Achievement Verification

**Business Rule:** If KPI bonus awarded, verify sessions >= target

**Knowledge:**
```typescript
{
  "salary.kpiBonus": 1000000,
  "salary.sessionCount": 35,
  "config.kpiTarget": 30
}
```

**Policy:**
```typescript
{
  id: "payroll-kpi-consistency",
  priority: 1,
  condition: {
    operator: "and",
    conditions: [
      { field: "salary.kpiBonus", operator: ">", value: 0 },
      { field: "salary.sessionCount", operator: "<", value: 30 }
    ]
  },
  outcome: "KPI_MISMATCH",
  explanation: "KPI bonus được nhận nhưng sessions < target (lỗi dữ liệu)"
}
```

---

### Use Case 5: Deduction Cap Enforcement

**Business Rule:** Total deductions cannot exceed 30% of base salary

**Knowledge:**
```typescript
{
  "salary.baseSalary": 6000000,
  "salary.deductions": 2500000,  // 42% of base!
  "salary.deductionPercent": 41.67
}
```

**Policy:**
```typescript
{
  id: "payroll-deduction-cap",
  priority: 0,
  condition: { field: "salary.deductionPercent", operator: ">", value: 30 },
  outcome: "EXCESSIVE_DEDUCTION",
  explanation: "Tổng phạt vượt 30% lương cơ bản, cần review"
}
```


---

## Knowledge Structure Design

### Minimal Knowledge (Service Computes Everything)

```typescript
export interface PayrollKnowledge extends Record<string, unknown> {
  // Salary components (all pre-calculated)
  "salary.rawBaseSalary": number;
  "salary.baseSalary": number;
  "salary.actualDays": number;
  "salary.sessionBonus": number;
  "salary.ratingBonus": number;
  "salary.kpiBonus": number;
  "salary.serviceCommission": number;
  "salary.productCommission": number;
  "salary.positionBonus": number;
  "salary.seniorityBonus": number;
  "salary.manualAdjustments": number;
  "salary.deductions": number;
  "salary.advances": number;
  "salary.totalSalary": number;
  
  // Derived metrics for policy evaluation
  "salary.sessionCount": number;
  "salary.averageRating": number | null;
  "salary.deductionPercent": number;
  "salary.baseSalaryPercent": number;
  
  // Configuration values
  "config.kpiTarget": number;
  "config.minBaseSalary": number;
  "config.maxDeductionPercent": number;
  
  // Status flags
  "employee.isResigned": boolean;
  "salary.hasNegativeComponents": boolean;
  "salary.hasManualOverrides": boolean;
}
```

**Rationale:**
- Engine receives ONLY final calculated values
- All formulas, tiers, lookups handled in service layer
- Policy evaluates thresholds, validates results, routes approvals
- Knowledge = **Output of calculation**, not input

---

## Expected Outcomes

### Decision Outcomes for Payroll Policy

```typescript
type PayrollDecisionOutcome = 
  | 'APPROVED'              // Salary validated, can be published
  | 'REQUIRES_MANAGER'      // Normal anomaly, manager review
  | 'REQUIRES_CFO'          // High value, CFO approval
  | 'DATA_ERROR'            // Invalid data, block salary publishing
  | 'EXCESSIVE_DEDUCTION'   // Deduction cap violated
  | 'LOW_ATTENDANCE'        // Low prorata, verify resignation
  | 'KPI_MISMATCH'          // KPI bonus inconsistent with sessions
  | 'MANUAL_OVERRIDE'       // Has manual adjustments, needs review
```

---

## DSL Operator Requirements

### Current Operators (Sufficient)

From Case Study 1 (Leave) and Case Study 2 (Booking):

```typescript
// Comparison
">=", ">", "<=", "<", "==", "===", "!=", "!=="

// Logical
"and", "or"
```

**Analysis:** These operators are **SUFFICIENT** for Option A (Service-First)

**Why?**
- Payroll policy validates RESULTS (numbers), not formulas
- Use cases: threshold checks, percentage validation, data integrity
- All use cases can be expressed with current operators

**No new operators needed!** ✅

---

## Implementation Plan (Minimal Validation)

### Step 1: Build Payroll Knowledge Builder (~150 LOC)

**File:** `src/services/payroll-decision.service.ts`

**Function:** `buildPayrollKnowledge(ktvId, monthYear, tenantId)`

**Logic:**
1. Call existing `recalculateAndSaveSalaryRecordEngine()`
2. Extract salary components from result
3. Calculate derived metrics:
   - `deductionPercent = (deductions / baseSalary) × 100`
   - `baseSalaryPercent = (baseSalary / rawBaseSalary) × 100`
4. Build flat knowledge dictionary
5. Return `Record<string, unknown>`

**NO NEW CALCULATION LOGIC** - reuse existing engine!

---

### Step 2: Create Minimal Policy (~80 LOC)

**File:** `src/lib/decision-engine/policies/payroll-salary-v1.ts`

**Rules (3-5 validation rules):**
1. High salary approval (> 15M)
2. Negative component detection
3. Excessive deduction (> 30%)

**Goal:** Prove architecture, not build complete salary validation system

**Pattern:** Same as Leave + Booking (data-driven, JSON-serializable)

---

### Step 3: Write Tests (~120 LOC)

**File:** `src/__tests__/decision-engine/payroll-salary.test.ts`

**Test Cases:**
1. ✅ Policy = Data (JSON.stringify works)
2. ✅ Knowledge = Dictionary (no typed interfaces in engine)
3. ✅ RuleReasoner unchanged (same engine for Leave, Booking, Payroll)
4. ✅ High salary rule triggers CFO approval
5. ✅ Negative component detected
6. ✅ Excessive deduction flagged
7. ✅ Normal salary passes validation

---

### Step 4: Answer 5 Questions

**After implementation, answer:**

1. **Có sửa RuleReasoner không?**
   - Target: No
   - Validation: Check git diff on `RuleReasoner.ts`

2. **Có sửa DSL không?**
   - Target: No (current operators sufficient)
   - Validation: Check `types.ts` for new operators

3. **Có sửa Knowledge model không?**
   - Target: No (still `Record<string, unknown>`)
   - Validation: Check if engine uses typed interfaces

4. **DSL đủ expressive không?** ← **KEY QUESTION**
   - Target: Yes (can express all validation rules)
   - Validation: All 3-5 policy rules work with current operators

5. **Có operator mới không?**
   - Target: No (unless discovered during implementation)
   - Validation: Document if any operators added

---

## Key Insights from Requirements Analysis

### 1. Service-First is the Right Pattern

**Evidence:**
- Booking case study: Overlap computed in service → knowledge has boolean
- Payroll case study: All 12 components computed in service → knowledge has numbers
- **Pattern consistency = architectural strength**

### 2. DSL Should Validate, Not Calculate

**Philosophy:**
```
Service Layer = Calculator (knows domain formulas)
Knowledge = Data (simple values)
Policy = Validator (checks thresholds, flags anomalies)
Engine = Generic (domain-agnostic evaluator)
```

**Why This Works:**
- Calculation logic already exists (`recalculateAndSaveSalaryRecordEngine`)
- Policy doesn't need to RE-CALCULATE, only VALIDATE results
- Use cases: approval routing, data integrity checks, anomaly detection
- All expressible with comparison operators

### 3. Payroll is NOT Special

**Misconception:** "Payroll needs formula operators because it's complex"

**Reality:** 
- Complexity = 12 salary components with formulas
- BUT: Policy doesn't care HOW baseSalary was calculated
- Policy only cares: "Is baseSalary < threshold?"
- **Validation ≠ Calculation**

### 4. Beautiful Boundary Preserved

**Service Boundary:**
```typescript
// Service knows: pro-rata, tiers, multipliers, formulas
const knowledge = {
  "salary.totalSalary": 8500000  // ← Final result
}
```

**Policy Boundary:**
```typescript
// Policy knows: thresholds, approval routing
{
  condition: { field: "salary.totalSalary", operator: ">", value: 15000000 },
  outcome: "REQUIRES_CFO"
}
```

**Engine Boundary:**
```typescript
// Engine knows: NOTHING about payroll
evaluate(knowledge, condition) {
  return knowledge["salary.totalSalary"] > condition.value
}
```

**This is true genericity.**

---

## Risks and Mitigations

### Risk 1: "What-if" Scenarios Not Supported

**Scenario:** "What if we change KPI bonus to 2M? How many KTVs exceed 15M threshold?"

**Mitigation:**
- This is a **reporting query**, not a policy evaluation
- Use database analytics: `SELECT COUNT(*) WHERE (baseSalary + ... + 2000000) > 15000000`
- Policy DSL is for runtime decisions, not batch analysis

### Risk 2: Formula Changes Require Service Updates

**Scenario:** "Commission formula changed, need to update calculations"

**Mitigation:**
- **This is correct behavior!** Formula = business logic = service layer
- Policy rules don't need updates (still check thresholds)
- Separation of concerns preserved

### Risk 3: Can't Express Complex Eligibility Rules

**Scenario:** "KTV eligible for bonus if (sessions > 30 OR rating > 4.5) AND seniority > 2 years"

**Current DSL:**
```typescript
{
  operator: "and",
  conditions: [
    {
      operator: "or",
      conditions: [
        { field: "salary.sessionCount", operator: ">", value: 30 },
        { field: "salary.averageRating", operator: ">", value: 4.5 }
      ]
    },
    { field: "employee.yearsOfService", operator: ">", value: 2 }
  ]
}
```

**Mitigation:**
- Current DSL already supports nested `and`/`or` (from Case Study 1)
- This scenario is **expressible** with existing operators ✅

---

## Comparison with Previous Case Studies

| Aspect | Leave (CS1) | Booking (CS2) | Payroll (CS3) |
|--------|-------------|---------------|---------------|
| **Domain Type** | Permission check | Resource constraint | Financial calculation |
| **Complexity** | Low (6 rules) | Medium (7 rules) | High (12 components) |
| **Service Role** | Build knowledge from DB | Compute overlaps | Compute all salary components |
| **Knowledge Fields** | 8 fields (boolean/number) | 7 fields (boolean/number) | 20+ fields (numbers only) |
| **Policy Role** | Approve/Reject/Escalate | Bookable/Full | Validate/Route approval |
| **New Operators** | 0 (base set) | 0 | 0 (predicted) |
| **RuleReasoner Changes** | 0 (created) | 0 | 0 (predicted) |
| **DSL Changes** | 0 (created) | +3 outcomes | +8 outcomes (predicted) |
| **LOC Estimate** | ~670 total | ~670 total | ~350 total (reuse engine) |

**Key Observation:** Complexity increases in SERVICE layer, NOT DSL layer

---

## Success Criteria

### Must Have (Validation Pass)

1. ✅ **Policy = Data**: All rules JSON-serializable
2. ✅ **Knowledge = Dictionary**: Engine uses `Record<string, unknown>`
3. ✅ **RuleReasoner unchanged**: 0 modifications to engine
4. ✅ **DSL sufficient**: All validation rules expressible with current operators
5. ✅ **Beautiful boundary**: Service computes, policy validates

### Should Have (Architecture Validation)

1. ✅ Tests: 7+ passing (policy, knowledge, engine, business rules)
2. ✅ Pattern consistency: Same approach as Booking (service-first)
3. ✅ No domain leakage: Engine doesn't know "salary", "commission", "bonus"
4. ✅ Reuse: Uses existing `recalculateAndSaveSalaryRecordEngine` (no duplication)

### Nice to Have (Future Extensibility)

1. ⚠️ Document: "When to extend DSL vs service layer" decision guide
2. ⚠️ Example: How to add "formula operators" IF needed in future
3. ⚠️ Benchmark: Performance with 20+ field knowledge (acceptable?)

---

## Next Steps

### Immediate (Task #2)

**Thiết kế Payroll Knowledge structure:**
1. List all knowledge fields (20-25 fields predicted)
2. Define field naming convention (`salary.*`, `config.*`, `employee.*`)
3. Decide which derived metrics to include
4. Document field types and sources

### After Task #2 (Task #3)

**Design DSL extensions (if needed):**
1. Review knowledge structure
2. Identify any validation rules NOT expressible with current operators
3. If gaps found → propose minimal operator additions
4. If no gaps → document "0 extensions needed" ✅

### Implementation (Task #4)

**Prototype payroll-salary-v1.ts:**
1. 3-5 validation rules (minimal scope)
2. Use current operators only
3. Focus on proving architecture


---

## Conclusion

**Recommendation:** Proceed with **Option A (Service-First)** approach

**Key Takeaways:**

1. **Payroll complexity does NOT require DSL complexity**
   - 12 salary components = service layer problem
   - Policy DSL only needs to validate results
   - Current operators (comparison + logical) are sufficient

2. **Service-First pattern is proven**
   - Case Study 1 (Leave): Simple permission checks
   - Case Study 2 (Booking): Resource constraint with overlap detection
   - Case Study 3 (Payroll): Complex calculations with 12 components
   - **Same pattern works across all domains** ✅

3. **Beautiful Boundary = Architectural Strength**
   - Service = Domain expert (knows formulas)
   - Knowledge = Flat dictionary (simple values)
   - Policy = Decision maker (validates thresholds)
   - Engine = Generic evaluator (domain-agnostic)

4. **YAGNI Validated**
   - No need for formula operators (yet)
   - No need for aggregation operators (yet)
   - No need for tier lookup operators (yet)
   - **Add complexity ONLY when real pain appears**

5. **Expected Result: 0 RuleReasoner modifications** ✅

**Next Action:** Complete Task #2 (Thiết kế Payroll Knowledge structure)

