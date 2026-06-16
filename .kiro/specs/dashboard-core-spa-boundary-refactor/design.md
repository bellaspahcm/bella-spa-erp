# Design Document: Dashboard Core-SPA Boundary Refactor

## Overview

This design document specifies the technical approach for Phase 1 of the Core Platform Extraction Roadmap: refactoring `src/app/dashboard/page.tsx` and `src/services/dashboard-actions.ts` to establish clear boundaries between core platform code (reusable across industries) and spa-specific module code.

**Design Goal:** Transform the dashboard from an untyped, mixed-concern component into a well-typed, boundary-classified component without changing any user-facing behavior.

**Scope:**
- Remove all explicit `any` types
- Define explicit View Model interfaces
- Classify all widgets as `core`, `spa`, or `mixed` using JSDoc annotations
- Type all state variables with View Models
- Preserve 100% of existing functionality, UI/UX, queries, and realtime subscriptions

**Non-Scope:**
- No file/folder restructuring (deferred to Phase 3)
- No schema changes
- No query logic modifications
- No UI/UX changes
- No functional behavior changes

## Architecture

### Current Architecture Problems

```
┌─────────────────────────────────────────────────────────┐
│  src/app/dashboard/page.tsx (~1041 lines)               │
│  ┌───────────────────────────────────────────────────┐  │
│  │ Problems:                                         │  │
│  │ - Extensive use of `any` types                    │  │
│  │ - Mixed core/spa concerns without classification  │  │
│  │ - Loose object types for state variables          │  │
│  │ - No explicit View Model definitions              │  │
│  │ - Unclear widget domain boundaries                │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
        ↓
┌─────────────────────────────────────────────────────────┐
│  src/services/dashboard-actions.ts (~768 lines)         │
│  ┌───────────────────────────────────────────────────┐  │
│  │ Problems:                                         │  │
│  │ - Some interfaces defined, many missing           │  │
│  │ - No View Model abstraction layer                 │  │
│  │ - Type definitions scattered across file          │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### Target Architecture

```
┌─────────────────────────────────────────────────────────┐
│  src/app/dashboard/page.tsx                             │
│  ┌───────────────────────────────────────────────────┐  │
│  │ Dashboard Shell (typed, classified)               │  │
│  │                                                   │  │
│  │ @widget-type core                                 │  │
│  │ ├─ Stats: Total Customers                         │  │
│  │ ├─ Stats: Today's Bookings                        │  │
│  │ ├─ Stats: Monthly Revenue                         │  │
│  │ ├─ Performance Chart (core metrics + spa rating)  │  │
│  │ ├─ Inventory Summary                              │  │
│  │ └─ Search/Month Selector Controls                 │  │
│  │                                                   │  │
│  │ @widget-type spa                                  │  │
│  │ ├─ Stats: KTV Rating                              │  │
│  │ ├─ KTV Performance Table                          │  │
│  │ └─ "Tạo Booking" Button                           │  │
│  │                                                   │  │
│  │ @widget-type mixed                                │  │
│  │ ├─ Today's Schedule (core shell + spa content)    │  │
│  │ └─ Alerts Panel (core shell + mixed alerts)       │  │
│  │                                                   │  │
│  │ All state: DashboardStatsViewModel[]              │  │
│  │            DashboardSessionViewModel[]            │  │
│  │            KtvPerformanceViewModel[]              │  │
│  │            PerformanceDataPointViewModel[]        │  │
│  │            InventorySummaryViewModel              │  │
│  │            DashboardAlert[]                        │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
        ↑ typed data flow
┌─────────────────────────────────────────────────────────┐
│  src/services/dashboard-actions.ts                      │
│  ┌───────────────────────────────────────────────────┐  │
│  │ View Model Exports:                               │  │
│  │ • DashboardStatsViewModel                         │  │
│  │ • DashboardSessionViewModel                       │  │
│  │ • KtvPerformanceViewModel                         │  │
│  │ • PerformanceDataPointViewModel                   │  │
│  │ • InventorySummaryViewModel                       │  │
│  │ • DashboardAlert (already typed)                  │  │
│  │                                                   │  │
│  │ Server Actions (unchanged behavior):              │  │
│  │ • getDashboardStats()                             │  │
│  │ • getUpcomingSessions()                           │  │
│  │ • getDashboardInventorySummary()                  │  │
│  │ • getTopTechnicians()                             │  │
│  │ • getMonthlyPerformance()                         │  │
│  │ • getImportantAlerts()                            │  │
│  │ • getDashboardPrimaryData()                       │  │
│  │ • getDashboardSecondaryData()                     │  │
│  │ • getFullDashboardData()                          │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### View Model Type Definitions

