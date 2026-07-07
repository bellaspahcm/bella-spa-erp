# Employee Detail Screen - Test Checklist

**Tester:** HR Staff (non-technical)  
**Date:** 2026-06-22  
**Version:** v1.0 (Static Mockup)  
**URL:** http://localhost:3000/dashboard/payroll/employees/emp001/detail

---

## Test Scenario: "Nhân viên hỏi tại sao lương tháng 6 là 8.65M"

### Pre-test Setup
- [ ] Dev server đang chạy
- [ ] Browser mở: Chrome/Edge (desktop)
- [ ] Màn hình tối thiểu: 1366x768

---

## Part 1: First Impression (30 giây đầu tiên)

**Quan sát tự nhiên (không hướng dẫn):**

1. **Có thấy tên nhân viên không?**
   - [ ] Yes → Ghi chú: _________________
   - [ ] No → **CRITICAL ISSUE**

2. **Có thấy tổng lương ngay không?**
   - [ ] Yes, rõ ràng
   - [ ] Yes, nhưng khó nhìn
   - [ ] No → **CRITICAL ISSUE**

3. **Có hiểu được màn hình này để làm gì không?**
   - [ ] Yes → Ghi chú mục đích: _________________
   - [ ] No → Cần cải thiện header/title

4. **Cảm giác đầu tiên?**
   - [ ] Overwhelmed (quá nhiều thông tin)
   - [ ] Just right (vừa đủ)
   - [ ] Too simple (thiếu thông tin)

---

## Part 2: Core Task - Giải Thích Lương

**Nhiệm vụ:** "Hãy giải thích cho tôi tại sao Nguyễn Văn A nhận 8.65M tháng này"

**Đo thời gian bắt đầu:** __:__

### 2.1. Xác định các thành phần lương

Tester tự tìm hiểu (không hướng dẫn):

- [ ] Tìm được "Lương cơ bản"
- [ ] Tìm được "Hoa hồng dịch vụ"
- [ ] Tìm được "Thưởng vị trí"
- [ ] Tìm được "Thưởng đánh giá"
- [ ] Tìm được "Phạt chấm công"
- [ ] Tìm được "Tạm ứng"

**Thời gian:** ____ phút ____ giây

**Câu hỏi:** Có thành phần nào khó tìm không?
- Ghi chú: _________________

---

### 2.2. Hiểu công thức tính

**Nhiệm vụ:** "Giải thích cho tôi công thức tính Lương cơ bản"

Tester tự tìm hiểu:

1. **Có thấy công thức không?**
   - [ ] Yes, ngay trên card
   - [ ] Yes, sau khi click mở rộng
   - [ ] No → **CRITICAL ISSUE**

2. **Có hiểu công thức không?**
   - [ ] Yes, rất rõ
   - [ ] Yes, nhưng phải đọc 2-3 lần
   - [ ] No → Ghi chú phần khó hiểu: _________________

3. **Có thấy "vắng 2 ngày" không?**
   - [ ] Yes, ngay lập tức
   - [ ] Yes, sau khi mở rộng
   - [ ] No → **ISSUE**

**Câu hỏi mở:** "Bạn có thể giải thích lại công thức cho tôi nghe không?"
- Ghi lại câu trả lời (kiểm tra xem hiểu đúng không): _________________

---

### 2.3. Drill-down vào Hoa hồng

**Nhiệm vụ:** "Cho tôi biết Nguyễn Văn A làm bao nhiêu ca, gói nào?"

Tester tự tìm hiểu:

1. **Có click vào card "Hoa hồng dịch vụ" không?**
   - [ ] Yes, tự động (không cần gợi ý)
   - [ ] Yes, sau khi gợi ý "click vào"
   - [ ] No, không nghĩ đến việc click

2. **Sau khi mở rộng, có thấy breakdown gói không?**
   - [ ] Yes, rõ ràng
   - [ ] Yes, nhưng phải cuộn
   - [ ] No → **ISSUE**

3. **Có hiểu "quy đổi" không?**
   - [ ] Yes (giải thích: _________________)
   - [ ] No → Cần giải thích thêm

4. **Có click nút "Xem 12 ca" không?**
   - [ ] Yes
   - [ ] No → Hỏi lý do: _________________

---

### 2.4. So sánh với tháng trước

**Nhiệm vụ:** "Tại sao lương tháng này giảm so với tháng 5?"

Tester tự tìm hiểu:

1. **Có thấy thông tin so sánh không?**
   - [ ] Yes, ngay trong header tổng lương
   - [ ] No → **CRITICAL ISSUE**

2. **Có hiểu ngay tại sao giảm không?**
   - [ ] Yes (giải thích: _________________)
   - [ ] No → Cần so sánh chi tiết

