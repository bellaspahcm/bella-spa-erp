# Báo Cáo Vi Phạm `any` Type - Law 11 Constitution

**Ngày kiểm tra:** 09/08/2026  
**Compliance Status:** 🔴 **CRITICAL VIOLATION**  
**Tổng số vi phạm:** ~100+ instances

---

## 📋 Law 11: Strictly No `any` Types Allowed

### Quy Định (từ AGENTS.md)

```typescript
// ❌ FORBIDDEN: Explicit any
const data: any = await fetchData();
function processData(input: any) { ... }

// ❌ FORBIDDEN: Implicit any (missing type annotation)
const result = await supabase.from('table').select('*');

// ❌ FORBIDDEN: Type assertion to any
const supabase = (await createClient()) as any;

// ❌ FORBIDDEN: any in catch blocks
catch (err: any) { ... }

// ❌ FORBIDDEN: any in type definitions
interface Data { field: any; }
type Handler = (input: any) => void;
```

### Patterns Bắt Buộc

```typescript
// ✅ CORRECT: Explicit typing with database schemas
const { data, error } = await supabase
  .from('attendance')
  .select('*')
  .returns<Database['public']['Tables']['attendance']['Row'][]>();

// ✅ CORRECT: Typed error handling
catch (err: unknown) {
  const message = err instanceof Error ? err.message : 'Unknown error';
}

// ✅ CORRECT: Generic constraints
function process<T extends Record<string, unknown>>(input: T): T { ... }

// ✅ CORRECT: Union types for flexibility
type Result = SuccessResult | ErrorResult;

// ✅ CORRECT: Unknown for truly dynamic data, then narrow
const data: unknown = JSON.parse(str);
if (isValidData(data)) { /* data is narrowed */ }
```

---

## 🔴 Vi Phạm Theo Mức Độ Ưu Tiên

### CRITICAL (Platform Engines) - 0 vi phạm ✅
**Status:** CLEAN  
Không có vi phạm trong platform engines (tuân thủ 100%)

### HIGH Priority (Tests & Mock Infrastructure)

#### 1. **src/__tests__/e2e-pipeline.test.ts** - 7 vi phạm
```typescript
// ❌ Lines 21-27
interface MockStore {
  bookings: any[];
  session_logs: any[];
  revenue: any[];
  expenses: any[];
  users: any[];
  salary_records: any[];
  session_reviews: any[];
}
```

**Fix:**
```typescript
// ✅ Correct
import { Database } from '@/types/supabase';

interface MockStore {
  bookings: Database['public']['Tables']['bookings']['Row'][];
  session_logs: Database['public']['Tables']['session_logs']['Row'][];
  revenue: Database['public']['Tables']['revenue']['Row'][];
  expenses: Database['public']['Tables']['expenses']['Row'][];
  users: Database['public']['Tables']['users']['Row'][];
  salary_records: Database['public']['Tables']['salary_records']['Row'][];
  session_reviews: Database['public']['Tables']['session_reviews']['Row'][];
}
```

#### 2. **src/__tests__/gps-geocode-attendance.test.ts** - 11+ vi phạm
```typescript
// ❌ Lines 22-33
private resultPromise: Promise<any>;

constructor(data: any = null, error: any = null) {
  this.resultPromise = Promise.resolve({ data, error });
}

select(...args: any[]) { mockSelect(...args); return this; }
insert(...args: any[]) { mockInsert(...args); return this; }
update(...args: any[]) { mockUpdate(...args); return this; }
delete(...args: any[]) { mockDelete(...args); return this; }
eq(...args: any[]) { mockEq(...args); return this; }
order(...args: any[]) { mockOrder(...args); return this; }
```

**Fix:**
```typescript
// ✅ Correct
import { PostgrestFilterBuilder } from '@supabase/postgrest-js';
import { Database } from '@/types/supabase';

type QueryResult<T> = { data: T | null; error: Error | null };

private resultPromise: Promise<QueryResult<unknown>>;

constructor<T>(data: T | null = null, error: Error | null = null) {
  this.resultPromise = Promise.resolve({ data, error });
}

select<T extends keyof Database['public']['Tables']>(
  ...columns: string[]
): this {
  mockSelect(...columns);
  return this;
}

insert<T>(values: T | T[]): this {
  mockInsert(values);
  return this;
}

// ... similar for other methods with proper generics
```

#### 3. **src/__tests__/portal-chat.test.ts** - 10+ vi phạm
Tương tự `gps-geocode-attendance.test.ts`

#### 4. **src/__tests__/security-hardening.test.ts** - 7 vi phạm
```typescript
// ❌ Lines 56-62
interface MockSecurityStore {
  attendance: any[];
  staff_leaves: any[];
  users: any[];
  revenue: any[];
  salary_records: any[];
  franchise_royalty_invoices: any[];
  session_reviews: any[];
}
```

**Fix:** Giống như fix cho `e2e-pipeline.test.ts`

