# 🛠️ Commission System - Implementation Template

**Purpose:** Step-by-step guide for implementing each commission system task  
**For:** Developers starting any task from the remaining 32 tasks  
**Usage:** Copy this template for each task you work on

---

## 📋 Task Implementation Checklist

### Before You Start

- [ ] Read task requirements from `COMMISSION_SYSTEM_REMAINING_TASKS.md`
- [ ] Read related code in MVP implementation
- [ ] Check dependencies completed
- [ ] Create feature branch: `feature/commission-task-[NUMBER]-[NAME]`
- [ ] Update your local database with latest migrations

### During Implementation

- [ ] Follow AGENTS.md rules (especially database typing, error handling)
- [ ] Write code incrementally (commit often)
- [ ] Test locally after each major change
- [ ] Use TypeScript strict mode (no `any` unless necessary)
- [ ] Follow existing code patterns
- [ ] Add JSDoc comments for exported functions
- [ ] Handle loading states in UI
- [ ] Handle error states gracefully

### After Implementation

- [ ] Run `npm run build` (must pass)
- [ ] Run `npm test` (all tests pass)
- [ ] Run `npm run lint` (no errors)
- [ ] Test on mobile viewport
- [ ] Test with real-looking data
- [ ] Create/update unit tests
- [ ] Update documentation if needed
- [ ] Create PR with clear description
- [ ] Demo to stakeholder/team

---

## 🎨 UI Task Template (Tasks 10-27, 33)

### Step 1: Design Review

**Questions to answer:**
- What is the user goal?
- What data needs to be displayed?
- What actions can user take?
- What are edge cases (empty, loading, error)?

**Wireframe:**
```
┌─────────────────────────────┐
│  [Component Name]           │
│                             │
│  [Main Content Area]        │
│                             │
│  [Action Buttons]           │
└─────────────────────────────┘
```

### Step 2: Component Structure

```typescript
// src/components/[module]/[ComponentName].tsx

'use client'; // if client component

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
// ... other imports

interface ComponentNameProps {
  // Define props
}

export default function ComponentName(props: ComponentNameProps) {
  // 1. State
  const [data, setData] = useState<Type[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 2. Data fetching
  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setIsLoading(true);
    try {
      const result = await fetchDataAction();
      setData(result);
    } catch (err) {
      setError(err.message);
      toast.error('Failed to load data');
    } finally {
      setIsLoading(false);
    }
  }

  // 3. Event handlers
  const handleAction = async () => {
    // Handle user actions
  };

  // 4. Render
  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorMessage error={error} />;
  if (data.length === 0) return <EmptyState />;

  return (
    <div className="component-container">
      {/* Main content */}
    </div>
  );
}
```

### Step 3: Server Actions

```typescript
// src/modules/[module]/actions/[action-name].ts

'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function actionName(input: InputType): Promise<Result> {
  const supabase = await createClient();

  // 1. Validate input
  if (!input.field) {
    return { success: false, error: 'Field is required' };
  }

  // 2. Check permissions
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: 'Unauthorized' };
  }

  // 3. Execute database operation
  try {
    const { data, error } = await supabase
      .from('table_name')
      .insert({ ...input })
      .select()
      .single();

    if (error) throw error;

    // 4. Revalidate cache
    revalidatePath('/dashboard/path');

    return { success: true, data };
  } catch (error) {
    console.error('Action failed:', error);
    return { success: false, error: error.message };
  }
}
```

### Step 4: Testing

```typescript
// src/components/__tests__/[ComponentName].test.tsx

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ComponentName from '../ComponentName';

describe('ComponentName', () => {
  it('renders correctly', () => {
    render(<ComponentName />);
    expect(screen.getByText('Expected Text')).toBeInTheDocument();
  });

  it('handles user interaction', async () => {
    render(<ComponentName />);
    const button = screen.getByRole('button', { name: 'Action' });
    fireEvent.click(button);
    await waitFor(() => {
      expect(screen.getByText('Success')).toBeInTheDocument();
    });
  });

  it('shows loading state', () => {
    render(<ComponentName />);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('handles errors gracefully', async () => {
    // Mock error
    render(<ComponentName />);
    await waitFor(() => {
      expect(screen.getByText(/error/i)).toBeInTheDocument();
    });
  });
});
```


