# Task 5: Payroll Provider - Step 3 Testing & Integration Plan

**Date**: 2026-07-09  
**Status**: 📋 PLANNING  
**Estimated Duration**: 6-9 giờ  

---

## 🎯 MỤC TIÊU BƯỚC 3

1. ✅ Tạo bộ test toàn diện (unit + integration)
2. ✅ Tích hợp PayrollProvider vào hệ thống hiện tại
3. ✅ Tài liệu hướng dẫn sử dụng
4. ✅ Performance benchmarking
5. ✅ Migration guide (old → new provider)

---

## 📊 CẤU TRÚC TEST (70+ test cases)

### 1. Unit Tests - Calculation Methods (28 tests)

#### 1.1 KPI Bonus Calculation (9 tests)
```typescript
describe('calculateKPIBonus', () => {
  describe('Threshold Strategy', () => {
    it('should return bonus when target met', () => {
      // sessions=35, target=30, bonus=1M → expect 1M
    });
    
    it('should return 0 when target not met', () => {
      // sessions=25, target=30 → expect 0
    });
    
    it('should handle exact target match', () => {
      // sessions=30, target=30 → expect 1M
    });
  });

  describe('Linear Strategy', () => {
    it('should calculate progressive bonus', () => {
      // sessions=35, baseline=20, rate=50k → expect 750k
    });
    
    it('should apply max cap', () => {
      // sessions=50, baseline=20, rate=50k, max=2M → expect 2M (not 1.5M)
    });
    
    it('should return 0 when below baseline', () => {
      // sessions=15, baseline=20 → expect 0
    });
  });

  describe('Tier Strategy', () => {
    it('should match tier 1 (0-20)', () => {
      // sessions=15 → expect 0
    });
    
    it('should match tier 2 (21-30)', () => {
      // sessions=25 → expect 500k
    });
    
    it('should match tier 3 (31+)', () => {
      // sessions=40 → expect 1.5M
    });
  });
});
```

#### 1.2 Attendance Deduction Calculation (9 tests)
```typescript
describe('calculateAttendanceDeduction', () => {
  describe('Late Deduction Strategy', () => {
    it('should calculate late penalty', () => {
      // lateDays=3, penalty=50k → expect -150k
    });
    
    it('should return 0 when no late', () => {
      // lateDays=0 → expect 0
    });
    
    it('should handle custom penalty rate', () => {
      // lateDays=2, penalty=100k → expect -200k
    });
  });

  describe('Absent Deduction Strategy', () => {
    it('should calculate absent penalty', () => {
      // absentDays=2, penalty=200k → expect -400k
    });
    
    it('should return 0 when no absent', () => {
      // absentDays=0 → expect 0
    });
    
    it('should handle custom penalty rate', () => {
      // absentDays=1, penalty=300k → expect -300k
    });
  });

  describe('Combined Strategy', () => {
    it('should calculate both penalties', () => {
      // lateDays=2, absentDays=1, latePenalty=50k, absentPenalty=200k
      // → expect -300k
    });
    
    it('should handle late only', () => {
      // lateDays=3, absentDays=0 → expect -150k
    });
    
    it('should handle absent only', () => {
      // lateDays=0, absentDays=2 → expect -400k
    });
  });
});
```

#### 1.3 Rating Bonus Calculation (6 tests)
```typescript
describe('calculateRatingBonus', () => {
  describe('Threshold Strategy', () => {
    it('should return bonus when rating met', () => {
      // rating=4.8, min=4.5, bonus=50k → expect 50k
    });
    
    it('should return 0 when rating below', () => {
      // rating=4.2, min=4.5 → expect 0
    });
  });

  describe('Linear Strategy', () => {
    it('should calculate progressive bonus', () => {
      // rating=4.7, baseline=4.0, rate=100k → expect 70k
    });
    
    it('should apply max cap', () => {
      // rating=5.0, baseline=4.0, rate=100k, max=300k → expect 300k
    });
  });

  describe('Tier Strategy', () => {
    it('should match correct tier', () => {
      // rating=4.9 → Tier 3 (4.8-5.0) → expect 150k
    });
    
    it('should handle tier boundaries', () => {
      // rating=4.5 → Tier 2 (4.5-4.7) → expect 50k
    });
  });
});
```

#### 1.4 Commission Calculation (4 tests)
```typescript
describe('calculateCommission', () => {
  it('should calculate fixed commission', () => {
    // sessions=30, rate=120k → expect 3.6M
  });
  
  it('should calculate tier commission', () => {
    // sessions=25 → Tier 2 (11-20) → 25 × 120k = 3M
  });
  
  it('should calculate percentage commission', () => {
    // revenue=10M, percentage=15% → expect 1.5M
  });
  
  it('should calculate service-based commission', () => {
    // Massage: 10 × 150k, Facial: 5 × 100k → expect 2M
  });
});
```

