# Decision DSL Specification v1.0

**Date:** Sprint 3 (June 2026)  
**Status:** Living Document (evolves with business needs)

---

## Philosophy

> **DSL grows with business, not ahead of business.**

- Only add operators when a real policy needs them
- Engine stays domain-agnostic (no `if booking...` logic)
- Policy = pure data (JSON-serializable)
- Knowledge = dictionary (no typed interfaces at engine level)

---

## 1. Knowledge Format

### Structure
```typescript
type Knowledge = Record<string, unknown>;
```

### Naming Convention
```
<domain>.<field>
```

**Examples:**
```typescript
{
  "leave.balance": 5,
  "ktv.hasConcurrentSession": false,
  "booking.remainingSessions": 10,
  "time.hasConflict": true
}
```

### Rules
- **Flat dictionary** (no nesting)
- **Dot notation** for namespacing
- **Domain abstraction**: Policy sees `leave.balance`, not `users.leave_balance` (DB schema)
- **Service responsibility**: Knowledge Builder maps DB → Policy fields

---

## 2. Condition Types

### Comparison Condition

**Structure:**
```typescript
{
  type: 'comparison',
  field: string,      // Knowledge field name
  operator: string,   // See Operators section
  value: any         // Value to compare against
}
```

**Example:**
```json
{
  "type": "comparison",
  "field": "leave.balance",
  "operator": ">=",
  "value": 1
}
```

### Logical Condition

**Structure:**
```typescript
{
  type: 'operator',
  operator: 'and' | 'or',
  conditions: Condition[]  // Recursive
}
```

**Example:**
```json
{
  "type": "operator",
  "operator": "and",
  "conditions": [
    {
      "type": "comparison",
      "field": "leave.balance",
      "operator": ">",
      "value": 0
    },
    {
      "type": "comparison",
      "field": "leave.hoursNotice",
      "operator": ">=",
      "value": 24
    }
  ]
}
```

---

## 3. Operators

### Baseline (Sprint 2)

| Operator | Type | Example | Use Case |
|----------|------|---------|----------|
| `>=` | Comparison | `balance >= 1` | Threshold check |
| `>` | Comparison | `hours > 24` | Strict greater |
| `<=` | Comparison | `sessions <= 0` | Capacity check |
| `<` | Comparison | `hours < 24` | Strict less |
| `==` | Comparison | `violations == 0` | Equality (loose) |
| `===` | Comparison | `status === 'active'` | Equality (strict) |
| `!=` | Comparison | `status != 'canceled'` | Inequality (loose) |
| `!==` | Comparison | `type !== 'blocked'` | Inequality (strict) |
| `and` | Logical | `A and B` | All conditions must pass |
| `or` | Logical | `A or B` | At least one condition passes |

### Extensions (Planned)

| Operator | Sprint | Type | Example | Use Case |
|----------|--------|------|---------|----------|
| `between` | 4? | Comparison | `age between 18 and 65` | Range check |
| `contains` | 4? | Comparison | `tags contains 'vip'` | Array membership |
| `in` | 4? | Comparison | `tier in ['gold','silver']` | Set membership |
| `exists` | 5? | Comparison | `customer.email exists` | Null check |
| `sum` | 6? | Aggregation | `sum(sessions.amount)` | Payroll calculation |
| `count` | 6? | Aggregation | `count(violations)` | Count items |
| `formula` | 6? | Calculation | `base * (1 + bonus%)` | Complex math |

**Rule:** Only add when a real policy needs it. Don't add speculatively.

---

## 4. Decision Rules

**Structure:**
```typescript
{
  id: string,           // Unique rule identifier
  priority: number,     // Lower = higher priority (1 = first)
  conditions: Condition,
  action: {
    outcome: string,    // Decision outcome
    reason: string      // Human-readable explanation (Vietnamese)
  }
}
```

**Evaluation:**
- Rules sorted by `priority` (ascending)
- First matching rule wins
- If no rule matches, default to last rule (priority 100+)

**Example:**
```json
{
  "id": "advance-notice-24h",
  "priority": 1,
  "conditions": {
    "type": "operator",
    "operator": "and",
    "conditions": [
      {
        "type": "comparison",
        "field": "leave.hoursNotice",
        "operator": ">=",
        "value": 24
      },
      {
        "type": "comparison",
        "field": "leave.balance",
        "operator": ">",
        "value": 0
      }
    ]
  },
  "action": {
    "outcome": "APPROVE",
    "reason": "Đơn nghỉ phép đạt yêu cầu: báo trước ≥24 giờ, còn số ngày phép"
  }
}
```

---

## 5. Decision Outcomes

### Per-Domain Outcomes

