# Bella ERP - Developer Onboarding Guide

Welcome to the Bella ERP development team! This guide will help you get up to speed with our codebase, architecture, and development workflows.

## 📋 Table of Contents

1. [Quick Start](#quick-start)
2. [Architecture Overview](#architecture-overview)
3. [Key Concepts](#key-concepts)
4. [Development Workflow](#development-workflow)
5. [Common Tasks](#common-tasks)
6. [Code Style & Standards](#code-style--standards)
7. [Testing](#testing)
8. [Troubleshooting](#troubleshooting)
9. [Resources](#resources)

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm 9+
- Git
- Supabase CLI (for local development)
- VS Code (recommended) with recommended extensions

### Initial Setup

```bash
# 1. Clone the repository
git clone <repository-url>
cd bella-spa-erp

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env.local
# Edit .env.local with your Supabase credentials

# 4. Run database migrations (if needed)
npm run db:migrate

# 5. Start development server
npm run dev

# 6. Run tests to verify setup
npm test
```

### Verify Setup

Visit `http://localhost:3000` - you should see the login page.

---

## 🏗️ Architecture Overview

### Multi-Tenant SaaS Architecture

Bella ERP is a **multi-tenant SaaS platform** for service businesses (spa, salon, clinic, etc.). Each tenant (branch) has isolated data.

### Tech Stack

- **Frontend**: Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS
- **Backend**: Next.js Server Actions, Supabase (PostgreSQL + Auth + Storage)
- **Accounting**: Double-entry bookkeeping with transactional outbox pattern
- **State**: React Server Components (minimal client state)
- **Testing**: Jest, React Testing Library

### Directory Structure

```
bella-spa-erp/
├── src/
│   ├── app/                    # Next.js App Router pages
│   ├── components/             # Shared UI components
│   ├── core/                   # Core business logic (industry-agnostic)
│   │   ├── services/           # Core services (accounting, finance, order)
│   │   ├── types/              # Core types and interfaces
│   │   └── lib/                # Core utilities
│   ├── modules/                # Industry-specific modules
│   │   ├── spa/                # Spa industry module
│   │   ├── hr-salary/          # Salary calculation module
│   │   └── [future]/           # Future industry modules (retail, clinic, etc.)
│   ├── lib/                    # Shared libraries and utilities
│   │   └── business-rules/     # Business rule implementations
│   ├── constants/              # Application constants
│   ├── services/               # Top-level service orchestrators
│   └── types/                  # Shared types (database, domain, etc.)
├── docs/                       # Documentation
├── tests/                      # Integration and E2E tests
└── supabase/                   # Database schema and migrations
```

### Architectural Layers

```
┌─────────────────────────────────────┐
│         UI Layer (Components)        │
│  Next.js Pages, React Components    │
└─────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────┐
│      Service Layer (Actions)         │
│   Server Actions, API Routes        │
└─────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────┐
│    Business Logic Layer (Core)       │
│  Services, Business Rules, Adapters │
└─────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────┐
│       Data Layer (Supabase)          │
│    PostgreSQL, RLS, Functions       │
└─────────────────────────────────────┘
```

---

## 💡 Key Concepts

### 1. Multi-Tenancy

**Every database query MUST filter by `tenant_id`.**

```typescript
// ✅ Correct - tenant-scoped query
const { data } = await supabase
  .from('bookings')
  .select('*')
  .eq('tenant_id', user.tenant_id);

// ❌ Wrong - missing tenant filter
const { data } = await supabase
  .from('bookings')
  .select('*');
```

### 2. Double-Entry Accounting

All financial transactions (revenue, expenses, salaries) generate double-entry journal entries:

- **Debit = Credit** (always balanced)
- Posted via **transactional outbox pattern** for eventual consistency
- Journal entries link back to source transactions via `reference_type` and `reference_id`

**Key Files:**
- `src/services/accounting-engine.ts` - Accounting engine
- `src/core/services/accounting/` - Accounting services
- `supabase/functions/accounting-worker/` - Background worker

### 3. Salary Calculation Engine

KTV (employee) salaries are calculated using:

- **Pro-rata base salary**: `(base_salary / 26) × actualWorkingDays`
- **Session commissions**: Per-session commission (default 150,000đ)
- **Package multipliers**: Basic 1.0x, Premium 1.5x, VIP 2.0x
- **Rating bonuses**: 5★ = 50k, 4.5★ = 30k, 4★ = 10k per weighted session
- **KPI bonuses**: 1M đ if ≥30 weighted sessions/month
- **Attendance deductions**: Late/absent penalties

**Key Files:**
- `src/lib/business-rules/salary.ts` - Salary calculation functions
- `src/modules/hr-salary/actions/` - Salary actions and engine
- `src/constants/business-rules.ts` - Business constants

### 4. Session Completion Workflow

When a KTV completes a service session:

1. **Validate accounting period** (must be open)
2. **Consume inventory** (products used)
3. **Update booking progress** (`completed_sessions++`)
4. **Record revenue** (if pay-per-session)
5. **Recalculate KTV salary** (add session commission)
6. **Create review placeholder** (customer can review)
7. **Queue accounting entry** (double-entry journal)
8. **Invoke module adapter** (industry-specific side-effects)

**Key File:**
- `src/core/services/order/session-completion-engine.ts`

### 5. Status Lifecycle Management

**Booking Status:**
```
draft → booked → in_progress → completed → canceled
```

**Salary Record Status:**
```
draft → pending_approval → published → confirmed → finalized
```

**Journal Entry Status:**
```
DRAFT → POSTED → CANCELED
```

**Revenue/Expense Status:**
```
pending → confirmed/approved → paid
```

### 6. Business Rules Constants

**Never hardcode magic numbers!** Use constants from:

```typescript
import { BUSINESS_RULES } from '@/constants/business-rules';

// Salary calculations
BUSINESS_RULES.PAYROLL.WORKING_DAYS_PER_MONTH  // 26
BUSINESS_RULES.PAYROLL.MIN_WORKING_DAYS_FOR_BONUS  // 22

// Session multipliers
BUSINESS_RULES.SESSIONS.MULTIPLIERS.BASIC   // 1.0
BUSINESS_RULES.SESSIONS.MULTIPLIERS.HAPPY   // 1.5
BUSINESS_RULES.SESSIONS.MULTIPLIERS.VIP     // 2.0

// Rating thresholds
BUSINESS_RULES.SESSIONS.MIN_RATING_FOR_BONUS  // 4.5
```

---

## 🔄 Development Workflow

### 1. Create Feature Branch

```bash
# Create feature branch from main
git checkout main
git pull origin main
git checkout -b feature/your-feature-name
```

### 2. Make Changes

- Follow [Code Style & Standards](#code-style--standards)
- Write tests for new features
- Update JSDoc documentation
- Run linter and tests

```bash
npm run lint
npm test
```

### 3. Commit Changes

Use [Conventional Commits](https://www.conventionalcommits.org/):

```bash
git commit -m "feat(booking): add package reuse functionality"
git commit -m "fix(salary): correct pro-rata calculation for partial months"
git commit -m "docs(jsdoc): add documentation to session completion engine"
git commit -m "refactor(accounting): extract duplicate error handling"
git commit -m "test(salary): add tests for KPI bonus calculation"
```

**Commit Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `refactor`: Code refactoring (no functional change)
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

### 4. Create Pull Request

```bash
# Push branch
git push origin feature/your-feature-name

# Create PR on GitHub/GitLab
# Include description, screenshots, testing notes
```

### 5. Code Review

- Address review comments
- Ensure all CI checks pass
- Update documentation if needed

### 6. Merge

- Squash commits if needed
- Delete feature branch after merge

---

## 🛠️ Common Tasks

### Add a New Booking

```typescript
import { createBooking } from '@/core/services/order';

const result = await createBooking({
  customer_id: 'customer-uuid',
  package_id: 'package-uuid',
  preferred_date: '2026-06-20',
  preferred_time: '14:00',
  deposit_amount: 1000000,
});

if ('error' in result) {
  console.error(result.error);
} else {
  console.log('Booking created:', result.data.id);
}
```

### Complete a Session

```typescript
import { completeSession } from '@/core/services/order';

const result = await completeSession({
  sessionId: 'session-uuid',
  ktvId: 'ktv-uuid',
  rating: 5,
  notes: 'Excellent service',
});
```

### Recalculate KTV Salary

```typescript
import { recalculateAndSaveSalaryRecord } from '@/modules/hr-salary/actions';

const result = await recalculateAndSaveSalaryRecord(
  supabase,
  'ktv-uuid',
  '2026-06-01',  // monthYear (YYYY-MM-01)
  'tenant-uuid'
);

console.log(`Total salary: ${result.totalSalary.toLocaleString('vi-VN')}đ`);
```

### Generate Financial Report

```typescript
import { getMonthlyPnL } from '@/core/services/finance';

const pnl = await getMonthlyPnL('2026-06-01');

console.log(`Revenue: ${pnl.total_revenue.toLocaleString('vi-VN')}đ`);
console.log(`Expenses: ${pnl.total_operating_expenses.toLocaleString('vi-VN')}đ`);
console.log(`Net Profit: ${pnl.net_profit.toLocaleString('vi-VN')}đ`);
```

### Post Manual Journal Entry

```typescript
import { postManualJournalEntry } from '@/core/services/accounting';

const result = await postManualJournalEntry({
  description: 'Điều chỉnh doanh thu',
  entry_date: '2026-06-30',
  lines: [
    { account_id: 'account-1', debit_amount: 1000000, credit_amount: 0 },
    { account_id: 'account-2', debit_amount: 0, credit_amount: 1000000 },
  ],
});
```

---

## 📝 Code Style & Standards

### TypeScript

- **Always use explicit types** - avoid `any` unless absolutely necessary
- **Use interfaces for objects** - not `type` (except for unions)
- **Document all exported functions** with JSDoc
- **Use `const` over `let`** - immutability by default

```typescript
// ✅ Good
interface User {
  id: string;
  name: string;
  email: string;
}

/**
 * Fetches user by ID.
 * @param userId - User UUID
 * @returns User object or null
 */
async function getUser(userId: string): Promise<User | null> {
  // ...
}

// ❌ Bad
function getUser(userId: any): any {
  // ...
}
```

### Error Handling

**Use custom error classes** from `src/core/lib/errors.ts`:

```typescript
import { BookingError, SalaryError } from '@/core/lib/errors';

// ✅ Good
if (!ktvAvailable) {
  throw new BookingError('KTV not available', 'BOOKING_KTV_NOT_AVAILABLE');
}

// ❌ Bad
if (!ktvAvailable) {
  throw new Error('KTV not available');
}
```

### Database Queries

**Zero Silent Database Failures:**

```typescript
// ✅ Good - throw or return error
const { data, error } = await supabase.from('users').select('*');
if (error) throw error;  // or return { error: error.message }

// ❌ Bad - silent failure
const { data, error } = await supabase.from('users').select('*');
if (error) console.error(error);  // Only logging!
return { success: true };  // Lying about success
```

### Status Filters in Financial Reports

**Always filter by status:**

```typescript
// ✅ Good - only confirmed revenue
const revenue = await supabase
  .from('revenue')
  .select('amount')
  .eq('status', 'confirmed');

// ❌ Bad - includes pending/unconfirmed
const revenue = await supabase
  .from('revenue')
  .select('amount');
```

### JSDoc Documentation

All exported functions MUST have comprehensive JSDoc:

```typescript
/**
 * Calculates pro-rata base salary for partial month.
 * 
 * @param baseSalary - Full monthly base salary
 * @param actualDays - Actual working days in period
 * @returns Pro-rated salary amount
 * 
 * @remarks
 * Uses 26 as standard working days per month.
 * Formula: `(baseSalary / 26) × actualDays`
 * 
 * @example
 * ```typescript
 * const proRata = calculateProRata(6000000, 20);
 * // Returns 4615385 (6M / 26 × 20)
 * ```
 */
export function calculateProRata(baseSalary: number, actualDays: number): number {
  return Math.round((baseSalary / 26) * actualDays);
}
```

---

## 🧪 Testing

### Run Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test salary.test.ts

# Run tests in watch mode
npm test -- --watch

# Run tests with coverage
npm run test:coverage
```

### Write Tests

```typescript
// src/__tests__/services/salary.test.ts
import { calculateProRata } from '@/lib/business-rules/salary';

describe('calculateProRata', () => {
  it('should calculate pro-rata salary for full month', () => {
    const result = calculateProRata(6000000, 26);
    expect(result).toBe(6000000);
  });

  it('should calculate pro-rata salary for partial month', () => {
    const result = calculateProRata(6000000, 20);
    expect(result).toBe(4615385);
  });

  it('should return 0 for zero days', () => {
    const result = calculateProRata(6000000, 0);
    expect(result).toBe(0);
  });
});
```

### Testing Principles

1. **Test business logic, not implementation details**
2. **Write descriptive test names** - `should calculate pro-rata salary for partial month`
3. **Test edge cases** - zero, negative, null, undefined
4. **Mock external dependencies** - database, APIs
5. **Assert side effects** - database updates, accounting entries

---

## 🐛 Troubleshooting

### Common Issues

#### Database Connection Errors

```
Error: Failed to connect to Supabase
```

**Solution:** Check `.env.local` has correct credentials:
```
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

#### TypeScript Errors After Pull

```
Type 'X' is not assignable to type 'Y'
```

**Solution:** Regenerate database types:
```bash
npm run generate:types
```

#### Tests Failing After Refactoring

```
Expected X but received Y
```

**Solution:** Update test snapshots:
```bash
npm test -- -u
```

#### Accounting Outbox Stuck

Check accounting outbox dashboard:
```
/dashboard/accounting/outbox
```

Replay failed events or check worker logs.

---

## 📚 Resources

### Documentation

- **Main Docs**: `/docs/index.md` - Start here
- **AI Agent Onboarding**: `/docs/AI_AGENT_ONBOARDING.md`
- **Industry Module Development**: `/docs/INDUSTRY_MODULE_DEVELOPMENT_PLAYBOOK.md`
- **Knowledge Storage**: `/docs/KNOWLEDGE_STORAGE_PROCESS.md`

### Code Reference

- **Business Rules**: `src/constants/business-rules.ts`
- **Error Classes**: `src/core/lib/errors.ts`
- **Salary Calculations**: `src/lib/business-rules/salary.ts`
- **Accounting Engine**: `src/services/accounting-engine.ts`

### External Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [Vietnamese Accounting Standards (TT133)](https://thuvienphapluat.vn/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

### Getting Help

- **Code Questions**: Check JSDoc in relevant files
- **Architecture Questions**: Read `/docs/index.md`
- **Bug Reports**: Create GitHub issue with reproduction steps
- **Feature Requests**: Discuss with team lead first

---

## 🎯 Next Steps

1. ✅ Complete initial setup
2. ✅ Read architecture overview
3. ✅ Understand key concepts
4. 📝 Pick your first task from project board
5. 🔧 Set up VS Code with recommended extensions
6. 🧪 Run tests and verify everything works
7. 💬 Introduce yourself to the team
8. 🚀 Start coding!

---

**Welcome to the team! Happy coding! 🎉**

For questions or clarifications, reach out to your team lead or check the documentation links above.

Last Updated: 2026-06-17
