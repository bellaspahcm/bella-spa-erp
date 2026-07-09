# ✅ CHECKLIST BẮT BUỘC KHI THÊM FIELD MỚI VÀO HỆ THỐNG LƯƠNG

> **⚠️ CẢNH BÁO:** Bỏ qua bất kỳ bước nào sẽ gây ra regression bugs, test failures, và data inconsistency!

---

## 📋 OVERVIEW

Khi thêm một salary component mới (ví dụ: `product_sales_commission`, `overtime_bonus`, `transportation_allowance`), **BẮT BUỘC** phải cập nhật tất cả 8 layers sau theo đúng thứ tự:

---

## 🔢 8 LAYERS BẮT BUỘC PHẢI CẬP NHẬT

### **Layer 1: Database Schema** 
**File:** `supabase/migrations/YYYYMMDDHHMMSS_add_[field_name].sql`

```sql
-- 1.1. Thêm column vào bảng salary_records
ALTER TABLE public.salary_records 
ADD COLUMN [field_name] NUMERIC(12,2) DEFAULT 0;

-- 1.2. Thêm comment mô tả
COMMENT ON COLUMN public.salary_records.[field_name] IS 
'[Mô tả business logic của field này]';

-- 1.3. Update RLS policies nếu cần
-- (Ví dụ: KTV chỉ được xem của mình, Admin xem tất cả)
```

**✅ Verify:** Chạy migration và kiểm tra `\d salary_records` trong psql/SQL Editor.

---

### **Layer 2: Database RPC Functions**
**Files:** 
- `supabase/migrations/calculate_ktv_salary_sheet.sql`
- `supabase/migrations/get_salary_reconciliation_report.sql`

```sql
-- 2.1. Thêm CTE tính toán field mới (nếu cần aggregate từ bảng khác)
[field_name]_data AS (
    SELECT 
        ktv_id,
        SUM(amount) AS total_[field_name]
    FROM public.[source_table]
    WHERE tenant_id = v_tenant_id
      AND date_trunc('month', date_column) = date_trunc('month', p_month_year)
      AND status IN ('approved', 'completed')  -- Filter theo business rule
    GROUP BY ktv_id
),

-- 2.2. JOIN vào CTE chính
existing_salary_records AS (
    SELECT 
        r.ktv_id,
        ...
        r.[field_name] AS saved_[field_name],  -- ⭐ THÊM DÒNG NÀY
    FROM public.salary_records r
    WHERE ...
)

-- 2.3. Thêm vào SELECT output
SELECT 
    ...
    COALESCE(
        er.saved_[field_name],      -- Ưu tiên giá trị đã lưu
        fd.total_[field_name],      -- Fallback về live calculation
        0
    )::NUMERIC AS [field_name],
    
-- 2.4. Cập nhật công thức total_salary
total_salary = 
    base_salary 
    + session_bonus 
    + rating_bonus 
    + kpi_bonus 
    + [field_name]              -- ⭐ THÊM FIELD MỚI
    - violations_deduction 
    - service_percentage_bonus

-- 2.5. JOIN CTE mới vào FROM clause
FROM ktv_users u
LEFT JOIN [field_name]_data fd ON u.id = fd.ktv_id
...
```

**✅ Verify:** 
```sql
SELECT [field_name], total_salary 
FROM calculate_ktv_salary_sheet('2026-07-01');
```

---

### **Layer 3: TypeScript Database Types**
**File:** `src/types/database.types.ts` (auto-generated) hoặc custom types

```typescript
// 3.1. Cập nhật SalaryRecordRow type
export type SalaryRecordRow = {
  ...
  [field_name]: number | null;  // ⭐ THÊM FIELD MỚI
}

// 3.2. Cập nhật SalarySheetRow type (RPC output)
export type SalarySheetRow = {
  ...
  [field_name]: number | null;  // ⭐ THÊM FIELD MỚI
}
```

**✅ Verify:** `npm run build` không có TypeScript errors.

---

