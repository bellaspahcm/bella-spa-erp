# HARDCODED VALUES AUDIT - PAYROLL SYSTEM

**Date:** 22/06/2026  
**Purpose:** Identify all hardcoded values that need to be migrated to `tenant_payroll_config` table

---

## 📊 SUMMARY

| Category | Count | Migration Priority |
|----------|-------|-------------------|
| Commission Rates | 2 | P0 (High) |
| KPI Thresholds | 3 | P0 (High) |
| Validation Thresholds | 4 | P1 (Medium) |
| Test Data | 50+ | P2 (Low - no migration) |

---

## 🎯 P0: CRITICAL HARDCODED VALUES (Must Migrate)

### 1. Commission Rates

#### Location: `src/services/providers/compensation-provider.ts`

**Hardcoded values found:**

```typescript
// Line 320-322
if (!config?.sessionCommissionRate) return 0;
const baseRate = config.sessionCommissionRate;  // ← Already configurable!
```

**Status:** ✅ **ALREADY CONFIGURATION-DRIVEN**
- CommissionProvider already reads from `config.sessionCommissionRate`
- No hardcoded value in production code
- Test files use `150000` but that's expected

**Action:** None needed for production code

---

#### Location: Test files

**Found in:**
- `src/__tests__/business-process/universal-demo.test.ts`
- `src/__tests__/business-process/composition.test.ts`

**Values:**
```typescript
tenantConfig: {
  sessionCommissionRate: 150000,       // ← Test data
  serviceCommissionRate: 0.10,         // ← Test data
  productCommissionRate: 0.12,         // ← Test data
}
```

**Status:** ✅ Test data (no migration needed)

---

### 2. KPI Configuration

#### Location: `src/lib/business-rules/salary.ts`

**Documentation says:**
```typescript
/**
 * **Typical Configuration (Bella Spa):**
 * - Target: 30 sessions per month
 * - Bonus: 1,000,000 VND
 */

// Example in comments:
const config = {
  kpi_target_sessions: 30,           // ← Currently in database (employees.kpi_target_sessions)
  kpi_bonus_amount: 1000000          // ← Currently in database (employees.kpi_bonus_amount)
};
```

**Current Status:**
- KPI target is stored per-employee in `employees` table
- NOT in `tenant_payroll_config` yet

**Migration Strategy:**
- **Option A:** Keep in `employees` table (per-employee KPI)
- **Option B:** Move default to `tenant_payroll_config`, allow per-employee override

**Recommendation:** **Option B**
- Default KPI in `tenant_payroll_config`
- Per-employee override in `employees` table
- Provider checks: employee override > tenant config > default

**Action:** Create migration script

---

### 3. Validation Thresholds

#### Location: `src/lib/decision-engine/policies/payroll-salary-v1.ts`

**Hardcoded validation rules:**

```typescript
// Rule 2: Excessive Deduction Cap
value: 30  // ← 30% max deduction

// Rule 3: High Salary CFO Approval
value: 15000000  // ← 15M VND threshold

// Rule 4: KPI Consistency Check
value: 30  // ← 30 sessions target

// Rule 5: Low Attendance Alert
value: 50  // ← 50% base salary threshold
value: 13  // ← 13 working days threshold
```

**Migration Strategy:**
- These are **business rules**, not provider configs
- Should go into separate `tenant_business_rules` table (future)
- For now: Keep hardcoded, document as "Phase 2"

**Action:** Document only, migrate in Phase 2

---

## 🔍 P1: DEFAULT VALUES (Nice to Have)

### Location: Various test files

**Base Salary Default:** `6,000,000 VND`
- Found in: Multiple test files
- Status: Already stored in `employees.base_salary`
- Action: None needed

**Rating Bonus Thresholds:**
```typescript
bonus_5_star: 50000,
bonus_4_5_star: 30000,
bonus_4_star: 10000,
```
- Found in: `src/__tests__/kpi-calculator.test.ts`
- Status: Should move to `tenant_payroll_config.rating`
- Action: Add to migration script

---

## 📝 MIGRATION PLAN

### Phase 1A: Commission Provider (Already Done ✅)

**Status:** CommissionProvider already reads from config
**No action needed**

---

### Phase 1B: KPI Provider (TODO)

**Current:**
```typescript
// employees table
{
  kpi_target_sessions: 30,
  kpi_bonus_amount: 1000000
}
```

