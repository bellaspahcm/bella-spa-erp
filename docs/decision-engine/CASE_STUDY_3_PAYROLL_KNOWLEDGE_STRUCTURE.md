# Case Study 3: Payroll Knowledge Structure Design

**Date:** 2026-06-22  
**Task:** #2 - Thiết kế Payroll Knowledge structure  
**Goal:** Define knowledge dictionary fields for payroll policy evaluation

---

## Design Principles

### 1. Knowledge = Dictionary (Not Interface)

**Engine receives:**
```typescript
Record<string, unknown>
```

**NOT:**
```typescript
interface PayrollKnowledge {
  salary: { ... },
  employee: { ... }
}
```

**Why?**
- Engine must stay domain-agnostic
- No typed interfaces at engine level
- Service layer can use builders, but engine sees flat dictionary

---

### 2. Field Naming Convention

**Pattern:** `<namespace>.<field>`

**Namespaces:**
- `salary.*` - Salary components and calculations
- `config.*` - Tenant configuration values
- `employee.*` - Employee metadata
- `validation.*` - Derived validation metrics

**Examples:**
```typescript
"salary.totalSalary": 8500000
"config.kpiTarget": 30
"employee.isResigned": false
"validation.deductionPercent": 15.5
```

**Rationale:**
- Dot notation for logical grouping
- Easy to read in policy rules
- Matches Leave/Booking pattern


---

## Knowledge Fields Specification

### Category 1: Salary Components (Pre-Calculated)

**Source:** `recalculateAndSaveSalaryRecordEngine()` result

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `salary.rawBaseSalary` | number | Full monthly base salary (before pro-rata) | 6000000 |
| `salary.baseSalary` | number | Pro-rated base salary `(raw / 26) × actualDays` | 5538462 |
| `salary.sessionBonus` | number | Total session commission bonus | 500000 |
| `salary.ratingBonus` | number | Rating-based bonus (weighted sessions × tier) | 465000 |
| `salary.kpiBonus` | number | KPI achievement bonus (0 or fixed amount) | 1000000 |
| `salary.serviceCommission` | number | Service-level commissions (Beauty Spa) | 150000 |
| `salary.productCommission` | number | Product sales commissions (Beauty Spa) | 50000 |
| `salary.positionBonus` | number | Position tier multiplier bonus | 200000 |
| `salary.seniorityBonus` | number | Years-of-service bonus | 600000 |
| `salary.manualAdjustments` | number | Net manual adjustments (bonuses - deductions) | 600000 |
| `salary.deductions` | number | Total deductions (penalties, fines) | 250000 |
| `salary.advances` | number | Advance payments to deduct | 0 |
| `salary.totalSalary` | number | **Final total salary** | 8853462 |

**Notes:**
- All values are **final calculated amounts** (NOT formulas)
- Service layer handles ALL calculation logic
- Policy evaluates these results


---

### Category 2: Performance Metrics (For Validation)

**Source:** Session logs, attendance, KPI records

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `salary.sessionCount` | number | Weighted session count (quy đổi) | 18.5 |
| `salary.averageRating` | number \| null | Average rating (0-5.0), null if no ratings | 4.7 |
| `salary.actualDays` | number | Working days (excludes absences) | 24 |
| `salary.lateDays` | number | Number of late days | 1 |
| `salary.absentDays` | number | Number of absent days | 2 |

**Usage:**
- KPI consistency checks: `kpiBonus > 0` requires `sessionCount >= target`
- Rating validation: `ratingBonus > 0` requires `averageRating >= 4.0`
- Attendance validation: Cross-check deductions with late/absent days

---

### Category 3: Derived Validation Metrics

**Source:** Calculated from salary components

| Field | Type | Description | Formula | Example |
|-------|------|-------------|---------|---------|
| `validation.deductionPercent` | number | Deductions as % of base salary | `(deductions / baseSalary) × 100` | 4.5 |
| `validation.baseSalaryPercent` | number | Pro-rata % of raw salary | `(baseSalary / rawBaseSalary) × 100` | 92.3 |
| `validation.hasNegativeComponent` | boolean | Any component < 0 (data error) | Check all components | false |
| `validation.totalComponents` | number | Sum of all positive components | Sum bonuses + base | 9103462 |
| `validation.netDeductions` | number | Sum of all deductions | `deductions + advances` | 250000 |

