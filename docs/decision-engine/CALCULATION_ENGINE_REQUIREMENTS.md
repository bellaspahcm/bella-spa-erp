# Calculation Engine Requirements Analysis

**Date:** 2026-06-22  
**Status:** Initial Design  
**Goal:** Design formula evaluation system that preserves Policy = Data

---

## Problem Statement

### Current Gap

**Decision Engine (DONE ✅):**
```typescript
IF condition THEN outcome
IF salary.totalSalary > 15M THEN REQUIRES_CFO
IF attendance.violations > 3 THEN ESCALATE
```
- Boolean logic
- Routing decisions
- Current DSL: Sufficient ✅

**Calculation Engine (NOT STARTED ❌):**
```typescript
IF condition THEN calculation
IF position = "senior" THEN commission × 1.2
IF tier > 100M THEN rate = 15%
salary = base + bonus - penalty - tax
```
- Formula evaluation
- Numeric computations
- Tiered calculations
- **Current DSL: INSUFFICIENT** ❌

---

## Real-World Bella Examples

### Example 1: Service Commission (tiered %)

**Business Rule:**
```
Service A: 10% of subtotal
Service B: 15% of subtotal  
Service C: 20% of subtotal
```

**Current System (imperative code):**
```typescript
function calculateServiceCommission(serviceType, subtotal) {
  const rates = { A: 0.10, B: 0.15, C: 0.20 };
  return subtotal * rates[serviceType];
}
```

**Need:** Express as data (JSON)

---

### Example 2: Commission Tiers (revenue-based)

**Business Rule:**
```
Revenue 0-100M:   commission rate = 10%
Revenue 100-200M: commission rate = 12%
Revenue >200M:    commission rate = 15%
```

**Current System:**
```typescript
function getCommissionRate(revenue) {
  if (revenue > 200_000_000) return 0.15;
  if (revenue > 100_000_000) return 0.12;
  return 0.10;
}
```

**Need:** Tier lookup as data

---

### Example 3: Position Multiplier

**Business Rule:**
```
Junior:  commission × 1.0  (baseline)
Senior:  commission × 1.2  (20% higher)
Lead:    commission × 1.5  (50% higher)
```

**Current System:**
```typescript
const multipliers = { junior: 1.0, senior: 1.2, lead: 1.5 };
return baseCommission * multipliers[position];
```

**Need:** Lookup + multiply as data

---

### Example 4: Salary Formula Graph

**Business Rule:**
```
Total Salary = 
  Base Salary
  + Session Bonus
  + Rating Bonus
  + KPI Bonus
  + Service Commission
  + Product Commission
  + Position Bonus
  + Seniority Bonus
  + Manual Adjustments
  - Deductions
  - Advances
```

**Current System:**
```typescript
const total = baseSalary + sessionBonus + ratingBonus + kpiBonus
            + serviceComm + productComm + positionBonus + seniorityBonus
            + manualAdj - deductions - advances;
```

**Need:** Formula as data (expression tree)

---

### Example 5: Conditional Calculation

**Business Rule:**
```
IF is_holiday = true
  THEN OT_rate = base_rate × 2
  ELSE OT_rate = base_rate × 1.5
```

**Current System:**
```typescript
const otRate = isHoliday ? baseRate * 2 : baseRate * 1.5;
```

**Need:** Conditional formula as data

---

## Design Constraints

### Must Preserve

1. **Policy = Data** ✅
   - Formulas must be JSON-serializable
   - No functions, no lambdas, no eval()
   - Can be stored in database
   - Can be edited via UI

2. **Domain-Agnostic Engine** ✅
   - Engine doesn't know "commission", "salary", "pricing"
   - Only knows: numbers, operators, expressions
   - Same engine for all calculation domains

3. **Testability** ✅
   - Formulas testable without execution
   - Can validate formula structure
   - Can trace evaluation steps

4. **Safety** ✅
   - No arbitrary code execution
   - No infinite loops
   - Bounded computation

---

## Calculation Patterns to Support

### Pattern 1: Arithmetic

**Operations:**
- Addition: `a + b`
- Subtraction: `a - b`
- Multiplication: `a × b`
- Division: `a / b`
- Modulo: `a % b`

**Example:**
```json
{
  "type": "arithmetic",
  "operator": "+",
  "left": { "type": "field", "path": "salary.base" },
  "right": { "type": "field", "path": "salary.bonus" }
}
```

---

### Pattern 2: Tier Lookup

**Operations:**
- Find tier by value
- Return tier result

**Example:**
```json
{
  "type": "tier_lookup",
  "field": "revenue.total",
  "tiers": [
    { "min": 0, "max": 100000000, "result": 0.10 },
    { "min": 100000000, "max": 200000000, "result": 0.12 },
    { "min": 200000000, "max": null, "result": 0.15 }
  ]
}
```

