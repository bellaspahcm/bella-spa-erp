# Core Payroll Services

**⚠️ CRITICAL ARCHITECTURAL DECISION**: This directory contains ONLY generic payroll abstractions that work across multiple industries. Do NOT add industry-specific logic here.

## What Belongs in Core Payroll

✅ **Generic payroll concepts that apply to ANY industry:**
- Payroll period management (year/month cycles)
- Employee payroll records (base salary, total salary, status)
- Manual adjustments (bonuses, deductions, corrections)
- Payroll status flow (draft → pending_approval → published → confirmed → finalized)
- Pro-rata salary calculations (base_salary / totalDays * workingDays)
- Generic compensation components and breakdowns
- Payroll reporting and export formats

## What Belongs in Industry Modules

❌ **Spa-specific payroll logic (stays in `src/modules/hr-salary/`):**
- Session-based commissions (`session_bonus`)
- Package multipliers (1.0x, 1.5x, 2.0x for different spa packages)
- KTV rating bonuses (`rating_bonus`)
- KPI bonuses (`kpi_bonus`)
- GPS attendance tracking
- Violation deductions
- Session counting with weighted multipliers
- Salary recalculation engine (`recalculateAndSaveSalaryRecord`)

❌ **Retail-specific payroll (would go in `src/modules/retail/`):**
- Sales commission calculations
- Inventory shortage deductions
- Shift differential pay

❌ **Cleaning-specific payroll (would go in `src/modules/cleaning/`):**
- Job completion bonuses
- Equipment maintenance bonuses
- Travel allowances

## Current File Structure

```
src/core/services/payroll/
├── contracts.ts    # Generic payroll interfaces (PayrollPeriod, EmployeePayrollRecord, etc.)
├── types.ts        # Generic payroll types (PayrollStatus, CompensationComponent, etc.)
├── README.md       # This file - documents boundaries
└── index.ts        # Barrel export
```

**Note**: No actual service functions exist yet. This is a skeleton for future Wave 3 work.

## Architectural Boundaries

### Core Responsibility
Core payroll provides **data structures and contracts** for:
- Storing payroll records in the database
- Representing payroll periods
- Tracking payroll adjustments
- Defining status flows

### Module Responsibility
Industry modules provide **calculation engines** for:
- Computing total salary from various components
- Applying industry-specific commission rules
- Calculating bonuses based on performance metrics
- Determining deductions based on violations/KPIs

### Example: Spa Module Integration

**Core provides the container:**
```typescript
interface EmployeePayrollRecord {
  id: string;
  employeeId: string;
  period: string;
  baseSalary: number;
  totalSalary: number;
  status: PayrollStatus;
  metadata: Record<string, unknown>; // ← Spa data goes here
}
```

**Spa module fills the metadata:**
```typescript
// In src/modules/hr-salary/
const spaMetadata = {
  totalSessions: 15.5,          // Weighted session count
  sessionBonus: 1550000,        // 100k per session
  ratingBonus: 300000,          // Based on customer ratings
  kpiBonus: 500000,             // From kpi_records table
  violationsDeduction: 100000,  // GPS violations
  actualDays: 26                // From attendance table
};
```

**Spa module calculates the salary:**
```typescript
// In src/modules/hr-salary/actions/salary-recalculation-engine.ts
export async function recalculateAndSaveSalaryRecordEngine(
  supabase: SupabaseClient,
  ktvId: string,
  monthYear: string,
  tenantId: string
) {
  // 1. Pro-rata base salary (generic logic, could move to core)
  const baseSalary = calcProRataBaseSalary(...)
  
  // 2. Session commission (spa-specific, stays in module)
  const sessionBonus = calculateSessionCommissionBonus(...)
  
  // 3. Rating bonus (spa-specific, stays in module)
  const ratingBonus = calculateRatingBonus(...)
  
  // 4. KPI bonus (spa-specific, stays in module)
  const kpiBonus = await getKpiBonus(...)
  
  // 5. Save to EmployeePayrollRecord with spa metadata
  const record: EmployeePayrollRecord = {
    baseSalary,
    totalSalary: baseSalary + sessionBonus + ratingBonus + kpiBonus - deductions,
    metadata: { totalSessions, sessionBonus, ratingBonus, kpiBonus, ... }
  }
}
```

## Usage Patterns (Future Wave 3)

### 1. Generic Payroll Period

```typescript
import { PayrollPeriod } from '@/core/services/payroll';

const period: PayrollPeriod = {
  year: 2026,
  month: 5,
  status: 'draft',
  isLocked: false
};
```

### 2. Generic Payroll Record

```typescript
import { EmployeePayrollRecord } from '@/core/services/payroll';

const record: EmployeePayrollRecord = {
  id: 'salary-1',
  employeeId: 'ktv-1',
  tenantId: 'tenant-a',
  period: '2026-05',
  baseSalary: 5000000,
  totalSalary: 7500000,
  status: 'draft',
  metadata: {}, // Industry-specific data
  createdAt: '2026-05-01',
  updatedAt: '2026-05-01'
};
```

### 3. Payroll Adjustment

```typescript
import { PayrollAdjustment } from '@/core/services/payroll';

const adjustment: PayrollAdjustment = {
  id: 'adj-1',
  employeeId: 'ktv-1',
  type: 'bonus',
  amount: 500000,
  reason: 'Performance bonus',
  approvedBy: 'admin-1',
  approvedAt: '2026-05-15'
};
```

## Design Principles

### 1. Generic Abstractions
Core payroll provides the **nouns** (PayrollPeriod, EmployeePayrollRecord, PayrollAdjustment) but NOT the **verbs** (calculate, recalculate, approve, finalize).

### 2. Metadata Escape Hatch
Use `metadata: Record<string, unknown>` to store industry-specific fields without polluting core contracts.

### 3. Module-Driven Calculations
All salary calculation engines live in industry modules. Core just stores the results.

### 4. Status Flow Enforcement
Core defines the status progression. Modules respect it but implement their own business rules for transitions.

## Migration Path (Wave 3)

When implementing Wave 3, consider moving these generic functions from spa module to core:
- `calcProRataBaseSalary()` - Pro-rata calculation is universal
- `isDraftSalaryRecord()` - Status checking is universal
- `calculateSalaryTotal()` - Summing components is universal

**Do NOT move** spa-specific logic:
- `calculateWeightedSessionCount()` - Spa package multipliers
- `calculateSessionCommissionBonus()` - Spa commission rates
- `calculateRatingBonus()` - Spa rating system
- `recalculateAndSaveSalaryRecordEngine()` - Spa calculation engine

## Testing Strategy

Core payroll contracts should be tested with:
- Type-checking (TypeScript compilation)
- Contract validation (JSON schema)
- Status flow validation

Industry modules test their own calculation engines against core contracts.

## Related Documentation

- **Spa Payroll Logic**: `src/modules/hr-salary/README.md`
- **Core Services Overview**: `src/core/services/README.md`
- **Phase 3 Migration**: `.kiro/specs/phase-3-physical-extraction/`

---

**Last Updated**: 2026-05-01  
**Maintained By**: Architecture Team  
**Questions**: See `docs/INDUSTRY_MODULE_DEVELOPMENT_PLAYBOOK.md`
