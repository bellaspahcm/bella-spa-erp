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

### 4. Loan Workflow Timeline

**Purpose:** Visualize loan application journey từ Lead đến Delivery

**9 Stages:**
```
1. Lead              → Customer shows interest
2. Quotation         → Price calculation sent
3. Booking           → Customer commits to purchase
4. Deposit           → Down payment received
5. Loan Submitted    → Application sent to bank
6. Bank Reviewing    → Bank processing application
7. Approved          → Bank approves loan
8. Disbursed         → Bank transfers money
9. Delivery          → Vehicle delivered to customer
```

**Visual Design:**
- Horizontal timeline (left to right)
- Each stage is a circle with icon
- Lines connecting stages
- Current stage highlighted (pulsing animation)
- Completed stages: Green ✓
- Current stage: Blue (animated)
- Upcoming stages: Gray
- Rejected: Red ✗

**Stage Details Panel:**
Click on any stage to see:
- Stage name & description
- Entry date/time
- Completed by (user)
- Notes/comments
- Documents attached
- Next action required

**Technical Specs:**
- Component: `LoanWorkflowTimeline.tsx`
- Reuse: Similar to `CustomerJourneyTimeline` from Journey Center
- Animation: Framer Motion for transitions
- Data: `getLoanWorkflowStages(loanId)` API

---

### 5. Document Upload Center

**Purpose:** Upload và quản lý tài liệu hồ sơ vay

**Required Documents (6):**
1. **CCCD/CMND** (Identity card)
   - Front side + Back side
   - File types: JPG, PNG, PDF
   - Max size: 5MB per file
   - OCR extraction: Name, ID number, DOB, Address

2. **Hộ khẩu** (Household registration)
   - Main page + Detail pages
   - File types: JPG, PNG, PDF
   - Max size: 10MB

3. **Sao kê ngân hàng** (Bank statements)
   - Last 6 months
   - File types: PDF, Excel
   - Max size: 20MB
   - Auto-parse: Income, expenses, balance

4. **Hợp đồng lao động** (Employment contract)
   - File types: PDF, DOCX
   - Max size: 10MB

5. **Chứng minh thu nhập** (Income proof)
   - Salary slips (3 months)
   - File types: PDF, JPG, PNG
   - Max size: 5MB per file

6. **Giấy đăng ký xe** (Vehicle registration - if trade-in)
   - File types: JPG, PNG, PDF
   - Max size: 5MB

**Optional Documents:**
- Marriage certificate (if applicable)
- Property ownership papers (if using as collateral)
- Business license (if self-employed)

**UI Features:**
- Drag & drop upload area
- Progress bar per file
- Preview uploaded files (inline viewer)
- Version tracking (if re-uploaded)
- Status indicator per document:
  - ⏳ Pending upload (gray)
  - ✅ Uploaded (green)
  - ⚠️ Needs review (yellow)
  - ✓ Verified (blue check)
  - ✗ Rejected (red X)
- Comments per document (bank feedback)
- Download all as ZIP

**Storage Integration:**
- Cloudflare R2 for file storage
- Path structure: `/loans/{loan_id}/{document_type}/{filename}`
- Signed URLs for secure download
- Auto-delete after 90 days (configurable)

**Technical Specs:**
- Component: `DocumentUploadCenter.tsx`
- Upload handler: `uploadLoanDocument(loanId, docType, file)` API
- Storage: R2 via `@aws-sdk/client-s3` (S3-compatible)
- OCR: Optional integration với Textract or similar
- Reuse: `<FileUploader>` component from design system

---

### 6. Banks Management

**Purpose:** Quản lý ngân hàng đối tác và chính sách lãi suất

**Table Columns:**
| Column | Description |
|--------|-------------|
| Logo | Bank logo (32x32) |
| Tên ngân hàng | Bank full name |
| Mã ngân hàng | Bank code (e.g., VPB, TCB, VCB) |
| Lãi suất | Interest rate range (e.g., 7.5% - 9.5%) |
| Thời hạn | Loan terms available (12, 24, 36, 48, 60 months) |
| Tỷ lệ cho vay | LTV ratio (e.g., 80% - 90%) |
| Điều kiện | Approval criteria link |
| Trạng thái | Active / Inactive |
| Actions | Edit / Deactivate |

**CRUD Operations:**
- **Create:** Add new partner bank
  - Bank info (name, code, logo, contact)
  - Interest rate policies (rate ranges per vehicle segment)
  - Loan terms (min/max months)
  - LTV ratio (loan-to-value %)
  - Approval criteria (min income, credit score, age)
  - Commission structure (fixed or % of loan amount)

- **Read:** View bank details
  - Performance metrics (approval rate, avg processing time)
  - Active loans count
  - Total disbursed amount
  - Historical trend chart

- **Update:** Edit bank policies
  - Interest rate adjustments
  - Terms changes
  - Criteria updates
  - Logo/contact updates

- **Delete:** Deactivate bank
  - Cannot delete if has active loans
  - Soft delete (status = inactive)
  - Keep historical data

**Technical Specs:**
- Component: `BanksManagement.tsx`
- CRUD APIs: `getBanks()`, `createBank()`, `updateBank()`, `deactivateBank()`
- Form validation: Zod schema
- Logo upload: R2 storage (max 100KB, PNG/JPG)

---

## 🛡️ Insurance Center Architecture

### Overview
Insurance Center quản lý toàn bộ nghiệp vụ bảo hiểm xe: hợp đồng bảo hiểm, gia hạn, claims, hoa hồng.

### Center Structure
```
Insurance Center/
├── Dashboard (Overview metrics + charts)
├── Policies Management (List + CRUD)
├── Policy Detail (Coverage + files + history)
├── Renewal Center (Alert + reminders)
├── Claims Management (Upload + tracking)
└── Insurance Analytics (Reports + insights)
```

### 1. Insurance Dashboard

**Purpose:** Overview tổng quan tình hình bảo hiểm và gia hạn