---

## 🔧 Business Logic Task Template (Tasks 34-37)

### Step 1: Define Test Cases

```typescript
// List all scenarios to test
const testCases = [
  {
    name: 'normal case',
    input: { /* normal input */ },
    expected: { /* expected output */ }
  },
  {
    name: 'edge case: zero value',
    input: { /* edge input */ },
    expected: { /* expected output */ }
  },
  {
    name: 'error case: invalid input',
    input: { /* invalid input */ },
    expected: { /* error */ }
  },
];
```

### Step 2: Write Tests First (TDD)

```typescript
// src/lib/business-rules/__tests__/[feature].test.ts

describe('[Feature] Business Logic', () => {
  describe('happy path', () => {
    it('calculates correctly with valid input', () => {
      const result = functionName(validInput);
      expect(result).toBe(expectedValue);
    });
  });

  describe('edge cases', () => {
    it('handles zero values', () => {
      const result = functionName(0);
      expect(result).toBe(0);
    });

    it('handles very large numbers', () => {
      const result = functionName(Number.MAX_SAFE_INTEGER);
      expect(result).toBeLessThan(Number.MAX_SAFE_INTEGER);
    });

    it('handles negative values', () => {
      const result = functionName(-100);
      expect(result).toBeGreaterThanOrEqual(0);
    });
  });

  describe('boundary conditions', () => {
    it('handles exact boundary values', () => {
      const result = functionName(boundaryValue);
      expect(result).toBe(expectedBoundaryResult);
    });
  });

  describe('error handling', () => {
    it('throws on invalid input', () => {
      expect(() => functionName(invalidInput)).toThrow();
    });

    it('returns safe default on null input', () => {
      const result = functionName(null);
      expect(result).toBe(defaultValue);
    });
  });
});
```

### Step 3: Implement Logic

```typescript
// src/lib/business-rules/[feature].ts

/**
 * Function description
 * 
 * @param input - Description
 * @returns Description
 * 
 * @example
 * ```typescript
 * const result = functionName(input);
 * // result === expected
 * ```
 */
export function functionName(input: InputType): OutputType {
  // 1. Input validation
  if (!isValid(input)) {
    throw new Error('Invalid input');
  }

  // 2. Handle edge cases
  if (input === 0) return 0;
  if (input < 0) return 0;

  // 3. Main logic
  const result = calculateResult(input);

  // 4. Return result
  return result;
}
```

---

## 🗄️ Database Task Template (Already completed in MVP)

### Migration File Structure

```sql
-- ============================================
-- Migration: [Description]
-- Date: YYYY-MM-DD HH:MM:SS
-- Epic: [Epic Name]
-- ============================================
--
-- Purpose:
-- [Detailed explanation of what this migration does]
--
-- Business Rules:
-- 1. [Rule 1]
-- 2. [Rule 2]

-- Create table
CREATE TABLE IF NOT EXISTS public.table_name (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  -- other columns
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_table_name_tenant
  ON public.table_name (tenant_id);

-- RLS Policies
ALTER TABLE public.table_name ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Table read policy" ON public.table_name;
CREATE POLICY "Table read policy"
  ON public.table_name
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_auth_tenant_id());

-- Grants
REVOKE ALL ON TABLE public.table_name FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.table_name TO authenticated;

-- Comments
COMMENT ON TABLE public.table_name IS 'Description';
```

---

## 📝 Documentation Task Template (Tasks 38-40)

### Structure for User Guides