**Usage:**
- Deduction cap enforcement: `validation.deductionPercent > 30` → flag
- Low attendance alert: `validation.baseSalaryPercent < 50` → review
- Data integrity: `validation.hasNegativeComponent === true` → block

---

### Category 4: Configuration Values

**Source:** Tenant salary config

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `config.kpiTarget` | number | KPI session target | 30 |
| `config.kpiBonusAmount` | number | KPI bonus amount (VND) | 1000000 |
| `config.bonus5Star` | number | 5-star bonus per session | 50000 |
| `config.bonus45Star` | number | 4.5-star bonus per session | 30000 |
| `config.bonus4Star` | number | 4-star bonus per session | 10000 |
| `config.penaltyLatePerDay` | number | Late penalty (VND/day) | 50000 |
| `config.penaltyAbsentPerDay` | number | Absent penalty (VND/day) | 200000 |
| `config.maxDeductionPercent` | number | Max deduction cap (%) | 30 |
| `config.highSalaryThreshold` | number | CFO approval threshold (VND) | 15000000 |
| `config.minBaseSalary` | number | Minimum base salary (VND) | 4000000 |

**Usage:**
- Policy rules reference config values
- Enables tenant-specific thresholds
- No hardcoded values in policy rules

---

### Category 5: Employee Metadata

**Source:** Users table, HR records

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `employee.id` | string | KTV user ID | "uuid-123" |
| `employee.fullName` | string | Full name | "Nguyễn Văn A" |
| `employee.positionTier` | string | Position tier | "senior" |
| `employee.yearsOfService` | number | Years since hire date | 2.5 |
| `employee.isResigned` | boolean | Resigned this month? | false |
| `employee.resignationDate` | string \| null | Resignation date (ISO) | null |
| `employee.hireDate` | string \| null | Hire date (ISO) | "2024-01-15" |

**Usage:**
- Resignation alerts: `employee.isResigned === true` → verify prorata
- Position validation: Cross-check `positionBonus` with `positionTier`
- Seniority validation: Cross-check `seniorityBonus` with `yearsOfService`

---

### Category 6: Record Metadata

**Source:** Salary record status

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `record.status` | string | Record status | "draft" |
| `record.monthYear` | string | Period (YYYY-MM-01) | "2026-06-01" |
| `record.hasManualOverrides` | boolean | Has admin adjustments? | true |
| `record.publishedAt` | string \| null | Published timestamp | null |
| `record.notes` | string \| null | Calculation notes | "Cong thuc te: 24/26 ngay" |

**Usage:**
- Draft vs Published validation rules
- Manual override flagging
- Audit trail references

---

## Complete Knowledge Dictionary Example

```typescript
const payrollKnowledge: Record<string, unknown> = {
  // Salary components (13 fields)
  "salary.rawBaseSalary": 6000000,
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
  "salary.totalSalary": 8853462,
  
  // Performance metrics (5 fields)
  "salary.sessionCount": 18.5,
  "salary.averageRating": 4.7,
  "salary.actualDays": 24,
  "salary.lateDays": 1,
  "salary.absentDays": 2,
  
  // Validation metrics (5 fields)
  "validation.deductionPercent": 4.5,
  "validation.baseSalaryPercent": 92.3,
  "validation.hasNegativeComponent": false,
  "validation.totalComponents": 9103462,
  "validation.netDeductions": 250000,
  
  // Configuration (10 fields)
  "config.kpiTarget": 30,
  "config.kpiBonusAmount": 1000000,
  "config.bonus5Star": 50000,
  "config.bonus45Star": 30000,
  "config.bonus4Star": 10000,
  "config.penaltyLatePerDay": 50000,
  "config.penaltyAbsentPerDay": 200000,
  "config.maxDeductionPercent": 30,
  "config.highSalaryThreshold": 15000000,
  "config.minBaseSalary": 4000000,
  
  // Employee metadata (7 fields)
  "employee.id": "uuid-123",
  "employee.fullName": "Nguyễn Văn A",
  "employee.positionTier": "senior",
  "employee.yearsOfService": 2.5,
  "employee.isResigned": false,
  "employee.resignationDate": null,
  "employee.hireDate": "2024-01-15",
  
  // Record metadata (5 fields)
  "record.status": "draft",
  "record.monthYear": "2026-06-01",
  "record.hasManualOverrides": true,
  "record.publishedAt": null,
  "record.notes": "Cong thuc te: 24/26 ngay. "
};

// Total: 45 fields
```


---

## Knowledge Builder Implementation Plan