**Metrics Cards (5):**
1. **Doanh Thu BH** - Total insurance revenue (current month)
2. **Hoa Hồng** - Total commission earned (current month)
3. **Sắp Hết Hạn** - Policies expiring in next 30 days (count + alert badge)
4. **Đã Gia Hạn** - Renewed policies this month
5. **Tỷ Lệ Tái Tục** - Renewal rate % (renewed / expired)

**Charts (4):**
1. **Revenue by Insurance Type** (Pie chart)
   - TNDS (Compulsory civil liability)
   - Vật chất (Physical damage)
   - Combo (Both)
   - Breakdown by percentage + amount

2. **Renewal Rate Trend** (Line chart)
   - X-axis: Months (last 12 months)
   - Y-axis: Renewal rate %
   - Target line at 75%

3. **Commission by Sales** (Horizontal bar chart)
   - Top 10 sales by commission earned
   - Show total policies sold per sales

4. **Expiration Calendar Heatmap**
   - Calendar view showing expiry dates
   - Color intensity = number of policies expiring
   - Click on date → see list of policies

**Technical Specs:**
- Component: `InsuranceDashboard.tsx`
- Data source: `getInsuranceDashboardStats()` RPC
- Refresh: Real-time polling every 60s
- Charts: Recharts library

---

### 2. Insurance Policies List

**Purpose:** Quản lý danh sách hợp đồng bảo hiểm

**Table Columns:**
| Column | Type | Description |
|--------|------|-------------|
| Khách hàng | Text + Avatar | Customer name + photo |
| VIN | Link | Vehicle identification (click → vehicle detail) |
| Loại BH | Badge | TNDS / Vật chất / Combo |
| Đơn vị BH | Text + Logo | Insurance provider (PVI, BIC, PTI, etc.) |
| Ngày hiệu lực | Date | Effective start date |
| Ngày hết hạn | Date + Alert | Expiry date (red if < 30 days) |
| Phí BH | Currency | Insurance premium (VND) |
| Hoa hồng | Currency | Commission amount (VND) |
| Trạng thái | Status Badge | Active / Expired / Expiring soon |
| Actions | Buttons | View / Renew / Print |

**Status Values:**
- `active` → 🟢 Đang hiệu lực (Green badge)
- `expiring_soon` → 🟡 Sắp hết hạn (Yellow badge, < 30 days)
- `expired` → 🔴 Đã hết hạn (Red badge)
- `cancelled` → ⚫ Đã hủy (Gray badge)
- `pending_renewal` → 🔵 Chờ gia hạn (Blue badge)

**Filters:**
- Status tabs (All / Active / Expiring soon / Expired / Cancelled)
- Insurance type dropdown (All / TNDS / Vật chất / Combo)
- Provider dropdown
- Date range picker (Ngày hết hạn from-to)
- Sales person filter

**Actions:**
- Search box (customer name, VIN, policy number)
- Export Excel (filtered results)
- "Tạo hợp đồng mới" button
- Bulk actions: Send renewal reminders (select multiple)

**Technical Specs:**
- Component: `InsurancePoliciesList.tsx`
- Data source: `getInsurancePolicies({ filters, page, limit })` API
- Hook: `useInsurancePolicies()`
- Table: Reuse `<DataTable>` component

---

### 3. Policy Detail Page

**Purpose:** Xem chi tiết đầy đủ hợp đồng bảo hiểm

**Layout:** Tabbed interface with 4 tabs

#### Tab 1: Thông Tin Cơ Bản
```
┌─────────────────────────────────────────────┐
│ 📋 Policy Information                       │
├─────────────────────────────────────────────┤
│ Policy Number:    PVI-2024-00123456        │
│ Insurance Type:   🛡️ Combo (TNDS + Vật chất)│
│ Provider:         PVI Insurance             │
│ Effective Date:   01/08/2024               │
│ Expiry Date:      31/07/2025 (⚠️ 27 days)  │
│ Premium:          8,500,000 VND             │
│ Commission:       850,000 VND (10%)         │
│ Status:           🟡 Expiring Soon          │
├─────────────────────────────────────────────┤
│ 🚗 Vehicle Information                      │
├─────────────────────────────────────────────┤
│ VIN:              JH2RC50A8YM200123         │
│ Model:            Honda CR-V 2024           │
│ Owner:            Nguyễn Văn A              │
│ License Plate:    30A-12345                 │
├─────────────────────────────────────────────┤
│ 👤 Customer Information                     │
├─────────────────────────────────────────────┤
│ Name:             Nguyễn Văn A              │
│ Phone:            0901234567                │
│ Email:            nguyenvana@email.com      │
│ Address:          123 Đường ABC, Q.1, HCM   │
└─────────────────────────────────────────────┘
```

#### Tab 2: Quyền Lợi Bảo Hiểm (Coverage Details)
```
┌─────────────────────────────────────────────┐
│ TNDS - Trách nhiệm dân sự (Compulsory)     │
├─────────────────────────────────────────────┤
│ ✓ Người thứ 3:           100,000,000 VND    │
│ ✓ Tài sản thứ 3:          50,000,000 VND    │
│ ✓ Hành khách:             10,000,000 VND/người│
├─────────────────────────────────────────────┤
│ Vật chất - Physical Damage                 │
├─────────────────────────────────────────────┤
│ ✓ Giá trị xe:          1,029,000,000 VND    │
│ ✓ Mức khấu trừ:            5,000,000 VND    │
│ ✓ Tai nạn, va chạm:      Full coverage      │
│ ✓ Cháy nổ:               Full coverage      │
│ ✓ Thiên tai:             Full coverage      │
│ ✓ Mất cắp:               Full coverage      │
│ ✗ Lũ lụt:                Not covered         │
└─────────────────────────────────────────────┘
```

#### Tab 3: Tài Liệu Hợp Đồng (Documents)
- PDF viewer inline (contract file)
- Download button
- Print button
- Version history (if renewed multiple times)
- Upload additional documents (photos, claims evidence)