All View Models will be defined in `src/services/dashboard-actions.ts` and exported for use in the dashboard shell.

#### 1. DashboardStatsViewModel

Represents a single stats card in the dashboard grid.

```typescript
export interface DashboardStatsViewModel {
  label: string;
  value: string;
  trend: number;
  iconName: 'Users' | 'Calendar' | 'DollarSign' | 'Star';
  color: string;
  bg: string;
}
```

**Usage:** Array of 3-4 stats cards (Total Customers, Today's Bookings, Monthly Revenue [admin only], KTV Rating)

**Classification Notes:**
- `label: 'Tổng khách hàng'` → `@widget-type core`
- `label: 'Lịch hẹn hôm nay'` → `@widget-type core`
- `label: 'Doanh thu tháng'` → `@widget-type core`
- `label: 'Đánh giá KTV'` → `@widget-type spa`

#### 2. DashboardSessionViewModel

Represents a session card in the "Sắp tới trong hôm nay" widget.

```typescript
export interface DashboardSessionViewModel {
  id: string;
  booking_id: string;
  status: string;
  assigned_time: string | null;
  bookings: {
    id: string;
    package_name: string;
    preferred_time: string | null;
    completed_sessions: number;
    total_sessions: number;
    packages: {
      name: string;
      module_key: string | null;
      service_category: string | null;
    } | null;
    customers: {
      id: string;
      name_mother: string;
      name_baby: string | null;
    } | null;
    assigned_ktv: {
      id: string;
      full_name: string;
    } | null;
  } | null;
}
```

**Usage:** Array of session items fetched by `getUpcomingSessions()`

**Classification:** `@widget-type mixed` (core scheduling shell + spa session content)

#### 3. KtvPerformanceViewModel

Represents a row in the KTV leaderboard table.

```typescript
export interface KtvPerformanceViewModel {
  name: string;
  sessions: number;
  rating: number;
  status: string;
  bonus: string;
}
```

**Usage:** Array of top 3 KTVs (or full list in expanded view)

**Classification:** `@widget-type spa` (KTV-specific performance metrics)

#### 4. PerformanceDataPointViewModel

Represents a data point in the monthly performance chart.

```typescript
export interface PerformanceDataPointViewModel {
  name: string;        // "T1", "T2", etc.
  customers: number;   // New customers this month
  revenue: number;     // Revenue in millions
  expense: number;     // Expense in millions
  rating: number | null; // Average KTV composite rating (spa-specific)
}
```

**Usage:** Array of 6 monthly data points for RevenueChart

**Classification:** `@widget-type core` (with spa-specific rating dimension)

#### 5. InventorySummaryViewModel

Represents inventory summary metrics.

```typescript
export interface InventorySummaryViewModel {
  totalItems: number;
  lowStockCount: number;
  totalValue: number;
}
```

**Usage:** Single object for inventory widget

**Classification:** `@widget-type core` (inventory is industry-neutral)

#### 6. DashboardAlert (Already Defined)

Already properly typed in `dashboard-actions.ts`:

```typescript
export interface DashboardAlert {
  id?: string;
  isAppNotification?: boolean;
  type: 'warning' | 'info' | 'success' | 'danger';
  icon: string;
  title: string;
  message: string;
  severity: string;
  link: string;
  timestamp: number;
}
```

**Classification:** `@widget-type mixed` (core notification shell + mixed alert types)

### Dashboard Shell Structure

The dashboard shell in `page.tsx` will maintain its current structure but with explicit typing and JSDoc classifications:

```typescript
'use client';

/**
 * Dashboard Core-SPA Boundary Refactor - Phase 1 Complete
 * 
 * Widget classification complete. Actual extraction to src/core/ and 
 * src/modules/spa/ deferred to Phase 3 per roadmap.
 * 
 * @see docs/plans/core-platform-extraction-roadmap.md
 */

export default function DashboardPage() {
  // ─────────────────────────────────────────────────────────────
  // STATE VARIABLES (Typed with View Models)
  // ─────────────────────────────────────────────────────────────
  
  const [stats, setStats] = useState<DashboardStatsViewModel[]>([]);
  const [sessions, setSessions] = useState<DashboardSessionViewModel[]>([]);
  const [topKTVs, setTopKTVs] = useState<KtvPerformanceViewModel[]>([]);
  const [performanceData, setPerformanceData] = useState<PerformanceDataPointViewModel[]>([]);
  const [inventorySummary, setInventorySummary] = useState<InventorySummaryViewModel>({ 
    totalItems: 0, 
    lowStockCount: 0, 
    totalValue: 0 
  });
  const [alerts, setAlerts] = useState<DashboardAlert[]>([]);
  
  // ... other state variables (primitives, UI state)
  
  // ─────────────────────────────────────────────────────────────
  // WIDGET CLASSIFICATIONS
  // ─────────────────────────────────────────────────────────────
  
  /**
   * @widget-type core
   * Stats cards: Total Customers, Today's Bookings, Monthly Revenue
   * Industry-neutral business metrics
   */
  
  /**
   * @widget-type spa
   * Stats card: KTV Rating
   * Spa-specific composite rating (60% customer + 40% discipline)
   */
  
  /**
   * @widget-type mixed
   * Today's Schedule widget
   * Core: Scrollable list shell, loading states, search filter
   * Spa: Session card content with package progress, KTV assignment, multipliers
   * Future: Separate core scheduling shell from spa session renderer
   */
  
  /**
   * @widget-type core
   * Performance Chart (RevenueChart)
   * Monthly revenue/expense/customers are industry-neutral KPIs
   * Note: Rating dimension uses spa KTV metrics but could be replaced
   * with generic service quality for other industries
   */
  
  /**
   * @widget-type spa
   * KTV Performance Table
   * Spa-specific: session multipliers, composite ratings, KPI bonuses
   * Other industries need different technician performance widgets
   */
  
  /**
   * @widget-type mixed
   * Alerts/Notifications Panel
   * Core: Bell icon, popover shell, read/unread state
   * Mixed alert types:
   *   - Core: Generic app_notifications, low inventory
   *   - Spa: KTV checkout, session overdue, booking near end, leave requests
   * Future: Core notification system with module-specific alert providers
   */
  
  /**
   * @widget-type core
   * Inventory Summary widget
   * Industry-neutral: total items, low stock count, total value
   * Note: Item categories and usage tracking are module-specific
   */
  
  /**
   * @widget-type core
   * Header controls: Search input, month/year selector
   * Industry-neutral dashboard UX patterns
   */
  
  /**
   * @widget-type spa
   * "Tạo Booking" button
   * Opens spa-specific BookingModal
   * Core platform would provide generic "Create Order" action
   */
  
  // ... rest of component implementation (unchanged behavior)
}
```

## Data Models

### Database Schema (Unchanged)

This refactor does not modify any database tables. All existing tables remain:

- `customers`
- `bookings`
- `session_logs`
- `session_reviews`
- `revenue`
- `expenses`
- `inventory_items`
- `app_notifications`
- `attendance`
- `users` (KTV/staff)

### Server Action Return Types

All server actions in `dashboard-actions.ts` will maintain their current behavior but use explicit View Model return types:

```typescript
// getDashboardStats returns stats data that buildDashboardStats() transforms
export async function getDashboardStats(
  startDate?: string, 
  endDate?: string, 
  todayDate?: string
): Promise<{
  totalCustomers: { value: string; trend: number };
  todayBookings: { value: string; trend: number };
  totalRevenue: { value: string; trend: number };
  avgRating: { value: string; trend: number };
}> {
  // ... existing implementation
}

// getUpcomingSessions returns typed session array
export async function getUpcomingSessions(
  date?: string
): Promise<DashboardSessionViewModel[]> {
  // ... existing implementation
}

// getTopTechnicians returns typed KTV array
export async function getTopTechnicians(): Promise<KtvPerformanceViewModel[]> {
  // ... existing implementation
}

// getMonthlyPerformance returns typed performance points
export async function getMonthlyPerformance(): Promise<PerformanceDataPointViewModel[]> {
  // ... existing implementation
}

// getDashboardInventorySummary returns typed summary
export async function getDashboardInventorySummary(): Promise<InventorySummaryViewModel> {
  // ... existing implementation
}

// getImportantAlerts returns typed alerts (already correct)
export async function getImportantAlerts(): Promise<DashboardAlert[]> {
  // ... existing implementation
}
```

## Error Handling

**No changes to error handling behavior.** All existing error handling remains:

1. **Database query errors:** Already throw with descriptive messages
2. **Tenant access errors:** Already throw `DASHBOARD_TENANT_ACCESS_ERROR`
3. **Toast notifications:** Already use `toast.error()` for user-facing errors
4. **Console errors:** Already log errors with `console.error()`
5. **Try-catch blocks:** Maintain existing patterns without silent failures

**Type safety improvements:**
- TypeScript compiler will catch type mismatches at compile-time
- View Models prevent incorrect data shapes from propagating
- Explicit return types catch missing error handlers

## Testing Strategy

This is a **pure refactor with zero functional changes**, so we rely on:

### 1. Compile-Time Type Checking

**Tool:** TypeScript compiler (`tsc --noEmit`)

**What it validates:**
- Zero `any` types remain
- All state variables typed with View Models
- All props passed to child components are typed
- All server action return types match View Models
- No implicit `any` from loose object destructuring

**Command:**
```bash
npx tsc --noEmit --pretty false
```

**Expected result:** Zero type errors (or same number as before if pre-existing)

### 2. Existing Jest Tests

**Tool:** Jest unit/integration tests

**What it validates:**
- All existing test suites pass with identical results
- No behavior regressions from typing changes
- Critical business logic still works (session completion, salary, accounting)

**Commands:**
```bash
npm run test                    # Full suite
npm run test:critical           # Critical business paths
```

**Expected result:** Same pass/fail count as before refactor

### 3. ESLint Static Analysis

**Tool:** ESLint with project config

**What it validates:**
- No new linting violations introduced
- Code style consistency maintained
- No unused variables from refactoring

**Commands:**
```bash
npm run lint
npm run lint:strict
```

**Expected result:** Zero new violations beyond pre-existing warnings

### 4. Manual Smoke Testing

**Required browser tests:**

1. **Dashboard loads correctly**
   - Navigate to `/dashboard`
   - All widgets render
   - No console errors

2. **Stats cards display data**
   - Check all 3-4 stats cards show values
   - Trend indicators appear

3. **Today's Schedule widget works**
   - Session cards display
   - "Hoàn thành buổi" button works
   - Quick note saves correctly

4. **Realtime updates trigger**
   - Open dashboard in two browser tabs
   - Complete a session in one tab
   - Other tab auto-refreshes within 500ms

5. **Notifications popover works**
   - Click bell icon
   - Alerts display
   - Click alert navigates to correct page
   - Mark as read works for app notifications

6. **Month/year selector updates data**
   - Change month dropdown
   - Performance chart updates
   - Stats cards update

7. **"Tạo Booking" modal opens**
   - Click button
   - BookingModal appears
   - Can close modal

**Test matrix:**
- Admin role view
- KTV role view (should redirect to `/ktv/dashboard`)
- Desktop viewport (1920x1080)
- Mobile viewport (375x667)

### 5. No Property-Based Testing Required

**Why PBT is not applicable:**

This refactor involves:
- Type definitions (compile-time only)
- JSDoc annotations (documentation only)
- State variable typing (no logic changes)
- Widget classification comments (documentation only)

**PBT is only appropriate for:**
- Pure functions with input/output behavior
- Universal properties across large input spaces
- Algorithms, parsers, transformations

**Our refactor has:**
- Zero new functions
- Zero algorithm changes
- Zero business logic changes
- Zero query modifications

**Therefore:** No correctness properties, no PBT tasks, no property tests.

### 6. Unit Testing Strategy (If New Utilities Were Added)

Since we're only adding types and comments, no new unit tests are needed. However, if we were to extract utility functions in future phases:

**Example testable utilities (not in this phase):**
- Widget classifier function
- View Model transformer function
- Type guard predicates

**Example test approach:**
```typescript
// Future Phase 3 example only
describe('classifyWidget', () => {
  it('should classify customer stats as core', () => {
    expect(classifyWidget('totalCustomers')).toBe('core');
  });
  
  it('should classify KTV rating as spa', () => {
    expect(classifyWidget('avgRating')).toBe('spa');
  });
});
```

**Not needed for Phase 1** because we're using JSDoc comments, not runtime classification.

## Implementation Plan

### Step 1: Define View Model Interfaces

**File:** `src/services/dashboard-actions.ts`

**Actions:**
1. Add `DashboardStatsViewModel` interface export at top of file
2. Add `DashboardSessionViewModel` interface export
3. Add `KtvPerformanceViewModel` interface export
4. Add `PerformanceDataPointViewModel` interface export
5. Add `InventorySummaryViewModel` interface export
6. Verify `DashboardAlert` is already exported

**Acceptance:**
- All interfaces exported
- No breaking changes to existing code
- Interfaces match current runtime data shapes exactly

### Step 2: Type Server Action Return Values

**File:** `src/services/dashboard-actions.ts`

**Actions:**
1. Add return type `: Promise<DashboardSessionViewModel[]>` to `getUpcomingSessions()`
2. Add return type `: Promise<KtvPerformanceViewModel[]>` to `getTopTechnicians()`
3. Add return type `: Promise<PerformanceDataPointViewModel[]>` to `getMonthlyPerformance()`
4. Add return type `: Promise<InventorySummaryViewModel>` to `getDashboardInventorySummary()`
5. Verify no type errors with `tsc --noEmit`

**Acceptance:**
- TypeScript compilation succeeds
- No changes to function bodies
- Return types match View Models

### Step 3: Type Dashboard State Variables

**File:** `src/app/dashboard/page.tsx`

**Actions:**
1. Replace `const [stats, setStats] = useState<DashboardStat[]>([]);` with `useState<DashboardStatsViewModel[]>([]);`
2. Replace `const [sessions, setSessions] = useState<DashboardSession[]>([]);` with `useState<DashboardSessionViewModel[]>([]);`
3. Replace `const [topKTVs, setTopKTVs] = useState<KtvDashboardRow[]>([]);` with `useState<KtvPerformanceViewModel[]>([]);`
4. Replace `const [performanceData, setPerformanceData] = useState<DashboardPerformancePoint[]>([]);` with `useState<PerformanceDataPointViewModel[]>([]);`
5. Type `inventorySummary` state as `InventorySummaryViewModel`
6. Verify `alerts` state already typed as `DashboardAlert[]`
7. Remove old type aliases (`DashboardStat`, `DashboardSession`, etc.) and import from `dashboard-actions`

**Acceptance:**
- All state variables explicitly typed
- TypeScript compilation succeeds
- No runtime behavior changes

### Step 4: Add Widget Classification JSDoc Comments

**File:** `src/app/dashboard/page.tsx`

**Actions:**
1. Add top-level JSDoc comment about Phase 1 completion and Phase 3 deferral
2. Add `@widget-type core` comment above Total Customers stat card logic
3. Add `@widget-type core` comment above Today's Bookings stat card logic
4. Add `@widget-type core` comment above Monthly Revenue stat card logic
5. Add `@widget-type spa` comment above KTV Rating stat card logic
6. Add `@widget-type mixed` comment with explanation above Today's Schedule `<motion.div>`
7. Add `@widget-type core` comment with rating note above RevenueChart usage
8. Add `@widget-type spa` comment with explanation above KtvPerformanceTable usage
9. Add `@widget-type mixed` comment with alert type breakdown above Alerts panel
10. Add `@widget-type core` comment with note above Inventory Summary widget
11. Add `@widget-type core` comment above Search/Month controls
12. Add `@widget-type spa` comment above "Tạo Booking" button

**Acceptance:**
- All major widgets classified
- JSDoc comments visible and readable
- Classification rationale explained

### Step 5: Remove Any Remaining `any` Types

**File:** `src/app/dashboard/page.tsx`

**Actions:**
1. Search for `any` keyword in file
2. Replace with explicit types or View Models
3. If casting is necessary, use type assertions with View Models
4. Verify TypeScript compilation with `--noEmit`

**Acceptance:**
- Zero `any` types remain
- No `@ts-ignore` or `@ts-expect-error` comments added
- TypeScript strict mode passes

### Step 6: Verify No Behavior Changes

**Actions:**
1. Run full Jest suite: `npm run test`
2. Run critical tests: `npm run test:critical`
3. Run ESLint: `npm run lint`
4. Compile TypeScript: `npx tsc --noEmit`
5. Manual browser smoke test (see Testing Strategy section)
6. Check `git diff` for unintended changes

**Acceptance:**
- All tests pass (same results as before)
- No new ESLint violations
- TypeScript compiles cleanly
- Dashboard works identically in browser
- Only changes are types, interfaces, and JSDoc comments

## Refactor Checklist

Before marking Phase 1 complete, verify:

- [ ] `DashboardStatsViewModel` interface exported from `dashboard-actions.ts`
- [ ] `DashboardSessionViewModel` interface exported
- [ ] `KtvPerformanceViewModel` interface exported
- [ ] `PerformanceDataPointViewModel` interface exported
- [ ] `InventorySummaryViewModel` interface exported
- [ ] All server actions have explicit return types
- [ ] `stats` state typed as `DashboardStatsViewModel[]`
- [ ] `sessions` state typed as `DashboardSessionViewModel[]`
- [ ] `topKTVs` state typed as `KtvPerformanceViewModel[]`
- [ ] `performanceData` state typed as `PerformanceDataPointViewModel[]`
- [ ] `inventorySummary` state typed as `InventorySummaryViewModel`
- [ ] Top-level JSDoc comment about Phase 1 completion added
- [ ] Total Customers stat card classified as `@widget-type core`
- [ ] Today's Bookings stat card classified as `@widget-type core`
- [ ] Monthly Revenue stat card classified as `@widget-type core`
- [ ] KTV Rating stat card classified as `@widget-type spa`
- [ ] Today's Schedule widget classified as `@widget-type mixed` with explanation
- [ ] RevenueChart classified as `@widget-type core` with rating dimension note
- [ ] KtvPerformanceTable classified as `@widget-type spa` with explanation
- [ ] Alerts panel classified as `@widget-type mixed` with alert type breakdown
- [ ] Inventory Summary classified as `@widget-type core`
- [ ] Search/Month controls classified as `@widget-type core`
- [ ] "Tạo Booking" button classified as `@widget-type spa`
- [ ] Zero `any` types remain in `page.tsx`
- [ ] TypeScript compilation passes: `npx tsc --noEmit --pretty false`
- [ ] Jest tests pass: `npm run test`
- [ ] ESLint passes: `npm run lint`
- [ ] Manual smoke test: dashboard loads and works identically
- [ ] Manual smoke test: realtime subscriptions trigger refreshes
- [ ] Manual smoke test: session completion flow works
- [ ] Manual smoke test: notifications popover works
- [ ] Manual smoke test: month/year selector updates data

## Phase Transition

**After Phase 1 completion:**
- Dashboard has explicit types and boundary classifications
- Code is ready for Phase 2 (Core Service Contracts)
- No user-facing changes deployed
- All tests passing

**Before Phase 2:**
- Review classification decisions with team
- Confirm widget boundaries align with platform vision
- Plan which contracts need definition first

**Phase 1 deliverables:**
- Typed dashboard shell (`page.tsx`)
- View Model interfaces (`dashboard-actions.ts`)
- Widget classification JSDoc comments
- Zero behavior regressions
- Validation checklist completed

## Deferred to Future Phases

The following are **explicitly not included** in Phase 1:

- File/folder restructuring to `src/core/` and `src/modules/spa/` (Phase 3)
- Extracting widget components to separate files (Phase 3)
- Creating core dashboard shell abstraction (Phase 2-3)
- Creating module adapter interfaces (Phase 2)
- Adding module registry or feature flags (Phase 4)
- Testing with second industry module (Phase 5)
- Database schema changes (not planned for modular monolith)
- Breaking changes to existing components
- New features or functionality

**Rationale for deferral:**
- Phase 1 establishes types and boundaries **without risk**
- Large-scale restructuring requires Phase 2 contracts first
- Incremental approach prevents "big bang" failures
- Bella Spa must continue working throughout extraction

## References

- [Core Platform Extraction Roadmap](../../docs/plans/core-platform-extraction-roadmap.md)
- Requirements Document: `.kiro/specs/dashboard-core-spa-boundary-refactor/requirements.md`
- Current Dashboard: `src/app/dashboard/page.tsx`
- Current Data Service: `src/services/dashboard-actions.ts`