#### 5. **src/__tests__/subscription.test.ts** - 6+ vi phạm
```typescript
// ❌ Lines 4-16
const createChainableMock = (resolvedValue: any, singleValueFn?: () => any) => {
  const chain: any = {
    eq: jest.fn(() => chain),
    or: jest.fn(() => chain),
    // ...
    then: (resolve: any) => resolve(resolvedValue),
  };
  // ...
};

// ❌ Lines 71-80
enqueueWithAutoClient: (...args: any[]) => mockEnqueueWithAutoClient(...args),

let checkSubscriptionLimit: any;
let incrementSmsCount: any;
let POST: any;
```

**Fix:**
```typescript
// ✅ Correct with proper typing
import { PostgrestFilterBuilder } from '@supabase/postgrest-js';

type ChainableMock<T> = {
  eq: jest.Mock;
  or: jest.Mock;
  select: jest.Mock;
  single: jest.Mock;
  maybeSingle: jest.Mock;
  then: <TResult>(
    onfulfilled?: ((value: { data: T | null; error: Error | null }) => TResult) | null
  ) => Promise<TResult>;
};

const createChainableMock = <T>(
  resolvedValue: { data: T | null; error: Error | null },
  singleValueFn?: () => T | null
): ChainableMock<T> => {
  // ...
};

// For function imports
type CheckSubscriptionLimitFn = (
  tenantId: string,
  featureKey: string,
  currentCount: number
) => Promise<boolean>;

type IncrementSmsCountFn = (tenantId: string) => Promise<void>;

type POSTHandler = (req: Request) => Promise<Response>;

let checkSubscriptionLimit: CheckSubscriptionLimitFn;
let incrementSmsCount: IncrementSmsCountFn;
let POST: POSTHandler;
```

### MEDIUM Priority (Components & UI)

#### 6. **src/__tests__/finance-pnl-preflight.test.tsx** - 5+ vi phạm
```typescript
// ❌ Mock components with any props
default: ({ href, children, ...props }: any) => ...
AnimatePresence: ({ children }: any) => ...
({ value, onChange, label }: any) => ...
onChange: (event: any) => onChange(event.target.value),
```

**Fix:**
```typescript
// ✅ Correct
import { LinkProps } from 'next/link';
import { MotionProps } from 'framer-motion';

type MockLinkProps = LinkProps & {
  children: React.ReactNode;
};

default: ({ href, children, ...props }: MockLinkProps) => ...

type AnimatePresenceProps = {
  children: React.ReactNode;
};

AnimatePresence: ({ children }: AnimatePresenceProps) => ...

type SelectProps = {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  label?: string;
};

({ value, onChange, label, options }: SelectProps) => ...
onChange: (event: React.ChangeEvent<HTMLSelectElement>) => onChange(event.target.value),
```

#### 7. **src/components/rules/__tests__/RuleEditor.test.tsx** - 3+ vi phạm
```typescript
// ❌ Mock component props
default: ({ value, onChange }: any) => ...
default: ({ conditions, onChange }: any) => ...
default: ({ actions, onChange }: any) => ...
```

**Fix:**
```typescript
// ✅ Correct
import { RuleMetadata, RuleCondition, RuleAction } from '@/types/rules';

type RuleMetadataFormProps = {
  value: RuleMetadata;
  onChange: (metadata: RuleMetadata) => void;
};

default: ({ value, onChange }: RuleMetadataFormProps) => ...

type RuleConditionsBuilderProps = {
  conditions: RuleCondition[];
  onChange: (conditions: RuleCondition[]) => void;
};

default: ({ conditions, onChange }: RuleConditionsBuilderProps) => ...
```

#### 8. **Chart Components (Recharts Tooltips)** - 5+ files
- `src/components/intelligence/customer/ChurnRiskChart.tsx`
- `src/components/intelligence/customer/CustomerActivityChart.tsx`
- `src/components/intelligence/customer/LtvByCohortChart.tsx`
- `src/components/intelligence/customer/LtvDistributionChart.tsx`

```typescript
// ❌ Recharts tooltip with any
const CustomTooltip = ({ active, payload }: any) => {
  // ...
  {payload.map((entry: any, index: number) => {
    // ...
  })}
};
```

**Fix:**
```typescript
// ✅ Correct with Recharts types
import { TooltipProps } from 'recharts';

type ChartDataItem = {
  name: string;
  count: number;
  percentage?: number;
};

const CustomTooltip = ({
  active,
  payload,
}: TooltipProps<number, string>) => {
  if (active && payload && payload.length) {
    const entry = payload[0].payload as ChartDataItem;
    // ...
  }
  return null;
};

// For legend mapping
{payload.map((entry: { value: string; color: string }, index: number) => {
  const dataEntry = entry.payload as ChartDataItem;
  // ...
})}
```

### LOW Priority (Archive & Legacy Code)

#### 9. **archive-old-decision-engine/** - 10+ vi phạm
- `api/decision-engine/health/route.ts`
- `api/decision-engine/replay/[id]/route.ts`

