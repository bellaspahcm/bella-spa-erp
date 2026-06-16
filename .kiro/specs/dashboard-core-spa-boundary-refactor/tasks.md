# Implementation Plan: Dashboard Core-SPA Boundary Refactor

## Tổng quan

Đây là Phase 1 của Core Platform Extraction Roadmap: refactor file dashboard để thiết lập ranh giới rõ ràng giữa code core platform (tái sử dụng được cho nhiều ngành) và code spa-specific (chỉ dành cho spa/babycare).

**Mục tiêu refactor:**
- Loại bỏ tất cả `any` types
- Định nghĩa View Model interfaces rõ ràng
- Phân loại tất cả widgets theo domain (`core`, `spa`, hoặc `mixed`)
- Type tất cả state variables với View Models
- Giữ nguyên 100% chức năng hiện tại (zero functional changes)

**Phạm vi:**
- Chỉ refactor typing và classification
- KHÔNG thay đổi UI/UX
- KHÔNG thay đổi database queries
- KHÔNG di chuyển files (deferred to Phase 3)

## Tasks

- [x] 1. Định nghĩa View Model interfaces trong dashboard-actions.ts
  - [x] 1.1 Tạo interface `DashboardStatsViewModel` cho stats cards
    - Export interface với các fields: `label`, `value`, `trend`, `iconName`, `color`, `bg`
    - Type `iconName` là union type: `'Users' | 'Calendar' | 'DollarSign' | 'Star'`
    - Thêm JSDoc comment giải thích interface đại diện cho một stats card
    - _Requirements: 2.1, 10.1_
  
  - [x] 1.2 Tạo interface `DashboardSessionViewModel` cho session list items
    - Export interface với nested structure: `id`, `booking_id`, `status`, `assigned_time`, `bookings` (object với customer/ktv/package details)
    - Match chính xác data shape từ `getUpcomingSessions()` query
    - Thêm JSDoc comment giải thích interface đại diện cho một session card
    - _Requirements: 2.2, 10.2_
  
  - [x] 1.3 Tạo interface `KtvPerformanceViewModel` cho KTV leaderboard rows
    - Export interface với fields: `name`, `sessions`, `rating`, `status`, `bonus`
    - Type `rating` là `number` hoặc `string` (formatted)
    - Thêm JSDoc comment giải thích interface đại diện cho một KTV trong bảng xếp hạng
    - _Requirements: 2.3, 10.3_
  
  - [x] 1.4 Tạo interface `PerformanceDataPointViewModel` cho monthly chart data
    - Export interface với fields: `name`, `customers`, `revenue`, `expense`, `rating`
    - Type `rating` là `number | null` (null khi không có data)
    - Thêm JSDoc comment giải thích interface đại diện cho một data point trên biểu đồ
    - _Requirements: 2.4, 10.4_
  
  - [x] 1.5 Tạo interface `InventorySummaryViewModel` cho inventory metrics
    - Export interface với fields: `totalItems`, `lowStockCount`, `totalValue`
    - Tất cả fields type là `number`
    - Thêm JSDoc comment giải thích interface đại diện cho tổng hợp inventory
    - _Requirements: 2.5, 10.5_
  
  - [x] 1.6 Verify interface `DashboardAlert` đã được export
    - Kiểm tra xem `DashboardAlert` interface đã tồn tại và được export
    - Verify có đầy đủ fields: `id?`, `isAppNotification?`, `type`, `icon`, `title`, `message`, `severity`, `link`, `timestamp`
    - Không cần thay đổi gì nếu đã đúng
    - _Requirements: 2.6_

- [x] 2. Type server action return values trong dashboard-actions.ts
  - [x] 2.1 Thêm return type cho `getUpcomingSessions()`
    - Thêm `: Promise<DashboardSessionViewModel[]>` vào function signature
    - Verify TypeScript compile thành công với `tsc --noEmit`
    - _Requirements: 1.2, 1.5_
  
  - [x] 2.2 Thêm return type cho `getTopTechnicians()`
    - Thêm `: Promise<KtvPerformanceViewModel[]>` vào function signature
    - Verify TypeScript compile thành công
    - _Requirements: 1.2, 1.5_
  
  - [x] 2.3 Thêm return type cho `getMonthlyPerformance()`
    - Thêm `: Promise<PerformanceDataPointViewModel[]>` vào function signature
    - Verify TypeScript compile thành công
    - _Requirements: 1.2, 1.5_
  
  - [x] 2.4 Thêm return type cho `getDashboardInventorySummary()`
    - Thêm `: Promise<InventorySummaryViewModel>` vào function signature
    - Verify interface `DashboardInventorySummary` hiện tại và `InventorySummaryViewModel` có compatible structure
    - Nếu cần, rename `DashboardInventorySummary` thành `InventorySummaryViewModel` để consistent
    - _Requirements: 1.2, 1.5_

