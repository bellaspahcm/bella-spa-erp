# Task 6: Commission Provider - Implementation Plan

**Date**: 2026-07-09  
**Status**: 📋 Planning  
**Estimate**: 2-3 days  
**Priority**: ⭐⭐⭐⭐⭐ HIGH (Provider #4 - Platform proof)

---

## 🎯 OBJECTIVE

Build **CommissionProvider** as the 4th Decision Engine provider, migrating service/product commission logic from hardcoded functions to rule-based engine.

### Why This Matters
- **Proves tiered calculation support** (different commission rates per tier)
- **High-value decisions** (commission rules impact revenue & employee satisfaction)
- **Frequently changing rules** (business adjusts commission structure often)
- **Cache demonstration** (repeat calculations for same KTV/service)

---

## 📊 CURRENT STATE ANALYSIS

### Existing Commission Logic

**Location**: `src/lib/business-rules/commission.ts` (600+ lines)

**Functions**:
1. ✅ `calculateServiceCommission()` - Service item commission
2. ✅ `calculateProductSalesCommission()` - Product sales commission
3. ✅ `calculatePositionBonus()` - Position tier multiplier
4. ✅ `calculateSeniorityBonus()` - Years of service bonus
5. ✅ `aggregateManualAdjustments()` - Manual bonus/deduction

**Commission Types Supported**:
- **Fixed**: 150,000đ per service
- **Percentage**: 10% of sales amount

**Priority System**:
1. Override commission (transaction-level)
2. Tenant default (tenant config)
3. System default (hardcoded)

**Position Tiers**:
- Junior: 1.0x (baseline)
- Senior: 1.2x (+20%)
- Lead: 1.5x (+50%)

**Seniority Tiers**:
- 0-1 year: 0%
- 1-3 years: 5%
- 3-5 years: 10%
- 5+ years: 15%

### Gap Analysis

**What exists (can reuse)**:
- ✅ Commission calculation formulas
- ✅ Position/seniority bonus logic
- ✅ Manual adjustments aggregation
- ✅ Type definitions

**What's missing (need to build)**:
- ❌ Rule-based decision framework
- ❌ Commission eligibility checks (minimum sessions, quality thresholds)
- ❌ Volume-based commission tiers
- ❌ Performance-based multipliers (rating impact)
- ❌ Configurable commission strategies
- ❌ Decision audit trail

---

## 🏗️ IMPLEMENTATION PLAN

### Step 1: Rules Structure (Day 1 - 4-6 hours)

**Goal**: Create 12-15 commission rules across 3 categories

#### Category 1: Base Commission Rules (5 rules)

**Priority Range**: 200-240

1. **Service Commission Fixed** (Priority: 200)
   - **Type**: Action rule
   - **Condition**: `commissionStrategy === 'fixed'`
   - **Action**: `commission = config.serviceCommissionFixed`
   - **Example**: 150,000đ per service

2. **Service Commission Percentage** (Priority: 210)
   - **Type**: Action rule
   - **Condition**: `commissionStrategy === 'percentage'`
   - **Action**: `commission = subtotal × (config.serviceCommissionRate / 100)`
   - **Example**: 10% of 1,000,000đ = 100,000đ

3. **Product Sales Commission Fixed** (Priority: 220)
   - **Type**: Action rule
   - **Condition**: `commissionStrategy === 'fixed'`
   - **Action**: `commission = config.productCommissionFixed`
   - **Example**: 50,000đ per product sale

4. **Product Sales Commission Percentage** (Priority: 230)
   - **Type**: Action rule
   - **Condition**: `commissionStrategy === 'percentage'`
   - **Action**: `commission = salesAmount × (config.productCommissionRate / 100)`
   - **Example**: 12% of 2,000,000đ = 240,000đ

5. **Manual Override Commission** (Priority: 240)
   - **Type**: Action rule
   - **Condition**: `overrideCommission !== null`
   - **Action**: `commission = overrideCommission`
   - **Example**: Admin sets 200,000đ override

#### Category 2: Volume-Based Tier Rules (4 rules)

**Priority Range**: 250-280

6. **Volume Tier 1: Standard** (Priority: 250)
   - **Type**: Multiplier rule
   - **Condition**: `totalSessions < 30`
   - **Action**: `multiplier = 1.0` (baseline)
   - **Example**: 25 sessions → 1.0x

7. **Volume Tier 2: High Volume** (Priority: 260)
   - **Type**: Multiplier rule
   - **Condition**: `totalSessions >= 30 && totalSessions < 50`
   - **Action**: `multiplier = 1.1` (+10%)
   - **Example**: 40 sessions → 1.1x commission

8. **Volume Tier 3: Premium Volume** (Priority: 270)
   - **Type**: Multiplier rule
   - **Condition**: `totalSessions >= 50 && totalSessions < 80`
   - **Action**: `multiplier = 1.2` (+20%)
   - **Example**: 60 sessions → 1.2x commission

9. **Volume Tier 4: Elite Volume** (Priority: 280)
   - **Type**: Multiplier rule
   - **Condition**: `totalSessions >= 80`
   - **Action**: `multiplier = 1.3` (+30%)
   - **Example**: 100 sessions → 1.3x commission

#### Category 3: Performance-Based Multiplier Rules (5 rules)

**Priority Range**: 290-330

10. **Rating Multiplier: Below Standard** (Priority: 290)
    - **Type**: Multiplier rule
    - **Condition**: `avgRating < 4.0`
    - **Action**: `multiplier = 0.9` (-10% penalty)
    - **Example**: 3.8★ → 0.9x commission

11. **Rating Multiplier: Standard** (Priority: 300)
    - **Type**: Multiplier rule
    - **Condition**: `avgRating >= 4.0 && avgRating < 4.5`
    - **Action**: `multiplier = 1.0` (baseline)
    - **Example**: 4.2★ → 1.0x

12. **Rating Multiplier: Good** (Priority: 310)
    - **Type**: Multiplier rule
    - **Condition**: `avgRating >= 4.5 && avgRating < 4.8`
    - **Action**: `multiplier = 1.05` (+5%)
    - **Example**: 4.6★ → 1.05x

13. **Rating Multiplier: Excellent** (Priority: 320)
    - **Type**: Multiplier rule
    - **Condition**: `avgRating >= 4.8 && avgRating < 4.95`
    - **Action**: `multiplier = 1.1` (+10%)
    - **Example**: 4.9★ → 1.1x

14. **Rating Multiplier: Perfect** (Priority: 330)
    - **Type**: Multiplier rule
    - **Condition**: `avgRating >= 4.95`
    - **Action**: `multiplier = 1.15` (+15%)
    - **Example**: 5.0★ → 1.15x

#### Optional Gate Rules (for future)

15. **Minimum Sessions Gate** (Priority: 195, disabled by default)
    - **Type**: Gate rule
    - **Condition**: `totalSessions < 5`
    - **Action**: `reject('Minimum 5 sessions required for commission')`
    - **Use case**: Prevent commission for trial employees

16. **Quality Gate** (Priority: 196, disabled by default)
    - **Type**: Gate rule
    - **Condition**: `avgRating < 3.5`
    - **Action**: `reject('Minimum 3.5★ rating required')`
    - **Use case**: Quality threshold enforcement

**Total**: 14 enabled rules + 2 disabled (16 total)

#### File Structure

```
src/lib/decision-engine/providers/commission/
├── rules/
│   ├── base-commission-rules.ts       (~400 lines - 5 rules)
│   ├── volume-tier-rules.ts           (~300 lines - 4 rules)
│   ├── performance-multiplier-rules.ts (~350 lines - 5 rules)
│   ├── gate-rules.ts                  (~200 lines - 2 rules)
│   └── index.ts                       (~50 lines - exports)
├── commission-provider.ts             (~600 lines - Step 2)
├── types.ts                           (~250 lines - Step 2)
└── index.ts                           (~20 lines)
```

**Deliverable**: ~1,600 lines of rules + types

---

### Step 2: Provider Implementation (Day 1-2 - 6-8 hours)

**Goal**: Build CommissionProvider orchestrating 14 rules

#### CommissionProvider Class Structure

```typescript
export class CommissionProvider extends Provider<
  CommissionDecisionInput,
  CommissionDecisionOutput
> {
  constructor(options?: { debug?: boolean });
  
  async evaluate(
    input: CommissionDecisionInput
  ): Promise<DecisionResult<CommissionDecisionOutput>>;
  
  // Private strategy routing
  private async evaluateBaseCommission(input, context): Promise<number>;
  private async evaluateVolumeTier(input, context): Promise<number>;
  private async evaluatePerformanceMultiplier(input, context): Promise<number>;
  private applyPositionBonus(commission, input): number;
  private applySeniorityBonus(commission, input): number;
  private applyManualAdjustments(commission, input): number;
}
```

#### Input Type

```typescript
interface CommissionDecisionInput {
  tenantId: string;
  employeeId: string;
  monthYear: string;
  
  // Service commission data
  serviceItems: Array<{
    subtotal: number;
    overrideType?: 'fixed' | 'percentage';
    overrideValue?: number;
  }>;
  
  // Product sales commission data
  productSales: Array<{
    salesAmount: number;
    overrideType?: 'fixed' | 'percentage';
    overrideValue?: number;
  }>;
  
  // Performance context
  totalSessions: number;
  completedSessions: number;
  avgRating: number;
  
  // Employee context
  positionTier: 'junior' | 'senior' | 'lead';
  hireDate?: Date | string;
  
  // Manual adjustments
  manualAdjustments?: Array<{
    adjustment_type: 'bonus' | 'deduction';
    amount: number;
    status: string;
  }>;
  
  // Configuration
  config: CommissionConfig;
}
```

#### Output Type

```typescript
interface CommissionDecisionOutput {
  // Base commissions
  serviceCommission: number;
  productSalesCommission: number;
  baseCommission: number; // service + product
  
  // Multipliers
  volumeMultiplier: number; // 1.0-1.3x
  performanceMultiplier: number; // 0.9-1.15x
  
  // Bonuses
  positionBonus: number;
  seniorityBonus: number;
  manualAdjustments: number;
  
  // Totals
  totalCommission: number; // base × multipliers + bonuses + adjustments
  
  // Metadata
  matchedRules: string[];
  confidence: number;
  appliedStrategies: {
    baseCommission: 'fixed' | 'percentage' | 'override';
    volumeTier: 'standard' | 'high' | 'premium' | 'elite';
    performanceTier: 'below' | 'standard' | 'good' | 'excellent' | 'perfect';
  };
  executionTimeMs: number;
}
```

#### Calculation Flow

```typescript
async evaluate(input: CommissionDecisionInput) {
  // Step 1: Calculate base commission
  const serviceCommission = await this.evaluateBaseCommission(
    input.serviceItems, input.config
  );
  const productCommission = await this.evaluateBaseCommission(
    input.productSales, input.config
  );
  const baseCommission = serviceCommission + productCommission;
  
  // Step 2: Apply volume tier multiplier
  const volumeMultiplier = await this.evaluateVolumeTier(
    input.totalSessions, input.config
  );
  
  // Step 3: Apply performance multiplier
  const performanceMultiplier = await this.evaluatePerformanceMultiplier(
    input.avgRating, input.config
  );
  
  // Step 4: Calculate adjusted commission
  const adjustedCommission = baseCommission 
    × volumeMultiplier 
    × performanceMultiplier;
  
  // Step 5: Add position bonus
  const positionBonus = this.applyPositionBonus(
    adjustedCommission, input.positionTier, input.config
  );
  
  // Step 6: Add seniority bonus
  const seniorityBonus = this.applySeniorityBonus(
    adjustedCommission, input.hireDate, input.config
  );
  
  // Step 7: Add manual adjustments
  const manualAdjustments = this.applyManualAdjustments(
    input.manualAdjustments
  );
  
  // Step 8: Calculate total
  const totalCommission = adjustedCommission 
    + positionBonus 
    + seniorityBonus 
    + manualAdjustments;
  
  return {
    serviceCommission,
    productSalesCommission: productCommission,
    baseCommission,
    volumeMultiplier,
    performanceMultiplier,
    positionBonus,
    seniorityBonus,
    manualAdjustments,
    totalCommission,
    // ... metadata
  };
}
```

**Deliverable**: ~850 lines (provider + types)

---

### Step 3: Tests (Day 2 - 4-6 hours)

**Goal**: Comprehensive test suite (target: 25+ tests)

#### Test Categories

**Unit Tests** (20 tests):
- Base Commission: Fixed (2), Percentage (2), Override (2) = 6 tests
- Volume Tiers: 4 tiers × 1 test = 4 tests
- Performance Multipliers: 5 tiers × 1 test = 5 tests
- Position Bonus: 3 tiers × 1 test = 3 tests
- Seniority Bonus: 2 edge cases = 2 tests

**Integration Tests** (5 tests):
- Standard employee (all components)
- High performer (volume + performance bonuses)
- Low performer (volume + performance penalties)
- Manual override (bypass rules)
- Complex scenario (all bonuses + adjustments)

**Edge Cases** (3 tests):
- Zero commission (no sales)
- Negative adjustments (deductions > commission)
- Boundary conditions (exactly at tier threshold)

**Performance Tests** (2 tests):
- Single evaluation (<2ms target)
- Bulk evaluation (100 evaluations <200ms)

**Total**: 30 tests

**Files**:
```
src/lib/decision-engine/providers/commission/__tests__/
├── commission-provider.unit.test.ts       (~600 lines, 20 tests)
├── commission-provider.integration.test.ts (~400 lines, 5 tests)
├── commission-provider.edge.test.ts       (~200 lines, 3 tests)
└── commission-provider.performance.test.ts (~150 lines, 2 tests)
```

**Deliverable**: ~1,350 lines, 30 tests

---

### Step 4: Integration & Documentation (Day 3 - 4-6 hours)

**Goal**: Integrate with salary engine + comprehensive docs

#### 4.1. Salary Engine Integration

**Adapter**: `src/adapters/commission-provider-adapter.ts` (~400 lines)

**Integration Points**:
1. Fetch service items from `booking_service_items`
2. Fetch product sales from `product_sales`
3. Fetch employee performance data (sessions, rating)
4. Map to CommissionDecisionInput
5. Call CommissionProvider.evaluate()
6. Map output to salary_records fields

**Feature Flag**: `FEATURE_COMMISSION_PROVIDER=true`

**Priority in Engine**:
```typescript
// Priority: Manual > Stored > CommissionProvider > Legacy
if (options?.FEATURE_COMMISSION_PROVIDER) {
  const commissionResult = await CommissionProviderAdapter.evaluate({
    tenantId, ktvId, monthYear, ...
  });
  
  serviceCommission = commissionResult.serviceCommission;
  productSalesCommission = commissionResult.productSalesCommission;
  positionBonus = commissionResult.positionBonus;
  seniorityBonus = commissionResult.seniorityBonus;
}
```

#### 4.2. Documentation

**Docs to Create**:

1. **Provider Documentation** (~1,500 lines)
   - `docs/providers/COMMISSION_PROVIDER.md`
   - Rule catalog (14 rules explained)
   - Calculation examples
   - Configuration guide
   - API reference

2. **Step Completion Reports** (~3,000 lines total)
   - `docs/TASK_6_COMMISSION_PROVIDER_STEP_1_COMPLETION.md`
   - `docs/TASK_6_COMMISSION_PROVIDER_STEP_2_COMPLETION.md`
   - `docs/TASK_6_COMMISSION_PROVIDER_STEP_3_COMPLETION.md`
   - `docs/TASK_6_COMMISSION_PROVIDER_STEP_4_COMPLETION.md`

3. **Usage Guide** (Vietnamese, ~800 lines)
   - `docs/COMMISSION_PROVIDER_USAGE_GUIDE.md`
   - How to enable CommissionProvider
   - Tenant configuration
   - Testing guide
   - Rollout plan

4. **Integration Test Results** (~800 lines)
   - `docs/TASK_6_COMMISSION_PROVIDER_INTEGRATION_TEST_RESULTS.md`
   - Test scenarios
   - Performance metrics
   - Architecture compliance

5. **Completion Report** (~1,000 lines)
   - `docs/TASK_6_COMMISSION_PROVIDER_COMPLETE.md`
   - Executive summary
   - Metrics
   - Lessons learned

**Total Docs**: ~7,100 lines

---

## 📊 DELIVERABLES SUMMARY

| Component | Files | Lines | Status |
|-----------|-------|-------|--------|
| Rules | 5 files | ~1,300 | Step 1 |
| Provider | 2 files | ~850 | Step 2 |
| Tests | 4 files | ~1,350 | Step 3 |
| Integration | 2 files | ~500 | Step 4 |
| Documentation | 6 files | ~7,100 | Step 4 |
| **TOTAL** | **19 files** | **~11,100 lines** | - |

---

## ✅ SUCCESS CRITERIA

### Technical
- ✅ 14 commission rules created and enabled
- ✅ CommissionProvider evaluates in <2ms avg
- ✅ 30+ tests passing (100% core logic coverage)
- ✅ Integration with salary engine via feature flag
- ✅ Architecture compliance (10/10 Commandments)

### Business
- ✅ All existing commission logic migrated
- ✅ No commission calculation errors
- ✅ Rules configurable via tenant config
- ✅ Audit trail for disputes
- ✅ Cache hit rate >85% (repeat queries)

### Documentation
- ✅ 7,100+ lines comprehensive docs
- ✅ Usage guide (Vietnamese)
- ✅ Integration test results
- ✅ Rollout plan
- ✅ Completion report

---

## 🎯 NEXT STEPS AFTER COMPLETION

**Option A**: Inventory Provider (Task 7)
- Cross-domain proof (beyond HR/Finance)
- Reorder decisions, stock allocation
- 2-3 days

**Option B**: Multi-Provider Validation Report (Task 8)
- **THE proof** of platform generality
- 4 Providers (Booking, Discount, Payroll, Commission) proven
- Investor-grade report
- 1 day

**Recommendation**: Complete Task 7 (Inventory) first to get 5 providers, then write comprehensive Multi-Provider Validation Report as major milestone.

---

**Plan created**: 2026-07-09  
**Estimate**: 2-3 days (16-22 hours)  
**Priority**: ⭐⭐⭐⭐⭐ HIGH  
**Status**: 📋 Ready to start Step 1
