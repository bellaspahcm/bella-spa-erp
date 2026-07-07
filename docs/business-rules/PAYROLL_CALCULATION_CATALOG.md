# Payroll Calculation Catalog v0.3 (Final)

Danh mục công thức tính lương của Bella Spa ERP theo kiến trúc **Pure Assembly**.

---

## Kiến trúc Pure Assembly

```
┌────────────────────────────────────────────────────────────┐
│ BUSINESS POLICIES (Domain Logic)                          │
│ Mỗi policy sinh ra Standardized Payroll Items             │
├────────────────────────────────────────────────────────────┤
│ - Attendance Policy    → working_days, penalties           │
│ - Commission Policy    → service/product commissions       │
│ - Rating Policy        → rating bonus                      │
│ - KPI Policy           → kpi bonus                         │
│ - Seniority Policy     → seniority benefit                 │
│ - Holiday Policy       → holiday bonus                     │
│ - Benefit Policy       → meal, transport, phone allowance  │
│ - Manual Adjustments   → admin bonus/deductions            │
└────────────────────────────────────────────────────────────┘
                              ↓
                 Standardized Payroll Items
              (Uniform format: id, type, amount, taxable)
                              ↓
┌────────────────────────────────────────────────────────────┐
│ PAYROLL ASSEMBLY (Pure Aggregation)                       │
│ Không biết business, chỉ cộng earnings và deductions      │
├────────────────────────────────────────────────────────────┤
│ base_salary = contract_salary ÷ standard_days × working_days│
│ gross = SUM(earnings[])                                    │
│ deduction = SUM(deductions[])                              │
│ taxable_income = gross - deduction                         │
└────────────────────────────────────────────────────────────┘
                              ↓
┌────────────────────────────────────────────────────────────┐
│ TAX POLICY (Domain Logic)                                 │
│ Tính thuế TNCN theo luật Việt Nam                         │
├────────────────────────────────────────────────────────────┤
│ tax = calculate_progressive_tax(taxable_income)           │
└────────────────────────────────────────────────────────────┘
                              ↓
┌────────────────────────────────────────────────────────────┐
│ INSURANCE POLICY (Domain Logic)                           │
│ Tính BHXH/BHYT/BHTN theo luật Việt Nam                    │
├────────────────────────────────────────────────────────────┤
│ insurance_employee = insurance_salary × rates[]           │
│ insurance_employer = insurance_salary × employer_rates[]  │
└────────────────────────────────────────────────────────────┘
                              ↓
                         Net Salary
              net = gross - deduction - tax - insurance
```

---

## Standardized Payroll Item Format

Tất cả business policies phải trả về cùng một format chuẩn:

```typescript
interface PayrollItem {
  id: string;                    // Unique identifier (e.g., "rating_bonus", "commission_service")
  type: 'earning' | 'deduction'; // Earning tăng lương, Deduction giảm lương
  amount: number;                // Số tiền (VND)
  taxable: boolean;              // Có tính thuế TNCN không?
  insuranceable: boolean;        // Có tính vào lương đóng bảo hiểm không?
  description: string;           // Mô tả nghiệp vụ (hiển thị cho user)
  policy_source: string;         // Policy nào sinh ra (e.g., "RatingPolicy", "CommissionPolicy")
}
```

**Ví dụ các PayrollItem từ policies:**

```typescript
// From Rating Policy
{
  id: "rating_bonus",
  type: "earning",
  amount: 465000,
  taxable: true,
  insuranceable: false,
  description: "Thưởng đánh giá 4.7 sao (15.5 ca × 30,000đ)",
  policy_source: "RatingPolicy"
}

// From Commission Policy
{
  id: "commission_service",
  type: "earning",
  amount: 2350000,
  taxable: true,
  insuranceable: false,
  description: "Hoa hồng dịch vụ tháng 6/2026",
  policy_source: "CommissionPolicy"
}

// From Attendance Policy
{
  id: "attendance_penalty",
  type: "deduction",
  amount: 300000,
  taxable: false,
  insuranceable: false,
  description: "Phạt đi muộn 2 ngày + vắng 1 ngày",
  policy_source: "AttendancePolicy"
}

// From Holiday Policy
{
  id: "holiday_ot",
  type: "earning",
  amount: 800000,
  taxable: true,
  insuranceable: false,
  description: "Làm thêm ngày lễ 30/4 (200% OT)",
  policy_source: "HolidayPolicy"
}
```