#### Tab 4: Lịch Sử Gia Hạn (Renewal History)
**Table:**
| Year | Effective | Expiry | Premium | Status | Action |
|------|-----------|--------|---------|--------|--------|
| 2024 | 01/08/2024 | 31/07/2025 | 8,500,000 | Active | View |
| 2023 | 01/08/2023 | 31/07/2024 | 8,200,000 | Expired | View |
| 2022 | 01/08/2022 | 31/07/2023 | 7,800,000 | Expired | View |

**Action Buttons (Bottom):**
- "Gia hạn ngay" (Renew now) - Opens renewal form
- "Gửi nhắc nhở" (Send reminder) - Email/SMS to customer
- "In hợp đồng" (Print contract)
- "Hủy hợp đồng" (Cancel policy - requires confirmation)
- "Báo cáo sự cố" (Report claim) - Opens claim form

**Technical Specs:**
- Component: `PolicyDetailPage.tsx`
- Route: `/dashboard/bella-auto/insurance/policies/[id]`
- Data: `getPolicyDetail(id)` API
- PDF viewer: `react-pdf` library
- Tabs: Headless UI `<Tab>` component

---

### 4. Renewal Center

**Purpose:** Quản lý gia hạn bảo hiểm với alert system

**4 Alert Categories:**

#### 1. Còn 30 ngày (Yellow - Warning)
- Badge: 🟡 30 ngày
- Auto-reminder: Gửi email/SMS tự động
- Actions: "Gửi báo giá gia hạn", "Đánh dấu đã liên hệ"

#### 2. Còn 15 ngày (Orange - Urgent)
- Badge: 🟠 15 ngày
- Auto-reminder: Gửi email/SMS + call log reminder
- Priority display: Move to top of list
- Actions: "Gọi ngay", "Gửi SMS khẩn", "Gia hạn nhanh"

#### 3. Hôm nay (Red - Critical)
- Badge: 🔴 Hôm nay
- Push notification to sales
- High priority indicator
- Actions: "Xử lý khẩn cấp", "Gia hạn 1 click"

#### Tab 3: Tài Liệu & Files
```
┌─────────────────────────────────────────────┐
│ 📁 Attached Documents                       │
├─────────────────────────────────────────────┤
│ ✓ Hợp đồng bảo hiểm (PDF)     2.1 MB       │
│   Uploaded: 01/08/2024 by Trần Thị B       │
│   [👁️ View] [⬇️ Download]                   │
│                                             │
│ ✓ Giấy chứng nhận (PDF)       1.5 MB       │
│   Uploaded: 01/08/2024 by Trần Thị B       │
│   [👁️ View] [⬇️ Download]                   │
│                                             │
│ ✓ Biên lai thanh toán (JPG)   0.8 MB       │
│   Uploaded: 01/08/2024 by System           │
│   [👁️ View] [⬇️ Download]                   │
│                                             │
│ [+ Upload New Document]                     │
└─────────────────────────────────────────────┘
```

#### Tab 4: Lịch Sử Thay Đổi (Audit Log)
```
┌─────────────────────────────────────────────┐
│ 📅 Timeline                                 │
├─────────────────────────────────────────────┤
│ 01/08/2024 10:30 AM                         │
│ ✓ Policy created by Trần Thị B              │
│                                             │
│ 01/08/2024 11:00 AM                         │
│ ✓ Documents uploaded (3 files)              │
│                                             │
│ 01/08/2024 02:15 PM                         │
│ ✓ Payment received (8,500,000 VND)         │
│                                             │
│ 05/07/2025 09:00 AM                         │
│ ⚠️ Renewal reminder sent                    │
│                                             │
│ 25/07/2025 03:45 PM                         │
│ ⚠️ Expiring soon alert (7 days)             │
└─────────────────────────────────────────────┘
```

**Action Buttons:**
- "Gia hạn" (Renew policy)
- "In hợp đồng" (Print policy)
- "Gửi nhắc nhở" (Send reminder to customer)
- "Hủy hợp đồng" (Cancel policy - with confirmation)

**Technical Specs:**
- Component: `PolicyDetailPage.tsx`
- Route: `/dashboard/bella-auto/insurance/policies/[id]`
- Data source: `getInsurancePolicyDetail(id)` API
- Tabs: React Tabs or Radix UI Tabs
- Files: R2 storage integration

---

### 4. Renewal Center

**Purpose:** Quản lý gia hạn bảo hiểm và nhắc nhở tự động

**Layout:** 3-section dashboard

#### Section 1: Renewal Calendar
```
┌─────────────────────────────────────────────┐
│ 📅 August 2026                              │
├──┬──┬──┬──┬──┬──┬──┐                       │
│Su│Mo│Tu│We│Th│Fr│Sa│                       │
├──┼──┼──┼──┼──┼──┼──┤                       │
│  │  │  │  │ 1│ 2│ 3│                       │
│ 4│ 5│🔴│ 7│ 8│🟡│10│  🔴 = 5+ expiring     │
│11│12│13│🟢│15│16│17│  🟡 = 2-4 expiring    │
│18│19│🔴│21│22│23│24│  🟢 = 1 expiring      │
│25│26│27│28│29│30│31│                       │
└──┴──┴──┴──┴──┴──┴──┘                       │
```

#### Section 2: Expiring Policies Table
**Columns:**
- Khách hàng (Customer)
- VIN
- Loại BH (Type)
- Ngày hết hạn (Expiry date)
- Số ngày còn lại (Days remaining - countdown badge)
- Trạng thái nhắc nhở (Reminder status)
- Actions (Call / SMS / Email / Renew)

**Auto-Reminder Rules:**
- 30 days before: First reminder (SMS + Email)
- 14 days before: Second reminder (SMS + Phone call task)
- 7 days before: Urgent reminder (SMS + Push notification)
- 3 days before: Final reminder (Phone call required)
- On expiry date: Expired notification

#### Section 3: Renewal Performance
**Metrics:**
- Renewal rate this month: 78% (target: 75%)
- Avg days to renew: 12 days before expiry
- Total renewal revenue: 156,000,000 VND
- Pending renewals: 23 policies

