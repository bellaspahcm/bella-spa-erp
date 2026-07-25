# Payroll Provider - Hướng Dẫn Sử Dụng

**Version**: 1.0  
**Status**: ✅ Production Ready  
**Date**: 2026-07-09  

---

## 🎯 MỤC ĐÍCH

**PayrollProvider** là một phần của Decision Engine Platform, thay thế logic tính lương hardcoded bằng hệ thống rule-based engine có thể cấu hình và kiểm tra được.

### Lợi ích
- ✅ **Dễ bảo trì**: Logic tập trung trong 17 rules, không phân tán khắp codebase
- ✅ **Dễ test**: Unit test từng rule độc lập
- ✅ **Linh hoạt**: Thay đổi rule không cần deploy code
- ✅ **Audit trail**: Ghi log mọi quyết định tính lương
- ✅ **Hiệu suất cao**: 0.11ms trung bình (nhanh hơn target 900 lần!)

---

## 🚀 CÁCH BẬT PAYROLLPROVIDER

### Option 1: Bật cho tenant cụ thể (khuyến nghị cho giai đoạn pilot)

```typescript
import { recalculateAndSaveSalaryRecordEngine } from '@/modules/hr-salary/actions/salary-recalculation-engine';

const result = await recalculateAndSaveSalaryRecordEngine({
  tenantId: 'bella-spa-hcm',  // Tenant ID
  ktvId: 'ktv-001',            // KTV ID
  monthYear: '2024-06',        // Tháng tính lương
  options: {
    FEATURE_PAYROLL_PROVIDER: true,  // ← BẬT PAYROLL PROVIDER
  },
});

console.log('Tổng lương:', result.totalSalary);
console.log('KPI bonus:', result.calculations?.kpiBonus);
console.log('Trừ chuyên cần:', result.calculations?.attendanceDeduction);
```

### Option 2: Bật toàn hệ thống (sau khi pilot thành công)

Sửa file `salary-recalculation-engine.ts`:

```typescript
// Dòng ~50
const usePayrollProvider = options?.FEATURE_PAYROLL_PROVIDER ?? true; // ← Đổi false thành true
```

---

## 📋 CÁC THÀNH PHẦN TÍNH LƯƠNG

PayrollProvider tính 4 thành phần:

### 1. KPI Bonus (Thưởng chỉ tiêu)
- **Rule**: Threshold (>= 30 ca) / Linear / Tier
- **Công thức Threshold**: `(actualSessions - target) × 50,000đ`
- **Ví dụ**: 35 ca → (35-30) × 50k = **250,000đ** (nếu dùng linear)

### 2. Rating Bonus (Thưởng đánh giá)
- **Rule**: Threshold (>= 4.5★) / Linear / Tier
- **Công thức Threshold**: Đạt 4.5★ = **50,000đ** cố định
- **Ví dụ**: 4.8★ → **50,000đ**

### 3. Session Commission (Hoa hồng ca)
- **Rule**: Fixed (120k/ca) / Tier / Percentage / Service-based
- **Công thức Fixed**: `sessions × 120,000đ`
- **Ví dụ**: 35 ca × 120k = **4,200,000đ**
- **Lưu ý**: Có gate check (cần tối thiểu 5 ca mới được tính)

### 4. Attendance Deduction (Trừ chuyên cần)
- **Rule**: Late (50k/lần) / Absent (200k/lần) / Combined
- **Công thức Combined**: `(late × 50k) + (absent × 200k)`
- **Ví dụ**: 2 đi muộn + 0 vắng = **100,000đ** bị trừ

---

## 🎛️ CHIẾN LƯỢC TÍNH TOÁN (Strategy)

Mỗi thành phần có 3 chiến lược:

| Chiến lược | Mô tả | Dùng khi nào |
|-----------|-------|--------------|
| **Threshold** | Đạt ngưỡng → Thưởng cố định | KTV có target rõ ràng (30 ca, 4.5★) |
| **Linear** | Tính tỷ lệ theo giá trị thực | Muốn khuyến khích cải thiện liên tục |
| **Tier** | Chia bậc thưởng (1-3 tiers) | Phân biệt rõ cấp độ performance |

### Ví dụ: KPI Strategy

**Threshold** (hiện tại):
- < 30 ca → 0đ
- >= 30 ca → 1,000,000đ cố định

**Linear**:
- 25 ca → 500,000đ (tỷ lệ với target)
- 30 ca → 1,000,000đ
- 40 ca → 2,000,000đ

**Tier**:
- 25-29 ca → 500,000đ (Tier 1)
- 30-34 ca → 1,000,000đ (Tier 2)
- 35+ ca → 2,000,000đ (Tier 3)

---

## ⚙️ CẤU HÌNH TENANT

Các tham số tính lương lấy từ `tenant_config`:

```typescript
interface PayrollConfig {
  // KPI
  kpiTargetSessions: 30;         // Chỉ tiêu ca (threshold)
  kpiMaxBonus: 1_000_000;        // Thưởng tối đa (threshold)
  kpiPerSessionBonus: 50_000;    // Thưởng/ca vượt chỉ tiêu (linear)
  
  // Rating
  ratingThreshold: 4.5;          // Ngưỡng rating
  ratingBaseBonus: 50_000;       // Thưởng cố định (threshold)
  ratingMaxBonus: 200_000;       // Thưởng tối đa (linear)
  
  // Commission
  commissionPerSession: 120_000; // Hoa hồng cố định/ca (fixed)
  commissionMinSessions: 5;      // Gate: Tối thiểu X ca
  
  // Attendance
  lateDeduction: 50_000;         // Trừ đi muộn/lần
  absentDeduction: 200_000;      // Trừ vắng mặt/lần
  
  // Strategy
  kpiStrategy: 'threshold';      // 'threshold' | 'linear' | 'tier'
  ratingStrategy: 'threshold';
  commissionStrategy: 'fixed';
  attendanceStrategy: 'combined';
}
```

### Cách thay đổi config (qua UI hoặc Supabase):

```sql
-- Supabase SQL Editor
UPDATE tenants
SET config = jsonb_set(
  config,
  '{payroll,kpiTargetSessions}',
  '35'::jsonb
)
WHERE id = 'bella-spa-hcm';
```

---

## 🧪 TEST TRONG MÔI TRƯỜNG DEV

### Test 1: Tính lương thử (không lưu database)

```typescript
import { PayrollProvider } from '@/lib/decision-engine/providers/payroll';

const provider = new PayrollProvider();

const input = {
  tenantId: 'test-tenant',
  employeeId: 'ktv-001',
  monthYear: '2024-06',
  
  // Dữ liệu KTV
  sessions: 35,
  avgRating: 4.8,
  completedSessions: 35,
  lateDays: 2,
  absentDays: 0,
  
  // Config
  config: {
    kpiTargetSessions: 30,
    kpiMaxBonus: 1_000_000,
    ratingThreshold: 4.5,
    ratingBaseBonus: 50_000,
    commissionPerSession: 120_000,
    commissionMinSessions: 5,
    lateDeduction: 50_000,
    absentDeduction: 200_000,
    
    kpiStrategy: 'threshold',
    ratingStrategy: 'threshold',
    commissionStrategy: 'fixed',
    attendanceStrategy: 'combined',
  },
};

const result = await provider.evaluateDecision(input);

console.log('KPI Bonus:', result.kpiBonus);               // 1,000,000đ
console.log('Rating Bonus:', result.ratingBonus);         // 50,000đ
console.log('Commission:', result.sessionCommission);     // 4,200,000đ
console.log('Deduction:', result.attendanceDeduction);    // -100,000đ
console.log('NET:', result.netAdjustment);                // 5,150,000đ
```

### Test 2: Chạy script test có sẵn

```bash
# Test PayrollProvider trực tiếp
npx tsx scripts/test-payroll-provider-integration.ts

# Expected output:
# ✅ All checks PASSED!
# ⚡ Performance: 0.11ms avg
```

---

## 📊 KẾT QUẢ TÍNH LƯƠNG

### Cấu trúc output

```typescript
interface PayrollDecisionOutput {
  // Thưởng
  kpiBonus: number;              // Thưởng KPI
  ratingBonus: number;           // Thưởng rating
  sessionCommission: number;     // Hoa hồng ca
  
  // Trừ
  attendanceDeduction: number;   // Trừ chuyên cần (số âm)
  
  // Tổng
  totalBonuses: number;          // Tổng thưởng
  totalDeductions: number;       // Tổng trừ (số dương)
  netAdjustment: number;         // Ròng = thưởng - trừ
  
  // Metadata
  matchedRules: string[];        // Rules đã match
  confidence: number;            // Độ tin cậy (0-1)
  appliedStrategies: {           // Strategies đã dùng
    kpi: 'threshold';
    rating: 'threshold';
    commission: 'fixed';
    attendance: 'combined';
  };
  
  // Debug
  executionTimeMs: number;       // Thời gian tính (ms)
}
```

### Ví dụ kết quả thực tế

```json
{
  "kpiBonus": 1000000,
  "ratingBonus": 50000,
  "sessionCommission": 4200000,
  "attendanceDeduction": -100000,
  "totalBonuses": 5250000,
  "totalDeductions": 100000,
  "netAdjustment": 5150000,
  "matchedRules": [
    "payroll_kpi_threshold_standard",
    "payroll_rating_threshold",
    "payroll_commission_fixed",
    "payroll_attendance_combined"
  ],
  "confidence": 1,
  "appliedStrategies": {
    "kpi": "threshold",
    "rating": "threshold",
    "commission": "fixed",
    "attendance": "combined"
  },
  "executionTimeMs": 0.11
}
```

---

## 🔍 DEBUGGING & TROUBLESHOOTING

### Vấn đề: KPI Bonus = 0 (mặc dù đạt chỉ tiêu)

**Nguyên nhân**: Config sai hoặc dữ liệu đầu vào thiếu