**Lợi ích:**
- HR thêm "Project Bonus" → KHÔNG sửa Payroll (chỉ thêm PayrollItem)
- Đổi commission rule → KHÔNG sửa Payroll (policy trả về cùng format)
- Payroll UI render động từ `description` field

---

## PAYROLL ASSEMBLY (Pure Aggregation)

Payroll chỉ làm 3 việc: tính base salary, aggregate items, prepare for tax/insurance.

### PA01 - Base Salary Calculation

**Business:**  
Lương cơ bản theo ngày công (pro-rata).

**Formula:**
```
base_salary = (contract_salary ÷ standard_days) × working_days
```

**Input:**
- `contract_salary`: Lương hợp đồng (VD: 6,000,000đ)
- `standard_days`: Số ngày chuẩn (26 ngày)
- `working_days`: Số ngày làm việc thực tế *(từ Attendance Policy)*

**Output:**
- `base_salary`: Lương cơ bản theo tỷ lệ

**Note:** Payroll KHÔNG tính `working_days`. Attendance Policy tính và trả về.

---

### PA02 - Gross Salary Aggregation

**Business:**  
Tổng thu nhập = base salary + tất cả earnings.

**Formula:**
```
gross = base_salary + SUM(earnings[].amount)
```

**Input:**
- `base_salary`: Từ PA01
- `earnings[]`: Mảng PayrollItem có `type = 'earning'`

**Output:**
- `gross`: Tổng thu nhập trước thuế và bảo hiểm

**Note:** Payroll KHÔNG biết earnings từ policy nào. Chỉ aggregate.

---

### PA03 - Deduction Aggregation

**Business:**  
Tổng khấu trừ = tất cả deductions (trừ tax và insurance).

**Formula:**
```
total_deduction = SUM(deductions[].amount)
```

**Input:**
- `deductions[]`: Mảng PayrollItem có `type = 'deduction'`

**Output:**
- `total_deduction`: Tổng khấu trừ (penalties, advances, etc.)

**Note:** Tax và Insurance KHÔNG ở đây. Chúng tính sau.

---

### PA04 - Taxable Income Preparation

**Business:**  
Thu nhập chịu thuế = gross - deductions không chịu thuế.

**Formula:**
```
taxable_income = gross - SUM(deductions[taxable=false].amount)
```

**Input:**
- `gross`: Từ PA02
- `deductions[]`: Lọc `taxable = false`

**Output:**
- `taxable_income`: Thu nhập chịu thuế (đưa vào Tax Policy)

---

### PA05 - Insurance Salary Preparation

**Business:**  
Lương đóng bảo hiểm = base salary + earnings được tính vào bảo hiểm.

**Formula:**
```
insurance_salary = base_salary + SUM(earnings[insuranceable=true].amount)
```

**Input:**
- `base_salary`: Từ PA01
- `earnings[]`: Lọc `insuranceable = true`

**Output:**
- `insurance_salary`: Lương đóng bảo hiểm (đưa vào Insurance Policy)

---

### PA06 - Net Salary Assembly

**Business:**  
Lương thực nhận = gross - deductions - tax - insurance.

**Formula:**
```
net = gross - total_deduction - tax - insurance_employee
net = MAX(0, net)
```

**Input:**
- `gross`: Từ PA02
- `total_deduction`: Từ PA03
- `tax`: Từ Tax Policy
- `insurance_employee`: Từ Insurance Policy

**Output:**
- `net`: Lương thực nhận (≥ 0)

---

### PA07 - Employer Cost Calculation

**Business:**  
Tổng chi phí công ty = gross + bảo hiểm công ty đóng.

**Formula:**
```
employer_cost = gross + insurance_employer
```

**Input:**
- `gross`: Từ PA02
- `insurance_employer`: Từ Insurance Policy

**Output:**
- `employer_cost`: Tổng chi phí lương

---

## TAX POLICY (External to Payroll)

Tax Policy tính thuế TNCN theo luật Việt Nam. **KHÔNG thuộc Payroll Assembly.**

### TP01 - Progressive Tax Calculation

**Business:**  
Thuế thu nhập cá nhân theo bậc lũy tiến.

**Formula:**
```
adjusted_income = taxable_income - personal_deduction - dependents_deduction - insurance_employee
tax = calculate_progressive_tax(adjusted_income, tax_brackets)
```