### Service Function: `buildPayrollKnowledge()`

**File:** `src/services/payroll-decision.service.ts`

**Signature:**
```typescript
async function buildPayrollKnowledge(
  supabase: SupabaseClient<Database>,
  ktvId: string,
  monthYear: string,
  tenantId: string
): Promise<Record<string, unknown>>
```

**Logic Flow:**

1. **Call existing calculation engine:**
   ```typescript
   const result = await recalculateAndSaveSalaryRecordEngine(
     supabase, ktvId, monthYear, tenantId
   );
   ```

2. **Fetch salary record:**
   ```typescript
   const { data: record } = await supabase
     .from('salary_records')
     .select('*')
     .eq('ktv_id', ktvId)
     .eq('month_year', monthYear)
     .single();
   ```

3. **Fetch employee data:**
   ```typescript
   const { data: employee } = await supabase
     .from('users')
     .select('id, full_name, base_salary, position_tier, hire_date, resignation_date')
     .eq('id', ktvId)
     .single();
   ```

4. **Fetch tenant config:**
   ```typescript
   const { data: tenant } = await supabase
     .from('tenants')
     .select('salary_config')
     .eq('id', tenantId)
     .single();
   ```

5. **Calculate derived metrics:**
   ```typescript
   const deductionPercent = (record.violations_deduction / record.base_salary) * 100;
   const baseSalaryPercent = (record.base_salary / employee.base_salary) * 100;
   const hasNegativeComponent = /* check all components */;
   ```

6. **Build knowledge dictionary:**
   ```typescript
   return {
     "salary.rawBaseSalary": employee.base_salary,
     "salary.baseSalary": record.base_salary,
     // ... all 45 fields
   };
   ```

**Estimated LOC:** ~180-200


---

## Policy Rule Examples Using Knowledge Fields

### Example 1: High Salary CFO Approval

```typescript
{
  id: "payroll-high-salary-cfo",
  priority: 1,
  condition: { 
    field: "salary.totalSalary", 
    operator: ">", 
    value: 15000000 
  },
  outcome: "REQUIRES_CFO_APPROVAL",
  explanation: "Tổng lương vượt 15 triệu, cần CFO phê duyệt"
}
```

**Knowledge fields used:**
- `salary.totalSalary` (direct comparison)

---

### Example 2: Excessive Deduction Cap

```typescript
{
  id: "payroll-deduction-cap",
  priority: 0,
  condition: {
    operator: "and",
    conditions: [
      { field: "validation.deductionPercent", operator: ">", value: 30 },
      { field: "employee.isResigned", operator: "===", value: false }
    ]
  },
  outcome: "EXCESSIVE_DEDUCTION",
  explanation: "Tổng phạt vượt 30% lương cơ bản, cần review"
}
```

**Knowledge fields used:**
- `validation.deductionPercent` (derived metric)
- `employee.isResigned` (context flag)

---

### Example 3: KPI Consistency Check

```typescript
{
  id: "payroll-kpi-mismatch",
  priority: 1,
  condition: {
    operator: "and",
    conditions: [
      { field: "salary.kpiBonus", operator: ">", value: 0 },
      { field: "salary.sessionCount", operator: "<", value: 30 }
    ]
  },
  outcome: "DATA_ERROR",
  explanation: "KPI bonus được nhận nhưng sessions < target (lỗi dữ liệu)"
}
```

**Knowledge fields used:**
- `salary.kpiBonus` (salary component)
- `salary.sessionCount` (performance metric)


---

### Example 4: Negative Component Detection

```typescript
{
  id: "payroll-negative-component",
  priority: 0,
  condition: { 
    field: "validation.hasNegativeComponent", 
    operator: "===", 
    value: true 
  },
  outcome: "DATA_ERROR",
  explanation: "Phát hiện component âm (lỗi dữ liệu nghiêm trọng)"
}
```

**Knowledge fields used:**
- `validation.hasNegativeComponent` (derived boolean)

---

### Example 5: Low Attendance Alert

```typescript
{
  id: "payroll-low-attendance",
  priority: 2,
  condition: {
    operator: "and",
    conditions: [
      { field: "validation.baseSalaryPercent", operator: "<", value: 50 },
      { field: "salary.actualDays", operator: "<", value: 13 }
    ]
  },
  outcome: "LOW_ATTENDANCE_ALERT",
  explanation: "Công < 50%, kiểm tra nghỉ việc hoặc lỗi chấm công"
}
```