**Technical Specs:**
- Component: `RenewalCenter.tsx`
- Data source: `getExpiringPolicies()`, `getRenewalStats()` APIs
- Calendar: FullCalendar or react-big-calendar
- Reminders: Automated via background jobs (RabbitMQ queue)
- Notification: SMS via Twilio, Email via SendGrid

---

### 5. Claims Management

**Purpose:** Quản lý hồ sơ bồi thường bảo hiểm

**Claims List Table:**
| Column | Description |
|--------|-------------|
| Claim ID | Unique claim identifier |
| Khách hàng | Customer name |
| VIN | Vehicle |
| Policy Number | Insurance policy |
| Loại sự cố | Incident type (Accident / Theft / Fire / Natural disaster) |
| Ngày xảy ra | Incident date |
| Giá trị yêu cầu | Claimed amount (VND) |
| Giá trị duyệt | Approved amount (VND) |
| Trạng thái | Submitted / Under review / Approved / Paid / Rejected |
| Actions | View / Upload docs / Update status |

**Claim Status Flow:**
1. **Submitted** → Customer submits claim with documents
2. **Under Review** → Insurance provider reviewing
3. **Additional Docs Required** → Provider requests more evidence
4. **Approved** → Provider approves claim
5. **Paid** → Money transferred to customer
6. **Rejected** → Claim denied (with reason)

**Claim Detail Page:**
- Incident description (text + photos)
- Police report (if applicable)
- Repair estimate (from workshop)
- Damage assessment photos (before/after)
- Insurance provider feedback
- Payment history

**Document Upload:**
- Drag & drop area
- Required docs:
  - Accident report (Biên bản tai nạn)
  - Photos of damage (min 4 angles)
  - Repair invoice (if already repaired)
  - Police report (if theft/serious accident)
- File types: JPG, PNG, PDF
- Max size: 10MB per file

**Technical Specs:**
- Component: `ClaimsManagement.tsx`
- CRUD APIs: `getClaims()`, `createClaim()`, `updateClaimStatus()`
- File upload: R2 storage
- Status workflow: FSM (Finite State Machine)

---

### 6. Insurance Analytics

**Purpose:** Báo cáo và phân tích nghiệp vụ bảo hiểm

**Reports (6):**

#### 6.1. Revenue Report
- Total revenue by month (12 months trend)
- Revenue by insurance type (TNDS vs Vật chất vs Combo)
- Revenue by provider (PVI, BIC, PTI, etc.)
- Average premium per policy
- Growth rate MoM (Month-over-Month)

#### 6.2. Commission Report
- Total commission earned
- Commission by sales person (leaderboard)
- Commission rate trend
- Top products by commission
- Commission payout schedule

#### 6.3. Renewal Funnel
- Policies expiring: 100
  → Reminders sent: 100 (100%)
  → Customers contacted: 85 (85%)
  → Renewals closed: 78 (78%)
  → Lost to competition: 7 (7%)
  → No longer owns vehicle: 15 (15%)

#### 6.4. Claims Analysis
- Claims count by incident type
- Average claim amount
- Approval rate (approved / total)
- Avg processing time (days)
- Top causes of accidents

#### 6.5. Provider Performance
- Providers ranked by premium volume
- Average approval rate per provider
- Avg claims processing time
- Customer satisfaction score
- Commission rate comparison

#### 6.6. Customer Retention
- Retention rate by cohort (year of first policy)
- Churn reasons analysis
- Lifetime value per customer
- Repeat purchase rate

**Export Options:**
- Excel (all reports)
- PDF (formatted report with charts)
- CSV (raw data)

**Technical Specs:**
- Component: `InsuranceAnalytics.tsx`
- Data source: `getInsuranceAnalyticsReport({ reportType, dateRange })` API
- Charts: Recharts library
- Export: Export to Excel via SheetJS, PDF via jsPDF

---

## 🎨 Design System & Reusable Components

### Components to Reuse from Existing Centers
1. **`<DataTable>`** - Sortable, filterable table with pagination
2. **`<StatusBadge>`** - Color-coded status indicators
3. **`<MetricCard>`** - Dashboard metric display cards
4. **`<DateRangePicker>`** - Date range filter component
5. **`<FileUploader>`** - Drag & drop file upload
6. **`<Timeline>`** - Vertical timeline for audit logs
7. **`<Modal>`** - Modal dialogs for forms
8. **`<ConfirmDialog>`** - Confirmation dialogs for destructive actions
9. **`<LoadingSpinner>`** - Loading states
10. **`<EmptyState>`** - Empty data placeholders

### New Components to Build
1. **`<LoanCalculatorBreakdown>`** - Visual loan calculation display
2. **`<WorkflowTimeline>`** - Horizontal loan workflow stages
3. **`<ExpirationCalendar>`** - Calendar heatmap for policy expiries
4. **`<RenewalReminderCard>`** - Reminder notification card
5. **`<ClaimStatusStepper>`** - Step-by-step claim progress
6. **`<BankLogo>`** - Bank logo display component
7. **`<InsuranceProviderBadge>`** - Provider logo + name badge

### Design Tokens
Follow existing Bella Auto design system:
- Primary color: `#0891b2` (Cyan-600) - Ocean Clean theme
- Accent color: `#14b8a6` (Teal-500)
- Success: `#10b981` (Green-500)
- Warning: `#f59e0b` (Amber-500)
- Danger: `#ef4444` (Red-500)
- Typography: Inter font family
- Border radius: 8px
- Shadow: Tailwind shadow-md

---

## 🔧 Technical Implementation Stack

### Frontend
- **Framework:** Next.js 15 (App Router)
- **Language:** TypeScript
- **UI Library:** React 19
- **Styling:** Tailwind CSS
- **Components:** Radix UI primitives
- **Forms:** React Hook Form + Zod validation
- **State:** Zustand (local state), React Query (server state)
- **Charts:** Recharts
- **Date:** date-fns
- **File Upload:** react-dropzone

### Backend
- **API:** Next.js API Routes (App Router)
- **Database:** PostgreSQL (Supabase)
- **ORM:** Supabase Client (auto-generated types)
- **File Storage:** Cloudflare R2 (S3-compatible)
- **Background Jobs:** BullMQ (Redis-backed queue)
- **Notifications:** Twilio (SMS), SendGrid (Email)