- [x] 3. Type dashboard state variables trong page.tsx
  - [x] 3.1 Import tất cả View Model interfaces từ dashboard-actions.ts
    - Thêm import statement: `import type { DashboardStatsViewModel, DashboardSessionViewModel, KtvPerformanceViewModel, PerformanceDataPointViewModel, InventorySummaryViewModel, DashboardAlert } from '@/services/dashboard-actions'`
    - _Requirements: 10.1-10.6_
  
  - [x] 3.2 Type state variable `stats`
    - Thay đổi từ `useState<DashboardStat[]>([])` thành `useState<DashboardStatsViewModel[]>([])`
    - Xóa local type alias `DashboardStat` nếu không còn sử dụng
    - Verify TypeScript compile thành công
    - _Requirements: 10.1_
  
  - [x] 3.3 Type state variable `sessions`
    - Thay đổi từ `useState<DashboardSession[]>([])` thành `useState<DashboardSessionViewModel[]>([])`
    - Xóa local type alias `DashboardSession` và các related types nếu không còn sử dụng
    - Verify TypeScript compile thành công
    - _Requirements: 10.2_
  
  - [x] 3.4 Type state variable `topKTVs`
    - Thay đổi từ `useState<KtvDashboardRow[]>([])` thành `useState<KtvPerformanceViewModel[]>([])`
    - Xóa local type alias `KtvDashboardRow` nếu không còn sử dụng
    - Verify TypeScript compile thành công
    - _Requirements: 10.3_
  
  - [x] 3.5 Type state variable `performanceData`
    - Thay đổi từ `useState<DashboardPerformancePoint[]>([])` thành `useState<PerformanceDataPointViewModel[]>([])`
    - Xóa local type alias `DashboardPerformancePoint` nếu không còn sử dụng
    - Verify TypeScript compile thành công
    - _Requirements: 10.4_
  
  - [x] 3.6 Type state variable `inventorySummary`
    - Thay đổi initial value type thành `useState<InventorySummaryViewModel>({ totalItems: 0, lowStockCount: 0, totalValue: 0 })`
    - Verify TypeScript compile thành công
    - _Requirements: 10.5_
  
  - [x] 3.7 Verify state variable `alerts` đã được type đúng
    - Kiểm tra `alerts` state đã type là `DashboardAlert[]`
    - Không cần thay đổi nếu đã đúng
    - _Requirements: 10.6_

