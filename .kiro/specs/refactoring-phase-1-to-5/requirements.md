# Bella ERP - Code Refactoring (Phase 1-5)

**Spec Type**: Refactoring  
**Priority**: Medium  
**Target Score**: 94.2 → 97.8/100  
**Duration**: 6-8 weeks  
**Created**: 2026-06-17

---

## 🎯 Overview

This spec covers systematic code refactoring to improve code quality from **94.2/100** (Excellent) to **97.8/100** (Near Perfect). The refactoring is divided into 5 phases focusing on type safety, code quality, documentation, and performance.

---

## 📋 Requirements

### REQ-1: Type Safety Improvements

**Priority**: HIGH  
**Effort**: 2 weeks

#### REQ-1.1: Remove `any` Types from Production Code
- **Description**: Replace all `any` types with proper TypeScript types
- **Current State**: ~50+ `any` types in codebase
- **Target State**: <5 `any` types (only in justified edge cases)
- **Acceptance Criteria**:
  - Zero `any` types in `src/core/services/`
  - Zero `any` types in `src/modules/spa/services/`
  - <5 `any` types in test files (with JSDoc justification)
  - TypeScript strict mode passes without errors

#### REQ-1.2: Type Mock Builders Properly
- **Description**: Add proper types to all mock query builders in tests
- **Files Affected**:
  - `src/__tests__/accounting-engine.test.ts`
  - `src/__tests__/cross-module-integrity.test.ts`
  - `src/__tests__/e2e-negative-pipeline.test.ts`
- **Acceptance Criteria**:
  - All mock builders have proper generic types
  - IDE autocomplete works for mock objects
  - No type errors in test files

---

### REQ-2: ESLint & Code Quality

**Priority**: HIGH  
**Effort**: 3 days

#### REQ-2.1: Fix Unused Variable Warnings
- **Description**: Remove or properly mark unused variables
- **Current State**: ~15 unused variable warnings
- **Target State**: 0 warnings
- **Acceptance Criteria**:
  - All unused variables either removed or prefixed with `_`
  - ESLint passes without warnings in affected files

#### REQ-2.2: Fix Next.js Best Practices
- **Description**: Replace `<img>` with Next.js `<Image>` component
- **Current State**: 0 violations found (already compliant)
- **Target State**: Maintain compliance
- **Acceptance Criteria**:
  - No `<img>` tags in production code
  - All images use Next.js Image component

#### REQ-2.3: Fix React Best Practices  
- **Description**: Escape special characters in JSX
- **Current State**: ~2 unescaped entity warnings
- **Target State**: 0 warnings
- **Acceptance Criteria**:
  - All apostrophes escaped as `&apos;`
  - No React unescaped entity warnings

---

### REQ-3: Extract Magic Numbers

**Priority**: MEDIUM  
**Effort**: 3 days

#### REQ-3.1: Create Business Rules Constants
- **Description**: Extract all magic numbers to named constants
- **Target State**: New file `src/constants/business-rules.ts`
- **Constants to Extract**:
  ```typescript
  WORKING_DAYS_PER_MONTH = 26
  MIN_WORKING_DAYS_FOR_BONUS = 22
  SESSION_MULTIPLIERS = { BASIC: 1.0, HAPPY: 1.5, VIP: 2.0 }
  MIN_RATING_FOR_BONUS = 4.5
  LOW_STOCK_THRESHOLD = 10
  REORDER_POINT = 20
  ```
- **Acceptance Criteria**:
  - File `src/constants/business-rules.ts` created
  - All magic numbers replaced in affected files
  - Tests still pass

---

### REQ-4: Error Handling Improvements

**Priority**: MEDIUM  
**Effort**: 3 days

#### REQ-4.1: Create Error Hierarchy
- **Description**: Create structured error classes
- **Target State**: New file `src/core/lib/errors.ts`
- **Error Classes**:
  ```typescript
  - AppError (base)
  - BookingError extends AppError
  - PaymentError extends AppError
  - InventoryError extends AppError
  - SalaryError extends AppError
  - ValidationError extends AppError
  ```
- **Acceptance Criteria**:
  - Error hierarchy file created
  - Each error class has `code` and optional `details` field
  - Can serialize to JSON for logging

#### REQ-4.2: Replace Generic Errors
- **Description**: Replace `throw new Error(...)` with specific error classes
- **Files Affected**: Core services that throw errors
- **Acceptance Criteria**:
  - At least 50% of generic errors replaced
  - Error messages are descriptive and actionable
  - Tests updated to catch specific error types

---

### REQ-5: Documentation

**Priority**: MEDIUM  
**Effort**: 1 week

#### REQ-5.1: Add JSDoc to Complex Functions
- **Description**: Add comprehensive JSDoc comments
- **Target**: ~70 functions in core services
- **Acceptance Criteria**:
  - All exported functions have JSDoc
  - JSDoc includes: description, @param, @returns, @throws, @example
  - Complex algorithms have @remarks explaining logic

---

### REQ-6: Architecture Cleanup

**Priority**: HIGH  
**Effort**: 4 days