### Services Already Implemented ✅
- `LoanApplicationService` - Loan CRUD + workflow
- `InsuranceService` - Insurance CRUD + renewal logic
- `CommissionService` - Commission calculation + tracking
- `NotificationService` - Multi-channel notifications
- `FileStorageService` - R2 integration

### RPCs to Create
1. `getFinanceDashboardStats()` - Finance dashboard metrics
2. `getLoanApplications()` - Filtered loan list
3. `getLoanApplicationDetail(id)` - Loan full details
4. `getLoanWorkflowStages(loanId)` - Workflow timeline data
5. `getInsuranceDashboardStats()` - Insurance dashboard metrics
6. `getInsurancePolicies()` - Filtered policies list
7. `getInsurancePolicyDetail(id)` - Policy full details
8. `getExpiringPolicies()` - Policies expiring soon
9. `getRenewalStats()` - Renewal performance metrics
10. `getClaims()` - Claims list
11. `getInsuranceAnalyticsReport()` - Analytics data

---

## 📊 Database Schema Extensions

### Existing Tables ✅
- `loan_applications` - Loan application data
- `loan_application_documents` - Uploaded documents
- `loan_application_workflow_stages` - Workflow tracking
- `insurance_policies` - Insurance contracts
- `insurance_policy_documents` - Policy files
- `insurance_claims` - Claims records
- `partner_banks` - Bank partners
- `insurance_providers` - Insurance companies
- `commissions` - Commission tracking

### New Tables to Add (if needed)
1. **`renewal_reminders`** - Track automated reminder logs
   - `id`, `policy_id`, `reminder_type`, `sent_at`, `status`, `channel`

2. **`loan_calculator_configs`** - Store bank-specific calculation rules
   - `id`, `bank_id`, `min_term`, `max_term`, `min_ltv`, `max_ltv`, `base_rate`

3. **`insurance_premium_configs`** - Premium calculation rules
   - `id`, `provider_id`, `vehicle_type`, `coverage_type`, `base_premium`, `factors`

---

## 🚀 Implementation Roadmap

### Phase 6.1: Finance Center (4 weeks)
**Week 1-2: Core Finance Pages**
- [ ] Finance Dashboard (metrics + charts)
- [ ] Loan Applications List (table + filters)
- [ ] Loan Detail Page (3-column layout)
- [ ] Create/Edit Loan Application form

**Week 3: Workflow & Documents**
- [ ] Loan Workflow Timeline (9 stages visualization)
- [ ] Document Upload Center (R2 integration)
- [ ] OCR integration for identity docs (optional)

**Week 4: Banks & Analytics**
- [ ] Banks Management (CRUD)
- [ ] Finance Analytics (6 reports)
- [ ] Export functionality (Excel, PDF)

### Phase 6.2: Insurance Center (4 weeks)
**Week 1-2: Core Insurance Pages**
- [ ] Insurance Dashboard (metrics + charts)
- [ ] Policies List (table + filters)
- [ ] Policy Detail Page (4 tabs)
- [ ] Create/Edit Policy form

**Week 3: Renewal & Claims**
- [ ] Renewal Center (calendar + reminders)
- [ ] Automated renewal notifications
- [ ] Claims Management (list + detail + upload)

**Week 4: Analytics & Polish**
- [ ] Insurance Analytics (6 reports)
- [ ] Export functionality
- [ ] UI/UX refinements
- [ ] Testing & bug fixes

### Total Timeline: 6-8 weeks
- Pure UI/UX implementation (backend already complete)
- Parallel work on Finance + Insurance possible
- Integration testing: 1 week buffer
- Documentation: Ongoing

---

## ✅ Success Criteria

### Functional Requirements
- [ ] All 12 screens implemented and working
- [ ] CRUD operations functional for all entities
- [ ] File upload/download working (R2)
- [ ] Workflows and status transitions correct
- [ ] Automated reminders sending on schedule
- [ ] Reports generating accurate data
- [ ] Export functionality working (Excel, PDF)

### Non-Functional Requirements
- [ ] Page load time < 2 seconds
- [ ] Mobile responsive (Tailwind breakpoints)
- [ ] Accessibility: WCAG AA compliant
- [ ] Browser support: Chrome, Firefox, Safari, Edge (latest 2 versions)
- [ ] SEO: Meta tags for all public pages
- [ ] Security: Role-based access control enforced

### Quality Metrics
- [ ] TypeScript: 100% type coverage (no `any`)
- [ ] ESLint: 0 errors, 0 warnings
- [ ] Test coverage: >80% (Jest + React Testing Library)
- [ ] Lighthouse score: >90 (Performance, Accessibility, Best Practices, SEO)

---

## 📚 References

### Related Documents
- `BELLA_AUTO_CODEBASE_REPORT.html` - Module overview
- `docs/bella-auto/BUSINESS_LOGIC.md` - Business rules
- `docs/bella-auto/DATABASE_SCHEMA.md` - Database structure
- `docs/INDUSTRY_MODULE_DEVELOPMENT_PLAYBOOK.md` - Module development guide

### Design System
- Bella Auto uses **Ocean Clean** theme preset
- Primary: Cyan-600 (`#0891b2`)
- Accent: Teal-500 (`#14b8a6`)
- Follow patterns from existing centers

### API Documentation
- Loan APIs: `src/app/api/bella-auto/loans/**`
- Insurance APIs: `src/app/api/bella-auto/insurance/**`
- Commission APIs: `src/app/api/bella-auto/commissions/**`

---

## 🎯 Next Steps

1. **Review & Approval** - Get stakeholder sign-off on this architecture
2. **UI Mockups** - Create Figma designs for key screens
3. **Sprint Planning** - Break down into 2-week sprints
4. **Component Library** - Build reusable components first
5. **Parallel Implementation** - Finance + Insurance teams work concurrently
6. **Integration Testing** - Test end-to-end workflows
7. **User Acceptance Testing** - Pilot with select dealerships
8. **Production Deployment** - Gradual rollout with monitoring

