# Tasks: Bella ERP Code Refactoring (Phase 1-5)

**Total Tasks**: 35 tasks  
**Estimated Duration**: 6-8 weeks  
**Current Score**: 94.2/100  
**Target Score**: 97.8/100

---

## Wave 1: Quick Wins (Week 1-2)

- [x] 1. Setup refactoring branch and workspace
  - Create branch `refactor/phase-1-to-5` from main
  - Ensure all tests pass on base branch
  - Document current metrics (lint warnings, any types count, coverage)
  - _Requirements: All_
  - _Duration: 30 minutes_

- [x] 2. Fix unused variable warnings
  - Fix ~15 unused variable warnings from ESLint
  - Either remove unused variables or prefix with `_` if intentionally unused
  - Run lint after each file fix
  - Commit changes grouped by module
  - _Requirements: REQ-2.1_
  - _Duration: 2 hours_
  - _Dependencies: Task 1_

- [x] 3. Fix React unescaped entities
  - Find and fix ~2 unescaped entity warnings
  - Replace `'` with `&apos;` or use `{"'"}` syntax
  - Verify no warnings remain
  - _Requirements: REQ-2.3_
  - _Duration: 30 minutes_
  - _Dependencies: Task 1_

- [x] 4. Create business-rules.ts constants file
  - Create file `src/constants/business-rules.ts`
  - Define constants for working days (26), min days for bonus (22)
  - Define session multipliers (BASIC: 1.0, HAPPY: 1.5, VIP: 2.0)
  - Define inventory thresholds (LOW_STOCK: 10, REORDER: 20)
  - Export proper TypeScript types with `as const`
  - _Requirements: REQ-3.1_
  - _Duration: 1 hour_
  - _Dependencies: Task 1_

- [x] 5. Replace magic numbers in payroll services
  - Replace hardcoded `26` with `BUSINESS_RULES.PAYROLL.WORKING_DAYS_PER_MONTH`
  - Replace `22` with `BUSINESS_RULES.PAYROLL.MIN_WORKING_DAYS_FOR_BONUS`
  - Files affected: `src/core/services/payroll/`, `src/modules/spa/services/salary.ts`
  - Run tests after changes
  - _Requirements: REQ-3.1_
  - _Duration: 2 hours_
  - _Dependencies: Task 4_

- [x] 6. Replace magic numbers in session services
  - Replace session multipliers (1.0, 1.5, 2.0) with `BUSINESS_RULES.SESSIONS.MULTIPLIERS`
  - Replace rating threshold with `BUSINESS_RULES.SESSIONS.MIN_RATING_FOR_BONUS`
  - Files affected: `src/modules/spa/services/session.ts`, `src/modules/spa/services/package.ts`
  - _Requirements: REQ-3.1_
  - _Duration: 1.5 hours_
  - _Dependencies: Task 4_

- [x] 7. Replace magic numbers in inventory services
  - Replace `10` with `BUSINESS_RULES.INVENTORY.LOW_STOCK_THRESHOLD`
  - Replace `20` with `BUSINESS_RULES.INVENTORY.REORDER_POINT`
  - Files affected: inventory services
  - _Requirements: REQ-3.1_
  - _Duration: 1 hour_
  - _Dependencies: Task 4_

- [x] 8. Create error hierarchy in core/lib/errors.ts
  - Create file `src/core/lib/errors.ts`
  - Implement `AppError` base class with `code` and `details` fields
  - Implement `BookingError`, `PaymentError`, `InventoryError`, `SalaryError`, `ValidationError`
  - Add `toJSON()` method for logging
  - Add unit tests for error classes
  - _Requirements: REQ-4.1_
  - _Duration: 2 hours_
  - _Dependencies: Task 1_

- [x] 9. Replace generic errors in booking services
  - Replace `throw new Error(...)` with `throw new BookingError(...)`
  - Add error codes: `BOOKING_KTV_NOT_AVAILABLE`, `BOOKING_TIME_CONFLICT`, etc.
  - Update affected tests to catch specific error types
  - _Requirements: REQ-4.2_
  - _Duration: 3 hours_
  - _Dependencies: Task 8_

- [x] 10. Replace generic errors in payment/inventory services
  - Payment services: Use `PaymentError` with codes
  - Inventory services: Use `InventoryError` with codes
  - Update tests to catch specific error types
  - _Requirements: REQ-4.2_
  - _Duration: 2 hours_
  - _Dependencies: Task 8_