```markdown
# [Guide Title]

**Audience:** [Who is this for?]
**Last Updated:** [Date]

---

## Table of Contents

1. [Introduction](#introduction)
2. [Getting Started](#getting-started)
3. [Main Features](#main-features)
4. [Advanced Topics](#advanced-topics)
5. [Troubleshooting](#troubleshooting)
6. [FAQ](#faq)

---

## Introduction

[What is this guide about? Why is it important?]

---

## Getting Started

### Prerequisites

- [ ] Requirement 1
- [ ] Requirement 2

### Quick Start

**Step 1:** [Action]
[Screenshot or code example]

**Step 2:** [Action]
[Screenshot or code example]

**Step 3:** [Action]
[Screenshot or code example]

---

## Main Features

### Feature 1: [Name]

**What it does:** [Explanation]

**How to use:**
1. [Step 1]
2. [Step 2]
3. [Step 3]

**Example:**
```
[Code or screenshot]
```

**Tips:**
- Tip 1
- Tip 2

---

## Troubleshooting

### Issue: [Common Problem]

**Symptoms:**
- Symptom 1
- Symptom 2

**Solution:**
1. Check [X]
2. Verify [Y]
3. If still broken, [Z]

---

## FAQ

**Q: [Question]?**
A: [Answer]

**Q: [Question]?**
A: [Answer]
```


---

## 🚀 Deployment Task Template (Tasks 41-44)

### Pre-Deployment Checklist

```markdown
## Pre-Deployment Verification

**Date:** [Date]
**Environment:** [Staging/Production]
**Deployer:** [Name]

### Code Quality
- [ ] All tests passing locally
- [ ] Build successful (no errors)
- [ ] Linting passed
- [ ] No console.errors in production
- [ ] No TODO comments in critical code

### Database
- [ ] Migrations reviewed
- [ ] Migrations tested on staging
- [ ] Backup plan documented
- [ ] Rollback script tested
- [ ] Data migration plan (if needed)

### Testing
- [ ] Unit tests: [X/Y] passing
- [ ] Integration tests: [X/Y] passing
- [ ] E2E tests: [X/Y] passing
- [ ] Manual testing completed
- [ ] QA sign-off received

### Performance
- [ ] Load testing completed
- [ ] Query performance acceptable
- [ ] No N+1 queries
- [ ] Caching strategy implemented
- [ ] Database indexes optimized

### Security
- [ ] RLS policies verified
- [ ] No secrets in code
- [ ] Input validation implemented
- [ ] SQL injection prevention checked
- [ ] XSS prevention verified

### Documentation
- [ ] User guide updated
- [ ] Admin guide updated
- [ ] API documentation updated
- [ ] Deployment steps documented
- [ ] Rollback plan documented

### Stakeholders
- [ ] Product owner notified
- [ ] Support team briefed
- [ ] Users notified (if needed)
- [ ] Maintenance window scheduled
```

### Deployment Script Template

```bash
#!/bin/bash
# deploy-commission-system.sh

set -e  # Exit on error

echo "========================================="
echo "Commission System Deployment"
echo "Environment: $ENVIRONMENT"
echo "Date: $(date)"
echo "========================================="

# 1. Pre-deployment checks
echo "Running pre-deployment checks..."
npm run test || exit 1
npm run build || exit 1
echo "✓ Pre-deployment checks passed"

# 2. Database backup
echo "Backing up database..."
BACKUP_FILE="backup_$(date +%Y%m%d_%H%M%S).sql"
pg_dump $DATABASE_URL > $BACKUP_FILE
echo "✓ Backup saved: $BACKUP_FILE"

# 3. Enable maintenance mode (optional)
echo "Enabling maintenance mode..."
# curl -X POST https://api.example.com/maintenance/enable

# 4. Run migrations
echo "Running database migrations..."
for migration in supabase/migrations/202606221*.sql; do
    echo "Running $migration..."
    psql $DATABASE_URL < $migration
done
echo "✓ Migrations completed"

# 5. Verify schema
echo "Verifying schema changes..."
psql $DATABASE_URL -c "\dt booking_service_items"
psql $DATABASE_URL -c "\d salary_records"
echo "✓ Schema verified"

# 6. Deploy application
echo "Deploying application..."
# Your deployment command here
# vercel deploy --prod
# git push heroku main
echo "✓ Application deployed"

# 7. Run smoke tests
echo "Running smoke tests..."
npm run test:smoke || {
    echo "✗ Smoke tests failed! Rolling back..."
    ./rollback.sh
    exit 1
}
echo "✓ Smoke tests passed"

# 8. Disable maintenance mode
echo "Disabling maintenance mode..."
# curl -X POST https://api.example.com/maintenance/disable

# 9. Post-deployment verification
echo "Running post-deployment checks..."
curl -f https://api.example.com/health || exit 1
echo "✓ Health check passed"

echo "========================================="
echo "Deployment completed successfully!"
echo "Backup: $BACKUP_FILE"
echo "========================================="
```

