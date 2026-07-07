# Payroll Builder - Information Architecture

**Version:** v2.0  
**Date:** 2026-06-22  
**Status:** Draft for review  
**Change:** Pivot from Engine-thinking to Business-workflow-thinking

---

## Core Principle

**IA phải theo nghiệp vụ, không theo kiến trúc hệ thống.**

❌ **Sai:** Master Data → Calculations → Policy → Preview (góc nhìn developer)  
✅ **Đúng:** Cấu hình → Chạy lương → Kiểm tra → Duyệt → Khóa kỳ (góc nhìn HR)

---

## HR Mental Model: Payroll Cycle

HR nghĩ về lương theo **chu kỳ hàng tháng:**

```
[Tháng mới bắt đầu]
    ↓
Cấu hình (nếu có thay đổi chính sách)
    ↓
Chạy bảng lương (Generate Payroll)
    ↓
Kiểm tra (Review & Fix issues)
    ↓
Duyệt (Approval workflow)
    ↓
Khóa kỳ lương (Lock & Export)
    ↓
[Chuyển sang tháng sau]
```

**Không phải:** "Tôi cần cấu hình engine trước khi dùng"  
**Mà là:** "Tôi chạy lương tháng 6 giống tháng 5, chỉ sửa chút nếu có thay đổi"

---

## 6 Core Modules (Business Workflow)

### 1. Payroll Configuration (Cấu hình lương)

**HR's mental model:** "Nơi tôi cấu hình cách tính lương (ít thay đổi, setup một lần)"

**Sub-modules:**

#### 1.1. Positions (Chức danh)
```
Junior      → Hệ số: 1.0
Senior      → Hệ số: 1.2
Lead        → Hệ số: 1.5
```

#### 1.2. Commission (Hoa hồng)
```
Dịch vụ
├── Massage        → 10%
├── Facial         → 12%
└── Laser          → 15%

Sản phẩm
├── Skincare       → 8%
└── Makeup         → 10%
```

#### 1.3. KPI Bonus (Thưởng KPI)
```
Target: 30 ca/tháng
Thưởng: 1,000,000đ

[Công thức]
IF số ca >= 30 THEN 1M ELSE 0
```

#### 1.4. Rating Bonus (Thưởng đánh giá)
```
★★★★★   → 50,000đ/ca
★★★★☆   → 30,000đ/ca
★★★★    → 10,000đ/ca
```

#### 1.5. Seniority Benefit (Phụ cấp thâm niên)
```
0-1 năm     → 0%
1-3 năm     → 5%
3-5 năm     → 10%
5+ năm      → 15%
```

#### 1.6. Attendance (Chấm công)
```
Phạt đi muộn:   50,000đ/ngày
Phạt vắng:      200,000đ/ngày
Ngày công chuẩn: 26 ngày
```

#### 1.7. Allowances (Phụ cấp)
```
Ăn trưa:    30,000đ/ngày
Xăng xe:    500,000đ/tháng
Điện thoại: 200,000đ/tháng
```

#### 1.8. Deductions (Khấu trừ)
```
Tạm ứng
Bảo hiểm
Thuế TNCN
```

#### 1.9. Approval Rules (Quy tắc duyệt)
```
Lương > 15M         → Cần Manager duyệt
Tạm ứng > Lương    → Từ chối
Vắng > 5 ngày      → Cần giải trình
```

**User questions answered:**
- "Muốn đổi hệ số Senior từ 1.2 lên 1.3?" → Configuration / Positions
- "Muốn thêm loại thưởng mới?" → Configuration / (chọn loại phù hợp)
- "Muốn sửa công thức KPI?" → Configuration / KPI Bonus / [Công thức]

**Key characteristics:**
- Grouped by business concept (Position, Commission, KPI...), NOT by technical type (Master Data vs Calculation)
- Formula is nested inside business concept (KPI → Formula), not a separate top-level menu
- HR language only (no "DSL", "Expression", "Policy DSL")

---

### 2. Payroll Runs (Bảng lương các tháng)

**HR's mental model:** "Danh sách các kỳ lương đã chạy, đang chạy, và sắp chạy"

**Content:**
```
Tháng 6/2026        Status: Draft          [Generate] [Recalculate]
Tháng 5/2026        Status: Locked         [View] [Export]
Tháng 4/2026        Status: Locked         [View] [Export]
Tháng 3/2026        Status: Locked         [View] [Export]
```