## Wave 2: Type Safety (Week 3-4)

- [x] 11. Audit and document all `any` types
  - Run script to find all `any` types in codebase
  - Create list with file:line and justification needed
  - Categorize: (1) Easy fix, (2) Medium complexity, (3) Hard/edge case
  - _Requirements: REQ-1.1_
  - _Duration: 2 hours_
  - _Dependencies: Tasks 1-10_

- [x] 12. Create proper types for mock builders
  - Define `MockQueryBuilder<T>` interface
  - Define result types: `QueryResult<T>`, `MutationResult<T>`
  - Create reusable mock builder factory
  - _Requirements: REQ-1.2_
  - _Duration: 4 hours_
  - _Dependencies: Task 11_

- [x] 13. Type accounting test mocks
  - Replace `any` types in `accounting-engine.test.ts`
  - Use `AccountingLine` interface for line items
  - Apply `MockQueryBuilder<T>` to mock builders
  - _Requirements: REQ-1.2_
  - _Duration: 3 hours_
  - _Dependencies: Task 12_

- [x] 14. Type cross-module-integrity test mocks
  - Fix ~30 `any` types in `cross-module-integrity.test.ts`
  - Use proper database types from `database.types.ts`
  - _Requirements: REQ-1.2_
  - _Duration: 4 hours_
  - _Dependencies: Task 12_

- [x] 15. Type e2e-negative-pipeline test mocks
  - Fix ~20 `any` types in `e2e-negative-pipeline.test.ts`
  - Properly type mock store and builders
  - _Requirements: REQ-1.2_
  - _Duration: 3 hours_
  - _Dependencies: Task 12_

- [x] 16. Remove any types from production services (Batch 1)
  - Fix `any` types in `src/core/services/order/`
  - Fix `any` types in `src/core/services/payment/`
  - Use proper database types
  - _Requirements: REQ-1.1_
  - _Duration: 4 hours_
  - _Dependencies: Task 11_

- [x] 17. Remove any types from production services (Batch 2)
  - Fix `any` types in `src/core/services/accounting/`
  - Fix `any` types in `src/core/services/finance/`
  - _Requirements: REQ-1.1_
  - _Duration: 4 hours_
  - _Dependencies: Task 11_

- [x] 18. Remove any types from production services (Batch 3)
  - Fix `any` types in `src/modules/spa/services/`
  - Fix remaining `any` types in other services
  - Document any remaining justified `any` types with JSDoc
  - _Requirements: REQ-1.1_
  - _Duration: 3 hours_
  - _Dependencies: Task 11_

## Wave 3: Documentation (Week 5)

- [x] 19. Add JSDoc to payroll services
  - Add JSDoc to all exported functions in `src/core/services/payroll/`
  - Include: @param, @returns, @throws, @example, @remarks for complex logic
  - ~15 functions to document
  - _Requirements: REQ-5.1_
  - _Duration: 1 day_
  - _Dependencies: Tasks 1-18_

- [x] 20. Add JSDoc to accounting services
  - Add JSDoc to `src/core/services/accounting/`
  - ~20 functions to document
  - _Requirements: REQ-5.1_
  - _Duration: 1.5 days_
  - _Dependencies: Tasks 1-18_

- [x] 21. Add JSDoc to finance services
  - Add JSDoc to `src/core/services/finance/`
  - ~12 functions to document
  - _Requirements: REQ-5.1_
  - _Duration: 1 day_
  - _Dependencies: Tasks 1-18_

- [x] 22. Add JSDoc to order services
  - Add JSDoc to `src/core/services/order/`
  - ~25 functions to document
  - _Requirements: REQ-5.1_
  - _Duration: 1.5 days_
  - _Dependencies: Tasks 1-18_

- [x] 23. Add JSDoc to spa module services
  - Add JSDoc to `src/modules/spa/services/`
  - ~10 functions to document
  - _Requirements: REQ-5.1_
  - _Duration: 0.5 days_
  - _Dependencies: Tasks 1-18_

- [x] 24. Create developer onboarding guide
  - Create `docs/DEVELOPER_ONBOARDING.md`
  - Include: setup, architecture overview, key concepts, common tasks
  - Link to JSDoc documentation
  - _Requirements: REQ-5.1_
  - _Duration: 1 day_
  - _Dependencies: Tasks 19-23_