### 2. Integration Tests - Provider Evaluation (20 tests)

#### 2.1 KPI Component (4 tests)
```typescript
describe('PayrollProvider - KPI Component', () => {
  it('should evaluate threshold strategy correctly', async () => {
    // Full input → expect correct KPI component
  });
  
  it('should handle disabled KPI', async () => {
    // config.kpi.enabled=false → expect amount=0
  });
  
  it('should apply manual override', async () => {
    // override.kpiBonus=2M → expect amount=2M
  });
  
  it('should include matched rules in output', async () => {
    // expect matchedRules to contain 'payroll-kpi-threshold-standard'
  });
});
```

#### 2.2 Attendance Component (5 tests)
```typescript
describe('PayrollProvider - Attendance Component', () => {
  it('should evaluate combined strategy correctly', async () => {
    // lateDays=2, absentDays=1 → expect -300k
  });
  
  it('should evaluate late-only strategy', async () => {
    // strategy='late_deduction', lateDays=3 → expect -150k
  });
  
  it('should evaluate absent-only strategy', async () => {
    // strategy='absent_deduction', absentDays=2 → expect -400k
  });
  
  it('should return 0 when no violations', async () => {
    // lateDays=0, absentDays=0 → expect amount=0
  });
  
  it('should handle disabled attendance', async () => {
    // config.attendance.enabled=false → expect amount=0
  });
});
```

#### 2.3 Rating Component (4 tests)
```typescript
describe('PayrollProvider - Rating Component', () => {
  it('should evaluate threshold strategy correctly', async () => {
    // rating=4.8, min=4.5 → expect 50k
  });
  
  it('should handle below threshold', async () => {
    // rating=4.2, min=4.5 → expect 0
  });
  
  it('should handle no rating data', async () => {
    // avgRating=0 → expect amount=0
  });
  
  it('should handle disabled rating', async () => {
    // config.rating.enabled=false → expect amount=0
  });
});
```

#### 2.4 Commission Component (7 tests)
```typescript
describe('PayrollProvider - Commission Component', () => {
  it('should evaluate fixed strategy correctly', async () => {
    // sessions=30, rate=120k → expect 3.6M
  });
  
  it('should enforce gate (minSessions)', async () => {
    // sessions=3, minSessions=5 → expect amount=0, reason includes 'Minimum'
  });
  
  it('should pass gate when met', async () => {
    // sessions=7, minSessions=5 → expect commission calculated
  });
  
  it('should handle tier strategy', async () => {
    // sessions=25 → Tier 2 rate → expect correct amount
  });
  
  it('should handle percentage strategy', async () => {
    // revenue=10M, percentage=15% → expect 1.5M
  });
  
  it('should handle service-based strategy', async () => {
    // serviceTypes breakdown → expect aggregated commission
  });
  
  it('should handle disabled commission', async () => {
    // config.commission.enabled=false → expect amount=0
  });
});
```

### 3. Edge Case Tests (12 tests)

```typescript
describe('PayrollProvider - Edge Cases', () => {
  it('should handle zero sessions', async () => {
    // sessions=0 → all bonuses=0, no commission
  });
  
  it('should handle negative values (invalid input)', async () => {
    // sessions=-5 → should reject or clamp to 0
  });
  
  it('should handle missing config', async () => {
    // config=undefined → should use defaults or disable
  });
  
  it('should handle empty config object', async () => {
    // config={} → all components disabled
  });
  
  it('should handle all components disabled', async () => {
    // all enabled=false → totalBonuses=0, totalDeductions=0
  });
  
  it('should handle extremely high values', async () => {
    // sessions=999, rating=5.0 → verify no overflow
  });
  
  it('should handle fractional sessions', async () => {
    // sessions=35.5 → should round or handle correctly
  });
  
  it('should handle fractional ratings', async () => {
    // rating=4.75 → should handle decimal precision
  });
  
  it('should handle all manual overrides', async () => {
    // all 4 components overridden → use override values
  });
  
  it('should handle partial overrides', async () => {
    // only KPI overridden → calculate others normally
  });
  
  it('should handle concurrent evaluations', async () => {
    // 10 parallel evaluations → all should succeed
  });
  
  it('should maintain statelessness', async () => {
    // eval 1, eval 2 → should not interfere with each other
  });
});
```