### Rollback Script Template

```bash
#!/bin/bash
# rollback-commission-system.sh

set -e

echo "========================================="
echo "Rolling back Commission System"
echo "========================================="

# 1. Find latest backup
LATEST_BACKUP=$(ls -t backup_*.sql | head -1)
echo "Using backup: $LATEST_BACKUP"

# 2. Confirm rollback
read -p "Are you sure you want to rollback? (yes/no): " confirm
if [ "$confirm" != "yes" ]; then
    echo "Rollback cancelled"
    exit 0
fi

# 3. Drop new tables
echo "Dropping new tables..."
psql $DATABASE_URL <<EOF
DROP TABLE IF EXISTS booking_service_items CASCADE;
DROP TABLE IF EXISTS product_sales CASCADE;
DROP TABLE IF EXISTS salary_adjustments CASCADE;
EOF

# 4. Remove new columns
echo "Removing new columns..."
psql $DATABASE_URL <<EOF
ALTER TABLE salary_records 
  DROP COLUMN IF EXISTS service_commission,
  DROP COLUMN IF EXISTS product_sales_commission,
  DROP COLUMN IF EXISTS position_bonus,
  DROP COLUMN IF EXISTS seniority_bonus,
  DROP COLUMN IF EXISTS manual_adjustments;

ALTER TABLE users 
  DROP COLUMN IF EXISTS position_tier,
  DROP COLUMN IF EXISTS hire_date;

ALTER TABLE tenants 
  DROP COLUMN IF EXISTS commission_config;
EOF

# 5. Restore from backup (if needed)
# psql $DATABASE_URL < $LATEST_BACKUP

# 6. Deploy previous version
echo "Deploying previous version..."
# Your deployment command for previous version

echo "✓ Rollback completed"
```


---

## 🐛 Debugging Guide

### Common Issues & Solutions

#### Issue 1: TypeScript Errors for New Tables

**Error:**
```
Property 'booking_service_items' does not exist
```

**Solution:**
```bash
# Regenerate database types
supabase gen types typescript --local > src/types/database.types.ts

# Or temporarily cast to any (MVP approach)
const { data } = await (supabase as any)
  .from('booking_service_items')
  .select('*');
```

---

#### Issue 2: Commission Not Calculating

**Debug Steps:**
1. Check if migrations ran successfully
2. Verify data exists in commission tables
3. Check status field is 'completed'
4. Verify date range is correct
5. Check salary recalculation was triggered
6. Add console.logs in salary engine:

```typescript
console.log('Service items:', serviceItems);
console.log('Calculated commission:', liveServiceCommission);
console.log('Final total salary:', calculatedTotalSalary);
```

---

#### Issue 3: RLS Policy Blocking Queries

**Error:**
```
new row violates row-level security policy
```

**Solution:**
1. Check current user's tenant_id matches data tenant_id
2. Verify RLS policies are correct:

```sql
-- Check policies
SELECT * FROM pg_policies WHERE tablename = 'booking_service_items';

-- Test policy manually
SET LOCAL role authenticated;
SET LOCAL request.jwt.claims.user_id TO 'user-uuid';
SELECT * FROM booking_service_items;
```

---

#### Issue 4: Performance Slow

**Debug Steps:**
1. Check query execution time:

```sql
EXPLAIN ANALYZE
SELECT * FROM booking_service_items
WHERE ktv_id = 'uuid' AND completed_date >= '2026-06-01';
```