- [ ] 25. Review and validate all JSDoc
  - Verify all JSDoc is accurate and helpful
  - Check examples actually work
  - Ensure consistent format across all files
  - _Requirements: REQ-5.1_
  - _Duration: 0.5 days_
  - _Dependencies: Tasks 19-23_

## Wave 4: Architecture Cleanup (Week 6)

- [ ] 26. Run madge to detect circular dependencies
  - Install madge: `npm install -g madge`
  - Run: `npx madge --circular src/`
  - Document all circular dependencies found
  - _Requirements: REQ-6.1_
  - _Duration: 1 hour_
  - _Dependencies: Tasks 1-25_

- [ ] 27. Fix circular dependencies
  - Break circular dependencies by extracting shared types
  - Move shared interfaces to separate files
  - Verify no circulars remain
  - _Requirements: REQ-6.1_
  - _Duration: 1 day_
  - _Dependencies: Task 26_

- [ ] 28. Fix cross-boundary import violations
  - Ensure core doesn't import from modules
  - Ensure modules only import from core through adapters
  - Run `npm run lint:strict` to verify
  - _Requirements: REQ-6.1_
  - _Duration: 1 day_
  - _Dependencies: Task 26_

- [ ] 29. Identify duplicate code patterns
  - Use jscpd or similar tool to find duplicates
  - Create list of duplicate patterns (>3 occurrences)
  - Prioritize by impact
  - _Requirements: REQ-6.2_
  - _Duration: 2 hours_
  - _Dependencies: Tasks 1-25_

- [ ] 30. Extract common query patterns
  - Create `src/core/lib/query-helpers.ts`
  - Extract patterns like `queryWithErrorHandling<T>`
  - Replace duplicates with helper calls
  - _Requirements: REQ-6.2_
  - _Duration: 1 day_
  - _Dependencies: Task 29_

- [ ] 31. Extract duplicate error handling
  - Extract common try-catch patterns
  - Create higher-order functions for error handling
  - Reduce duplication from 3% to <1.5%
  - _Requirements: REQ-6.2_
  - _Duration: 1 day_
  - _Dependencies: Task 29_

## Wave 5: Testing & Performance (Week 7-8)

- [ ] 32. Add tests for validations.ts
  - Write tests for 8 validation functions
  - Cover edge cases and error paths
  - Achieve 100% coverage for this file
  - _Requirements: REQ-7.1_
  - _Duration: 1 day_
  - _Dependencies: Tasks 1-31_

- [ ] 33. Add tests for form-validators, promotions, geo utils
  - `form-validators.ts`: 7 more tests (3 exist, need 7 more)
  - `promotions.ts`: 3 more tests (2 exist, need 3 more)
  - `geo.ts`: 4 tests (0 exist, need 4)
  - _Requirements: REQ-7.1_
  - _Duration: 2 days_
  - _Dependencies: Tasks 1-31_

- [ ] 34. Add memoization to dashboard components
  - Add `useMemo` to `StatsGrid.tsx`, `RevenueChart.tsx`, `KtvPerformanceTable.tsx`
  - Identify expensive computations (data processing, filtering, sorting)
  - Benchmark before/after to verify 30% improvement
  - _Requirements: REQ-8.1_
  - _Duration: 1 day_
  - _Dependencies: Tasks 1-31_

- [ ] 35. Final QA and metrics validation
  - Run full test suite: `npm test`
  - Run linting: `npm run lint`
  - Check coverage: `npm run test:coverage`
  - Verify architecture: `npm run lint:strict`
  - Build: `npm run build`
  - Document final metrics vs. targets
  - Create completion report
  - _Requirements: All_
  - _Duration: 1 day_
  - _Dependencies: Tasks 1-34_

---

## Execution Notes

### Commit Strategy
- Commit after each task completion
- Use conventional commit messages:
  - `refactor(payroll): replace magic number 26 with WORKING_DAYS_PER_MONTH constant`
  - `refactor(types): remove any types from accounting service`
  - `docs(jsdoc): add documentation to payroll service functions`

### Testing Strategy
- Run tests after every task
- Never commit failing tests
- Update snapshots if needed
- Add tests for new error classes

### Review Points
- After Wave 1: Quick review (30 min)
- After Wave 2: Deep review of types (1 hour)
- After Wave 3: Documentation review (30 min)
- After Wave 4: Architecture review (1 hour)
- After Wave 5: Final comprehensive review (2 hours)

---

**Tasks Version**: 1.0  
**Last Updated**: 2026-06-17  
**Status**: Ready for Execution