### 4. Performance Tests (6 tests)

```typescript
describe('PayrollProvider - Performance', () => {
  it('should complete single evaluation under 100ms', async () => {
    // measure executionTime → expect <100ms
  });
  
  it('should handle 100 sequential evaluations efficiently', async () => {
    // 100 evals → total time <10s (avg 100ms)
  });
  
  it('should handle 10 parallel evaluations', async () => {
    // Promise.all(10 evals) → all succeed
  });
  
  it('should not leak memory over 1000 evaluations', async () => {
    // measure heap before/after → expect stable
  });
  
  it('should cache rule policies efficiently', async () => {
    // verify policies created once, reused
  });
  
  it('should have consistent execution time', async () => {
    // 10 evals → std deviation <20ms
  });
});
```

### 5. Multi-Tenant Isolation Tests (4 tests)

```typescript
describe('PayrollProvider - Multi-Tenant Isolation', () => {
  it('should isolate tenant A from tenant B', async () => {
    // Tenant A: threshold, Tenant B: tier
    // Both should use their own config
  });
  
  it('should handle different strategies per tenant', async () => {
    // Verify strategy routing works independently
  });
  
  it('should not share state between tenants', async () => {
    // Eval for A, eval for B → verify independent
  });
  
  it('should handle tenant config updates', async () => {
    // Update config → new evals use new config
  });
});
```

---

## 🔗 TÍCH HỢP VỚI HỆ THỐNG HIỆN TẠI

### Kiến trúc hiện tại
```
recalculateAndSaveSalaryRecord()
  ├─ KPIProvider.evaluate()
  ├─ AttendanceProvider.evaluate()
  ├─ RatingProvider.evaluate()
  └─ CommissionProvider.evaluate()
  → Aggregate → Save to salary_records
```

### Kiến trúc mới (sau tích hợp)
```
recalculateAndSaveSalaryRecord()
  └─ PayrollProvider.evaluate()  ← Unified provider
     ├─ KPI component
     ├─ Attendance component
     ├─ Rating component
     └─ Commission component
  → Map to salary_records schema → Save
```

### Migration Steps

#### Step 1: Create Adapter
```typescript
// src/adapters/payroll-provider-adapter.ts
import { PayrollProvider } from '@/lib/decision-engine/providers/payroll';
import type { PayrollDecisionInput } from '@/lib/decision-engine/providers/payroll';

export class PayrollProviderAdapter {
  private provider: PayrollProvider;

  constructor() {
    this.provider = new PayrollProvider();
  }

  /**
   * Convert existing salary calculation context to PayrollDecisionInput
   */
  async calculateSalaryComponents(
    tenantId: string,
    employeeId: string,
    monthYear: string,
    context: {
      sessions: Array<any>;
      attendance: Array<any>;
      employee: any;
      config: any;
    }
  ) {
    // 1. Aggregate sessions data
    const sessionsData = this.aggregateSessions(context.sessions);
    
    // 2. Aggregate attendance data
    const attendanceData = this.aggregateAttendance(context.attendance);
    
    // 3. Build PayrollDecisionInput
    const input: PayrollDecisionInput = {
      tenantId,
      employeeId,
      monthYear,
      sessions: sessionsData,
      attendance: attendanceData,
      employee: {
        baseSalary: context.employee.base_salary,
        position: context.employee.position,
        yearsOfService: context.employee.years_of_service,
      },
      config: this.mapConfig(context.config),
    };
    
    // 4. Evaluate via PayrollProvider
    const result = await this.provider.evaluate(input);
    
    // 5. Map to salary_records schema
    return {
      kpi_bonus: result.components.kpiBonus.amount,
      violations_deduction: result.components.attendanceDeduction.amount,
      rating_bonus: result.components.ratingBonus.amount,
      session_bonus: result.components.sessionCommission.amount,
      total_bonuses: result.totalBonuses,
      total_deductions: result.totalDeductions,
      net_adjustment: result.netAdjustment,
      calculation_metadata: {
        provider: result.provider,
        matchedRules: result.matchedRules,
        executionTime: result.executionTime,
        confidence: result.confidence,
      },
    };
  }
  
  private aggregateSessions(sessions: Array<any>) {
    // Implementation...
  }
  
  private aggregateAttendance(attendance: Array<any>) {
    // Implementation...
  }
  
  private mapConfig(config: any) {
    // Implementation...
  }
}
```