### **Layer 4: Backend Actions - RPC Mapping**
**File:** `src/modules/hr-salary/actions/base-salary-actions.ts`

```typescript
// 4.1. Cập nhật SalarySheetRow type (nếu chưa có trong database.types.ts)
type SalarySheetRow = {
  ...
  [field_name]: number | null;  // ⭐ THÊM FIELD MỚI
};

// 4.2. Cập nhật mergeSalarySheetIntoRecord()
function mergeSalarySheetIntoRecord(
  record: SalaryRecordRow, 
  sheetRow: SalarySheetRow
): SalaryRecordRow {
  return {
    ...record,
    ...
    [field_name]: sheetRow.[field_name] ?? record.[field_name],  // ⭐ THÊM DÒNG NÀY
  };
}

// 4.3. Cập nhật direct PG query fallback (nếu có)
const res = await client.query(
  `SELECT 
    ktv_id, 
    base_salary::numeric, 
    ...
    [field_name]::numeric,  -- ⭐ THÊM VÀO SELECT
    total_salary::numeric 
   FROM calculate_ktv_salary_sheet($1)`,
  [monthYear]
);

// 4.4. Map kết quả query
return res.rows.map(row => ({
  ...
  [field_name]: row.[field_name] ? Number(row.[field_name]) : 0,  // ⭐ THÊM MAPPING
}));
```

**✅ Verify:** `npm run build` + test `calculateKtvSalarySheet()` function.

---

### **Layer 5: Backend Actions - Query Functions**
**File:** `src/modules/hr-salary/actions/query-salary-actions.ts`

```typescript
// 5.1. Query source data (nếu cần aggregate từ bảng khác)
const { data: [field_name]Data, error: [field_name]Error } = await supabase
  .from('[source_table]')
  .select('ktv_id, amount_column')
  .in('status', ['approved', 'completed'])  // Filter theo business rule
  .gte('date_column', startOfMonthStr)
  .lt('date_column', endOfMonthStr)
  .eq('tenant_id', tenantId);

if ([field_name]Error) {
  throw new Error(`[getSalaryData] [field_name] query failed: ${[field_name]Error.message}`);
}

// 5.2. Aggregate theo ktv_id
const [field_name]Map = new Map<string, number>();
([field_name]Data || []).forEach(item => {
  const current = [field_name]Map.get(item.ktv_id) || 0;
  [field_name]Map.set(item.ktv_id, current + Number(item.amount_column || 0));
});

// 5.3. Thêm vào salary record mapping
const ktvSalaries: KtvSalaryRecord[] = users.map(user => {
  const record = salaryRecordsMap.get(user.id);
  const live[FieldName] = [field_name]Map.get(user.id) || 0;
  
  return {
    ...
    [field_name]: record?.[field_name] ?? live[FieldName],  // ⭐ THÊM FIELD
  };
});
```

**✅ Verify:** `npm run test src/__tests__/query-salary-actions.test.ts`

---

### **Layer 6: Backend Actions - Recalculation Engine**
**File:** `src/modules/hr-salary/actions/salary-recalculation-engine.ts`

```typescript
// 6.1. Fetch source data trong recalculateAndSaveSalaryRecord()
const { data: [field_name]Records } = await supabase
  .from('[source_table]')
  .select('amount_column')
  .eq('ktv_id', ktvId)
  .gte('date_column', startOfMonth.toISOString())
  .lt('date_column', endOfMonth.toISOString())
  .in('status', ['approved', 'completed']);

const live[FieldName] = ([field_name]Records || []).reduce(
  (sum, r) => sum + Number(r.amount_column || 0), 
  0
);

// 6.2. Determine final value (draft vs non-draft logic)
const final[FieldName] = isDraft 
  ? live[FieldName]  // Draft: Always use live calculation
  : (existingRecord?.[field_name] ?? live[FieldName]);  // Non-draft: Preserve saved value

// 6.3. Thêm vào calculateSalaryTotal()
const totalSalary = calculateSalaryTotal({
  baseSalary,
  sessionBonus,
  ratingBonus,
  kpiBonus,
  [field_name]: final[FieldName],  // ⭐ THÊM PARAMETER
  violationsDeduction,
  servicePercentageBonus,
});

// 6.4. Thêm vào upsert payload
const { error: upsertError } = await supabase
  .from('salary_records')
  .upsert({
    ...
    [field_name]: final[FieldName],  // ⭐ THÊM VÀO PAYLOAD
    total_salary: totalSalary,
  });
```