**Input:**
- `taxable_income`: Từ Payroll PA04
- `personal_deduction`: Giảm trừ bản thân (11M VND)
- `dependents_deduction`: Giảm trừ người phụ thuộc (4.4M/người)
- `insurance_employee`: Bảo hiểm nhân viên đóng
- `tax_brackets`: Bậc thuế lũy tiến (5%, 10%, 15%, 20%, 25%, 30%, 35%)

**Output:**
- `tax`: Thuế TNCN phải nộp

**Note:** Khi luật thuế đổi, chỉ sửa Tax Policy. Payroll không biết.

---

## INSURANCE POLICY (External to Payroll)

Insurance Policy tính bảo hiểm theo luật Việt Nam. **KHÔNG thuộc Payroll Assembly.**

### IP01 - Employee Insurance Calculation

**Business:**  
BHXH + BHYT + BHTN nhân viên phải đóng.

**Formula:**
```
insurance_employee = insurance_salary × (social_rate + health_rate + unemployment_rate)
insurance_employee = MIN(insurance_employee, max_insurance_cap)
```

**Input:**
- `insurance_salary`: Từ Payroll PA05
- `social_rate`: 8% (BHXH)
- `health_rate`: 1.5% (BHYT)
- `unemployment_rate`: 1% (BHTN)
- `max_insurance_cap`: Trần đóng bảo hiểm (20× lương cơ sở vùng)

**Output:**
- `insurance_employee`: Bảo hiểm nhân viên đóng

---

### IP02 - Employer Insurance Calculation

**Business:**  
BHXH + BHYT + BHTN công ty phải đóng.

**Formula:**
```
insurance_employer = insurance_salary × (employer_social_rate + employer_health_rate + employer_unemployment_rate + accident_rate)
insurance_employer = MIN(insurance_employer, max_insurance_cap_employer)
```

**Input:**
- `insurance_salary`: Từ Payroll PA05
- `employer_social_rate`: 17.5% (BHXH DN)
- `employer_health_rate`: 3% (BHYT DN)
- `employer_unemployment_rate`: 1% (BHTN DN)
- `accident_rate`: 0.5% (BHTNLĐ-BNN)
- `max_insurance_cap_employer`: Trần đóng bảo hiểm DN

**Output:**
- `insurance_employer`: Bảo hiểm công ty đóng

**Note:** Khi luật bảo hiểm đổi, chỉ sửa Insurance Policy. Payroll không biết.

---

## BUSINESS POLICIES (External to Payroll)

Các policy này KHÔNG thuộc Payroll Calculation Catalog.  
Chúng là domain logic riêng, sinh ra PayrollItem chuẩn hóa.

### Policy Responsibilities:

1. **Attendance Policy**
   - Input: Attendance logs, resignation date
   - Output: `working_days`, `PayrollItem[]` (penalties)
   
2. **Commission Policy**
   - Input: Bookings, sales, package tiers, position, brand
   - Output: `PayrollItem[]` (service commission, product commission, session bonus)
   
3. **Rating Policy**
   - Input: Session ratings, weighted sessions
   - Output: `PayrollItem[]` (rating bonus)
   
4. **KPI Policy**
   - Input: Performance metrics, targets
   - Output: `PayrollItem[]` (kpi bonus)
   
5. **Seniority Policy**
   - Input: Hire date, years of service
   - Output: `PayrollItem[]` (seniority benefit)
   
6. **Holiday Policy**
   - Input: Holiday work logs, OT hours
   - Output: `PayrollItem[]` (holiday bonus, OT pay)
   
7. **Benefit Policy**
   - Input: Employee contract, benefit config
   - Output: `PayrollItem[]` (meal allowance, transport, phone, etc.)

---

## Phân tích Pattern

### Payroll Formula (Tầng 3) chỉ cần:
- **Arithmetic**: `+`, `-`, `×`, `/`
- **Conditional**: `IF ... THEN ... ELSE`
- **Safety**: `MAX(a, b)`, `MIN(a, b)`

**7 operators, không thêm!**

### Business Policies (Tầng 1) tự do:
- Lookup tables
- Aggregation (SUM, AVG, COUNT)
- Date calculations
- Tier matching
- Complex rules

**Payroll KHÔNG quan tâm policies tính toán thế nào.**

