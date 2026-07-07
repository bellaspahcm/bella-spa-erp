# Employee Detail Screen - Specification

**Version:** v1.0  
**Date:** 2026-06-22  
**Purpose:** Killer feature - Giải thích "Tại sao nhân viên A nhận 8.650.000đ?"

---

## User Story

**As a:** HR Staff  
**I want to:** Xem chi tiết lương của 1 nhân viên  
**So that:** Tôi có thể giải thích cho nhân viên/quản lý tại sao họ nhận số tiền đó

**Acceptance Criteria:**
1. ✅ HR thấy được breakdown đầy đủ (base, commission, bonus, penalty)
2. ✅ Mỗi dòng có giải thích (VD: "24/26 ngày", "15.5 ca", "Senior 1.2")
3. ✅ Click vào bất kỳ số nào → Xem công thức chi tiết
4. ✅ So sánh với tháng trước → Hiểu tại sao thay đổi
5. ✅ Toàn bộ màn hình load trong <2 giây

---

## Screen Layout (Wireframe Description)

```
┌────────────────────────────────────────────────────────────────┐
│ ← Quay lại          NGUYỄN VĂN A - Tháng 6/2026               │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  👤 Nguyễn Văn A                    📊 So với tháng trước      │
│  Senior KTV                             [So sánh] [Xuất PDF]   │
│  Ngày vào: 15/01/2024 (2.5 năm)                               │
│                                                                 │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  💰 TỔNG LƯƠNG                                   8,650,000đ    │
│     Tháng 5/2026: 9,100,000đ (▼ -5%)                          │
│                                                                 │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  📋 CHI TIẾT LƯƠNG                                             │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ 🟢 LƯƠNG CƠ BẢN                          5,538,462đ      │ │
│  │                                                           │ │
│  │ 6,000,000đ × (24/26 ngày) = 5,538,462đ                   │ │
│  │ Vắng: 2 ngày (10/06, 15/06)                              │ │
│  │                                          [Xem chấm công]  │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ 🟢 HOA HỒNG DỊCH VỤ                      2,250,000đ      │ │
│  │                                                           │ │
│  │ 15 ca hoàn thành × 150,000đ/ca = 2,250,000đ             │ │
│  │                                                           │ │
│  │ Breakdown:                                                │ │
│  │ - Combo Mẹ & Bé Tiết Kiệm:    8 ca  × 1.0 = 8.0 ca      │ │
│  │ - Combo Mẹ & Bé Hạnh Phúc:    3 ca  × 1.5 = 4.5 ca      │ │
│  │ - Combo Mẹ & Bé VIP:          1 ca  × 2.0 = 2.0 ca      │ │
│  │ - Dịch vụ lẻ:                 0.5 ca × 1.0 = 0.5 ca      │ │
│  │ ───────────────────────────────────────────────          │ │
│  │ Tổng quy đổi:                              15.0 ca       │ │
│  │                                          [Xem 12 ca]      │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ 🟢 THƯỞNG VỊ TRÍ                           450,000đ      │ │
│  │                                                           │ │
│  │ 2,250,000đ × (1.2 - 1.0) = 450,000đ                     │ │
│  │ Hệ số Senior: 1.2                                        │ │
│  │                                   [Xem cấu hình chức danh]│ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ 🟢 THƯỞNG ĐÁNH GIÁ                         465,000đ      │ │
│  │                                                           │ │
│  │ 15.5 ca quy đổi × 30,000đ/ca = 465,000đ                 │ │
│  │ Rating trung bình: ⭐⭐⭐⭐☆ (4.7 sao → 30k/ca)            │ │
│  │                                      [Xem đánh giá chi tiết]│ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ 🔴 PHẠT CHẤM CÔNG                           -50,000đ     │ │
│  │                                                           │ │
│  │ 1 ngày đi muộn × 50,000đ = -50,000đ                     │ │
│  │ Ngày: 12/06/2026 (muộn 15 phút)                         │ │
│  │                                          [Xem chấm công]  │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ 🔴 TẠM ỨNG                                  -500,000đ     │ │
│  │                                                           │ │
│  │ Ngày 15/06/2026: 500,000đ                               │ │
│  │ Lý do: Chi phí cá nhân                                   │ │
│  │                                        [Xem lịch sử tạm ứng]│ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                 │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  📊 TỔNG KẾT                                                   │
│                                                                 │
│  Tổng thu nhập:        8,703,462đ                             │
│  Tổng khấu trừ:          -53,462đ (làm tròn + advance)        │
│  ────────────────────────────────                             │
│  TỔNG LƯƠNG:           8,650,000đ                             │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

---

## Key Design Decisions

### 1. Visual Hierarchy: Waterfall Layout
**Rationale:** Lương tính từ trên xuống (base → commission → bonus → penalty → total). Layout phải match mental model.

**Alternative considered:** Grid layout (2 columns) - Rejected vì khó thấy flow tính toán.

---

### 2. Inline Explanations
**Rationale:** Mỗi số đều có giải thích ngay bên cạnh. HR không cần click để hiểu.

**Example:**
```
✅ Good: "6,000,000đ × (24/26 ngày) = 5,538,462đ"
❌ Bad:  "5,538,462đ" (không giải thích)
```

---

### 3. Expandable Drill-down
**Rationale:** Chi tiết chỉ hiện khi cần (avoid information overload).

**Interaction:**
- Default: Collapsed (chỉ thấy số tiền + giải thích 1 dòng)
- Click card → Expand → Thấy công thức + breakdown chi tiết
- Click "[Xem 12 ca]" → Modal với danh sách sessions đầy đủ

---

### 4. Color Coding
**Rationale:** Visual cues giúp scan nhanh.

```
🟢 Green: Earnings (base, commission, bonus)
🔴 Red: Deductions (penalty, advance, tax, insurance)
🟡 Yellow: Warnings (unusual values, missing data)
```

---

### 5. Comparison Always Visible
**Rationale:** "So với tháng trước" là câu hỏi #2 sau "Tại sao số này?"

**Display:**
```
💰 TỔNG LƯƠNG                    8,650,000đ
   Tháng 5/2026: 9,100,000đ (▼ -5%)