**Knowledge fields used:**
- `validation.baseSalaryPercent` (derived metric)
- `salary.actualDays` (performance metric)

---

### Example 6: Manual Override Flag

```typescript
{
  id: "payroll-manual-override",
  priority: 3,
  condition: {
    operator: "and",
    conditions: [
      { field: "record.hasManualOverrides", operator: "===", value: true },
      { field: "salary.manualAdjustments", operator: "!=", value: 0 }
    ]
  },
  outcome: "REQUIRES_MANAGER_REVIEW",
  explanation: "Có điều chỉnh thủ công, cần manager review"
}
```

**Knowledge fields used:**
- `record.hasManualOverrides` (record metadata)
- `salary.manualAdjustments` (salary component)


---

## Knowledge Field Count Summary

| Category | Fields | Description |
|----------|--------|-------------|
| Salary Components | 13 | Pre-calculated salary values |
| Performance Metrics | 5 | Session counts, ratings, attendance |
| Validation Metrics | 5 | Derived validation flags and percentages |
| Configuration | 10 | Tenant salary config values |
| Employee Metadata | 7 | Employee info (position, seniority, resignation) |
| Record Metadata | 5 | Salary record status and timestamps |
| **TOTAL** | **45** | **Complete knowledge dictionary** |

---

## Comparison with Previous Case Studies

| Metric | Leave (CS1) | Booking (CS2) | Payroll (CS3) |
|--------|-------------|---------------|---------------|
| **Knowledge Fields** | 8 | 7 | 45 |
| **Field Types** | boolean, number | boolean, number | number, string, boolean |
| **Namespaces** | 2 (`leave.*`, `attendance.*`) | 3 (`booking.*`, `ktv.*`, `resource.*`) | 6 (`salary.*`, `validation.*`, `config.*`, `employee.*`, `record.*`) |
| **Derived Metrics** | 0 | 1 (`hasConflict`) | 5 (`deductionPercent`, `baseSalaryPercent`, etc.) |
| **Config Values** | 0 (hardcoded) | 0 (hardcoded) | 10 (from DB) |
| **Complexity** | Low | Medium | High |

**Observation:** Payroll has 6x more fields than Booking, but policy rules remain simple (threshold checks only)

---

## Design Decisions and Rationale

### Decision 1: Include Config Values in Knowledge

**Why?**
- Enables tenant-specific thresholds
- Policy rules reference config (e.g., `field: "config.kpiTarget"`)
- Avoids hardcoding thresholds in policy files

**Alternative Rejected:**
- Hardcode thresholds in policy → not tenant-specific
- Store config separately → policy can't reference values


---

### Decision 2: Calculate Derived Metrics in Service

**Why?**
- Policy can't compute percentages (no formula operators)
- Derived metrics enable expressive validation rules
- Service layer = right place for calculations

**Example:**
```typescript
// Service computes:
"validation.deductionPercent": (deductions / baseSalary) * 100

// Policy evaluates:
{ field: "validation.deductionPercent", operator: ">", value: 30 }
```

**Alternative Rejected:**
- Add `divide`, `multiply` operators to DSL → violates YAGNI
- Let policy compute inline → makes policy too complex

---

### Decision 3: Flat Dictionary (Not Nested Objects)

**Chosen:**
```typescript
{
  "salary.totalSalary": 8500000,
  "salary.baseSalary": 6000000
}
```

**Rejected:**
```typescript
{
  salary: {
    totalSalary: 8500000,
    baseSalary: 6000000
  }
}
```

**Why?**
- Dot notation works with flat dictionaries (`get(knowledge, "salary.totalSalary")`)
- Simpler to serialize/deserialize
- Matches Leave/Booking pattern
- Engine uses lodash `get()` for nested access

---

### Decision 4: Include All Salary Components (Even Unused)

**Why?**
- Future policy rules may reference any component
- Data integrity checks need all values
- Minimal cost (just copying values)

**Example Use Case:**
```typescript
// Future rule: Flag if service commission > 50% of total
{
  condition: {
    operator: "and",
    conditions: [
      { field: "salary.serviceCommission", operator: ">", value: 0 },
      // Compare service commission to half of total
    ]
  }
}
```


---

## TypeScript Type Definition (For Service Layer Only)

**Note:** This interface is for **service layer type safety**, NOT for engine.

**File:** `src/services/payroll-decision.service.ts`