**✅ Verify:** `npm run test src/__tests__/salary-recalculation-integration.test.ts`

---

### **Layer 7: Frontend UI Components**

#### **7.1. API Route** (`src/app/api/payroll/employees/[employeeId]/detail/route.ts`)

```typescript
// 7.1.1. Query source data
const { data: [field_name]Records } = await supabase
  .from('[source_table]')
  .select('*, date_column, amount_column')
  .eq('ktv_id', employeeId)
  .gte('date_column', startOfMonth)
  .lt('date_column', endOfMonth);

// 7.1.2. Calculate total
const live[FieldName] = ([field_name]Records || []).reduce(
  (sum, r) => sum + Number(r.amount_column || 0), 
  0
);

const [field_name] = salaryRecord?.[field_name] !== null && salaryRecord?.[field_name] !== undefined
  ? Number(salaryRecord.[field_name])
  : live[FieldName];

// 7.1.3. Update totalSalary calculation
const totalSalary = 
  baseSalary + 
  serviceCommission + 
  positionBonus + 
  ratingBonus + 
  [field_name] +              // ⭐ THÊM VÀO CÔNG THỨC
  attendancePenalty - 
  totalAdvances;

// 7.1.4. Thêm vào response breakdown
return NextResponse.json({
  ...
  breakdown: {
    ...
    [field_name]: {
      amount: [field_name],
      records: ([field_name]Records || []).map(r => ({
        date: r.date_column,
        amount: r.amount_column,
        description: r.description_column,
      })),
    },
  },
});
```

#### **7.2. Component Types** (`src/components/payroll/EmployeeDetailScreen.tsx`)

```typescript
// 7.2.1. Cập nhật EmployeeDetailData interface
interface EmployeeDetailData {
  ...
  breakdown: {
    ...
    [field_name]: {
      amount: number;
      records: Array<{
        date: string;
        amount: number;
        description: string;
      }>;
    };
  };
}
```

#### **7.3. Component Rendering** (`src/components/payroll/EmployeeDetailScreen.tsx`)

```tsx
{/* 7.3.1. Render BreakdownCard */}
{data.breakdown.[field_name] && data.breakdown.[field_name].amount > 0 && (
  <BreakdownCard
    title="[TIÊU ĐỀ FIELD VIẾT HOA]"
    amount={data.breakdown.[field_name].amount}
    type="earning"  // hoặc "deduction"
    icon={<TrendingUp size={20} />}
    description="[Mô tả ngắn gọn]"
    details={
      <div className="space-y-2">
        <p className="font-semibold text-slate-700 text-sm">
          Chi tiết [tên field]:
        </p>
        <ul className="space-y-2 bg-slate-50 border border-slate-100 p-3 rounded-xl">
          {data.breakdown.[field_name].records.map((record, idx) => (
            <li key={idx} className="text-xs font-medium text-slate-650 flex justify-between">
              <span>
                {new Date(record.date).toLocaleDateString('vi-VN')} - {record.description}
              </span>
              <span className="font-bold text-slate-800">
                {formatCurrency(record.amount)}
              </span>
            </li>
          ))}
        </ul>
      </div>
    }
    actionLabel="Xem chi tiết"
  />
)}

{/* 7.3.2. Cập nhật tổng thu nhập (summary card) */}
<div className="flex justify-between text-sm font-medium">
  <span className="text-slate-500">Tổng thu nhập (Trước khấu trừ):</span>
  <span className="font-bold text-slate-850">
    {formatCurrency(
      data.breakdown.baseSalary.amount +
      data.breakdown.serviceCommission.amount +
      data.breakdown.positionBonus.amount +
      data.breakdown.ratingBonus.amount +
      (data.breakdown.[field_name]?.amount || 0)  // ⭐ THÊM DÒNG NÀY
    )}
  </span>
</div>
```