```

Click [So sánh] → Full side-by-side modal.

---

## Data Requirements

### API Endpoint
```typescript
GET /api/payroll/employees/{employeeId}/detail?month=2026-06

Response: {
  employee: {
    id: string;
    name: string;
    position: string;
    hireDate: string;
    yearsOfService: number;
  };
  month: string; // "2026-06"
  salary: {
    total: number;
    totalLastMonth: number;
    changePercent: number;
    items: PayrollItem[];
  };
  breakdown: {
    baseSalary: {
      amount: number;
      formula: string;
      contractSalary: number;
      workingDays: number;
      standardDays: number;
      absentDates: string[];
    };
    serviceCommission: {
      amount: number;
      sessions: number;
      ratePerSession: number;
      sessionBreakdown: {
        packageName: string;
        count: number;
        multiplier: number;
        weighted: number;
      }[];
    };
    positionBonus: {
      amount: number;
      baseCommission: number;
      multiplier: number;
      positionTier: string;
    };
    ratingBonus: {
      amount: number;
      weightedSessions: number;
      bonusPerSession: number;
      averageRating: number;
    };
    attendancePenalty: {
      amount: number;
      lateDays: number;
      lateAmount: number;
      lateDates: { date: string; minutes: number }[];
    };
    advances: {
      amount: number;
      records: { date: string; amount: number; reason: string }[];
    };
  };
}
```

---

## Interaction Spec

### 1. Load Screen
```
User: Click "Nguyễn Văn A" from Review screen
  ↓
System: Navigate to /payroll/employees/{id}/detail?month=2026-06
  ↓
System: Fetch data from API
  ↓
System: Render breakdown (all cards collapsed by default)
  ↓
Duration: <2 seconds
```

---

### 2. Drill Down - Session Detail
```
User: Click "[Xem 12 ca]" trong HOA HỒNG DỊCH VỤ card
  ↓
System: Show modal with session list

Modal content:
┌──────────────────────────────────────────────────────┐
│ DANH SÁCH CA HOÀN THÀNH - Tháng 6/2026             │
├──────────────────────────────────────────────────────┤
│                                                      │
│ 01/06 - Nguyễn Thị B - Combo Tiết Kiệm - 1.0 ca   │
│ 03/06 - Trần Văn C - Combo Hạnh Phúc - 1.5 ca     │
│ 05/06 - Lê Thị D - Combo VIP - 2.0 ca             │
│ ...                                                 │
│                                                      │
│ Tổng: 12 ca (15.0 ca quy đổi)                      │
│                                   [Đóng] [Xuất CSV] │
└──────────────────────────────────────────────────────┘
```

---

### 3. Comparison Modal
```
User: Click [So sánh] button
  ↓
System: Fetch last month data (if not cached)
  ↓
System: Show side-by-side comparison modal

Modal content:
┌────────────────────────────────────────────────────────────┐
│ SO SÁNH LƯƠNG - Nguyễn Văn A                              │
├────────────────────────────────────────────────────────────┤
│                                                            │
│ Tháng 6/2026        |  Tháng 5/2026        |  Chênh lệch  │
│─────────────────────┼──────────────────────┼──────────────│
│ Lương cơ bản        │                      │              │
│ 5,538,462đ          │  6,000,000đ          │  -461,538đ   │
│ (24/26 ngày)        │  (26/26 ngày)        │  -2 ngày ❌  │
│                     │                      │              │
│ Hoa hồng            │                      │              │
│ 2,250,000đ          │  2,100,000đ          │  +150,000đ   │
│ (15 ca)             │  (14 ca)             │  +1 ca ✅    │
│                     │                      │              │
│ ...                 │                      │              │
│                     │                      │              │
│─────────────────────┼──────────────────────┼──────────────│
│ TỔNG                │                      │              │
│ 8,650,000đ          │  9,100,000đ          │  -450,000đ   │
│                     │                      │  (-5%) ▼     │
│                                               [Đóng]       │
└────────────────────────────────────────────────────────────┘
```

---

### 4. Export PDF
```
User: Click [Xuất PDF] button
  ↓
