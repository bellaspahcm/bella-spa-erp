# Finance Center & Insurance Center - Architecture Specification

**Version:** 1.0  
**Date:** 04/08/2026  
**Status:** 🚧 PLANNING (Phase 6 Roadmap)  
**Author:** Bella Enterprise AI Architect

---

## 📋 Executive Summary

**Current State:**
- ✅ Backend hoàn chỉnh: `LoanApplicationService`, `InsuranceService`, database tables, workflows, APIs, notifications, commission tracking
- ❌ Missing: Presentation Layer (UI/UX)

**Target State:**
- Build **Finance Center** and **Insurance Center** as full-featured Enterprise Centers
- Follow architectural patterns from existing centers: Journey Center, Workshop Center, Lead Center
- Each center includes: Dashboard, List View, Detail View, Workflow Timeline, Document Management, Analytics

**Why Enterprise Center Architecture?**
- Consistency across Bella Auto module
- Reusable components and patterns
- Scalable for future features
- Professional enterprise-grade UX
- Role-based access control built-in

---

## 🏦 Finance Center Architecture

### Overview
Finance Center quản lý toàn bộ nghiệp vụ tài chính xe: vay vốn, quan hệ ngân hàng, hoa hồng tài chính, báo cáo tài chính.

### Center Structure

```
Finance Center/
├── Dashboard (Overview metrics + charts)
├── Loan Applications (List + CRUD)
├── Loan Workflow (Timeline visualization)
├── Banks Management (Partner banks setup)
├── Document Center (Upload + manage docs)
└── Finance Analytics (Reports + insights)
```

### 1. Finance Dashboard

**Purpose:** Overview tổng quan tình hình vay vốn và quan hệ ngân hàng

**Metrics Cards (5):**
1. **Tổng Hồ Sơ Vay** - Total loan applications submitted
2. **Đã Duyệt** - Approved loans count + amount
3. **Đang Xử Lý** - In-progress applications
4. **Tỷ Lệ Duyệt** - Approval rate % (approved / total)
5. **Doanh Số Theo Ngân Hàng** - Disbursed amount by bank

**Charts (3):**
1. **Loan Volume by Month** (Bar chart)
   - X-axis: Months
   - Y-axis: Number of applications
   - Stacked: Approved / Rejected / Pending

2. **Approval Rate Trend** (Line chart)
   - X-axis: Months
   - Y-axis: Approval rate %
   - Show target line (e.g., 80%)

3. **Bank Partnership Performance** (Horizontal bar chart)
   - Banks ranked by disbursed amount
   - Show interest rate range per bank

**Technical Specs:**
- Component: `FinanceDashboard.tsx`
- Data source: `getFinanceDashboardStats()` RPC
- Refresh: Real-time with `useEffect` polling every 30s
- Charts library: Recharts (consistent với Dashboard Analytics)

---

### 2. Loan Applications List

**Purpose:** Quản lý danh sách hồ sơ vay vốn

**Table Columns:**
| Column | Type | Description |
|--------|------|-------------|
| Khách hàng | Text + Avatar | Customer name + photo |
| VIN | Link | Vehicle identification number (click → vehicle detail) |
| Ngân hàng | Badge | Bank name + logo |
| Khoản vay | Currency | Loan amount (VND formatted) |
| Lãi suất | Percentage | Interest rate % per annum |
| Kỳ hạn | Number | Loan term (months) |
| Ngày nộp | Date | Application submitted date |
| Trạng thái | Status Badge | Loan status (see below) |
| Sale phụ trách | Text + Avatar | Assigned sales person |

**Status Values:**
- `pending` → 🟡 Đang xử lý (Yellow badge)
- `bank_reviewing` → 🔵 Ngân hàng đang xét (Blue badge)
- `approved` → 🟢 Đã duyệt (Green badge)
- `rejected` → 🔴 Từ chối (Red badge)
- `disbursed` → ✅ Đã giải ngân (Green check badge)
- `cancelled` → ⚫ Đã hủy (Gray badge)

**Filters:**
- Status filter tabs (All / Đang xử lý / Đã duyệt / Từ chối / Đã giải ngân)
- Bank dropdown filter
- Date range picker (Ngày nộp from-to)
- Sales person filter (multi-select)

**Actions:**
- Search box (search by customer name, VIN, phone)
- Export Excel button (export filtered results)
- "Tạo hồ sơ mới" button → Loan application form modal
- Row actions: View detail, Edit (if pending), Cancel (if pending)

**Pagination:**
- 20 items per page
- Show: "Hiển thị 1-20 của 156 hồ sơ"
- Previous / Next buttons

**Technical Specs:**
- Component: `LoanApplicationsList.tsx`
- Data source: `getLoanApplications({ filters, page, limit })` API
- State management: `useLoanApplications()` hook
- Table component: Reuse `<DataTable>` from design system

---

### 3. Loan Detail Page

**Purpose:** Xem chi tiết đầy đủ thông tin hồ sơ vay

**Layout:** 3-column layout

#### Left Column: Thông tin Khách hàng
```
┌─────────────────────────────────┐
│  [Avatar]  Nguyễn Văn A         │
│  📞 0901234567                   │
│  📧 nguyenvana@email.com         │
├─────────────────────────────────┤
│  CCCD: 001234567890             │
│  Ngày sinh: 15/03/1985          │
│  Nghề nghiệp: Kỹ sư phần mềm    │
│  Thu nhập: 25,000,000 VND/tháng │
│  Lịch sử tín dụng: Tốt ⭐⭐⭐⭐  │
└─────────────────────────────────┘
```

#### Middle Column: Thông tin Xe
```
┌─────────────────────────────────┐
│  🚗 Honda CR-V 2024             │
│  VIN: JH2RC50A8YM200123         │
│  Màu: Trắng ngọc trai           │
│  Giá niêm yết: 1,029,000,000    │
│  Trạng thái xe: Allocated       │
│  Sales: Trần Thị B              │
└─────────────────────────────────┘
```

#### Right Column: Thông tin Khoản vay
```
┌─────────────────────────────────┐
│  Calculation Breakdown:         │
│                                 │
│  Giá xe:        1,029,000,000   │
│  ↓ (−)                          │
│  Đặt cọc:        -100,000,000   │
│  ↓ (=)                          │
│  Khoản vay:       929,000,000   │
│  ↓ (×)                          │
│  Lãi suất:        8.5% / năm    │
│  ↓ (÷)                          │
│  Thời hạn:        60 tháng      │
│  ↓ (=)                          │
│  Trả góp/tháng:   19,123,456    │
│                                 │
│  Ngân hàng:       VPBank        │
│  Trạng thái:      🟢 Đã duyệt   │
│  Ngày duyệt:      01/08/2026    │
│  Giải ngân dự kiến: 10/08/2026  │
└─────────────────────────────────┘
```

**Action Buttons:**
- "Chỉnh sửa" (Edit - if status = pending)
- "Hủy hồ sơ" (Cancel - if status = pending/bank_reviewing)
- "Xem hồ sơ gốc" (View documents)
- "In hợp đồng" (Print loan contract)
- "Lịch sử thay đổi" (View audit log)

**Technical Specs:**
- Component: `LoanDetailPage.tsx`
- Route: `/dashboard/bella-auto/finance/loans/[id]`
- Data source: `getLoanApplicationDetail(id)` API
- Calculation: Use `LoanCalculatorService` for breakdown

---