| Domain | Outcomes | Meaning |
|--------|----------|---------|
| Leave | APPROVE, REJECT, ESCALATE | Permission check |
| Booking | BOOKABLE, FULL, ESCALATE | Capacity check |
| Promotion | ELIGIBLE, INELIGIBLE, ESCALATE | Eligibility check |
| Membership | UPGRADE, MAINTAIN, DOWNGRADE | Tier classification |
| Payroll | TBD | Complex calculation |

**Type:**
```typescript
type DecisionOutcome = 
  | 'APPROVE' | 'REJECT' | 'ESCALATE'
  | 'BOOKABLE' | 'FULL'
  | 'ELIGIBLE' | 'INELIGIBLE'
  | 'UPGRADE' | 'MAINTAIN' | 'DOWNGRADE';
```

**Extensibility:** Add new outcomes as needed. Engine doesn't care about semantic meaning.

---

## 6. Policy Structure

**Structure:**
```typescript
{
  id: string,           // e.g., 'leave-approval-v1'
  version: string,      // Semantic versioning
  name: string,         // Human-readable (Vietnamese)
  description?: string,
  rules: DecisionRule[]
}
```

**Example:**
```json
{
  "id": "booking-capacity-v1",
  "version": "1.0.0",
  "name": "Chính sách kiểm tra khả năng đặt lịch",
  "description": "Tự động kiểm tra khả năng đặt session mới",
  "rules": [
    {
      "id": "booking-exhausted",
      "priority": 1,
      "conditions": {
        "type": "comparison",
        "field": "booking.remainingSessions",
        "operator": "<=",
        "value": 0
      },
      "action": {
        "outcome": "FULL",
        "reason": "Booking đã hết số session"
      }
    }
  ]
}
```

---

## 7. Constraints

### What DSL Supports

✅ Comparison operators (numeric, string, boolean)  
✅ Logical operators (AND, OR)  
✅ Nested conditions (recursive)  
✅ Priority-based rule ordering  
✅ Multiple outcomes per policy  
✅ JSON serialization  

### What DSL Does NOT Support (Yet)

❌ Aggregation (sum, count, avg) - **Planned for Payroll**  
❌ Formula evaluation - **Planned for Payroll**  
❌ Time/date operations - **Service layer responsibility**  
❌ External API calls - **Service layer responsibility**  
❌ Loops / iteration - **Service layer responsibility**  
❌ Variable assignment - **Policies are stateless**  

**Design principle:** Complex logic stays in service layer. Policy only evaluates pre-computed knowledge.

---

## 8. Knowledge Builder Contract

### Responsibility

Knowledge Builder (service layer) MUST:
1. Query database
2. Execute business logic (time overlap, counting, aggregation)
3. Map DB fields → Policy fields
4. Return flat dictionary

### Example Pattern

```typescript
// ❌ Policy should NOT see this
type DBSchema = {
  users: { leave_balance: number };
  attendance: { status: string };
};

// ✅ Policy SHOULD see this
type Knowledge = {
  "leave.balance": number;
  "attendance.violations": number;
};
```

**Benefit:** Change DB schema without changing policy.

---

## 9. Evolution Strategy

### When to Extend DSL

**Add operator when:**
- A real policy needs it (not speculative)
- Service layer solution is too complex
- Multiple domains would benefit

**Don't add operator when:**
- Only 1 policy needs it
- Service layer can handle it easily
- Would make DSL too complex

### Example Decision Tree

```
Need "between" operator?
├─ Is it for range check? (age 18-65, price 100-1000)
│  ├─ Yes → Consider adding (common pattern)
│  └─ No → Use >= and <= (existing operators)
└─ Only 1 policy needs it?
   ├─ Yes → Keep in service layer
   └─ No (3+ policies) → Add to DSL
```

---

## 10. Testing Requirements

Every operator MUST have:
- ✅ Unit test (operator behavior)
- ✅ Integration test (real policy usage)
- ✅ Serialization test (JSON round-trip)

Every policy MUST verify:
- ✅ Policy is JSON-serializable
- ✅ Knowledge is flat dictionary
- ✅ No domain code in engine
- ✅ All rules declarative (no functions)

---

## 11. References

- Implementation: `src/lib/decision-engine/RuleReasoner.ts`
- Types: `src/lib/decision-engine/types.ts`
- Policies: `src/lib/decision-engine/policies/`
- Tests: `src/__tests__/decision-engine/`
- Validation: `docs/decision-engine/POLICY_MODEL_VALIDATION.md`

---

**Last Updated:** Sprint 3 (June 2026)  
**Next Review:** After Sprint 5 (before Payroll design)