**✅ Verify:** 
- `npm run build` không có TypeScript errors
- Load detail page trong browser, kiểm tra card hiển thị đúng

---

### **Layer 8: Test Mocks**

#### **8.1. Query Builder Mock** (`src/__tests__/query-salary-actions.test.ts`, `src/__tests__/salary-surface-parity.test.ts`)

```typescript
// 8.1.1. Thêm mock cho bảng source (nếu query từ bảng mới)
class StoreQueryBuilder {
  ...
  // ✅ ĐÃ CÓ: Đảm bảo có .in() method
  in(field: string, values: unknown[]) {
    this.filters.push({ kind: 'in', field, value: values });
    return this;
  }
}

// 8.1.2. Seed mock data cho bảng source
const mockStore: Store = {
  ...
  [source_table]: [
    { 
      id: '1', 
      ktv_id: 'ktv-1', 
      amount_column: 200000,
      date_column: '2026-07-15',
      status: 'completed',
      tenant_id: 'tenant-1',
    },
  ],
};

// 8.1.3. Thêm query vào script queue (đúng thứ tự!)
const calls = setupDb([
  { table: 'tenants', op: 'select', data: { salary_config: null } },
  { table: 'users', op: 'select', data: [...] },
  { table: 'salary_records', op: 'select', data: [...] },
  { table: 'session_logs', op: 'select', data: [...] },
  { table: 'attendance', op: 'select', data: [...] },
  { table: 'packages', op: 'select', data: [...] },
  { table: 'kpi_records', op: 'select', data: [...] },
  { table: '[source_table]', op: 'select', data: [...] },  // ⭐ THÊM MOCK MỚI
]);
```

#### **8.2. Integration Test** (`src/__tests__/salary-surface-parity.test.ts`)

```typescript
// 8.2.1. Thêm field vào mock salary_records
mockStore.salary_records = [
  {
    id: 'sr-1',
    ktv_id: 'ktv-1',
    ...
    [field_name]: 200000,  // ⭐ THÊM FIELD VÀO MOCK
    total_salary: 5500000,
  },
];

// 8.2.2. Assert field trong test output
expect(result.ktvSalaries[0].[field_name]).toBe(200000);
expect(result.ktvSalaries[0].total_salary).toBe(5500000);  // Bao gồm field mới
```

**✅ Verify:** 
```bash
npm run test:critical
npm run test src/__tests__/query-salary-actions.test.ts
npm run test src/__tests__/salary-surface-parity.test.ts
```

---

## 🚨 COMMON MISTAKES TO AVOID

### ❌ **Mistake 1: Quên cập nhật total_salary formula**
```sql
-- SAI: Thêm field mới nhưng không cộng vào total
SELECT ..., new_field, base_salary + session_bonus AS total_salary

-- ĐÚNG: Phải cộng new_field vào total
SELECT ..., new_field, base_salary + session_bonus + new_field AS total_salary
```

### ❌ **Mistake 2: Không handle NULL values**
```typescript
// SAI: Trực tiếp cộng có thể ra NaN
const total = base + session + newField;

// ĐÚNG: Phải COALESCE/fallback về 0
const total = base + session + (newField ?? 0);
```

### ❌ **Mistake 3: Test mock order sai**
```typescript
// SAI: Query thứ tự trong code là A→B→C→D, nhưng mock là A→C→B→D
setupDb([
  { table: 'A', op: 'select', data: [] },
  { table: 'C', op: 'select', data: [] },  // ❌ SAI THỨ TỰ
  { table: 'B', op: 'select', data: [] },
  { table: 'D', op: 'select', data: [] },
]);

// ĐÚNG: Mock phải theo đúng thứ tự query trong code
setupDb([
  { table: 'A', op: 'select', data: [] },
  { table: 'B', op: 'select', data: [] },
  { table: 'C', op: 'select', data: [] },
  { table: 'D', op: 'select', data: [] },
]);
```