```typescript
/**
 * Payroll knowledge structure (internal type for service layer).
 * Engine receives this as `Record<string, unknown>`.
 */
interface PayrollKnowledgeBuilder {
  // Salary components (13 fields)
  salary: {
    rawBaseSalary: number;
    baseSalary: number;
    sessionBonus: number;
    ratingBonus: number;
    kpiBonus: number;
    serviceCommission: number;
    productCommission: number;
    positionBonus: number;
    seniorityBonus: number;
    manualAdjustments: number;
    deductions: number;
    advances: number;
    totalSalary: number;
    
    // Performance metrics (5 fields)
    sessionCount: number;
    averageRating: number | null;
    actualDays: number;
    lateDays: number;
    absentDays: number;
  };
  
  // Validation metrics (5 fields)
  validation: {
    deductionPercent: number;
    baseSalaryPercent: number;
    hasNegativeComponent: boolean;
    totalComponents: number;
    netDeductions: number;
  };
  
  // Configuration (10 fields)
  config: {
    kpiTarget: number;
    kpiBonusAmount: number;
    bonus5Star: number;
    bonus45Star: number;
    bonus4Star: number;
    penaltyLatePerDay: number;
    penaltyAbsentPerDay: number;
    maxDeductionPercent: number;
    highSalaryThreshold: number;
    minBaseSalary: number;
  };
  
  // Employee metadata (7 fields)
  employee: {
    id: string;
    fullName: string;
    positionTier: 'junior' | 'senior' | 'lead';
    yearsOfService: number;
    isResigned: boolean;
    resignationDate: string | null;
    hireDate: string | null;
  };
  
  // Record metadata (5 fields)
  record: {
    status: string;
    monthYear: string;
    hasManualOverrides: boolean;
    publishedAt: string | null;
    notes: string | null;
  };
}
```

**Flatten function:**
```typescript
function flattenKnowledge(builder: PayrollKnowledgeBuilder): Record<string, unknown> {
  return {
    "salary.rawBaseSalary": builder.salary.rawBaseSalary,
    "salary.baseSalary": builder.salary.baseSalary,
    // ... flatten all 45 fields
  };
}
```


---

## Validation and Testing Strategy

### Unit Tests for Knowledge Builder

**Test Cases:**

1. **Complete field coverage:**
   ```typescript
   test('buildPayrollKnowledge returns all 45 fields', async () => {
     const knowledge = await buildPayrollKnowledge(...);
     expect(Object.keys(knowledge).length).toBe(45);
   });
   ```

2. **Derived metrics correctness:**
   ```typescript
   test('validation.deductionPercent calculated correctly', async () => {
     const knowledge = await buildPayrollKnowledge(...);
     const expected = (knowledge['salary.deductions'] / knowledge['salary.baseSalary']) * 100;
     expect(knowledge['validation.deductionPercent']).toBeCloseTo(expected, 2);
   });
   ```

3. **Negative component detection:**
   ```typescript
   test('validation.hasNegativeComponent detects negative values', async () => {
     // Mock with negative deduction
     const knowledge = await buildPayrollKnowledge(...);
     expect(knowledge['validation.hasNegativeComponent']).toBe(true);
   });
   ```

4. **Config values loaded:**
   ```typescript
   test('config fields loaded from tenant settings', async () => {
     const knowledge = await buildPayrollKnowledge(...);
     expect(knowledge['config.kpiTarget']).toBe(30);
     expect(knowledge['config.highSalaryThreshold']).toBe(15000000);
   });
   ```

5. **Flat dictionary structure:**
   ```typescript
   test('knowledge is flat dictionary with dot notation', async () => {
     const knowledge = await buildPayrollKnowledge(...);
     expect(typeof knowledge['salary.totalSalary']).toBe('number');
     expect(knowledge['salary']).toBeUndefined(); // Not nested
   });
   ```


---

## Performance Considerations

### Knowledge Size: 45 Fields

**Memory Impact:**
- 45 fields × ~50 bytes/field = ~2.25 KB per knowledge dictionary
- Negligible for single evaluations
- Batch processing 100 KTVs = ~225 KB (acceptable)

**Computation Time:**
- `recalculateAndSaveSalaryRecordEngine()` already runs (~300ms)
- Building knowledge dictionary: +20-30ms (database queries for config/employee)
- Derived metrics calculation: +5-10ms (simple arithmetic)
- **Total overhead:** ~30-40ms (10-13% of existing calculation time)

**Conclusion:** Performance impact is acceptable ✅