---

## KPI: Separation of Concerns

**Metric:** "Payroll biết bao nhiêu business logic?"

| Business Domain | Payroll biết? | Ai xử lý? |
|-----------------|---------------|-----------|
| Commission rules | ❌ | Commission Policy |
| Rating tiers | ❌ | Rating Policy |
| Seniority rules | ❌ | Seniority Policy |
| Attendance penalties | ❌ | Attendance Policy |
| Holiday OT | ❌ | Holiday Policy |
| KPI targets | ❌ | KPI Policy |
| Position multiplier | ❌ | Commission Policy |
| Package multiplier | ❌ | Commission Policy |
| Tax brackets | ✅ | Payroll (core domain) |
| Insurance rates | ✅ | Payroll (core domain) |
| Gross/Net assembly | ✅ | Payroll (core domain) |

**Separation Score: 8/11 policies tách khỏi Payroll (73%)** ✅

---

## Lợi ích Kiến trúc

### 1. Thay đổi nghiệp vụ không ảnh hưởng Payroll

**Scenario:** "Đổi commission theo thương hiệu mỹ phẩm"
- ✅ Sửa: Commission Policy
- ❌ KHÔNG sửa: Payroll Formula

**Scenario:** "Bỏ thưởng rating"
- ✅ Disable: Rating Policy
- ❌ KHÔNG sửa: Payroll Formula

**Scenario:** "Thêm thưởng theo dự án"
- ✅ Tạo mới: Project Bonus Policy → `project_bonus` input
- ❌ KHÔNG sửa: Payroll Formula (chỉ cộng thêm input)



### 2. Modular UI Configuration

**Scenario:** HR muốn cấu hình riêng từng loại thưởng/phạt
- Commission settings → Commission Policy UI
- Rating tiers → Rating Policy UI
- Attendance penalties → Attendance Policy UI
- Payroll assembly → Payroll Formula UI (read-only)

Mỗi policy có UI riêng, ít ảnh hưởng lẫn nhau.

### 3. Testability

**Tầng 1 (Policies)**: Test riêng từng policy với mock data
- Test Commission Policy: input (revenue, tier, brand) → output (commission)
- Test Rating Policy: input (rating, sessions) → output (bonus)

**Tầng 3 (Payroll)**: Test assembly logic với mock inputs
- Input: all standardized values → Output: gross, tax, insurance, net

**Không test cross-layer** (policies + payroll cùng lúc)

### 4. Performance Optimization

Policies có thể chạy song song:
```
Commission Policy ──┐
Rating Policy ──────┼──→ Payroll Inputs ──→ Payroll Assembly
Attendance Policy ──┘
```

Không cần chờ policy này xong mới chạy policy kia.

### 5. Multi-Industry Support

**Baby Care module**: Chỉ cần Commission, Rating, Attendance policies  
**Beauty Spa module**: Thêm Seniority, Holiday policies  
**Industrial Cleaning module**: Bỏ Rating, thêm Equipment policies

**Payroll Formula không đổi!** Chỉ thêm/bớt policy inputs.

---

## Phase Roadmap

### Phase 1: Payroll Assembly (Core) ✅
- PF01: Gross calculation
- PF02: Tax calculation
- PF04: Net calculation
- **DSL: 7 operators** (`+`, `-`, `×`, `/`, `IF`, `MAX`, `MIN`)
- **No business policies yet**

### Phase 2: Policy Migration (Refactor)
- Extract Attendance Policy từ code hiện tại
- Extract Commission Policy từ code hiện tại
- Extract Rating Policy từ code hiện tại
- Standardize policy outputs → payroll inputs

### Phase 3: Policy Expansion (New Features)
- Add Holiday Policy
- Add Benefit Policy
- Add Advanced Commission rules (tier, brand, campaign)

### Phase 4: Multi-Module Support
- Policy registry per module
- Dynamic policy activation
- Module-specific policy UI

---

## Summary

**Catalog v0.2 Achievements:**
- ✅ Tách rõ 3 tầng: Policies → Inputs → Formulas
- ✅ Payroll chỉ còn 5 formulas (assembly only)
- ✅ DSL giữ nguyên 7 operators (không tăng)
- ✅ Separation score: 73% (8/11 policies tách khỏi Payroll)
- ✅ Modular: thêm/bớt policy không ảnh hưởng Payroll

