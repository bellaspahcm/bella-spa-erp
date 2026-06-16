# Requirements Document

## Introduction

This document specifies requirements for Phase 1 of the Core Platform Extraction Roadmap: refactoring the Dashboard page (`src/app/dashboard/page.tsx`) to establish clear boundaries between core platform code (reusable across industries) and spa-specific module code.

The dashboard currently contains ~1041 lines mixing core business metrics, generic notification systems, and spa-specific widgets (KTV performance, session schedules, package progress). This refactor will classify each widget, eliminate `any` types, and create proper type definitions without changing any user-facing behavior.

This is a **code quality and boundary classification refactor** with zero functional changes to UI, queries, or realtime subscriptions.

## Glossary

- **Dashboard_Shell**: The core reusable dashboard container component that manages layout, loading states, realtime subscriptions, and widget orchestration
- **Dashboard_Widget**: An individual data visualization or interactive component within the dashboard (stats cards, session list, performance table, alerts panel, inventory summary)
- **Stats_Card**: A metric display widget showing a KPI value, trend indicator, and icon
- **Core_Widget**: A dashboard widget that displays industry-neutral business metrics (total customers, bookings count, revenue, generic notifications)
- **Spa_Widget**: A dashboard widget specific to spa/babycare operations (KTV performance, session schedules with package multipliers, care workflow alerts)
- **Type_Definition**: A TypeScript interface or type alias that explicitly defines the shape of data without using `any` or loose object types
- **View_Model**: A type definition that represents dashboard data structures after transformation from database schema
- **Dashboard_Data_Service**: Server action functions in `dashboard-actions.ts` that fetch and aggregate data for widgets
- **Realtime_Subscription**: Supabase channel subscription that automatically refreshes widget data when database tables change
- **Widget_Classification**: The process of labeling each dashboard widget as either Core_Widget or Spa_Widget based on industry-reusability criteria

## Requirements

### Requirement 1: Remove All Explicit Any Types

**User Story:** As a developer maintaining the dashboard codebase, I want all `any` types removed, so that TypeScript provides compile-time type safety and prevents runtime type errors.

#### Acceptance Criteria

1. WHEN the TypeScript compiler runs on `src/app/dashboard/page.tsx`, THE Dashboard_Shell SHALL produce zero `any` type errors
2. WHEN database query results are assigned to state variables, THE Dashboard_Shell SHALL use explicit Type_Definitions from `dashboard-actions.ts`
3. WHEN props are passed to child components (StatsGrid, RevenueChart, KtvPerformanceTable), THE Dashboard_Shell SHALL use typed interfaces
4. THE Dashboard_Shell SHALL NOT cast database payloads or query results as `any` or `unknown` without subsequent type validation
5. WHEN `getDashboardPrimaryData` returns data, THE Dashboard_Shell SHALL type the return value using a View_Model interface

### Requirement 2: Define Explicit View Models for Dashboard Data

**User Story:** As a developer reading dashboard code, I want explicit View_Model definitions for all data structures, so that I can understand data shapes without inspecting runtime values.

#### Acceptance Criteria

1. THE Dashboard_Data_Service SHALL export a `DashboardStatsViewModel` interface that defines the structure of stats card data (label, value, trend, iconName, color, bg)
2. THE Dashboard_Data_Service SHALL export a `DashboardSessionViewModel` interface that defines the structure of session list items (id, booking_id, status, assigned_time, nested booking/customer/ktv data)
3. THE Dashboard_Data_Service SHALL export a `KtvPerformanceViewModel` interface that defines the structure of KTV leaderboard rows (name, sessions, rating, status, bonus)
4. THE Dashboard_Data_Service SHALL export a `PerformanceDataPointViewModel` interface that defines the structure of monthly chart data (name, customers, revenue, expense, rating)
5. THE Dashboard_Data_Service SHALL export an `InventorySummaryViewModel` interface that defines the structure of inventory metrics (totalItems, lowStockCount, totalValue)
6. WHEN any View_Model is modified, THE TypeScript compiler SHALL flag all usages in Dashboard_Shell that are no longer compatible

### Requirement 3: Classify Dashboard Stats Cards by Domain

**User Story:** As a system architect planning core platform extraction, I want each stats card labeled as Core_Widget or Spa_Widget, so that I know which widgets are reusable across industries.

#### Acceptance Criteria