- [x] 4. Thêm JSDoc classifications cho widgets trong page.tsx
  - [x] 4.1 Thêm top-level JSDoc comment về Phase 1 completion
    - Thêm multi-line JSDoc comment ở đầu file sau 'use client'
    - Nội dung: "Dashboard Core-SPA Boundary Refactor - Phase 1 Complete. Widget classification complete. Actual extraction to src/core/ and src/modules/spa/ deferred to Phase 3 per roadmap."
    - Thêm @see reference đến roadmap: `@see docs/plans/core-platform-extraction-roadmap.md`
    - _Requirements: 14.1_
  
  - [x] 4.2 Classify stats cards (Total Customers, Today's Bookings, Monthly Revenue)
    - Tìm code section xây dựng stats array (trong `buildDashboardStats`)
    - Thêm JSDoc comment `@widget-type core` phía trên logic của 3 stats cards này
    - Comment giải thích: "Metrics doanh nghiệp trung lập ngành nghề (customer count, bookings count, revenue)"
    - _Requirements: 3.2, 3.3, 3.4_
  
  - [x] 4.3 Classify KTV Rating stats card
    - Tìm logic của "Đánh giá KTV" stats card
    - Thêm JSDoc comment `@widget-type spa` phía trên
    - Comment giải thích: "Composite rating KTV-specific (60% customer + 40% discipline)"
    - _Requirements: 3.5_
  
  - [x] 4.4 Classify Today's Schedule widget
    - Tìm `<motion.div>` chứa "Sắp tới trong hôm nay" widget
    - Thêm JSDoc comment `@widget-type mixed` phía trên
    - Comment giải thích chi tiết: "Core: Scrollable list shell, loading states, search filter. Spa: Session card content với package progress, KTV assignment, session multipliers. Future: Tách core scheduling shell khỏi spa session renderer."
    - _Requirements: 4.1-4.5_
  
  - [x] 4.5 Classify Performance Chart (RevenueChart)
    - Tìm `<RevenueChart>` component usage
    - Thêm JSDoc comment `@widget-type core` phía trên
    - Comment giải thích: "Monthly performance metrics (revenue, expense, customers) là KPIs trung lập ngành nghề. Note: Rating dimension dùng spa KTV metrics nhưng có thể thay bằng generic service quality cho industries khác."
    - _Requirements: 5.1-5.5_
  
  - [x] 4.6 Classify KTV Performance Table
    - Tìm `<KtvPerformanceTable>` component usage
    - Thêm JSDoc comment `@widget-type spa` phía trên
    - Comment giải thích: "KTV leaderboard với session multipliers, composite ratings, và KPI bonuses là spa/babycare-specific. Industries khác cần different technician performance widgets."
    - _Requirements: 6.1-6.5_
  
  - [x] 4.7 Classify Alerts/Notifications Panel
    - Tìm notifications popover section (bell icon button)
    - Thêm JSDoc comment `@widget-type mixed` phía trên
    - Comment giải thích chi tiết: "Core: Bell icon, popover shell, read/unread state. Mixed alert types - Core: Generic app_notifications, low inventory. Spa: KTV checkout, session overdue, booking near end, leave requests. Future: Core notification system với module-specific alert providers."
    - _Requirements: 7.1-7.5_
  
  - [x] 4.8 Classify Inventory Summary widget
    - Tìm inventory summary display section
    - Thêm JSDoc comment `@widget-type core` phía trên
    - Comment giải thích: "Inventory metrics (total items, low stock count, total value) là supply chain KPIs trung lập ngành nghề. Note: Item categories và usage tracking là module-specific."
    - _Requirements: 8.1-8.5_
  
  - [x] 4.9 Classify header controls (Search, Month/Year selector)
    - Tìm search input và month/year selector controls
    - Thêm JSDoc comment `@widget-type core` cho search input
    - Comment giải thích: "Quick search filtering là UX pattern trung lập ngành nghề"
    - Thêm JSDoc comment riêng cho month/year selector (cũng `@widget-type core`)
    - Comment giải thích: "Month/year selector là dashboard control trung lập ngành nghề"
    - _Requirements: 9.1-9.3_
  
  - [x] 4.10 Classify "Tạo Booking" button
    - Tìm "Tạo Booking" button trong header
    - Thêm JSDoc comment `@widget-type spa` phía trên
    - Comment giải thích: "Opens spa-specific BookingModal. Core platform sẽ cung cấp generic 'Create Order' action mà spa module customizes thành 'Tạo Booking'."
    - _Requirements: 9.4, 9.5_

- [x] 5. Loại bỏ remaining `any` types trong page.tsx
  - [x] 5.1 Search và replace tất cả `any` types
    - Sử dụng regex search: `:\s*any\b` trong page.tsx
    - Thay thế từng occurrence bằng explicit type hoặc View Model
    - Nếu cần type assertion, sử dụng View Models thay vì `any`
    - _Requirements: 1.1-1.5_
  
  - [x] 5.2 Verify không còn implicit `any` từ loose destructuring
    - Check các object destructuring patterns
    - Ensure tất cả destructured values có explicit types từ View Models
    - _Requirements: 1.1-1.5_
  
  - [x] 5.3 Type props passed to child components
    - Verify props cho `<StatsGrid>`, `<RevenueChart>`, `<KtvPerformanceTable>` đều typed
    - Ensure không có implicit `any` trong prop passing
    - _Requirements: 1.3_

- [x] 6. Checkpoint - Verify zero behavior changes và compile success
  - Chạy TypeScript compiler: `npx tsc --noEmit --pretty false`
  - Verify zero type errors (hoặc same count như trước refactor)
  - Chạy ESLint: `npm run lint`
  - Verify zero new linting violations
  - Chạy Jest tests: `npm run test`
  - Verify tất cả tests pass với same results như trước
  - Manual browser test: Load `/dashboard` và verify tất cả widgets render correctly
  - Manual test: Complete một session và verify realtime refresh works
  - Manual test: Click notifications bell và verify popover works
  - Manual test: Change month selector và verify data updates
  - Manual test: Click "Tạo Booking" và verify modal opens
  - Git diff review: Chỉ có changes là types, interfaces, và JSDoc comments
  - _Requirements: 11.1-11.7, 12.1-12.5, 13.1-13.7, 15.1-15.5_

## Notes

- Đây là **pure refactor** với zero functional changes
- Không di chuyển files hay folders (deferred to Phase 3)
- Không thay đổi database queries, UI/UX, hay business logic
- Tất cả tests hiện tại phải pass với same results
- TypeScript strict mode phải pass sau refactor
- JSDoc classifications là documentation-only, không affect runtime
- View Models giúp type safety và traceability cho future extraction phases

## Task Dependency Graph

```json
{
  "waves": [
    {
      "id": 0,
      "tasks": ["1.1", "1.2", "1.3", "1.4", "1.5", "1.6"]
    },
    {
      "id": 1,
      "tasks": ["2.1", "2.2", "2.3", "2.4"]
    },
    {
      "id": 2,
      "tasks": ["3.1"]
    },
    {
      "id": 3,
      "tasks": ["3.2", "3.3", "3.4", "3.5", "3.6", "3.7"]
    },
    {
      "id": 4,
      "tasks": ["4.1", "4.2", "4.3", "4.4", "4.5", "4.6", "4.7", "4.8", "4.9", "4.10"]
    },
    {
      "id": 5,
      "tasks": ["5.1", "5.2", "5.3"]
    },
    {
      "id": 6,
      "tasks": ["6"]
    }
  ]
}
```