**Cách fix**:
```typescript
// Check 1: Verify config
console.log('Target sessions:', input.config.kpiTargetSessions); // Phải <= actual
console.log('Actual sessions:', input.sessions);                 // Phải >= target

// Check 2: Verify strategy
console.log('KPI Strategy:', input.config.kpiStrategy); // 'threshold' | 'linear' | 'tier'

// Check 3: Test rule trực tiếp
import { payrollKpiThresholdStandard } from '@/lib/decision-engine/providers/payroll/rules';
const context = createRuleContext(input);
const match = payrollKpiThresholdStandard.condition(context);
console.log('Rule matched?', match); // Phải true
```

### Vấn đề: Commission = 0 (mặc dù có làm ca)

**Nguyên nhân**: Gate check (minSessions) không đạt

**Cách fix**:
```typescript
// Check gate
console.log('Completed sessions:', input.completedSessions);     // Phải >= 5
console.log('Min sessions:', input.config.commissionMinSessions); // Default: 5

// Nếu muốn tắt gate cho tenant test:
await supabase
  .from('tenants')
  .update({
    config: {
      ...currentConfig,
      payroll: {
        ...currentConfig.payroll,
        commissionMinSessions: 0, // ← Tắt gate
      },
    },
  })
  .eq('id', tenantId);
```

### Vấn đề: Số liệu sai lệch so với tính tay

**Nguyên nhân**: Strategy không khớp với expectation

**Cách fix**:
```typescript
// Xem strategy đang dùng
console.log('Applied strategies:', result.appliedStrategies);

// So sánh với config
console.log('Config strategies:', {
  kpi: input.config.kpiStrategy,
  rating: input.config.ratingStrategy,
  commission: input.config.commissionStrategy,
  attendance: input.config.attendanceStrategy,
});

// Nếu khác nhau → rule routing logic có bug
// Report to dev team với debug info trên
```

---

## 🚀 ROLLOUT PLAN (Khuyến nghị)

### Giai đoạn 1: Pilot (1-2 tuần)
- Chọn 1 tenant thử nghiệm (ví dụ: Bella Spa HCM)
- Bật `FEATURE_PAYROLL_PROVIDER=true` cho tenant đó
- Chạy song song với legacy (so sánh kết quả)
- Thu thập feedback từ kế toán

### Giai đoạn 2: VIP Tenants (2-4 tuần)
- Bật cho tất cả tenants gói Enterprise
- Monitor performance & error rate
- Fine-tune config nếu cần

### Giai đoạn 3: Toàn hệ thống (sau 1-2 tháng)
- Đổi default: `FEATURE_PAYROLL_PROVIDER=true`
- Tắt legacy code (archive)
- Cập nhật docs & training

---

## 📈 MONITORING (Sau khi deploy)

### Metrics cần theo dõi

```typescript
// 1. Execution Time
// Target: <100ms
// Current avg: 0.11ms
metrics.histogram('payroll_provider.execution_time_ms', executionTimeMs);

// 2. Error Rate
// Target: <0.1%
metrics.increment('payroll_provider.errors', { errorType });

// 3. Rule Matches
// Verify rules đang trigger đúng
metrics.increment('payroll_provider.rule_matched', { ruleName });

// 4. Strategy Distribution
// Verify tenants dùng strategies nào
metrics.increment('payroll_provider.strategy_used', { component, strategy });
```

### Alerts cần setup

```yaml
# Alert 1: High execution time
alert: PayrollProviderSlow
condition: avg(execution_time_ms) > 100ms for 5 minutes
action: Notify dev team

# Alert 2: Calculation error
alert: PayrollProviderError
condition: error_rate > 0.1% for 1 minute
action: Page on-call engineer

# Alert 3: Unexpected zero bonus
alert: PayrollProviderZeroBonus
condition: kpi_bonus = 0 for employees with sessions > target
action: Check config & rule logic
```

---

## 📚 TÀI LIỆU THAM KHẢO

- **Architecture**: `docs/DECISION_ENGINE_PLATFORM_ARCHITECTURE.md`
- **Rules**: `docs/providers/PAYROLL_PROVIDER.md` (section: Rules Catalog)
- **Integration**: `docs/TASK_5_PAYROLL_PROVIDER_INTEGRATION_SUMMARY.md`
- **Test Results**: `docs/TASK_5_PAYROLL_PROVIDER_INTEGRATION_TEST_RESULTS.md`
- **API**: Source code có JSDoc comments đầy đủ

---

## 🆘 HỖ TRỢ

Nếu gặp vấn đề:

1. **Check logs**: Xem `executionTimeMs`, `matchedRules`, `confidence` trong output
2. **Test locally**: Chạy `npx tsx scripts/test-payroll-provider-integration.ts`
3. **Compare với legacy**: Chạy cả 2 versions (feature flag ON/OFF), so sánh kết quả
4. **Contact dev team**: Cung cấp:
   - Tenant ID
   - KTV ID
   - Month
   - Input data (sessions, rating, attendance)
   - Expected vs Actual output
   - Logs/errors

---

**Cập nhật lần cuối**: 2026-07-09  
**Version**: 1.0  
**Status**: ✅ Production Ready