#### REQ-6.1: Fix Dependency Violations
- **Description**: Fix 3 MEDIUM severity dependency violations
- **Current Architecture Score**: 93%
- **Target Architecture Score**: 98%
- **Acceptance Criteria**:
  - No circular dependencies
  - Core doesn't import from modules
  - Modules only import from core through adapters
  - `npm run lint:strict` passes

#### REQ-6.2: Extract Duplicate Code
- **Description**: Identify and extract common patterns
- **Current Duplication**: <3%
- **Target Duplication**: <1.5%
- **Acceptance Criteria**:
  - Common query patterns extracted to helpers
  - Error handling patterns extracted
  - Code duplication metrics improved

---

### REQ-7: Testing & Coverage

**Priority**: LOW  
**Effort**: 1 week

#### REQ-7.1: Add Utility Tests
- **Description**: Increase test coverage for utilities
- **Current Coverage**: 78%
- **Target Coverage**: 85%
- **Files Needing Tests**:
  - `src/lib/validations.ts` (8 functions, 0 tests)
  - `src/lib/promotions.ts` (5 functions, 2 tests)
  - `src/lib/form-validators.ts` (10 functions, 3 tests)
  - `src/utils/geo.ts` (4 functions, 0 tests)
- **Acceptance Criteria**:
  - Coverage >= 85%
  - All edge cases tested
  - Tests pass reliably

---

### REQ-8: Performance Optimization

**Priority**: LOW  
**Effort**: 3 days

#### REQ-8.1: Add Memoization
- **Description**: Optimize expensive React components
- **Components to Optimize**:
  - `StatsGrid.tsx`
  - `RevenueChart.tsx`
  - `KtvPerformanceTable.tsx`
- **Acceptance Criteria**:
  - `useMemo` added for expensive computations
  - Re-render time reduced by 30%+
  - No performance regressions

---

## 🚫 Non-Goals

The following are explicitly **NOT** in scope:

1. ❌ Database schema changes
2. ❌ Rewriting business logic (unless broken)
3. ❌ Framework migration (Next.js → something else)
4. ❌ GraphQL migration
5. ❌ Microservices split
6. ❌ UI/UX redesign

---

## ✅ Success Criteria

### Overall Success

**Definition of Done**:
- [ ] Code quality score: 94.2 → 97.8 (+3.6)
- [ ] ESLint warnings: ~15 → 0
- [ ] `any` types in prod: ~20 → <5
- [ ] Test coverage: 78% → 85%
- [ ] Architecture quality: 93% → 98%
- [ ] All tests pass (>99% pass rate maintained)
- [ ] Build time: No regression (<12s)
- [ ] Zero breaking changes

### Phase Success Criteria

**Phase 1 (Quick Wins)**: 
- ESLint clean, magic numbers extracted, error classes created

**Phase 2 (Type Safety)**: 
- <5 `any` types, all mocks typed

**Phase 3 (Documentation)**: 
- 100% JSDoc coverage for exported functions

**Phase 4 (Architecture)**: 
- 98% architecture quality, <1.5% duplication

**Phase 5 (Testing & Performance)**: 
- 85% coverage, 30% faster re-renders

---

## 📊 Metrics & Tracking

### Before Refactoring
- **Code Quality**: 94.2/100
- **ESLint Warnings**: ~15
- **Any Types**: ~50
- **Test Coverage**: 78%
- **Architecture**: 93%
- **Code Duplication**: 3%

### Target After Refactoring
- **Code Quality**: 97.8/100
- **ESLint Warnings**: 0
- **Any Types**: <5
- **Test Coverage**: 85%
- **Architecture**: 98%
- **Code Duplication**: <1.5%

---

## 🔄 Migration Strategy

### Incremental Refactoring
- Refactor one module/file at a time
- Commit after each logical unit of work
- Run tests after each commit
- Never commit broken code

### Rollback Plan
- Each phase is independent
- Can rollback individual commits
- Feature flags not needed (no user-facing changes)
- Rollback time: <5 minutes per phase

---

## 📅 Timeline

### Phase 1: Quick Wins (Week 1-2)
**Duration**: 2 weeks  
**Tasks**: ESLint fixes, extract constants, error classes

### Phase 2: Type Safety (Week 3-4)  
**Duration**: 2 weeks  
**Tasks**: Remove `any` types, type mocks

### Phase 3: Documentation (Week 5)
**Duration**: 1 week  
**Tasks**: JSDoc comments

### Phase 4: Architecture (Week 6)
**Duration**: 1 week  
**Tasks**: Fix violations, extract duplicates

### Phase 5: Testing & Performance (Week 7-8)
**Duration**: 2 weeks  
**Tasks**: Add tests, optimize components

---

## 🔗 Related Documents

- **Refactoring Roadmap**: `docs/REFACTORING_ROADMAP_2026.md`
- **Code Quality Review**: `docs/BELLA_ERP_EXECUTIVE_CODEBASE_REVIEW_2026.md`
- **Phase 3 Complete**: `.kiro/specs/phase-3-physical-extraction/`

---

**Document Version**: 1.0  
**Last Updated**: 2026-06-17  
**Status**: Ready for Implementation