**Target:**
```typescript
// tenant_payroll_config table
{
  provider_key: 'kpi',
  enabled: true,
  strategy: 'threshold',
  config: {
    target: 30,              // Default target
    bonus: 1000000           // Default bonus
  }
}

// employees table (override)
{
  kpi_target_sessions: 35,   // Override: this employee needs 35
  kpi_bonus_amount: 1500000  // Override: higher bonus
}
```

**Migration Script:**
```sql
-- Insert default KPI config for each tenant
INSERT INTO tenant_payroll_config (tenant_id, provider_key, enabled, strategy, config)
SELECT 
  t.id as tenant_id,
  'kpi' as provider_key,
  true as enabled,
  'threshold' as strategy,
  jsonb_build_object(
    'target', 30,
    'bonus', 1000000
  ) as config
FROM tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM tenant_payroll_config 
  WHERE tenant_id = t.id AND provider_key = 'kpi'
);
```

---

### Phase 1C: Rating Provider (TODO)

**Target:**
```typescript
// tenant_payroll_config table
{
  provider_key: 'rating',
  enabled: true,
  strategy: 'threshold',
  config: {
    minRating: 4.5,
    bonus: 50000
  }
}
```

**Migration Script:**
```sql
-- Insert default Rating config for each tenant
INSERT INTO tenant_payroll_config (tenant_id, provider_key, enabled, strategy, config)
SELECT 
  t.id as tenant_id,
  'rating' as provider_key,
  false as enabled,  -- Off by default
  'threshold' as strategy,
  jsonb_build_object(
    'minRating', 4.5,
    'bonus', 50000
  ) as config
FROM tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM tenant_payroll_config 
  WHERE tenant_id = t.id AND provider_key = 'rating'
);
```

---

## 📊 CURRENT vs TARGET ARCHITECTURE

### Current (Hardcoded):

```
KPIProvider.calculate()
  ↓
if (sessions >= 30) {  // ← Hardcoded threshold
  bonus = 1000000;     // ← Hardcoded amount
}
```

### Target (Configuration-Driven):

```
KPIProvider.calculate()
  ↓
config = await configService.getProviderConfig(tenantId, 'kpi')
  ↓
if (!config.enabled) return 0;
  ↓
strategy = getStrategy(config.strategy)  // 'threshold', 'linear', 'tier'
  ↓
bonus = strategy.calculate(sessions, config.config)
```

---

## ✅ VALIDATION CHECKLIST

Before considering migration complete:

- [ ] All hardcoded commission rates moved to config
- [ ] All hardcoded KPI thresholds moved to config
- [ ] All hardcoded rating thresholds moved to config
- [ ] Default configs inserted for all existing tenants
- [ ] Providers refactored to read from `payrollConfigService`
- [ ] Tests updated to use config instead of hardcoded values
- [ ] Backward compatibility verified (old data still works)
- [ ] Documentation updated

---

## 🎯 NEXT STEPS

1. ✅ Create `tenant_payroll_config` schema (DONE)
2. ✅ Create `PayrollConfigService` (DONE)
3. ⏳ **Insert default configs for existing tenants** (CURRENT STEP)
4. ⏳ Refactor KPIProvider to use config
5. ⏳ Refactor RatingProvider to use config
6. ⏳ Add AttendanceProvider (currently doesn't exist)
7. ⏳ Test with 3 different tenant configs

---

## 📝 NOTES

**Why Some Values Are Still Hardcoded:**

1. **Test Data:** Test files should have hardcoded values for reproducibility
2. **Validation Rules:** Business rules (like "30% max deduction") are separate from provider configs
3. **Already Configurable:** CommissionProvider already reads from config (no migration needed)

**What Needs Migration:**

1. **KPI defaults:** Move from inline code to `tenant_payroll_config`
2. **Rating defaults:** Move from inline code to `tenant_payroll_config`
3. **Attendance rules:** Create new provider + config

**What Can Stay Hardcoded:**

1. **Test data:** Keep as-is
2. **Validation thresholds:** Move to separate table in Phase 2
3. **Constants:** Math constants, formats, etc.

---

## 🔗 RELATED FILES

- Database schema: `supabase/migrations/20260622_create_tenant_payroll_config.sql`
- Types: `src/types/payroll-config.ts`
- Service: `src/services/payroll-config.service.ts`
- Providers: `src/lib/decision-engine/providers/` (to be created)

---

**Conclusion:** Most "hardcoded" values are actually in test files (expected). Only a few production defaults need migration. CommissionProvider is already configuration-driven. Main work is creating default configs for existing tenants.