1. THE Dashboard_Shell SHALL add a JSDoc comment above each stats card definition classifying it as `@widget-type core` or `@widget-type spa`
2. THE "Tổng khách hàng" (Total Customers) stats card SHALL be classified as `@widget-type core` because customer count is industry-neutral
3. THE "Lịch hẹn hôm nay" (Today's Bookings) stats card SHALL be classified as `@widget-type core` because appointment/booking count is industry-neutral
4. THE "Doanh thu tháng" (Monthly Revenue) stats card SHALL be classified as `@widget-type core` because revenue tracking is industry-neutral
5. THE "Đánh giá KTV" (KTV Rating) stats card SHALL be classified as `@widget-type spa` because it displays spa-specific KTV composite ratings

### Requirement 4: Classify Today's Schedule Widget by Domain

**User Story:** As a system architect, I want the "Sắp tới trong hôm nay" session list widget classified by domain, so that I understand its reusability.

#### Acceptance Criteria

1. THE Dashboard_Shell SHALL add a JSDoc comment above the Today's Schedule widget classifying it as `@widget-type mixed`
2. THE Today's Schedule widget classification comment SHALL explain that the shell (scrollable list, loading states, search filter) is `core` but session card content (package progress, KTV assignment, session multipliers) is `spa`
3. THE classification comment SHALL reference that future extraction should separate the core scheduling list shell from spa session card renderer
4. WHEN a developer reads the widget code, THE classification comment SHALL be visible at the widget's opening `<motion.div>` tag
5. THE classification comment SHALL note that session completion logic (`completeSession`, `saveSessionNote`) is spa-specific booking workflow

### Requirement 5: Classify Performance Chart Widget by Domain

**User Story:** As a system architect, I want the RevenueChart/Performance widget classified by domain, so that I understand its reusability.

#### Acceptance Criteria

1. THE Dashboard_Shell SHALL add a JSDoc comment above the RevenueChart widget usage classifying it as `@widget-type core`
2. THE classification comment SHALL explain that monthly performance metrics (revenue, expense, customer acquisition) are industry-neutral business KPIs
3. THE classification comment SHALL note that the "rating" dimension uses spa-specific KTV composite ratings but could be replaced with generic service quality metrics for other industries
4. WHEN the widget renders with spa tenant data, THE rating dimension SHALL display KTV performance metrics
5. WHERE rating data is not applicable for a tenant module, THE RevenueChart SHALL handle null rating values gracefully

### Requirement 6: Classify KTV Performance Table by Domain

**User Story:** As a system architect, I want the KtvPerformanceTable widget classified by domain, so that I know it belongs to the spa module.

#### Acceptance Criteria

1. THE Dashboard_Shell SHALL add a JSDoc comment above the KtvPerformanceTable widget usage classifying it as `@widget-type spa`
2. THE classification comment SHALL explain that KTV leaderboard with session multipliers, composite ratings, and spa-specific KPI bonuses is spa/babycare-specific
3. THE classification comment SHALL note that other industries would need a different technician/staff performance widget
4. THE KtvPerformanceTable component SHALL remain in `@/components/features/dashboard/` as a spa-specific dashboard feature
5. THE classification comment SHALL reference that core platform would provide a generic "Top Performers" widget shell that spa module customizes

### Requirement 7: Classify Alerts Panel by Domain

**User Story:** As a system architect, I want the alerts/notifications panel classified by domain, so that I understand which alert types are reusable.

#### Acceptance Criteria

1. THE Dashboard_Shell SHALL add a JSDoc comment above the Alerts panel widget classifying it as `@widget-type mixed`
2. THE classification comment SHALL explain that the alert notification shell (bell icon, popover, read/unread state) is `core` but alert content includes spa-specific alerts (session completions, overdue sessions, package nearing end, leave requests)
3. THE classification comment SHALL list which alert types from `getImportantAlerts` are core (generic notifications, low inventory) vs spa-specific (KTV checkout, session overdue, booking near completion, pending leaves)
4. THE classification comment SHALL note that core platform should provide a generic alert/notification system with module-specific alert providers
5. WHEN an alert is marked as read, THE Dashboard_Shell SHALL call the core notification service (`markNotificationAsRead`)

### Requirement 8: Classify Inventory Summary Widget by Domain

**User Story:** As a system architect, I want the inventory summary widget classified by domain, so that I know whether inventory is core or spa-specific.

#### Acceptance Criteria

1. THE Dashboard_Shell SHALL add a JSDoc comment above the Inventory Summary widget classifying it as `@widget-type core`
2. THE classification comment SHALL explain that inventory metrics (total items, low stock count, total value) are industry-neutral supply chain KPIs
3. THE classification comment SHALL note that inventory item categories and usage tracking (consumed during spa sessions) are module-specific but the summary widget shell is reusable
4. THE Inventory Summary widget SHALL display metrics fetched from the core `inventory_items` table filtered by tenant
5. WHERE a tenant module does not use inventory, THE widget SHALL be hidden or show zero metrics gracefully

### Requirement 9: Classify Search and Filter Controls by Domain

**User Story:** As a system architect, I want dashboard control elements (search, month selector, action buttons) classified by domain, so that I understand their reusability.

#### Acceptance Criteria

1. THE Dashboard_Shell SHALL add a JSDoc comment above the header controls section classifying search input as `@widget-type core`
2. THE classification comment SHALL explain that quick search filtering of dashboard content is an industry-neutral UX pattern
3. THE Dashboard_Shell SHALL add a JSDoc comment classifying the month/year selector as `@widget-type core`
4. THE Dashboard_Shell SHALL add a JSDoc comment classifying the "Tạo Booking" button as `@widget-type spa` because it opens spa-specific booking modal
5. THE classification comment SHALL note that core platform would provide a generic "Create Order" action that spa module customizes to "Tạo Booking"

### Requirement 10: Type Dashboard State Variables with View Models

**User Story:** As a developer maintaining dashboard state, I want all `useState` declarations typed with View_Models, so that state updates are type-checked.

#### Acceptance Criteria

1. WHEN `stats` state is declared, THE Dashboard_Shell SHALL type it as `DashboardStatsViewModel[]`
2. WHEN `sessions` state is declared, THE Dashboard_Shell SHALL type it as `DashboardSessionViewModel[]`
3. WHEN `topKTVs` state is declared, THE Dashboard_Shell SHALL type it as `KtvPerformanceViewModel[]`
4. WHEN `performanceData` state is declared, THE Dashboard_Shell SHALL type it as `PerformanceDataPointViewModel[]`
5. WHEN `inventorySummary` state is declared, THE Dashboard_Shell SHALL type it as `InventorySummaryViewModel`
6. WHEN `alerts` state is declared, THE Dashboard_Shell SHALL type it as `DashboardAlert[]` (already typed in dashboard-actions)

### Requirement 11: Preserve All Existing Dashboard Behavior

**User Story:** As a spa business user, I want the dashboard refactor to produce zero UI/UX changes, so that my daily workflow is not disrupted.

#### Acceptance Criteria

1. WHEN the refactored Dashboard_Shell renders, THE visual layout SHALL match the pre-refactor layout pixel-for-pixel
2. WHEN a user clicks "Hoàn thành buổi" on a session card, THE Dashboard_Shell SHALL call `completeSession` and `saveSessionNote` with identical parameters as before
3. WHEN database tables (session_logs, bookings, revenue, session_reviews, app_notifications) change, THE Realtime_Subscription SHALL trigger the same refresh callbacks as before
4. WHEN a user selects a different month/year, THE Dashboard_Shell SHALL fetch data with the same date range logic as before
5. WHEN a user opens the notifications popover, THE Dashboard_Shell SHALL display alerts sorted by timestamp descending as before
6. WHEN a user marks a notification as read, THE Dashboard_Shell SHALL call `markNotificationAsRead` and update alert state identically to before
7. THE refactored Dashboard_Shell SHALL maintain all existing loading states, skeleton loaders, and error toast messages

### Requirement 12: Preserve Dashboard Query Behavior

**User Story:** As a developer verifying the refactor, I want all database queries to execute identically to before, so that dashboard data remains consistent.

#### Acceptance Criteria

1. WHEN `getDashboardPrimaryData` executes, THE Dashboard_Data_Service SHALL run the same Supabase queries with identical filters, joins, and limits as before
2. WHEN `getDashboardSecondaryData` executes, THE Dashboard_Data_Service SHALL run the same Supabase queries as before
3. WHEN `getImportantAlerts` executes, THE Dashboard_Data_Service SHALL return alerts in the same order (timestamp descending) as before
4. THE Dashboard_Data_Service SHALL NOT modify SQL query logic, RLS policies, or database schema
5. WHEN role-based filtering applies (e.g., KTV role sees only their assigned sessions), THE Dashboard_Data_Service SHALL apply the same `.eq('bookings.assigned_ktv_id', currentUser.id)` filter as before

### Requirement 13: Maintain Realtime Subscription Table Coverage

**User Story:** As a spa business user, I want dashboard widgets to auto-refresh when data changes, so that I always see current information.

#### Acceptance Criteria

1. WHEN a record in `session_logs` table changes, THE Realtime_Subscription SHALL trigger `scheduleDashboardRefresh` debounced callback
2. WHEN a record in `bookings` table changes, THE Realtime_Subscription SHALL trigger `scheduleDashboardRefresh` debounced callback
3. WHEN a record in `revenue` table changes, THE Realtime_Subscription SHALL trigger `scheduleDashboardRefresh` debounced callback
4. WHEN a record in `session_reviews` table changes, THE Realtime_Subscription SHALL trigger `scheduleDashboardRefresh` debounced callback
5. WHEN a record in `app_notifications` table changes, THE Realtime_Subscription SHALL trigger `scheduleDashboardAlertsRefresh` debounced callback
6. THE Realtime_Subscription SHALL maintain the same 500ms debounce timeout as before
7. WHEN the Dashboard_Shell unmounts, THE cleanup function SHALL call `supabase.removeChannel` to prevent memory leaks

### Requirement 14: Document Widget Extraction Deferred to Phase 3

**User Story:** As a system architect planning future extraction work, I want clear documentation that actual file/folder restructuring is deferred, so that Phase 1 scope is understood.

#### Acceptance Criteria

1. THE Dashboard_Shell file SHALL include a top-level JSDoc comment stating "Widget classification complete. Actual extraction to src/core/ and src/modules/spa/ deferred to Phase 3 per roadmap."
2. THE classification JSDoc comments SHALL NOT promise immediate file moves or breaking changes
3. THE requirements document SHALL state in the introduction that this is a "code quality and boundary classification refactor with zero functional changes"
4. WHEN a developer reads the roadmap, THE Phase 1 batch description SHALL clarify that only typing and labeling occurs, not restructuring
5. THE requirements document SHALL reference `docs/plans/core-platform-extraction-roadmap.md` as the source of truth for future phases

### Requirement 15: Enforce Zero Regression with Existing Tests

**User Story:** As a QA engineer, I want all existing Jest tests to pass after the refactor, so that I know no behavior regressed.

#### Acceptance Criteria

1. WHEN `npm run test` executes, THE test suite SHALL produce the same pass/fail results as before the refactor
2. WHEN TypeScript compilation runs (`tsc --noEmit`), THE compiler SHALL produce zero new type errors beyond any pre-existing errors
3. WHEN ESLint runs on the refactored files, THE linter SHALL produce zero new violations beyond any pre-existing warnings
4. THE refactored Dashboard_Shell SHALL NOT introduce new console errors or warnings in browser dev tools
5. WHEN the dashboard page loads in a browser, THE browser console SHALL show the same log messages (or fewer, if any were removed) as before

## Core Boundary Decision

- **Classification**: mixed (currently contains both core and spa logic that need separation)
- **Why**: Dashboard is the main overview screen that mixes generic business metrics (customers, bookings, revenue) with spa-specific widgets (KTV performance, session schedules with package multipliers, care workflow alerts)
- **Future industry reuse**: Core dashboard shell (layout, realtime subscriptions, month selector, stats grid framework) should be reusable; spa widgets (KTV table, session cards with package progress, spa-specific alerts) should be modular and swappable
- **Spa behavior preserved by**: Zero UI/UX changes, comprehensive type safety with View_Models, existing tests must pass, no database query modifications
- **Database impact**: None - this is purely a code refactoring/typing/classification exercise with no schema changes or query logic changes
- **Tests required**: 
  - Full TypeScript compilation with `tsc --noEmit` must pass
  - All existing Jest tests must pass with same results
  - ESLint must not introduce new violations
  - Manual smoke test: dashboard page loads and displays all widgets correctly
  - Manual smoke test: realtime updates trigger when database changes
  - Manual smoke test: session completion flow works identically
- **Deferred extraction**: Actual file/folder restructuring to `src/core/` and `src/modules/spa/` is explicitly deferred to Phase 3 of the Core Platform Extraction Roadmap

## Validation Checklist

After completing this refactor, verify:

- [ ] Zero `any` types in `src/app/dashboard/page.tsx`
- [ ] All View_Model interfaces exported from `dashboard-actions.ts`
- [ ] All dashboard widgets have `@widget-type` classification JSDoc comments
- [ ] Stats cards classified (3 core, 1 spa)
- [ ] Today's Schedule widget classified as mixed with explanation
- [ ] RevenueChart classified as core with rating dimension note
- [ ] KtvPerformanceTable classified as spa
- [ ] Alerts panel classified as mixed with alert type breakdown
- [ ] Inventory summary classified as core
- [ ] Header controls classified (search/month: core, booking button: spa)
- [ ] All `useState` typed with View_Models
- [ ] `tsc --noEmit` passes
- [ ] `npm run test` passes with same results as before
- [ ] `npm run lint` passes with no new violations
- [ ] Dashboard page renders identically in browser
- [ ] Realtime subscriptions trigger refreshes correctly
- [ ] Session completion flow works
- [ ] Notifications popover works
- [ ] Month/year selector updates data correctly