---

### Knowledge Access Performance

**Lodash `get()` for dot notation:**
```typescript
import { get } from 'lodash';

const value = get(knowledge, 'salary.totalSalary');
// O(1) lookup for flat dictionaries
```

**Alternative (manual):**
```typescript
const value = knowledge['salary.totalSalary'];
// Direct property access (faster)
```

**Recommendation:** Use direct property access for performance-critical paths

---

## Edge Cases and Error Handling

### Edge Case 1: Missing Salary Record

**Scenario:** KTV has no salary record yet for the month

**Handling:**
```typescript
if (!record) {
  // Use live calculations only
  return {
    "salary.totalSalary": liveCalculatedTotal,
    "record.status": "draft",
    // ... other fields with defaults
  };
}
```

---

### Edge Case 2: Resigned KTV

**Scenario:** KTV resigned mid-month

**Handling:**
```typescript
if (employee.resignation_date) {
  return {
    "employee.isResigned": true,
    "employee.resignationDate": employee.resignation_date,
    "validation.baseSalaryPercent": /* prorated to resignation date */
  };
}
```


---

### Edge Case 3: Null Average Rating

**Scenario:** KTV has no session reviews yet

**Handling:**
```typescript
return {
  "salary.averageRating": null,  // ← Keep null (not 0)
  "salary.ratingBonus": 0,
};
```

**Policy rule must handle null:**
```typescript
{
  condition: {
    operator: "and",
    conditions: [
      { field: "salary.averageRating", operator: "!==", value: null },
      { field: "salary.averageRating", operator: "<", value: 4.0 }
    ]
  }
}
```

---

### Edge Case 4: Division by Zero

**Scenario:** Base salary = 0 (invalid data)

**Handling:**
```typescript
const deductionPercent = record.base_salary > 0
  ? (record.violations_deduction / record.base_salary) * 100
  : 0;

return {
  "validation.deductionPercent": deductionPercent,
  "validation.hasNegativeComponent": record.base_salary <= 0,  // Flag as error
};
```

---

## Integration with Existing System

### Minimal Changes Required

**No changes needed:**
- ✅ `recalculateAndSaveSalaryRecordEngine()` - reused as-is
- ✅ Database schema - no new tables/columns
- ✅ RuleReasoner - same engine
- ✅ DSL types - no new operators

**New files only:**
- `src/services/payroll-decision.service.ts` - knowledge builder (~200 LOC)
- `src/lib/decision-engine/policies/payroll-salary-v1.ts` - policy rules (~80 LOC)
- `src/__tests__/decision-engine/payroll-salary.test.ts` - tests (~120 LOC)

**Total new code:** ~400 LOC (vs 1,900 LOC in rejected BDUF plan)


---

## Conclusion

### Knowledge Structure Summary

- **Total fields:** 45
- **Namespaces:** 6 (`salary.*`, `validation.*`, `config.*`, `employee.*`, `record.*`)
- **Field types:** number (35), boolean (5), string (5)
- **Derived metrics:** 5 (computed from base values)
- **Config values:** 10 (from tenant settings)
- **Pattern:** Flat dictionary with dot notation (consistent with Leave/Booking)

### Key Design Decisions

1. ✅ **Service-first:** All calculations in service, policy validates results
2. ✅ **Flat dictionary:** Dot notation for logical grouping
3. ✅ **Include config:** Enable tenant-specific thresholds
4. ✅ **Derived metrics:** Pre-compute common validation checks
5. ✅ **Type safety in service:** Use interfaces for builder, flatten to `Record<string, unknown>` for engine

### Validation Checklist

- ✅ Knowledge = Dictionary (NOT typed interface at engine level)
- ✅ Field naming follows pattern (`namespace.field`)
- ✅ All salary components included (13 fields)
- ✅ Derived metrics enable threshold checks (5 fields)
- ✅ Config values support tenant customization (10 fields)
- ✅ Handles edge cases (null, division by zero, resigned KTV)
- ✅ Performance acceptable (~30-40ms overhead)
- ✅ Consistent with Leave/Booking pattern

### Next Steps

**Task #3:** Design DSL extensions (if needed)
- Review 6 example policy rules
- Verify all rules expressible with current operators
- Expected result: **0 new operators needed** ✅

**Task #4:** Prototype `payroll-salary-v1.ts`
- Implement 3-5 minimal validation rules
- Use knowledge fields from this design
- Prove architecture with tests