---

**Document Status:** ✅ COMPLETE  
**Ready for:** Review & UI/UX Design Phase  
**Estimated Effort:** 240-320 hours (6-8 weeks, 2 developers)  
**Backend Dependency:** ✅ NONE (All services implemented)  
**Risk Level:** 🟢 LOW (Pure UI work, proven patterns)

---

*Generated by Bella Enterprise AI Architect*  
*Last Updated: 04/08/2026*

#### 4. Quá hạn (Dark Red - Overdue)
- Badge: ⚫ Quá hạn
- Status changed to "Expired"
- Move to "Lost opportunities" section
- Actions: "Liên hệ phục hồi", "Đánh dấu mất khách"

**Table Columns:**
| Customer | VIN | Type | Expiry | Days Left | Last Contact | Sales | Actions |
|----------|-----|------|--------|-----------|--------------|-------|---------|
| Nguyễn Văn A | JH2RC50... | Combo | 31/08/2026 | 🟡 27 | 01/08/2026 | Trần B | [Buttons] |

**Bulk Actions:**
- Select multiple rows
- "Gửi SMS hàng loạt" (Bulk SMS)
- "Gửi email gia hạn" (Bulk email)
- "Tạo task cho sales" (Create follow-up tasks)
- "Export danh sách" (Export to Excel)

**Filters:**
- Alert category tabs (30 days / 15 days / Today / Overdue)
- Insurance type filter
- Sales person filter
- Sort by: Expiry date (ASC/DESC), Last contact date

**Automation Rules:**
- 30 days before: Auto-send email with renewal quote
- 15 days before: Auto-send SMS + create task for sales
- 7 days before: Daily reminder to sales dashboard
- 1 day before: Push notification + SMS to customer
- Expiry date: Auto-change status to "Expired"

**Technical Specs:**
- Component: `RenewalCenter.tsx`
- Data: `getRenewalAlerts({ category, filters })` API
- Automation: Background job (cron) running daily at 8 AM
- Notifications: Integration with `NotificationService`
- SMS: Integration with SMS gateway (e.g., Twilio, VNPT)

---

### 5. Claims Management

**Purpose:** Quản lý báo cáo sự cố và xử lý claims

**Claim Types:**
1. Tai nạn va chạm (Collision)
2. Cháy nổ (Fire/Explosion)
3. Mất cắp (Theft)
4. Thiên tai (Natural disaster)
5. Hư hỏng kỹ thuật (Mechanical breakdown)
6. Kính vỡ (Glass breakage)
7. Khác (Other)

**Claims List Table:**
| Claim ID | VIN | Customer | Type | Incident Date | Reported Date | Est. Amount | Status | Actions |
|----------|-----|----------|------|---------------|---------------|-------------|--------|---------|
| CLM-001 | JH2... | Nguyễn A | Collision | 01/08/2026 | 02/08/2026 | 15,000,000 | Processing | View |

**Claim Status:**
- `reported` → 🟡 Đã báo cáo (Yellow)
- `photos_uploaded` → 🟠 Đã upload ảnh (Orange)
- `submitted_to_provider` → 🔵 Đã gửi BH (Blue)
- `provider_reviewing` → 🔵 BH đang xét (Blue)
- `approved` → 🟢 Đã duyệt (Green)
- `paid` → ✅ Đã thanh toán (Green check)
- `rejected` → 🔴 Từ chối (Red)

**Claim Detail Page:**

#### Section 1: Incident Information
```
┌─────────────────────────────────────────────┐
│ 📋 Claim Information                        │
├─────────────────────────────────────────────┤
│ Claim ID:         CLM-2024-00123           │
│ Type:             🚗 Tai nạn va chạm        │
│ Incident Date:    01/08/2026 15:30         │
│ Reported Date:    02/08/2026 09:00         │
│ Location:         123 Đường ABC, Q.1, HCM   │
│ Police Report:    Yes (Report #: ABC123)    │
│ Est. Damage:      15,000,000 VND            │
│ Deductible:       5,000,000 VND             │
│ Claim Amount:     10,000,000 VND            │
└─────────────────────────────────────────────┘
```

#### Section 2: Description & Photos
- Text area: Mô tả chi tiết sự cố
- Photo upload: Drag & drop / Browse
  - Photo categories: Front damage, Rear damage, Side damage, Interior, VIN plate, Scene overview
  - Max 20 photos per claim
  - Max 5MB per photo
- Video upload (optional): Dashcam footage
  - Max 100MB per video

#### Section 3: Timeline & Status Updates
```
Timeline:
  02/08/2026 09:00  ✓ Claim reported
  02/08/2026 10:30  ✓ Photos uploaded (8 photos)
  02/08/2026 14:00  ✓ Submitted to PVI
  03/08/2026 10:00  ⏳ PVI reviewing
  05/08/2026 15:00  ⏳ Pending approval
```

#### Section 4: Provider Communication
- Internal notes (visible to staff only)
- Messages from insurance provider
- Documents from provider (e.g., approval letter, rejection reason)
- Response form (reply to provider)

**Action Buttons:**
- "Upload thêm ảnh" (Upload more photos)
- "Gửi cho BH" (Submit to insurance provider)
- "Theo dõi tiến độ" (Track status with provider - if API available)
- "In biên bản" (Print claim report)
- "Đóng claim" (Close claim - mark as resolved)

**Technical Specs:**
- Component: `ClaimsManagement.tsx`, `ClaimDetailPage.tsx`
- Route: `/dashboard/bella-auto/insurance/claims/[id]`
- Data: `getClaims()`, `getClaimDetail(id)` APIs
- Photo upload: R2 storage, path `/claims/{claim_id}/photos/`
- Video upload: R2 with presigned upload URLs
- Provider API: Optional integration with insurance provider APIs (if available)

---

### 6. Insurance Analytics

**Purpose:** Báo cáo và phân tích hiệu quả bảo hiểm

**Reports (6):**

#### 1. Revenue Breakdown by Type
- Pie chart: TNDS vs Vật chất vs Combo
- Table: Type, Policies sold, Total revenue, Avg premium
- Time filter: This month / Last month / This quarter / This year