System: Generate PDF với cùng layout
  ↓
System: Download file "Luong_NguyenVanA_T062026.pdf"
  ↓
Duration: <3 seconds
```

---

## Edge Cases

### Case 1: Nhân viên nghỉ giữa tháng
```
Display:
┌──────────────────────────────────────────────────────────┐
│ 🟡 NHÂN VIÊN NGHỈ VIỆC                                   │
│                                                           │
│ Ngày nghỉ: 15/06/2026                                    │
│ Lương tính đến: 15/06                                    │
│                                                           │
│ Lương cơ bản:     3,461,538đ (15/26 ngày)               │
│ Hoa hồng:         1,200,000đ (8 ca trước 15/06)         │
│ KPI Bonus:        0đ (không đủ tháng)                    │
│                                                           │
└──────────────────────────────────────────────────────────┘
```

---

### Case 2: Lương = 0 (toàn bộ tháng vắng)
```
Display:
┌──────────────────────────────────────────────────────────┐
│ ⚠️ CẢNH BÁO: KHÔNG CÓ NGÀY CÔNG                         │
│                                                           │
│ Nhân viên vắng mặt toàn bộ tháng 6/2026                 │
│ Ngày công: 0/26                                          │
│                                                           │
│ Lương cơ bản:     0đ                                     │
│ Hoa hồng:         0đ                                     │
│ TỔNG LƯƠNG:       0đ                                     │
│                                                           │
│ [Kiểm tra chấm công] [Liên hệ nhân viên]                │
└──────────────────────────────────────────────────────────┘
```

---

### Case 3: Missing data (commission chưa nhập)
```
Display:
┌──────────────────────────────────────────────────────────┐
│ 🟡 HOA HỒNG DỊCH VỤ                          ???         │
│                                                           │
│ ⚠️ Dữ liệu hoa hồng chưa được nhập đầy đủ               │
│ Số ca hoàn thành: 12                                     │
│ Hoa hồng đã tính: 5/12 ca                               │
│                                                           │
│ [Nhập hoa hồng còn thiếu]                                │
└──────────────────────────────────────────────────────────┘
```

---

## Performance Requirements

| Metric | Target | Max Acceptable |
|--------|--------|----------------|
| Initial Load | <1.5s | 2s |
| Drill-down modal | <500ms | 1s |
| Comparison modal | <1s | 2s |
| PDF export | <2s | 3s |

**Optimization strategies:**
- Cache last month data (comparison common)
- Lazy load session details (only when clicked)
- Pre-compute breakdown (not real-time calculation)

---

## Accessibility

- ✅ Keyboard navigation (Tab through cards, Enter to expand)
- ✅ Screen reader support (ARIA labels for all numbers)
- ✅ High contrast mode (Green/Red still visible)
- ✅ Font size: Minimum 14px for numbers, 12px for labels

---

## Mobile Responsiveness

**Not MVP scope.** Employee Detail is desktop-first (HR uses laptop/desktop for payroll).

Mobile view: Show warning "Vui lòng sử dụng máy tính để xem chi tiết lương"

---

## Success Metrics

After deploying to 3-5 HR users for 1 month:

1. **Time to explain:** <5 mins (từ khi nhân viên hỏi đến khi HR trả lời xong)
   - Baseline: 20-30 mins (manual Excel lookup)
   - Target: 80% reduction

2. **Accuracy:** 100% (không còn lỗi tính toán khi giải thích)
   - Baseline: ~70% (manual calculation errors)

3. **User satisfaction:** "Rất hài lòng" (5/5) hoặc "Hài lòng" (4/5)
   - Survey question: "Màn hình này có giúp bạn giải thích lương dễ dàng hơn không?"

4. **Feature usage:** 80% HR staff dùng màn hình này ít nhất 1×/tuần

---

## Next Iteration Ideas (Not MVP)

1. **What-If Simulator:** "Nếu không bị phạt 50k thì lương là bao nhiêu?"
2. **Historical Chart:** Line chart lương 6 tháng gần nhất
3. **Peer Comparison:** "So với KTV khác cùng vị trí"
4. **Email Template:** "Gửi giải thích này cho nhân viên qua email"
5. **Comments:** HR có thể ghi chú cho từng khoản

**But for now:** Just nail the core job - Explain salary breakdown. 🎯

---

## Implementation Plan

### Phase 1: Static Mockup (1 day)
- [ ] Code React component với mock data
- [ ] Test layout với 1 nhân viên mẫu (Nguyễn Văn A)
- [ ] Show to HR → Get feedback on layout

### Phase 2: Real Data Integration (2 days)
- [ ] Connect to existing `salary_records` table
- [ ] Fetch breakdown from `recalculateAndSaveSalaryRecordEngine`
- [ ] Handle edge cases (resigned, missing data)

### Phase 3: Interactions (1 day)
- [ ] Expandable cards
- [ ] Session detail modal
- [ ] Comparison modal
- [ ] PDF export

### Phase 4: User Testing (2 days)
- [ ] Deploy to staging
- [ ] HR test with 5-10 real employees
- [ ] Collect feedback, iterate

**Total: ~6 days to production-ready killer feature.**