---

### Pattern 3: Lookup Table

**Operations:**
- Map key → value

**Example:**
```json
{
  "type": "lookup",
  "field": "employee.position",
  "table": {
    "junior": 1.0,
    "senior": 1.2,
    "lead": 1.5
  },
  "default": 1.0
}
```

---

### Pattern 4: Conditional (If-Then-Else)

**Operations:**
- Evaluate condition
- Return then/else branch result

**Example:**
```json
{
  "type": "conditional",
  "condition": { "field": "context.isHoliday", "operator": "===", "value": true },
  "then": { "type": "arithmetic", "operator": "*", "left": {...}, "right": 2 },
  "else": { "type": "arithmetic", "operator": "*", "left": {...}, "right": 1.5 }
}
```

---

### Pattern 5: Formula Graph (Multi-Step)

**Operations:**
- Define intermediate variables
- Reference variables in formulas
- Final output expression

**Example:**
```json
{
  "type": "formula_graph",
  "variables": {
    "baseCommission": { "type": "arithmetic", "operator": "*", ... },
    "positionBonus": { "type": "arithmetic", "operator": "*", ... },
    "seniorityBonus": { "type": "arithmetic", "operator": "*", ... }
  },
  "output": {
    "type": "arithmetic",
    "operator": "+",
    "operands": [
      { "type": "variable", "name": "baseCommission" },
      { "type": "variable", "name": "positionBonus" },
      { "type": "variable", "name": "seniorityBonus" }
    ]
  }
}
```

---

## Design Options

### Option A: Expression Tree (AST-like)

**Pros:**
- Clean, composable
- Easy to validate structure
- Supports nesting naturally

**Cons:**
- Verbose JSON
- Requires tree traversal engine
- More complex to edit in UI

**Example:**
```json
{
  "type": "add",
  "left": {
    "type": "multiply",
    "left": { "type": "field", "path": "base" },
    "right": { "type": "literal", "value": 1.2 }
  },
  "right": { "type": "field", "path": "bonus" }
}
```

---

### Option B: Postfix Notation (RPN)

**Pros:**
- Simple stack-based evaluation
- No nesting complexity
- Easy to implement

**Cons:**
- Hard to read/edit
- Not intuitive for business users
- Difficult to validate

**Example:**
```json
["field:base", "literal:1.2", "*", "field:bonus", "+"]
```

---

### Option C: Formula String + Parser

**Pros:**
- Human-readable
- Familiar to users (Excel-like)
- Compact

**Cons:**
- Requires parser (complex)
- String = not pure data
- Injection risks if not careful

**Example:**
```json
{
  "formula": "base * 1.2 + bonus",
  "fields": ["base", "bonus"]
}
```

---

### Option D: Hybrid (Expression + Builder)

**Pros:**
- Expression tree for engine
- Builder UI for users
- Best of both worlds

**Cons:**
- Two representations to maintain
- Conversion layer needed

**Example:**
```json
{
  "expression": { "type": "add", "left": {...}, "right": {...} },
  "formula": "base * 1.2 + bonus",  // Generated from expression
  "editable": true
}
```

---

## Recommendation (Preliminary)

**Start with Option A: Expression Tree**

**Why:**
1. ✅ Pure data (JSON-serializable)
2. ✅ Safe (no eval, no parser)
3. ✅ Composable (supports all patterns)
4. ✅ Domain-agnostic (generic tree evaluator)
5. ✅ Testable (validate structure)

**Later:**
- Add formula string generation (expression → "base * 1.2")
- Add visual builder UI (drag-drop formula builder)
- Keep expression tree as source of truth

---

## Next Steps

1. Design expression tree schema
2. Implement simple evaluator (arithmetic only)
3. Test with Payroll commission example
4. Validate: Formula = Data?
5. Extend: Add tier lookup, conditional
6. Validate: Can express all Bella patterns?

---

## Open Questions

1. **How to handle errors?**
   - Division by zero?
   - Missing fields?
   - Invalid tier lookup?

2. **How to handle precision?**
   - Rounding rules?
   - Decimal precision?
   - Currency formatting?

3. **How to debug formulas?**
   - Trace evaluation steps?
   - Show intermediate results?
   - Error messages?

4. **How to version formulas?**
   - Policy v1 → v2 migration?
   - Backward compatibility?
   - Deprecation strategy?

5. **Performance at scale?**
   - 100+ formulas × 100 employees?
   - Caching strategies?
   - Optimization?

---

**Status:** Requirements drafted, ready for design phase