#### 2. Renewal Conversion Funnel
```
Funnel stages:
  Expired policies:           120  (100%)
    ↓
  Renewal reminders sent:     120  (100%)
    ↓
  Customer responded:          85  (71%)
    ↓
  Quote accepted:              70  (58%)
    ↓
  Payment received:            65  (54%)
    ↓
  Policy renewed:              63  (53%)  ← Final conversion rate
```

#### 3. Claim Frequency Analysis
- Chart: Number of claims per month
- Table: Claim type, Count, Avg amount, Approval rate
- Identify high-risk vehicles (many claims)

#### 4. Profitability per Provider
- Table: Provider, Policies sold, Revenue, Commission paid, Net profit
- Sort by: Net profit DESC
- Highlight: Best performing provider (green), Worst (red)

#### 5. Sales Performance
- Table: Sales person, Policies sold, Revenue, Commission earned
- Chart: Top 10 sales by revenue
- Leaderboard view with rankings

#### 6. Expiry Forecast
- Chart: Projected expirations next 6 months
- Alert: Months with high expiry count (prepare renewal campaign)
- Renewal target vs actual tracking

**Export Options:**
- Export to Excel
- Export to PDF
- Schedule email report (daily/weekly/monthly)

**Technical Specs:**
- Component: `InsuranceAnalytics.tsx`
- Data: `getInsuranceAnalytics({ reportType, dateRange })` RPC
- Charts: Recharts library
- Export: `xlsx` library for Excel, `jsPDF` for PDF
- Scheduled reports: Background job with email integration

---

## 🎨 Design System & Component Reuse

### Reusable Components

**From existing centers:**
1. `<DataTable>` - Used in all list views
2. `<StatusBadge>` - Consistent status indicators
3. `<MetricCard>` - Dashboard metrics display
4. `<Timeline>` - Workflow and history visualization
5. `<FileUploader>` - Document upload
6. `<DateRangePicker>` - Date filtering
7. `<SearchBox>` - Search functionality
8. `<ExportButton>` - Export to Excel/PDF
9. `<FilterTabs>` - Status/category filtering
10. `<ActionMenu>` - Dropdown actions per row

**New components to build:**
1. `<LoanCalculator>` - Interactive loan calculation widget
2. `<RenewalAlertCard>` - Specialized card for renewal alerts
3. `<ClaimPhotoGallery>` - Photo viewer for claims
4. `<CoverageDisplay>` - Insurance coverage details formatter
5. `<CommissionTracker>` - Commission calculation display

---

## 🔐 Role-Based Access Control (RBAC)

### Roles & Permissions

#### 1. Finance Manager
**Finance Center:**
- ✅ View all loan applications
- ✅ Approve/reject loans
- ✅ Manage bank partnerships
- ✅ View finance analytics
- ✅ Edit loan terms
- ✅ Access all documents

**Insurance Center:**
- ✅ View all policies
- ✅ Manage claims
- ✅ View insurance analytics
- ✅ Configure providers
- ❌ Cannot delete finalized records

#### 2. Sales Person
**Finance Center:**
- ✅ View own loan applications
- ✅ Create new loan applications
- ✅ Upload documents
- ✅ View loan status
- ❌ Cannot approve loans
- ❌ Cannot edit bank settings
- ❌ Limited analytics (own performance only)

**Insurance Center:**
- ✅ View assigned policies
- ✅ Create new policies
- ✅ Send renewal reminders
- ✅ View renewal alerts
- ✅ Report claims
- ❌ Cannot manage providers
- ❌ Limited analytics

#### 3. Accountant
**Finance Center:**
- ✅ View all loans (read-only)
- ✅ Export financial reports
- ✅ View commission calculations
- ✅ Access analytics
- ❌ Cannot create/edit loans
- ❌ Cannot manage banks

**Insurance Center:**
- ✅ View all policies (read-only)
- ✅ View commission reports
- ✅ Export revenue reports
- ❌ Cannot create/edit policies
- ❌ Cannot manage claims

#### 4. Admin
- ✅ Full access to all features
- ✅ Manage users and roles
- ✅ Configure system settings
- ✅ View audit logs
- ✅ Delete/archive records (with confirmation)

---

## 🗄️ Database Schema (Existing - Backend Ready)

### Finance Center Tables