**Actions:**
- **Generate Payroll**: Tạo bảng lương mới cho tháng hiện tại
- **Recalculate**: Tính lại (nếu có thay đổi attendance, commission, etc.)
- **Lock Payroll**: Khóa kỳ lương (không cho sửa nữa)
- **Export**: Xuất Excel, xuất kế toán, xuất ngân hàng

**User questions answered:**
- "Bảng lương tháng 6 đang ở đâu?" → Payroll Runs / Tháng 6/2026
- "Tôi muốn chạy lương tháng mới?" → Payroll Runs / [Generate Payroll]
- "Tôi muốn khóa kỳ lương để không ai sửa?" → Payroll Runs / [Lock Payroll]

**Key characteristics:**
- Time-based navigation (tháng/năm), not concept-based
- Status-driven workflow (Draft → Review → Approved → Locked)
- Each run is isolated (changing configuration doesn't affect locked months)

---

### 3. Payroll Review (Kiểm tra bảng lương)

**HR's mental model:** "Xem danh sách nhân viên và lương của họ, tìm những case bất thường"

**Content:**
```
Tháng 6/2026 - Draft                    [Filters: All | Changed | Need Approval | Warning]

┌──────────────────┬────────────┬─────────┬────────┐
│ Nhân viên        │ Lương      │ So T5   │ Status │
├──────────────────┼────────────┼─────────┼────────┤
│ Nguyễn Văn A     │ 8,200,000  │ ▼ -10%  │ ⚠️ Low │
│ Lê Thị B         │ 12,300,000 │ ▲ +5%   │ ✓ OK   │
│ Trần Văn C       │ 18,500,000 │ ▲ +15%  │ 🔒 Approval│
│ Phạm Thị D       │ 6,800,000  │ ─ 0%    │ ✓ OK   │
└──────────────────┴────────────┴─────────┴────────┘
```

**Filters:**
- **All**: Tất cả nhân viên
- **Changed**: Chỉ hiện nhân viên có thay đổi > 10%
- **Need Approval**: Chỉ hiện nhân viên cần duyệt (>15M, advance>salary, etc.)
- **Warning**: Chỉ hiện nhân viên có cảnh báo (lương giảm nhiều, vắng nhiều, etc.)

**Actions:**
- Click vào nhân viên → Xem chi tiết (Employee Detail)
- Bulk approve (chọn nhiều nhân viên, duyệt hàng loạt)
- Export filtered list

**User questions answered:**
- "Ai có lương bất thường tháng này?" → Payroll Review / [Filter: Changed or Warning]
- "Ai cần tôi duyệt?" → Payroll Review / [Filter: Need Approval]
- "So sánh lương tháng này với tháng trước?" → Payroll Review / Column "So T5"

**Key characteristics:**
- Table view (easy scanning)
- Color-coded status (green = OK, yellow = warning, red = need approval)
- Comparison to previous month (% change)
- Quick filters (not complex search)

---

### 4. Employee Detail (Chi tiết lương nhân viên)

**HR's mental model:** "Hiểu tại sao nhân viên này nhận số tiền Y"

**Content:**
```
Nguyễn Văn A - Tháng 6/2026

┌─────────────────────────────────────────┐
│ LƯƠNG CƠ BẢN                            │
│ 6,000,000 × (24/26 ngày) = 5,538,462   │ [Click to expand formula]
└─────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────┐
│ HOA HỒNG DỊCH VỤ                        │
│ 15 ca × 150,000đ = 2,250,000            │ [Click to see sessions]
└─────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────┐
│ THƯỞNG VỊ TRÍ                           │
│ 2,250,000 × 1.2 (Senior) = 2,700,000   │
│ → Thưởng = 2,700,000 - 2,250,000        │
│ = 450,000                                │ [Click to see position config]
└─────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────┐
│ THƯỞNG ĐÁNH GIÁ                         │
│ 15.5 ca quy đổi × 30,000đ = 465,000    │
│ (Rating: 4.7 sao → 30k/ca)              │ [Click to see rating history]
└─────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────┐
│ PHẠT CHẤM CÔNG                          │
│ 1 ngày đi muộn × 50,000đ = -50,000     │ [Click to see attendance log]
└─────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────┐
│ TỔNG LƯƠNG                              │
│ 5,538,462 + 2,250,000 + 450,000         │
│ + 465,000 - 50,000 = 8,653,462         │
│ → Làm tròn: 8,650,000                   │
└─────────────────────────────────────────┘

[Compare to last month] [What-If Simulator] [Export PDF]
```

**Expandable sections:**
- Click "Lương cơ bản" → See formula `(contract_salary ÷ 26) × working_days`
- Click "Hoa hồng dịch vụ" → See list of 15 sessions with dates, customers, amounts
- Click "Thưởng vị trí" → See position config (Junior: 1.0, Senior: 1.2, Lead: 1.5)
- Click "Phạt chấm công" → See attendance log with late/absent days

**User questions answered:**
- "Tại sao Nguyễn Văn A nhận 8.65M?" → Employee Detail (see breakdown)
- "Số ca 15.5 tính thế nào?" → Employee Detail / Hoa hồng / [Click to see sessions]
- "Hệ số 1.2 từ đâu ra?" → Employee Detail / Thưởng vị trí / [Click to see position config]

**Key characteristics:**
- Waterfall layout (từ trên xuống, theo flow tính lương)
- Inline explanations (mỗi dòng giải thích số từ đâu)
- Clickable drill-down (click để xem chi tiết hơn)
- Historical comparison (so với tháng trước)

---

### 5. Approval Queue (Hàng chờ duyệt)

**HR's mental model:** "Danh sách các case cần tôi duyệt hoặc từ chối"

**Content:**
```
Tháng 6/2026 - Pending Approval (3 cases)

┌────────────────┬────────────┬──────────────────┬────────┐
│ Nhân viên      │ Lương      │ Lý do            │ Action │
├────────────────┼────────────┼──────────────────┼────────┤
│ Trần Văn C     │ 18,500,000 │ Lương > 15M      │ [Approve] [Reject] │
│ Hoàng Thị E    │ 9,200,000  │ Tạm ứng 10M      │ [Approve] [Reject] │
│ Võ Văn F       │ 7,100,000  │ Vắng 6 ngày      │ [Approve] [Reject] │
└────────────────┴────────────┴──────────────────┴────────┘
```

**Actions:**
- **Approve**: Duyệt (lương được lock, nhân viên nhận tiền)
- **Reject**: Từ chối (quay về Draft, HR phải sửa)
- **Request Info**: Yêu cầu giải trình thêm

**Approval rules (configured in Payroll Configuration):**
- Lương > 15M → Manager approval
- Tạm ứng > Lương → Manager approval
- Vắng > 5 ngày → Manager approval + written explanation

**User questions answered:**
- "Ai cần tôi duyệt lương?" → Approval Queue
- "Tại sao Trần Văn C cần duyệt?" → Approval Queue / Column "Lý do"
- "Duyệt hàng loạt cho team?" → Approval Queue / [Bulk approve]

**Key characteristics:**
- Task-oriented (focus on action, not exploration)
- Rule-driven (mỗi case có lý do rõ ràng)
- Audit trail (log ai duyệt, khi nào, lý do gì)

---

### 6. Reports & Export (Báo cáo và xuất file)

**HR's mental model:** "Xuất dữ liệu để gửi kế toán, ngân hàng, thuế"

**Content:**
```
Tháng 6/2026 - Locked

[Export Options]
├── Excel - Payroll Summary
├── Excel - Detailed Breakdown
├── Accounting System (JSON)
├── Bank Transfer File (txt)
└── Tax Report (TNCN)

[Scheduled Reports]
├── Monthly Payroll Cost (sent to CFO)
├── Commission Report (sent to Sales Manager)
└── Attendance Report (sent to HR Manager)
```

**Export formats:**
- **Excel**: HR-friendly, human-readable
- **JSON**: For accounting system integration
- **Bank file**: Standard format for bank transfer (VCB, ACB, etc.)
- **Tax report**: Submission to tax authority

**User questions answered:**
- "Làm sao xuất file để chuyển lương qua ngân hàng?" → Reports / Bank Transfer File
- "Làm sao gửi báo cáo cho CFO?" → Reports / Scheduled Reports
- "File nào để import vào phần mềm kế toán?" → Reports / Accounting System (JSON)

**Key characteristics:**
- Output-focused (HR knows what they need, just need to find the button)
- Pre-configured templates (no complex report builder)
- Scheduled automation (gửi email tự động, không cần thao tác thủ công)

---

## Navigation Structure (Business Workflow)

```
Payroll
│
├── 📋 Payroll Runs (Danh sách các kỳ lương)
│   ├── Tháng 6/2026 (Draft)
│   ├── Tháng 5/2026 (Locked)
│   └── Tháng 4/2026 (Locked)
│
├── ⚙️ Configuration (Cấu hình - setup one time)
│   ├── Positions (Chức danh)
│   ├── Commission (Hoa hồng)
│   ├── KPI Bonus (Thưởng KPI)
│   ├── Rating Bonus (Thưởng đánh giá)
│   ├── Seniority Benefit (Phụ cấp thâm niên)
│   ├── Attendance (Chấm công)
│   ├── Allowances (Phụ cấp)
│   ├── Deductions (Khấu trừ)
│   └── Approval Rules (Quy tắc duyệt)
│
├── 🔍 Review (Kiểm tra bảng lương hiện tại)
│   ├── All Employees
│   ├── Changed (>10%)
│   ├── Need Approval
│   └── Warnings
│
├── 👤 Employee Detail (Chi tiết 1 nhân viên)
│   └── [Accessed from Review]
│
├── ✅ Approval Queue (Hàng chờ duyệt)
│   └── Pending cases
│
└── 📊 Reports & Export
    ├── Excel
    ├── Accounting System
    ├── Bank Transfer
    └── Tax Report
```

**Navigation order matches workflow:**
1. HR opens **Payroll Runs** (xem kỳ lương hiện tại)
2. Click **Generate Payroll** (tạo bảng lương tháng mới)
3. Go to **Review** (kiểm tra danh sách nhân viên)
4. Click employee → **Employee Detail** (xem chi tiết)
5. Go to **Approval Queue** (duyệt các case cần approval)
6. Go to **Reports** (xuất file)
7. Back to **Payroll Runs** → **Lock Payroll**

**Configuration** nằm riêng (ít dùng, chỉ setup lúc đầu hoặc khi đổi chính sách)

---

## HR User Journeys (Business Workflow)

### Journey 1: "Chạy lương tháng mới (Monthly payroll run)"

```
1. Navigate: Payroll → Payroll Runs
2. See: Tháng 6/2026 - Status: Not Started
3. Click: [Generate Payroll]
   → System auto-calculates using Configuration
   → Shows progress: "Calculating 45 employees..."
4. See: Status changed to "Draft"
5. Click: [Review] button
   → Navigate to Payroll Review screen
6. Scan list: Look for anomalies (Changed >10%, Warnings, Need Approval)
7. Decision:
   - If OK → Go to Step 8
   - If issues → Fix attendance/commissions → Click [Recalculate] → Back to Step 6
8. Navigate: Approval Queue
9. Review cases: Approve/Reject cases needing approval
10. Navigate: Payroll Runs → [Lock Payroll]
    → Status changed to "Locked"
11. Navigate: Reports → Export Bank Transfer File
12. Done: Send file to bank
```

**Key screens:**
- Payroll Runs (starting point)
- Review (quality check)
- Approval Queue (decision point)
- Reports (output)

**Time:** 1-2 hours per month (for 45 employees)

---

### Journey 2: "Hiểu tại sao lương nhân viên thay đổi"

```
1. Navigate: Payroll → Review
2. Filter: [Changed] (only show employees with >10% change)
3. See: Nguyễn Văn A - 8.2M (▼ -10% vs last month)
4. Click: Nguyễn Văn A
   → Navigate to Employee Detail
5. See breakdown:
   - Base: 5.5M (last month: 6M) → Click to expand
     → "24/26 days (vs 26/26 last month)"
     → Reason: 2 absent days
   - Commission: 2.25M (same as last month)
   - Position Bonus: 450k (same)
   - Penalty: -50k (NEW this month)
     → Click to expand
     → "1 late day × 50k"
6. Compare: Click [Compare to last month]
   → Side-by-side view:
     Last month: 6M + 2.25M + 450k = 8.7M
     This month: 5.5M + 2.25M + 450k - 50k = 8.2M
     Difference: -500k (absent) - 50k (late) = -550k
7. Understand: "Ah, vắng 2 ngày + đi muộn 1 ngày nên giảm 550k"
8. Action:
   - If correct → [Approve]
   - If incorrect → Go fix attendance log → [Recalculate]
```

**Key screens:**
- Review (filter changed employees)
- Employee Detail (drill-down)
- Comparison modal (side-by-side)

**Time:** 2-3 minutes per employee

---

### Journey 3: "Đổi chính sách: Tăng hệ số Senior lên 1.3"

```
1. Navigate: Payroll → Configuration → Positions
2. See table:
   Junior:  1.0
   Senior:  1.2 ← Want to change
   Lead:    1.5
3. Click: Edit button next to "Senior"
4. Change: 1.2 → 1.3
5. See warning: "This will affect 12 employees. Preview impact?"
6. Click: [Preview Impact]
   → Modal shows:
     Before: Position Bonus total = 5.4M (12 employees)
     After:  Position Bonus total = 6.3M
     Increase: +900k/month (+10.8M/year)
7. Decision:
   - If OK → [Save]
   - If too expensive → [Cancel]
8. If saved:
   → System asks: "Apply to current month (June) or next month (July)?"
9. Choose: "Next month (July)"
10. Done: Configuration saved, will take effect from July payroll
```

**Key screens:**
- Configuration / Positions (edit interface)
- Preview Impact Modal (before/after)
- Effective Date Selector (when to apply)

**Time:** 5 minutes

---

### Journey 4: "Thêm loại thưởng mới: Project Completion Bonus"

```
1. Navigate: Payroll → Configuration
2. Click: [Add New Bonus Type]
3. Fill form:
   - Name: "Project Completion Bonus"
   - Type: Bonus (earning)
   - Calculation method:
     [ ] Fixed amount
     [ ] Percentage
     [x] Lookup table
4. Define lookup table:
   Project Size  → Bonus Amount
   Small         → 500,000
   Medium        → 1,000,000
   Large         → 2,000,000
5. Define data source:
   - Table: project_completions
   - Filter: status = 'completed' AND month = current_month
   - Group by: employee_id
   - Lookup key: project_size
6. Preview: Click [Test with sample data]
   → Shows: "3 employees will receive this bonus in current month:
     - Employee A: 1 small project → 500k
     - Employee B: 2 medium projects → 2M
     - Employee C: 1 large project → 2M"
7. Activate: [Save and Activate]
8. Verify: Go to Review → See new column "Project Bonus"
```

**Key screens:**
- Configuration / Add New Bonus
- Lookup Table Editor
- Data Source Selector
- Test Preview

**Time:** 10-15 minutes

---

## Terminology Check: No Technical Leakage

**Rule:** IA không được chứa technical terms. Chỉ dùng business language.

### ❌ Terms to AVOID in IA:
- DSL
- Engine
- Expression
- AST
- Formula Language
- Knowledge
- RuleReasoner
- Policy DSL
- Calculation Engine
- Dependency Graph (technical)

### ✅ Terms to USE in IA:
- Lương cơ bản (Base salary)
- Hoa hồng (Commission)
- Thưởng KPI (KPI bonus)
- Thưởng đánh giá (Rating bonus)
- Phụ cấp thâm niên (Seniority benefit)
- Phạt đi muộn (Late penalty)
- Chấm công (Attendance)
- Khấu trừ (Deduction)
- Duyệt lương (Approve payroll)
- Chạy bảng lương (Generate payroll / Payroll run)
- Khóa kỳ lương (Lock payroll period)
- Xuất Excel (Export to Excel)
- Công thức tính (Calculation method / Formula) ← OK khi nested inside business concept

**Test:** Show IA to HR. If they ask "DSL là gì?", "Engine ở đâu?" → IA failed.

---

## Key IA Decisions (v2.0)

### 1. Workflow-first, not module-first
**v1.0 mistake:** Master Data → Calculations → Policy → Preview (developer POV)  
**v2.0 correct:** Payroll Runs → Review → Approval → Reports (HR workflow)

### 2. Configuration is secondary, not primary
**Rationale:** HR runs payroll monthly (frequent), changes configuration quarterly (rare).  
**Implication:** Payroll Runs is top-level, Configuration is nested.

### 3. Formula is nested inside business concept
**v1.0 mistake:** "Calculations" as separate top-level menu  
**v2.0 correct:** Configuration / KPI Bonus / [Formula] (nested 2 levels deep)

**Rationale:** HR doesn't think "I need to edit formulas". They think "I need to change KPI bonus rules".

### 4. Time-based navigation for operational screens
**Payroll Runs:** Tháng 6/2026, Tháng 5/2026, ... (time-based)  
**Configuration:** Positions, Commission, KPI... (concept-based)

**Rationale:** Operations follow time (monthly cycles), Configuration is timeless (setup once).

### 5. Explainability through drill-down, not documentation
**v1.0 approach:** Write help docs explaining formulas  
**v2.0 approach:** Click any number → See how it's calculated

**Example:**
```
Position Bonus: 450,000
[Click to expand]
  → service_commission: 2,250,000
  → multiplier: 1.2 (Senior)
  → formula: 2,250,000 × (1.2 - 1.0) = 450,000
```

HR learns by exploring, not by reading manuals.

---

## Module Interaction Flow (Business Workflow)

```
[Month starts]
    ↓
Configuration (if policy changes needed)
    ↓
Payroll Runs: Generate Payroll
    ↓
System auto-calculates using Configuration
    ↓
Review: Check for anomalies
    ↓
Employee Detail: Drill down into issues
    ↓
Fix data (attendance, commissions) → Recalculate
    ↓
Approval Queue: Approve/Reject edge cases
    ↓
Payroll Runs: Lock Payroll
    ↓
Reports: Export to bank/accounting
    ↓
[Month ends, next cycle begins]
```

**Key insight:** HR follows a **monthly loop**, not a feature-based workflow.

---

## Success Metrics (Business Language Test)

After IA is implemented, HR should be able to answer **instantly and confidently:**

✅ "Muốn chạy lương tháng mới?" → **Payroll Runs** / [Generate Payroll]  
✅ "Muốn xem lương tháng này?" → **Review**  
✅ "Muốn hiểu tại sao nhân viên X nhận số tiền Y?" → **Employee Detail** (click from Review)  
✅ "Muốn đổi hệ số Senior?" → **Configuration** / Positions  
✅ "Muốn sửa công thức KPI?" → **Configuration** / KPI Bonus / [Formula]  
✅ "Ai cần tôi duyệt?" → **Approval Queue**  
✅ "Làm sao xuất file ngân hàng?" → **Reports** / Bank Transfer File  
✅ "Muốn khóa kỳ lương để không ai sửa?" → **Payroll Runs** / [Lock Payroll]  

**If HR hesitates, asks "ở đâu?", or gets confused → IA failed.**

**Additional test:** Show IA diagram to non-technical HR staff. They should understand navigation without explanation.

---

## Open Questions (For User Testing Phase)

1. **Effective date for configuration changes:**
   - When HR changes "Senior multiplier 1.2 → 1.3", apply when?
     - [ ] Immediately (affect current month)
     - [ ] Next month only
     - [ ] HR chooses effective date

2. **Recalculation scope:**
   - When HR fixes 1 employee's attendance, recalculate:
     - [ ] Only that employee
     - [ ] All employees (safe but slow)
     - [ ] HR chooses scope

3. **Lock granularity:**
   - When "Lock Payroll" is clicked:
     - [ ] Lock everything (no edits at all)
     - [ ] Lock calculations, allow manual adjustments
     - [ ] Lock individual employees (granular)

4. **Approval bypass:**
   - If CFO is on leave, can Manager approve >20M salary?
     - [ ] No (strict)
     - [ ] Yes with justification
     - [ ] Escalate to next level (COO)

5. **Historical changes:**
   - HR changes "Commission 10% → 12%" on June 15. Does it affect:
     - [ ] All of June (retroactive)
     - [ ] June 15-30 only (pro-rata)
     - [ ] July onwards only

**Resolve through user testing, not assumptions.**

---

## Next Steps

### Phase 1: IA Validation ✅
- [x] Define 6 core modules
- [x] Map 4 user journeys
- [x] Check terminology (no technical leakage)
- [ ] **Review with stakeholders** (HR, Finance, Product Owner)

### Phase 2: User Flow Design ⏳
- [ ] Detailed screen-by-screen flows for each journey
- [ ] State transitions (Draft → Review → Approved → Locked)
- [ ] Error states ("Recalculation failed", "Approval rejected")
- [ ] Edge cases (Employee resigned mid-month, Negative salary, etc.)

### Phase 3: Screen Inventory ⏳
- [ ] List all screens needed (20-30 screens estimated)
- [ ] Define screen hierarchy (parent-child relationships)
- [ ] Identify reusable components (Employee card, Breakdown table, etc.)

### Phase 4: Wireframing ⏳
- [ ] Low-fidelity wireframes (layout, hierarchy)
- [ ] No colors, no detailed styling
- [ ] Focus: Information hierarchy, CTAs, navigation

### Phase 5: Prototype ⏳
- [ ] Click-through prototype (Figma, Miro, or HTML)
- [ ] Test with 2-3 HR users
- [ ] Collect feedback, iterate

### Phase 6: High-Fidelity UI Design ⏳
- [ ] Visual design (colors, typography, spacing)
- [ ] Component library (buttons, inputs, cards)
- [ ] Responsive layout (desktop, tablet)

### Phase 7: Implementation ⏳
- [ ] Start with Payroll Runs (core workflow)
- [ ] Then Review + Employee Detail (most used)
- [ ] Then Configuration (setup)
- [ ] Then Approval + Reports (polish)

**Do NOT skip to Phase 7 before Phase 1-5 are validated with real users.**

---

## Why This IA v2.0 is Better Than v1.0

| Aspect | v1.0 (System-thinking) | v2.0 (Business-thinking) |
|--------|------------------------|--------------------------|
| **Top-level menu** | Master Data, Calculations, Policy, Preview | Payroll Runs, Configuration, Review, Approval, Reports |
| **Mental model** | "I configure the system" | "I run payroll monthly" |
| **Formula location** | Calculations (top-level) | Configuration / KPI / [Formula] (nested) |
| **Navigation** | Feature-based | Workflow-based |
| **Terminology** | Master Data, Calculations, Policy DSL | Chạy lương, Kiểm tra, Duyệt, Xuất file |
| **Primary use case** | System setup | Monthly payroll operations |
| **Time-based navigation** | No | Yes (Tháng 6/2026, Tháng 5/2026) |
| **Technical leakage** | Yes (Master Data, Calculations, Engine) | No (only business terms) |
| **HR understanding** | Need training | Intuitive |

**Result:** v2.0 reduces training time from 2 hours → 15 minutes.

---

## Appendix: How IA v2 Informs DSL Design

**Key insight:** When IA is correct, DSL requirements emerge naturally from UI constraints.

### Example 1: Formula must be human-readable
**IA requirement:** HR clicks "KPI Bonus" → sees formula → understands it  
**DSL implication:** Formula syntax must be close to natural language

❌ Bad DSL: `(sessions >= target) ? amount : 0`  
✅ Good DSL: `IF sessions >= target THEN amount ELSE 0`

### Example 2: Formula must support drill-down
**IA requirement:** HR clicks "Position Bonus: 450k" → sees breakdown  
**DSL implication:** DSL must track intermediate values

❌ Bad: `service_commission * multiplier` (result only: 450k)  
✅ Good: `service_commission (2.25M) × multiplier (1.2) → (2.7M - 2.25M) = 450k`

### Example 3: Formula must be editable visually
**IA requirement:** HR edits formula without writing code  
**DSL implication:** DSL must be parseable into UI components

❌ Bad: Arbitrary JavaScript expressions  
✅ Good: Structured formula with dropdowns (operand A, operator, operand B)

### Example 4: Configuration must map to formula inputs
**IA requirement:** HR changes "Senior: 1.2 → 1.3" → formula recalculates  
**DSL implication:** Formula variables must reference configuration keys

❌ Bad: Hardcoded `multiplier = 1.2` in formula  
✅ Good: `multiplier = lookup(position, position_multipliers)`

**If we designed DSL before IA, we might build:**
- Complex nested expressions HR can't understand
- Non-visual formula editor (text-based code editor)
- Operators that Configuration UI can't represent

**IA-first approach ensures:** DSL serves the product, UI is buildable, HR can use it.