**Nguyên tắc vàng:**
> "Payroll là assembly line, không phải business logic engine."

**Next Action:**
- ❌ KHÔNG thiết kế Policy DSL
- ✅ Implement Payroll Formula PF01-PF05
- ✅ Extract existing code thành policies
- ✅ Standardize policy output format


## KPI: Policy Independence

**Metric:** "Payroll có phải sửa khi policy thay đổi không?"

| Scenario | Payroll cần sửa? | Lý do |
|----------|------------------|-------|
| Đổi commission rule (tier → brand-based) | ❌ | Commission Policy trả về cùng format PayrollItem |
| Bỏ thưởng rating | ❌ | Rating Policy không emit item, Payroll vẫn aggregate |
| Thêm Project Bonus | ❌ | Project Policy emit item mới, Payroll aggregate tự động |
| Thêm Referral Bonus | ❌ | Referral Policy emit item mới, Payroll aggregate tự động |
| Đổi luật thuế TNCN | ❌ | Tax Policy thay đổi, Payroll không biết |
| Đổi tỷ lệ BHXH | ❌ | Insurance Policy thay đổi, Payroll không biết |
| Thêm trường `bonus_cap` vào PayrollItem | ✅ | PayrollItem format thay đổi, phải update interface |
| Đổi công thức net = gross - tax | ✅ | Core assembly logic thay đổi (hiếm khi xảy ra) |

**Independence Score: 6/8 scenarios không cần sửa Payroll (75%)** ✅

---

## Payroll DSL Requirements

Sau khi tách triệt để, Payroll Assembly chỉ cần:

### PA-DSL Operators (7 operators):
1. **Arithmetic**: `+`, `-`, `×`, `/`
2. **Conditional**: `IF ... THEN ... ELSE`
3. **Safety**: `MAX(a, b)`, `MIN(a, b)`
4. **Aggregate**: `SUM(array.field)` *(chỉ cho PayrollItem[] aggregation)*

### Không cần:
- ❌ LOOKUP (policies xử lý)
- ❌ Complex date calculations (policies xử lý)
- ❌ Tier matching (policies xử lý)
- ❌ String operations (không cần)
- ❌ Nested IF (business policies xử lý)

---

## Benefits of Pure Assembly Architecture

### 1. Zero Business Logic Leakage
**Ví dụ:** HR nói "Senior ăn 15% commission thay vì multiplier 1.2"
- ✅ Sửa: Commission Policy (change calculation logic)
- ❌ KHÔNG sửa: Payroll Assembly (vẫn nhận `PayrollItem{amount: xxx}`)

### 2. Dynamic UI Rendering
```typescript
// Payroll UI không hardcode fields
earnings.map(item => (
  <Row key={item.id}>
    <Label>{item.description}</Label>
    <Amount>{item.amount.toLocaleString()}</Amount>
  </Row>
))
```
Admin thêm policy mới → UI tự động hiển thị item mới.

### 3. Policy Parallel Execution
```
Commission Policy ──┐
Rating Policy ──────┼──→ PayrollItem[] ──→ Payroll Assembly
Attendance Policy ──┘
```
Policies không phụ thuộc nhau, chạy song song được.

### 4. Multi-Module Support
- **Baby Care**: Commission + Rating + Attendance policies
- **Beauty Spa**: + Seniority + Holiday policies
- **Industrial Cleaning**: - Rating, + Equipment policies

**Payroll Assembly không đổi!** Chỉ enable/disable policies.

### 5. Audit Trail & Transparency
```typescript
{
  gross: 10500000,
  items: [
    { id: "base", amount: 6000000, description: "Lương cơ bản 24/26 ngày" },
    { id: "commission", amount: 2350000, description: "Hoa hồng dịch vụ" },
    { id: "rating", amount: 465000, description: "Thưởng đánh giá 4.7 sao" },
    { id: "kpi", amount: 1000000, description: "Thưởng KPI đạt 35/30 ca" },
    { id: "penalty", amount: -300000, description: "Phạt đi muộn 2 ngày + vắng 1 ngày" },
    { id: "advance", amount: -500000, description: "Tạm ứng ngày 15/06" }
  ]
}
```
KTV thấy rõ từng khoản tiền từ đâu, không còn "black box".