#### `auto_loan_applications`
```sql
TABLE auto_loan_applications (
  id UUID PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id),
  booking_id UUID REFERENCES auto_bookings(id),
  customer_id UUID REFERENCES auto_customers(id),
  vehicle_id UUID REFERENCES auto_vehicles(id),
  bank_id UUID REFERENCES auto_banks(id),
  loan_amount NUMERIC(15,2),
  interest_rate NUMERIC(5,2),
  loan_term_months INT,
  monthly_payment NUMERIC(15,2),
  status TEXT, -- pending, bank_reviewing, approved, rejected, disbursed, cancelled
  submitted_date TIMESTAMPTZ,
  approved_date TIMESTAMPTZ,
  disbursed_date TIMESTAMPTZ,
  assigned_sales_id UUID REFERENCES profiles(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `auto_banks`
```sql
TABLE auto_banks (
  id UUID PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id),
  name TEXT,
  code TEXT, -- VPB, TCB, VCB, etc.
  logo_url TEXT,
  contact_name TEXT,
  contact_phone TEXT,
  contact_email TEXT,
  min_interest_rate NUMERIC(5,2),
  max_interest_rate NUMERIC(5,2),
  available_terms INT[], -- [12, 24, 36, 48, 60]
  max_ltv_ratio NUMERIC(5,2), -- 80.00 = 80%
  min_income NUMERIC(15,2),
  min_credit_score INT,
  commission_type TEXT, -- fixed or percentage
  commission_value NUMERIC(15,2),
  status TEXT, -- active, inactive
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `auto_loan_documents`
```sql
TABLE auto_loan_documents (
  id UUID PRIMARY KEY,
  loan_id UUID REFERENCES auto_loan_applications(id),
  document_type TEXT, -- cccd, household, bank_statement, employment, income_proof
  file_url TEXT,
  file_name TEXT,
  file_size_bytes BIGINT,
  uploaded_by UUID REFERENCES profiles(id),
  status TEXT, -- pending, uploaded, verified, rejected
  notes TEXT,
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Insurance Center Tables

#### `auto_insurance_policies`
```sql
TABLE auto_insurance_policies (
  id UUID PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id),
  policy_number TEXT UNIQUE,
  customer_id UUID REFERENCES auto_customers(id),
  vehicle_id UUID REFERENCES auto_vehicles(id),
  provider_id UUID REFERENCES auto_insurance_providers(id),
  type TEXT, -- tnds, physical, combo
  effective_date DATE,
  expiry_date DATE,
  premium_amount NUMERIC(15,2),
  commission_amount NUMERIC(15,2),
  coverage_details JSONB, -- { liability: {...}, physical: {...} }
  contract_file_url TEXT,
  assigned_sales_id UUID REFERENCES profiles(id),
  status TEXT, -- active, expired, cancelled, pending_renewal
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `auto_insurance_providers`
```sql
TABLE auto_insurance_providers (
  id UUID PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id),
  name TEXT, -- PVI, BIC, PTI, etc.
  code TEXT,
  logo_url TEXT,
  contact_name TEXT,
  contact_phone TEXT,
  contact_email TEXT,
  commission_rate NUMERIC(5,2), -- 10.00 = 10%
  status TEXT, -- active, inactive
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `auto_insurance_claims`
```sql
TABLE auto_insurance_claims (
  id UUID PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id),
  claim_number TEXT UNIQUE,
  policy_id UUID REFERENCES auto_insurance_policies(id),
  claim_type TEXT, -- collision, fire, theft, natural_disaster, etc.
  incident_date TIMESTAMPTZ,
  incident_location TEXT,
  incident_description TEXT,
  police_report_number TEXT,
  estimated_damage_amount NUMERIC(15,2),
  claim_amount NUMERIC(15,2),
  deductible_amount NUMERIC(15,2),
  status TEXT, -- reported, photos_uploaded, submitted_to_provider, provider_reviewing, approved, paid, rejected
  reported_date TIMESTAMPTZ,
  submitted_to_provider_date TIMESTAMPTZ,
  approved_date TIMESTAMPTZ,
  paid_date TIMESTAMPTZ,
  photos JSONB, -- [{ url, category, uploaded_at }]
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `auto_insurance_renewals`
```sql
TABLE auto_insurance_renewals (
  id UUID PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id),
  policy_id UUID REFERENCES auto_insurance_policies(id),
  renewal_date DATE,
  new_policy_id UUID REFERENCES auto_insurance_policies(id),
  status TEXT, -- pending, quoted, accepted, renewed, lost
  reminder_sent_count INT DEFAULT 0,
  last_reminder_date TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 🔌 API Endpoints (Existing - Backend Ready)

### Finance Center APIs

#### Loan Applications
- `GET /api/bella-auto/finance/loans` - List loan applications (with filters)
- `GET /api/bella-auto/finance/loans/[id]` - Get loan detail
- `POST /api/bella-auto/finance/loans` - Create new loan application
- `PUT /api/bella-auto/finance/loans/[id]` - Update loan application
- `POST /api/bella-auto/finance/loans/[id]/approve` - Approve loan
- `POST /api/bella-auto/finance/loans/[id]/reject` - Reject loan
- `POST /api/bella-auto/finance/loans/[id]/disburse` - Mark as disbursed
- `DELETE /api/bella-auto/finance/loans/[id]` - Cancel loan (soft delete)

#### Loan Documents
- `POST /api/bella-auto/finance/loans/[id]/documents` - Upload document
- `GET /api/bella-auto/finance/loans/[id]/documents` - List documents
- `DELETE /api/bella-auto/finance/loans/[id]/documents/[docId]` - Delete document

#### Banks
- `GET /api/bella-auto/finance/banks` - List partner banks
- `POST /api/bella-auto/finance/banks` - Create bank
- `PUT /api/bella-auto/finance/banks/[id]` - Update bank
- `DELETE /api/bella-auto/finance/banks/[id]` - Deactivate bank

#### Analytics
- `GET /api/bella-auto/finance/dashboard` - Finance dashboard stats
- `GET /api/bella-auto/finance/analytics` - Finance analytics reports

---

### Insurance Center APIs

#### Insurance Policies
- `GET /api/bella-auto/insurance/policies` - List policies (with filters)
- `GET /api/bella-auto/insurance/policies/[id]` - Get policy detail
- `POST /api/bella-auto/insurance/policies` - Create new policy
- `PUT /api/bella-auto/insurance/policies/[id]` - Update policy
- `POST /api/bella-auto/insurance/policies/[id]/renew` - Renew policy
- `POST /api/bella-auto/insurance/policies/[id]/cancel` - Cancel policy

#### Renewals
- `GET /api/bella-auto/insurance/renewals/alerts` - Get renewal alerts
- `POST /api/bella-auto/insurance/renewals/[id]/remind` - Send renewal reminder
- `POST /api/bella-auto/insurance/renewals/bulk-remind` - Send bulk reminders

#### Claims
- `GET /api/bella-auto/insurance/claims` - List claims
- `GET /api/bella-auto/insurance/claims/[id]` - Get claim detail
- `POST /api/bella-auto/insurance/claims` - Create new claim
- `PUT /api/bella-auto/insurance/claims/[id]` - Update claim
- `POST /api/bella-auto/insurance/claims/[id]/photos` - Upload claim photos
- `POST /api/bella-auto/insurance/claims/[id]/submit` - Submit to provider

#### Providers
- `GET /api/bella-auto/insurance/providers` - List providers
- `POST /api/bella-auto/insurance/providers` - Create provider
- `PUT /api/bella-auto/insurance/providers/[id]` - Update provider

#### Analytics
- `GET /api/bella-auto/insurance/dashboard` - Insurance dashboard stats
- `GET /api/bella-auto/insurance/analytics` - Insurance analytics reports

---
