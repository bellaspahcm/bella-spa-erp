# UI Vocabulary Migration Guide

**Status:** Foundation Complete ✅  
**Progress:** Vocabulary system ready, incremental component migration in progress  
**Target:** Replace all hard-coded domain terms with module-aware vocabulary

---

## Overview

Bella ERP now supports multiple business domains (Beauty Spa, Baby Care, Industrial Cleaning, etc.). To provide proper UX for each domain, UI components must use **module-aware vocabulary** instead of hard-coded terms.

**Before:**
```tsx
<h1>Danh sách Kỹ thuật viên</h1>
<button>Thêm KTV</button>
```

**After:**
```tsx
const vocab = useModuleVocabulary();
<h1>Danh sách {vocab.worker.plural}</h1>
<button>Thêm {vocab.worker.short}</button>
```

---

## How to Use

### 1. Import the hook

```tsx
import { useModuleVocabulary } from '@/hooks/useModuleVocabulary';
```

### 2. Get vocabulary in your component

```tsx
export function MyComponent() {
  const vocab = useModuleVocabulary();
  
  return (
    <div>
      <h1>{vocab.worker.plural}</h1>
      <p>{vocab.workUnit.singular} đã hoàn thành</p>
    </div>
  );
}
```

### 3. Available vocabulary

| Category | Field | Beauty/BabyCare | Cleaning |
|----------|-------|----------------|----------|
| **worker** | singular | Kỹ thuật viên | Nhân viên vệ sinh |
| | plural | Kỹ thuật viên | Nhân viên vệ sinh |
| | short | KTV | NVS |
| | role | KTV | Nhân viên vệ sinh |
| **workUnit** | singular | Buổi | Ca làm việc |
| | plural | Các buổi | Các ca làm việc |
| | action | Thực hiện buổi | Hoàn thành ca |
| **service** | singular | Liệu trình | Dịch vụ vệ sinh |
| | plural | Các liệu trình | Các dịch vụ vệ sinh |
| **booking** | singular | Đơn đặt lịch | Phiếu công việc |
| | plural | Các đơn đặt lịch | Các phiếu công việc |
| | action | Đặt lịch | Tạo phiếu |
| **package** | singular | Gói dịch vụ | Gói dịch vụ |
| | plural | Các gói dịch vụ | Các gói dịch vụ |
| **customer** | singular | Khách hàng | Khách hàng |
| | plural | Khách hàng | Khách hàng |
| | context | mẹ và bé | doanh nghiệp |

---

## Migration Checklist

### Components to Migrate (Priority Order)

#### 🔴 High Priority (User-facing core flows)
- [ ] `src/app/dashboard/settings/components/StaffManagementTab.tsx`
  - Line 283: "Kỹ thuật viên" → `vocab.worker.singular`
  - Line 284: "KTV Trưởng" → `vocab.worker.role + " Trưởng"`
  - Line 455: "Kỹ thuật viên" → `vocab.worker.singular`
  - Line 456: "KTV Trưởng (Tổ trưởng)" → `vocab.worker.role + " Trưởng (Tổ trưởng)"`
  - Line 567: Same as above

- [ ] `src/app/dashboard/bookings/components/BookingDayDetailModal.tsx`
  - Line 191: "Kỹ thuật viên" → `vocab.worker.singular`
  - Line 202: "Chọn kỹ thuật viên..." → `"Chọn ${vocab.worker.singular.toLowerCase()}..."`

- [ ] `src/app/dashboard/salary/components/SessionMatrixTable.tsx`
  - Line 51: "Chi tiết số buổi thực hiện theo từng kỹ thuật viên" → `vocab.workUnit.plural + " theo từng " + vocab.worker.singular.toLowerCase()`
  - Line 69: "Kỹ thuật viên" → `vocab.worker.singular`

- [ ] `src/components/features/dashboard/OnboardingTour.tsx`
  - Line 29-30: "kỹ thuật viên hoàn thành buổi" → `vocab.worker.singular + " hoàn thành " + vocab.workUnit.singular`
  - Line 35-36: "Thêm kỹ thuật viên vào hệ thống" → `"Thêm " + vocab.worker.singular + " vào hệ thống"`
  - Line 62: "Quản lý & Tính Lương Kỹ Thuật Viên" → `"Quản lý & Tính Lương " + vocab.worker.plural`
  - Line 81: "Kỹ thuật viên hoàn thành buổi" → Same as line 29-30

#### 🟡 Medium Priority (Admin/management screens)
- [ ] `src/app/dashboard/settings/components/SubscriptionTab.tsx`
  - Line 47: "Tối đa 1 nhân sự kỹ thuật viên" → `"Tối đa 1 " + vocab.worker.singular`
  - Line 60, 74, 89: Same pattern

- [ ] `src/app/hq/components/HqSubscriptionPackageReference.tsx`
  - Line 31: "Kỹ thuật viên: Tối đa 1 KTV" → `vocab.worker.singular + ": Tối đa 1 " + vocab.worker.short`
  - Line 52, 73, 94: Same pattern