#### Step 2: Update Salary Recalculation Engine
```typescript
// src/modules/hr-salary/actions/salary-recalculation-engine.ts

import { PayrollProviderAdapter } from '@/adapters/payroll-provider-adapter';

// BEFORE (old approach)
async function recalculateAndSaveSalaryRecord(params) {
  // ... load data ...
  
  const kpiBonus = await new KPIProvider().evaluate(context);
  const attendance = await new AttendanceProvider().evaluate(context);
  const rating = await new RatingProvider().evaluate(context);
  const commission = await new CommissionProvider().evaluate(context);
  
  const totalSalary = baseSalary + kpiBonus + rating + commission + attendance;
  
  // ... save ...
}

// AFTER (new approach)
async function recalculateAndSaveSalaryRecord(params) {
  // ... load data ...
  
  const adapter = new PayrollProviderAdapter();
  const components = await adapter.calculateSalaryComponents(
    tenantId,
    employeeId,
    monthYear,
    context
  );
  
  const totalSalary = baseSalary + components.net_adjustment;
  
  // ... save with detailed breakdown ...
  await supabase.from('salary_records').upsert({
    ...components,
    total_salary: totalSalary,
  });
}
```

#### Step 3: Feature Flag (Gradual Rollout)
```typescript
// Enable new provider via feature flag
const USE_DECISION_ENGINE_PAYROLL = process.env.FEATURE_PAYROLL_PROVIDER === 'true';

if (USE_DECISION_ENGINE_PAYROLL) {
  // Use PayrollProvider
  const adapter = new PayrollProviderAdapter();
  components = await adapter.calculateSalaryComponents(...);
} else {
  // Use legacy providers
  const kpiBonus = await new KPIProvider().evaluate(...);
  // ... etc
}
```

---

## 📚 TÀI LIỆU HƯỚNG DẪN

### 1. Usage Guide
```markdown
# PayrollProvider Usage Guide

## Quick Start
\`\`\`typescript
import { PayrollProvider } from '@/lib/decision-engine/providers/payroll';

const provider = new PayrollProvider();

const result = await provider.evaluate({
  tenantId: 'bella-spa-vn',
  employeeId: 'emp-123',
  monthYear: '2026-07',
  sessions: { count: 35, avgRating: 4.8, totalRevenue: 15000000 },
  attendance: { lateDays: 2, absentDays: 0, workingDays: 26 },
  employee: { baseSalary: 8000000 },
  config: { /* tenant config */ },
});

console.log(result.netAdjustment); // +5,150,000đ
\`\`\`

## Configuration Examples
[Full examples for all strategies]
```

### 2. Migration Guide
```markdown
# Migration Guide: Legacy Providers → PayrollProvider

## Phase 1: Parallel Run (Week 1-2)
- Run both old and new providers
- Compare results, log discrepancies
- Fix any calculation differences

## Phase 2: Feature Flag (Week 3-4)
- Enable PayrollProvider for 10% of tenants
- Monitor performance and accuracy
- Collect feedback

## Phase 3: Full Rollout (Week 5-6)
- Enable for all tenants
- Deprecate old providers
- Update documentation
```

### 3. Troubleshooting Guide
```markdown
# Troubleshooting PayrollProvider

## Issue: Commission gate always rejects
- Check: config.commission.params.minSessions
- Verify: sessions.count >= minSessions
- Solution: Lower minSessions or increase sessions

## Issue: KPI bonus not calculated
- Check: config.kpi.enabled = true
- Check: sessions.count >= target
- Verify: strategy matches config
```

---

## ⏱️ THỜI GIAN ƯỚC TÍNH

| Task | Time | Status |
|------|------|--------|
| Test suite setup | 1h | 📋 TODO |
| Unit tests (28 cases) | 2h | 📋 TODO |
| Integration tests (20 cases) | 2h | 📋 TODO |
| Edge case tests (12 cases) | 1h | 📋 TODO |
| Performance tests (6 cases) | 1h | 📋 TODO |
| Multi-tenant tests (4 cases) | 30min | 📋 TODO |
| Adapter implementation | 2h | 📋 TODO |
| Integration with engine | 1h | 📋 TODO |
| Documentation | 1-2h | 📋 TODO |
| **Total** | **11-12h** | **PLANNED** |

---

## ✅ SUCCESS CRITERIA

- [ ] All 70+ tests passing
- [ ] Code coverage >90%
- [ ] Performance <100ms per evaluation
- [ ] Zero calculation discrepancies vs old providers
- [ ] Documentation complete
- [ ] Integration adapter working
- [ ] Feature flag implemented
- [ ] Migration guide ready

---

**Status**: 📋 PLAN COMPLETE, READY FOR IMPLEMENTATION  
**Next**: Begin test implementation or proceed to summary