### 6. Policy Testing Independence
```typescript
// Test Commission Policy riêng
test('Commission Policy: Senior + VIP package', () => {
  const items = CommissionPolicy.calculate({
    bookings: [...],
    position: 'senior',
    packages: ['VIP']
  });
  expect(items[0].amount).toBe(3000000);
});

// Test Payroll Assembly riêng (mock items)
test('Payroll Assembly: gross aggregation', () => {
  const gross = PayrollAssembly.calculateGross([
    { type: 'earning', amount: 6000000 },
    { type: 'earning', amount: 2000000 }
  ]);
  expect(gross).toBe(8000000);
});
```
Không test cross-layer (policy + payroll cùng lúc).

---

## Implementation Phases

### Phase 1: Payroll Assembly Core (PA01-PA07) ✅
**Deliverable:**
- Implement 7 Payroll Assembly formulas
- Define `PayrollItem` interface
- Implement aggregation logic (SUM earnings/deductions)
- **NO business policies yet** (use mock PayrollItem[])

**DSL:** 7 operators (`+`, `-`, `×`, `/`, `IF`, `MAX`, `MIN`, `SUM`)

**Duration:** 3-5 days

---

### Phase 2: Tax & Insurance Policies (TP01, IP01, IP02) ✅
**Deliverable:**
- Implement Tax Policy (progressive tax calculation)
- Implement Insurance Policy (employee + employer)
- Connect to Payroll Assembly (PA04 → TP01, PA05 → IP01/IP02)

**DSL:** No new operators (reuse arithmetic + IF + MIN)

**Duration:** 2-3 days

---

### Phase 3: Extract Existing Policies from Code
**Deliverable:**
- Extract Attendance Policy → `PayrollItem[]`
- Extract Commission Policy → `PayrollItem[]`
- Extract Rating Policy → `PayrollItem[]`

**Refactor:** Convert existing `recalculateAndSaveSalaryRecordEngine` to use PayrollItem[] inputs

**Duration:** 5-7 days

---

### Phase 4: New Business Policies (Holiday, Seniority, Benefit)
**Deliverable:**
- Implement Holiday Policy
- Implement Seniority Policy
- Implement Benefit Policy

**Duration:** 3-5 days per policy

---

### Phase 5: Policy Registry & Multi-Module Support
**Deliverable:**
- Policy activation/deactivation per module
- Policy configuration UI
- Dynamic PayrollItem rendering

**Duration:** 7-10 days

---

## Summary: v0.3 Final Architecture

**Core Principle:**
> **"Payroll là assembly line thuần túy, không biết bất kỳ business logic nào."**

**Payroll Assembly chỉ biết:**
- ✅ Cộng earnings
- ✅ Trừ deductions
- ✅ Tính base salary từ working_days
- ✅ Aggregate PayrollItem[]

**Payroll Assembly KHÔNG biết:**
- ❌ Commission rules
- ❌ Rating tiers
- ❌ Position multipliers
- ❌ Seniority tiers
- ❌ Holiday OT rates
- ❌ KPI targets
- ❌ Attendance penalties
- ❌ Tax brackets *(Tax Policy biết)*
- ❌ Insurance rates *(Insurance Policy biết)*

**Achievements:**
- ✅ Payroll formulas: 7 (PA01-PA07)
- ✅ DSL operators: 7 (`+`, `-`, `×`, `/`, `IF`, `MAX`, `MIN`, `SUM`)
- ✅ Business policies: 0 in Payroll (tách hết ra ngoài)
- ✅ Independence score: 75% (6/8 scenarios không cần sửa Payroll)
- ✅ PayrollItem format: Chuẩn hóa toàn bộ policy outputs

**Next Action:**
- ❌ KHÔNG thiết kế Policy DSL (để policies tự do implement)
- ✅ Implement Payroll Assembly Core (Phase 1)
- ✅ Mock PayrollItem[] để test
- ✅ Đảm bảo PA01-PA07 chạy đúng trước khi refactor existing code

---

## Nguyên tắc vàng (Final)

1. **Payroll là assembly line, không phải business logic engine.**
2. **Policy outputs phải chuẩn hóa (PayrollItem format).**
3. **Payroll KHÔNG biết policy tính toán như thế nào.**
4. **Tax và Insurance là policies riêng, không phải Payroll core.**
5. **Đo lường bằng Independence Score, không phải DSL operator count.**

Đây là kiến trúc sẽ sống 5-10 năm của Bella ERP. 🎯