```typescript
// ❌ Archive files with any
async function getQueueMetrics(): Promise<{ status: string; pending: number; [key: string]: any } | null>
async function checkAuditHealth(supabase: any)
function generateDiff(original: any, replayed: any, ...)
```

**Note:** Đây là code archive, có thể defer fix hoặc xóa nếu không dùng

---

## 📊 Thống Kê Tổng Hợp

| Category | Files | Vi Phạm | Priority | Status |
|----------|-------|---------|----------|--------|
| Platform Engines | 0 | 0 | 🔴 CRITICAL | ✅ CLEAN |
| Test Mocks | 5 | ~50 | 🟡 HIGH | ⚠️ NEEDS FIX |
| UI Components | 5 | ~20 | 🟡 MEDIUM | ⚠️ NEEDS FIX |
| Archive Code | 2 | ~10 | 🟢 LOW | 📦 DEFER |
| **TOTAL** | **12** | **~80** | - | **VIOLATION** |

---

## 🚀 Remediation Plan

### Phase 1: Platform Engines (Week 5) - ✅ COMPLETE
**Status:** 100% compliant  
**Evidence:** No `any` types found in platform engines

### Phase 2: Test Infrastructure (Week 6)
**Target Files:**
1. `src/__tests__/e2e-pipeline.test.ts`
2. `src/__tests__/gps-geocode-attendance.test.ts`
3. `src/__tests__/portal-chat.test.ts`
4. `src/__tests__/security-hardening.test.ts`
5. `src/__tests__/subscription.test.ts`

**Effort:** 8-10 hours  
**Approach:**
- Create typed mock builders with generics
- Use Supabase Database types for all table references
- Type all Jest mocks with proper function signatures

### Phase 3: UI Components (Week 7)
**Target Files:**
1. Chart components (5 files)
2. Rule editor test mocks (1 file)
3. Finance PnL test mocks (1 file)

**Effort:** 4-6 hours  
**Approach:**
- Import proper types from `recharts`
- Define prop interfaces for all mock components
- Use React type helpers (`React.ChangeEvent`, etc.)

### Phase 4: Archive Cleanup (Optional)
**Target:** `archive-old-decision-engine/`  
**Effort:** 2 hours OR delete  
**Decision:** Defer until archive code is needed

---

## ⚙️ Enforcement Tools

### 1. TypeScript Config
```json
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "alwaysStrict": true
  }
}
```

### 2. ESLint Rule
```json
// .eslintrc.json
{
  "rules": {
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/no-unsafe-assignment": "error",
    "@typescript-eslint/no-unsafe-member-access": "error",
    "@typescript-eslint/no-unsafe-call": "error",
    "@typescript-eslint/no-unsafe-return": "error"
  }
}
```

### 3. Pre-commit Hook
```bash
#!/bin/bash
# .git/hooks/pre-commit

echo "🔍 Checking for 'any' type violations..."

# Search for any type in staged files
if git diff --cached --name-only | grep -E '\.(ts|tsx)$' | xargs grep -n ': any\|as any' > /dev/null 2>&1; then
  echo "❌ ERROR: 'any' type detected in staged files"
  echo ""
  echo "Files with violations:"
  git diff --cached --name-only | grep -E '\.(ts|tsx)$' | xargs grep -l ': any\|as any'
  echo ""
  echo "Please remove all 'any' types before committing."
  echo "See ANY_TYPE_VIOLATIONS_REPORT.md for proper patterns."
  exit 1
fi

echo "✅ No 'any' type violations found"
```

### 4. CI/CD Check
```yaml
# .github/workflows/type-check.yml
name: Type Safety Check

on: [push, pull_request]

jobs:
  type-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Check for any types
        run: |
          if grep -r --include="*.ts" --include="*.tsx" \
            --exclude-dir="node_modules" \
            --exclude-dir="archive-old-decision-engine" \
            ': any\|as any' .; then
            echo "❌ 'any' type violations found"
            exit 1
          fi
          
      - name: TypeScript strict check
        run: npm run type-check
```

---

## 📌 Summary

### Current Compliance: 🔴 ~20% (Platform only)
### Target Compliance: ✅ 100%
### Timeline: 2-3 weeks
### Blocker Status: 🟡 NON-BLOCKING (for pilot)

**Recommendation:**
- ✅ Platform engines are compliant (critical path safe)
- ⚠️ Fix test mocks in Phase 2 (Week 6)
- ⚠️ Fix UI components in Phase 3 (Week 7)
- 📦 Archive code can be deferred or deleted

**Rationale from AGENTS.md:**
> "Prevents runtime type errors caught only in production. Ensures database schema changes break compile-time (not runtime). Forces explicit error handling and validation. Eliminates 'works on my machine' bugs from type mismatches."

---

**Generated:** 09/08/2026  
**Next Review:** After Phase 2 completion (Week 6)  
**Owner:** Development Team  
**ARB Approval:** Required for any exceptions