3. **Có click nút "So sánh" không?**
   - [ ] Yes, tự động
   - [ ] Yes, sau khi đọc header
   - [ ] No → Hỏi lý do: _________________

**Thời gian hoàn thành toàn bộ Part 2:** ____ phút ____ giây

**Target:** <5 phút  
**Result:** 
- [ ] ✅ Pass (<5 phút)
- [ ] ⚠️ Marginal (5-7 phút)
- [ ] ❌ Fail (>7 phút)

---

## Part 3: Usability Issues

### 3.1. Visual Design

**Câu hỏi:**

1. **Màu sắc có dễ phân biệt không?**
   - [ ] Yes, rõ ràng (green = thu nhập, red = khấu trừ)
   - [ ] Confusing → Ghi chú: _________________

2. **Chữ có đọc được không?**
   - [ ] Yes, dễ đọc
   - [ ] Too small → Ghi chú phần nào: _________________
   - [ ] Too big

3. **Layout có gọn gàng không?**
   - [ ] Yes, logic
   - [ ] Messy → Ghi chú: _________________

---

### 3.2. Terminology (Thuật ngữ)

**Câu hỏi:** "Có từ ngữ nào khó hiểu không?"

Đánh dấu các từ gây confusion:

- [ ] "Quy đổi"
- [ ] "Hệ số"
- [ ] "Tạm ứng"
- [ ] "Ngày công"
- [ ] Khác: _________________

**Đề xuất thay thế:** _________________

---

### 3.3. Missing Information

**Câu hỏi:** "Có thông tin nào bạn cần nhưng không thấy không?"

Ghi chú:
- _________________
- _________________
- _________________

---

### 3.4. Unnecessary Information

**Câu hỏi:** "Có thông tin nào thừa, không cần thiết không?"

Ghi chú:
- _________________
- _________________

---

## Part 4: Performance

### 4.1. Load Time

**Đo lường:**

1. **Initial page load:**
   - Thời gian: ____ giây
   - [ ] <2s ✅
   - [ ] 2-3s ⚠️
   - [ ] >3s ❌

2. **Expand card:**
   - Thời gian: ____ ms
   - [ ] Instant (<100ms) ✅
   - [ ] Noticeable (100-500ms) ⚠️
   - [ ] Slow (>500ms) ❌

---

## Part 5: Overall Satisfaction

### 5.1. Rating

**Câu hỏi:** "Trên thang điểm 1-5, màn hình này hữu ích như thế nào trong việc giải thích lương?"

- [ ] 5 - Rất hữu ích, dễ dùng
- [ ] 4 - Hữu ích, nhưng cần cải thiện vài điểm
- [ ] 3 - Bình thường
- [ ] 2 - Khó dùng, thiếu nhiều thông tin
- [ ] 1 - Không hữu ích

**Lý do chấm điểm:** _________________

---

### 5.2. Improvement Suggestions

**Câu hỏi mở:** "Nếu được thay đổi 1 điều duy nhất, bạn sẽ thay đổi gì?"

Ghi chú:
- _________________
- _________________
- _________________

---

### 5.3. Comparison to Current Process

**Câu hỏi:** "So với cách hiện tại (Excel), màn hình này có giúp bạn tiết kiệm thời gian không?"

- [ ] Yes, tiết kiệm rất nhiều (>50%)
- [ ] Yes, tiết kiệm đôi chút (20-50%)
- [ ] Same
- [ ] No, chậm hơn

**Lý do:** _________________

---

## Part 6: Edge Cases (Optional)

Nếu có thời gian, test các cases khác:

### 6.1. Nhân viên nghỉ giữa tháng
- [ ] Layout có bị vỡ không?
- [ ] Thông báo "nghỉ việc" có rõ ràng không?

### 6.2. Lương = 0 (vắng cả tháng)
- [ ] Có warning rõ ràng không?
- [ ] Có hướng dẫn next step không?

### 6.3. Missing data
- [ ] Có thông báo dữ liệu thiếu không?
- [ ] Có CTA để nhập data không?

---

## Test Summary

**Tester:** _________________  
**Date/Time:** _________________  
**Total time:** ____ phút  

**Critical Issues (Must fix before Phase 2):**
1. _________________
2. _________________

**Important Issues (Should fix):**
1. _________________
2. _________________

**Nice-to-have:**
1. _________________
2. _________________

**Overall Verdict:**
- [ ] ✅ Ready for Phase 2 (Real data integration)
- [ ] ⚠️ Minor fixes needed, then proceed
- [ ] ❌ Major rework needed

**Next Steps:**
- _________________
- _________________