2. Verify indexes exist:

```sql
SELECT * FROM pg_indexes 
WHERE tablename = 'booking_service_items';
```

3. Add missing indexes if needed:

```sql
CREATE INDEX idx_name ON table_name (column);
```

---

## 📊 Testing Strategy

### Test Pyramid

```
        /\
       /E2E\          (Few - Critical paths)
      /------\
     /Integration\    (Some - Key flows)
    /------------\
   /  Unit Tests  \   (Many - Business logic)
  /----------------\
```

### What to Test

**Unit Tests (Most):**
- Business logic functions
- Data transformations
- Edge cases
- Error handling

**Integration Tests (Some):**
- Database operations
- API endpoints
- Server actions
- Multi-step flows

**E2E Tests (Few):**
- Critical user journeys
- End-to-end scenarios
- Cross-feature interactions

### Test Coverage Goals

- **Business Logic:** 90%+ coverage
- **Components:** 70%+ coverage
- **Integration:** 50%+ coverage
- **E2E:** Critical paths only

---

## 🎯 Code Review Checklist

### Before Creating PR

- [ ] Code follows project style guide
- [ ] No commented-out code
- [ ] No debug console.logs
- [ ] Error handling implemented
- [ ] Loading states handled
- [ ] Empty states handled
- [ ] Mobile responsive
- [ ] Accessibility considerations
- [ ] Performance optimized
- [ ] Tests written and passing
- [ ] Documentation updated

### PR Description Template

```markdown
## Task: [Task Number] - [Task Name]

**Type:** Feature / Bug Fix / Enhancement

### Changes
- Change 1
- Change 2
- Change 3

### Testing
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Manual testing completed
- [ ] Mobile tested

### Screenshots
[Add screenshots for UI changes]

### Checklist
- [ ] Code builds successfully
- [ ] All tests passing
- [ ] No linting errors
- [ ] Documentation updated
- [ ] Ready for review

### Related
- Related PR: #123
- Closes issue: #456
```

---

## 💡 Best Practices

### 1. Database Operations

```typescript
// ✅ Good: Handle errors explicitly
try {
  const { data, error } = await supabase
    .from('table')
    .insert(payload);
  
  if (error) throw error;
  return { success: true, data };
} catch (error) {
  console.error('Operation failed:', error);
  return { success: false, error: error.message };
}

// ❌ Bad: Swallow errors
const { data } = await supabase.from('table').insert(payload);
return { success: true }; // What if it failed?
```

### 2. Type Safety

```typescript
// ✅ Good: Use generated types
import { Database } from '@/types/database.types';
type ServiceItem = Database['public']['Tables']['booking_service_items']['Row'];

// ❌ Bad: Use any
const items: any[] = await getItems();
```

### 3. Component Structure

```typescript
// ✅ Good: Clear structure
function Component() {
  // 1. Hooks
  // 2. State
  // 3. Effects
  // 4. Event handlers
  // 5. Render helpers
  // 6. Main render
}

// ❌ Bad: Mixed order, hard to follow
function Component() {
  const handler = () => {}; // Handler first?
  useEffect(() => {}); // Effect in middle?
  const [state] = useState(); // State at end?
}
```

### 4. Error Messages

```typescript
// ✅ Good: User-friendly messages
toast.error('Không thể lưu hoa hồng. Vui lòng thử lại.');

// ❌ Bad: Technical jargon
toast.error('PGSQL Error: constraint violation on FK');
```

---

## 📚 Resources

### Internal Documentation
- `docs/COMMISSION_SYSTEM_MVP_SUMMARY.md` - Overview
- `docs/COMMISSION_SYSTEM_QUICKSTART.md` - Quick start
- `docs/COMMISSION_SYSTEM_REMAINING_TASKS.md` - Task list
- `AGENTS.md` - Development rules

### External Resources
- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [React Testing Library](https://testing-library.com/react)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

---

**Template Version:** 1.0  
**Last Updated:** 2026-06-22  
**Maintainer:** Development Team

_Use this template as a starting point for any commission system task!_