#### 🟢 Low Priority (Types, interfaces, internal)
- [ ] Type names (KtvOption, KtvPerformanceViewModel, etc.)
  - **Decision:** Keep type names as-is (they're internal, not user-facing)
  - Only migrate display strings

- [ ] Database column names (ktv_id, ktv_commission, etc.)
  - **Decision:** Keep DB schema as-is (breaking change, not worth it for v1)
  - Only migrate UI labels

- [ ] Function/variable names
  - **Decision:** Keep as-is unless refactoring for other reasons

---

## Common Patterns

### Pattern 1: Simple label replacement
```tsx
// Before
<label>Kỹ thuật viên</label>

// After
const vocab = useModuleVocabulary();
<label>{vocab.worker.singular}</label>
```

### Pattern 2: Pluralization
```tsx
// Before
<p>{count} kỹ thuật viên</p>

// After
const vocab = useModuleVocabulary();
<p>{count} {vocab.worker.plural.toLowerCase()}</p>
```

### Pattern 3: Role selection dropdown
```tsx
// Before
options={[
  { value: "ktv", label: "Kỹ thuật viên" },
  { value: "ktv_lead", label: "KTV Trưởng" }
]}

// After
const vocab = useModuleVocabulary();
options={[
  { value: "ktv", label: vocab.worker.singular },
  { value: "ktv_lead", label: `${vocab.worker.role} Trưởng` }
]}
```

### Pattern 4: Conditional text
```tsx
// Before
user.role === 'ktv' ? 'Kỹ thuật viên' : 'Admin'

// After
const vocab = useModuleVocabulary();
user.role === 'ktv' ? vocab.worker.singular : 'Admin'
```

---

## Testing

After migrating a component:

1. **Switch tenant module** (if multi-tenant test env available)
   - Create/switch to Beauty Spa tenant → should show "Kỹ thuật viên"
   - Create/switch to Cleaning tenant → should show "Nhân viên vệ sinh"

2. **Visual regression test**
   - Text should not overflow containers
   - Buttons should still fit their labels
   - Dropdowns should accommodate longer text

3. **TypeScript check**
   ```bash
   npm run build
   ```
   Should compile without errors

---

## What NOT to Change

❌ **Database schema**
- Keep column names: `ktv_id`, `ktv_commission`, `session_logs`, etc.
- Reason: Breaking change, requires data migration

❌ **API routes/endpoints**
- Keep paths: `/api/ktv/...`, `/api/sessions/...`, etc.
- Reason: Client compatibility, versioning needed

❌ **Type/Interface names**
- Keep: `KtvOption`, `KtvPerformanceViewModel`, `SessionLog`, etc.
- Reason: Internal naming, not user-facing

❌ **Function/variable names** (unless refactoring)
- Keep: `ktvs`, `getKtvList()`, `sessionCount`, etc.
- Reason: Not worth the churn for v1

✅ **Only change user-visible text**
- Labels, headings, placeholders, descriptions
- Toast messages, error messages
- Navigation labels

---

## Vocabulary Extension (Future)

To add a new domain (e.g., `student_training`):

1. Add vocabulary to `src/lib/business-rules/module-vocabulary.ts`:
```tsx
const STUDENT_TRAINING_VOCABULARY: ModuleVocabulary = {
  worker: {
    singular: 'Học viên',
    plural: 'Học viên',
    short: 'HV',
    role: 'Học viên',
  },
  workUnit: {
    singular: 'Buổi học',
    plural: 'Các buổi học',
    action: 'Hoàn thành buổi học',
  },
  // ... rest of vocabulary
};
```

2. Update `getModuleVocabulary()`:
```tsx
export function getModuleVocabulary(moduleKey: TenantModuleKey | null | undefined): ModuleVocabulary {
  if (moduleKey === 'industrial_cleaning') return CLEANING_VOCABULARY;
  if (moduleKey === 'student_training') return STUDENT_TRAINING_VOCABULARY;
  return BEAUTY_BABYCARE_VOCABULARY; // default
}
```

3. **That's it!** All components using `useModuleVocabulary()` will automatically get the new terms.

---

## Migration Progress Tracking

Run this command to find remaining hard-coded terms:

```bash
# Find "KTV" references (case-sensitive)
grep -r "KTV" src/app src/components --include="*.tsx" --include="*.ts" | grep -v "// @vocab-migrated"

# Find "Kỹ thuật viên" references
grep -r "Kỹ thuật viên" src/app src/components --include="*.tsx"

# Find "buổi" references (work unit)
grep -r "buổi" src/app src/components --include="*.tsx" | grep -v "// @vocab-migrated"
```

Mark migrated files with a comment:
```tsx
// @vocab-migrated: 2026-06-22
```

---

## Timeline

- **Phase 1 (Complete):** Vocabulary system foundation ✅
- **Phase 2 (In Progress):** High-priority component migration 🔄
- **Phase 3 (Planned):** Medium-priority components
- **Phase 4 (Optional):** Low-priority polish

**Estimated effort:** 4-6 hours total for full migration

---

## References

- Vocabulary system: `src/lib/business-rules/module-vocabulary.ts`
- React hook: `src/hooks/useModuleVocabulary.ts`
- Spec: `docs/implementation-artifacts/spec-industrial-cleaning-module.md`
- Playbook: `docs/INDUSTRY_MODULE_DEVELOPMENT_PLAYBOOK.md`