### ❌ **Mistake 4: Draft vs Non-draft logic sai**
```typescript
// SAI: Draft record vẫn dùng saved value (không update khi có data mới)
const value = existingRecord?.[field_name] ?? liveValue;

// ĐÚNG: Draft phải dùng live, non-draft mới dùng saved
const value = isDraft 
  ? liveValue 
  : (existingRecord?.[field_name] ?? liveValue);
```

### ❌ **Mistake 5: Không filter status đúng business rule**
```typescript
// SAI: Lấy tất cả records kể cả rejected/draft
.from('source_table')
.select('*')

// ĐÚNG: Chỉ lấy records đã approved/completed
.from('source_table')
.select('*')
.in('status', ['approved', 'completed'])
```

---

## 📊 VERIFICATION MATRIX

| Layer | File | Verification Command | Expected Output |
|-------|------|---------------------|----------------|
| 1. Schema | `supabase/migrations/...` | `\d salary_records` | Column `[field_name]` tồn tại |
| 2. RPC | `calculate_ktv_salary_sheet.sql` | `SELECT [field_name] FROM calculate_ktv_salary_sheet(...)` | Giá trị đúng |
| 3. Types | `database.types.ts` | `npm run build` | No TypeScript errors |
| 4. RPC Mapping | `base-salary-actions.ts` | `npm run build` | No TypeScript errors |
| 5. Query | `query-salary-actions.ts` | `npm run test query-salary-actions.test.ts` | All tests pass |
| 6. Recalc | `salary-recalculation-engine.ts` | `npm run test salary-recalculation-integration.test.ts` | All tests pass |
| 7. UI | `EmployeeDetailScreen.tsx` | Load detail page | Card hiển thị đúng |
| 8. Mocks | `*.test.ts` | `npm run test:critical` | All tests pass |

---

## ✅ FINAL CHECKLIST

Trước khi commit, **BẮT BUỘC** check tất cả:

- [ ] ✅ Database migration chạy thành công không có errors
- [ ] ✅ RPC functions return field mới trong SELECT output
- [ ] ✅ TypeScript types đã được cập nhật (no `any` types)
- [ ] ✅ `base-salary-actions.ts` map field từ RPC output
- [ ] ✅ `query-salary-actions.ts` fetch và aggregate field từ source table
- [ ] ✅ `salary-recalculation-engine.ts` calculate và upsert field
- [ ] ✅ API route `/api/payroll/employees/[employeeId]/detail` return field trong breakdown
- [ ] ✅ `EmployeeDetailScreen.tsx` hiển thị BreakdownCard cho field mới
- [ ] ✅ Summary "Tổng thu nhập" đã cộng field mới vào
- [ ] ✅ Test mocks đã được cập nhật (query order + seed data)
- [ ] ✅ `npm run build` PASS (no TypeScript errors)
- [ ] ✅ `npm run test:critical` PASS (all tests green)
- [ ] ✅ Manual testing: Load detail page, verify card hiển thị đúng số liệu
- [ ] ✅ Git diff review: Không có unintended changes

---

## 🔗 RELATED DOCUMENTS

- `docs/CRITICAL_BELLA_ERP_DEVELOPMENT_RULES.md` - Critical development rules
- `docs/AI_AGENT_ONBOARDING.md` - System overview
- `docs/KNOWLEDGE_STORAGE_PROCESS.md` - Documentation process
- `src/__tests__/README.md` - Testing guidelines

---

## 📝 EXAMPLE: Adding `overtime_bonus` Field

Xem commit history của `product_sales_commission` để tham khảo:
```bash
git log --grep="product_sales_commission" --oneline
git show <commit-hash>
```

---

**Last Updated:** June 22, 2026  
**Maintainer:** AI Agent + Development Team
